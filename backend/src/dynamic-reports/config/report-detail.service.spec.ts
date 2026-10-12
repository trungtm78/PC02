import { ReportDetailService } from './report-detail.service';
import { ReportConfigError } from './report-config.service';
import type { PrismaService } from '../../prisma/prisma.service';

const NOW = new Date('2026-10-12T10:00:00Z');

function buildPrisma(over: Record<string, unknown> = {}) {
  const user = { firstName: 'An', lastName: 'Nguyễn', username: 'an' };
  const report = {
    id: 'r1',
    code: 'HSLN',
    name: 'Thống kê',
    description: null,
    status: 'PUBLISHED',
    reportingUnit: 'TEAM',
    effectiveFrom: NOW,
    configVersion: 3,
    createdAt: NOW,
    updatedAt: NOW,
    schedules: [
      {
        periodType: 'MONTHLY',
        periodStartDay: 1,
        dueRule: { kind: 'DAYS_AFTER_END', days: 5, time: '17:00' },
        openRule: { kind: 'AT_PERIOD_START' },
        shiftNonWorking: false,
        oneTimeDate: null,
        timezone: 'Asia/Ho_Chi_Minh',
        effectiveFrom: NOW,
      },
    ],
    roles: [{ userId: 'u1', role: 'MANAGER', teamScopeId: null, user }],
    targets: [
      {
        teamId: 't1',
        team: { code: 'DOI-1', name: 'Đội 1' },
        editors: [{ userId: 'u2', user: { firstName: 'Bình', lastName: 'Lê', username: 'binh' } }],
      },
    ],
    ...over,
  };
  const fields = [
    {
      sheetKey: 'S',
      address: 'C3',
      fieldKey: 'S!C3',
      label: 'Số vụ',
      type: 'NUM',
      format: null,
      aggregate: 'SUM',
      blankPolicy: 'ZERO',
      required: false,
      min: { toString: () => '0' },
      max: null,
      scale: null,
      maxLength: null,
      helpText: null,
      source: 'WEB',
    },
  ];
  return {
    dynReport: { findUnique: jest.fn().mockResolvedValue(report) },
    dynReportVersion: {
      count: jest.fn().mockResolvedValue(2),
      findFirst: jest
        .fn()
        .mockResolvedValueOnce({ id: 'v2' })
        .mockResolvedValueOnce({
          id: 'v2',
          version: 2,
          status: 'PUBLISHED',
          fileName: 'mau.xlsx',
          selectedSheets: ['S'],
          dateSystem: '1900',
          publishedAt: NOW,
          createdAt: NOW,
          fields,
          rules: [
            {
              name: 'R',
              leftExpr: 'A',
              operator: 'GTE',
              rightExpr: 'B',
              severity: 'ERROR',
              message: 'm',
              missingStrategy: null,
              origin: 'MANUAL',
            },
          ],
        }),
    },
    dynReportPeriod: {
      count: jest.fn().mockResolvedValue(14),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'p1',
          periodKey: '2026-10',
          status: 'OPEN',
          startDate: new Date('2026-10-01'),
          endDate: new Date('2026-10-31'),
          opensAt: NOW,
          dueAt: NOW,
          version: { version: 2 },
          assignments: [
            { submission: { state: 'SUBMITTED' } },
            { submission: { state: 'DRAFT' } },
            { submission: null },
          ],
        },
      ]),
    },
  };
}

describe('ReportDetailService', () => {
  it('assembles the whole configuration of a report in one read', async () => {
    const prisma = buildPrisma();
    const service = new ReportDetailService(prisma as unknown as PrismaService);

    const d = await service.getDetail('r1');

    expect(d).toMatchObject({
      id: 'r1',
      code: 'HSLN',
      status: 'PUBLISHED',
      configVersion: 3,
      versionCount: 2,
      periodTotal: 14,
    });
    expect(d.schedule?.periodType).toBe('MONTHLY');
    expect(d.roles).toEqual([{ userId: 'u1', name: 'Nguyễn An', role: 'MANAGER', teamScopeId: null }]);
    expect(d.targets[0]).toMatchObject({
      teamCode: 'DOI-1',
      teamName: 'Đội 1',
      editors: [{ userId: 'u2', name: 'Lê Bình' }],
    });
    expect(d.currentVersion?.version).toBe(2);
    expect(d.currentVersion?.fields[0]).toMatchObject({ fieldKey: 'S!C3', min: '0', max: null });
    expect(d.currentVersion?.rules).toHaveLength(1);
  });

  it('counts only submitted and approved submissions as submitted, out of the teams that must submit', async () => {
    const service = new ReportDetailService(buildPrisma() as unknown as PrismaService);
    const d = await service.getDetail('r1');
    expect(d.periods[0]).toMatchObject({ periodKey: '2026-10', teamCount: 3, submittedCount: 1, version: 2 });
  });

  it('never loads the template file bytes for the detail', async () => {
    const prisma = buildPrisma();
    await new ReportDetailService(prisma as unknown as PrismaService).getDetail('r1');
    const selects = prisma.dynReportVersion.findFirst.mock.calls.map(
      (c) => (c[0] as { select?: Record<string, unknown> }).select,
    );
    expect(selects.some((s) => s && 'fileBytes' in s)).toBe(false);
    expect(selects.some((s) => s && 'fields' in s)).toBe(true);
  });

  it('a report that does not exist is REPORT_NOT_FOUND', async () => {
    const prisma = buildPrisma();
    prisma.dynReport.findUnique.mockResolvedValue(null);
    await expect(
      new ReportDetailService(prisma as unknown as PrismaService).getDetail('nope'),
    ).rejects.toMatchObject({ code: 'REPORT_NOT_FOUND' });
  });

  it('with no schedule and no version yet the detail still comes back, with nulls', async () => {
    const prisma = buildPrisma({ schedules: [] });
    prisma.dynReportVersion.findFirst = jest.fn().mockResolvedValue(null);
    const d = await new ReportDetailService(prisma as unknown as PrismaService).getDetail('r1');
    expect(d.schedule).toBeNull();
    expect(d.currentVersion).toBeNull();
  });

  describe('getVersionFile', () => {
    it('returns the bytes of a version that belongs to the report', async () => {
      const prisma = {
        dynReportVersion: {
          findFirst: jest.fn().mockResolvedValue({ fileName: 'mau.xlsx', fileBytes: new Uint8Array([1, 2, 3]) }),
        },
      };
      const out = await new ReportDetailService(prisma as unknown as PrismaService).getVersionFile('r1', 'v1');
      expect(out.fileName).toBe('mau.xlsx');
      expect([...out.bytes]).toEqual([1, 2, 3]);
      expect(prisma.dynReportVersion.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'v1', reportId: 'r1' } }),
      );
    });

    it('a version of another report is not found (the report id is part of the lookup)', async () => {
      const prisma = { dynReportVersion: { findFirst: jest.fn().mockResolvedValue(null) } };
      await expect(
        new ReportDetailService(prisma as unknown as PrismaService).getVersionFile('r1', 'other'),
      ).rejects.toBeInstanceOf(ReportConfigError);
    });
  });
});
