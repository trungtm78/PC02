import * as fs from 'node:fs';
import * as path from 'node:path';
import { thuMucMigrationTimKiemMoiNhat } from '../common/tim-kiem/sinh/tep-sinh';
import * as ExcelJS from 'exceljs';
import { PassThrough } from 'stream';
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
    // The scratch database of CI is made by `prisma db push`: tables, no triggers. What the list searches and orders
    // by is kept by triggers, so the REAL migrations that install them are applied here (both idempotent), before any
    // row of this suite is written (the crime the requests name is searched by its own shadow column). Without this
    // the suite is green only on a machine where somebody applied them by hand.
    const migrations = path.join(__dirname, '../../prisma/migrations');
    for (const folder of [thuMucMigrationTimKiemMoiNhat()!, '20261128020000_ward_code_sort']) {
      await holder.query(fs.readFileSync(path.join(migrations, folder, 'migration.sql'), 'utf-8'));
    }
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
    queries = new WardAssignmentQueryService(db as never, audit);
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

    describe('the list as the petition list: search by tags, order, cards, Excel', () => {
      const ids: Record<string, string> = {};
      const mark = `${tag}zz`;
      const mine = (q: object = {}) => queries.list(scope.wardy, { q: mark, pageSize: 200, ...q }, new Date(), id.wardy);

      beforeAll(async () => {
        const make = async (key: string, over: Partial<WardAssignmentInput>, submit: boolean) => {
          const made = await commands.create({ id: id.wardy }, scope.wardy, input(over));
          if (submit) await commands.submit({ id: id.wardy }, scope.wardy, made.id, made.updatedAt.toISOString());
          ids[key] = made.id;
        };
        await make('gambling', { summary: `${mark} Tổ chức đánh bạc ở Hẻm 12`, place: 'Chợ Bến Thành' }, true);
        await make('theft', { summary: `${mark} Trộm xe máy`, crimeId: null, crimeOther: 'Trộm cắp tài sản', caseType: 'INCIDENT' }, true);
        await make('draft', { summary: `${mark} Bản nháp cố ý gây thương tích` }, false);
        // Another unit's, carrying the same mark: a search must never bring it into this unit's list.
        const other = await commands.create({ id: id.otherWard }, scope.otherWard, input({ summary: `${mark} của đơn vị khác`, proposedInvestigatorId: id.investigatorV }));
        ids.other = other.id;
      });

      it('the old search box reads every column, without accents, within the person\'s reach', async () => {
        expect(new Set((await mine()).data.map((r) => r.id))).toEqual(new Set([ids.gambling, ids.theft, ids.draft]));
        // Accent-free, and in columns the old box did not read (the place, the crime written by hand).
        expect((await mine({ q: 'cho ben thanh' })).data.map((r) => r.id)).toEqual([ids.gambling]);
        expect((await mine({ q: 'trom cap tai san' })).data.map((r) => r.id)).toEqual([ids.theft]);
        expect((await queries.list(scope.wardy, { q: 'của đơn vị khác', pageSize: 200 })).data).toEqual([]);
      });

      it('tags: a column each, joined by AND; the values of one tag by OR; an unknown key is refused', async () => {
        const by = async (tk: string[]) => (await mine({ tk })).data.map((r) => r.id).sort();
        expect(await by(['trichYeu~danh bac'])).toEqual([ids.gambling]);
        expect(await by(['noiXayRa~ben thanh'])).toEqual([ids.gambling]);
        expect(await by(['toiDanhKhac~trom cap'])).toEqual([ids.theft]);
        expect(await by(['toiDanh~danh bac'])).toEqual([ids.gambling, ids.draft].sort());
        expect(await by(['loaiHoSo~INCIDENT'])).toEqual([ids.theft]);
        expect(await by(['loaiHoSo~INCIDENT', 'loaiHoSo~CASE'])).toEqual([ids.gambling, ids.theft, ids.draft].sort());
        expect(await by(['loaiHoSo~CASE', 'noiXayRa~ben thanh'])).toEqual([ids.gambling]);
        // The status is the cards' (one control): it is not a tag, and asking for it is refused, never silently ignored.
        expect(await fails(mine({ tk: ['trangThai~DRAFT'] }))).toMatchObject({ status: 400 });
        // "Every column" reads the crime of the catalogue as the Tội danh column shows it.
        const everyColumn = await queries.list(scope.wardy, { tk: ['*~toi danh bac', `trichYeu~${mark}`], pageSize: 200 });
        expect(everyColumn.data.map((r) => r.id).sort()).toEqual([ids.gambling, ids.draft].sort());
        const code = (await codeOf(ids.gambling))!;
        expect(await by([`ma~${code}`])).toEqual([ids.gambling]);
        expect(await fails(mine({ tk: ['khongCoCotNay~x'] }))).toMatchObject({ status: 400 });
        // A tag narrows; it never opens another unit's requests.
        expect((await queries.list(scope.wardy, { tk: [`trichYeu~${mark} cua don vi khac`], pageSize: 200 })).data).toEqual([]);
        expect((await queries.list(scope.otherWard, { tk: [`trichYeu~${mark}`], pageSize: 200 })).data.map((r) => r.id)).toEqual([ids.other]);
      });

      it('order: nothing asked keeps drafts on top then the newest submission; a column asked is followed both ways, empty values last', async () => {
        expect((await mine()).data[0].id).toBe(ids.draft);
        // As NUMBERS: 8 before 21 before 100, which as text would read 100, 21, 8.
        const numbered = async (code: string) => {
          const made = await commands.create({ id: id.wardy }, scope.wardy, input({ summary: `${mark} số ${code}` }));
          await scratch.db.wardAssignment.update({ where: { id: made.id }, data: { code, status: 'SUBMITTED', submissionCount: 1, submittedAt: new Date() } });
          return made.id;
        };
        const made = [await numbered(`2031-100`), await numbered(`2031-8`), await numbered(`2031-21`), await numbered(`2030-999`)];
        const order = (await mine({ q: `${mark} số`, sortBy: 'code', sortOrder: 'asc' })).data.map((r) => r.code);
        expect(order).toEqual(['2030-999', '2031-8', '2031-21', '2031-100']);
        // A request with no code yet (a draft) is last whichever way the column is sorted.
        const withDraft = async (sortOrder: 'asc' | 'desc') => (await mine({ sortBy: 'code', sortOrder })).data.map((r) => r.code);
        expect((await withDraft('asc')).slice(0, 4)).toEqual(order);
        expect((await withDraft('desc')).slice(0, 4)).toEqual([...order].reverse());
        expect((await withDraft('asc')).slice(4).every((c) => c === null || !/^\d{4}-\d+$/.test(c))).toBe(true);
        expect((await mine({ q: `${mark} số`, sortBy: 'code', sortOrder: 'desc' })).data.map((r) => r.code)).toEqual(['2031-100', '2031-21', '2031-8', '2030-999']);
        // A code of another form is not a failed write: it has no number, and sinks to the end.
        await scratch.db.wardAssignment.update({ where: { id: made[0] }, data: { code: `${tag}-KHAC` } });
        expect((await mine({ q: `${mark} số`, sortBy: 'code', sortOrder: 'asc' })).data.map((r) => r.code).at(-1)).toBe(`${tag}-KHAC`);
        // Restrict everywhere: the subjects go before the requests.
        await scratch.db.wardAssignmentSubject.deleteMany({ where: { assignmentId: { in: made } } });
        await scratch.db.wardAssignment.deleteMany({ where: { id: { in: made } } });
        // By text: the database's own order (its collation, not JavaScript's), one way the reverse of the other.
        const bySummary = async (sortOrder: 'asc' | 'desc') => (await mine({ sortBy: 'summary', sortOrder })).data.map((r) => r.summary);
        expect(await bySummary('asc')).toEqual((await bySummary('desc')).reverse());
        expect(new Set(await bySummary('asc')).size).toBe(3);
        // A column that is not sortable (or a name made up) is not an order: the list keeps its own.
        expect((await mine({ sortBy: 'passwordHash' })).data.map((r) => r.id)).toEqual((await mine()).data.map((r) => r.id));
      });

      it('the cards: one answer, each number the number of rows the list shows under that card', async () => {
        const filters = { q: mark };
        const stats = await queries.listStats(scope.wardy, filters);
        const rows = async (q: object) => (await queries.list(scope.wardy, { ...filters, pageSize: 200, ...q })).total;
        expect(stats.all).toBe(await rows({}));
        for (const status of ['DRAFT', 'SUBMITTED', 'RETURNED', 'APPROVED'] as const) expect({ status, n: stats.byStatus[status] }).toEqual({ status, n: await rows({ status }) });
        expect(stats.archived).toBe(await rows({ archived: true }));
        expect(stats).toMatchObject({ all: 3, byStatus: { DRAFT: 1, SUBMITTED: 2 } });
        // Another filter does narrow every card.
        expect(await queries.listStats(scope.wardy, { ...filters, caseType: 'INCIDENT' })).toMatchObject({ all: 1, byStatus: { DRAFT: 0, SUBMITTED: 1 } });
        // Somebody who reaches nothing counts nothing.
        const nobody = enforced(id.pc02, { read: NOTHING, write: NOTHING }, null);
        expect(await queries.listStats(nobody, filters)).toMatchObject({ all: 0, archived: 0 });
      });

      it('the units the filter offers are those with a request the person may read, and no other', async () => {
        expect((await queries.filterUnits(scope.wardy)).map((t) => t.id)).toEqual([id.W]);
        expect((await queries.filterUnits(scope.reviewer)).map((t) => t.id)).toEqual(expect.arrayContaining([id.W, id.V]));
        // A unit with no request is not named; somebody who reaches nothing is offered nothing.
        expect((await queries.filterUnits(scope.reviewer)).map((t) => t.id)).not.toContain(id.U);
        expect(await queries.filterUnits(enforced(id.pc02, { read: NOTHING, write: NOTHING }, null))).toEqual([]);
      });

      it('Excel: the rows, the order and the columns of the screen, within reach, and the export is audited', async () => {
        const read = async (who: DataScope | null, query: object, actor: string) => {
          const stream = new PassThrough();
          const parts: Buffer[] = [];
          stream.on('data', (c: Buffer) => parts.push(c));
          const res = Object.assign(stream, { setHeader: jest.fn() });
          await queries.exportList(who, { q: mark, ...query }, res as never, { userId: actor });
          const wb = new ExcelJS.Workbook();
          await wb.xlsx.load(Buffer.concat(parts) as never);
          const sheet = wb.worksheets[0];
          const lines: string[][] = [];
          sheet.eachRow((row) => lines.push((row.values as unknown[]).slice(1).map((v) => (v == null ? '' : String(v)))));
          const head = lines.findIndex((l) => l[0] === 'STT');
          return { name: sheet.name, header: lines[head], rows: lines.slice(head + 1).filter((l) => /^\d+$/.test(l[0])) };
        };
        const all = await read(scope.wardy, { sortBy: 'summary', sortOrder: 'asc' }, id.wardy);
        expect(all.name).toBe('Hồ sơ phân công');
        expect(all.header.slice(0, 4)).toEqual(['STT', 'Mã', 'Ngày trình', 'Đơn vị']);
        const onScreen = (await mine({ sortBy: 'summary', sortOrder: 'asc' })).data;
        // The same rows in the same order; the other unit's is not in the file.
        expect(all.rows.map((r) => r[all.header.indexOf('Trích yếu')])).toEqual(onScreen.map((r) => r.summary));
        expect(all.rows.flat().join('|')).not.toContain('của đơn vị khác');
        // The words of the screen, not the codes of the database.
        const theft = all.rows.find((r) => r.join('|').includes('Trộm xe máy'))!;
        expect(theft[all.header.indexOf('Loại hồ sơ')]).toBe('Vụ việc');
        expect(theft[all.header.indexOf('Tội danh')]).toBe('Trộm cắp tài sản');
        expect(theft[all.header.indexOf('Tình trạng')]).toBe('Chờ duyệt');
        // Only the columns shown, in the order shown.
        const two = await read(scope.wardy, { cot: 'summary,code', status: 'DRAFT' }, id.wardy);
        expect(two.header).toEqual(['STT', 'Trích yếu', 'Mã']);
        expect(two.rows).toHaveLength(1);
        expect(await fails(read(scope.wardy, { cot: 'summary,passwordHash' }, id.wardy))).toMatchObject({ status: 400 });
        // Nothing to export is said, not sent as an empty file.
        expect(await fails(read(scope.wardy, { q: `${mark} không có dòng nào` }, id.wardy))).toMatchObject({ status: 400 });
        const logged = await scratch.db.auditLog.findMany({ where: { userId: id.wardy, action: 'WARD_ASSIGNMENT_LIST_EXPORTED' }, orderBy: { createdAt: 'asc' } });
        expect(logged.length).toBe(2);
        expect(logged[0].metadata).toMatchObject({ format: 'xlsx', rows: 3 });
        expect(logged[1].metadata).toMatchObject({ columns: ['summary', 'code'], rows: 1 });
      });
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

    it('two people adding the same name at the same moment: one is refused, the unit is not left with a silent double', async () => {
      const name = `${tag} Đồng Thời`;
      const outcomes = await Promise.all([1, 2, 3, 4].map(() => fails(investigators.create({ id: id.wardy }, scope.wardy, { teamId: id.W, fullName: name }))));
      expect(outcomes.filter((o) => o === 'resolved')).toHaveLength(1);
      for (const o of outcomes.filter((x) => x !== 'resolved')) expect(o).toMatchObject({ status: 409, body: { code: WARD_ERROR.INVESTIGATOR_DUPLICATE } });
      expect(await scratch.db.wardInvestigator.count({ where: { teamId: id.W, fullName: name } })).toBe(1);
    });

    it('PC02 reviewers may add an investigator to a ward unit (to assign one the unit did not propose)', async () => {
      const added = await investigators.create({ id: id.reviewer }, scope.reviewer, { teamId: id.V, fullName: `${tag} Đặng Văn M` });
      expect(added.teamId).toBe(id.V);
    });
  });

  /**
   * The shared desk at PC02 (`intake:WardAssignment`): one account on which ward officers enter their unit's requests.
   * It enters for any ward unit, keeps seeing what it saved but did not submit, and never sees a request again once it
   * was submitted: not when PC02 returns it, not when somebody else takes the submission back.
   */
  describe('the shared desk at PC02', () => {
    const OWN: PreciseScope = { ...NOTHING, own: true };
    const desk = (ward: { read: PreciseScope; write: PreciseScope }): DataScope => {
      const base = enforced(id.desk, ward, null);
      return { ...base, precise: { ...base.precise!, wardIntake: true } };
    };
    const listed = async (who: DataScope | null, actor: string) => (await queries.list(who, { q: tag, pageSize: 200 }, new Date(), actor)).data.map((r) => r.id);

    beforeAll(async () => {
      const { roleId } = await scratch.db.user.findUniqueOrThrow({ where: { id: id.wardy }, select: { roleId: true } });
      id.desk = (await scratch.db.user.create({ data: { username: `${tag}-desk`, passwordHash: 'x', roleId, isActive: true } })).id;
      id.investigatorDeskV = id.investigatorV;
      // What the starter template gives: its own records, and the marker.
      scope.desk = desk({ read: OWN, write: OWN });
    });

    it('enters a request for any ward unit, on its behalf, and is offered every active ward unit', async () => {
      const forW = await commands.create({ id: id.desk }, scope.desk, input({ assignedTeamId: id.W, summary: `${tag} bàn nhập cho W` }));
      const forV = await commands.create({ id: id.desk }, scope.desk, input({ assignedTeamId: id.V, proposedInvestigatorId: id.investigatorV, summary: `${tag} bàn nhập cho V` }));
      expect(forW).toMatchObject({ assignedTeamId: id.W, enteredById: id.desk, enteredOnBehalf: true, status: 'DRAFT', code: null });
      expect(forV).toMatchObject({ assignedTeamId: id.V, enteredOnBehalf: true });
      const offered = (await queries.unitChoices(scope.desk)).map((t) => t.id);
      expect(offered).toEqual(expect.arrayContaining([id.W, id.V]));
      // No unit is its own: the unit must be chosen.
      expect(await fails(commands.create({ id: id.desk }, scope.desk, input({ assignedTeamId: undefined })))).toMatchObject({ status: 400, body: { code: WARD_ERROR.UNIT_REQUIRED } });
    });

    it('keeps seeing and editing what it saved and did not submit; not a draft another account entered', async () => {
      const draft = await commands.create({ id: id.desk }, scope.desk, input({ assignedTeamId: id.W, summary: `${tag} nháp của bàn nhập` }));
      const theirs = await commands.create({ id: id.wardy }, scope.wardy, input({ summary: `${tag} nháp của phường` }));
      const mine = await listed(scope.desk, id.desk);
      expect(mine).toContain(draft.id);
      expect(mine).not.toContain(theirs.id);
      const opened = await queries.get(scope.desk, id.desk, draft.id);
      expect(opened).toMatchObject({ id: draft.id, intake: true, can: expect.objectContaining({ edit: true, submit: true }) as unknown });
      const edited = await commands.update({ id: id.desk }, scope.desk, draft.id, { ...input({ summary: `${tag} nháp đã sửa` }), expectedUpdatedAt: draft.updatedAt.toISOString() });
      expect(edited.summary).toBe(`${tag} nháp đã sửa`);
      expect(await fails(queries.get(scope.desk, id.desk, theirs.id))).toMatchObject({ status: 404 });
      // The ward unit reads what the desk entered for it: the request is the unit's.
      expect(await listed(scope.wardy, id.wardy)).toContain(draft.id);
    });

    it('once submitted the request is gone for the desk: list, cards, detail, edit, withdraw', async () => {
      const made = await commands.create({ id: id.desk }, scope.desk, input({ assignedTeamId: id.W, summary: `${tag} bàn nhập đã trình` }));
      const before = (await queries.listStats(scope.desk, { q: tag })).all;
      const sent = await commands.submit({ id: id.desk }, scope.desk, made.id, made.updatedAt.toISOString());
      expect(sent).toMatchObject({ status: 'SUBMITTED', submissionCount: 1 });
      expect(sent.code).not.toBeNull();
      const stamp = sent.updatedAt.toISOString();
      expect(await listed(scope.desk, id.desk)).not.toContain(made.id);
      expect((await queries.listStats(scope.desk, { q: tag })).all).toBe(before - 1);
      expect((await queries.listStats(scope.desk, { q: tag })).byStatus.SUBMITTED).toBe(0);
      expect(await fails(queries.get(scope.desk, id.desk, made.id))).toMatchObject({ status: 404, body: { code: WARD_ERROR.NOT_FOUND } });
      expect(await fails(commands.update({ id: id.desk }, scope.desk, made.id, { ...input(), expectedUpdatedAt: stamp }))).toMatchObject({ status: 404 });
      expect(await fails(commands.withdraw({ id: id.desk }, scope.desk, made.id, stamp))).toMatchObject({ status: 404 });
      // A second click on "Trình": the request is not there any more, nothing is submitted twice.
      expect(await fails(commands.submit({ id: id.desk }, scope.desk, made.id, stamp))).toMatchObject({ status: 404 });
      expect(await scratch.db.wardAssignmentRound.count({ where: { assignmentId: made.id } })).toBe(1);
      // The ward unit and PC02 see it as before.
      expect(await listed(scope.wardy, id.wardy)).toContain(made.id);
      expect(await listed(scope.reviewer, id.reviewer)).toContain(made.id);
    });

    it('a submission somebody else takes back does not bring the request back to the desk, nor does a return', async () => {
      const made = await commands.create({ id: id.desk }, scope.desk, input({ assignedTeamId: id.W, summary: `${tag} bàn nhập bị rút` }));
      const sent = await commands.submit({ id: id.desk }, scope.desk, made.id, made.updatedAt.toISOString());
      const back = await commands.withdraw({ id: id.pc02 }, scope.pc02, made.id, sent.updatedAt.toISOString());
      // A draft again, entered by the desk, with no submission counted: and still not the desk's to see.
      expect(back).toMatchObject({ status: 'DRAFT', submissionCount: 0, enteredById: id.desk });
      expect(back.code).toBe(sent.code);
      expect(await listed(scope.desk, id.desk)).not.toContain(made.id);
      expect(await fails(queries.get(scope.desk, id.desk, made.id))).toMatchObject({ status: 404 });
      expect(await fails(commands.update({ id: id.desk }, scope.desk, made.id, { ...input(), expectedUpdatedAt: back.updatedAt.toISOString() }))).toMatchObject({ status: 404 });
      await scratch.db.wardAssignment.update({ where: { id: made.id }, data: { status: 'RETURNED' } });
      expect(await listed(scope.desk, id.desk)).not.toContain(made.id);
      expect(await fails(queries.get(scope.desk, id.desk, made.id))).toMatchObject({ status: 404 });
    });

    it('the marker wins over a wider reach given by another unit: the submitted requests stay hidden', async () => {
      const wide = desk({ read: ALL, write: ALL });
      const made = await commands.create({ id: id.desk }, wide, input({ assignedTeamId: id.V, proposedInvestigatorId: id.investigatorV, summary: `${tag} bàn nhập quyền rộng` }));
      expect(await listed(wide, id.desk)).toContain(made.id);
      await commands.submit({ id: id.desk }, wide, made.id, made.updatedAt.toISOString());
      const seen = await listed(wide, id.desk);
      expect(seen).not.toContain(made.id);
      // Nothing submitted at all, of any unit, although the reach says "every request".
      const statuses = await scratch.db.wardAssignment.findMany({ where: { id: { in: seen } }, select: { code: true, enteredById: true } });
      expect(statuses.every((r) => r.code === null && r.enteredById === id.desk)).toBe(true);
      expect(await fails(queries.get(wide, id.desk, made.id))).toMatchObject({ status: 404 });
    });

    it('reads a ward unit\'s investigators and adds one; correcting or stopping a name is not the desk\'s', async () => {
      const names = (await investigators.list(scope.desk, id.V)).map((i) => i.id);
      expect(names).toContain(id.investigatorV);
      const added = await investigators.create({ id: id.desk }, scope.desk, { teamId: id.V, fullName: `${tag} Bàn Nhập Thêm` });
      expect(added).toMatchObject({ teamId: id.V, isActive: true });
      const stamp = added.updatedAt.toISOString();
      expect(await fails(investigators.update({ id: id.desk }, scope.desk, added.id, { rank: 'Đại tá', expectedUpdatedAt: stamp }))).toMatchObject({ status: 404 });
      expect(await fails(investigators.setActive({ id: id.desk }, scope.desk, id.investigatorV, false, stamp))).toMatchObject({ status: 404 });
      expect((await scratch.db.wardInvestigator.findUniqueOrThrow({ where: { id: id.investigatorV } })).isActive).toBe(true);
    });

    it('somebody without the marker and with their own records only enters for no unit but their own', async () => {
      const plain = enforced(id.desk, { read: OWN, write: OWN }, null);
      expect(await fails(commands.create({ id: id.desk }, plain, input({ assignedTeamId: id.W })))).toMatchObject({ status: 403, body: { code: WARD_ERROR.UNIT_OUT_OF_REACH } });
      expect(await queries.unitChoices(plain)).toEqual([]);
    });
  });
});
