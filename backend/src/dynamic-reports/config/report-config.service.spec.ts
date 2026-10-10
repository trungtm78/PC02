import { createHash } from 'crypto';
import {
  ReportConfigService,
  ReportConfigError,
} from './report-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { SaveReportConfigDto } from './dto/save-report-config.dto';

/**
 * ReportConfigService (spec §6.1 PR4 S09/S10) — the first service that
 * actually persists a dynamic report. Same mocked-`$transaction` pattern
 * as `period-scheduler.service.spec.ts` (this repo's established
 * convention for this module): the DB-integration edges (real unique
 * constraints, real P2002 races) are covered by the `/run` real-environment
 * walkthrough, this suite verifies the service's own decision logic.
 */
describe('ReportConfigService', () => {
  function buildTx() {
    type AnyData = Record<string, unknown>;
    return {
      dynReport: { create: jest.fn<Promise<unknown>, [AnyData]>() },
      dynReportVersion: { create: jest.fn<Promise<unknown>, [AnyData]>() },
      dynReportField: { createMany: jest.fn<Promise<unknown>, [AnyData]>() },
      dynReportSchedule: { create: jest.fn<Promise<unknown>, [AnyData]>() },
      dynReportRole: { create: jest.fn<Promise<unknown>, [AnyData]>() },
      dynReportTarget: { create: jest.fn<Promise<unknown>, [AnyData]>() },
      dynReportTargetEditor: {
        createMany: jest.fn<Promise<unknown>, [AnyData]>(),
      },
      dynReportIdempotency: { upsert: jest.fn<Promise<unknown>, [AnyData]>() },
    };
  }

  function buildService(tx: ReturnType<typeof buildTx>) {
    const prisma = {
      $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
      dynReportIdempotency: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new ReportConfigService(prisma as unknown as PrismaService);
    return { service, prisma };
  }

  function baseDraftInput(
    overrides: Partial<SaveReportConfigDto> = {},
  ): SaveReportConfigDto {
    return {
      code: 'HSLN',
      name: 'Thống kê hình sự liên ngành',
      selectedSheets: ['Đội 3'],
      dateSystem: '1900',
      fields: [],
      schedule: {
        periodType: 'MONTHLY',
        dueRule: { kind: 'DAYS_AFTER_END', days: 5, time: '17:00' },
        openRule: { kind: 'AT_PERIOD_START' },
      },
      roles: [],
      targets: [],
      effectiveFrom: '2026-01-01T00:00:00.000Z',
      publish: false,
      idempotencyKey: 'key-1',
      ...overrides,
    } as SaveReportConfigDto;
  }

  function fullPublishableInput(
    overrides: Partial<SaveReportConfigDto> = {},
  ): SaveReportConfigDto {
    return baseDraftInput({
      publish: true,
      fields: [
        {
          sheetKey: 'Đội 3',
          address: 'C6',
          fieldKey: 'Đội 3!C6',
          label: 'Số vụ mới',
          type: 'NUM',
          aggregate: 'SUM',
          source: 'TOKEN',
        },
      ],
      roles: [{ userId: 'u1', role: 'MANAGER' }],
      targets: [{ teamId: 't1', editorUserIds: ['u2'] }],
      ...overrides,
    });
  }

  const BUF = Buffer.from('fake-xlsx');

  it('saves a draft with the minimum (code/name/selectedSheets), no fields/roles/targets required', async () => {
    const tx = buildTx();
    tx.dynReport.create.mockResolvedValue({ id: 'rep1' });
    tx.dynReportVersion.create.mockResolvedValue({ id: 'ver1' });
    const { service } = buildService(tx);

    const result = await service.save(
      baseDraftInput(),
      BUF,
      'mau.xlsx',
      'actor1',
    );

    expect(result).toEqual({
      reportId: 'rep1',
      versionId: 'ver1',
      status: 'DRAFT',
    });
    const createCall = tx.dynReport.create.mock.calls[0][0] as {
      data: { status: string };
    };
    expect(createCall.data.status).toBe('DRAFT');
    expect(tx.dynReportField.createMany).not.toHaveBeenCalled();
    expect(tx.dynReportTarget.create).not.toHaveBeenCalled();
  });

  it('rejects publish with zero fields', async () => {
    const tx = buildTx();
    const { service } = buildService(tx);

    await expect(
      service.save(
        fullPublishableInput({ fields: [] }),
        BUF,
        'mau.xlsx',
        'actor1',
      ),
    ).rejects.toThrow(ReportConfigError);
    expect(tx.dynReport.create).not.toHaveBeenCalled();
  });

  it('rejects publish with no MANAGER role', async () => {
    const tx = buildTx();
    const { service } = buildService(tx);

    await expect(
      service.save(
        fullPublishableInput({ roles: [{ userId: 'u1', role: 'VIEWER' }] }),
        BUF,
        'mau.xlsx',
        'actor1',
      ),
    ).rejects.toThrow(ReportConfigError);
  });

  it('rejects publish with zero target teams', async () => {
    const tx = buildTx();
    const { service } = buildService(tx);

    await expect(
      service.save(
        fullPublishableInput({ targets: [] }),
        BUF,
        'mau.xlsx',
        'actor1',
      ),
    ).rejects.toThrow(ReportConfigError);
  });

  it('rejects publish when a target team has zero editors', async () => {
    const tx = buildTx();
    const { service } = buildService(tx);

    await expect(
      service.save(
        fullPublishableInput({
          targets: [{ teamId: 't1', editorUserIds: [] }],
        }),
        BUF,
        'mau.xlsx',
        'actor1',
      ),
    ).rejects.toThrow(ReportConfigError);
  });

  it('rejects publish for ONE_TIME with no oneTimeDate', async () => {
    const tx = buildTx();
    const { service } = buildService(tx);

    await expect(
      service.save(
        fullPublishableInput({
          schedule: {
            periodType: 'ONE_TIME',
            dueRule: { kind: 'DAYS_AFTER_END', days: 5, time: '17:00' },
            openRule: { kind: 'AT_PERIOD_START' },
          },
        }),
        BUF,
        'mau.xlsx',
        'actor1',
      ),
    ).rejects.toThrow(ReportConfigError);
  });

  it('rejects a schedule the period engine cannot compute (unrecognized periodType, bypassing the DTO enum gate)', async () => {
    const tx = buildTx();
    const { service } = buildService(tx);

    await expect(
      service.save(
        fullPublishableInput({
          schedule: {
            // Cast past the DTO's own IsIn gate — this exercises the
            // service's own defense-in-depth, not the DTO validator.
            periodType:
              'NOT_A_REAL_PERIOD_TYPE' as SaveReportConfigDto['schedule']['periodType'],
            dueRule: { kind: 'DAYS_AFTER_END', days: 5, time: '17:00' },
            openRule: { kind: 'AT_PERIOD_START' },
          },
        }),
        BUF,
        'mau.xlsx',
        'actor1',
      ),
    ).rejects.toThrow(ReportConfigError);
    expect(tx.dynReport.create).not.toHaveBeenCalled();
  });

  it('publishes a complete config: report+version PUBLISHED, fields/schedule/roles/targets/editors all written', async () => {
    const tx = buildTx();
    tx.dynReport.create.mockResolvedValue({ id: 'rep1' });
    tx.dynReportVersion.create.mockResolvedValue({ id: 'ver1' });
    tx.dynReportTarget.create.mockResolvedValue({ id: 'target1' });
    const { service } = buildService(tx);

    const result = await service.save(
      fullPublishableInput(),
      BUF,
      'mau.xlsx',
      'actor1',
    );

    expect(result).toEqual({
      reportId: 'rep1',
      versionId: 'ver1',
      status: 'PUBLISHED',
    });
    const reportData = tx.dynReport.create.mock.calls[0][0] as {
      data: { status: string };
    };
    expect(reportData.data.status).toBe('PUBLISHED');

    const versionData = tx.dynReportVersion.create.mock.calls[0][0] as {
      data: { status: string; publishedAt: unknown };
    };
    expect(versionData.data.status).toBe('PUBLISHED');
    expect(versionData.data.publishedAt).toBeInstanceOf(Date);

    const fieldsData = tx.dynReportField.createMany.mock.calls[0][0] as {
      data: Array<{ versionId: string; fieldKey: string }>;
    };
    expect(fieldsData.data).toEqual([
      expect.objectContaining({ versionId: 'ver1', fieldKey: 'Đội 3!C6' }),
    ]);

    const scheduleData = tx.dynReportSchedule.create.mock.calls[0][0] as {
      data: { reportId: string; periodType: string };
    };
    expect(scheduleData.data.reportId).toBe('rep1');
    expect(scheduleData.data.periodType).toBe('MONTHLY');

    const roleData = tx.dynReportRole.create.mock.calls[0][0] as {
      data: { userId: string; role: string };
    };
    expect(roleData.data.userId).toBe('u1');
    expect(roleData.data.role).toBe('MANAGER');

    const targetData = tx.dynReportTarget.create.mock.calls[0][0] as {
      data: { teamId: string };
    };
    expect(targetData.data.teamId).toBe('t1');

    const editorsData = tx.dynReportTargetEditor.createMany.mock
      .calls[0][0] as {
      data: Array<{ targetId: string; userId: string }>;
    };
    expect(editorsData.data).toEqual([{ targetId: 'target1', userId: 'u2' }]);

    expect(tx.dynReportIdempotency.upsert).toHaveBeenCalled();
  });

  it('wraps a duplicate report code (P2002) as REPORT_CODE_TAKEN', async () => {
    const tx = buildTx();
    tx.dynReport.create.mockRejectedValue({ code: 'P2002' });
    const { service } = buildService(tx);

    await expect(
      service.save(baseDraftInput(), BUF, 'mau.xlsx', 'actor1'),
    ).rejects.toMatchObject({ code: 'REPORT_CODE_TAKEN' });
  });

  it('returns the cached result for a retried idempotency key with the identical payload', async () => {
    const tx = buildTx();
    const { service, prisma } = buildService(tx);
    prisma.dynReportIdempotency.findUnique.mockResolvedValue({
      requestHash: 'DOES_NOT_MATTER_WILL_BE_RECOMPUTED',
      resultRef: JSON.stringify({
        reportId: 'rep-old',
        versionId: 'ver-old',
        status: 'DRAFT',
      }),
    });
    const input = baseDraftInput();

    // Recompute the exact hash the service would compute for this input so the
    // mocked "existing" row matches and the cached short-circuit path triggers.
    const rest: Record<string, unknown> = { ...input };
    delete rest.idempotencyKey;
    const hash = createHash('sha256');
    hash.update(JSON.stringify(rest));
    hash.update(BUF);
    prisma.dynReportIdempotency.findUnique.mockResolvedValue({
      requestHash: hash.digest('hex'),
      resultRef: JSON.stringify({
        reportId: 'rep-old',
        versionId: 'ver-old',
        status: 'DRAFT',
      }),
    });

    const result = await service.save(input, BUF, 'mau.xlsx', 'actor1');

    expect(result).toEqual({
      reportId: 'rep-old',
      versionId: 'ver-old',
      status: 'DRAFT',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects a retried idempotency key whose payload changed with IDEMPOTENCY_MISMATCH', async () => {
    const tx = buildTx();
    const { service, prisma } = buildService(tx);
    prisma.dynReportIdempotency.findUnique.mockResolvedValue({
      requestHash: 'some-other-hash',
      resultRef: null,
    });

    await expect(
      service.save(baseDraftInput(), BUF, 'mau.xlsx', 'actor1'),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_MISMATCH' });
  });
});
