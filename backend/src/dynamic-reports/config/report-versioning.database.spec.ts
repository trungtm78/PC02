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

  it('D09 race: a save that is still open when the version is published is not overwritten — its period stays on the old version (found by Codex)', async () => {
    const { reportId, v1, periodIds } = await buildReport('race-d09', [{ key: 'A' }]); // nobody has typed yet

    // An editor saving: it holds the period FOR SHARE, writes the submission and is still open for a moment.
    const save = db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM dyn_report_periods WHERE "reportId" = ${reportId} FOR SHARE`;
      await tx.dynReportSubmission.updateMany({
        where: { assignment: { period: { reportId } } },
        data: { state: 'DRAFT', currentRevision: 1 },
      });
      await new Promise((resolve) => setTimeout(resolve, 700));
    });
    await new Promise((resolve) => setTimeout(resolve, 200)); // let the save take its locks first

    const out = await svc.createVersion(reportId, input(), FILE, 'new.xlsx', userId);
    await save;

    expect((await db.dynReportPeriod.findUnique({ where: { id: periodIds.A } }))?.versionId).toBe(v1);
    expect(out.keptOnOldVersionPeriods).toEqual([`${tag}-race-d09-A`]);
    expect(out.appliedToPeriods).toEqual([]);
  });

  it('two overlapping requests with the same idempotency key create ONE version and give the same answer (found by Codex)', async () => {
    const { reportId } = await buildReport('race-idem', [{ key: 'A' }]);
    const body = input();

    const [a, b] = await Promise.all([
      svc.createVersion(reportId, body, FILE, 'new.xlsx', userId),
      svc.createVersion(reportId, body, FILE, 'new.xlsx', userId),
    ]);

    expect(b).toEqual(a);
    expect(await db.dynReportVersion.count({ where: { reportId } })).toBe(2);
    expect(await db.dynReportVersion.count({ where: { reportId, status: 'PUBLISHED' } })).toBe(1);
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

  describe('publishDraft — a report saved only as a draft goes live', () => {
    /** A draft report as the wizard's "Lưu nháp" leaves it: draft version with its cells, schedule, manager, team and editor. */
    async function buildDraft(name: string, opts: { fields?: boolean } = {}) {
      const built = await buildReport(name, [], 'DRAFT');
      await db.dynReportSchedule.updateMany({
        where: { reportId: built.reportId },
        data: { dueRule: { kind: 'DAYS_AFTER_END', days: 5, time: '17:00' }, openRule: { kind: 'AT_PERIOD_START' } },
      });
      if (opts.fields !== false) {
        await db.dynReportField.createMany({
          data: [
            { versionId: built.v1, sheetKey: 'S', address: 'C3', fieldKey: 'S!C3', label: 'Số vụ', type: 'NUM', aggregate: 'SUM', source: 'WEB', required: true },
            { versionId: built.v1, sheetKey: 'S', address: 'D3', fieldKey: 'S!D3', label: 'Ghi chú', type: 'TEXT', aggregate: 'NONE', source: 'WEB' },
          ],
        });
      }
      return built;
    }
    const reportOf = (id: string) => db.dynReport.findUniqueOrThrow({ where: { id } });
    const versionOf = (id: string) => db.dynReportVersion.findUniqueOrThrow({ where: { id } });
    const configOf = () => (svc as unknown as { configService: ReportConfigService }).configService;

    it('publishes the stored configuration as it is: the report and its version go live, the cells are kept', async () => {
      const { reportId, v1 } = await buildDraft('pd-ok');
      const before = await reportOf(reportId);

      const out = await svc.publishDraft(reportId);

      expect(out).toMatchObject({ reportId, versionId: v1, version: 1, status: 'PUBLISHED' });
      const report = await reportOf(reportId);
      expect(report.status).toBe('PUBLISHED');
      expect(report.configVersion).toBe(before.configVersion + 1);
      const version = await versionOf(v1);
      expect(version.status).toBe('PUBLISHED');
      expect(version.publishedAt).not.toBeNull();
      expect(version.layout).toMatchObject({ layout: { sheetOrder: ['S'] } }); // what the file says, not the wizard's copy
      const fields = await db.dynReportField.findMany({ where: { versionId: v1 }, orderBy: { address: 'asc' } });
      expect(fields.map((f) => [f.fieldKey, f.type, f.required])).toEqual([
        ['S!C3', 'NUM', true],
        ['S!D3', 'TEXT', false],
      ]);
    });

    it('the newest draft is the one published; an older draft stays a draft', async () => {
      const { reportId, v1 } = await buildDraft('pd-two');
      const second = await svc.createVersion(reportId, input({ publish: false }), FILE, 'v2.xlsx', userId);

      const out = await svc.publishDraft(reportId);

      expect(out.versionId).toBe(second.versionId);
      expect((await versionOf(second.versionId)).status).toBe('PUBLISHED');
      expect((await versionOf(v1)).status).toBe('DRAFT');
    });

    it('the schedule starts when the report goes live, not when the draft was saved (no backlog of past periods); a future start is kept', async () => {
      const old = await buildDraft('pd-old'); // buildReport saved its schedule with effectiveFrom 2020
      const t0 = Date.now();
      await svc.publishDraft(old.reportId);
      const sched = await db.dynReportSchedule.findFirstOrThrow({ where: { reportId: old.reportId } });
      expect(sched.effectiveFrom.getTime()).toBeGreaterThanOrEqual(t0 - 1000);
      expect(((await reportOf(old.reportId)).effectiveFrom ?? new Date(0)).getTime()).toBeGreaterThanOrEqual(t0 - 1000);

      const later = await buildDraft('pd-future');
      await db.dynReportSchedule.updateMany({ where: { reportId: later.reportId }, data: { effectiveFrom: future } });
      await svc.publishDraft(later.reportId);
      expect((await db.dynReportSchedule.findFirstOrThrow({ where: { reportId: later.reportId } })).effectiveFrom.toISOString()).toBe(future.toISOString());
    });

    it('a newer draft version saved while the file was being checked is not left behind: REVISION_CONFLICT, nothing goes live (found by Codex)', async () => {
      const { reportId, v1 } = await buildDraft('pd-newer');
      jest.spyOn(configOf(), 'reconcileWithFile').mockImplementationOnce(async () => {
        await svc.createVersion(reportId, input({ publish: false }), FILE, 'v2.xlsx', userId); // "Cập nhật mẫu" + Lưu nháp lands now
        return { layout: { sheetOrder: ['S'] }, formulas: [], dataValidations: [] } as never;
      });
      await expect(svc.publishDraft(reportId)).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });
      expect((await reportOf(reportId)).status).toBe('DRAFT');
      expect((await versionOf(v1)).status).toBe('DRAFT');
    });

    it('a report that is already published is refused and nothing changes', async () => {
      const { reportId, v1 } = await buildReport('pd-live', []);
      await expect(svc.publishDraft(reportId)).rejects.toMatchObject({ code: 'INVALID_STATE' });
      expect((await versionOf(v1)).status).toBe('PUBLISHED');
    });

    it('an archived or missing report is refused', async () => {
      const { reportId } = await buildReport('pd-arch', [], 'ARCHIVED');
      await expect(svc.publishDraft(reportId)).rejects.toMatchObject({ code: 'INVALID_STATE' });
      await expect(svc.publishDraft('does-not-exist')).rejects.toMatchObject({ code: 'REPORT_NOT_FOUND' });
    });

    it('what a publish from the wizard would need is needed here too: cells, a manager, a team with an editor, a schedule', async () => {
      const noFields = await buildDraft('pd-nofields', { fields: false });
      await expect(svc.publishDraft(noFields.reportId)).rejects.toMatchObject({ code: 'TEMPLATE_INVALID' });

      const noManager = await buildDraft('pd-nomgr');
      await db.dynReportRole.deleteMany({ where: { reportId: noManager.reportId } });
      await expect(svc.publishDraft(noManager.reportId)).rejects.toThrow(/quản lý/);

      const noEditor = await buildDraft('pd-noeditor');
      await db.dynReportTargetEditor.deleteMany({ where: { target: { reportId: noEditor.reportId } } });
      await expect(svc.publishDraft(noEditor.reportId)).rejects.toThrow(/người nhập/);

      const noSchedule = await buildDraft('pd-nosched');
      await db.dynReportSchedule.deleteMany({ where: { reportId: noSchedule.reportId } });
      await expect(svc.publishDraft(noSchedule.reportId)).rejects.toThrow(/lịch/);

      for (const r of [noFields, noManager, noEditor, noSchedule]) {
        expect((await reportOf(r.reportId)).status).toBe('DRAFT'); // a refusal leaves the draft as it was
        expect((await versionOf(r.v1)).status).toBe('DRAFT');
      }
    });

    it('a draft whose template file disagrees with the stored cells is refused (the file is the fact)', async () => {
      const { reportId, v1 } = await buildDraft('pd-mismatch');
      const spy = jest.spyOn(configOf(), 'reconcileWithFile').mockRejectedValueOnce(
        Object.assign(new Error('Danh sách ô nhập không khớp file mẫu'), { code: 'TEMPLATE_INVALID' }),
      );
      await expect(svc.publishDraft(reportId)).rejects.toThrow(/không khớp/);
      expect((await reportOf(reportId)).status).toBe('DRAFT');
      expect((await versionOf(v1)).status).toBe('DRAFT');
    });

    it('an edit saved while the file was being checked is not overwritten: REVISION_CONFLICT, still a draft', async () => {
      const { reportId } = await buildDraft('pd-race');
      const spy = jest.spyOn(configOf(), 'reconcileWithFile').mockImplementationOnce(async () => {
        await db.dynReport.update({ where: { id: reportId }, data: { configVersion: { increment: 1 } } }); // "Sửa cấu hình" lands now
        return { layout: { sheetOrder: ['S'] }, formulas: [], dataValidations: [] } as never;
      });
      await expect(svc.publishDraft(reportId)).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });
      expect((await reportOf(reportId)).status).toBe('DRAFT');
    });

    it('two publishes at once: one wins, the other is told it is no longer a draft', async () => {
      const { reportId } = await buildDraft('pd-twice');
      const results = await Promise.allSettled([svc.publishDraft(reportId), svc.publishDraft(reportId)]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const lost = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
      expect(['INVALID_STATE', 'REVISION_CONFLICT']).toContain(lost.reason.code);
      expect((await reportOf(reportId)).status).toBe('PUBLISHED');
    });
  });
});
