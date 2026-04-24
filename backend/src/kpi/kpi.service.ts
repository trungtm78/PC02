import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IncidentStatus, CaseStatus, CapDoToiPham, Prisma } from '@prisma/client';
import { QueryKpiDto } from './dto/query-kpi.dto';

// ─── KPI constants ────────────────────────────────────────────────────────────

/** KPI-2: statuses that count as "giải quyết" (resolved) */
export const KPI2_RESOLVED_STATUSES: IncidentStatus[] = [
  IncidentStatus.DA_GIAI_QUYET,
  IncidentStatus.DA_CHUYEN_VU_AN,
  IncidentStatus.KHONG_KHOI_TO,
  IncidentStatus.CHUYEN_XPHC,
  IncidentStatus.DA_CHUYEN_DON_VI,
  IncidentStatus.PHAN_LOAI_DAN_SU,
];

/** KPI-3/KPI-4: Case statuses that count as "đã khám phá" */
export const KPI3_SOLVED_CASE_STATUSES: CaseStatus[] = [
  CaseStatus.DA_KET_LUAN,
  CaseStatus.DANG_TRUY_TO,
  CaseStatus.DANG_XET_XU,
  CaseStatus.DA_LUU_TRU,
];

export type KpiStatus = 'PASS' | 'FAIL' | 'WARNING' | 'N_A';

export interface KpiResult {
  kpi: 1 | 2 | 3 | 4;
  label: string;
  target: number;
  warningThreshold: number;
  /** Calculated percentage (0–100). 0 when denominator=0 (no data). */
  value: number;
  status: KpiStatus;
  numerator: number;
  denominator: number;
  /** True when there was no data in the period — value/status should be ignored for reporting. */
  noData: boolean;
}

export interface KpiSummary {
  period: { year: number; quarter?: number; month?: number };
  kpi1: KpiResult;
  kpi2: KpiResult;
  kpi3: KpiResult;
  kpi4: KpiResult;
}

export interface KpiTrendPoint {
  year: number;
  month: number;
  kpi1: number;
  kpi2: number;
  kpi3: number;
  kpi4: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildDateRange(
  year: number,
  quarter?: number,
  month?: number,
): { gte: Date; lt: Date } {
  if (month) {
    const gte = new Date(year, month - 1, 1);
    const lt = new Date(year, month, 1);
    return { gte, lt };
  }
  if (quarter) {
    const startMonth = (quarter - 1) * 3;
    const gte = new Date(year, startMonth, 1);
    const lt = new Date(year, startMonth + 3, 1);
    return { gte, lt };
  }
  return { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) };
}

function deriveKpiStatus(value: number, target: number, warningThreshold: number): KpiStatus {
  if (value >= target) return 'PASS';
  if (value >= warningThreshold) return 'WARNING';
  return 'FAIL';
}

function safePercent(numerator: number, denominator: number): number {
  if (denominator === 0) return 0; // No data — caller must check noData flag
  return Math.round((numerator / denominator) * 10000) / 100; // 2 decimal places
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class KpiService {
  constructor(private readonly prisma: PrismaService) {}

  // ── KPI-1: Tỷ lệ thụ lý tố giác/tin báo (target: 100%) ──────────────────
  async calculateKpi1(
    query: QueryKpiDto,
  ): Promise<KpiResult> {
    const year = query.year ?? new Date().getFullYear();
    const dateRange = buildDateRange(year, query.quarter, query.month);

    const baseWhere: Prisma.IncidentWhereInput = {
      deletedAt: null,
      createdAt: dateRange,
      ...(query.unitId ? { unitId: query.unitId } : {}),
      ...(query.teamId ? { assignedTeamId: query.teamId } : {}),
    };

    const [total, thuLy] = await Promise.all([
      this.prisma.incident.count({ where: baseWhere }),
      this.prisma.incident.count({
        where: { ...baseWhere, status: { not: IncidentStatus.TIEP_NHAN } },
      }),
    ]);

    const value = safePercent(thuLy, total);
    const target = 100;
    const warningThreshold = 95;
    const noData = total === 0;

    return {
      kpi: 1,
      label: 'Tỷ lệ thụ lý tố giác/tin báo/kiến nghị khởi tố',
      target,
      warningThreshold,
      value,
      status: noData ? 'N_A' : deriveKpiStatus(value, target, warningThreshold),
      numerator: thuLy,
      denominator: total,
      noData,
    };
  }

  // ── KPI-2: Tỷ lệ giải quyết tố giác/tin báo (target: >90%) ──────────────
  async calculateKpi2(
    query: QueryKpiDto,
  ): Promise<KpiResult> {
    const year = query.year ?? new Date().getFullYear();
    const dateRange = buildDateRange(year, query.quarter, query.month);

    const baseWhere: Prisma.IncidentWhereInput = {
      deletedAt: null,
      createdAt: dateRange,
      ...(query.unitId ? { unitId: query.unitId } : {}),
      ...(query.teamId ? { assignedTeamId: query.teamId } : {}),
    };

    // Denominator: all "thụ lý" (status != TIEP_NHAN)
    const [thuLy, giaiQuyet] = await Promise.all([
      this.prisma.incident.count({
        where: { ...baseWhere, status: { not: IncidentStatus.TIEP_NHAN } },
      }),
      this.prisma.incident.count({
        where: { ...baseWhere, status: { in: KPI2_RESOLVED_STATUSES } },
      }),
    ]);

    const value = safePercent(giaiQuyet, thuLy);
    const target = 90;
    const warningThreshold = 85;
    const noData = thuLy === 0;

    return {
      kpi: 2,
      label: 'Tỷ lệ giải quyết tố giác/tin báo/kiến nghị khởi tố',
      target,
      warningThreshold,
      value,
      status: noData ? 'N_A' : deriveKpiStatus(value, target, warningThreshold),
      numerator: giaiQuyet,
      denominator: thuLy,
      noData,
    };
  }

  // ── KPI-3: Tỷ lệ điều tra khám phá án (target: >80%) ─────────────────────
  async calculateKpi3(
    query: QueryKpiDto,
  ): Promise<KpiResult> {
    const year = query.year ?? new Date().getFullYear();
    const dateRange = buildDateRange(year, query.quarter, query.month);

    const baseWhere: Prisma.CaseWhereInput = {
      deletedAt: null,
      createdAt: dateRange,
      ...(query.teamId ? { assignedTeamId: query.teamId } : {}),
    };

    const [total, khamPha] = await Promise.all([
      this.prisma.case.count({ where: baseWhere }),
      this.prisma.case.count({
        where: { ...baseWhere, status: { in: KPI3_SOLVED_CASE_STATUSES } },
      }),
    ]);

    const value = safePercent(khamPha, total);
    const target = 80;
    const warningThreshold = 75;
    const noData = total === 0;

    return {
      kpi: 3,
      label: 'Tỷ lệ điều tra khám phá án các loại',
      target,
      warningThreshold,
      value,
      status: noData ? 'N_A' : deriveKpiStatus(value, target, warningThreshold),
      numerator: khamPha,
      denominator: total,
      noData,
    };
  }

  // ── KPI-4: Tỷ lệ khám phá án rất/đặc biệt nghiêm trọng (target: >95%) ───
  async calculateKpi4(
    query: QueryKpiDto,
  ): Promise<KpiResult> {
    const year = query.year ?? new Date().getFullYear();
    const dateRange = buildDateRange(year, query.quarter, query.month);

    const baseWhere: Prisma.CaseWhereInput = {
      deletedAt: null,
      createdAt: dateRange,
      ...(query.teamId ? { assignedTeamId: query.teamId } : {}),
      capDoToiPham: { in: [CapDoToiPham.RAT_NGHIEM_TRONG, CapDoToiPham.DAC_BIET_NGHIEM_TRONG] },
    };

    const [total, khamPha] = await Promise.all([
      this.prisma.case.count({ where: baseWhere }),
      this.prisma.case.count({
        where: { ...baseWhere, status: { in: KPI3_SOLVED_CASE_STATUSES } },
      }),
    ]);

    const value = safePercent(khamPha, total);
    const target = 95;
    const warningThreshold = 90;
    const noData = total === 0;

    return {
      kpi: 4,
      label: 'Tỷ lệ khám phá án rất nghiêm trọng và đặc biệt nghiêm trọng',
      target,
      warningThreshold,
      value,
      status: noData ? 'N_A' : deriveKpiStatus(value, target, warningThreshold),
      numerator: khamPha,
      denominator: total,
      noData,
    };
  }

  // ── getKpiSummary: trả đủ 4 KPI ──────────────────────────────────────────
  async getKpiSummary(query: QueryKpiDto): Promise<KpiSummary> {
    const year = query.year ?? new Date().getFullYear();
    const [kpi1, kpi2, kpi3, kpi4] = await Promise.all([
      this.calculateKpi1(query),
      this.calculateKpi2(query),
      this.calculateKpi3(query),
      this.calculateKpi4(query),
    ]);

    return {
      period: { year, quarter: query.quarter, month: query.month },
      kpi1,
      kpi2,
      kpi3,
      kpi4,
    };
  }

  // ── getKpiTrend: 12 tháng xu hướng ───────────────────────────────────────
  async getKpiTrend(year?: number): Promise<KpiTrendPoint[]> {
    const targetYear = year ?? new Date().getFullYear();
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    const points = await Promise.all(
      months.map(async (month) => {
        const q: QueryKpiDto = { year: targetYear, month };
        const [k1, k2, k3, k4] = await Promise.all([
          this.calculateKpi1(q),
          this.calculateKpi2(q),
          this.calculateKpi3(q),
          this.calculateKpi4(q),
        ]);
        return {
          year: targetYear,
          month,
          kpi1: k1.value,
          kpi2: k2.value,
          kpi3: k3.value,
          kpi4: k4.value,
        };
      }),
    );

    return points;
  }

  // ── getKpiByTeam: KPI theo từng Tổ (level 1) ─────────────────────────────
  async getKpiByTeam(
    query: QueryKpiDto,
    allowedTeamIds?: string[] | null,
  ) {
    const where: Prisma.TeamWhereInput = { isActive: true, level: 1 };
    if (allowedTeamIds !== null && allowedTeamIds !== undefined) {
      where.id = { in: allowedTeamIds };
    }

    const teams = await this.prisma.team.findMany({
      where,
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, code: true, level: true, parentId: true },
    });

    const results = await Promise.all(
      teams.map(async (team) => ({
        team,
        summary: await this.getKpiSummary({ ...query, teamId: team.id }),
      })),
    );

    return results;
  }
}
