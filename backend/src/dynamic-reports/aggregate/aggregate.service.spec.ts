import { NotFoundException } from '@nestjs/common';
import { AggregateService } from './aggregate.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * AggregateService (spec §6.1 PR7 slice 2, S15 thu nhỏ) — pure
 * orchestration over `engine/aggregate.ts`/`engine/status.ts` (PR1).
 * Same mocked-PrismaService pattern as `submission.service.spec.ts`.
 */
describe('AggregateService', () => {
  const FAR_FUTURE_DUE_AT = new Date('2099-01-01T00:00:00Z');
  const NOW_FAKE = new Date('2026-06-15T10:00:00Z');

  const FIELD = {
    fieldKey: 'Đội 3!C6',
    sheetKey: 'Đội 3',
    address: 'C6',
    label: 'Số vụ mới',
    aggregate: 'SUM',
    blankPolicy: 'ZERO',
  };

  function assignment(
    id: string,
    state: string,
    value: string | null,
    overrides: Partial<Record<string, unknown>> = {},
  ) {
    return {
      id,
      teamId: `team-${id}`,
      obligation: 'REQUIRED',
      unlocks: [],
      teamSnapshot: { name: `Team ${id}` },
      submission: {
        state,
        values:
          value !== null ? { [FIELD.fieldKey]: { t: 'NUM', v: value } } : {},
        firstSavedAt: value !== null ? NOW_FAKE : null,
        submittedAt:
          state === 'SUBMITTED' || state === 'APPROVED' ? NOW_FAKE : null,
        currentRevision: 1n,
        updatedAt: NOW_FAKE,
      },
      ...overrides,
    };
  }

  function basePeriod(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 'period1',
      reportId: 'report1',
      versionId: 'version1',
      report: { name: 'HSLN' },
      periodKey: '2026-06',
      startDate: new Date('2026-06-01T00:00:00Z'),
      endDate: new Date('2026-06-30T00:00:00Z'),
      dueAt: FAR_FUTURE_DUE_AT,
      status: 'OPEN',
      version: { fields: [FIELD] },
      assignments: [
        assignment('a1', 'SUBMITTED', '10'),
        assignment('a2', 'APPROVED', '20'),
        assignment('a3', 'DRAFT', '5'),
        assignment('a4', 'NOT_STARTED', null, { obligation: 'EXEMPT' }),
      ],
      ...overrides,
    };
  }

  function buildService(period: unknown, grants: unknown[] = []) {
    const prisma = {
      dynReportPeriod: {
        findUnique: jest.fn().mockResolvedValue(period),
      },
      rolePermission: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      dynReportRole: {
        findFirst: jest.fn().mockResolvedValue(grants[0] ?? null),
      },
    };
    const service = new AggregateService(prisma as unknown as PrismaService);
    return { service, prisma };
  }

  it('rejects (404) when the period does not exist', async () => {
    const { service } = buildService(null);
    await expect(
      service.getPeriodSummary('period1', 'u1', 'role1', 'SUBMITTED'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects (404) when the caller has neither admin:DynamicReport nor a MANAGER role', async () => {
    const { service } = buildService(basePeriod());
    await expect(
      service.getPeriodSummary('period1', 'u1', 'role1', 'SUBMITTED'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('mode=SUBMITTED sums only SUBMITTED+APPROVED contributions (excludes DRAFT and EXEMPT)', async () => {
    const { service } = buildService(basePeriod(), [{ role: 'MANAGER' }]);

    const result = await service.getPeriodSummary(
      'period1',
      'mgr1',
      'roleMgr',
      'SUBMITTED',
    );

    expect(result.fields[0].value).toBe('30');
    expect(result.fields[0].countTotal).toBe(2);
  });

  it('mode=APPROVED sums only APPROVED contributions', async () => {
    const { service } = buildService(basePeriod(), [{ role: 'MANAGER' }]);

    const result = await service.getPeriodSummary(
      'period1',
      'mgr1',
      'roleMgr',
      'APPROVED',
    );

    expect(result.fields[0].value).toBe('20');
    expect(result.fields[0].countTotal).toBe(1);
  });

  it('mode=ALL_SAVED sums every non-exempt contribution regardless of state', async () => {
    const { service } = buildService(basePeriod(), [{ role: 'MANAGER' }]);

    const result = await service.getPeriodSummary(
      'period1',
      'mgr1',
      'roleMgr',
      'ALL_SAVED',
    );

    expect(result.fields[0].value).toBe('35');
    expect(result.fields[0].countTotal).toBe(3);
  });

  it('computes the KPI summary excluding the EXEMPT team from the required denominator', async () => {
    const { service } = buildService(basePeriod(), [{ role: 'MANAGER' }]);

    const result = await service.getPeriodSummary(
      'period1',
      'mgr1',
      'roleMgr',
      'SUBMITTED',
    );

    expect(result.kpi.requiredCount).toBe(3);
    expect(result.kpi.exemptCount).toBe(1);
    expect(result.kpi.completedCount).toBe(2);
    expect(result.kpi.completionRateLabel).toBe('2/3');
    expect(result.kpi.dataCoverageLabel).toBe('3/3');
  });

  it('approves via admin:DynamicReport even without a DynReportRole row', async () => {
    const prisma = {
      dynReportPeriod: {
        findUnique: jest.fn().mockResolvedValue(basePeriod()),
      },
      rolePermission: { findFirst: jest.fn().mockResolvedValue({ id: 'rp1' }) },
      dynReportRole: { findFirst: jest.fn() },
    };
    const service = new AggregateService(prisma as unknown as PrismaService);

    const result = await service.getPeriodSummary(
      'period1',
      'admin1',
      'roleAdmin',
      'SUBMITTED',
    );

    expect(result.fields[0].value).toBe('30');
    expect(prisma.dynReportRole.findFirst).not.toHaveBeenCalled();
  });

  it('a field with aggregate NONE reports displayNotAggregated instead of a value', async () => {
    const { service } = buildService(
      basePeriod({ version: { fields: [{ ...FIELD, aggregate: 'NONE' }] } }),
      [{ role: 'MANAGER' }],
    );

    const result = await service.getPeriodSummary(
      'period1',
      'mgr1',
      'roleMgr',
      'SUBMITTED',
    );

    expect(result.fields[0].displayNotAggregated).toBe(true);
    expect(result.fields[0].value).toBeNull();
  });

  it('S18 — lists exactly the contributing teams behind the aggregate, summing to the same total', async () => {
    const { service } = buildService(basePeriod(), [{ role: 'MANAGER' }]);

    const result = await service.getPeriodSummary(
      'period1',
      'mgr1',
      'roleMgr',
      'SUBMITTED',
    );

    const contributors = result.fields[0].contributors;
    expect(contributors).toHaveLength(2);
    expect(contributors.map((c) => c.teamName).sort()).toEqual([
      'Team a1',
      'Team a2',
    ]);
    const sum = contributors.reduce((acc, c) => acc + Number(c.value ?? 0), 0);
    expect(String(sum)).toBe(result.fields[0].value);
    expect(contributors.every((c) => c.revision === '1')).toBe(true);
  });

  it('S18 — excludes an EXEMPT team and a mode-mismatched team from the contributor list', async () => {
    const { service } = buildService(basePeriod(), [{ role: 'MANAGER' }]);

    const result = await service.getPeriodSummary(
      'period1',
      'mgr1',
      'roleMgr',
      'APPROVED',
    );

    const contributors = result.fields[0].contributors;
    expect(contributors).toHaveLength(1);
    expect(contributors[0].teamName).toBe('Team a2');
    expect(contributors[0].state).toBe('APPROVED');
  });

  describe('finalizePeriod / reopenPeriod (S38, PR7 slice 6)', () => {
    function buildTxService(period: unknown, grants: unknown[] = []) {
      const tx = {
        $queryRaw: jest.fn<Promise<unknown>, unknown[]>(),
        dynReportPeriod: {
          findUnique: jest
            .fn<Promise<unknown>, unknown[]>()
            .mockResolvedValue(period),
          update: jest.fn<Promise<unknown>, unknown[]>(),
        },
        rolePermission: {
          findFirst: jest
            .fn<Promise<unknown>, unknown[]>()
            .mockResolvedValue(null),
        },
        dynReportRole: {
          findFirst: jest
            .fn<Promise<unknown>, unknown[]>()
            .mockResolvedValue(grants[0] ?? null),
        },
        dynReportSnapshot: {
          create: jest
            .fn<Promise<unknown>, unknown[]>()
            .mockResolvedValue({ id: 'snapshot1' }),
          updateMany: jest.fn<Promise<unknown>, unknown[]>(),
        },
      };
      const prisma = {
        $transaction: jest.fn((fn: (t: unknown) => unknown) => fn(tx)),
      };
      const service = new AggregateService(prisma as unknown as PrismaService);
      return { service, tx };
    }

    it('finalizes an OPEN period, writes an official APPROVED snapshot, and flips status', async () => {
      const { service, tx } = buildTxService(basePeriod(), [
        { role: 'MANAGER' },
      ]);

      const result = await service.finalizePeriod('period1', 'mgr1', 'roleMgr');

      expect(result.status).toBe('FINALIZED');
      expect(result.snapshotId).toBe('snapshot1');

      const snapshotCall = tx.dynReportSnapshot.create.mock.calls[0][0] as {
        data: {
          mode: string;
          official: boolean;
          values: Record<string, unknown>;
          periodId: string;
        };
      };
      expect(snapshotCall.data.mode).toBe('APPROVED');
      expect(snapshotCall.data.official).toBe(true);
      // Only a2 is APPROVED — matches the mode=APPROVED contributor rule
      // already proven for getPeriodSummary.
      expect(snapshotCall.data.values[FIELD.fieldKey]).toEqual({
        value: '20',
        countTotal: 1,
        countNonBlank: 1,
      });

      const periodUpdateCall = tx.dynReportPeriod.update.mock.calls[0][0] as {
        data: { status: string; finalizedById: string };
      };
      expect(periodUpdateCall.data.status).toBe('FINALIZED');
      expect(periodUpdateCall.data.finalizedById).toBe('mgr1');
    });

    it('rejects with INVALID_STATE_TRANSITION when the period is already FINALIZED', async () => {
      const { service } = buildTxService(basePeriod({ status: 'FINALIZED' }), [
        { role: 'MANAGER' },
      ]);

      await expect(
        service.finalizePeriod('period1', 'mgr1', 'roleMgr'),
      ).rejects.toMatchObject({ code: 'INVALID_STATE_TRANSITION' });
    });

    it('rejects (404) when the caller is not a manager of this report', async () => {
      const { service } = buildTxService(basePeriod());

      await expect(
        service.finalizePeriod('period1', 'u1', 'role1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('reopens a FINALIZED period as admin, invalidating the prior snapshot with a reason', async () => {
      const { service, tx } = buildTxService(
        basePeriod({ status: 'FINALIZED' }),
      );
      tx.rolePermission.findFirst.mockResolvedValue({ id: 'rp1' });

      const result = await service.reopenPeriod(
        'period1',
        'admin1',
        'roleAdmin',
        'Sai số liệu, cần sửa lại',
      );

      expect(result.status).toBe('OPEN');
      const invalidateCall = tx.dynReportSnapshot.updateMany.mock
        .calls[0][0] as {
        data: { invalidatedReason: string };
      };
      expect(invalidateCall.data.invalidatedReason).toBe(
        'Sai số liệu, cần sửa lại',
      );
      const periodUpdateCall = tx.dynReportPeriod.update.mock.calls[0][0] as {
        data: { status: string };
      };
      expect(periodUpdateCall.data.status).toBe('OPEN');
    });

    it('rejects (404) when a report MANAGER (not admin) tries to reopen', async () => {
      const { service, tx } = buildTxService(
        basePeriod({ status: 'FINALIZED' }),
      );
      tx.dynReportRole.findFirst.mockResolvedValue({ role: 'MANAGER' });

      await expect(
        service.reopenPeriod('period1', 'mgr1', 'roleMgr', 'r'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects with CELL_VALIDATION when the period is not FINALIZED', async () => {
      const { service, tx } = buildTxService(basePeriod({ status: 'OPEN' }));
      tx.rolePermission.findFirst.mockResolvedValue({ id: 'rp1' });

      await expect(
        service.reopenPeriod('period1', 'admin1', 'roleAdmin', 'r'),
      ).rejects.toMatchObject({ code: 'CELL_VALIDATION' });
    });
  });
});
