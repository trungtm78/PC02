import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';
import { AggregateService } from '../aggregate/aggregate.service';
import { SubmissionService } from '../submission/submission.service';
import { ReportLifecycleService } from './report-lifecycle.service';

/**
 * The way back of one-way actions — checked on a REAL PostgreSQL (design standard: created ⇒ editable and deletable).
 *
 *  - "Bỏ miễn nộp" undoes an exemption;
 *  - "Gỡ tổ" undoes a team added in the middle of a period, but only while nobody entered anything for it;
 *  - "Xoá kỳ" deletes one period — plain while empty, with the figures only for an administrator who types the key;
 *  - the editor withdraws a reopening request that is still waiting.
 *
 * Runs only when DYN_REPORTS_DATABASE_URL points at a scratch database (see grid-access.database.spec.ts).
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

run('reverse actions on PostgreSQL', () => {
  let db: PrismaClient;
  let aggregate: AggregateService;
  let submissions: SubmissionService;
  let lifecycle: ReportLifecycleService;
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const tag = `rv-${randomUUID().slice(0, 8)}`;
  const past = new Date('2020-01-01T00:00:00Z');
  const future = new Date('2099-01-01T00:00:00Z');
  const user: Record<string, string> = {};
  const team: Record<string, string> = {};
  let roleManager = '';
  let roleAdmin = '';

  /** A report with one OPEN period over teams t1 (the original) and, when asked, t2 added in the middle of the period. */
  async function build(name: string, over: { added?: boolean; touchAdded?: boolean; periodStatus?: 'OPEN' | 'FINALIZED'; touchOriginal?: boolean } = {}) {
    const report = await db.dynReport.create({ data: { code: `${tag}-${name}`, name: `${tag} ${name}`, status: 'PUBLISHED' } });
    const version = await db.dynReportVersion.create({
      data: { reportId: report.id, version: 1, status: 'PUBLISHED', fileBytes: Buffer.from('x'), sha256: 'f'.repeat(64), fileName: 'm.xlsx', selectedSheets: ['S'], layout: {}, parserVersion: 't', engineVersion: 't' },
    });
    await db.dynReportRole.create({ data: { reportId: report.id, userId: user.mgr, role: 'MANAGER' } });
    const period = await db.dynReportPeriod.create({
      data: { reportId: report.id, periodKey: `${tag}-${name}-P`, startDate: new Date('2026-10-01'), endDate: new Date('2026-10-31'), opensAt: past, dueAt: future, versionId: version.id, scheduleSnapshot: {}, status: over.periodStatus ?? 'OPEN' },
    });
    const make = async (t: 't1' | 't2', mid: boolean, touched: boolean) => {
      const a = await db.dynReportAssignment.create({
        data: { periodId: period.id, teamId: team[t], teamSnapshot: { name: t }, ...(mid ? { addedMidPeriodReason: 'thêm nhầm' } : {}) },
      });
      await db.dynReportAssignmentEditor.create({ data: { assignmentId: a.id, userId: user.editor, isActive: true } });
      await db.dynReportSubmission.create({
        data: { assignmentId: a.id, state: touched ? 'DRAFT' : 'NOT_STARTED', currentRevision: touched ? 1 : 0, values: touched ? { 'S!C3': { t: 'NUM', v: '1' } } : {} },
      });
      return a.id;
    };
    const original = await make('t1', false, !!over.touchOriginal);
    const added = over.added ? await make('t2', true, !!over.touchAdded) : '';
    await db.dynReportSnapshot.create({
      data: { periodId: period.id, mode: 'SUBMITTED', sourceHash: 'h', sourceRevisions: {}, contributorSetHash: 'c', values: {}, engineVersion: 't', asOf: past },
    });
    return { reportId: report.id, periodId: period.id, periodKey: `${tag}-${name}-P`, original, added };
  }

  beforeAll(async () => {
    const u = new URL(url!);
    if (u.hostname !== '127.0.0.1' || !['/pc02_dynamic_reports_test', '/pc02_goiy_scope_test'].includes(u.pathname)) {
      throw new Error('Từ chối: DYN_REPORTS_DATABASE_URL phải trỏ 127.0.0.1/pc02_dynamic_reports_test hoặc pc02_goiy_scope_test');
    }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
    aggregate = new AggregateService(db as never, {} as never, { emit: jest.fn() } as never, {} as never, {} as never);
    // The editor's assignment is read with the template's fields from a cache; the template is not what is under test.
    const fieldsCache = { getOrLoad: jest.fn().mockResolvedValue({ fields: [], rules: [] }) };
    submissions = new SubmissionService(db as never, { emit: jest.fn() } as never, fieldsCache as never, {} as never);
    lifecycle = new ReportLifecycleService(db as never, audit as never);

    roleManager = (await db.role.create({ data: { name: `${tag}-mgr` } })).id;
    roleAdmin = (await db.role.create({ data: { name: `${tag}-adm` } })).id;
    const perm = await db.permission.upsert({
      where: { action_subject: { action: 'admin', subject: 'DynamicReport' } },
      update: {},
      create: { action: 'admin', subject: 'DynamicReport' },
    });
    await db.rolePermission.create({ data: { roleId: roleAdmin, permissionId: perm.id } });
    for (const [n, r] of [['mgr', roleManager], ['admin', roleAdmin], ['editor', roleManager], ['stranger', roleManager]] as const) {
      user[n] = (await db.user.create({ data: { username: `${tag}-${n}`, passwordHash: 'x', roleId: r } })).id;
    }
    for (const n of ['t1', 't2']) team[n] = (await db.team.create({ data: { code: `${tag}-${n}`, name: `${tag}-${n}` } })).id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  beforeEach(() => audit.log.mockClear());

  const mgr = () => ({ id: user.mgr, roleId: roleManager });
  const admin = () => ({ id: user.admin, roleId: roleAdmin });

  describe('bỏ miễn nộp', () => {
    it('puts the team back to REQUIRED and clears who exempted it and why, keeping what was entered', async () => {
      const f = await build('unex', { touchOriginal: true });
      await aggregate.exemptTeamMidPeriod(f.periodId, user.mgr, roleManager, f.original, 'miễn thử');
      expect((await db.dynReportAssignment.findUnique({ where: { id: f.original } }))?.obligation).toBe('EXEMPT');

      const out = await aggregate.unexemptTeamMidPeriod(f.periodId, user.mgr, roleManager, f.original);

      expect(out.obligation).toBe('REQUIRED');
      expect(await db.dynReportAssignment.findUnique({ where: { id: f.original } })).toMatchObject({
        obligation: 'REQUIRED', exemptReason: null, exemptById: null, exemptAt: null,
      });
      expect((await db.dynReportSubmission.findUnique({ where: { assignmentId: f.original } }))?.currentRevision).toBe(1n);
    });

    it('a team that is not exempt, a closed period and a stranger are all refused', async () => {
      const f = await build('unex-bad');
      await expect(aggregate.unexemptTeamMidPeriod(f.periodId, user.mgr, roleManager, f.original)).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
      await expect(aggregate.unexemptTeamMidPeriod(f.periodId, user.stranger, roleManager, f.original)).rejects.toThrow(/Không tìm thấy/);

      const closed = await build('unex-closed', { periodStatus: 'FINALIZED' });
      await db.dynReportAssignment.update({ where: { id: closed.original }, data: { obligation: 'EXEMPT' } });
      await expect(aggregate.unexemptTeamMidPeriod(closed.periodId, user.mgr, roleManager, closed.original)).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
    });
  });

  describe('gỡ tổ thêm nhầm giữa kỳ', () => {
    it('removes a team added mid-period that nobody touched, with its editors and submission, and invalidates the summary', async () => {
      const f = await build('rm', { added: true });
      const out = await aggregate.removeAddedTeamMidPeriod(f.periodId, user.mgr, roleManager, f.added);

      expect(out.removed).toBe(true);
      expect(await db.dynReportAssignment.count({ where: { id: f.added } })).toBe(0);
      expect(await db.dynReportSubmission.count({ where: { assignmentId: f.added } })).toBe(0);
      expect(await db.dynReportAssignmentEditor.count({ where: { assignmentId: f.added } })).toBe(0);
      expect(await db.dynReportAssignment.count({ where: { id: f.original } })).toBe(1);
      expect((await db.dynReportSnapshot.findFirst({ where: { periodId: f.periodId } }))?.invalidatedReason).toBe('TEAM_REMOVED');
    });

    it('refuses a team that has figures, a comment or an unlock request — those are exempted, not erased', async () => {
      const touched = await build('rm-data', { added: true, touchAdded: true });
      await expect(aggregate.removeAddedTeamMidPeriod(touched.periodId, user.mgr, roleManager, touched.added)).rejects.toMatchObject({ code: 'HAS_DATA' });

      const commented = await build('rm-comment', { added: true });
      await db.dynReportComment.create({ data: { assignmentId: commented.added, body: 'x', authorId: user.editor } });
      await expect(aggregate.removeAddedTeamMidPeriod(commented.periodId, user.mgr, roleManager, commented.added)).rejects.toMatchObject({ code: 'HAS_DATA' });
      expect(await db.dynReportAssignment.count({ where: { id: commented.added } })).toBe(1);
    });

    it('a team that was there from the start of the period cannot be removed this way; a closed period neither', async () => {
      const f = await build('rm-orig', { added: true });
      await expect(aggregate.removeAddedTeamMidPeriod(f.periodId, user.mgr, roleManager, f.original)).rejects.toMatchObject({ code: 'NOT_ADDED_MID_PERIOD' });

      const closed = await build('rm-closed', { added: true, periodStatus: 'FINALIZED' });
      await expect(aggregate.removeAddedTeamMidPeriod(closed.periodId, user.mgr, roleManager, closed.added)).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
    });
  });

  describe('xoá kỳ', () => {
    it('a manager deletes a period nobody entered anything in; the rest of the report stays', async () => {
      const f = await build('per-empty');
      const keep = await db.dynReportPeriod.create({
        data: { reportId: f.reportId, periodKey: `${tag}-per-empty-P2`, startDate: new Date('2026-11-01'), endDate: new Date('2026-11-30'), opensAt: past, dueAt: future, versionId: (await db.dynReportVersion.findFirst({ where: { reportId: f.reportId } }))!.id, scheduleSnapshot: {} },
      });

      const out = await lifecycle.deletePeriod(f.periodId, { withData: false }, mgr());

      expect(out).toMatchObject({ deleted: true, periodKey: f.periodKey });
      expect(await db.dynReportPeriod.count({ where: { id: f.periodId } })).toBe(0);
      expect(await db.dynReportAssignment.count({ where: { periodId: f.periodId } })).toBe(0);
      expect(await db.dynReportSnapshot.count({ where: { periodId: f.periodId } })).toBe(0);
      expect(await db.dynReportPeriod.count({ where: { id: keep.id } })).toBe(1);
      expect(await db.dynReport.count({ where: { id: f.reportId } })).toBe(1);
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'DYN_PERIOD_DELETE', subjectId: f.periodId }), expect.anything());
    });

    it('a period with figures is refused for a manager (409 HAS_DATA); a closed period counts as data', async () => {
      const f = await build('per-data', { touchOriginal: true });
      await expect(lifecycle.deletePeriod(f.periodId, { withData: false }, mgr())).rejects.toMatchObject({ code: 'HAS_DATA' });
      const closed = await build('per-closed', { periodStatus: 'FINALIZED' });
      await expect(lifecycle.deletePeriod(closed.periodId, { withData: false }, mgr())).rejects.toMatchObject({ code: 'HAS_DATA' });
      expect(await db.dynReportPeriod.count({ where: { id: f.periodId } })).toBe(1);
    });

    it('with the figures: only an administrator, and only with the period key typed back', async () => {
      const f = await build('per-force', { touchOriginal: true });
      await expect(lifecycle.deletePeriod(f.periodId, { withData: true, confirmKey: f.periodKey }, mgr())).rejects.toMatchObject({ code: 'ADMIN_REQUIRED' });
      await expect(lifecycle.deletePeriod(f.periodId, { withData: true }, admin())).rejects.toMatchObject({ code: 'CONFIRMATION_REQUIRED' });
      await expect(lifecycle.deletePeriod(f.periodId, { withData: true, confirmKey: 'sai' }, admin())).rejects.toMatchObject({ code: 'CONFIRMATION_REQUIRED' });
      expect(await db.dynReportPeriod.count({ where: { id: f.periodId } })).toBe(1);

      await lifecycle.deletePeriod(f.periodId, { withData: true, confirmKey: f.periodKey }, admin());
      expect(await db.dynReportPeriod.count({ where: { id: f.periodId } })).toBe(0);
      expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'DYN_PERIOD_DELETE_WITH_DATA' }), expect.anything());
    });

    it('somebody who does not manage the report finds nothing (same 404 as everywhere), and the impact read is guarded the same way', async () => {
      const f = await build('per-stranger');
      await expect(lifecycle.deletePeriod(f.periodId, { withData: false }, { id: user.stranger, roleId: roleManager })).rejects.toMatchObject({ code: 'REPORT_NOT_FOUND' });
      await expect(lifecycle.getPeriodDeletionImpact(f.periodId, { id: user.stranger, roleId: roleManager })).rejects.toMatchObject({ code: 'REPORT_NOT_FOUND' });
      await expect(lifecycle.getPeriodDeletionImpact(f.periodId, mgr())).resolves.toMatchObject({ hasData: false, assignments: 1 });
      expect(await db.dynReportPeriod.count({ where: { id: f.periodId } })).toBe(1);
    });

    it('a figure saved while the delete waits is not deleted by the plain path: the check is made again under lock', async () => {
      const f = await build('per-race');
      const save = db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM dyn_report_periods WHERE id = ${f.periodId} FOR SHARE`;
        await tx.dynReportSubmission.updateMany({ where: { assignmentId: f.original }, data: { state: 'DRAFT', currentRevision: 1 } });
        await new Promise((resolve) => setTimeout(resolve, 700));
      });
      await new Promise((resolve) => setTimeout(resolve, 200));

      await expect(lifecycle.deletePeriod(f.periodId, { withData: false }, mgr())).rejects.toMatchObject({ code: 'HAS_DATA' });
      await save;
      expect(await db.dynReportPeriod.count({ where: { id: f.periodId } })).toBe(1);
    });
  });

  describe('rút lại yêu cầu mở lại', () => {
    async function requested(name: string) {
      const f = await build(name, { touchOriginal: true });
      const unlock = await db.dynReportUnlock.create({
        data: { assignmentId: f.original, kind: 'REQUEST', status: 'PENDING', startsAt: past, expiresAt: past, reason: 'cần sửa', requestedById: user.editor },
      });
      return { ...f, unlockId: unlock.id };
    }

    it('the requester withdraws it: it stops being PENDING (so it leaves the manager\'s queue) and says who and when', async () => {
      const f = await requested('wd');
      await expect(submissions.withdrawUnlockRequest(f.original, user.editor)).resolves.toEqual({ withdrawn: true });

      expect(await db.dynReportUnlock.findUnique({ where: { id: f.unlockId } })).toMatchObject({
        status: 'REVOKED', revokedById: user.editor, revokeReason: 'Người yêu cầu đã rút lại',
      });
      expect((await db.dynReportUnlock.findUnique({ where: { id: f.unlockId } }))?.revokedAt).not.toBeNull();
    });

    it('a request already decided (or already withdrawn) cannot be withdrawn again', async () => {
      const f = await requested('wd-twice');
      await submissions.withdrawUnlockRequest(f.original, user.editor);
      await expect(submissions.withdrawUnlockRequest(f.original, user.editor)).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });

      const decided = await requested('wd-decided');
      await db.dynReportUnlock.update({ where: { id: decided.unlockId }, data: { status: 'REJECTED' } });
      await expect(submissions.withdrawUnlockRequest(decided.original, user.editor)).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
    });

    it('somebody else\'s request is not theirs to withdraw, and a stranger to the assignment finds nothing', async () => {
      const f = await requested('wd-other');
      await db.dynReportAssignmentEditor.create({ data: { assignmentId: f.original, userId: user.stranger, isActive: true } });
      await expect(submissions.withdrawUnlockRequest(f.original, user.stranger)).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
      expect((await db.dynReportUnlock.findUnique({ where: { id: f.unlockId } }))?.status).toBe('PENDING');
    });

    it('the editor\'s own view says a request is pending, until it is withdrawn', async () => {
      const f = await requested('wd-view');
      expect((await submissions.getSubmission(f.original, user.editor)).pendingUnlockRequest).toMatchObject({ id: f.unlockId, reason: 'cần sửa' });
      await submissions.withdrawUnlockRequest(f.original, user.editor);
      expect((await submissions.getSubmission(f.original, user.editor)).pendingUnlockRequest).toBeNull();
    });
  });
});
