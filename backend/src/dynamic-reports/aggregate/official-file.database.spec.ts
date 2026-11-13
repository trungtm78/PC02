import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as ExcelJS from 'exceljs';
import { randomUUID } from 'node:crypto';
import { OfficialFileService } from './official-file.service';

/**
 * The file a closed period is kept as, on a REAL PostgreSQL: what is stored, what supersedes what, who may take it.
 * Runs only when DYN_REPORTS_DATABASE_URL points at a scratch database (see grid-access.database.spec.ts).
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

run('OfficialFileService on PostgreSQL', () => {
  let db: PrismaClient;
  let svc: OfficialFileService;
  const role = { current: { role: 'MANAGER', teamScopeId: null } as { role: string; teamScopeId: string | null } | null };
  const aggregate = { accessRoleFor: jest.fn(async () => role.current) };
  const tag = `of-${randomUUID().slice(0, 8)}`;
  let n = 0;
  let t1 = '';
  let t2 = '';

  /** A period with two teams: T1 reports both criteria, T2 only the first. Both approved unless told otherwise. */
  async function period(status: 'OPEN' | 'FINALIZED' = 'FINALIZED') {
    n += 1;
    const report = await db.dynReport.create({ data: { code: `${tag}-${n}`, name: `${tag} báo cáo`, status: 'PUBLISHED' } });
    const version = await db.dynReportVersion.create({
      data: {
        reportId: report.id, version: 1, status: 'PUBLISHED', fileBytes: Buffer.from('x'), sha256: 'f'.repeat(64),
        fileName: 'm.xlsx', selectedSheets: ['S'], layout: {}, parserVersion: 't', engineVersion: 't',
        fields: {
          create: [
            { sheetKey: 'S', address: 'C2', fieldKey: 'S!C2', label: 'Số tin báo mới', type: 'NUM', aggregate: 'SUM', unit: 'tin', criterionCode: '1.1' },
            { sheetKey: 'S', address: 'C10', fieldKey: 'S!C10', label: 'Số vụ khởi tố', type: 'NUM', aggregate: 'SUM', unit: 'vụ' },
          ],
        },
      },
    });
    const p = await db.dynReportPeriod.create({
      data: {
        reportId: report.id, versionId: version.id, periodKey: '2026-10', startDate: new Date('2026-10-01'),
        endDate: new Date('2026-10-31'), opensAt: new Date('2026-10-01'), dueAt: new Date('2026-11-05'), scheduleSnapshot: {}, status,
      },
    });
    const assign = async (teamId: string, name: string, values: Record<string, string>, ownedFieldKeys?: string[]) => {
      const a = await db.dynReportAssignment.create({
        data: { periodId: p.id, teamId, teamSnapshot: { name }, ...(ownedFieldKeys ? { ownedFieldKeys } : {}) },
      });
      await db.dynReportSubmission.create({
        data: {
          assignmentId: a.id, state: 'APPROVED', currentRevision: 1,
          values: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, { t: 'NUM', v }])),
        },
      });
    };
    await assign(t1, 'Tổ 1', { 'S!C2': '10', 'S!C10': '3' });
    await assign(t2, 'Tổ 2', { 'S!C2': '5' }, ['S!C2']);
    return p.id;
  }

  beforeAll(async () => {
    const u = new URL(url!);
    if (u.hostname !== '127.0.0.1' || !['/pc02_dynamic_reports_test', '/pc02_goiy_scope_test'].includes(u.pathname)) {
      throw new Error('Refused: DYN_REPORTS_DATABASE_URL must point at a local scratch database');
    }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
    svc = new OfficialFileService(db as never, aggregate as never);
    t1 = (await db.team.create({ data: { code: `${tag}-1`, name: `${tag}-1` } })).id;
    t2 = (await db.team.create({ data: { code: `${tag}-2`, name: `${tag}-2` } })).id;
  });

  beforeEach(() => {
    role.current = { role: 'MANAGER', teamScopeId: null };
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('closing a period makes its file: the summary, then one sheet per team with only its criteria', async () => {
    const id = await period();

    await svc.onPeriodClosed({ periodId: id, actorId: 'closer' });

    const [file] = await svc.list(id, 'u', 'r');
    expect(file).toMatchObject({ status: 'READY', error: null, endedAt: null });
    expect(file.fileName).toMatch(/2026-10-chinh-thuc\.xlsx$/);

    const { fileBuffer } = await svc.download(file.id, 'u', 'r');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(fileBuffer as never);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Tổng hợp', 'Tổ 1', 'Tổ 2']);
    const summary = wb.worksheets[0];
    const row = (r: number) => Array.from((summary.getRow(r).values as unknown[]).slice(1), (v) => v ?? null);
    // Rows follow the sheet (C2 before C10), not the text order of the addresses.
    expect(row(5)).toEqual(['1.1', 'Số tin báo mới', 'tin', 15, '2/2', '100%', 10, 5]);
    expect(row(6)).toEqual(['', 'Số vụ khởi tố', 'vụ', 3, '1/1', '100%', 3, '—']);
    expect(wb.getWorksheet('Tổ 2')!.rowCount).toBe(5);
  });

  it('making it again keeps the earlier file, marked superseded; only one is current', async () => {
    const id = await period();
    await svc.onPeriodClosed({ periodId: id, actorId: 'closer' });

    const again = await svc.regenerate(id, 'mgr', 'r');

    const rows = await svc.list(id, 'u', 'r');
    expect(rows.map((r) => r.status)).toEqual(['READY', 'SUPERSEDED']);
    expect(rows[0].id).toBe(again.id);
    expect(rows[1].endedAt).not.toBeNull();
    // The earlier one can still be taken: it is what was filed at the time.
    await expect(svc.download(rows[1].id, 'u', 'r')).resolves.toMatchObject({ fileName: expect.any(String) });
  });

  it('a period that is not closed has no official file to make', async () => {
    const id = await period('OPEN');
    await expect(svc.regenerate(id, 'mgr', 'r')).rejects.toMatchObject({ response: { code: 'PERIOD_NOT_FINALIZED' } });
    expect(await db.dynReportOfficialFile.count({ where: { periodId: id } })).toBe(0);
  });

  it('a failure after the close never throws back at the close: it is logged, nothing is stored for an open period', async () => {
    const id = await period('OPEN');
    await expect(svc.onPeriodClosed({ periodId: id, actorId: 'closer' })).resolves.toBeUndefined();
  });

  it('a build that finishes after the period was reopened is thrown away: no current file for an open period', async () => {
    const id = await period();
    // Reopen the period at the very moment the finished workbook is about to be stored.
    const reopenDuringBuild = new Proxy(db, {
      get(target, prop, receiver) {
        if (prop === '$transaction') {
          return async (fn: never, options: never) => {
            await target.dynReportPeriod.update({ where: { id }, data: { status: 'OPEN', finalizedAt: null } });
            return (target.$transaction as (f: never, o: never) => unknown)(fn, options);
          };
        }
        const value = Reflect.get(target, prop, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const racing = new OfficialFileService(reopenDuringBuild as never, aggregate as never);

    await expect(racing.regenerate(id, 'mgr', 'r')).rejects.toMatchObject({ response: { code: 'PERIOD_NOT_FINALIZED' } });

    expect(await db.dynReportOfficialFile.count({ where: { periodId: id } })).toBe(0);
  });

  it('a build of an earlier closure does not replace the file of the closure after it', async () => {
    const id = await period();
    await db.dynReportPeriod.update({ where: { id }, data: { finalizedAt: new Date('2026-11-01T00:00:00Z') } });
    const reclosedDuringBuild = new Proxy(db, {
      get(target, prop, receiver) {
        if (prop === '$transaction') {
          return async (fn: never, options: never) => {
            await target.dynReportPeriod.update({ where: { id }, data: { finalizedAt: new Date('2026-11-02T00:00:00Z') } });
            return (target.$transaction as (f: never, o: never) => unknown)(fn, options);
          };
        }
        const value = Reflect.get(target, prop, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });

    await expect(new OfficialFileService(reclosedDuringBuild as never, aggregate as never).regenerate(id, 'mgr', 'r')).rejects.toMatchObject({
      response: { code: 'PERIOD_NOT_FINALIZED' },
    });
    expect(await db.dynReportOfficialFile.count({ where: { periodId: id } })).toBe(0);
  });

  it('two builds at the same moment leave exactly one current file', async () => {
    const id = await period();

    await Promise.all([svc.regenerate(id, 'a', 'r'), svc.regenerate(id, 'b', 'r')]);

    const rows = await svc.list(id, 'u', 'r');
    expect(rows.filter((r) => r.status === 'READY')).toHaveLength(1);
    expect(rows).toHaveLength(2);
  });

  it('a closed period left without a file (a restart between the close and the build) gets one at the next catch-up', async () => {
    const id = await period();
    // The catch-up takes the oldest closures first; other specs leave closed periods in this scratch database, so this
    // one is given the oldest closing time to be in the first batch.
    await db.dynReportPeriod.update({ where: { id }, data: { finalizedAt: new Date('2000-01-01T00:00:00Z') } });
    expect(await db.dynReportOfficialFile.count({ where: { periodId: id } })).toBe(0);

    await svc.catchUp();

    expect((await svc.list(id, 'u', 'r')).map((r) => r.status)).toEqual(['READY']);
    // A period that already has a file is left alone by the next run.
    await svc.catchUp();
    expect(await db.dynReportOfficialFile.count({ where: { periodId: id } })).toBe(1);
  }, 60_000);

  describe('who may take it', () => {
    it('a viewer of the whole report may list and download, but not make it again', async () => {
      const id = await period();
      await svc.onPeriodClosed({ periodId: id, actorId: 'closer' });
      role.current = { role: 'VIEWER', teamScopeId: null };

      const [file] = await svc.list(id, 'v', 'r');
      await expect(svc.download(file.id, 'v', 'r')).resolves.toBeDefined();
      await expect(svc.regenerate(id, 'v', 'r')).rejects.toMatchObject({ status: 404 });
    });

    it('a viewer limited to one team does not get the file of every team', async () => {
      const id = await period();
      await svc.onPeriodClosed({ periodId: id, actorId: 'closer' });
      const [file] = await svc.list(id, 'm', 'r');
      role.current = { role: 'VIEWER', teamScopeId: t1 };

      await expect(svc.list(id, 'v', 'r')).rejects.toMatchObject({ status: 404 });
      await expect(svc.download(file.id, 'v', 'r')).rejects.toMatchObject({ status: 404 });
    });

    it('someone with no standing in the report is told it does not exist', async () => {
      const id = await period();
      role.current = null;
      await expect(svc.list(id, 'x', 'r')).rejects.toMatchObject({ status: 404 });
      await expect(svc.regenerate(id, 'x', 'r')).rejects.toMatchObject({ status: 404 });
    });
  });

  it('a voided file (the period was reopened) stays listed and can still be taken as a record', async () => {
    const id = await period();
    await svc.onPeriodClosed({ periodId: id, actorId: 'closer' });
    await db.dynReportOfficialFile.updateMany({ where: { periodId: id }, data: { status: 'VOID', endedAt: new Date() } });

    const [file] = await svc.list(id, 'u', 'r');
    expect(file.status).toBe('VOID');
    await expect(svc.download(file.id, 'u', 'r')).resolves.toBeDefined();
  });
});
