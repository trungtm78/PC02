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

  describe('mode=setup', () => {
    it('returns every report when the caller holds manage:DynamicReport', async () => {
      prisma.rolePermission.findMany.mockResolvedValue([
        { permission: { action: 'manage', subject: 'DynamicReport' } },
      ]);
      prisma.dynReport.findMany.mockResolvedValue([{ id: 'r1' }]);

      const result = await service.listReports(user, 'setup');

      expect(result).toEqual([{ id: 'r1' }]);
      expect(prisma.dynReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { updatedAt: 'desc' } }),
      );
      // setup is global — no role/scope filter in the where clause
      expect(prisma.dynReport.findMany.mock.calls[0][0].where).toBeUndefined();
    });

    it('rejects with 404 (anti-probe) when the caller lacks manage:DynamicReport', async () => {
      prisma.rolePermission.findMany.mockResolvedValue([]);

      await expect(service.listReports(user, 'setup')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.dynReport.findMany).not.toHaveBeenCalled();
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
      expect(prisma.dynReport.findMany.mock.calls[0][0].where).toBeUndefined();
    });

    it('filters to reports where the caller holds an active MANAGER or VIEWER role, without admin', async () => {
      prisma.rolePermission.findMany.mockResolvedValue([]);
      prisma.dynReport.findMany.mockResolvedValue([{ id: 'r1' }]);

      await service.listReports(user, 'manage');

      const where = prisma.dynReport.findMany.mock.calls[0][0].where;
      expect(where.roles.some.userId).toBe('user-1');
      expect(where.roles.some.role).toEqual({ in: ['MANAGER', 'VIEWER'] });
    });
  });

  describe('mode=input', () => {
    it('filters to reports where the caller is an active target editor', async () => {
      prisma.rolePermission.findMany.mockResolvedValue([]);
      prisma.dynReport.findMany.mockResolvedValue([{ id: 'r1' }]);

      await service.listReports(user, 'input');

      const where = prisma.dynReport.findMany.mock.calls[0][0].where;
      expect(where.targets.some.editors.some.userId).toBe('user-1');
    });

    it('does not require any DynamicReport grant beyond the route-level read permission', async () => {
      prisma.rolePermission.findMany.mockResolvedValue([]);
      prisma.dynReport.findMany.mockResolvedValue([]);

      await expect(service.listReports(user, 'input')).resolves.toEqual([]);
    });
  });
});
