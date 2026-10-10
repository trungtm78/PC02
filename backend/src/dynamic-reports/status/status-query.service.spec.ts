import { StatusQueryService } from './status-query.service';
import { PrismaService } from '../../prisma/prisma.service';
import type { TeamsService } from '../../teams/teams.service';

/**
 * StatusQueryService (spec §6.1 PR8 S19/S23) — the first cross-report
 * read in this module. Same mocked-PrismaService pattern as
 * `aggregate.service.spec.ts`/`submission.service.spec.ts`.
 */
describe('StatusQueryService', () => {
  const NOW_FAKE = new Date('2026-06-15T10:00:00Z');
  const FAR_FUTURE = new Date('2099-01-01T00:00:00Z');
  const FAR_PAST = new Date('2020-01-01T00:00:00Z');

  const FIELD = { fieldKey: 'Đội 3!C6', sheetKey: 'Đội 3', address: 'C6' };

  function assignment(
    id: string,
    overrides: Partial<Record<string, unknown>> = {},
  ) {
    return {
      id,
      teamId: `team-${id}`,
      periodId: 'period1',
      obligation: 'REQUIRED',
      teamSnapshot: { name: `Team ${id}` },
      unlocks: [],
      period: {
        id: 'period1',
        reportId: 'report1',
        report: { name: 'HSLN' },
        periodKey: '2026-06',
        startDate: new Date('2026-06-01T00:00:00Z'),
        endDate: new Date('2026-06-30T00:00:00Z'),
        dueAt: FAR_FUTURE,
        status: 'OPEN',
        version: { fields: [FIELD] },
      },
      submission: {
        state: 'NOT_STARTED',
        values: {},
        firstSavedAt: null,
        submittedAt: null,
        approvedAt: null,
        updatedAt: null,
      },
      ...overrides,
    };
  }

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

  function buildService(
    assignments: unknown[],
    opts: { isAdmin?: boolean; roles?: Array<{ reportId: string }> } = {},
    teams: unknown[] = [],
  ) {
    const prisma = {
      rolePermission: {
        findFirst: jest
          .fn<Promise<unknown>, unknown[]>()
          .mockResolvedValue(opts.isAdmin ? { id: 'rp1' } : null),
      },
      dynReportRole: {
        findMany: jest
          .fn<Promise<unknown>, unknown[]>()
          .mockResolvedValue(opts.roles ?? []),
      },
      dynReportAssignment: {
        findMany: jest
          .fn<Promise<unknown>, unknown[]>()
          .mockResolvedValue(assignments),
      },
      team: {
        findMany: jest
          .fn<Promise<unknown>, unknown[]>()
          .mockResolvedValue(teams),
      },
    };
    const service = new StatusQueryService(
      prisma as unknown as PrismaService,
      buildTeamsServiceMock(),
    );
    return { service, prisma };
  }

  it('returns an empty result without querying assignments when the caller has no role at all', async () => {
    const { service, prisma } = buildService([], { roles: [] });
    const result = await service.listAssignmentStatuses('u1', 'role1', {});

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(typeof result.asOf).toBe('string');
    expect(prisma.dynReportAssignment.findMany).not.toHaveBeenCalled();
  });

  it('admin:DynamicReport sees every assignment without filtering by reportId', async () => {
    const { service, prisma } = buildService([assignment('a1')], {
      isAdmin: true,
    });
    const result = await service.listAssignmentStatuses(
      'admin1',
      'roleAdmin',
      {},
    );

    expect(result.items).toHaveLength(1);
    const call = prisma.dynReportAssignment.findMany.mock.calls[0][0] as {
      where: { period: Record<string, unknown> };
    };
    expect(call.where.period.reportId).toBeUndefined();
    expect(prisma.dynReportRole.findMany).not.toHaveBeenCalled();
  });

  it('a non-admin only sees assignments under reports they have a role on', async () => {
    const { service, prisma } = buildService([assignment('a1')], {
      roles: [{ reportId: 'report1' }],
    });
    await service.listAssignmentStatuses('mgr1', 'roleMgr', {});

    const call = prisma.dynReportAssignment.findMany.mock.calls[0][0] as {
      where: { period: { reportId: { in: string[] } } };
    };
    expect(call.where.period.reportId.in).toEqual(['report1']);
  });

  it('computes dataCoverageLabel from the submission values against the version fields', async () => {
    const { service } = buildService(
      [
        assignment('a1', {
          submission: {
            state: 'DRAFT',
            values: { 'Đội 3!C6': { t: 'NUM', v: '10' } },
            firstSavedAt: NOW_FAKE,
            submittedAt: null,
            approvedAt: null,
            updatedAt: NOW_FAKE,
          },
        }),
      ],
      { isAdmin: true },
    );
    const result = await service.listAssignmentStatuses(
      'admin1',
      'roleAdmin',
      {},
    );

    expect(result.items[0].dataCoverageLabel).toBe('1/1');
  });

  it('computes accessState=REOPENED and timelinessState=OVERDUE_NOT_DONE for a past-due team with an active grant', async () => {
    const { service } = buildService(
      [
        assignment('a1', {
          period: {
            id: 'period1',
            reportId: 'report1',
            report: { name: 'HSLN' },
            periodKey: '2026-06',
            startDate: new Date('2026-06-01T00:00:00Z'),
            endDate: new Date('2026-06-30T00:00:00Z'),
            dueAt: FAR_PAST,
            status: 'OPEN',
            version: { fields: [FIELD] },
          },
          unlocks: [
            {
              startsAt: new Date(Date.now() - 1000 * 60 * 60),
              expiresAt: new Date(Date.now() + 1000 * 60 * 60),
              revokedAt: null,
            },
          ],
        }),
      ],
      { isAdmin: true },
    );
    const result = await service.listAssignmentStatuses(
      'admin1',
      'roleAdmin',
      {},
    );

    expect(result.items[0].accessState).toBe('REOPENED');
    expect(result.items[0].timelinessState).toBe('OVERDUE_NOT_DONE');
    expect(result.items[0].effectiveLockAt).not.toBeNull();
  });

  it('computes changedSinceReopen=true when the submission was updated after the latest grant started', async () => {
    const grantStart = new Date('2026-06-10T00:00:00Z');
    const { service } = buildService(
      [
        assignment('a1', {
          unlocks: [
            { startsAt: grantStart, expiresAt: FAR_FUTURE, revokedAt: null },
          ],
          submission: {
            state: 'DRAFT',
            values: {},
            firstSavedAt: NOW_FAKE,
            submittedAt: null,
            approvedAt: null,
            updatedAt: new Date('2026-06-11T00:00:00Z'),
          },
        }),
      ],
      { isAdmin: true },
    );
    const result = await service.listAssignmentStatuses(
      'admin1',
      'roleAdmin',
      {},
    );

    expect(result.items[0].changedSinceReopen).toBe(true);
    expect(result.items[0].grantCount).toBe(1);
  });

  it('filters by overdue=true, keeping only OVERDUE_NOT_DONE rows', async () => {
    const overdue = assignment('a1', {
      period: { ...assignment('a1').period, dueAt: FAR_PAST },
    });
    const onTime = assignment('a2');
    const { service } = buildService([overdue, onTime], { isAdmin: true });

    const result = await service.listAssignmentStatuses('admin1', 'roleAdmin', {
      overdue: true,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].assignmentId).toBe('a1');
  });

  it('filters by teamId, including descendants (cây tổ)', async () => {
    const getDescendantIds = jest
      .fn<Promise<string[]>, [string]>()
      .mockResolvedValue(['team-child']);
    const teamsService = { getDescendantIds } as unknown as TeamsService;
    const prisma = {
      rolePermission: {
        findFirst: jest
          .fn<Promise<unknown>, unknown[]>()
          .mockResolvedValue({ id: 'rp1' }),
      },
      dynReportRole: {
        findMany: jest.fn<Promise<unknown>, unknown[]>().mockResolvedValue([]),
      },
      dynReportAssignment: {
        findMany: jest.fn<Promise<unknown>, unknown[]>().mockResolvedValue([]),
      },
      team: {
        findMany: jest.fn<Promise<unknown>, unknown[]>().mockResolvedValue([]),
      },
    };
    const service = new StatusQueryService(
      prisma as unknown as PrismaService,
      teamsService,
    );

    await service.listAssignmentStatuses('admin1', 'roleAdmin', {
      teamId: 'team-parent',
    });

    expect(getDescendantIds).toHaveBeenCalledWith('team-parent');
    const call = prisma.dynReportAssignment.findMany.mock.calls[0][0] as {
      where: { teamId: { in: string[] } };
    };
    expect(call.where.teamId.in).toEqual(['team-parent', 'team-child']);
  });

  it('sorts overdue-not-done rows first, then by soonest dueAt', async () => {
    const overdue = assignment('a1', {
      period: { ...assignment('a1').period, dueAt: FAR_PAST },
    });
    const dueSoon = assignment('a2', {
      period: {
        ...assignment('a2').period,
        dueAt: new Date(Date.now() + 1000 * 60 * 60),
      },
    });
    const dueLater = assignment('a3', {
      period: { ...assignment('a3').period, dueAt: FAR_FUTURE },
    });
    const { service } = buildService([dueLater, dueSoon, overdue], {
      isAdmin: true,
    });

    const result = await service.listAssignmentStatuses(
      'admin1',
      'roleAdmin',
      {},
    );

    expect(result.items.map((r) => r.assignmentId)).toEqual(['a1', 'a2', 'a3']);
  });

  it('paginates with the default page size (25) and clamps an oversized pageSize to 100', async () => {
    const assignments = Array.from({ length: 30 }, (_, i) =>
      assignment(`a${i}`),
    );
    const { service } = buildService(assignments, { isAdmin: true });

    const page1 = await service.listAssignmentStatuses(
      'admin1',
      'roleAdmin',
      {},
    );
    expect(page1.items).toHaveLength(25);
    expect(page1.total).toBe(30);

    const page2 = await service.listAssignmentStatuses(
      'admin1',
      'roleAdmin',
      {},
      2,
    );
    expect(page2.items).toHaveLength(5);

    const oversized = await service.listAssignmentStatuses(
      'admin1',
      'roleAdmin',
      {},
      1,
      10_000,
    );
    expect(oversized.items).toHaveLength(30);
  });

  it('resolves parentTeamName from the Team hierarchy, not the assignment snapshot', async () => {
    const { service } = buildService(
      [assignment('a1', { teamId: 'team-child' })],
      { isAdmin: true },
      [{ id: 'team-child', parent: { name: 'Đội mẹ' } }],
    );
    const result = await service.listAssignmentStatuses(
      'admin1',
      'roleAdmin',
      {},
    );

    expect(result.items[0].parentTeamName).toBe('Đội mẹ');
  });

  it('kpi reflects the pre-overdue/reopened-filter scope (same report/period/team filters)', async () => {
    const overdue = assignment('a1', {
      period: { ...assignment('a1').period, dueAt: FAR_PAST },
    });
    const onTime = assignment('a2');
    const { service } = buildService([overdue, onTime], { isAdmin: true });

    const result = await service.listAssignmentStatuses('admin1', 'roleAdmin', {
      overdue: true,
    });

    // only 1 item shown (overdue=true), but KPI still counts both.
    expect(result.items).toHaveLength(1);
    expect(result.kpi.requiredCount).toBe(2);
  });
});
