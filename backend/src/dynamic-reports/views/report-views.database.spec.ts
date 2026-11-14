import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as ExcelJS from 'exceljs';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../../audit/audit.service';
import { AggregateService } from '../aggregate/aggregate.service';
import { ReportLifecycleService } from '../config/report-lifecycle.service';
import { CUSTOM_HEADER_ROW } from '../export/custom-workbook';
import { CustomReportService } from './custom-report.service';
import { ReportViewsService } from './report-views.service';

/**
 * Custom reports ("views") of a dynamic report on a REAL PostgreSQL: saving, the name rule under concurrency, the
 * revision guard, archive / restore / delete, deleting the report under them, who may touch them, and the preview and
 * the Excel file of a period made from them.
 *
 * Runs only when DYN_REPORTS_DATABASE_URL points at a scratch database (see grid-access.database.spec.ts).
 * Everything it creates carries `tag` and is removed at the end.
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

run('Custom reports (views) on PostgreSQL', () => {
  let db: PrismaClient;
  let views: ReportViewsService;
  let custom: CustomReportService;
  let aggregate: AggregateService;
  let lifecycle: ReportLifecycleService;
  const tag = `crv-${randomUUID().slice(0, 8)}`;
  let n = 0;
  let roleId = '';
  let manager = { id: '', roleId: '' };
  let outsider = { id: '', roleId: '' };
  let viewer = { id: '', roleId: '' };
  const team: Record<'a' | 'b' | 'c', string> = { a: '', b: '', c: '' };
  const reportIds: string[] = [];

  const past = new Date('2020-01-01T00:00:00Z');
  const future = new Date('2099-01-01T00:00:00Z');

  /**
   * A criteria report: heading "1" over 1.1 and 1.2, then 2.
   * Period 2026-10 (open): Tổ A reports 1.1 and 1.2 only and SUBMITTED 11 / 12; Tổ B reports everything and is APPROVED
   * with 101 / 102 / 200. Period 2026-11 (open): only Tổ B, APPROVED with 7 / 8 / 9.
   */
  async function report() {
    n += 1;
    const r = await db.dynReport.create({ data: { code: `${tag}-${n}`, name: `${tag} báo cáo ${n}`, status: 'PUBLISHED' } });
    reportIds.push(r.id);
    await db.dynReportRole.create({ data: { reportId: r.id, userId: manager.id, role: 'MANAGER' } });
    await db.dynReportRole.create({ data: { reportId: r.id, userId: viewer.id, role: 'VIEWER' } });
    const version = await db.dynReportVersion.create({
      data: {
        reportId: r.id, version: 1, status: 'PUBLISHED', sourceKind: 'CRITERIA', fileBytes: Buffer.from('x'), sha256: 'f'.repeat(64),
        fileName: 'm.xlsx', selectedSheets: ['S'], layout: {}, parserVersion: 't', engineVersion: 't',
        sourceSelection: { groups: [{ itemKey: 'g1', code: '1', name: 'Tin báo tội phạm', parentItemKey: null }] },
        fields: {
          create: [
            { sheetKey: 'S', address: 'C3', fieldKey: 'S!C3', label: 'Tin báo mới', type: 'NUM', aggregate: 'SUM', unit: 'tin', itemKey: 'k11', criterionCode: '1.1', parentItemKey: 'g1' },
            { sheetKey: 'S', address: 'C4', fieldKey: 'S!C4', label: 'Tin báo đã giải quyết', type: 'NUM', aggregate: 'SUM', unit: 'tin', itemKey: 'k12', criterionCode: '1.2', parentItemKey: 'g1' },
            { sheetKey: 'S', address: 'C10', fieldKey: 'S!C10', label: 'Số vụ khởi tố', type: 'NUM', aggregate: 'SUM', unit: 'vụ', itemKey: 'k2', criterionCode: '2' },
          ],
        },
      },
    });
    const period = async (periodKey: string) =>
      (
        await db.dynReportPeriod.create({
          data: {
            reportId: r.id, versionId: version.id, periodKey, startDate: new Date(`${periodKey}-01`), endDate: new Date(`${periodKey}-28`),
            opensAt: past, dueAt: future, scheduleSnapshot: {},
          },
        })
      ).id;
    const assign = async (periodId: string, teamId: string, name: string, state: 'SUBMITTED' | 'APPROVED', values: Record<string, string>, ownedFieldKeys?: string[]) => {
      const a = await db.dynReportAssignment.create({
        data: { periodId, teamId, teamSnapshot: { name }, ...(ownedFieldKeys ? { ownedFieldKeys } : {}) },
      });
      await db.dynReportSubmission.create({
        data: { assignmentId: a.id, state, currentRevision: 1, values: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { t: 'NUM', v }])) },
      });
      return a.id;
    };
    const october = await period('2026-10');
    const assignmentA = await assign(october, team.a, 'Tổ A', 'SUBMITTED', { 'S!C3': '11', 'S!C4': '12' }, ['S!C3', 'S!C4']);
    const assignmentB = await assign(october, team.b, 'Tổ B', 'APPROVED', { 'S!C3': '101', 'S!C4': '102', 'S!C10': '200' });
    const november = await period('2026-11');
    await assign(november, team.b, 'Tổ B', 'APPROVED', { 'S!C3': '7', 'S!C4': '8', 'S!C10': '9' });
    return { id: r.id, name: r.name, october, november, assignmentA, assignmentB };
  }

  const refusal = async (promise: Promise<unknown>) => {
    try {
      await promise;
      return null;
    } catch (err) {
      const e = err as { status?: number; response?: { code?: string; details?: string[] } };
      return { status: e.status, code: e.response?.code, ...(e.response?.details ? { unknown: e.response.details } : {}) };
    }
  };
  const auditOf = async (subjectId: string) =>
    db.auditLog.findMany({ where: { subjectId }, orderBy: { createdAt: 'asc' }, select: { action: true, userId: true, metadata: true } });

  beforeAll(async () => {
    const u = new URL(url!);
    if (u.hostname !== '127.0.0.1' || !['/pc02_dynamic_reports_test', '/pc02_goiy_scope_test'].includes(u.pathname)) {
      throw new Error('Refused: DYN_REPORTS_DATABASE_URL must point at a local scratch database');
    }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
    const audit = new AuditService(db as never);
    // The parts of the aggregate service used here (standing in a report, the order of teams, the stored export and
    // its download) read the database only; its other collaborators are not reached.
    aggregate = new AggregateService(db as never, {} as never, {} as never, {} as never, {} as never);
    views = new ReportViewsService(db as never, aggregate, audit);
    custom = new CustomReportService(db as never, aggregate, audit);
    lifecycle = new ReportLifecycleService(db as never, audit);

    roleId = (await db.role.create({ data: { name: `${tag}-role` } })).id;
    const user = async (name: string, lastName: string, firstName: string) => ({
      id: (await db.user.create({ data: { username: `${tag}-${name}`, passwordHash: 'x', roleId, lastName, firstName } })).id,
      roleId,
    });
    manager = await user('mgr', 'Nguyễn Văn', 'Quản');
    outsider = await user('out', 'Trần Thị', 'Ngoài');
    viewer = await user('view', 'Lê Văn', 'Xem');
    team.a = (await db.team.create({ data: { code: `${tag}-a`, name: `${tag} A`, order: 1 } })).id;
    team.b = (await db.team.create({ data: { code: `${tag}-b`, name: `${tag} B`, order: 2 } })).id;
    team.c = (await db.team.create({ data: { code: `${tag}-c`, name: `${tag} C`, order: 3 } })).id;
  });

  afterAll(async () => {
    // Through the product's own deletion (children first, views included), then what only this spec made.
    for (const id of reportIds) {
      const left = await db.dynReport.findUnique({ where: { id }, select: { code: true } });
      if (left) await lifecycle.deleteReport(id, { withData: true, confirmCode: left.code }, manager.id);
    }
    const userIds = [manager.id, outsider.id, viewer.id];
    await db.dynReportExport.deleteMany({ where: { requestedById: { in: userIds } } });
    await db.auditLog.deleteMany({ where: { userId: { in: userIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.role.deleteMany({ where: { id: roleId } });
    await db.team.deleteMany({ where: { id: { in: Object.values(team) } } });
    await db.$disconnect();
  });

  describe('saving', () => {
    it('a view is saved under its name with what was picked, and listed for the managers of the report', async () => {
      const r = await report();

      const made = await views.create(r.id, manager, { name: '  Gửi   cấp trên ', title: ' Báo cáo quý ', itemKeys: ['k2', 'k11'], teamIds: [team.b] });

      expect(made).toMatchObject({
        reportId: r.id,
        name: 'Gửi cấp trên',
        title: 'Báo cáo quý',
        showFilterLine: true,
        itemKeys: ['k11', 'k2'],
        teamIds: [team.b],
        teamColumns: true,
        revision: 1,
        archivedAt: null,
        createdBy: { id: manager.id, name: 'Nguyễn Văn Quản' },
        updatedBy: { id: manager.id, name: 'Nguyễn Văn Quản' },
      });
      expect(await views.list(r.id, manager, false)).toEqual([made]);
      // The audit row says who, what and how many; never a figure.
      expect(await auditOf(made.id)).toEqual([
        {
          action: 'DYN_REPORT_VIEW_CREATE',
          userId: manager.id,
          metadata: { reportId: r.id, name: 'Gửi cấp trên', criteria: 2, teams: 1, revision: 1 },
        },
      ]);
    });

    it('everything ticked is stored as "all" and comes back as null', async () => {
      const r = await report();
      const made = await views.create(r.id, manager, { name: 'Tất cả', itemKeys: ['k11', 'k12', 'k2'] });
      expect(made).toMatchObject({ itemKeys: null, teamIds: null, title: null });
      const stored = await db.dynReportView.findUniqueOrThrow({ where: { id: made.id } });
      expect([stored.itemKeys, stored.teamIds]).toEqual([null, null]);
    });

    it('refuses what cannot be a report: no name, nothing ticked, a criterion or a team that does not exist', async () => {
      const r = await report();
      expect(await refusal(views.create(r.id, manager, { name: ' ' }))).toEqual({ status: 400, code: 'VIEW_NAME_REQUIRED' });
      expect(await refusal(views.create(r.id, manager, { name: 'x'.repeat(121) }))).toEqual({ status: 400, code: 'VIEW_NAME_TOO_LONG' });
      expect(await refusal(views.create(r.id, manager, { name: 'A', title: 'x'.repeat(301) }))).toEqual({ status: 400, code: 'VIEW_TITLE_TOO_LONG' });
      expect(await refusal(views.create(r.id, manager, { name: 'A', itemKeys: [] }))).toEqual({ status: 400, code: 'VIEW_SELECTION_EMPTY' });
      expect(await refusal(views.create(r.id, manager, { name: 'A', teamIds: [] }))).toEqual({ status: 400, code: 'VIEW_TEAMS_EMPTY' });
      expect(await refusal(views.create(r.id, manager, { name: 'A', itemKeys: ['k2', 'zz'] }))).toEqual({
        status: 400, code: 'VIEW_ITEM_KEY_UNKNOWN', unknown: ['zz'],
      });
      expect(await refusal(views.create(r.id, manager, { name: 'A', teamIds: [team.a, 'no-such-team'] }))).toEqual({
        status: 400, code: 'VIEW_TEAM_UNKNOWN', unknown: ['no-such-team'],
      });
      expect(await db.dynReportView.count({ where: { reportId: r.id } })).toBe(0);
    });

    it('a team that exists but has no assignment now can be saved (it may get one in a later period)', async () => {
      const r = await report();
      const made = await views.create(r.id, manager, { name: 'Có tổ C', teamIds: [team.c, team.a] });
      expect(made.teamIds).toEqual([team.c, team.a]);
    });
  });

  describe('one name per report among the views in use', () => {
    it('a second view with the same name is refused; the same name in another report is not', async () => {
      const [r1, r2] = [await report(), await report()];
      await views.create(r1.id, manager, { name: 'Quý' });

      expect(await refusal(views.create(r1.id, manager, { name: ' Quý ' }))).toEqual({ status: 409, code: 'VIEW_NAME_TAKEN' });
      await expect(views.create(r2.id, manager, { name: 'Quý' })).resolves.toMatchObject({ name: 'Quý' });
      expect(await db.dynReportView.count({ where: { reportId: r1.id } })).toBe(1);
    });

    it('two people saving the same name at the same moment: exactly one is saved', async () => {
      const r = await report();

      const results = await Promise.allSettled(
        Array.from({ length: 4 }, () => views.create(r.id, manager, { name: 'Cùng lúc' })),
      );

      expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
      const refused = results.filter((x): x is PromiseRejectedResult => x.status === 'rejected');
      expect(refused.map((x) => (x.reason as { response?: { code?: string } }).response?.code)).toEqual([
        'VIEW_NAME_TAKEN', 'VIEW_NAME_TAKEN', 'VIEW_NAME_TAKEN',
      ]);
      expect(await db.dynReportView.count({ where: { reportId: r.id, name: 'Cùng lúc' } })).toBe(1);
    });
  });

  describe('editing', () => {
    it('changes what is sent and leaves the rest; the revision moves on and the editor is recorded', async () => {
      const r = await report();
      const made = await views.create(r.id, manager, { name: 'Cũ', title: 'Tiêu đề', itemKeys: ['k2'] });

      const renamed = await views.update(made.id, manager, { expectedRevision: 1, name: 'Mới' });
      expect(renamed).toMatchObject({ name: 'Mới', title: 'Tiêu đề', itemKeys: ['k2'], revision: 2 });

      const changed = await views.update(made.id, manager, {
        expectedRevision: 2, title: null, itemKeys: null, teamIds: [team.a], showFilterLine: false, teamColumns: false,
      });
      expect(changed).toMatchObject({
        name: 'Mới', title: null, itemKeys: null, teamIds: [team.a], showFilterLine: false, teamColumns: false, revision: 3,
      });
      expect((await auditOf(made.id)).map((a) => a.action)).toEqual([
        'DYN_REPORT_VIEW_CREATE', 'DYN_REPORT_VIEW_UPDATE', 'DYN_REPORT_VIEW_UPDATE',
      ]);
    });

    it('an edit made from an older revision is refused and changes nothing', async () => {
      const r = await report();
      const made = await views.create(r.id, manager, { name: 'A' });
      await views.update(made.id, manager, { expectedRevision: 1, name: 'B' });

      expect(await refusal(views.update(made.id, manager, { expectedRevision: 1, name: 'C' }))).toEqual({ status: 409, code: 'REVISION_CONFLICT' });

      expect(await db.dynReportView.findUniqueOrThrow({ where: { id: made.id } })).toMatchObject({ name: 'B', revision: 2 });
    });

    it('renaming onto a name in use is refused; the same checks as saving apply to what is changed', async () => {
      const r = await report();
      await views.create(r.id, manager, { name: 'Đã có' });
      const made = await views.create(r.id, manager, { name: 'Khác' });

      expect(await refusal(views.update(made.id, manager, { expectedRevision: 1, name: 'Đã có' }))).toEqual({ status: 409, code: 'VIEW_NAME_TAKEN' });
      expect(await refusal(views.update(made.id, manager, { expectedRevision: 1, itemKeys: [] }))).toEqual({ status: 400, code: 'VIEW_SELECTION_EMPTY' });
      expect(await refusal(views.update(made.id, manager, { expectedRevision: 1, itemKeys: ['zz'] }))).toEqual({
        status: 400, code: 'VIEW_ITEM_KEY_UNKNOWN', unknown: ['zz'],
      });
      // Saving it again under its own name is not "taken".
      await expect(views.update(made.id, manager, { expectedRevision: 1, name: 'Khác', title: 'T' })).resolves.toMatchObject({ revision: 2 });
    });
  });

  describe('archive, restore, delete', () => {
    it('an archived view leaves the working list and frees its name; it is still listed when asked for', async () => {
      const r = await report();
      const made = await views.create(r.id, manager, { name: 'Tên' });

      const archived = await views.archive(made.id, manager);

      expect(archived.archivedAt).not.toBeNull();
      expect(archived.revision).toBe(2);
      expect(await views.list(r.id, manager, false)).toEqual([]);
      expect((await views.list(r.id, manager, true)).map((v) => v.id)).toEqual([made.id]);
      const again = await views.create(r.id, manager, { name: 'Tên' });
      expect(again.id).not.toBe(made.id);
      expect(await refusal(views.archive(made.id, manager))).toEqual({ status: 409, code: 'VIEW_ALREADY_ARCHIVED' });
      // It is not edited while archived: restore it first.
      expect(await refusal(views.update(made.id, manager, { expectedRevision: 2, title: 'x' }))).toEqual({ status: 409, code: 'VIEW_ARCHIVED' });
    });

    it('restoring is refused while a view in use has the name, and works once the name is free', async () => {
      const r = await report();
      const first = await views.create(r.id, manager, { name: 'Tên' });
      await views.archive(first.id, manager);
      const second = await views.create(r.id, manager, { name: 'Tên' });

      expect(await refusal(views.restore(first.id, manager))).toEqual({ status: 409, code: 'VIEW_NAME_TAKEN' });
      expect((await db.dynReportView.findUniqueOrThrow({ where: { id: first.id } })).archivedAt).not.toBeNull();

      await views.remove(second.id, manager);
      const restored = await views.restore(first.id, manager);
      expect(restored).toMatchObject({ archivedAt: null, revision: 3 });
      expect(await refusal(views.restore(first.id, manager))).toEqual({ status: 409, code: 'VIEW_NOT_ARCHIVED' });
      expect((await auditOf(first.id)).map((a) => a.action)).toEqual([
        'DYN_REPORT_VIEW_CREATE', 'DYN_REPORT_VIEW_ARCHIVE', 'DYN_REPORT_VIEW_RESTORE',
      ]);
    });

    it('a view is deleted for good, in use or archived; a delete from an older revision is refused', async () => {
      const r = await report();
      const made = await views.create(r.id, manager, { name: 'Xoá' });
      await views.update(made.id, manager, { expectedRevision: 1, title: 'T' });

      expect(await refusal(views.remove(made.id, manager, 1))).toEqual({ status: 409, code: 'REVISION_CONFLICT' });
      expect(await views.remove(made.id, manager, 2)).toEqual({ deleted: true, id: made.id });

      expect(await db.dynReportView.count({ where: { id: made.id } })).toBe(0);
      expect(await refusal(views.remove(made.id, manager))).toEqual({ status: 404, code: 'VIEW_NOT_FOUND' });
      expect((await auditOf(made.id)).at(-1)).toMatchObject({ action: 'DYN_REPORT_VIEW_DELETE', metadata: { reportId: r.id, name: 'Xoá' } });
    });

    it('deleting the report removes its views first (the relation is Restrict) and leaves another report alone', async () => {
      const [doomed, kept] = [await report(), await report()];
      const inUse = await views.create(doomed.id, manager, { name: 'Đang dùng' });
      const archived = await views.create(doomed.id, manager, { name: 'Đã cất' });
      await views.archive(archived.id, manager);
      const other = await views.create(kept.id, manager, { name: 'Của báo cáo khác' });
      const code = (await db.dynReport.findUniqueOrThrow({ where: { id: doomed.id } })).code;

      await lifecycle.deleteReport(doomed.id, { withData: true, confirmCode: code }, manager.id);

      expect(await db.dynReport.count({ where: { id: doomed.id } })).toBe(0);
      expect(await db.dynReportView.count({ where: { id: { in: [inUse.id, archived.id] } } })).toBe(0);
      expect(await db.dynReportView.count({ where: { id: other.id } })).toBe(1);
    });
  });

  describe('who may', () => {
    it.each([
      ['somebody with no standing in the report', () => outsider],
      ['a viewer of the report', () => viewer],
    ])('%s is told it does not exist, on every operation, and nothing changes', async (_who, who) => {
      const r = await report();
      const made = await views.create(r.id, manager, { name: 'Của quản lý' });
      const user = who();

      const answers = [
        await refusal(views.list(r.id, user, true)),
        await refusal(views.create(r.id, user, { name: 'Lén' })),
        await refusal(views.update(made.id, user, { expectedRevision: 1, name: 'Lén' })),
        await refusal(views.archive(made.id, user)),
        await refusal(views.restore(made.id, user)),
        await refusal(views.remove(made.id, user)),
        await refusal(custom.preview(r.october, user, {})),
        await refusal(custom.export(r.october, user, {})),
      ];

      expect(answers.map((a) => a?.status)).toEqual([404, 404, 404, 404, 404, 404, 404, 404]);
      expect(await db.dynReportView.findMany({ where: { reportId: r.id }, select: { name: true, revision: true, archivedAt: true } })).toEqual([
        { name: 'Của quản lý', revision: 1, archivedAt: null },
      ]);
      expect(await db.dynReportExport.count({ where: { requestedById: user.id } })).toBe(0);
    });

    it('a report, a view or a period that does not exist answers the same way', async () => {
      expect((await refusal(views.list('no-such-report', manager, false)))?.status).toBe(404);
      expect((await refusal(views.create('no-such-report', manager, { name: 'A' })))?.status).toBe(404);
      expect((await refusal(views.update('no-such-view', manager, { expectedRevision: 1 })))?.status).toBe(404);
      expect((await refusal(custom.preview('no-such-period', manager, {})))?.status).toBe(404);
    });
  });

  describe('the report of a period', () => {
    const openFile = async (exportId: string) => {
      const { fileBytes, fileName } = await aggregate.getExportForDownload(exportId, manager.id, manager.roleId);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(fileBytes as never);
      const sheet = workbook.worksheets[0];
      const row = (r: number, width: number) => Array.from({ length: width }, (_, i) => sheet.getRow(r).getCell(i + 1).value ?? null);
      return { fileName, sheet, row, sheets: workbook.worksheets.length };
    };

    it('nothing unticked: every criterion and every team, with the totals of the period (A submitted + B approved)', async () => {
      const r = await report();

      const summary = await custom.preview(r.october, manager, {});

      expect(summary.title).toBe(`${r.name} — kỳ 2026-10`);
      expect(summary.mode).toBe('SUBMITTED');
      expect(summary.columns.map((c) => c.label)).toEqual(['Mã', 'Tiêu chí', 'ĐVT', 'Tổng', 'Tổ A', 'Tổ B']);
      expect(summary.rows.map((x) => [x.kind, x.code, x.total, x.cells.map((c) => c.mark ?? c.value)])).toEqual([
        ['GROUP', '1', '226', ['23', '203']],
        ['CRITERION', '1.1', '112', ['11', '101']],
        ['CRITERION', '1.2', '114', ['12', '102']],
        ['CRITERION', '2', '200', ['NOT_ASSIGNED', '200']],
      ]);
      // The same figures the aggregate screen of the period shows.
      const screen = await aggregate.getPeriodSummary(r.october, manager.id, manager.roleId, 'SUBMITTED');
      expect(summary.rows.filter((x) => x.kind === 'CRITERION').map((x) => x.total)).toEqual(
        ['S!C3', 'S!C4', 'S!C10'].map((key) => screen.fields.find((f) => f.fieldKey === key)?.value),
      );
    });

    it('the file holds exactly what the preview of the same request shows, and is stored like any export of the period', async () => {
      const r = await report();
      const request = { definition: { title: 'Gửi Bộ', itemKeys: ['k11', 'k2'], teamIds: [team.a, team.b] }, mode: 'APPROVED' as const };

      const summary = await custom.preview(r.october, manager, request);
      const before = Date.now();
      const made = await custom.export(r.october, manager, request);

      // Approved only: Tổ A (submitted) is not counted.
      expect(summary.rows.map((x) => [x.code, x.total])).toEqual([['1', '203'], ['1.1', '101'], ['2', '200']]);
      const stored = await db.dynReportExport.findUniqueOrThrow({ where: { id: made.exportId } });
      expect(stored).toMatchObject({
        kind: 'MANAGER_CUSTOM',
        status: 'READY',
        requestedById: manager.id,
        fileName: made.fileName,
        scope: { periodId: r.october, reportId: r.id, viewId: null, mode: 'APPROVED', teamIds: [team.a, team.b] },
      });
      const ttl = (stored.expiresAt as Date).getTime() - before;
      expect(ttl).toBeGreaterThan(23.9 * 3600_000);
      expect(ttl).toBeLessThan(24.1 * 3600_000);
      expect(made.fileName).toBe('Gửi-Bộ-2026-10.xlsx');

      const file = await openFile(made.exportId);
      expect(file.fileName).toBe(made.fileName);
      expect(file.sheets).toBe(1);
      expect(file.sheet.getCell('A1').value).toBe(summary.title);
      expect(file.sheet.getCell('A2').value).toBe(summary.filterLine);
      expect(file.row(CUSTOM_HEADER_ROW, 6)).toEqual(summary.columns.map((c) => c.label));
      const shown = (cell: { value: string | null; mark: string | null }) =>
        cell.mark === 'NOT_ASSIGNED' ? '—' : cell.mark === 'NOT_COUNTED' ? 'chưa duyệt' : cell.value === null ? null : Number(cell.value);
      summary.rows.forEach((x, i) => {
        expect(file.row(CUSTOM_HEADER_ROW + 1 + i, 6)).toEqual([
          x.code ?? '', x.label, x.unit ?? '', x.total === null ? null : Number(x.total), ...x.cells.map(shown),
        ]);
      });
      // And by hand: the heading keeps 1.2 (not listed) in its number.
      expect(file.row(CUSTOM_HEADER_ROW + 1, 6)).toEqual(['1', 'Tin báo tội phạm', '', 203, 'chưa duyệt', 203]);
      expect(file.row(CUSTOM_HEADER_ROW + 3, 6)).toEqual(['2', 'Số vụ khởi tố', 'vụ', 200, '—', 200]);

      expect(await db.auditLog.findMany({ where: { subjectId: made.exportId }, select: { action: true, userId: true, metadata: true } })).toEqual([
        {
          action: 'DYN_REPORT_VIEW_EXPORT',
          userId: manager.id,
          metadata: {
            reportId: r.id, periodId: r.october, periodKey: '2026-10', viewId: null, viewName: null, mode: 'APPROVED',
            criteria: 2, teams: 2, fileName: made.fileName,
          },
        },
      ]);
    });

    it('a saved view is used on another period: a team with no assignment there is left out and said', async () => {
      const r = await report();
      const view = await views.create(r.id, manager, { name: 'Hai tổ', itemKeys: ['k11', 'k2'], teamIds: [team.a, team.b] });

      const october = await custom.preview(r.october, manager, { viewId: view.id });
      const november = await custom.preview(r.november, manager, { viewId: view.id });

      expect(october.rows.map((x) => [x.code, x.total])).toEqual([['1', '226'], ['1.1', '112'], ['2', '200']]);
      expect(october.ignored.teamIds).toEqual([]);
      expect(november.title).toBe(`${r.name} — kỳ 2026-11`);
      expect(november.rows.map((x) => [x.code, x.total])).toEqual([['1', '15'], ['1.1', '7'], ['2', '9']]);
      expect(november.teams).toEqual([{ teamId: team.b, name: 'Tổ B' }]);
      expect(november.ignored.teams).toEqual([{ teamId: team.a, name: `${tag} A` }]);

      const made = await custom.export(r.november, manager, { viewId: view.id });
      expect(made.fileName).toBe('Hai-tổ-2026-11.xlsx');
      expect((await db.dynReportExport.findUniqueOrThrow({ where: { id: made.exportId } })).scope).toMatchObject({ viewId: view.id, teamIds: [team.b] });
    });

    it('a criterion added to the report after the view was saved is counted as new; a view of another report is not found', async () => {
      const [r, other] = [await report(), await report()];
      const view = await views.create(r.id, manager, { name: 'Một tiêu chí', itemKeys: ['k11'] });
      const versionId = (await db.dynReportPeriod.findUniqueOrThrow({ where: { id: r.november } })).versionId;
      await db.dynReportField.create({
        data: { versionId, sheetKey: 'S', address: 'C11', fieldKey: 'S!C11', label: 'Số bị can', type: 'NUM', aggregate: 'SUM', itemKey: 'k3', criterionCode: '3' },
      });

      const summary = await custom.preview(r.november, manager, { viewId: view.id });

      expect(summary.newCriteria).toBe(1);
      expect(summary.counts.criteria).toEqual({ selected: 1, total: 4 });
      expect(await refusal(custom.preview(other.october, manager, { viewId: view.id }))).toEqual({ status: 404, code: 'VIEW_NOT_FOUND' });
    });

    it('nothing ticked can neither be previewed nor exported', async () => {
      const r = await report();
      expect(await refusal(custom.preview(r.october, manager, { definition: { itemKeys: [] } }))).toEqual({ status: 400, code: 'VIEW_SELECTION_EMPTY' });
      expect(await refusal(custom.export(r.october, manager, { definition: { teamIds: [] } }))).toEqual({ status: 400, code: 'VIEW_TEAMS_EMPTY' });
      // Only teams that are not in the period: nothing is left to report.
      expect(await refusal(custom.export(r.october, manager, { definition: { teamIds: [team.c] } }))).toEqual({ status: 400, code: 'VIEW_TEAMS_EMPTY' });
      expect(await db.dynReportExport.count({ where: { scope: { path: ['periodId'], equals: r.october } } })).toBe(0);
    });

    it('a closed period always reports its approved figures, whatever mode is asked for', async () => {
      const r = await report();
      await db.dynReportPeriod.update({ where: { id: r.october }, data: { status: 'FINALIZED', finalizedAt: new Date() } });

      const summary = await custom.preview(r.october, manager, { mode: 'ALL_SAVED' });

      expect(summary.mode).toBe('APPROVED');
      expect(summary.periodStatus).toBe('FINALIZED');
      expect(summary.rows.map((x) => x.total)).toEqual(['203', '101', '102', '200']);
      expect(summary.notes).toEqual([]);
    });

    it('the file is refused at download once a team IT WAS MADE FROM no longer counts; a change in a team left out does not touch it', async () => {
      const r = await report();
      const onlyB = await custom.export(r.october, manager, { definition: { teamIds: [team.b] } });
      const both = await custom.export(r.october, manager, {});
      // A file of SOME teams is judged by those teams: Tổ A counts in the period, and is simply not part of `onlyB`.
      await expect(aggregate.getExportForDownload(onlyB.exportId, manager.id, manager.roleId)).resolves.toMatchObject({ fileName: onlyB.fileName });
      await expect(aggregate.getExportForDownload(both.exportId, manager.id, manager.roleId)).resolves.toMatchObject({ fileName: both.fileName });

      // Tổ A is exempted: it was in `both`, not in `onlyB`.
      await db.dynReportAssignment.update({ where: { id: r.assignmentA }, data: { obligation: 'EXEMPT' } });

      await expect(aggregate.getExportForDownload(onlyB.exportId, manager.id, manager.roleId)).resolves.toMatchObject({ fileName: onlyB.fileName });
      await expect(aggregate.getExportForDownload(both.exportId, manager.id, manager.roleId)).rejects.toMatchObject({ code: 'CELL_VALIDATION' });
    });
  });
});
