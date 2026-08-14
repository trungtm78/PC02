import { NotFoundException } from '@nestjs/common';
import { ReportExportLogService } from './report-export-log.service';

/**
 * D7/D8. Exporting a Phụ lục left no trace: the file left the system and
 * nobody knew it had. For procedural statistics, "who is holding this copy" is
 * a real question.
 *
 * There is deliberately no checksum. The exporter streams straight to the
 * response; buffering the whole file to hash it reopens the OOM risk the plan
 * flagged for large datasets. Who, what, when and how many rows answers the
 * question that gets asked, without trading memory for it.
 */
function makeService(over: Record<string, unknown> = {}) {
  const prisma: any = {
    reportExportLog: {
      create: jest.fn((args: unknown) => Promise.resolve(args)),
      findMany: jest.fn(() => Promise.resolve([])),
      count: jest.fn(() => Promise.resolve(0)),
      findUnique: jest.fn(() => Promise.resolve(null)),
    },
    ...over,
  };
  const svc = new ReportExportLogService(prisma);
  return { svc, prisma };
}

describe('record', () => {
  it('stores who exported what, for which period, and how many rows', async () => {
    const { svc, prisma } = makeService();

    await svc.record({
      reportType: 'PHU_LUC_1',
      fileName: 'PhuLuc1_PC02_1.xlsx',
      rowCount: 42,
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-12-31'),
      exportedById: 'u-1',
    });

    expect(prisma.reportExportLog.create.mock.calls[0][0].data).toMatchObject({
      reportType: 'PHU_LUC_1',
      rowCount: 42,
      exportedById: 'u-1',
      succeeded: true,
    });
  });

  it('never throws when the write fails', async () => {
    // Losing the file because the system could not write its own logbook is
    // the wrong trade. The failure is swallowed on purpose.
    const { svc } = makeService({
      reportExportLog: {
        create: jest.fn(() => Promise.reject(new Error('db down'))),
      },
    });

    await expect(
      svc.record({ reportType: 'PHU_LUC_1', fileName: 'x.xlsx' }),
    ).resolves.toBeUndefined();
  });

  it('records a half-written export as failed', async () => {
    // A stream that died mid-file is still data that partly left the system,
    // and has to be distinguishable from a clean export.
    const { svc, prisma } = makeService();

    await svc.record({
      reportType: 'PHU_LUC_4',
      fileName: 'x.xlsx',
      succeeded: false,
      errorText: 'stream closed',
    });

    expect(prisma.reportExportLog.create.mock.calls[0][0].data).toMatchObject({
      succeeded: false,
      errorText: 'stream closed',
    });
  });
});

describe('list', () => {
  it('returns newest first and caps the page', async () => {
    const { svc, prisma } = makeService();

    await svc.list({ limit: 9999 });

    const args = prisma.reportExportLog.findMany.mock.calls[0][0];
    expect(args.orderBy).toEqual({ createdAt: 'desc' });
    expect(args.take).toBe(100);
  });

  it('does not filter on an empty query string value', async () => {
    const { svc, prisma } = makeService();

    await svc.list({ reportType: '' });

    expect(prisma.reportExportLog.findMany.mock.calls[0][0].where).toEqual({});
  });
});

describe('getById', () => {
  it('404s rather than returning null', async () => {
    const { svc } = makeService();

    await expect(svc.getById('nope')).rejects.toThrow(NotFoundException);
  });
});
