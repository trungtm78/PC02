import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';
import { MOVED_RECORD_TABLES } from './pc02-unit-chart';

/**
 * Moves the people of one team, and the records assigned to it, to another team. NOT a merge (`TeamMergeService`):
 * the source team stays as it is, active, with its configuration, its ward requests, its calendar, its history. Only
 * these move:
 *   user_teams                 every membership of the source (the leader flag is kept);
 *   petitions/incidents/cases  every record assigned to the source that is not deleted;
 *   proc_record_step_parties   "the unit holding the record" of a step of a moved record (it follows the record, as in
 *                              a merge); a unit a flow names by itself is not touched.
 *
 * Every row moved is logged with the column as it was and as the move left it (`team_record_move_items`), in the same
 * transaction. The undo puts back only a row that is still exactly as the move left it: a membership still on the
 * target (and the person not back on the source already), a record still on the target and not changed since (its
 * `updatedAt` is what it was when moved). Everything else is left where it is and LISTED.
 */

export const MOVE_ERROR = {
  ALREADY_MEMBER: 'TEAM_MOVE_ALREADY_MEMBER_OF_TARGET',
  NOT_UNDOABLE: 'TEAM_MOVE_NOT_UNDOABLE',
} as const;

type Tx = Prisma.TransactionClient;
const TX_OPTIONS = { timeout: 600_000, maxWait: 10_000 } as const;

export interface MoveSummary {
  moved: Record<string, number>;
}
export interface UndoSummary {
  restored: Record<string, number>;
  /** Per table, the rows left alone because they changed since the move (ids, at most 50 per table). */
  skipped: Record<string, { count: number; ids: string[] }>;
}

const int = async (db: Tx, sql: string, ...params: unknown[]) => Number((await db.$queryRawUnsafe<{ n: number }[]>(sql, ...params))[0]?.n ?? 0);

const ITEM = `INSERT INTO team_record_move_items (id, "moveId", "tableName", "recordKey", before, after)`;

/** Inside the caller's transaction. Returns the id of the move, to undo it with. */
export async function moveTeamPeopleAndRecords(
  tx: Tx,
  input: { sourceTeamId: string; targetTeamId: string; reason: string; actorId: string },
): Promise<{ moveId: string; summary: MoveSummary }> {
  const { sourceTeamId: S, targetTeamId: T } = input;
  // The two teams, locked in id order (another move or a merge over the same pair waits instead of interleaving).
  const teams = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM teams WHERE id IN (${S}, ${T}) ORDER BY id FOR UPDATE`;
  if (teams.length < 2) throw new NotFoundException({ code: 'TEAM_NOT_FOUND' });
  const twice = await int(
    tx,
    `SELECT count(*)::int AS n FROM user_teams s JOIN user_teams t ON t."userId" = s."userId" AND t."teamId" = $2 WHERE s."teamId" = $1`,
    S,
    T,
  );
  if (twice > 0) throw new ConflictException({ code: MOVE_ERROR.ALREADY_MEMBER, details: [{ count: twice }] });

  const move = await tx.teamRecordMove.create({
    data: { sourceTeamId: S, targetTeamId: T, reason: input.reason, movedById: input.actorId, summary: {} },
    select: { id: true },
  });
  const moved: Record<string, number> = {};

  moved.user_teams = await int(
    tx,
    `WITH m AS (UPDATE user_teams SET "teamId" = $2 WHERE "teamId" = $1 RETURNING "userId", "isLeader"),
          i AS (${ITEM}
                SELECT gen_random_uuid()::text, $3, 'user_teams', jsonb_build_object('userId', "userId"),
                       jsonb_build_object('teamId', $1::text, 'isLeader', "isLeader"), jsonb_build_object('teamId', $2::text) FROM m RETURNING 1)
     SELECT count(*)::int AS n FROM i`,
    S,
    T,
    move.id,
  );

  for (const { table, kind } of MOVED_RECORD_TABLES) {
    moved[table] = await int(
      tx,
      `WITH m AS (UPDATE "${table}" SET "assignedTeamId" = $2 WHERE "assignedTeamId" = $1 AND "deletedAt" IS NULL RETURNING id, "updatedAt"),
            i AS (${ITEM}
                  SELECT gen_random_uuid()::text, $3, '${table}', jsonb_build_object('id', id),
                         jsonb_build_object('assignedTeamId', $1::text), jsonb_build_object('assignedTeamId', $2::text, 'updatedAt', to_jsonb("updatedAt")) FROM m RETURNING 1)
       SELECT count(*)::int AS n FROM i`,
      S,
      T,
      move.id,
    );
    // The unit holding the record, on the steps of the records that just moved.
    moved[`proc_record_step_parties:${kind}`] = await int(
      tx,
      `WITH m AS (UPDATE proc_record_step_parties p SET "teamId" = $2
                    FROM proc_record_steps s, team_record_move_items r
                   WHERE p."recordStepId" = s.id AND p."partyKind" = 'RECORD_TEAM' AND p."teamId" = $1
                     AND s."recordKind" = '${kind}'::"ProcRecordKind" AND r."moveId" = $3 AND r."tableName" = '${table}' AND r."recordKey"->>'id' = s."recordId"
                  RETURNING p.id),
            i AS (${ITEM}
                  SELECT gen_random_uuid()::text, $3, 'proc_record_step_parties', jsonb_build_object('id', id),
                         jsonb_build_object('teamId', $1::text), jsonb_build_object('teamId', $2::text) FROM m RETURNING 1)
       SELECT count(*)::int AS n FROM i`,
      S,
      T,
      move.id,
    );
  }
  const summary: MoveSummary = { moved };
  await tx.teamRecordMove.update({ where: { id: move.id }, data: { summary: summary as unknown as Prisma.InputJsonValue } });
  return { moveId: move.id, summary };
}

/** The move of `source` to `target` that is in effect, if any (the newest one). */
export async function appliedMove(db: PrismaClient | Tx, sourceTeamId: string, targetTeamId: string) {
  return db.teamRecordMove.findFirst({
    where: { sourceTeamId, targetTeamId, status: 'APPLIED' },
    orderBy: { movedAt: 'desc' },
    select: { id: true, movedAt: true },
  });
}

/** Undoes a move, in one transaction of its own. */
export async function undoTeamRecordMove(db: PrismaClient, moveId: string, actorId: string): Promise<UndoSummary & { sourceTeamId: string; targetTeamId: string }> {
  return db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM team_record_moves WHERE id = ${moveId} FOR UPDATE`;
    if (!locked[0]) throw new NotFoundException({ code: 'TEAM_MOVE_NOT_FOUND' });
    const move = await tx.teamRecordMove.findUniqueOrThrow({ where: { id: moveId } });
    if (move.status !== 'APPLIED') throw new ConflictException({ code: MOVE_ERROR.NOT_UNDOABLE });
    const S = move.sourceTeamId;
    const T = move.targetTeamId;
    await tx.$queryRaw`SELECT id FROM teams WHERE id IN (${S}, ${T}) ORDER BY id FOR UPDATE`;

    const restored: Record<string, number> = {};
    restored.user_teams = await int(
      tx,
      `WITH r AS (UPDATE user_teams x SET "teamId" = $3
                    FROM team_record_move_items i
                   WHERE i."moveId" = $1 AND i."tableName" = 'user_teams'
                     AND x."userId" = i."recordKey"->>'userId' AND x."teamId" = $2
                     AND NOT EXISTS (SELECT 1 FROM user_teams y WHERE y."userId" = x."userId" AND y."teamId" = $3)
                  RETURNING 1) SELECT count(*)::int AS n FROM r`,
      moveId,
      T,
      S,
    );
    for (const { table } of MOVED_RECORD_TABLES) {
      restored[table] = await int(
        tx,
        `WITH r AS (UPDATE "${table}" x SET "assignedTeamId" = $3
                      FROM team_record_move_items i
                     WHERE i."moveId" = $1 AND i."tableName" = '${table}' AND x.id = i."recordKey"->>'id'
                       AND x."assignedTeamId" = $2 AND to_jsonb(x."updatedAt") = i.after->'updatedAt'
                    RETURNING 1) SELECT count(*)::int AS n FROM r`,
        moveId,
        T,
        S,
      );
    }
    restored.proc_record_step_parties = await int(
      tx,
      `WITH r AS (UPDATE proc_record_step_parties x SET "teamId" = $3
                    FROM team_record_move_items i
                   WHERE i."moveId" = $1 AND i."tableName" = 'proc_record_step_parties' AND x.id = i."recordKey"->>'id' AND x."teamId" = $2
                  RETURNING 1) SELECT count(*)::int AS n FROM r`,
      moveId,
      T,
      S,
    );

    // What was left alone: an item whose row is not back on the source now.
    const skipped: UndoSummary['skipped'] = {};
    const left = await tx.$queryRawUnsafe<{ table_name: string; key: string }[]>(
      `SELECT i."tableName" AS table_name, coalesce(i."recordKey"->>'id', i."recordKey"->>'userId') AS key
         FROM team_record_move_items i
        WHERE i."moveId" = $1 AND NOT (
          CASE i."tableName"
            WHEN 'user_teams' THEN EXISTS (SELECT 1 FROM user_teams x WHERE x."userId" = i."recordKey"->>'userId' AND x."teamId" = $2)
            WHEN 'petitions' THEN EXISTS (SELECT 1 FROM petitions x WHERE x.id = i."recordKey"->>'id' AND x."assignedTeamId" = $2)
            WHEN 'incidents' THEN EXISTS (SELECT 1 FROM incidents x WHERE x.id = i."recordKey"->>'id' AND x."assignedTeamId" = $2)
            WHEN 'cases' THEN EXISTS (SELECT 1 FROM cases x WHERE x.id = i."recordKey"->>'id' AND x."assignedTeamId" = $2)
            WHEN 'proc_record_step_parties' THEN EXISTS (SELECT 1 FROM proc_record_step_parties x WHERE x.id = i."recordKey"->>'id' AND x."teamId" = $2)
            ELSE false END)
        ORDER BY 1, 2`,
      moveId,
      S,
    );
    for (const row of left) {
      const entry = (skipped[row.table_name] ??= { count: 0, ids: [] });
      entry.count += 1;
      if (entry.ids.length < 50) entry.ids.push(row.key);
    }
    const summary = { ...(move.summary as object), undo: { restored, skipped: Object.fromEntries(Object.entries(skipped).map(([k, v]) => [k, v.count])) } };
    await tx.teamRecordMove.update({
      where: { id: moveId },
      data: { status: 'UNDONE', undoneById: actorId, undoneAt: new Date(), summary: summary as unknown as Prisma.InputJsonValue },
    });
    return { restored, skipped, sourceTeamId: S, targetTeamId: T };
  }, TX_OPTIONS);
}
