import { NotFoundException } from '@nestjs/common';
import { AggregateService } from './aggregate.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { TeamsService } from '../../teams/teams.service';

/** R13 (PR7 slice 9) — default has no VIEWER scope in play, so `getDescendantIds` is never called by existing tests. */
function buildTeamsServiceMock(
  descendantsByTeamId: Record<string, string[]> = {},
) {
  return {
    getDescendantIds: jest
      .fn<Promise<string[]>, [string]>()
      .mockImplementation((teamId: string) =>
        Promise.resolve(descendantsByTeamId[teamId] ?? []),
      ),
  } as unknown as TeamsService;
}

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

  function buildService(
    period: unknown,
    grants: Array<{ role: string; teamScopeId?: string | null }> = [],
    teamsService?: TeamsService,
  ) {
    const prisma = {
      dynReportPeriod: {
        findUnique: jest.fn().mockResolvedValue(period),
      },
      rolePermission: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      dynReportRole: {
        // R13: resolveAccessRole queries MANAGER then VIEWER separately — the
        // mock has to honor `where.role` instead of always returning grants[0],
        // or a VIEWER-only grant would get misread as a MANAGER match.
        findFirst: jest
          .fn()
          .mockImplementation((args: { where?: { role?: string } }) =>
            Promise.resolve(
              grants.find((g) => g.role === args?.where?.role) ?? null,
            ),
          ),
      },
    };
    const service = new AggregateService(
      prisma as unknown as PrismaService,
      teamsService ?? buildTeamsServiceMock(),
    );
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

  it('rejects (404) when the caller has a VIEWER role on a different report entirely (no row at all)', async () => {
    const { service } = buildService(basePeriod(), []);
    await expect(
      service.getPeriodSummary('period1', 'viewer1', 'roleViewer', 'SUBMITTED'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('R13: a VIEWER with no teamScopeId sees the whole report, same as a MANAGER', async () => {
    const { service } = buildService(basePeriod(), [
      { role: 'VIEWER', teamScopeId: null },
    ]);

    const result = await service.getPeriodSummary(
      'period1',
      'viewer1',
      'roleViewer',
      'SUBMITTED',
    );

    expect(result.fields[0].value).toBe('30');
    expect(result.fields[0].countTotal).toBe(2);
  });

  it("R13: a VIEWER scoped to one team subtree only sees that subtree's contributions", async () => {
    const { service, prisma } = buildService(
      basePeriod(),
      [{ role: 'VIEWER', teamScopeId: 'team-a1' }],
      buildTeamsServiceMock({ 'team-a1': [] }),
    );

    const result = await service.getPeriodSummary(
      'period1',
      'viewer1',
      'roleViewer',
      'SUBMITTED',
    );

    // only a1 (SUBMITTED, '10') is in scope — a2 ('20', team-a2) is filtered out
    // even though it would otherwise contribute under mode=SUBMITTED+APPROVED.
    expect(result.fields[0].value).toBe('10');
    expect(result.fields[0].countTotal).toBe(1);
    expect(result.kpi.requiredCount).toBe(1);
    expect(prisma.dynReportRole.findFirst).toHaveBeenCalled();
  });

  it("R13: a VIEWER scoped to a parent team also sees its descendants' contributions", async () => {
    const { service } = buildService(
      basePeriod(),
      [{ role: 'VIEWER', teamScopeId: 'team-parent' }],
      buildTeamsServiceMock({ 'team-parent': ['team-a1', 'team-a2'] }),
    );

    const result = await service.getPeriodSummary(
      'period1',
      'viewer1',
      'roleViewer',
      'SUBMITTED',
    );

    // a1 + a2 both fall under team-parent's subtree -> same total as an unscoped MANAGER.
    expect(result.fields[0].value).toBe('30');
    expect(result.fields[0].countTotal).toBe(2);
  });

  it('approves via admin:DynamicReport even without a DynReportRole row', async () => {
    const prisma = {
      dynReportPeriod: {
        findUnique: jest.fn().mockResolvedValue(basePeriod()),
      },
      rolePermission: { findFirst: jest.fn().mockResolvedValue({ id: 'rp1' }) },
      dynReportRole: { findFirst: jest.fn() },
    };
    const service = new AggregateService(
      prisma as unknown as PrismaService,
      buildTeamsServiceMock(),
    );

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
      const service = new AggregateService(
        prisma as unknown as PrismaService,
        buildTeamsServiceMock(),
      );
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

  describe('exportPeriod / getExportForDownload (S25, PR7 slice 7)', () => {
    function buildExportService(
      period: unknown,
      grants: unknown[] = [],
      overrides: Partial<Record<string, unknown>> = {},
    ) {
      const prisma = {
        dynReportPeriod: {
          findUnique: jest
            .fn<Promise<unknown>, unknown[]>()
            .mockResolvedValue(period),
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
          findFirst: jest
            .fn<Promise<unknown>, unknown[]>()
            .mockResolvedValue(null),
        },
        dynReportExport: {
          create: jest
            .fn<Promise<unknown>, unknown[]>()
            .mockResolvedValue({ id: 'export1' }),
          findUnique: jest.fn<Promise<unknown>, unknown[]>(),
        },
        ...overrides,
      };
      const service = new AggregateService(
        prisma as unknown as PrismaService,
        buildTeamsServiceMock(),
      );
      return { service, prisma };
    }

    it('creates an export with the correct file name using the live APPROVED aggregate for an OPEN period', async () => {
      const { service, prisma } = buildExportService(basePeriod(), [
        { role: 'MANAGER' },
      ]);

      const result = await service.exportPeriod('period1', 'mgr1', 'roleMgr');

      expect(result.exportId).toBe('export1');
      expect(result.fileName).toBe('HSLN-2026-06.xlsx');
      const createCall = prisma.dynReportExport.create.mock.calls[0][0] as {
        data: { kind: string; status: string; requestedById: string };
      };
      expect(createCall.data.kind).toBe('MANAGER_FULL');
      expect(createCall.data.status).toBe('READY');
      expect(createCall.data.requestedById).toBe('mgr1');
      // mode=APPROVED live aggregate: same rule already proven for
      // getPeriodSummary — only a2 (APPROVED) contributes.
      expect(prisma.dynReportSnapshot.findFirst.mock.calls.length).toBe(0);
    });

    it('uses the frozen official snapshot values when the period is FINALIZED', async () => {
      const { service, prisma } = buildExportService(
        basePeriod({ status: 'FINALIZED' }),
        [{ role: 'MANAGER' }],
      );
      prisma.dynReportSnapshot.findFirst.mockResolvedValue({
        id: 'snapshot1',
        values: {
          [FIELD.fieldKey]: { value: '999', countTotal: 1, countNonBlank: 1 },
        },
      });

      await service.exportPeriod('period1', 'mgr1', 'roleMgr');

      const createCall = prisma.dynReportExport.create.mock.calls[0][0] as {
        data: { snapshotId: string };
      };
      expect(createCall.data.snapshotId).toBe('snapshot1');
    });

    it('rejects (404) when the caller is not a manager of this report', async () => {
      const { service } = buildExportService(basePeriod());

      await expect(
        service.exportPeriod('period1', 'u1', 'role1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('getExportForDownload returns the stored bytes for a manager within the TTL and matching scope', async () => {
      const { service, prisma } = buildExportService(basePeriod(), [
        { role: 'MANAGER' },
      ]);
      prisma.dynReportExport.findUnique.mockResolvedValue({
        fileBytes: Buffer.from('fake-xlsx'),
        fileName: 'HSLN-2026-06.xlsx',
        scope: { periodId: 'period1', reportId: 'report1' },
        expiresAt: new Date(Date.now() + 60_000),
        contributorSetHash: null,
      });

      const result = await service.getExportForDownload(
        'export1',
        'mgr1',
        'roleMgr',
      );

      expect(result.fileName).toBe('HSLN-2026-06.xlsx');
      expect(result.fileBytes.toString()).toBe('fake-xlsx');
    });

    it('rejects (404) when the export row does not exist', async () => {
      const { service, prisma } = buildExportService(basePeriod());
      prisma.dynReportExport.findUnique.mockResolvedValue(null);

      await expect(
        service.getExportForDownload('export1', 'mgr1', 'roleMgr'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects (404) when the caller is not a manager of the underlying report', async () => {
      const { service, prisma } = buildExportService(basePeriod());
      prisma.dynReportExport.findUnique.mockResolvedValue({
        fileBytes: Buffer.from('x'),
        fileName: 'f.xlsx',
        scope: { periodId: 'period1', reportId: 'report1' },
        expiresAt: new Date(Date.now() + 60_000),
        contributorSetHash: null,
      });

      await expect(
        service.getExportForDownload('export1', 'u1', 'role1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects with CELL_VALIDATION when the export has expired', async () => {
      const { service, prisma } = buildExportService(basePeriod(), [
        { role: 'MANAGER' },
      ]);
      prisma.dynReportExport.findUnique.mockResolvedValue({
        fileBytes: Buffer.from('x'),
        fileName: 'f.xlsx',
        scope: { periodId: 'period1', reportId: 'report1' },
        expiresAt: new Date(Date.now() - 1000),
        contributorSetHash: null,
      });

      await expect(
        service.getExportForDownload('export1', 'mgr1', 'roleMgr'),
      ).rejects.toMatchObject({ code: 'CELL_VALIDATION' });
    });

    it('rejects with CELL_VALIDATION when the contributor set has changed since export (R13)', async () => {
      const { service, prisma } = buildExportService(basePeriod(), [
        { role: 'MANAGER' },
      ]);
      prisma.dynReportExport.findUnique.mockResolvedValue({
        fileBytes: Buffer.from('x'),
        fileName: 'f.xlsx',
        scope: { periodId: 'period1', reportId: 'report1' },
        expiresAt: new Date(Date.now() + 60_000),
        contributorSetHash: 'stale-hash-no-longer-matching',
      });

      await expect(
        service.getExportForDownload('export1', 'mgr1', 'roleMgr'),
      ).rejects.toMatchObject({ code: 'CELL_VALIDATION' });
    });
  });

  describe('getReportHistory (S21, PR7 slice 8)', () => {
    function buildHistoryService(
      period: unknown,
      grants: Array<{ role: string; teamScopeId?: string | null }> = [],
      teamsService?: TeamsService,
    ) {
      const prisma = {
        dynReportPeriod: {
          findUnique: jest
            .fn<Promise<unknown>, unknown[]>()
            .mockResolvedValue(period),
        },
        rolePermission: {
          findFirst: jest
            .fn<Promise<unknown>, unknown[]>()
            .mockResolvedValue(null),
        },
        dynReportRole: {
          findFirst: jest
            .fn()
            .mockImplementation((args: { where?: { role?: string } }) =>
              Promise.resolve(
                grants.find((g) => g.role === args?.where?.role) ?? null,
              ),
            ),
        },
      };
      const service = new AggregateService(
        prisma as unknown as PrismaService,
        teamsService ?? buildTeamsServiceMock(),
      );
      return { service, prisma };
    }

    const ACTOR = { firstName: 'Văn', lastName: 'Nguyễn', username: 'nv' };

    function historyPeriod(overrides: Partial<Record<string, unknown>> = {}) {
      return {
        id: 'period1',
        reportId: 'report1',
        report: { name: 'HSLN' },
        periodKey: '2026-06',
        assignments: [
          {
            id: 'a1',
            teamId: 'team-a1',
            teamSnapshot: { name: 'Đội 3' },
            submission: {
              state: 'SUBMITTED',
              currentRevision: 2n,
              values: { 'Đội 3!C6': { t: 'NUM', v: '20' } },
              firstSubmittedRevision: 1n,
              revisions: [
                {
                  revision: 1n,
                  kind: 'SUBMIT',
                  reason: null,
                  committedAt: new Date('2026-06-10T08:00:00Z'),
                  valuesFull: { 'Đội 3!C6': { t: 'NUM', v: '10' } },
                  actor: ACTOR,
                },
                {
                  revision: 2n,
                  kind: 'SAVE',
                  reason: null,
                  committedAt: new Date('2026-06-11T08:00:00Z'),
                  valuesFull: null,
                  actor: ACTOR,
                },
              ],
            },
          },
          {
            id: 'a2',
            teamId: 'team-a2',
            teamSnapshot: { name: 'Đội 4' },
            submission: {
              state: 'NOT_STARTED',
              currentRevision: 0n,
              values: {},
              firstSubmittedRevision: null,
              revisions: [],
            },
          },
        ],
        ...overrides,
      };
    }

    it('rejects (404) when the period does not exist', async () => {
      const { service } = buildHistoryService(null);
      await expect(
        service.getReportHistory('period1', 'u1', 'role1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects (404) when the caller is not a manager of this report', async () => {
      const { service } = buildHistoryService(historyPeriod());
      await expect(
        service.getReportHistory('period1', 'u1', 'role1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("R13: a VIEWER scoped to one team subtree only sees that subtree's assignments", async () => {
      const { service } = buildHistoryService(
        historyPeriod(),
        [{ role: 'VIEWER', teamScopeId: 'team-a1' }],
        buildTeamsServiceMock({ 'team-a1': [] }),
      );

      const result = await service.getReportHistory(
        'period1',
        'viewer1',
        'roleViewer',
      );

      expect(result.assignments).toHaveLength(1);
      expect(result.assignments[0].assignmentId).toBe('a1');
    });

    it('R13: a VIEWER with no teamScopeId sees every assignment, same as a MANAGER', async () => {
      const { service } = buildHistoryService(historyPeriod(), [
        { role: 'VIEWER', teamScopeId: null },
      ]);

      const result = await service.getReportHistory(
        'period1',
        'viewer1',
        'roleViewer',
      );

      expect(result.assignments).toHaveLength(2);
    });

    it('lists every assignment with its metadata-only revision history', async () => {
      const { service } = buildHistoryService(historyPeriod(), [
        { role: 'MANAGER' },
      ]);

      const result = await service.getReportHistory(
        'period1',
        'mgr1',
        'roleMgr',
      );

      expect(result.reportName).toBe('HSLN');
      expect(result.assignments).toHaveLength(2);
      const a1 = result.assignments.find((a) => a.assignmentId === 'a1');
      expect(a1?.teamName).toBe('Đội 3');
      expect(a1?.revisions).toHaveLength(2);
      expect(a1?.revisions[0]).toMatchObject({
        revision: '1',
        kind: 'SUBMIT',
        actorName: 'Văn Nguyễn',
      });
      // R10: never the raw values in the metadata-only revisions array.
      expect(a1?.revisions[0]).not.toHaveProperty('valuesFull');
      expect(a1?.revisions[0]).not.toHaveProperty('diff');
    });

    it('computes changedFieldKeysSinceFirstSubmit by comparing the first SUBMIT snapshot to current values', async () => {
      const { service } = buildHistoryService(historyPeriod(), [
        { role: 'MANAGER' },
      ]);

      const result = await service.getReportHistory(
        'period1',
        'mgr1',
        'roleMgr',
      );

      const a1 = result.assignments.find((a) => a.assignmentId === 'a1');
      // first submit had '10', current is '20' -> changed.
      expect(a1?.changedFieldKeysSinceFirstSubmit).toEqual(['Đội 3!C6']);
    });

    it('returns null for changedFieldKeysSinceFirstSubmit when the team has never submitted', async () => {
      const { service } = buildHistoryService(historyPeriod(), [
        { role: 'MANAGER' },
      ]);

      const result = await service.getReportHistory(
        'period1',
        'mgr1',
        'roleMgr',
      );

      const a2 = result.assignments.find((a) => a.assignmentId === 'a2');
      expect(a2?.changedFieldKeysSinceFirstSubmit).toBeNull();
      expect(a2?.revisions).toEqual([]);
    });

    it('returns an empty changed-keys list when current values exactly match the first submission', async () => {
      const period = historyPeriod();
      (
        period.assignments[0] as { submission: { values: unknown } }
      ).submission.values = {
        'Đội 3!C6': { t: 'NUM', v: '10' },
      };
      const { service } = buildHistoryService(period, [{ role: 'MANAGER' }]);

      const result = await service.getReportHistory(
        'period1',
        'mgr1',
        'roleMgr',
      );

      const a1 = result.assignments.find((a) => a.assignmentId === 'a1');
      expect(a1?.changedFieldKeysSinceFirstSubmit).toEqual([]);
    });
  });
});
