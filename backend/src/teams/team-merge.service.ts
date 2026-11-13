import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TeamStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { TeamLifecycleService, TEAM_ERROR } from './team-lifecycle.service';
import { listTeamReferences, quoteIdent, type RawDb, type TeamReference } from './team-references';

export const UNSUPPORTED_REFERENCE_CODE = 'TEAM_MERGE_UNSUPPORTED_REFERENCE';

export const MERGE_ERROR = {
  SAME_TEAM: 'TEAM_MERGE_SAME_TEAM',
  TARGET_NOT_ACTIVE: 'TEAM_MERGE_TARGET_NOT_ACTIVE',
  CYCLE: 'TEAM_MERGE_CYCLE',
  NOT_UNDOABLE: 'TEAM_MERGE_NOT_UNDOABLE',
} as const;

/**
 * What a merge does with each place that refers to a team. A foreign key with no entry here STOPS the merge: moving
 * "everything that points at the team" blindly is how a merge corrupts something nobody thought about, so a relation
 * added later has to be decided on before merge will touch the team.
 */
type Strategy = 'repoint' | 'memberships' | 'grants' | 'report-targets' | 'history' | 'own-settings';
const STRATEGY: Record<string, Strategy> = {
  'teams.parentId': 'repoint',
  'cases.assignedTeamId': 'repoint',
  'incidents.assignedTeamId': 'repoint',
  'petitions.assignedTeamId': 'repoint',
  'calendar_events.teamId': 'repoint',
  'case_handoffs.fromTeamId': 'repoint',
  'case_handoffs.toTeamId': 'repoint',
  'incident_handoffs.toTeamId': 'repoint',
  'user_teams.teamId': 'memberships',
  'data_access_grants.teamId': 'grants',
  'dyn_report_targets.teamId': 'report-targets',
  // A generated period keeps the team it was generated for: history is never rewritten (D09).
  'dyn_report_assignments.teamId': 'history',
  // What a team gives its people is that team's own setting: the people who move get what the target gives.
  'team_permission_configs.teamId': 'own-settings',
};
const keyOf = (ref: TeamReference) => `${ref.table}.${ref.column}`;

/** Tables whose rows a merge may delete (a duplicate) and later re-insert from the manifest. */
const RESTORABLE_TABLES = ['user_teams', 'data_access_grants'] as const;

export interface MergeSummary {
  moved: { table: string; column: string; count: number }[];
  duplicatesRemoved: { table: string; count: number }[];
  leadersRaised: number;
  skipped: { table: string; column: string; count: number; reason: 'HISTORY' | 'TARGET_HAS_ONE' | 'CLOSED' | 'OWN_SETTINGS' }[];
}

type Meta = { ipAddress?: string; userAgent?: string };
type Tx = Prisma.TransactionClient;
const TX_OPTIONS = { timeout: 600_000, maxWait: 10_000 } as const;

const int = async (db: RawDb, sql: string, ...params: unknown[]) => {
  const rows = await db.$queryRawUnsafe<{ n: number }[]>(sql, ...params);
  return Number(rows[0]?.n ?? 0);
};

@Injectable()
export class TeamMergeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly lifecycle: TeamLifecycleService,
  ) {}

  /** References the database has that this service has no decision for. Empty means every merge is safe to attempt. */
  async unsupportedReferences(db: RawDb = this.prisma): Promise<TeamReference[]> {
    return (await listTeamReferences(db)).filter((ref) => !(keyOf(ref) in STRATEGY));
  }

  // ── preview ─────────────────────────────────────────────────────────────

  /** What a merge would do, counted with the same predicates the merge uses. Read-only. */
  async preview(sourceId: string, targetId: string) {
    const { source, target } = await this.readPair(this.prisma, sourceId, targetId);
    const summary = await this.plan(this.prisma, sourceId, targetId);
    return { source: { id: source.id, name: source.name }, target: { id: target.id, name: target.name }, summary };
  }

  private async plan(db: RawDb, S: string, T: string): Promise<MergeSummary> {
    const refs = await this.supportedReferences(db);
    const summary: MergeSummary = { moved: [], duplicatesRemoved: [], leadersRaised: 0, skipped: [] };
    for (const ref of refs) {
      const t = quoteIdent(ref.table);
      const c = quoteIdent(ref.column);
      const strategy = STRATEGY[keyOf(ref)];
      const total = await int(db, `SELECT count(*)::int AS n FROM ${t} WHERE ${c} = $1`, S);
      if (strategy === 'repoint') {
        if (total) summary.moved.push({ table: ref.table, column: ref.column, count: total });
      } else if (strategy === 'memberships') {
        const dup = await int(
          db,
          `SELECT count(*)::int AS n FROM user_teams s JOIN user_teams t ON t."userId" = s."userId" AND t."teamId" = $2 WHERE s."teamId" = $1`,
          S,
          T,
        );
        summary.leadersRaised = await int(
          db,
          `SELECT count(*)::int AS n FROM user_teams s JOIN user_teams t ON t."userId" = s."userId" AND t."teamId" = $2 WHERE s."teamId" = $1 AND s."isLeader" AND NOT t."isLeader"`,
          S,
          T,
        );
        if (dup) summary.duplicatesRemoved.push({ table: ref.table, count: dup });
        if (total - dup) summary.moved.push({ table: ref.table, column: ref.column, count: total - dup });
      } else if (strategy === 'grants') {
        const dup = await int(
          db,
          `SELECT count(*)::int AS n FROM data_access_grants s JOIN data_access_grants t ON t."granteeId" = s."granteeId" AND t."accessLevel" = s."accessLevel" AND t."teamId" = $2 WHERE s."teamId" = $1`,
          S,
          T,
        );
        if (dup) summary.duplicatesRemoved.push({ table: ref.table, count: dup });
        if (total - dup) summary.moved.push({ table: ref.table, column: ref.column, count: total - dup });
      } else if (strategy === 'report-targets') {
        const open = await int(db, `SELECT count(*)::int AS n FROM ${t} WHERE ${c} = $1 AND "validTo" IS NULL`, S);
        const movable = await int(db, `SELECT count(*)::int AS n FROM ${t} x WHERE x."teamId" = $1 AND x."validTo" IS NULL AND ${NO_OPEN_TARGET_ON_T}`, S, T);
        if (movable) summary.moved.push({ table: ref.table, column: ref.column, count: movable });
        if (open - movable) summary.skipped.push({ table: ref.table, column: ref.column, count: open - movable, reason: 'TARGET_HAS_ONE' });
        if (total - open) summary.skipped.push({ table: ref.table, column: ref.column, count: total - open, reason: 'CLOSED' });
      } else if (total) {
        summary.skipped.push({ table: ref.table, column: ref.column, count: total, reason: strategy === 'own-settings' ? 'OWN_SETTINGS' : 'HISTORY' });
      }
    }
    return summary;
  }

  private async supportedReferences(db: RawDb): Promise<TeamReference[]> {
    const refs = await listTeamReferences(db);
    const unknown = refs.filter((ref) => !(keyOf(ref) in STRATEGY));
    if (unknown.length) {
      throw new ConflictException({ code: UNSUPPORTED_REFERENCE_CODE, details: unknown });
    }
    return refs;
  }

  // ── merge ───────────────────────────────────────────────────────────────

  async merge(sourceId: string, targetId: string, actorId: string, meta?: Meta) {
    const { operationId, summary, sourceName, targetName } = await this.prisma.$transaction(async (tx) => {
      const { source, target } = await this.readPair(tx, sourceId, targetId, true);
      const refs = await this.supportedReferences(tx);

      const operation = await tx.teamMergeOperation.create({
        data: {
          sourceTeamId: source.id,
          sourceName: source.name,
          targetTeamId: target.id,
          targetName: target.name,
          sourcePreviousStatus: source.status,
          mergedById: actorId,
          summary: {},
        },
      });

      const summary: MergeSummary = { moved: [], duplicatesRemoved: [], leadersRaised: 0, skipped: [] };
      for (const ref of refs) await this.moveReference(tx, operation.id, ref, source.id, target.id, summary);

      await this.lifecycle.applyStatus(tx, source.id, 'ARCHIVED', actorId);
      await tx.teamMergeOperation.update({ where: { id: operation.id }, data: { summary: summary as never } });
      return { operationId: operation.id, summary, sourceName: source.name, targetName: target.name };
    }, TX_OPTIONS);

    await this.audit.log({
      userId: actorId,
      action: 'TEAM_MERGED',
      subject: 'Team',
      subjectId: sourceId,
      metadata: { sourceName, targetName, targetTeamId: targetId, operationId, summary: summary as never },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });
    return { operationId, summary };
  }

  /** The two teams, locked in id order so two merges over the same pair can never deadlock, then every rule checked. */
  private async readPair(db: Tx | PrismaService, sourceId: string, targetId: string, lock = false) {
    if (sourceId === targetId) throw new BadRequestException({ code: MERGE_ERROR.SAME_TEAM });
    const [a, b] = [sourceId, targetId].sort();
    const rows = lock
      ? await (db as Tx).$queryRaw<{ id: string; name: string; status: TeamStatus }[]>`
          SELECT id, name, status FROM teams WHERE id IN (${a}, ${b}) ORDER BY id FOR UPDATE`
      : await db.$queryRaw<{ id: string; name: string; status: TeamStatus }[]>`
          SELECT id, name, status FROM teams WHERE id IN (${a}, ${b}) ORDER BY id`;
    const source = rows.find((r) => r.id === sourceId);
    const target = rows.find((r) => r.id === targetId);
    if (!source) throw new NotFoundException(`Team not found (id: ${sourceId})`);
    if (!target) throw new NotFoundException(`Team not found (id: ${targetId})`);
    if (source.status === 'ARCHIVED') {
      throw new ConflictException({ code: TEAM_ERROR.INVALID_TRANSITION, from: source.status, to: 'ARCHIVED' });
    }
    if (target.status !== 'ACTIVE') throw new ConflictException({ code: MERGE_ERROR.TARGET_NOT_ACTIVE });

    const [{ n: underSource }] = await db.$queryRaw<{ n: number }[]>`
      WITH RECURSIVE d AS (
        SELECT id FROM teams WHERE "parentId" = ${sourceId}
        UNION
        SELECT t.id FROM teams t JOIN d ON t."parentId" = d.id
      ) SELECT count(*)::int AS n FROM d WHERE id = ${targetId}`;
    if (Number(underSource) > 0) throw new ConflictException({ code: MERGE_ERROR.CYCLE });
    return { source, target };
  }

  private async moveReference(tx: Tx, op: string, ref: TeamReference, S: string, T: string, summary: MergeSummary) {
    const t = quoteIdent(ref.table);
    const c = quoteIdent(ref.column);
    const strategy = STRATEGY[keyOf(ref)];

    if (strategy === 'memberships') {
      const raised = await int(
        tx,
        `WITH raised AS (
           UPDATE user_teams t SET "isLeader" = true FROM user_teams s
            WHERE s."teamId" = $1 AND t."teamId" = $2 AND s."userId" = t."userId" AND s."isLeader" AND NOT t."isLeader"
            RETURNING t."userId", t."joinedAt"),
         ins AS (${MANIFEST_INSERT(`'FIELD'`, `'user_teams'`, `jsonb_build_object('userId', "userId", 'teamId', $2::text, 'joinedAt', "joinedAt")`, `jsonb_build_object('isLeader', false)`, `jsonb_build_object('isLeader', true)`, 'raised')} RETURNING 1)
         SELECT count(*)::int AS n FROM ins`,
        S, T, op,
      );
      summary.leadersRaised = raised;
      const removed = await int(
        tx,
        `WITH gone AS (
           DELETE FROM user_teams s USING user_teams t
            WHERE s."teamId" = $1 AND t."teamId" = $2 AND s."userId" = t."userId" RETURNING s.*),
         ins AS (${MANIFEST_INSERT(`'DELETED'`, `'user_teams'`, `jsonb_build_object('userId', "userId", 'teamId', "teamId")`, `to_jsonb(gone)`, `NULL::jsonb`, 'gone')} RETURNING 1)
         SELECT count(*)::int AS n FROM ins`,
        S, T, op,
      );
      if (removed) summary.duplicatesRemoved.push({ table: ref.table, count: removed });
      const moved = await int(
        tx,
        `WITH moved AS (UPDATE user_teams SET "teamId" = $2 WHERE "teamId" = $1 RETURNING "userId", "joinedAt"),
         ins AS (${MANIFEST_INSERT(`'REPOINT'`, `'user_teams'`, `jsonb_build_object('userId', "userId", 'teamId', $2::text, 'joinedAt', "joinedAt")`, `jsonb_build_object('teamId', $1::text)`, `jsonb_build_object('teamId', $2::text)`, 'moved')} RETURNING 1)
         SELECT count(*)::int AS n FROM ins`,
        S, T, op,
      );
      if (moved) summary.moved.push({ table: ref.table, column: ref.column, count: moved });
      return;
    }

    if (strategy === 'grants') {
      const removed = await int(
        tx,
        `WITH gone AS (
           DELETE FROM data_access_grants s USING data_access_grants t
            WHERE s."teamId" = $1 AND t."teamId" = $2 AND s."granteeId" = t."granteeId" AND s."accessLevel" = t."accessLevel" RETURNING s.*),
         ins AS (${MANIFEST_INSERT(`'DELETED'`, `'data_access_grants'`, `jsonb_build_object('id', id)`, `to_jsonb(gone)`, `NULL::jsonb`, 'gone')} RETURNING 1)
         SELECT count(*)::int AS n FROM ins`,
        S, T, op,
      );
      if (removed) summary.duplicatesRemoved.push({ table: ref.table, count: removed });
    }

    if (strategy === 'history' || strategy === 'own-settings') {
      const kept = await int(tx, `SELECT count(*)::int AS n FROM ${t} WHERE ${c} = $1`, S);
      if (kept) summary.skipped.push({ table: ref.table, column: ref.column, count: kept, reason: strategy === 'history' ? 'HISTORY' : 'OWN_SETTINGS' });
      return;
    }

    // Plain id-keyed rows: grants (after duplicates), report targets (open ones the target has no twin for), the rest.
    const only = strategy === 'report-targets' ? ` AND x."validTo" IS NULL AND ${NO_OPEN_TARGET_ON_T}` : '';
    const moved = await int(
      tx,
      `WITH moved AS (UPDATE ${t} x SET ${c} = $2 WHERE x.${c} = $1${only} RETURNING x.id),
       ins AS (${MANIFEST_INSERT(`'REPOINT'`, `$4::text`, `jsonb_build_object('id', id)`, `jsonb_build_object($5::text, $1::text)`, `jsonb_build_object($5::text, $2::text)`, 'moved')} RETURNING 1)
       SELECT count(*)::int AS n FROM ins`,
      S, T, op, ref.table, ref.column,
    );
    if (moved) summary.moved.push({ table: ref.table, column: ref.column, count: moved });

    if (strategy === 'report-targets') {
      const left = await int(tx, `SELECT count(*)::int AS n FROM ${t} WHERE ${c} = $1 AND "validTo" IS NULL`, S);
      const closed = await int(tx, `SELECT count(*)::int AS n FROM ${t} WHERE ${c} = $1 AND "validTo" IS NOT NULL`, S);
      if (left) summary.skipped.push({ table: ref.table, column: ref.column, count: left, reason: 'TARGET_HAS_ONE' });
      if (closed) summary.skipped.push({ table: ref.table, column: ref.column, count: closed, reason: 'CLOSED' });
    }
  }

  // ── undo ────────────────────────────────────────────────────────────────

  /** Puts back what the merge changed, except what has changed since: that is left alone and counted. */
  async undo(operationId: string, actorId: string, meta?: Meta) {
    const result = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM team_merge_operations WHERE id = ${operationId} FOR UPDATE`;
      if (!rows[0]) throw new NotFoundException(`Merge not found (id: ${operationId})`);
      const op = await tx.teamMergeOperation.findUniqueOrThrow({ where: { id: operationId } });
      if (op.status !== 'APPLIED') throw new ConflictException({ code: MERGE_ERROR.NOT_UNDOABLE });

      const S = op.sourceTeamId;
      const T = op.targetTeamId;
      const present = await tx.$queryRaw<{ id: string; status: TeamStatus }[]>`
        SELECT id, status FROM teams WHERE id IN (${S}, ${T}) ORDER BY id FOR UPDATE`;
      if (present.length < 2) throw new ConflictException({ code: MERGE_ERROR.NOT_UNDOABLE });

      let restored = 0;
      let skipped = 0;
      const tally = (done: number, total: number) => {
        restored += done;
        skipped += total - done;
      };

      // 1. rows that were moved: put the column back where the row has not moved on again
      const groups = await tx.$queryRaw<{ table_name: string; col: string; n: number }[]>`
        SELECT i."tableName" AS table_name, k.col AS col, count(*)::int AS n
          FROM team_merge_items i CROSS JOIN LATERAL jsonb_object_keys(i.before) AS k(col)
         WHERE i."operationId" = ${operationId} AND i.kind = 'REPOINT'
         GROUP BY 1, 2`;
      for (const g of groups) {
        if (!(`${g.table_name}.${g.col}` in STRATEGY)) continue; // never interpolate a name we did not decide on
        const t = quoteIdent(g.table_name);
        const c = quoteIdent(g.col);
        const done =
          g.table_name === 'user_teams'
            ? await int(
                tx,
                `WITH r AS (UPDATE user_teams x SET "teamId" = $3
                   FROM team_merge_items i
                  WHERE i."operationId" = $1 AND i."tableName" = 'user_teams' AND i.kind = 'REPOINT'
                    AND x."userId" = i."recordKey"->>'userId' AND x."teamId" = $2
                    AND x."joinedAt" = (i."recordKey"->>'joinedAt')::timestamp
                    AND NOT EXISTS (SELECT 1 FROM user_teams y WHERE y."userId" = x."userId" AND y."teamId" = $3)
                  RETURNING 1) SELECT count(*)::int AS n FROM r`,
                operationId, T, S,
              )
            : await int(
                tx,
                `WITH r AS (UPDATE ${t} x SET ${c} = $3
                   FROM team_merge_items i
                  WHERE i."operationId" = $1 AND i."tableName" = $4 AND i.kind = 'REPOINT' AND jsonb_exists(i.before, $5)
                    AND x.id = i."recordKey"->>'id' AND x.${c} = $2${undoGuard(g.table_name)}
                  RETURNING 1) SELECT count(*)::int AS n FROM r`,
                operationId, T, S, g.table_name, g.col,
              );
        tally(done, g.n);
      }

      // 2. the leader flags the merge raised
      const flags = await int(tx, `SELECT count(*)::int AS n FROM team_merge_items WHERE "operationId" = $1 AND kind = 'FIELD'`, operationId);
      const flagsDone = await int(
        tx,
        `WITH r AS (UPDATE user_teams x SET "isLeader" = (i.before->>'isLeader')::boolean
           FROM team_merge_items i
          WHERE i."operationId" = $1 AND i.kind = 'FIELD' AND i."tableName" = 'user_teams'
            AND x."userId" = i."recordKey"->>'userId' AND x."teamId" = i."recordKey"->>'teamId'
            AND x."joinedAt" = (i."recordKey"->>'joinedAt')::timestamp
            AND x."isLeader" = (i.after->>'isLeader')::boolean
          RETURNING 1) SELECT count(*)::int AS n FROM r`,
        operationId,
      );
      tally(flagsDone, flags);

      // 3. duplicates that were removed: put the row back unless an equal one exists again
      for (const table of RESTORABLE_TABLES) {
        const total = await int(
          tx,
          `SELECT count(*)::int AS n FROM team_merge_items WHERE "operationId" = $1 AND kind = 'DELETED' AND "tableName" = $2`,
          operationId, table,
        );
        if (!total) continue;
        const done = await int(
          tx,
          `WITH r AS (INSERT INTO ${quoteIdent(table)}
                      SELECT (jsonb_populate_record(NULL::${quoteIdent(table)}, i.before)).*
                        FROM team_merge_items i
                       WHERE i."operationId" = $1 AND i.kind = 'DELETED' AND i."tableName" = $2
                      ON CONFLICT DO NOTHING RETURNING 1) SELECT count(*)::int AS n FROM r`,
          operationId, table,
        );
        tally(done, total);
      }

      // 4. the source goes back to the state it had, if nobody has moved it since the merge archived it
      if (present.find((r) => r.id === S)?.status === 'ARCHIVED') {
        await this.lifecycle.applyStatus(tx, S, 'ACTIVE', actorId);
        if (op.sourcePreviousStatus === 'INACTIVE') await this.lifecycle.applyStatus(tx, S, 'INACTIVE', actorId);
      }
      await tx.teamMergeOperation.update({
        where: { id: operationId },
        data: { status: 'UNDONE', undoneById: actorId, undoneAt: new Date() },
      });
      return { restored, skipped, sourceTeamId: S, targetTeamId: T };
    }, TX_OPTIONS);

    await this.audit.log({
      userId: actorId,
      action: 'TEAM_MERGE_UNDONE',
      subject: 'Team',
      subjectId: result.sourceTeamId,
      metadata: { operationId, targetTeamId: result.targetTeamId, restored: result.restored, skipped: result.skipped },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });
    return { restored: result.restored, skipped: result.skipped };
  }

  /** Recent merges, newest first, for the screen that offers Undo. */
  async list(limit = 20) {
    return this.prisma.teamMergeOperation.findMany({
      orderBy: { mergedAt: 'desc' },
      take: limit,
      select: {
        id: true, sourceTeamId: true, sourceName: true, targetTeamId: true, targetName: true,
        status: true, mergedAt: true, undoneAt: true, summary: true,
      },
    });
  }
}

/**
 * Putting a row back on the source must not break an invariant that only holds NOW. A row that cannot go back is left
 * where it is and counted as skipped, never forced:
 * - grants are unique per (grantee, level, team): one created on the source after the merge would make the undo fail;
 * - a child team goes back under the source only if the source is not now inside that child's own subtree, or the
 *   hierarchy would loop (and both teams would vanish from the tree).
 */
function undoGuard(table: string): string {
  if (table === 'data_access_grants') {
    return ` AND NOT EXISTS (SELECT 1 FROM data_access_grants y WHERE y."granteeId" = x."granteeId" AND y."accessLevel" = x."accessLevel" AND y."teamId" = $3)`;
  }
  if (table === 'teams') {
    return ` AND NOT EXISTS (
      WITH RECURSIVE sub AS (SELECT x.id AS id UNION SELECT c.id FROM teams c JOIN sub ON c."parentId" = sub.id)
      SELECT 1 FROM sub WHERE sub.id = $3)`;
  }
  return '';
}

/** A source open target moves only when the target team has no open target of its own for the same report. */
const NO_OPEN_TARGET_ON_T = `NOT EXISTS (SELECT 1 FROM dyn_report_targets y WHERE y."reportId" = x."reportId" AND y."teamId" = $2 AND y."validTo" IS NULL)`;

/** One manifest row per touched record, built set-based from the CTE the statement just produced. */
function MANIFEST_INSERT(kind: string, table: string, key: string, before: string, after: string, from: string) {
  return `INSERT INTO team_merge_items (id, "operationId", kind, "tableName", "recordKey", before, after)
          SELECT gen_random_uuid()::text, $3, ${kind}, ${table}, ${key}, ${before}, ${after} FROM ${from}`;
}
