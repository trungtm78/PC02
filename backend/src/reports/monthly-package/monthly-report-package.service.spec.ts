/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
import { MonthlyReportPackageService } from './monthly-report-package.service';

const snapshot = {
  periodStart: '2026-09-01T00:00:00.000Z',
  periodEnd: '2026-09-30T23:59:59.999Z',
  unitName: 'PC02',
  templateVersion: '2026.09',
  appendices: Array.from({ length: 8 }, (_, index) => ({
    code: `PL0${index + 1}`,
    kind: index < 6 ? 'DETAIL' : 'SUMMARY',
    rows: [],
    metrics: [],
  })),
} as any;

describe('MonthlyReportPackageService', () => {
  const prisma: any = {
    monthlyReportPackage: {
      create: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
    monthlyReportContribution: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
      groupBy: jest.fn(),
    },
    monthlyReportAdjustment: { create: jest.fn() },
    $transaction: jest.fn((value: any) =>
      typeof value === 'function' ? value(prisma) : Promise.all(value),
    ),
  };
  const builder: any = { build: jest.fn() };
  const exporter: any = { render: jest.fn() };
  let service: MonthlyReportPackageService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.monthlyReportPackage.findMany.mockResolvedValue([]);
    prisma.monthlyReportContribution.groupBy.mockResolvedValue([]);
    prisma.monthlyReportContribution.findMany.mockResolvedValue([]);
    prisma.monthlyReportContribution.updateMany.mockResolvedValue({ count: 1 });
    prisma.monthlyReportPackage.updateMany.mockResolvedValue({ count: 1 });
    service = new MonthlyReportPackageService(prisma, builder, exporter);
  });

  it('persists one snapshot and its complete contribution set', async () => {
    builder.build.mockResolvedValue({
      snapshot,
      contributions: [
        {
          appendix: 'PL01',
          metricKey: 'ROW',
          entityType: 'INCIDENT',
          entityId: 'i1',
          label: 'VV-1',
          value: 1,
          ruleCode: 'ACTIVE_AT_CUTOFF',
        },
      ],
    });
    prisma.monthlyReportPackage.create.mockImplementation(({ data }: any) => ({
      id: 'r1',
      ...data,
    }));

    const result = await service.create(
      {
        periodStart: snapshot.periodStart,
        periodEnd: snapshot.periodEnd,
        unitName: 'PC02',
        teamIds: [],
      },
      'u1',
    );

    expect(builder.build).toHaveBeenCalled();
    expect(prisma.monthlyReportPackage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          createdById: 'u1',
          contributions: { create: expect.any(Array) },
        }),
      }),
    );
    expect(result.id).toBe('r1');
  });

  it('drills down only from persisted contributions and paginates them', async () => {
    prisma.monthlyReportPackage.findUnique.mockResolvedValue({
      id: 'r1',
      snapshot,
    });
    prisma.monthlyReportContribution.findMany.mockResolvedValue([
      { id: 'x', entityId: 'i1', value: 1 },
    ]);
    prisma.monthlyReportContribution.count.mockResolvedValue(1);

    const result = await service.drilldown('r1', {
      appendix: 'PL07',
      metricKey: '5',
      page: 1,
      limit: 20,
    });

    expect(result).toMatchObject({ total: 1, items: [{ entityId: 'i1' }] });
    expect(builder.build).not.toHaveBeenCalled();
  });

  it('finalizes from the approved snapshot and stores immutable workbook bytes and hashes', async () => {
    const report = {
      id: 'r1',
      status: 'APPROVED',
      createdById: 'u1',
      snapshot,
    };
    prisma.monthlyReportPackage.findUnique.mockResolvedValue(report);
    exporter.render
      .mockResolvedValueOnce(Buffer.from('six'))
      .mockResolvedValueOnce(Buffer.from('two'));
    prisma.monthlyReportPackage.findUnique
      .mockResolvedValueOnce(report)
      .mockResolvedValueOnce({
        ...report,
        status: 'FINALIZED',
        detailWorkbookSha256: 'a'.repeat(64),
      });

    const result = await service.transition('r1', 'FINALIZED', 'u2');

    expect(exporter.render).toHaveBeenNthCalledWith(1, 'DETAIL', snapshot);
    expect(exporter.render).toHaveBeenNthCalledWith(2, 'SUMMARY', snapshot);
    expect(result).toMatchObject({
      status: 'FINALIZED',
      detailWorkbookSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
  });

  it('applies a sourced numeric adjustment to the snapshot and keeps a signed drilldown row', async () => {
    const adjustedSnapshot = structuredClone(snapshot);
    adjustedSnapshot.appendices[6].metrics = [
      { key: '5', value: 2, contributionIds: [] },
    ];
    prisma.monthlyReportPackage.findUnique.mockResolvedValue({
      id: 'r1',
      status: 'NEEDS_VERIFICATION',
      createdById: 'u1',
      snapshot: adjustedSnapshot,
      adjustments: [],
    });
    prisma.monthlyReportAdjustment.create.mockResolvedValue({ id: 'a1' });
    prisma.monthlyReportContribution.create.mockResolvedValue({ id: 'c1' });
    prisma.monthlyReportPackage.findUnique
      .mockResolvedValueOnce({
        id: 'r1',
        status: 'NEEDS_VERIFICATION',
        lockVersion: 0,
        createdById: 'u1',
        snapshot: adjustedSnapshot,
        adjustments: [],
      })
      .mockResolvedValueOnce({
        id: 'r1',
        status: 'DRAFT',
        snapshot: adjustedSnapshot,
        adjustments: [],
      });

    await service.addAdjustment(
      'r1',
      {
        appendix: 'PL07',
        targetKey: '5',
        entityId: 'i9',
        operation: 'ADD',
        newValue: 1,
        reason: 'Bổ sung hồ sơ bỏ sót',
        evidence: { document: 'BB-01' },
      },
      'u2',
    );

    expect(prisma.monthlyReportContribution.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metricKey: '5',
          entityId: 'i9',
          value: 1,
          ruleCode: 'MANUAL_ADJUSTMENT',
        }),
      }),
    );
    expect(prisma.monthlyReportPackage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          snapshot: expect.objectContaining({ appendices: expect.any(Array) }),
        }),
      }),
    );
  });

  it('confirms only the selected issue and keeps other verification blockers', async () => {
    const adjustedSnapshot = structuredClone(snapshot);
    adjustedSnapshot.appendices[6].metrics = [
      {
        key: '5',
        value: 2,
        contributionIds: ['a', 'b'],
        issues: [
          { code: 'HISTORICAL_VALUE_UNKNOWN:i1', severity: 'ERROR' },
          { code: 'HISTORICAL_VALUE_UNKNOWN:i2', severity: 'ERROR' },
        ],
      },
    ];
    prisma.monthlyReportPackage.findUnique
      .mockResolvedValueOnce({
        id: 'r1',
        status: 'NEEDS_VERIFICATION',
        lockVersion: 3,
        createdById: 'u1',
        snapshot: adjustedSnapshot,
        adjustments: [],
      })
      .mockResolvedValueOnce({
        id: 'r1',
        status: 'NEEDS_VERIFICATION',
        snapshot: adjustedSnapshot,
        adjustments: [],
      });
    prisma.monthlyReportAdjustment.create.mockResolvedValue({ id: 'a2' });

    await service.addAdjustment(
      'r1',
      {
        appendix: 'PL07',
        targetKey: '5',
        entityId: 'i1',
        operation: 'CONFIRM',
        newValue: 'Đã xác minh',
        issueCode: 'HISTORICAL_VALUE_UNKNOWN:i1',
        reason: 'Đối chiếu hồ sơ giấy',
        evidence: { document: 'BB-02' },
      },
      'u2',
    );

    const saved =
      prisma.monthlyReportPackage.updateMany.mock.calls[0][0].data.snapshot;
    expect(saved.appendices[6].metrics[0].issues).toEqual([
      { code: 'HISTORICAL_VALUE_UNKNOWN:i2', severity: 'ERROR' },
    ]);
    expect(prisma.monthlyReportContribution.create).not.toHaveBeenCalled();
  });

  it('rejects a stale update instead of overwriting a concurrent change', async () => {
    prisma.monthlyReportPackage.findUnique.mockResolvedValue({
      id: 'r1',
      status: 'DRAFT',
      lockVersion: 4,
      createdById: 'u1',
      snapshot,
      summary: {},
      adjustments: [],
    });
    prisma.monthlyReportPackage.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.transition('r1', 'REVIEWING', 'u1')).rejects.toThrow(
      'Báo cáo vừa được thay đổi bởi người khác',
    );
  });

  it('updates field lineage in the same transaction as a detail correction', async () => {
    const adjustedSnapshot = structuredClone(snapshot);
    adjustedSnapshot.appendices[0].rows = [
      {
        recordId: 'i1',
        recordCode: 'VV-1',
        cells: { crime: 'Giá trị cũ' },
        issues: [
          {
            code: 'HISTORICAL_VALUE_UNKNOWN',
            severity: 'ERROR',
            field: 'crime',
          },
        ],
      },
    ];
    prisma.monthlyReportPackage.findUnique
      .mockResolvedValueOnce({
        id: 'r1',
        status: 'NEEDS_VERIFICATION',
        lockVersion: 0,
        createdById: 'u1',
        snapshot: adjustedSnapshot,
        adjustments: [],
      })
      .mockResolvedValueOnce({
        id: 'r1',
        status: 'DRAFT',
        snapshot: adjustedSnapshot,
        adjustments: [],
      });
    prisma.monthlyReportAdjustment.create.mockResolvedValue({ id: 'a3' });

    await service.addAdjustment(
      'r1',
      {
        appendix: 'PL01',
        targetKey: 'crime',
        entityId: 'i1',
        operation: 'REPLACE',
        newValue: 'Giá trị tại kỳ',
        issueCode: 'HISTORICAL_VALUE_UNKNOWN',
        reason: 'Đối chiếu hồ sơ giấy',
        evidence: { document: 'BB-03' },
      },
      'u2',
    );

    expect(prisma.monthlyReportContribution.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          reportId: 'r1',
          appendix: 'PL01',
          entityId: 'i1',
          cellKey: 'crime',
        }),
        data: {
          snapshot: expect.objectContaining({
            valueAtPeriod: 'Giá trị tại kỳ',
            previousValue: 'Giá trị cũ',
          }),
        },
      }),
    );
  });

  it('does not clear a field-specific historical issue without the value at the report cutoff', async () => {
    const adjustedSnapshot = structuredClone(snapshot);
    adjustedSnapshot.appendices[3].rows = [
      {
        recordId: 'c1',
        recordCode: 'VA-1',
        cells: { subjectName: 'Cần xác minh' },
        issues: [
          {
            code: 'HISTORICAL_SUBJECT_VALUE_UNKNOWN:s1:subjectName',
            severity: 'ERROR',
            field: 'subjectName',
          },
        ],
      },
    ];
    prisma.monthlyReportPackage.findUnique.mockResolvedValue({
      id: 'r1',
      status: 'NEEDS_VERIFICATION',
      lockVersion: 0,
      createdById: 'u1',
      snapshot: adjustedSnapshot,
      adjustments: [],
    });

    await expect(
      service.addAdjustment(
        'r1',
        {
          appendix: 'PL04',
          targetKey: '__confirm_snapshot__',
          entityId: 'c1',
          operation: 'REPLACE',
          newValue: 'Đã xác minh',
          issueCode: 'HISTORICAL_SUBJECT_VALUE_UNKNOWN:s1:subjectName',
          reason: 'Đối chiếu hồ sơ giấy',
          evidence: { document: 'BB-04' },
        },
        'u2',
      ),
    ).rejects.toThrow('giá trị đúng tại kỳ');
    expect(prisma.monthlyReportPackage.updateMany).not.toHaveBeenCalled();
  });

  it('requires rebuilding after statutory expiry is corrected at the source', async () => {
    prisma.monthlyReportPackage.findUnique.mockResolvedValue({
      id: 'r1',
      status: 'NEEDS_VERIFICATION',
      lockVersion: 0,
      createdById: 'u1',
      snapshot,
      adjustments: [],
    });

    await expect(
      service.addAdjustment(
        'r1',
        {
          appendix: 'PL06',
          targetKey: 'expiryDate',
          entityId: 'c1',
          operation: 'REPLACE',
          newValue: '01/01/2020',
          issueCode: 'STATUTORY_EXPIRY_REQUIRED:c1',
          reason: 'Bổ sung thời hiệu',
          evidence: { document: 'HS-1' },
        },
        'u2',
      ),
    ).rejects.toThrow('tạo phiên bản báo cáo mới');
    await expect(
      service.addAdjustment(
        'r1',
        {
          appendix: 'PL06',
          targetKey: 'expiryDate',
          entityId: 'c1',
          operation: 'REPLACE',
          newValue: '01/01/2020',
          reason: 'Bổ sung thời hiệu',
          evidence: { document: 'HS-1' },
        },
        'u2',
      ),
    ).rejects.toThrow('Phải chỉ rõ vấn đề cần xác minh');
    expect(prisma.monthlyReportPackage.updateMany).not.toHaveBeenCalled();
  });

  it('does not clear a persisted issue when a numeric adjustment omits issueCode', async () => {
    const adjustedSnapshot = structuredClone(snapshot);
    adjustedSnapshot.appendices[6].metrics = [
      {
        key: '5',
        value: 2,
        contributionIds: ['a', 'b'],
        issues: [{ code: 'STATUTORY_EXPIRY_REQUIRED:i1', severity: 'ERROR' }],
      },
    ];
    prisma.monthlyReportPackage.findUnique
      .mockResolvedValueOnce({
        id: 'r1',
        status: 'NEEDS_VERIFICATION',
        lockVersion: 0,
        createdById: 'u1',
        snapshot: adjustedSnapshot,
        adjustments: [],
      })
      .mockResolvedValueOnce({
        id: 'r1',
        status: 'NEEDS_VERIFICATION',
        snapshot: adjustedSnapshot,
        adjustments: [],
      });
    prisma.monthlyReportAdjustment.create.mockResolvedValue({ id: 'a4' });
    prisma.monthlyReportContribution.create.mockResolvedValue({ id: 'c4' });

    await service.addAdjustment(
      'r1',
      {
        appendix: 'PL07',
        targetKey: '5',
        entityId: 'i2',
        operation: 'ADD',
        newValue: 1,
        reason: 'Bổ sung hồ sơ',
        evidence: { document: 'HS-2' },
      },
      'u2',
    );

    const saved =
      prisma.monthlyReportPackage.updateMany.mock.calls[0][0].data.snapshot;
    expect(saved.appendices[6].metrics[0].issues).toEqual([
      { code: 'STATUTORY_EXPIRY_REQUIRED:i1', severity: 'ERROR' },
    ]);
  });
});
