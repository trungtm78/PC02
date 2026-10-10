import { NotFoundException } from '@nestjs/common';
import { DynamicReportsRegistryService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * S01 report registry (AC-012, AC-035). Scope is computed purely from
 * DynamicReport's own role model — never the app-wide DataScope (spec §10
 * R13). mode=setup requires manage:DynamicReport; mode=manage returns every
 * report for an admin:DynamicReport holder, else only reports where the
 * caller holds an active MANAGER role; mode=input returns reports where the
 * caller is an active target editor.
 */
describe('DynamicReportsRegistryService', () => {
  let service: DynamicReportsRegistryService;
  const prisma = {
    dynReport: { findMany: jest.fn() },
    rolePermission: { findMany: jest.fn() },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DynamicReportsRegistryService(
      prisma as unknown as PrismaService,
    );
  });

  const user = { id: 'user-1', roleId: 'role-1' };

  function lastFindManyArgs(): { where?: Record<string, unknown> } {
    const calls = prisma.dynReport.findMany.mock.calls as unknown as Array<
      [{ where?: Record<string, unknown> }]
    >;
    return calls[0][0];
  }

  describe('mode=setup', () => {
    it('rejects with 404 (anti-probe) when the caller lacks manage:DynamicReport', async () => {
      prisma.rolePermission.findMany.mockResolvedValue([]);

      await expect(service.listReports(user, 'setup')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.dynReport.findMany).not.toHaveBeenCalled();
    });

    it('shapes each report into the full S01 list-page summary (loại kỳ, hạn tiếp theo, quản lý, số tổ, phiên bản)', async () => {
      prisma.rolePermission.findMany.mockResolvedValue([
        { permission: { action: 'manage', subject: 'DynamicReport' } },
      ]);
      prisma.dynReport.findMany.mockResolvedValue([
        {
          id: 'r1',
          code: 'HSLN',
          name: 'Thống kê hình sự liên ngành',
          status: 'PUBLISHED',
          reportingUnit: 'TEAM',
          effectiveFrom: new Date('2026-01-01'),
          updatedAt: new Date('2026-06-01'),
          schedules: [{ periodType: 'MONTHLY' }],
          roles: [
            {
              user: { firstName: 'Văn A', lastName: 'Nguyễn', username: 'nva' },
            },
            { user: { firstName: 'Thị B', lastName: 'Trần', username: 'ttb' } },
          ],
          targets: [{ id: 't1' }, { id: 't2' }, { id: 't3' }],
          versions: [{ version: 3 }],
          periods: [{ dueAt: new Date('2026-07-05T17:00:00Z') }],
        },
      ]);

      const [result] = await service.listReports(user, 'setup');

      expect(result).toMatchObject({
        id: 'r1',
        code: 'HSLN',
        name: 'Thống kê hình sự liên ngành',
        status: 'PUBLISHED',
        periodType: 'MONTHLY',
        nextDueAt: new Date('2026-07-05T17:00:00Z'),
        teamCount: 3,
        latestVersion: 3,
      });
      expect((result as { managers: string[] }).managers).toEqual([
        'Nguyễn Văn A',
        'Trần Thị B',
      ]);
    });

    it('reports null for periodType/nextDueAt/latestVersion and an empty manager list when a report has none configured yet', async () => {
      prisma.rolePermission.findMany.mockResolvedValue([
        { permission: { action: 'manage', subject: 'DynamicReport' } },
      ]);
      prisma.dynReport.findMany.mockResolvedValue([
        {
          id: 'r1',
          code: 'NEW',
          name: 'Báo cáo mới tạo',
          status: 'DRAFT',
          reportingUnit: 'TEAM',
          effectiveFrom: null,
          updatedAt: new Date('2026-06-01'),
          schedules: [],
          roles: [],
          targets: [],
          versions: [],
          periods: [],
        },
      ]);

      const [result] = await service.listReports(user, 'setup');

      expect(result).toMatchObject({
        periodType: null,
        nextDueAt: null,
        managers: [],
        teamCount: 0,
        latestVersion: null,
      });
    });

    it('queries with the right relation filters: active targets, active MANAGER roles, only OPEN periods, latest version', async () => {
      prisma.rolePermission.findMany.mockResolvedValue([
        { permission: { action: 'manage', subject: 'DynamicReport' } },
      ]);
      prisma.dynReport.findMany.mockResolvedValue([]);

      await service.listReports(user, 'setup');

      const args = lastFindManyArgs() as unknown as {
        include: {
          schedules: { where: Record<string, unknown> };
          roles: { where: Record<string, unknown> };
          targets: { where: Record<string, unknown> };
          periods: { where: Record<string, unknown> };
          versions: { orderBy: Record<string, unknown> };
        };
      };
      expect(args.include.schedules.where).toEqual({ supersededAt: null });
      expect(args.include.roles.where.role).toBe('MANAGER');
      expect(args.include.periods.where.status).toBe('OPEN');
      expect(args.include.versions.orderBy).toEqual({ version: 'desc' });
    });
  });

  describe('mode=manage', () => {
    it('returns every report when the caller holds admin:DynamicReport', async () => {
      prisma.rolePermission.findMany.mockResolvedValue([
        { permission: { action: 'admin', subject: 'DynamicReport' } },
      ]);
      prisma.dynReport.findMany.mockResolvedValue([{ id: 'r1' }, { id: 'r2' }]);

      const result = await service.listReports(user, 'manage');

      expect(result).toHaveLength(2);
      expect(lastFindManyArgs().where).toBeUndefined();
    });

    it('filters to reports where the caller holds an active MANAGER or VIEWER role, without admin', async () => {
      prisma.rolePermission.findMany.mockResolvedValue([]);
      prisma.dynReport.findMany.mockResolvedValue([{ id: 'r1' }]);

      await service.listReports(user, 'manage');

      const where = lastFindManyArgs().where as {
        roles: { some: { userId: string; role: unknown } };
      };
      expect(where.roles.some.userId).toBe('user-1');
      expect(where.roles.some.role).toEqual({ in: ['MANAGER', 'VIEWER'] });
    });
  });

  describe('mode=input', () => {
    it('filters to reports where the caller is an active target editor', async () => {
      prisma.rolePermission.findMany.mockResolvedValue([]);
      prisma.dynReport.findMany.mockResolvedValue([{ id: 'r1' }]);

      await service.listReports(user, 'input');

      const where = lastFindManyArgs().where as {
        targets: { some: { editors: { some: { userId: string } } } };
      };
      expect(where.targets.some.editors.some.userId).toBe('user-1');
    });

    it('does not require any DynamicReport grant beyond the route-level read permission', async () => {
      prisma.rolePermission.findMany.mockResolvedValue([]);
      prisma.dynReport.findMany.mockResolvedValue([]);

      await expect(service.listReports(user, 'input')).resolves.toEqual([]);
    });
  });
});
