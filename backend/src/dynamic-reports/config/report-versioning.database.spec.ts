import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'node:crypto';
import { ReportVersioningService } from './report-versioning.service';
import { ReportConfigService } from './report-config.service';
import type { SaveReportVersionDto } from './dto/save-report-version.dto';

/**
 * "Cập nhật mẫu" (a new version of a report's template) — checked on a REAL PostgreSQL.
 *
 * D09 is a rule about rows: which open periods move to the new version and which stay. A fake Prisma can only
 * echo what the service asked for; here the question is what is left in the tables — which period points at
 * which version, which snapshots were invalidated, whether the previous version was retired, and what a delete
 * refuses to touch.
 *
 * Runs only when DYN_REPORTS_DATABASE_URL points at a scratch database (see grid-access.database.spec.ts).
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

run('ReportVersioningService on PostgreSQL', () => {
  let db: PrismaClient;
  let svc: ReportVersioningService;
  const tag = `rv-${randomUUID().slice(0, 8)}`;
  let userId = '';
  let teamId = '';
  const past = new Date('2020-01-01T00:00:00Z');
  const future = new Date('2099-01-01T00:00:00Z');

  const FILE = Buffer.from('new template bytes');

  function input(over: Partial<SaveReportVersionDto> = {}): SaveReportVersionDto {
    return {
      selectedSheets: ['S'],
      dateSystem: '1900',
      fields: [
        { sheetKey: 'S', address: 'C3', fieldKey: 'S!C3', label: 'Số vụ', type: 'NUM', aggregate: 'SUM', source: 'WEB' },
        { sheetKey: 'S', address: 'D3', fieldKey: 'S!D3', label: 'Ghi chú', type: 'TEXT', aggregate: 'NONE', source: 'WEB' },
      ],
      layout: {},
      formulas: [],
      rules: [{ name: 'r', leftExpr: 'A', operator: 'GTE', rightExpr: 'B', severity: 'ERROR', message: 'm' }],
      publish: true,
      idempotencyKey: randomUUID(),
      ...over,
    };
  }

  /** A published report with one version, and one period per entry of `periods`. */
  async function buildReport(
    name: string,
    periods: Array<{ key: string; status?: 'OPEN' | 'FINALIZED'; touched?: boolean }>,
    reportStatus: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' = 'PUBLISHED',
  ) {
    const report = await db.dynReport.create({ data: { code: `${tag}-${name}`, name: `${tag} ${name}`, status: reportStatus } });
    const v1 = await db.dynReportVersion.create({
      data: {
        reportId: report.id,
        version: 1,
        status: reportStatus === 'DRAFT' ? 'DRAFT' : 'PUBLISHED',
        fileBytes: Buffer.from('old'),
        sha256: 'f'.repeat(64),
        fileName: 'old.xlsx',
        selectedSheets: ['S'],
        layout: {},
        parserVersion: 't',
        engineVersion: 't',
      },
    });
    await db.dynReportSchedule.create({
      data: { reportId: report.id, periodType: 'MONTHLY', dueRule: {}, openRule: {}, effectiveFrom: past },
    });
    await db.dynReportRole.create({ data: { reportId: report.id, userId, role: 'MANAGER' } });
    const target = await db.dynReportTarget.create({ data: { reportId: report.id, teamId } });
    await db.dynReportTargetEditor.create({ data: { targetId: target.id, userId } });

    const periodIds: Record<string, string> = {};
    let day = 1;
    for (const p of periods) {
      const period = await db.dynReportPeriod.create({
        data: {
          reportId: report.id,
          periodKey: `${tag}-${name}-${p.key}`,
          startDate: new Date(`2026-${String(day).padStart(2, '0')}-01`),
          endDate: new Date(`2026-${String(day).padStart(2, '0')}-28`),
          opensAt: past,
          dueAt: future,
          versionId: v1.id,
          scheduleSnapshot: {},
          status: p.status ?? 'OPEN',
        },
      });
      day++;
      periodIds[p.key] = period.id;
      const assignment = await db.dynReportAssignment.create({ data: { periodId: period.id, teamId, teamSnapshot: {} } });
      await db.dynReportSubmission.create({
        data: {
          assignmentId: assignment.id,
          state: p.touched ? 'DRAFT' : 'NOT_STARTED',
          currentRevision: p.touched ? 1 : 0,
          values: p.touched ? { 'S!C3': { t: 'NUM', v: '5' } } : {},
        },
      });
      await db.dynReportSnapshot.create({
        data: { periodId: period.id, mode: 'SUBMITTED', sourceHash: 'h', sourceRevisions: {}, contributorSetHash: 'c', values: {}, engineVersion: 't', asOf: past },
      });
    }
    return { reportId: report.id, v1: v1.id, periodIds };
  }

  beforeAll(async () => {
    const u = new URL(url!);
    if (u.hostname !== '127.0.0.1' || !['/pc02_dynamic_reports_test', '/pc02_goiy_scope_test'].includes(u.pathname)) {
      throw new Error('Từ chối: DYN_REPORTS_DATABASE_URL phải trỏ 127.0.0.1/pc02_dynamic_reports_test hoặc pc02_goiy_scope_test');
    }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
    const config = new ReportConfigService(db as never);
    // The file checks run a worker over a real workbook; what is under test here is the rows, not the parser.
    jest.spyOn(config, 'assertNoBlockingFeatureIssues').mockResolvedValue(undefined);
    jest.spyOn(config, 'reconcileWithFile').mockResolvedValue({
      layout: { sheetOrder: ['S'] },
      formulas: [],
      dataValidations: [],
    } as never);
    svc = new ReportVersioningService(db as never, config);

    const role = await db.role.create({ data: { name: `${tag}-role` } });
    userId = (await db.user.create({ data: { username: `${tag}-u`, passwordHash: 'x', roleId: role.id } })).id;
    teamId = (await db.team.create({ data: { code: `${tag}-T`, name: `${tag}-T` } })).id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('numbers the new version after the last, retires the previous published one, stores fields and rules', async () => {
    const { reportId, v1 } = await buildReport('basic', []);

    const out = await svc.createVersion(reportId, input(), FILE, 'new.xlsx', userId);

    expect(out).toMatchObject({ version: 2, status: 'PUBLISHED' });
    expect((await db.dynReportVersion.findUnique({ where: { id: v1 } }))?.status).toBe('RETIRED');
    const v2 = await db.dynReportVersion.findUnique({ where: { id: out.versionId }, include: { fields: true, rules: true } });
    expect(v2?.status).toBe('PUBLISHED');
    expect(v2?.fileName).toBe('new.xlsx');
    expect(v2?.fields.map((f) => f.fieldKey).sort()).toEqual(['S!C3', 'S!D3']);
    expect(v2?.rules).toHaveLength(1);
    expect((await db.dynReport.findUnique({ where: { id: reportId } }))?.configVersion).toBe(1);
  });

  it('D09: an open period nobody entered anything in moves to the new version at once, and its summary is invalidated', async () => {
    const { reportId, periodIds } = await buildReport('d09-empty', [{ key: 'A' }]);

    const out = await svc.createVersion(reportId, input(), FILE, 'new.xlsx', userId);

    expect((await db.dynReportPeriod.findUnique({ where: { id: periodIds.A } }))?.versionId).toBe(out.versionId);
    expect(out.appliedToPeriods).toEqual([`${tag}-d09-empty-A`]);
    const snap = await db.dynReportSnapshot.findFirst({ where: { periodId: periodIds.A } });
    expect(snap?.invalidatedAt).not.toBeNull();
    expect(snap?.invalidatedReason).toBe('TEMPLATE_VERSION_CHANGED');
  });

  it('D09: a period where a team has typed keeps the version its figures were entered against', async () => {
    const { reportId, v1, periodIds } = await buildReport('d09-touched', [{ key: 'A', touched: true }]);

    const out = await svc.createVersion(reportId, input(), FILE, 'new.xlsx', userId);

    expect((await db.dynReportPeriod.findUnique({ where: { id: periodIds.A } }))?.versionId).toBe(v1);
    expect(out.keptOnOldVersionPeriods).toEqual([`${tag}-d09-touched-A`]);
    expect(out.appliedToPeriods).toEqual([]);
    expect((await db.dynReportSnapshot.findFirst({ where: { periodId: periodIds.A } }))?.invalidatedAt).toBeNull();
  });

  it('a closed period is never touched, empty or not', async () => {
    const { reportId, v1, periodIds } = await buildReport('d09-closed', [{ key: 'A', status: 'FINALIZED' }]);

    const out = await svc.createVersion(reportId, input(), FILE, 'new.xlsx', userId);

    expect((await db.dynReportPeriod.findUnique({ where: { id: periodIds.A } }))?.versionId).toBe(v1);
    expect(out.appliedToPeriods).toEqual([]);
    expect(out.keptOnOldVersionPeriods).toEqual([]);
  });

  it('mixed periods are split period by period', async () => {
    const { reportId, periodIds } = await buildReport('d09-mixed', [{ key: 'A', touched: true }, { key: 'B' }]);

    const out = await svc.createVersion(reportId, input(), FILE, 'new.xlsx', userId);

    expect(out.keptOnOldVersionPeriods).toEqual([`${tag}-d09-mixed-A`]);
    expect(out.appliedToPeriods).toEqual([`${tag}-d09-mixed-B`]);
    expect((await db.dynReportPeriod.findUnique({ where: { id: periodIds.B } }))?.versionId).toBe(out.versionId);
  });

  it('a draft changes nothing that is live: no retiring, no period moves', async () => {
    const { reportId, v1, periodIds } = await buildReport('draft', [{ key: 'A' }]);

    const out = await svc.createVersion(reportId, input({ publish: false }), FILE, 'new.xlsx', userId);

    expect(out.status).toBe('DRAFT');
    expect((await db.dynReportVersion.findUnique({ where: { id: v1 } }))?.status).toBe('PUBLISHED');
    expect((await db.dynReportPeriod.findUnique({ where: { id: periodIds.A } }))?.versionId).toBe(v1);
  });

  it('publishing the first version of a DRAFT report makes the report live', async () => {
    const { reportId } = await buildReport('first', [], 'DRAFT');

    await svc.createVersion(reportId, input(), FILE, 'new.xlsx', userId);

    expect((await db.dynReport.findUnique({ where: { id: reportId } }))?.status).toBe('PUBLISHED');
  });

  it('a DRAFT report that is not ready (no schedule) cannot be made live by a version', async () => {
    const { reportId } = await buildReport('notready', [], 'DRAFT');
    await db.dynReportSchedule.deleteMany({ where: { reportId } });

    await expect(svc.createVersion(reportId, input(), FILE, 'new.xlsx', userId)).rejects.toMatchObject({ code: 'TEMPLATE_INVALID' });
    expect(await db.dynReportVersion.count({ where: { reportId } })).toBe(1);
  });

  it('an archived report must be restored first', async () => {
    const { reportId } = await buildReport('arch', [], 'ARCHIVED');
    await expect(svc.createVersion(reportId, input(), FILE, 'new.xlsx', userId)).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });

  it('the same idempotency key returns the same result and creates nothing twice; another body under that key is refused', async () => {
    const { reportId } = await buildReport('idem', []);
    const body = input();

    const first = await svc.createVersion(reportId, body, FILE, 'new.xlsx', userId);
    const again = await svc.createVersion(reportId, body, FILE, 'new.xlsx', userId);

    expect(again).toEqual(first);
    expect(await db.dynReportVersion.count({ where: { reportId } })).toBe(2);
    await expect(
      svc.createVersion(reportId, { ...body, selectedSheets: ['Other'] }, FILE, 'new.xlsx', userId),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_MISMATCH' });
  });

  describe('deleteVersion', () => {
    it('removes a draft', async () => {
      const { reportId } = await buildReport('del-draft', []);
      const draft = await svc.createVersion(reportId, input({ publish: false }), FILE, 'd.xlsx', userId);

      await expect(svc.deleteVersion(reportId, draft.versionId)).resolves.toEqual({ deleted: true });
      expect(await db.dynReportVersion.count({ where: { id: draft.versionId } })).toBe(0);
    });

    it('refuses the version the report currently runs on', async () => {
      const { reportId, v1 } = await buildReport('del-current', []);
      await expect(svc.deleteVersion(reportId, v1)).rejects.toMatchObject({ code: 'VERSION_CURRENT' });
    });

    it('refuses a retired version a period still points at, and allows one nothing points at', async () => {
      const { reportId, v1 } = await buildReport('del-used', [{ key: 'A', touched: true }]);
      const v2 = await svc.createVersion(reportId, input(), FILE, 'n.xlsx', userId);

      await expect(svc.deleteVersion(reportId, v1)).rejects.toMatchObject({ code: 'VERSION_IN_USE' });
      expect(await db.dynReportVersion.count({ where: { id: v1 } })).toBe(1);

      const v3 = await svc.createVersion(reportId, input(), FILE, 'n3.xlsx', userId);
      // v2 was retired by v3 and no period was ever generated from it.
      await expect(svc.deleteVersion(reportId, v2.versionId)).resolves.toEqual({ deleted: true });
      expect(v3.version).toBe(3);
    });

    it('a version of another report is not found', async () => {
      const a = await buildReport('del-a', []);
      const b = await buildReport('del-b', []);
      await expect(svc.deleteVersion(a.reportId, b.v1)).rejects.toMatchObject({ code: 'REPORT_NOT_FOUND' });
    });
  });
});
