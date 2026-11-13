import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Client } from 'pg';
import { randomUUID } from 'node:crypto';
import { TeamLifecycleService } from './team-lifecycle.service';
import { TeamMergeService, UNSUPPORTED_REFERENCE_CODE } from './team-merge.service';

/**
 * Merging a team into another, on a REAL PostgreSQL.
 *
 * Merge moves records of every kind (members, handoffs, petitions, grants, report targets) in one transaction and keeps
 * a manifest to undo it. What only a real database shows: the unique keys that a plain "change the team id" would
 * violate (a person in both teams, the same grant twice), the set-based manifest, the undo that must not overwrite what
 * changed since, and that every foreign key to `teams` has a decision.
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

run('Team merge on PostgreSQL', () => {
  let db: PrismaClient;
  let pg: Client;
  let lifecycle: TeamLifecycleService;
  let service: TeamMergeService;
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const tag = `tm-${randomUUID().slice(0, 8)}`;
  let n = 0;
  let u1 = '';
  let u2 = '';
  let u3 = '';

  const team = (data: Record<string, unknown> = {}) => {
    n += 1;
    return db.team.create({ data: { code: `${tag}-${n}`, name: `${tag}-${n}`, ...data } });
  };
  const petition = (assignedTeamId: string) => {
    n += 1;
    return db.petition.create({
      data: { senderName: `${tag}-p${n}`, receivedDate: new Date('2026-01-01'), stt: `${tag}-${n}`, assignedTeamId },
    });
  };

  beforeAll(async () => {
    const u = new URL(url!);
    if (u.hostname !== '127.0.0.1' || !['/pc02_dynamic_reports_test', '/pc02_goiy_scope_test'].includes(u.pathname)) {
      throw new Error('Refused: DYN_REPORTS_DATABASE_URL must point at a local scratch database');
    }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
    pg = new Client({ connectionString: url! });
    await pg.connect();
    lifecycle = new TeamLifecycleService(db as never, audit as never);
    service = new TeamMergeService(db as never, audit as never, lifecycle);
    const role = await db.role.create({ data: { name: `${tag}-role` } });
    const mk = async (name: string) =>
      (await db.user.create({ data: { username: `${tag}-${name}`, passwordHash: 'x', roleId: role.id } })).id;
    u1 = await mk('u1');
    u2 = await mk('u2');
    u3 = await mk('u3');
  });

  afterAll(async () => {
    const teams = await db.team.findMany({ where: { code: { startsWith: tag } }, select: { id: true } });
    const ids = teams.map((t) => t.id);
    await db.teamMergeOperation.deleteMany({ where: { OR: [{ sourceTeamId: { in: ids } }, { targetTeamId: { in: ids } }] } });
    await db.dynReportAssignment.deleteMany({ where: { teamId: { in: ids } } });
    await db.dynReportPeriod.deleteMany({ where: { report: { code: { startsWith: tag } } } });
    await db.dynReportTarget.deleteMany({ where: { teamId: { in: ids } } });
    await db.dynReportVersion.deleteMany({ where: { report: { code: { startsWith: tag } } } });
    await db.dynReport.deleteMany({ where: { code: { startsWith: tag } } });
    await db.dataAccessGrant.deleteMany({ where: { teamId: { in: ids } } });
    await db.petition.deleteMany({ where: { senderName: { startsWith: tag } } });
    await db.userTeam.deleteMany({ where: { teamId: { in: ids } } });
    // children first
    await db.team.deleteMany({ where: { code: { startsWith: tag }, parentId: { not: null } } });
    await db.team.deleteMany({ where: { code: { startsWith: tag } } });
    await db.user.deleteMany({ where: { username: { startsWith: tag } } });
    await db.role.deleteMany({ where: { name: { startsWith: tag } } });
    await pg.end();
    await db.$disconnect();
  });

  async function report(name: string) {
    const r = await db.dynReport.create({ data: { code: `${tag}-${name}-${++n}`, name: `${tag} ${name}`, status: 'PUBLISHED' } });
    const v = await db.dynReportVersion.create({
      data: {
        reportId: r.id, version: 1, status: 'PUBLISHED', fileBytes: Buffer.from('x'), sha256: 'f'.repeat(64),
        fileName: 'm.xlsx', selectedSheets: ['S'], layout: {}, parserVersion: 't', engineVersion: 't',
      },
    });
    return { reportId: r.id, versionId: v.id };
  }

  /** A source team S and a target T with one of everything the merge has to deal with. */
  async function scenario() {
    const S = await team({ name: `${tag}-S${++n}` });
    const T = await team({ name: `${tag}-T${++n}` });
    const child = await team({ parentId: S.id });
    // u1 is in both (leader of S, plain member of T), u2 only in S, u3 only in T.
    await db.userTeam.createMany({
      data: [
        { userId: u1, teamId: S.id, isLeader: true },
        { userId: u1, teamId: T.id, isLeader: false },
        { userId: u2, teamId: S.id },
        { userId: u3, teamId: T.id },
      ],
    });
    const p1 = await petition(S.id);
    const p2 = await petition(S.id);
    const keep = await petition(T.id);
    await db.dataAccessGrant.createMany({
      data: [
        { granteeId: u1, teamId: S.id, accessLevel: 'READ', grantedById: u3 },
        { granteeId: u1, teamId: T.id, accessLevel: 'READ', grantedById: u3 },
        { granteeId: u2, teamId: S.id, accessLevel: 'WRITE', grantedById: u3 },
      ],
    });
    // Report targets: R1 is open for S only (moves); R2 is open for both (T keeps its own, S's is left); R3 is closed.
    const r1 = await report('r1');
    const r2 = await report('r2');
    const r3 = await report('r3');
    const t1 = await db.dynReportTarget.create({ data: { reportId: r1.reportId, teamId: S.id } });
    const t2s = await db.dynReportTarget.create({ data: { reportId: r2.reportId, teamId: S.id } });
    await db.dynReportTarget.create({ data: { reportId: r2.reportId, teamId: T.id } });
    const t3 = await db.dynReportTarget.create({ data: { reportId: r3.reportId, teamId: S.id, validTo: new Date('2026-02-01') } });
    // A generated period keeps S's assignment: history is never rewritten.
    const period = await db.dynReportPeriod.create({
      data: {
        reportId: r1.reportId, versionId: r1.versionId, periodKey: '2026-01', startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'), opensAt: new Date('2026-01-01'), dueAt: new Date('2026-02-05'), scheduleSnapshot: {},
      },
    });
    const assignment = await db.dynReportAssignment.create({ data: { periodId: period.id, teamId: S.id, teamSnapshot: {} } });
    return { S, T, child, p1, p2, keep, t1, t2s, t3, assignment };
  }

  const memberships = async (teamId: string) =>
    (await db.userTeam.findMany({ where: { teamId }, orderBy: { userId: 'asc' } })).map((m) => ({ userId: m.userId, isLeader: m.isLeader }));

  describe('merge', () => {
    it('moves everything the source holds to the target, resolving what would collide', async () => {
      const s = await scenario();
      const before = await db.petition.findUniqueOrThrow({ where: { id: s.p1.id } });

      const result = await service.merge(s.S.id, s.T.id, 'actor');

      // members: u1 is in both -> one row, and the leader flag is kept; u2 moved; u3 untouched; the source is empty
      expect(await memberships(s.T.id)).toEqual(
        expect.arrayContaining([{ userId: u1, isLeader: true }, { userId: u2, isLeader: false }, { userId: u3, isLeader: false }]),
      );
      expect(await memberships(s.T.id)).toHaveLength(3);
      expect(await memberships(s.S.id)).toEqual([]);
      // petitions and the child team follow; a record of another team does not; nothing is "touched" (updatedAt stays)
      expect((await db.petition.findMany({ where: { id: { in: [s.p1.id, s.p2.id] } } })).map((p) => p.assignedTeamId)).toEqual([s.T.id, s.T.id]);
      expect((await db.petition.findUniqueOrThrow({ where: { id: s.keep.id } })).assignedTeamId).toBe(s.T.id);
      expect((await db.petition.findUniqueOrThrow({ where: { id: s.p1.id } })).updatedAt).toEqual(before.updatedAt);
      expect((await db.team.findUniqueOrThrow({ where: { id: s.child.id } })).parentId).toBe(s.T.id);
      // grants: u1's READ on S duplicated the one on T and is dropped; u2's WRITE moves
      const grants = await db.dataAccessGrant.findMany({ where: { teamId: { in: [s.S.id, s.T.id] } } });
      expect(grants.filter((g) => g.teamId === s.S.id)).toEqual([]);
      expect(grants.filter((g) => g.teamId === s.T.id)).toHaveLength(2);
      // report targets: R1 moves, R2 stays (T already has an open one), the closed one stays; the assignment stays
      expect((await db.dynReportTarget.findUniqueOrThrow({ where: { id: s.t1.id } })).teamId).toBe(s.T.id);
      expect((await db.dynReportTarget.findUniqueOrThrow({ where: { id: s.t2s.id } })).teamId).toBe(s.S.id);
      expect((await db.dynReportTarget.findUniqueOrThrow({ where: { id: s.t3.id } })).teamId).toBe(s.S.id);
      expect((await db.dynReportAssignment.findUniqueOrThrow({ where: { id: s.assignment.id } })).teamId).toBe(s.S.id);
      // the source is archived, the operation recorded and audited without any figures from the records
      const source = await db.team.findUniqueOrThrow({ where: { id: s.S.id } });
      expect(source).toMatchObject({ status: 'ARCHIVED', archivedById: 'actor' });
      expect(await db.teamMergeOperation.findUniqueOrThrow({ where: { id: result.operationId } })).toMatchObject({
        status: 'APPLIED', sourceTeamId: s.S.id, targetTeamId: s.T.id, sourcePreviousStatus: 'ACTIVE',
      });
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'TEAM_MERGED', subjectId: s.S.id }));
    });

    it('the preview reports exactly what the merge then does', async () => {
      const s = await scenario();

      const preview = await service.preview(s.S.id, s.T.id);
      const result = await service.merge(s.S.id, s.T.id, 'actor');

      expect(preview.summary).toEqual(result.summary);
      const count = (table: string, column: string) =>
        result.summary.moved.find((m) => m.table === table && m.column === column)?.count;
      expect(count('petitions', 'assignedTeamId')).toBe(2);
      expect(count('user_teams', 'teamId')).toBe(1);
      expect(count('teams', 'parentId')).toBe(1);
      expect(count('dyn_report_targets', 'teamId')).toBe(1);
      expect(result.summary.duplicatesRemoved).toEqual(
        expect.arrayContaining([{ table: 'user_teams', count: 1 }, { table: 'data_access_grants', count: 1 }]),
      );
      expect(result.summary.leadersRaised).toBe(1);
      expect(result.summary.skipped).toEqual(
        expect.arrayContaining([
          { table: 'dyn_report_assignments', column: 'teamId', count: 1, reason: 'HISTORY' },
          { table: 'dyn_report_targets', column: 'teamId', count: 1, reason: 'TARGET_HAS_ONE' },
          { table: 'dyn_report_targets', column: 'teamId', count: 1, reason: 'CLOSED' },
        ]),
      );
    });

    it('refuses to merge a team into itself, into a paused team, or an archived team into anything', async () => {
      const a = await team();
      const paused = await team({ status: 'INACTIVE' });
      const archived = await team({ status: 'ARCHIVED' });
      await expect(service.merge(a.id, a.id, 'actor')).rejects.toMatchObject({ response: { code: 'TEAM_MERGE_SAME_TEAM' } });
      await expect(service.merge(a.id, paused.id, 'actor')).rejects.toMatchObject({ response: { code: 'TEAM_MERGE_TARGET_NOT_ACTIVE' } });
      await expect(service.merge(archived.id, a.id, 'actor')).rejects.toMatchObject({ response: { code: 'TEAM_INVALID_TRANSITION' } });
      await expect(service.merge('missing', a.id, 'actor')).rejects.toMatchObject({ status: 404 });
    });

    it('refuses to merge a team into one of its own descendants (that would orphan the tree)', async () => {
      const parent = await team();
      const kid = await team({ parentId: parent.id });
      const grandkid = await team({ parentId: kid.id });
      await expect(service.merge(parent.id, grandkid.id, 'actor')).rejects.toMatchObject({ response: { code: 'TEAM_MERGE_CYCLE' } });
    });

    it('a failure half way leaves nothing changed (one transaction)', async () => {
      const s = await scenario();
      // Make the last step fail inside the database: archiving the source writes the team row.
      const fn = `${tag.replace(/-/g, '_')}_boom`;
      await pg.query(`CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'boom'; END $$`);
      await pg.query(
        `CREATE TRIGGER ${fn}_t BEFORE UPDATE OF "status" ON teams FOR EACH ROW WHEN (OLD.id = '${s.S.id}') EXECUTE FUNCTION ${fn}()`,
      );
      try {
        await expect(service.merge(s.S.id, s.T.id, 'actor')).rejects.toThrow();
      } finally {
        await pg.query(`DROP TRIGGER ${fn}_t ON teams`);
        await pg.query(`DROP FUNCTION ${fn}()`);
      }
      expect(await memberships(s.S.id)).toHaveLength(2);
      expect((await db.petition.findUniqueOrThrow({ where: { id: s.p1.id } })).assignedTeamId).toBe(s.S.id);
      expect(await db.teamMergeOperation.count({ where: { sourceTeamId: s.S.id } })).toBe(0);
    });
  });

  describe('undo', () => {
    it('puts every record back, the source returns to its previous state, and the operation closes', async () => {
      const s = await scenario();
      const { operationId } = await service.merge(s.S.id, s.T.id, 'actor');

      const undone = await service.undo(operationId, 'actor2');

      expect(await memberships(s.S.id)).toEqual(
        expect.arrayContaining([{ userId: u1, isLeader: true }, { userId: u2, isLeader: false }]),
      );
      expect(await memberships(s.S.id)).toHaveLength(2);
      // u1's flag on T goes back to what it was
      expect(await memberships(s.T.id)).toEqual(
        expect.arrayContaining([{ userId: u1, isLeader: false }, { userId: u3, isLeader: false }]),
      );
      expect(await memberships(s.T.id)).toHaveLength(2);
      expect((await db.petition.findUniqueOrThrow({ where: { id: s.p1.id } })).assignedTeamId).toBe(s.S.id);
      expect((await db.petition.findUniqueOrThrow({ where: { id: s.keep.id } })).assignedTeamId).toBe(s.T.id);
      expect((await db.team.findUniqueOrThrow({ where: { id: s.child.id } })).parentId).toBe(s.S.id);
      expect(await db.dataAccessGrant.count({ where: { teamId: s.S.id } })).toBe(2);
      expect((await db.dynReportTarget.findUniqueOrThrow({ where: { id: s.t1.id } })).teamId).toBe(s.S.id);
      expect(await db.team.findUniqueOrThrow({ where: { id: s.S.id } })).toMatchObject({ status: 'ACTIVE', archivedById: null });
      expect(await db.teamMergeOperation.findUniqueOrThrow({ where: { id: operationId } })).toMatchObject({
        status: 'UNDONE', undoneById: 'actor2',
      });
      expect(undone.skipped).toBe(0);
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'TEAM_MERGE_UNDONE' }));
    });

    it('does not overwrite what changed since: a record moved on is left where it is and reported', async () => {
      const s = await scenario();
      const other = await team();
      const { operationId } = await service.merge(s.S.id, s.T.id, 'actor');
      await db.petition.update({ where: { id: s.p1.id }, data: { assignedTeamId: other.id } });

      const undone = await service.undo(operationId, 'actor');

      expect((await db.petition.findUniqueOrThrow({ where: { id: s.p1.id } })).assignedTeamId).toBe(other.id);
      expect((await db.petition.findUniqueOrThrow({ where: { id: s.p2.id } })).assignedTeamId).toBe(s.S.id);
      expect(undone.skipped).toBe(1);
      // Not only how many: which kind of record was left where it is.
      expect(undone.skippedItems).toEqual([{ table: 'petitions', count: 1 }]);
    });

    it('a person re-added to the source since the merge is not duplicated or lost', async () => {
      const s = await scenario();
      const { operationId } = await service.merge(s.S.id, s.T.id, 'actor');
      await db.userTeam.create({ data: { userId: u2, teamId: s.S.id } });

      await expect(service.undo(operationId, 'actor')).resolves.toBeDefined();

      expect((await memberships(s.S.id)).filter((m) => m.userId === u2)).toHaveLength(1);
    });

    it('a grant recreated on the source since the merge does not make the undo fail on the unique key', async () => {
      const s = await scenario();
      const { operationId } = await service.merge(s.S.id, s.T.id, 'actor');
      // u2's WRITE grant moved to T; someone has since granted the same thing on S again.
      await db.dataAccessGrant.create({ data: { granteeId: u2, teamId: s.S.id, accessLevel: 'WRITE', grantedById: u3 } });

      const undone = await service.undo(operationId, 'actor');

      // the moved grant stays on T (the equal one on S is kept), and the undo as a whole still completes
      expect(await db.dataAccessGrant.count({ where: { teamId: s.S.id, granteeId: u2, accessLevel: 'WRITE' } })).toBe(1);
      expect(undone.skipped).toBeGreaterThanOrEqual(1);
      expect(await db.teamMergeOperation.findUniqueOrThrow({ where: { id: operationId } })).toMatchObject({ status: 'UNDONE' });
    });

    it('a membership re-created on the target since the merge is a different membership: undo leaves it there', async () => {
      const s = await scenario();
      const { operationId } = await service.merge(s.S.id, s.T.id, 'actor');
      // u2 came over from S. Someone removes u2 from T and, separately, adds u2 to T again (a new row, a new joinedAt).
      await db.userTeam.delete({ where: { userId_teamId: { userId: u2, teamId: s.T.id } } });
      await db.userTeam.create({ data: { userId: u2, teamId: s.T.id, joinedAt: new Date('2030-01-01T00:00:00Z') } });

      const undone = await service.undo(operationId, 'actor');

      expect((await memberships(s.T.id)).some((m) => m.userId === u2)).toBe(true);
      expect((await memberships(s.S.id)).some((m) => m.userId === u2)).toBe(false);
      expect(undone.skipped).toBeGreaterThanOrEqual(1);
    });

    it('a leader flag on a membership that was re-created since is not reverted', async () => {
      const s = await scenario();
      const { operationId } = await service.merge(s.S.id, s.T.id, 'actor');
      // u1's membership of T was raised to leader by the merge; it is removed and added again as a leader on purpose.
      await db.userTeam.delete({ where: { userId_teamId: { userId: u1, teamId: s.T.id } } });
      await db.userTeam.create({ data: { userId: u1, teamId: s.T.id, isLeader: true, joinedAt: new Date('2030-01-01T00:00:00Z') } });

      await service.undo(operationId, 'actor');

      expect((await memberships(s.T.id)).find((m) => m.userId === u1)?.isLeader).toBe(true);
    });

    it('undo never recreates a cycle: a child whose old parent has since been placed under it stays put', async () => {
      const s = await scenario();
      const { operationId } = await service.merge(s.S.id, s.T.id, 'actor');
      // The child was moved from S to T. Afterwards S (archived) is hung under that child: still a tree.
      await db.team.update({ where: { id: s.S.id }, data: { parentId: s.child.id } });

      const undone = await service.undo(operationId, 'actor');

      expect((await db.team.findUniqueOrThrow({ where: { id: s.child.id } })).parentId).toBe(s.T.id);
      expect(undone.skipped).toBeGreaterThanOrEqual(1);
    });

    it('an operation can be undone once; an unknown one is a 404', async () => {
      const s = await scenario();
      const { operationId } = await service.merge(s.S.id, s.T.id, 'actor');
      await service.undo(operationId, 'actor');

      await expect(service.undo(operationId, 'actor')).rejects.toMatchObject({ response: { code: 'TEAM_MERGE_NOT_UNDOABLE' } });
      await expect(service.undo('missing', 'actor')).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('every foreign key to teams has a decision', () => {
    it('knows what to do with every reference the database has today', async () => {
      expect(await service.unsupportedReferences()).toEqual([]);
    });

    it('a table added later with a foreign key to teams stops the merge instead of being ignored', async () => {
      const a = await team();
      const b = await team();
      const table = `${tag.replace(/-/g, '_')}_future`;
      await pg.query(`CREATE TABLE ${table} (id text PRIMARY KEY, "teamId" text REFERENCES teams(id))`);
      try {
        await expect(service.merge(a.id, b.id, 'actor')).rejects.toMatchObject({
          response: { code: UNSUPPORTED_REFERENCE_CODE, details: [{ table, column: 'teamId' }] },
        });
        expect((await db.team.findUniqueOrThrow({ where: { id: a.id } })).status).toBe('ACTIVE');
      } finally {
        await pg.query(`DROP TABLE ${table}`);
      }
    });
  });
});
