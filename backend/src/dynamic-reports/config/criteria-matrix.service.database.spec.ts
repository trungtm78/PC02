import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as ExcelJS from 'exceljs';
import { randomUUID } from 'node:crypto';
import { CriteriaMatrixError, CriteriaMatrixService } from './criteria-matrix.service';
import { ReportConfigUpdateService } from './report-config-update.service';

/**
 * The criteria-by-team matrix taken out as Excel and put back, on a REAL PostgreSQL: the file changes exactly what the
 * edit screen would, through the same update (revision guard included).
 */
const url = process.env.DYN_REPORTS_DATABASE_URL;
const run = url ? describe : describe.skip;

run('CriteriaMatrixService on PostgreSQL', () => {
  let db: PrismaClient;
  let svc: CriteriaMatrixService;
  const tag = `cm-${randomUUID().slice(0, 8)}`;
  let n = 0;
  let userId = '';
  const team: Record<string, string> = {};

  async function report() {
    n += 1;
    const r = await db.dynReport.create({ data: { code: `${tag}-${n}`, name: `${tag} báo cáo`, status: 'PUBLISHED' } });
    await db.dynReportRole.create({ data: { reportId: r.id, userId, role: 'MANAGER' } });
    await db.dynReportVersion.create({
      data: {
        reportId: r.id, version: 1, status: 'PUBLISHED', fileBytes: Buffer.from('x'), sha256: 'f'.repeat(64),
        fileName: 'm.xlsx', selectedSheets: ['S'], layout: {}, parserVersion: 't', engineVersion: 't',
        fields: {
          create: [
            { sheetKey: 'S', address: 'C2', fieldKey: 'S!C2', label: 'Tin mới', type: 'NUM', itemKey: 'tin-moi', criterionCode: '1.1' },
            { sheetKey: 'S', address: 'C3', fieldKey: 'S!C3', label: 'Tin cũ', type: 'NUM', itemKey: 'tin-cu', criterionCode: '1.2' },
          ],
        },
      },
    });
    for (const [name, itemKeys] of [['a', null], ['b', ['tin-moi']]] as const) {
      const target = await db.dynReportTarget.create({
        data: { reportId: r.id, teamId: team[name], ...(itemKeys ? { itemKeys: [...itemKeys] } : {}) },
      });
      await db.dynReportTargetEditor.create({ data: { targetId: target.id, userId } });
    }
    return r.id;
  }
  const subsetOf = async (reportId: string, name: string) =>
    (await db.dynReportTarget.findFirstOrThrow({ where: { reportId, teamId: team[name], validTo: null } })).itemKeys;
  async function edited(buffer: Buffer, change: (ws: ExcelJS.Worksheet) => void): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as never);
    change(wb.worksheets[0]);
    return Buffer.from((await wb.xlsx.writeBuffer()) as ArrayBuffer);
  }

  beforeAll(async () => {
    const u = new URL(url!);
    if (u.hostname !== '127.0.0.1' || !['/pc02_dynamic_reports_test', '/pc02_goiy_scope_test'].includes(u.pathname)) {
      throw new Error('Refused: DYN_REPORTS_DATABASE_URL must point at a local scratch database');
    }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
    svc = new CriteriaMatrixService(db as never, new ReportConfigUpdateService(db as never));
    const role = await db.role.create({ data: { name: `${tag}-role` } });
    userId = (await db.user.create({ data: { username: `${tag}-u`, passwordHash: 'x', roleId: role.id } })).id;
    // Names chosen so the columns come out in a known order (A before B).
    team.a = (await db.team.create({ data: { code: `${tag}-a`, name: `${tag} A` } })).id;
    team.b = (await db.team.create({ data: { code: `${tag}-b`, name: `${tag} B` } })).id;
  });

  afterAll(async () => {
    await db.$disconnect();
  });

  it('the file taken out shows what each team reports now', async () => {
    const id = await report();

    const { fileName, fileBuffer } = await svc.export(id);

    expect(fileName).toMatch(/ma-tran-tieu-chi\.xlsx$/);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(fileBuffer as never);
    const ws = wb.worksheets[0];
    expect([ws.getCell('B4').value, ws.getCell('C4').value, ws.getCell('D4').value, ws.getCell('E4').value]).toEqual(['1.1', 'Tin mới', 'x', 'x']);
    expect([ws.getCell('D5').value, ws.getCell('E5').value]).toEqual(['x', null]);
  });

  it('a preview says what would change and changes nothing; applying changes exactly that', async () => {
    const id = await report();
    const file = await edited((await svc.export(id)).fileBuffer, (ws) => {
      ws.getCell('D5').value = null; // team A stops reporting "tin-cu"
      ws.getCell('E5').value = 'x'; // team B now reports everything
    });

    const preview = await svc.import(id, file, { apply: false });

    expect(preview.applied).toBe(false);
    expect(preview.teams.map((t) => [t.added, t.removed])).toEqual([[[], ['tin-cu']], [['tin-cu'], []]]);
    expect(await subsetOf(id, 'a')).toBeNull();
    expect(await subsetOf(id, 'b')).toEqual(['tin-moi']);

    const applied = await svc.import(id, file, { apply: true, expectedConfigVersion: preview.configVersion });

    expect(applied.applied).toBe(true);
    expect(applied.configVersion).toBe(preview.configVersion + 1);
    expect(await subsetOf(id, 'a')).toEqual(['tin-moi']);
    expect(await subsetOf(id, 'b')).toBeNull();
    // The people who type for each team are untouched.
    expect(await db.dynReportTargetEditor.count({ where: { target: { reportId: id }, validTo: null } })).toBe(2);
  });

  it('applying against a revision somebody else has moved is refused, and nothing changes', async () => {
    const id = await report();
    const file = await edited((await svc.export(id)).fileBuffer, (ws) => {
      ws.getCell('D5').value = null;
    });
    const preview = await svc.import(id, file, { apply: false });
    await db.dynReport.update({ where: { id }, data: { configVersion: { increment: 1 } } });

    await expect(svc.import(id, file, { apply: true, expectedConfigVersion: preview.configVersion })).rejects.toMatchObject({
      code: 'REVISION_CONFLICT',
    });
    expect(await subsetOf(id, 'a')).toBeNull();
  });

  it('a file that would leave a team with nothing is refused with the reason', async () => {
    const id = await report();
    const file = await edited((await svc.export(id)).fileBuffer, (ws) => {
      ws.getCell('E4').value = null;
    });

    const error = await svc.import(id, file, { apply: true, expectedConfigVersion: 0 }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(CriteriaMatrixError);
    expect((error as CriteriaMatrixError).errors).toEqual([{ code: 'MATRIX_TEAM_EMPTY', teamId: team.b, name: `${tag} B` }]);
    expect(await subsetOf(id, 'b')).toEqual(['tin-moi']);
  });

  it('a report that does not exist is not found', async () => {
    await expect(svc.export('missing')).rejects.toMatchObject({ code: 'REPORT_NOT_FOUND' });
  });
});
