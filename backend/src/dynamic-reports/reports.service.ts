import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { DynReportListMode } from './dto/list-reports-query.dto';

export interface ReportSummary {
  id: string;
  code: string;
  name: string;
  status: string;
  reportingUnit: string;
  effectiveFrom: Date | null;
  updatedAt: Date;
}

interface CurrentUser {
  id: string;
  roleId: string;
}

const REPORT_SUMMARY_SELECT = {
  id: true,
  code: true,
  name: true,
  status: true,
  reportingUnit: true,
  effectiveFrom: true,
  updatedAt: true,
} as const;

/**
 * S01 report registry list (AC-012, AC-035). Scope is computed purely from
 * DynamicReport's own role model (DynReportRole, DynReportTargetEditor) and
 * the manage/admin:DynamicReport permissions — never from the app-wide
 * DataScope (spec §10 R13: "Không dùng DataScope chung").
 *
 * Requesting a mode the caller has no standing for returns 404 (mã lỗi
 * FORBIDDEN, spec §4.2) rather than 403 — this module deliberately avoids
 * confirming to the caller which modes exist for them.
 */
@Injectable()
export class DynamicReportsRegistryService {
  constructor(private readonly prisma: PrismaService) {}

  async listReports(
    user: CurrentUser,
    mode: DynReportListMode,
  ): Promise<ReportSummary[]> {
    const grants = await this.getGrants(user.roleId);
    const now = new Date();

    if (mode === 'setup') {
      if (!grants.manage) {
        throw new NotFoundException('FORBIDDEN');
      }
      return this.prisma.dynReport.findMany({
        select: REPORT_SUMMARY_SELECT,
        orderBy: { updatedAt: 'desc' },
      });
    }

    if (mode === 'manage') {
      if (grants.admin) {
        return this.prisma.dynReport.findMany({
          select: REPORT_SUMMARY_SELECT,
          orderBy: { updatedAt: 'desc' },
        });
      }
      // MANAGER (approve/unlock) and VIEWER (leadership read-only, D10) both
      // land in "manage" mode — VIEWER never appears in "input" since they
      // are not a DynReportTargetEditor.
      return this.prisma.dynReport.findMany({
        where: {
          roles: {
            some: {
              userId: user.id,
              role: { in: ['MANAGER', 'VIEWER'] },
              validFrom: { lte: now },
              OR: [{ validTo: null }, { validTo: { gt: now } }],
            },
          },
        },
        select: REPORT_SUMMARY_SELECT,
        orderBy: { updatedAt: 'desc' },
      });
    }

    // mode === 'input'
    return this.prisma.dynReport.findMany({
      where: {
        targets: {
          some: {
            validFrom: { lte: now },
            OR: [{ validTo: null }, { validTo: { gt: now } }],
            editors: {
              some: {
                userId: user.id,
                validFrom: { lte: now },
                OR: [{ validTo: null }, { validTo: { gt: now } }],
              },
            },
          },
        },
      },
      select: REPORT_SUMMARY_SELECT,
      orderBy: { updatedAt: 'desc' },
    });
  }

  private async getGrants(
    roleId: string,
  ): Promise<{ manage: boolean; admin: boolean }> {
    const rolePerms = await this.prisma.rolePermission.findMany({
      where: { roleId, permission: { subject: 'DynamicReport' } },
      include: { permission: true },
    });
    return {
      manage: rolePerms.some((rp) => rp.permission.action === 'manage'),
      admin: rolePerms.some((rp) => rp.permission.action === 'admin'),
    };
  }
}
