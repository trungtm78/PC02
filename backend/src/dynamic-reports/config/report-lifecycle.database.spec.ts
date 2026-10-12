import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';
import { ReportLifecycleService } from './report-lifecycle.service';

/**
 * Deleting / archiving a report — checked on a REAL PostgreSQL.
 *
 * Every relation under a report is `onDelete: Restrict`, so the deletion order is the whole job and a fake Prisma
 * cannot prove it: one table in the wrong place and the real database refuses. This builds a report with a row in
 * every table beneath it, deletes it, and checks that nothing is left and that a second report is untouched.
 *
 * Runs only when DYN_REPORTS_DATABASE_URL points at a scratch database (see grid-access.database.spec.ts).
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

run('ReportLifecycleService on PostgreSQL', () => {
  let db: PrismaClient;
  let svc: ReportLifecycleService;
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const tag = `lc-${randomUUID().slice(0, 8)}`;
  let userId = '';
  let teamId = '';

  const past = new Date('2020-01-01T00:00:00Z');
  const future = new Date('2099-01-01T00:00:00Z');

  /** A report with one row in every table under it; `withData` decides whether anybody entered anything. */
  async function buildReport(name: string, withData: boolean) {
    const report = await db.dynReport.create({ data: { code: `${tag}-${name}`, name: `${tag} ${name}`, status: 'PUBLISHED' } });
    const version = await db.dynReportVersion.create({
      data: {
        reportId: report.id,
        version: 1,
        status: 'PUBLISHED',
        fileBytes: Buffer.from('x'),
        sha256: 'f'.repeat(64),
        fileName: 'm.xlsx',
        selectedSheets: ['S'],
        layout: {},
        parserVersion: 't',
        engineVersion: 't',
      },
    });
    await db.dynReportField.create({
      data: { versionId: version.id, sheetKey: 'S', address: 'C3', fieldKey: 'S!C3', label: 'A', type: 'NUM', aggregate: 'SUM', source: 'WEB' },
    });
    await db.dynReportValidationRule.create({
      data: { versionId: version.id, name: 'r', leftExpr: 'A', operator: 'GTE', rightExpr: 'B', message: 'm' },
    });
    await db.dynReportVersionGrid.create({
      data: { versionId: version.id, gridEngineVersion: 1, sourceSha256: 'f'.repeat(64), model: {} },
    });
    await db.dynReportSchedule.create({
      data: { reportId: report.id, periodType: 'MONTHLY', dueRule: {}, openRule: {}, effectiveFrom: past },
    });
    await db.dynReportRole.create({ data: { reportId: report.id, userId, role: 'MANAGER' } });
    const target = await db.dynReportTarget.create({ data: { reportId: report.id, teamId } });
    await db.dynReportTargetEditor.create({ data: { targetId: target.id, userId } });
    const period = await db.dynReportPeriod.create({
      data: {
        reportId: report.id,
        periodKey: `${tag}-${name}-P`,
        startDate: new Date('2026-10-01'),
        endDate: new Date('2026-10-31'),
        opensAt: past,
        dueAt: future,
        versionId: version.id,
        scheduleSnapshot: {},
      },
    });
    const assignment = await db.dynReportAssignment.create({ data: { periodId: period.id, teamId, teamSnapshot: {} } });
    await db.dynReportAssignmentEditor.create({ data: { assignmentId: assignment.id, userId, isActive: true } });
    await db.dynReportReminder.create({ data: { assignmentId: assignment.id, window: 'T24H' } });
    const submission = await db.dynReportSubmission.create({
      data: {
        assignmentId: assignment.id,
        state: withData ? 'SUBMITTED' : 'NOT_STARTED',
        currentRevision: withData ? 1 : 0,
        values: withData ? { 'S!C3': { t: 'NUM', v: '5' } } : {},
      },
    });
    if (withData) {
      await db.dynReportRevision.create({
        data: { submissionId: submission.id, revision: 1, kind: 'SUBMIT', valuesFull: {}, actorId: userId },
      });
      await db.dynReportComment.create({ data: { assignmentId: assignment.id, body: 'ghi chú', authorId: userId } });
      await db.dynReportUnlock.create({
        data: { assignmentId: assignment.id, kind: 'GRANT', status: 'ACTIVE', startsAt: past, expiresAt: future, reason: 'r' },
      });
    }
    const snapshot = await db.dynReportSnapshot.create({
      data: {
        periodId: period.id,
        mode: 'SUBMITTED',
        sourceHash: 'h',
        sourceRevisions: {},
        contributorSetHash: 'c',
        values: {},
        engineVersion: 't',
        asOf: past,
      },
    });
    await db.dynReportExport.create({
      data: { requestedById: userId, kind: 'MANAGER_FULL', scope: { periodId: period.id, reportId: report.id }, snapshotId: snapshot.id },
    });
    return report.id;
  }

  async function rowsLeft(reportId: string): Promise<Record<string, number>> {
    const periodWhere = { period: { reportId } };
    return {
      report: await db.dynReport.count({ where: { id: reportId } }),
      versions: await db.dynReportVersion.count({ where: { reportId } }),
      fields: await db.dynReportField.count({ where: { version: { reportId } } }),
      rules: await db.dynReportValidationRule.count({ where: { version: { reportId } } }),
      schedules: await db.dynReportSchedule.count({ where: { reportId } }),
      roles: await db.dynReportRole.count({ where: { reportId } }),
      targets: await db.dynReportTarget.count({ where: { reportId } }),
      periods: await db.dynReportPeriod.count({ where: { reportId } }),
      assignments: await db.dynReportAssignment.count({ where: periodWhere }),
      submissions: await db.dynReportSubmission.count({ where: { assignment: periodWhere } }),
      revisions: await db.dynReportRevision.count({ where: { submission: { assignment: periodWhere } } }),
      comments: await db.dynReportComment.count({ where: { assignment: periodWhere } }),
      unlocks: await db.dynReportUnlock.count({ where: { assignment: periodWhere } }),
      snapshots: await db.dynReportSnapshot.count({ where: periodWhere }),
      exports: await db.dynReportExport.count({ where: { scope: { path: ['reportId'], equals: reportId } } }),
    };
  }

  beforeAll(async () => {
    const u = new URL(url!);
    if (u.hostname !== '127.0.0.1' || !['/pc02_dynamic_reports_test', '/pc02_goiy_scope_test'].includes(u.pathname)) {
      throw new Error('Từ chối: DYN_REPORTS_DATABASE_URL phải trỏ 127.0.0.1/pc02_dynamic_reports_test hoặc pc02_goiy_scope_test');
    }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
    svc = new ReportLifecycleService(db as never, audit as never);
    const role = await db.role.create({ data: { name: `${tag}-role` } });
    userId = (await db.user.create({ data: { username: `${tag}-u`, passwordHash: 'x', roleId: role.id } })).id;
    teamId = (await db.team.create({ data: { code: `${tag}-T`, name: `${tag}-T` } })).id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  beforeEach(() => audit.log.mockClear());

  it('counts what a deletion would destroy, and tells a report nobody touched from one that has figures', async () => {
    const empty = await buildReport('imp-empty', false);
    const full = await buildReport('imp-full', true);

    expect(await svc.getDeletionImpact(empty)).toMatchObject({ hasData: false, submissionsWithData: 0, periods: 1, versions: 1 });
    expect(await svc.getDeletionImpact(full)).toMatchObject({
      hasData: true,
      submissionsWithData: 1,
      revisions: 1,
      comments: 1,
      unlocks: 1,
    });
  });

  it('deletes a report nobody has entered anything into, with every row beneath it, and leaves other reports alone', async () => {
    const mine = await buildReport('del-empty', false);
    const other = await buildReport('del-other', false);

    await expect(svc.deleteReport(mine, { withData: false }, userId)).resolves.toMatchObject({ deleted: true });

    expect(Object.values(await rowsLeft(mine)).every((n) => n === 0)).toBe(true);
    const kept = await rowsLeft(other);
    expect(kept).toMatchObject({ report: 1, versions: 1, fields: 1, periods: 1, assignments: 1, submissions: 1, snapshots: 1, exports: 1 });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'DYN_REPORT_DELETE', subjectId: mine }), expect.anything());
  });

  it('refuses a plain delete once there are figures, and nothing is removed', async () => {
    const id = await buildReport('del-data', true);
    await expect(svc.deleteReport(id, { withData: false }, userId)).rejects.toMatchObject({ code: 'HAS_DATA' });
    expect((await rowsLeft(id)).report).toBe(1);
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('delete with data needs the report code typed back; wrong or missing code removes nothing', async () => {
    const id = await buildReport('del-confirm', true);
    await expect(svc.deleteReport(id, { withData: true }, userId)).rejects.toMatchObject({ code: 'CONFIRMATION_REQUIRED' });
    await expect(svc.deleteReport(id, { withData: true, confirmCode: 'sai-ma' }, userId)).rejects.toMatchObject({
      code: 'CONFIRMATION_REQUIRED',
    });
    expect((await rowsLeft(id)).report).toBe(1);
  });

  it('delete with data removes the figures too — revisions, comments, unlocks, snapshots, exports — and is audited', async () => {
    const id = await buildReport('del-all', true);
    await svc.deleteReport(id, { withData: true, confirmCode: `${tag}-del-all` }, userId);

    expect(Object.values(await rowsLeft(id)).every((n) => n === 0)).toBe(true);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'DYN_REPORT_DELETE_WITH_DATA',
        metadata: expect.objectContaining({ submissionsWithData: 1, revisions: 1, comments: 1 }),
      }),
      expect.anything(),
    );
  });

  it('a figure saved while the delete is waiting is not deleted: the check is made again under lock (found by Codex)', async () => {
    const id = await buildReport('race', false); // nobody has entered anything yet, so the early check passes

    // An editor saving: a save holds its period FOR SHARE, writes the submission, and is still open for a moment.
    const save = db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM dyn_report_periods WHERE "reportId" = ${id} FOR SHARE`;
      await tx.dynReportSubmission.updateMany({
        where: { assignment: { period: { reportId: id } } },
        data: { state: 'DRAFT', currentRevision: 1 },
      });
      await new Promise((resolve) => setTimeout(resolve, 700));
    });
    await new Promise((resolve) => setTimeout(resolve, 200)); // let the save take its locks first

    const removal = svc.deleteReport(id, { withData: false }, userId);

    await expect(removal).rejects.toMatchObject({ code: 'HAS_DATA' });
    await save;
    expect((await rowsLeft(id)).report).toBe(1);
    expect((await rowsLeft(id)).submissions).toBe(1);
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('a report that does not exist is REPORT_NOT_FOUND', async () => {
    await expect(svc.deleteReport('missing', { withData: false }, userId)).rejects.toMatchObject({ code: 'REPORT_NOT_FOUND' });
  });

  it('archive keeps every row and hides the report from generation; unarchive brings it back suspended', async () => {
    const id = await buildReport('arch', true);
    await expect(svc.archive(id)).resolves.toEqual({ status: 'ARCHIVED' });
    expect((await db.dynReport.findUnique({ where: { id } }))?.status).toBe('ARCHIVED');
    expect((await rowsLeft(id)).submissions).toBe(1);

    await expect(svc.archive(id)).rejects.toMatchObject({ code: 'INVALID_STATE' });
    await expect(svc.unarchive(id)).resolves.toEqual({ status: 'SUSPENDED' });
    await expect(svc.unarchive(id)).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });
});
