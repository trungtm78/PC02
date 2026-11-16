import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import type { DataScope } from '../auth/services/unit-scope.service';
import { NOTHING, type PreciseScope } from '../common/utils/precise-scope';
import { Client } from 'pg';
import { openScratchDatabase, type ScratchDatabase } from '../common/testing/scratch-database';
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';
import { WARD_AUDIT, WARD_ERROR } from './ward-assignment.codes';
import { WardAssignmentCommandService, type WardAssignmentInput } from './ward-assignment-command.service';
import { WardAssignmentQueryService } from './ward-assignment-query.service';
import { WardInvestigatorsService } from './ward-investigators.service';

/**
 * The commands of a ward unit's request for an assignment, on a real PostgreSQL: the real services, the real number
 * allocator (on a series of this suite's own), the real audit log, scopes shaped as permissions by team gives them.
 *
 * Expected values come from the owner's decisions of 16/11/2026 and the plan, not from running the code:
 *   a ward officer writes requests of their own ward unit only; another ward's request does not exist for them;
 *   the code (năm-số) is given at the first submission, never to a draft;
 *   "Lần trình" counts the submissions; one taken back before PC02 decided does not count;
 *   the ward unit writes the request only while it is a draft or returned;
 *   a draft never submitted is deleted; anything submitted is archived instead (PC02), and can be restored;
 *   two people acting at once: one wins, the other is told the request changed.
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

const ALL: PreciseScope = { ...NOTHING, all: true };
const tree = (teamIds: string[], userIds: string[]): PreciseScope => ({ ...NOTHING, tree: { teamIds, userIds, includeUnassigned: false } });

run('ward assignment requests: the commands, on PostgreSQL', () => {
  jest.setTimeout(60_000);
  let scratch: ScratchDatabase;
  let commands: WardAssignmentCommandService;
  let queries: WardAssignmentQueryService;
  let investigators: WardInvestigatorsService;
  /** A session of the suite's own that holds locks, as a concurrent merge or archive would; another that watches. */
  let holder: Client;
  let waiter: Client;
  const tag = `wac-${randomUUID().slice(0, 8)}`;
  const id: Record<string, string> = {};
  const scope: Record<string, DataScope | null> = {};

  /** A scope of permissions by team: the ward assignment part as given, nothing on the other subjects. */
  const enforced = (userId: string, ward: { read: PreciseScope; write: PreciseScope; review?: PreciseScope }, wardTeamId: string | null): DataScope => ({
    teamIds: [],
    userIds: [userId],
    writableTeamIds: [],
    writableUserIds: [userId],
    isWardOfficer: wardTeamId !== null,
    wardTeamId,
    precise: {
      userId,
      subjects: {
        Case: { read: NOTHING, write: NOTHING },
        Incident: { read: NOTHING, write: NOTHING },
        Petition: { read: NOTHING, write: NOTHING },
        WardAssignment: { read: ward.read, write: ward.write, actions: { review: ward.review ?? NOTHING, matchSubjects: NOTHING } },
      },
    },
  });

  const input = (over: Partial<WardAssignmentInput> = {}): WardAssignmentInput => ({
    caseType: 'CASE',
    kind: 'NEW',
    crimeId: id.crime,
    summary: `${tag} Nhóm đánh bạc tại nhà trọ`,
    content: 'Ngày 10/11/2026, tổ tuần tra phát hiện một nhóm người đánh bạc.',
    discoveredOn: '2026-11-10',
    place: 'Phường Vườn Lài',
    subjectsUnknown: false,
    subjects: [{ fullName: 'Trần Thị Bé', birthYear: 1992, idNumber: '079092000001' }],
    proposedInvestigatorId: id.investigatorW,
    entryOfficerName: 'Phạm Thị D',
    entryOfficerPhone: '0900000000',
    ...over,
  });

  const codeOf = async (assignmentId: string) => (await scratch.db.wardAssignment.findUniqueOrThrow({ where: { id: assignmentId } })).code;
  const fails = async (promise: Promise<unknown>) => {
    try {
      await promise;
      return 'resolved';
    } catch (e) {
      const err = e as { getStatus?: () => number; getResponse?: () => unknown };
      return { status: err.getStatus?.(), body: err.getResponse?.() };
    }
  };

  /** Resolves once `n` sessions wait for a row lock of `table` (polls the lock table; gives up after 20 s). */
  const waitersOn = async (table: string, n: number) => {
    const deadline = Date.now() + 20_000;
    for (;;) {
      const { rows } = await waiter.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid
          WHERE NOT l.granted AND a.wait_event_type = 'Lock' AND a.query ILIKE $1`,
        [`%${table}%`],
      );
      if (rows[0].n >= n) return;
      if (Date.now() > deadline) throw new Error(`nobody waited for ${table}`);
      await new Promise((resolve) => setImmediate(resolve));
    }
  };

  /**
   * Runs `body` while the holder session holds the lock of `sql`, then commits; on any failure the holder's
   * transaction is rolled back first, so a broken test cannot leave a lock that hangs the cleanup. `body` hands back the
   * work it started WRAPPED (`{ pending }`): returning the promise itself would make this wait for work that is
   * waiting for the commit.
   */
  const holding = async <T>(sql: string, params: unknown[], body: () => Promise<{ pending: T }>): Promise<{ pending: T }> => {
    await holder.query('BEGIN');
    try {
      await holder.query(sql, params);
      const result = await body();
      await holder.query('COMMIT');
      return result;
    } catch (e) {
      await holder.query('ROLLBACK');
      throw e;
    }
  };

  beforeAll(async () => {
    scratch = await openScratchDatabase(url!);
    waiter = new Client({ connectionString: url! });
    await waiter.connect();
    holder = new Client({ connectionString: url! });
    await holder.connect();
    const { db } = scratch;
    const role = await db.role.create({ data: { name: `${tag}-officer` } });
    for (const name of ['wardy', 'otherWard', 'reviewer', 'pc02']) {
      id[name] = (await db.user.create({ data: { username: `${tag}-${name}`, passwordHash: 'x', roleId: role.id, isActive: true } })).id;
    }
    const ward = async (key: string) => (await db.directory.create({ data: { type: 'WARD', code: `${tag}-${key}`, name: `${tag} ${key}` } })).id;
    id.W = (await db.team.create({ data: { code: `${tag}-W`, name: `${tag} CAP Vườn Lài`, wardId: await ward('w') } })).id;
    id.V = (await db.team.create({ data: { code: `${tag}-V`, name: `${tag} CAP Tân Định`, wardId: await ward('v') } })).id;
    id.P = (await db.team.create({ data: { code: `${tag}-P`, name: `${tag} Đội 1 PC02` } })).id;
    // A ward unit that a merge archives while a request is being written into it.
    id.U = (await db.team.create({ data: { code: `${tag}-U`, name: `${tag} CAP sắp gộp`, wardId: await ward('u') } })).id;
    await db.userTeam.createMany({
      data: [
        { userId: id.wardy, teamId: id.W },
        { userId: id.otherWard, teamId: id.V },
        { userId: id.reviewer, teamId: id.P },
        { userId: id.pc02, teamId: id.P },
      ],
    });
    id.crime = (await db.crime.create({ data: { code: `${tag}-D322`, name: 'Tội đánh bạc', articleNo: 322, chapter: 'XXI' } })).id;
    const investigator = async (teamId: string, fullName: string) =>
      (await db.wardInvestigator.create({ data: { teamId, fullName, rank: 'Thượng tá', position: 'Trưởng Công an phường', grade: 'Trung cấp', createdById: id.wardy } })).id;
    id.investigatorW = await investigator(id.W, `${tag} Lê Văn C`);
    id.investigatorV = await investigator(id.V, `${tag} Hồ Văn E`);

    scope.wardy = enforced(id.wardy, { read: tree([id.W], []), write: tree([id.W], []) }, id.W);
    scope.wardyOfU = enforced(id.wardy, { read: tree([id.U], []), write: tree([id.U], []) }, id.U);
    scope.otherWard = enforced(id.otherWard, { read: tree([id.V], []), write: tree([id.V], []) }, id.V);
    scope.reviewer = enforced(id.reviewer, { read: ALL, write: NOTHING, review: ALL }, null);
    // PC02 entering on a ward unit's behalf (a grant to write every ward unit's requests).
    scope.pc02 = enforced(id.pc02, { read: ALL, write: ALL }, null);

    const documentType = `WARD_SPEC_${tag}`;
    id.template = (
      await db.documentNumberTemplate.create({
        data: {
          name: `${tag} codes`,
          documentType,
          createdById: id.wardy,
          separator: '-',
          segments: [{ type: 'LITERAL', value: tag }, { type: 'COUNTER' }],
          counterConfig: { resetPeriod: 'NEVER', minValue: 1, maxValue: 999999, padding: 1 },
        },
      })
    ).id;
    const numbers = new DocumentNumbersService(db as never);
    // The real allocator, on this suite's series: the service asks for WARD_ASSIGNMENT, whose counter is everybody's.
    const ownNumbers = {
      commitWithTx: (_type: string, context: { userId: string }, tx: Prisma.TransactionClient, options?: object) =>
        numbers.commitWithTx(documentType, context, tx, options),
    };
    const audit = new AuditService(db as never);
    commands = new WardAssignmentCommandService(db as never, ownNumbers as never, audit);
    queries = new WardAssignmentQueryService(db as never);
    investigators = new WardInvestigatorsService(db as never, audit);
  });

  afterAll(async () => {
    const { db } = scratch;
    const mine = await db.wardAssignment.findMany({ where: { assignedTeam: { code: { startsWith: tag } } }, select: { id: true } });
    const ids = mine.map((m) => m.id);
    await db.auditLog.deleteMany({ where: { OR: [{ userId: { in: Object.values(id) } }, { subjectId: { in: ids } }] } });
    await db.wardAssignmentDecision.deleteMany({ where: { round: { assignmentId: { in: ids } } } });
    await db.wardAssignmentRound.deleteMany({ where: { assignmentId: { in: ids } } });
    await db.wardAssignmentSubject.deleteMany({ where: { assignmentId: { in: ids } } });
    await db.wardAssignment.updateMany({ where: { id: { in: ids } }, data: { previousAssignmentId: null } });
    await db.wardAssignment.deleteMany({ where: { id: { in: ids } } });
    await db.wardInvestigator.deleteMany({ where: { team: { code: { startsWith: tag } } } });
    await db.documentNumberLog.deleteMany({ where: { templateId: id.template } });
    await db.documentNumberCounter.deleteMany({ where: { templateId: id.template } });
    await db.documentNumberTemplate.deleteMany({ where: { id: id.template } });
    await db.crime.deleteMany({ where: { code: { startsWith: tag } } });
    await db.userTeam.deleteMany({ where: { team: { code: { startsWith: tag } } } });
    await db.team.deleteMany({ where: { code: { startsWith: tag } } });
    await db.directory.deleteMany({ where: { code: { startsWith: tag } } });
    await db.user.deleteMany({ where: { username: { startsWith: tag } } });
    await db.role.deleteMany({ where: { name: { startsWith: tag } } });
    await holder.end();
    await waiter.end();
    await scratch.close();
  });

  describe('a draft', () => {
    it('a ward officer\'s request is of their own ward unit, has no code yet, and keeps its subjects as normalised rows', async () => {
      const made = await commands.create({ id: id.wardy }, scope.wardy, input());
      expect(made).toMatchObject({ status: 'DRAFT', code: null, assignedTeamId: id.W, enteredById: id.wardy, enteredOnBehalf: false, submissionCount: 0 });
      const subjects = await scratch.db.wardAssignmentSubject.findMany({ where: { assignmentId: made.id } });
      expect(subjects).toEqual([expect.objectContaining({ position: 1, fullName: 'Trần Thị Bé', fullNameNorm: 'tran thi be', birthYear: 1992, idNumberNorm: '079092000001' })]);
      const audit = await scratch.db.auditLog.findMany({ where: { subjectId: made.id } });
      expect(audit.map((a) => a.action)).toEqual([WARD_AUDIT.CREATED]);
      // Metadata only: no content, no subject of the request in the log.
      expect(JSON.stringify(audit[0].metadata)).not.toContain('Trần Thị Bé');
      expect(JSON.stringify(audit[0].metadata)).not.toContain('đánh bạc');
    });

    it('a ward officer cannot write for another ward unit; PC02 with the grant writes on a ward unit\'s behalf', async () => {
      expect(await fails(commands.create({ id: id.wardy }, scope.wardy, input({ assignedTeamId: id.V })))).toMatchObject({ status: 403, body: { code: WARD_ERROR.UNIT_OUT_OF_REACH } });
      const onBehalf = await commands.create({ id: id.pc02 }, scope.pc02, input({ assignedTeamId: id.V, proposedInvestigatorId: id.investigatorV }));
      expect(onBehalf).toMatchObject({ assignedTeamId: id.V, enteredById: id.pc02, enteredOnBehalf: true });
    });

    it('somebody of PC02 must say which ward unit; a unit that is not a ward unit is refused', async () => {
      expect(await fails(commands.create({ id: id.pc02 }, scope.pc02, input()))).toMatchObject({ status: 400, body: { code: WARD_ERROR.UNIT_REQUIRED } });
      expect(await fails(commands.create({ id: id.pc02 }, scope.pc02, input({ assignedTeamId: id.P })))).toMatchObject({ status: 400, body: { code: WARD_ERROR.UNIT_NOT_WARD } });
    });

    it('the proposed investigator is one of the ward unit\'s own, and active; the crime must exist', async () => {
      expect(await fails(commands.create({ id: id.wardy }, scope.wardy, input({ proposedInvestigatorId: id.investigatorV })))).toMatchObject({ status: 400, body: { code: WARD_ERROR.INVESTIGATOR_UNKNOWN } });
      expect(await fails(commands.create({ id: id.wardy }, scope.wardy, input({ crimeId: 'no-such-crime' })))).toMatchObject({ status: 400, body: { code: WARD_ERROR.CRIME_UNKNOWN } });
    });

    it('"subjects not identified" with rows of subjects is a contradiction, refused', async () => {
      expect(await fails(commands.create({ id: id.wardy }, scope.wardy, input({ subjectsUnknown: true })))).toMatchObject({ status: 400, body: { code: WARD_ERROR.SUBJECTS_UNKNOWN_WITH_ROWS } });
    });

    it('is corrected by its unit, the subjects replaced as a whole; a stale form is told the request changed', async () => {
      const made = await commands.create({ id: id.wardy }, scope.wardy, input());
      const edited = await commands.update({ id: id.wardy }, scope.wardy, made.id, {
        ...input({ subjects: [{ fullName: 'Nguyễn Văn A' }, { fullName: 'Lê Thị B', birthYear: 2001 }] }),
        expectedUpdatedAt: made.updatedAt.toISOString(),
      });
      expect((await scratch.db.wardAssignmentSubject.findMany({ where: { assignmentId: made.id }, orderBy: { position: 'asc' } })).map((s) => s.fullName)).toEqual(['Nguyễn Văn A', 'Lê Thị B']);
      expect(await fails(commands.update({ id: id.wardy }, scope.wardy, made.id, { ...input(), expectedUpdatedAt: made.updatedAt.toISOString() }))).toMatchObject({ status: 409, body: { code: WARD_ERROR.CONFLICT } });
      expect(edited.updatedAt.getTime()).toBeGreaterThan(made.updatedAt.getTime());
    });
  });

  describe('another ward unit and PC02', () => {
    it('another ward\'s request does not exist for a ward officer; PC02 reads it and cannot edit it', async () => {
      const made = await commands.create({ id: id.wardy }, scope.wardy, input());
      expect(await fails(queries.get(scope.otherWard, id.otherWard, made.id))).toMatchObject({ status: 404, body: { code: WARD_ERROR.NOT_FOUND } });
      expect(await fails(commands.update({ id: id.otherWard }, scope.otherWard, made.id, { ...input(), expectedUpdatedAt: made.updatedAt.toISOString() }))).toMatchObject({ status: 404 });
      const seen = await queries.get(scope.reviewer, id.reviewer, made.id);
      expect(seen).toMatchObject({ id: made.id, can: { edit: false, submit: false, review: true } });
      expect(await fails(commands.update({ id: id.reviewer }, scope.reviewer, made.id, { ...input(), expectedUpdatedAt: made.updatedAt.toISOString() }))).toMatchObject({ status: 403 });
    });

    it('the list of a ward officer holds their unit\'s requests only', async () => {
      await commands.create({ id: id.otherWard }, scope.otherWard, input({ proposedInvestigatorId: id.investigatorV }));
      const list = await queries.list(scope.wardy, { q: tag });
      expect(list.data.length).toBeGreaterThan(0);
      expect(new Set(list.data.map((r) => r.assignedTeamId))).toEqual(new Set([id.W]));
      const all = await queries.list(scope.reviewer, { q: tag });
      expect(new Set(all.data.map((r) => r.assignedTeamId))).toEqual(new Set([id.W, id.V]));
    });

    it('a row of the list says what its buttons may do, as the request itself does', async () => {
      const draft = await commands.create({ id: id.wardy }, scope.wardy, input({ summary: `${tag} dòng nháp` }));
      const sent = await commands.create({ id: id.wardy }, scope.wardy, input({ summary: `${tag} dòng đã trình` }));
      await commands.submit({ id: id.wardy }, scope.wardy, sent.id, sent.updatedAt.toISOString());
      const mine = (await queries.list(scope.wardy, { q: tag, pageSize: 200 }, new Date(), id.wardy)).data;
      const rowOf = (rows: typeof mine, rowId: string) => rows.find((r) => r.id === rowId)!;
      // A draft never submitted: its unit edits and deletes it. Submitted: neither, while PC02 holds it.
      expect(rowOf(mine, draft.id)).toMatchObject({ can: { edit: true, delete: true, issueSlip: false }, latestDecision: null });
      expect(rowOf(mine, sent.id)).toMatchObject({ can: { edit: false, delete: false, issueSlip: false }, latestDecision: null });
      expect(rowOf(mine, draft.id)).not.toHaveProperty('rounds');
      for (const row of mine) {
        const one = await queries.get(scope.wardy, id.wardy, row.id);
        expect({ id: row.id, edit: row.can.edit, delete: row.can.delete }).toEqual({ id: row.id, edit: one.can.edit, delete: one.can.delete });
      }
      // PC02 with the review reach prints the slips; it edits nothing of the unit's.
      const theirs = (await queries.list(scope.reviewer, { q: tag, pageSize: 200 }, new Date(), id.reviewer)).data;
      expect(rowOf(theirs, sent.id)).toMatchObject({ can: { edit: false, delete: false, issueSlip: true } });
      // A reviewer who is a member of the request's own ward unit does not (segregation of duties).
      const both = enforced(id.wardy, { read: ALL, write: NOTHING, review: ALL }, id.W);
      expect(rowOf((await queries.list(both, { q: tag, pageSize: 200 }, new Date(), id.wardy)).data, sent.id).can.issueSlip).toBe(false);
    });

    it('the units offered for a new request are the ward units the person may enter for, and no PC02 unit', async () => {
      expect((await queries.unitChoices(scope.wardy)).map((t) => t.id)).toEqual([id.W]);
      const all = (await queries.unitChoices(scope.pc02)).map((t) => t.id);
      expect(all).toEqual(expect.arrayContaining([id.W, id.V]));
      expect(all).not.toContain(id.P);
      // Reading everything is not entering for everybody.
      expect(await queries.unitChoices(scope.reviewer)).toEqual([]);
      // Every unit offered is one `create` accepts.
      const made = await commands.create({ id: id.pc02 }, scope.pc02, input({ assignedTeamId: id.V, proposedInvestigatorId: id.investigatorV }));
      expect(made.assignedTeamId).toBe(id.V);
    });
  });

  describe('submitting', () => {
    it('an incomplete request names what is missing', async () => {
      const made = await commands.create({ id: id.wardy }, scope.wardy, input({ summary: '', proposedInvestigatorId: null, subjects: [] }));
      expect(await fails(commands.submit({ id: id.wardy }, scope.wardy, made.id, made.updatedAt.toISOString()))).toMatchObject({
        status: 400,
        body: { code: WARD_ERROR.INCOMPLETE, details: [{ field: 'summary' }, { field: 'proposedInvestigatorId' }, { field: 'subjects' }] },
      });
    });

    it('the first submission gives the code and counts 1; it is then out of the unit\'s hands', async () => {
      const made = await commands.create({ id: id.wardy }, scope.wardy, input());
      const sent = await commands.submit({ id: id.wardy }, scope.wardy, made.id, made.updatedAt.toISOString());
      expect(sent).toMatchObject({ status: 'SUBMITTED', submissionCount: 1 });
      expect(sent.code).toMatch(new RegExp(`^${tag}-\\d+$`));
      expect(sent.submittedAt).toBeInstanceOf(Date);
      const rounds = await scratch.db.wardAssignmentRound.findMany({ where: { assignmentId: made.id } });
      expect(rounds).toEqual([expect.objectContaining({ sequence: 1, submissionNo: 1, status: 'PENDING', priorStatus: 'DRAFT', submittedById: id.wardy })]);
      // What was submitted is kept as it was.
      expect(rounds[0].snapshot).toMatchObject({ summary: `${tag} Nhóm đánh bạc tại nhà trọ`, subjects: [{ fullName: 'Trần Thị Bé', birthYear: 1992 }] });
      expect(await fails(commands.update({ id: id.wardy }, scope.wardy, made.id, { ...input(), expectedUpdatedAt: sent.updatedAt.toISOString() }))).toMatchObject({ status: 409, body: { code: WARD_ERROR.NOT_EDITABLE } });
      expect(await fails(commands.submit({ id: id.wardy }, scope.wardy, made.id, sent.updatedAt.toISOString()))).toMatchObject({ status: 409, body: { code: WARD_ERROR.NOT_SUBMITTABLE } });
    });

    it('taken back before PC02 decided: back to the draft, not counted; submitted again it keeps its code and counts 1', async () => {
      const made = await commands.create({ id: id.wardy }, scope.wardy, input());
      const sent = await commands.submit({ id: id.wardy }, scope.wardy, made.id, made.updatedAt.toISOString());
      const back = await commands.withdraw({ id: id.wardy }, scope.wardy, made.id, sent.updatedAt.toISOString());
      expect(back).toMatchObject({ status: 'DRAFT', submissionCount: 0, submittedAt: null, code: sent.code });
      expect(await fails(commands.withdraw({ id: id.wardy }, scope.wardy, made.id, back.updatedAt.toISOString()))).toMatchObject({ status: 409, body: { code: WARD_ERROR.NOTHING_TO_WITHDRAW } });
      const again = await commands.submit({ id: id.wardy }, scope.wardy, made.id, back.updatedAt.toISOString());
      expect(again).toMatchObject({ status: 'SUBMITTED', submissionCount: 1, code: sent.code });
      const rounds = await scratch.db.wardAssignmentRound.findMany({ where: { assignmentId: made.id }, orderBy: { sequence: 'asc' } });
      expect(rounds.map((r) => [r.sequence, r.submissionNo, r.status])).toEqual([[1, 1, 'WITHDRAWN'], [2, 1, 'PENDING']]);
      expect((await scratch.db.auditLog.findMany({ where: { subjectId: made.id }, orderBy: { createdAt: 'asc' } })).map((a) => a.action)).toEqual([
        WARD_AUDIT.CREATED, WARD_AUDIT.SUBMITTED, WARD_AUDIT.WITHDRAWN, WARD_AUDIT.SUBMITTED,
      ]);
    });

    it('two submissions at the same moment: one is kept, the other told the request changed', async () => {
      const made = await commands.create({ id: id.wardy }, scope.wardy, input());
      const stamp = made.updatedAt.toISOString();
      // Both are made to wait at the row lock, then let go together: they meet exactly where the lock decides.
      const outcomes = await holding('SELECT id FROM ward_assignments WHERE id = $1 FOR UPDATE', [made.id], async () => {
        const both = [commands.submit({ id: id.wardy }, scope.wardy, made.id, stamp), commands.submit({ id: id.wardy }, scope.wardy, made.id, stamp)].map(fails);
        await waitersOn('ward_assignments', 2);
        return { pending: Promise.all(both) };
      }).then(({ pending }) => pending);
      expect(outcomes.filter((o) => o === 'resolved')).toHaveLength(1);
      expect(outcomes.filter((o) => o !== 'resolved')).toEqual([{ status: 409, body: { code: WARD_ERROR.CONFLICT, details: [{ updatedAt: expect.any(String) }] } }]);
      expect(await scratch.db.wardAssignmentRound.count({ where: { assignmentId: made.id } })).toBe(1);
      expect(await codeOf(made.id)).not.toBeNull();
    });

    it('a request whose proposed investigator was stopped since the draft cannot be submitted', async () => {
      const extra = await investigators.create({ id: id.wardy }, scope.wardy, { teamId: id.W, fullName: `${tag} Tạm` });
      const made = await commands.create({ id: id.wardy }, scope.wardy, input({ proposedInvestigatorId: extra.id }));
      await investigators.setActive({ id: id.wardy }, scope.wardy, extra.id, false, extra.updatedAt.toISOString());
      expect(await fails(commands.submit({ id: id.wardy }, scope.wardy, made.id, made.updatedAt.toISOString()))).toMatchObject({ status: 400, body: { code: WARD_ERROR.INVESTIGATOR_UNKNOWN } });
      expect(await scratch.db.wardAssignmentRound.count({ where: { assignmentId: made.id } })).toBe(0);
    });

    it('a stamp that is not an instant is refused, never compared; the same instant with another offset is the same form', async () => {
      const made = await commands.create({ id: id.wardy }, scope.wardy, input());
      expect(await fails(commands.submit({ id: id.wardy }, scope.wardy, made.id, '2026-W47-1'))).toMatchObject({ status: 400, body: { code: WARD_ERROR.STAMP_INVALID } });
      const shifted = new Date(made.updatedAt.getTime() + 7 * 3_600_000).toISOString().replace('Z', '+07:00');
      expect(await commands.submit({ id: id.wardy }, scope.wardy, made.id, shifted)).toMatchObject({ status: 'SUBMITTED' });
    });
  });

  describe('deleting and archiving ("Tạo thì phải sửa và xoá")', () => {
    it('a draft never submitted is deleted with its subjects; one that was ever submitted is not', async () => {
      const made = await commands.create({ id: id.wardy }, scope.wardy, input());
      await commands.remove({ id: id.wardy }, scope.wardy, made.id, made.updatedAt.toISOString());
      expect(await scratch.db.wardAssignment.findUnique({ where: { id: made.id } })).toBeNull();
      expect(await scratch.db.wardAssignmentSubject.count({ where: { assignmentId: made.id } })).toBe(0);

      const kept = await commands.create({ id: id.wardy }, scope.wardy, input());
      const sent = await commands.submit({ id: id.wardy }, scope.wardy, kept.id, kept.updatedAt.toISOString());
      const back = await commands.withdraw({ id: id.wardy }, scope.wardy, kept.id, sent.updatedAt.toISOString());
      expect(await fails(commands.remove({ id: id.wardy }, scope.wardy, kept.id, back.updatedAt.toISOString()))).toMatchObject({ status: 409, body: { code: WARD_ERROR.DELETE_SUBMITTED } });
    });

    it('PC02 archives a submitted request and restores it; while archived nothing else is done to it', async () => {
      const draft = await commands.create({ id: id.wardy }, scope.wardy, input());
      expect(await fails(commands.archive({ id: id.reviewer }, scope.reviewer, draft.id, draft.updatedAt.toISOString()))).toMatchObject({ status: 409, body: { code: WARD_ERROR.ARCHIVE_DRAFT } });

      const sent = await commands.submit({ id: id.wardy }, scope.wardy, draft.id, draft.updatedAt.toISOString());
      expect(await fails(commands.archive({ id: id.wardy }, scope.wardy, draft.id, sent.updatedAt.toISOString()))).toMatchObject({ status: 403 });
      const archived = await commands.archive({ id: id.reviewer }, scope.reviewer, draft.id, sent.updatedAt.toISOString());
      expect(archived.archivedAt).toBeInstanceOf(Date);
      expect(await fails(commands.withdraw({ id: id.wardy }, scope.wardy, draft.id, archived.updatedAt.toISOString()))).toMatchObject({ status: 409, body: { code: WARD_ERROR.ARCHIVED } });
      expect(await fails(commands.archive({ id: id.reviewer }, scope.reviewer, draft.id, archived.updatedAt.toISOString()))).toMatchObject({ status: 409, body: { code: WARD_ERROR.ALREADY_ARCHIVED } });
      expect((await queries.list(scope.wardy, { q: tag })).data.map((r) => r.id)).not.toContain(draft.id);
      expect((await queries.list(scope.wardy, { q: tag, archived: true })).data.map((r) => r.id)).toContain(draft.id);
      const restored = await commands.restore({ id: id.reviewer }, scope.reviewer, draft.id, archived.updatedAt.toISOString());
      expect(restored.archivedAt).toBeNull();
      expect(await fails(commands.restore({ id: id.reviewer }, scope.reviewer, draft.id, restored.updatedAt.toISOString()))).toMatchObject({ status: 409, body: { code: WARD_ERROR.NOT_ARCHIVED } });
    });
  });

  describe('writing while the ward unit is merged away', () => {
    it('a request being written into a ward unit that a merge archives meanwhile is refused, not left behind', async () => {
      // The merge holds the team (as TeamMergeService.readPair does); the request waits; the merge archives the team.
      const creating = await holding('SELECT id FROM teams WHERE id = $1 FOR UPDATE', [id.U], async () => {
        const pending = fails(commands.create({ id: id.wardy }, scope.wardyOfU, input({ assignedTeamId: id.U, proposedInvestigatorId: null })));
        await waitersOn('teams', 1);
        await holder.query(`UPDATE teams SET status = 'ARCHIVED' WHERE id = $1`, [id.U]);
        return { pending };
      }).then(({ pending }) => pending);
      expect(await creating).toMatchObject({ status: 400, body: { code: WARD_ERROR.UNIT_NOT_WARD } });
      expect(await scratch.db.wardAssignment.count({ where: { assignedTeamId: id.U } })).toBe(0);
    });

    it('a change to an investigator is checked against the unit they are in once the move is done', async () => {
      const moving = await investigators.create({ id: id.wardy }, scope.wardy, { teamId: id.W, fullName: `${tag} Sắp chuyển` });
      const stopping = await holding('SELECT id FROM ward_investigators WHERE id = $1 FOR UPDATE', [moving.id], async () => {
        const pending = fails(investigators.setActive({ id: id.wardy }, scope.wardy, moving.id, false, moving.updatedAt.toISOString()));
        await waitersOn('ward_investigators', 1);
        // A merge moves the name to ward V without touching its stamp.
        await holder.query('UPDATE ward_investigators SET "teamId" = $2 WHERE id = $1', [moving.id, id.V]);
        return { pending };
      }).then(({ pending }) => pending);
      expect(await stopping).toMatchObject({ status: 404, body: { code: WARD_ERROR.INVESTIGATOR_NOT_FOUND } });
      expect((await scratch.db.wardInvestigator.findUniqueOrThrow({ where: { id: moving.id } })).isActive).toBe(true);
    });
  });

  describe('a re-assignment', () => {
    it('names an approved request of the same ward unit, and why', async () => {
      const first = await commands.create({ id: id.wardy }, scope.wardy, input());
      const other = await commands.create({ id: id.otherWard }, scope.otherWard, input({ proposedInvestigatorId: id.investigatorV }));
      // Approval is PC02's (a later change); the fixture stands for it.
      await scratch.db.wardAssignment.updateMany({ where: { id: { in: [first.id, other.id] } }, data: { status: 'APPROVED' } });
      expect(await fails(commands.create({ id: id.wardy }, scope.wardy, input({ kind: 'REASSIGN', previousAssignmentId: other.id, reassignReason: 'Đổi ĐTV' })))).toMatchObject({ status: 400, body: { code: WARD_ERROR.PREVIOUS_UNKNOWN } });
      expect(await fails(commands.create({ id: id.wardy }, scope.wardy, input({ kind: 'NEW', previousAssignmentId: first.id })))).toMatchObject({ status: 400, body: { code: WARD_ERROR.PREVIOUS_ONLY_FOR_REASSIGN } });
      const again = await commands.create({ id: id.wardy }, scope.wardy, input({ kind: 'REASSIGN', previousAssignmentId: first.id, reassignReason: 'ĐTV chuyển công tác' }));
      expect(again).toMatchObject({ kind: 'REASSIGN', previousAssignmentId: first.id });
      const draftOnly = await commands.create({ id: id.wardy }, scope.wardy, input());
      expect(await fails(commands.create({ id: id.wardy }, scope.wardy, input({ kind: 'REASSIGN', previousAssignmentId: draftOnly.id, reassignReason: 'x' })))).toMatchObject({ status: 400, body: { code: WARD_ERROR.PREVIOUS_UNKNOWN } });
    });
  });

  describe('the investigators of a ward unit', () => {
    it('a ward officer adds, corrects, stops and resumes their unit\'s investigators, not another unit\'s', async () => {
      const added = await investigators.create({ id: id.wardy }, scope.wardy, { teamId: id.W, fullName: `${tag} Võ Văn K`, rank: 'Trung tá', position: 'Phó trưởng Công an phường', grade: 'Sơ cấp' });
      expect(added).toMatchObject({ teamId: id.W, isActive: true });
      expect(await fails(investigators.create({ id: id.wardy }, scope.wardy, { teamId: id.V, fullName: 'x' }))).toMatchObject({ status: 403, body: { code: WARD_ERROR.INVESTIGATOR_OUT_OF_REACH } });
      const fixed = await investigators.update({ id: id.wardy }, scope.wardy, added.id, { fullName: `${tag} Võ Văn Khoa`, rank: 'Thượng tá', expectedUpdatedAt: added.updatedAt.toISOString() });
      expect(await fails(investigators.update({ id: id.wardy }, scope.wardy, added.id, { fullName: '  ', expectedUpdatedAt: fixed.updatedAt.toISOString() }))).toMatchObject({ status: 400, body: { code: WARD_ERROR.INVESTIGATOR_NAME_REQUIRED } });
      expect(fixed).toMatchObject({ fullName: `${tag} Võ Văn Khoa`, rank: 'Thượng tá', position: 'Phó trưởng Công an phường' });
      const stopped = await investigators.setActive({ id: id.wardy }, scope.wardy, added.id, false, fixed.updatedAt.toISOString());
      expect(stopped.isActive).toBe(false);
      // A stopped investigator is not proposed in a new request...
      expect(await fails(commands.create({ id: id.wardy }, scope.wardy, input({ proposedInvestigatorId: added.id })))).toMatchObject({ status: 400, body: { code: WARD_ERROR.INVESTIGATOR_UNKNOWN } });
      // ...nor listed unless asked for; another ward unit does not see the list.
      expect((await investigators.list(scope.wardy, id.W)).map((i) => i.id)).not.toContain(added.id);
      expect((await investigators.list(scope.wardy, id.W, true)).map((i) => i.id)).toContain(added.id);
      expect(await fails(investigators.list(scope.otherWard, id.W))).toMatchObject({ status: 403 });
      const resumed = await investigators.setActive({ id: id.wardy }, scope.wardy, added.id, true, stopped.updatedAt.toISOString());
      expect(resumed.isActive).toBe(true);
      expect(await fails(investigators.setActive({ id: id.wardy }, scope.wardy, added.id, false, stopped.updatedAt.toISOString()))).toMatchObject({ status: 409, body: { code: WARD_ERROR.INVESTIGATOR_CHANGED } });
    });

    it('a name the unit already lists is refused, with its holder, unless the person says it is another one', async () => {
      const first = await investigators.create({ id: id.wardy }, scope.wardy, { teamId: id.W, fullName: `${tag} Trần Văn Trùng` });
      // Case and spacing do not make another person.
      expect(await fails(investigators.create({ id: id.wardy }, scope.wardy, { teamId: id.W, fullName: `  ${tag}   trần văn TRÙNG ` }))).toMatchObject({
        status: 409,
        body: { code: WARD_ERROR.INVESTIGATOR_DUPLICATE, details: [{ existingId: first.id, isActive: true }] },
      });
      // Another unit may list the same name.
      expect((await investigators.create({ id: id.otherWard }, scope.otherWard, { teamId: id.V, fullName: `${tag} Trần Văn Trùng` })).teamId).toBe(id.V);
      // Two people of one unit with one name: said, then accepted.
      const second = await investigators.create({ id: id.wardy }, scope.wardy, { teamId: id.W, fullName: `${tag} Trần Văn Trùng`, rank: 'Đại uý', allowSameName: true });
      expect(second.id).not.toBe(first.id);
      // A stopped name still holds its place: it is resumed, not doubled.
      const other = await investigators.create({ id: id.wardy }, scope.wardy, { teamId: id.W, fullName: `${tag} Lý Văn Ngừng` });
      const stopped = await investigators.setActive({ id: id.wardy }, scope.wardy, other.id, false, other.updatedAt.toISOString());
      expect(await fails(investigators.create({ id: id.wardy }, scope.wardy, { teamId: id.W, fullName: `${tag} Lý Văn Ngừng` }))).toMatchObject({
        status: 409,
        body: { code: WARD_ERROR.INVESTIGATOR_DUPLICATE, details: [{ existingId: other.id, isActive: false }] },
      });
      // Renaming onto a listed name is the same clash; correcting the rank of a name is not.
      expect(await fails(investigators.update({ id: id.wardy }, scope.wardy, stopped.id, { fullName: `${tag} Lê Văn C`, expectedUpdatedAt: stopped.updatedAt.toISOString() }))).toMatchObject({
        status: 409,
        body: { code: WARD_ERROR.INVESTIGATOR_DUPLICATE },
      });
      const ranked = await investigators.update({ id: id.wardy }, scope.wardy, second.id, { rank: 'Thiếu tá', expectedUpdatedAt: second.updatedAt.toISOString() });
      expect(ranked.rank).toBe('Thiếu tá');
    });

    it('PC02 reviewers may add an investigator to a ward unit (to assign one the unit did not propose)', async () => {
      const added = await investigators.create({ id: id.reviewer }, scope.reviewer, { teamId: id.V, fullName: `${tag} Đặng Văn M` });
      expect(added.teamId).toBe(id.V);
    });
  });
});
