import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { hoTenCanBo } from '../../common/xuat-danh-sach/dinh-dang';
import { ReportConfigError } from './report-config.service';

const PERIODS_SHOWN = 12;

export interface ReportDetailField {
  sheetKey: string;
  address: string;
  fieldKey: string;
  label: string;
  type: string;
  format: string | null;
  aggregate: string;
  blankPolicy: string;
  required: boolean;
  min: string | null;
  max: string | null;
  scale: number | null;
  maxLength: number | null;
  helpText: string | null;
  source: string;
}

export interface ReportDetailRule {
  name: string;
  leftExpr: string;
  operator: string;
  rightExpr: string;
  severity: string;
  message: string;
  missingStrategy: string | null;
  origin: string;
}

export interface ReportDetailVersion {
  versionId: string;
  version: number;
  status: string;
  fileName: string;
  selectedSheets: string[];
  dateSystem: string;
  publishedAt: string | null;
  createdAt: string;
  fields: ReportDetailField[];
  rules: ReportDetailRule[];
}

export interface ReportDetailPeriod {
  periodId: string;
  periodKey: string;
  status: string;
  startDate: string;
  endDate: string;
  opensAt: string;
  dueAt: string;
  version: number;
  teamCount: number;
  submittedCount: number;
}

export interface ReportDetailView {
  id: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  reportingUnit: string;
  effectiveFrom: string | null;
  configVersion: number;
  createdAt: string;
  updatedAt: string;
  schedule: {
    periodType: string;
    periodStartDay: number | null;
    dueRule: unknown;
    openRule: unknown;
    shiftNonWorking: boolean;
    oneTimeDate: string | null;
    timezone: string;
    effectiveFrom: string;
  } | null;
  roles: Array<{ userId: string; name: string; role: string; teamScopeId: string | null }>;
  targets: Array<{
    teamId: string;
    teamCode: string;
    teamName: string;
    editors: Array<{ userId: string; name: string }>;
  }>;
  /** The version that applies going forward: the newest PUBLISHED one, else the newest of any kind (a draft). */
  currentVersion: ReportDetailVersion | null;
  versionCount: number;
  periods: ReportDetailPeriod[];
  periodTotal: number;
}

const SUBMITTED_STATES = ['SUBMITTED', 'APPROVED'];

/**
 * S01 "Xem" — the whole configuration of one report in a single read: what it is, when it runs, who manages and
 * who types for which team, which cells are inputs, and how the latest periods stand. Read-only; every change goes
 * through its own endpoint so each one can carry its own rules (D09).
 */
@Injectable()
export class ReportDetailService {
  constructor(private readonly prisma: PrismaService) {}

  async getDetail(reportId: string): Promise<ReportDetailView> {
    const now = new Date();
    const report = await this.prisma.dynReport.findUnique({
      where: { id: reportId },
      include: {
        schedules: { where: { supersededAt: null }, orderBy: { effectiveFrom: 'desc' }, take: 1 },
        roles: {
          where: { validFrom: { lte: now }, OR: [{ validTo: null }, { validTo: { gt: now } }] },
          include: { user: { select: { firstName: true, lastName: true, username: true } } },
          orderBy: [{ role: 'asc' }, { validFrom: 'asc' }],
        },
        targets: {
          where: { validFrom: { lte: now }, OR: [{ validTo: null }, { validTo: { gt: now } }] },
          include: {
            team: { select: { code: true, name: true } },
            editors: {
              where: { validFrom: { lte: now }, OR: [{ validTo: null }, { validTo: { gt: now } }] },
              include: { user: { select: { firstName: true, lastName: true, username: true } } },
            },
          },
          orderBy: { validFrom: 'asc' },
        },
      },
    });
    if (!report) {
      throw new ReportConfigError('Không tìm thấy báo cáo này.', 'REPORT_NOT_FOUND');
    }

    const versionCount = await this.prisma.dynReportVersion.count({ where: { reportId } });
    const published = await this.prisma.dynReportVersion.findFirst({
      where: { reportId, status: 'PUBLISHED' },
      orderBy: { version: 'desc' },
      select: { id: true },
    });
    const current = await this.prisma.dynReportVersion.findFirst({
      where: published ? { id: published.id } : { reportId },
      orderBy: { version: 'desc' },
      // The file bytes are the heavy column and nothing here needs them.
      select: {
        id: true,
        version: true,
        status: true,
        fileName: true,
        selectedSheets: true,
        dateSystem: true,
        publishedAt: true,
        createdAt: true,
        fields: { orderBy: [{ sheetKey: 'asc' }, { id: 'asc' }] },
        rules: { orderBy: { id: 'asc' } },
      },
    });

    const periodTotal = await this.prisma.dynReportPeriod.count({ where: { reportId } });
    const periods = await this.prisma.dynReportPeriod.findMany({
      where: { reportId },
      orderBy: { startDate: 'desc' },
      take: PERIODS_SHOWN,
      select: {
        id: true,
        periodKey: true,
        status: true,
        startDate: true,
        endDate: true,
        opensAt: true,
        dueAt: true,
        version: { select: { version: true } },
        assignments: {
          where: { obligation: 'REQUIRED' },
          select: { submission: { select: { state: true } } },
        },
      },
    });

    const schedule = report.schedules[0];
    return {
      id: report.id,
      code: report.code,
      name: report.name,
      description: report.description,
      status: report.status,
      reportingUnit: report.reportingUnit,
      effectiveFrom: report.effectiveFrom?.toISOString() ?? null,
      configVersion: report.configVersion,
      createdAt: report.createdAt.toISOString(),
      updatedAt: report.updatedAt.toISOString(),
      schedule: schedule
        ? {
            periodType: schedule.periodType,
            periodStartDay: schedule.periodStartDay,
            dueRule: schedule.dueRule,
            openRule: schedule.openRule,
            shiftNonWorking: schedule.shiftNonWorking,
            oneTimeDate: schedule.oneTimeDate,
            timezone: schedule.timezone,
            effectiveFrom: schedule.effectiveFrom.toISOString(),
          }
        : null,
      roles: report.roles.map((r) => ({
        userId: r.userId,
        name: hoTenCanBo(r.user),
        role: r.role,
        teamScopeId: r.teamScopeId,
      })),
      targets: report.targets.map((t) => ({
        teamId: t.teamId,
        teamCode: t.team.code,
        teamName: t.team.name,
        editors: t.editors.map((e) => ({ userId: e.userId, name: hoTenCanBo(e.user) })),
      })),
      currentVersion: current
        ? {
            versionId: current.id,
            version: current.version,
            status: current.status,
            fileName: current.fileName,
            selectedSheets: current.selectedSheets as string[],
            dateSystem: current.dateSystem,
            publishedAt: current.publishedAt?.toISOString() ?? null,
            createdAt: current.createdAt.toISOString(),
            fields: current.fields.map((f) => ({
              sheetKey: f.sheetKey,
              address: f.address,
              fieldKey: f.fieldKey,
              label: f.label,
              type: f.type,
              format: f.format,
              aggregate: f.aggregate,
              blankPolicy: f.blankPolicy,
              required: f.required,
              min: f.min?.toString() ?? null,
              max: f.max?.toString() ?? null,
              scale: f.scale,
              maxLength: f.maxLength,
              helpText: f.helpText,
              source: f.source,
            })),
            rules: current.rules.map((r) => ({
              name: r.name,
              leftExpr: r.leftExpr,
              operator: r.operator,
              rightExpr: r.rightExpr,
              severity: r.severity,
              message: r.message,
              missingStrategy: r.missingStrategy,
              origin: r.origin,
            })),
          }
        : null,
      versionCount,
      periods: periods.map((p) => ({
        periodId: p.id,
        periodKey: p.periodKey,
        status: p.status,
        startDate: p.startDate.toISOString().slice(0, 10),
        endDate: p.endDate.toISOString().slice(0, 10),
        opensAt: p.opensAt.toISOString(),
        dueAt: p.dueAt.toISOString(),
        version: p.version.version,
        teamCount: p.assignments.length,
        submittedCount: p.assignments.filter((a) => a.submission && SUBMITTED_STATES.includes(a.submission.state)).length,
      })),
      periodTotal,
    };
  }

  /** Raw bytes of one version's template, for copying a report or starting a new version from the same file. */
  async getVersionFile(
    reportId: string,
    versionId: string,
  ): Promise<{ fileName: string; bytes: Buffer }> {
    const version = await this.prisma.dynReportVersion.findFirst({
      where: { id: versionId, reportId },
      select: { fileName: true, fileBytes: true },
    });
    if (!version) {
      throw new ReportConfigError('Không tìm thấy phiên bản này.', 'REPORT_NOT_FOUND');
    }
    return { fileName: version.fileName, bytes: Buffer.from(version.fileBytes) };
  }
}
