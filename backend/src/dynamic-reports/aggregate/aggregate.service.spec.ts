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
      obligation: 'REQUIRED',
      unlocks: [],
      submission: {
        state,
        values:
          value !== null ? { [FIELD.fieldKey]: { t: 'NUM', v: value } } : {},
        firstSavedAt: value !== null ? NOW_FAKE : null,
        submittedAt:
          state === 'SUBMITTED' || state === 'APPROVED' ? NOW_FAKE : null,
      },
      ...overrides,
    };
  }

  function basePeriod(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 'period1',
      reportId: 'report1',
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
});
