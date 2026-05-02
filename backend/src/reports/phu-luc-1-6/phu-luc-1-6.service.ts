import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CaseStatus, IncidentStatus } from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
// Shared param type used by all 6 Phụ lục methods
// ─────────────────────────────────────────────────────────────────────────────

export interface PhuLuc16Params {
  loai: number;
  fromDate?: string;
  toDate?: string;
  unit?: string;
  limit?: number;
}

// Return shape that the export service and controller consume
export interface PhuLuc16Result {
  total: number;
  data: any[];
  limited: boolean;
}

// Statuses that indicate an Incident is under TĐC (tạm đình chỉ)
const INCIDENT_TDC_STATUSES: IncidentStatus[] = [
  IncidentStatus.TAM_DINH_CHI,
  IncidentStatus.TDC_HET_THOI_HIEU,
  IncidentStatus.TDC_HTH_KHONG_KT,
];

// Statuses that indicate an Incident is still active (not TĐC, not closed)
const INCIDENT_ACTIVE_EXCLUDED: IncidentStatus[] = [
  IncidentStatus.TAM_DINH_CHI,
  IncidentStatus.TDC_HET_THOI_HIEU,
  IncidentStatus.TDC_HTH_KHONG_KT,
  IncidentStatus.DA_GIAI_QUYET,
  IncidentStatus.DA_CHUYEN_VU_AN,
  IncidentStatus.KHONG_KHOI_TO,
  IncidentStatus.CHUYEN_XPHC,
  IncidentStatus.DA_CHUYEN_DON_VI,
  IncidentStatus.DA_NHAP_VU_KHAC,
  IncidentStatus.PHAN_LOAI_DAN_SU,
];

// Case statuses excluded from "active" (PL4)
const CASE_ACTIVE_EXCLUDED: CaseStatus[] = [
  CaseStatus.TAM_DINH_CHI,
  CaseStatus.DINH_CHI,
  CaseStatus.DA_LUU_TRU,
  CaseStatus.DA_KET_LUAN,
];

@Injectable()
export class PhuLuc16Service {
  constructor(private readonly prisma: PrismaService) {}

  // ── Helpers ───────────────────────────────────────────────────────────────

  private _dateRange(fromDate?: string, toDate?: string) {
    const gte = fromDate ? new Date(fromDate) : undefined;
    const lte = toDate ? new Date(toDate + 'T23:59:59.999Z') : undefined;
    if (!gte && !lte) return undefined;
    return { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) };
  }

  // ── PL1: Active Incidents (not TĐC) ──────────────────────────────────────

  async getPL1(params: PhuLuc16Params): Promise<PhuLuc16Result> {
    const limit = params.limit ?? 500;
    const dateRange = this._dateRange(params.fromDate, params.toDate);

    const data = await this.prisma.incident.findMany({
      where: {
        deletedAt: null,
        status: { notIn: INCIDENT_ACTIVE_EXCLUDED },
        ...(dateRange ? { createdAt: dateRange } : {}),
        ...(params.unit ? { unitId: params.unit } : {}),
      },
      include: {
        actionPlans: true,
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    // Count without limit to determine if result was capped
    const total = await this.prisma.incident.count({
      where: {
        deletedAt: null,
        status: { notIn: INCIDENT_ACTIVE_EXCLUDED },
        ...(dateRange ? { createdAt: dateRange } : {}),
        ...(params.unit ? { unitId: params.unit } : {}),
      },
    });

    return { total, data, limited: total > limit };
  }

  // ── PL2: TĐC Incidents where time-limit has expired (ngayHetThoiHieuVV < now) ──

  async getPL2(params: PhuLuc16Params): Promise<PhuLuc16Result> {
    const limit = params.limit ?? 500;
    const now = new Date();
    const dateRange = this._dateRange(params.fromDate, params.toDate);

    const data = await this.prisma.incident.findMany({
      where: {
        deletedAt: null,
        status: { in: INCIDENT_TDC_STATUSES },
        OR: [
          { ngayHetThoiHieuVV: { lt: now } },
          { ngayHetThoiHieuVV: null, deadline: { lt: now } },
        ],
        ...(dateRange ? { createdAt: dateRange } : {}),
        ...(params.unit ? { unitId: params.unit } : {}),
      },
      include: {
        actionPlans: true,
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    const total = await this.prisma.incident.count({
      where: {
        deletedAt: null,
        status: { in: INCIDENT_TDC_STATUSES },
        OR: [
          { ngayHetThoiHieuVV: { lt: now } },
          { ngayHetThoiHieuVV: null, deadline: { lt: now } },
        ],
        ...(dateRange ? { createdAt: dateRange } : {}),
        ...(params.unit ? { unitId: params.unit } : {}),
      },
    });

    return { total, data, limited: total > limit };
  }

  // ── PL3: TĐC Incidents where time-limit is still valid (ngayHetThoiHieuVV >= now) ──

  async getPL3(params: PhuLuc16Params): Promise<PhuLuc16Result> {
    const limit = params.limit ?? 500;
    const now = new Date();
    const dateRange = this._dateRange(params.fromDate, params.toDate);

    const data = await this.prisma.incident.findMany({
      where: {
        deletedAt: null,
        status: { in: INCIDENT_TDC_STATUSES },
        OR: [
          { ngayHetThoiHieuVV: { gte: now } },
          { ngayHetThoiHieuVV: null, deadline: { gte: now } },
        ],
        ...(dateRange ? { createdAt: dateRange } : {}),
        ...(params.unit ? { unitId: params.unit } : {}),
      },
      include: {
        actionPlans: true,
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    const total = await this.prisma.incident.count({
      where: {
        deletedAt: null,
        status: { in: INCIDENT_TDC_STATUSES },
        OR: [
          { ngayHetThoiHieuVV: { gte: now } },
          { ngayHetThoiHieuVV: null, deadline: { gte: now } },
        ],
        ...(dateRange ? { createdAt: dateRange } : {}),
        ...(params.unit ? { unitId: params.unit } : {}),
      },
    });

    return { total, data, limited: total > limit };
  }

  // ── PL4: Active Cases (not TĐC/ĐÌNH CHỈ/LƯU TRỮ/KẾT LUẬN) ─────────────

  async getPL4(params: PhuLuc16Params): Promise<PhuLuc16Result> {
    const limit = params.limit ?? 500;
    const dateRange = this._dateRange(params.fromDate, params.toDate);

    const data = await this.prisma.case.findMany({
      where: {
        deletedAt: null,
        status: { notIn: CASE_ACTIVE_EXCLUDED },
        ...(dateRange ? { createdAt: dateRange } : {}),
        ...(params.unit ? { unit: params.unit } : {}),
      },
      include: {
        subjects: {
          where: { deletedAt: null, type: 'SUSPECT' },
        },
        actionPlans: true,
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    const total = await this.prisma.case.count({
      where: {
        deletedAt: null,
        status: { notIn: CASE_ACTIVE_EXCLUDED },
        ...(dateRange ? { createdAt: dateRange } : {}),
        ...(params.unit ? { unit: params.unit } : {}),
      },
    });

    return { total, data, limited: total > limit };
  }

  // ── PL5: TĐC Cases where time-limit has expired (ngayHetThoiHieu < now) ──

  async getPL5(params: PhuLuc16Params): Promise<PhuLuc16Result> {
    const limit = params.limit ?? 500;
    const now = new Date();
    const dateRange = this._dateRange(params.fromDate, params.toDate);

    const data = await this.prisma.case.findMany({
      where: {
        deletedAt: null,
        status: CaseStatus.TAM_DINH_CHI,
        OR: [
          { ngayHetThoiHieu: { lt: now } },
          { ngayHetThoiHieu: null, deadline: { lt: now } },
        ],
        ...(dateRange ? { createdAt: dateRange } : {}),
        ...(params.unit ? { unit: params.unit } : {}),
      },
      include: {
        subjects: {
          where: { deletedAt: null, type: 'SUSPECT' },
        },
        actionPlans: true,
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    const total = await this.prisma.case.count({
      where: {
        deletedAt: null,
        status: CaseStatus.TAM_DINH_CHI,
        OR: [
          { ngayHetThoiHieu: { lt: now } },
          { ngayHetThoiHieu: null, deadline: { lt: now } },
        ],
        ...(dateRange ? { createdAt: dateRange } : {}),
        ...(params.unit ? { unit: params.unit } : {}),
      },
    });

    return { total, data, limited: total > limit };
  }

  // ── PL6: TĐC Cases where time-limit is still valid (ngayHetThoiHieu >= now) ──

  async getPL6(params: PhuLuc16Params): Promise<PhuLuc16Result> {
    const limit = params.limit ?? 500;
    const now = new Date();
    const dateRange = this._dateRange(params.fromDate, params.toDate);

    const data = await this.prisma.case.findMany({
      where: {
        deletedAt: null,
        status: CaseStatus.TAM_DINH_CHI,
        OR: [
          { ngayHetThoiHieu: { gte: now } },
          { ngayHetThoiHieu: null, deadline: { gte: now } },
        ],
        ...(dateRange ? { createdAt: dateRange } : {}),
        ...(params.unit ? { unit: params.unit } : {}),
      },
      include: {
        subjects: {
          where: { deletedAt: null, type: 'SUSPECT' },
        },
        actionPlans: true,
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    const total = await this.prisma.case.count({
      where: {
        deletedAt: null,
        status: CaseStatus.TAM_DINH_CHI,
        OR: [
          { ngayHetThoiHieu: { gte: now } },
          { ngayHetThoiHieu: null, deadline: { gte: now } },
        ],
        ...(dateRange ? { createdAt: dateRange } : {}),
        ...(params.unit ? { unit: params.unit } : {}),
      },
    });

    return { total, data, limited: total > limit };
  }

  // ── Dispatcher ─────────────────────────────────────────────────────────────

  async getForLoai(
    loai: number,
    params: PhuLuc16Params,
  ): Promise<PhuLuc16Result> {
    switch (loai) {
      case 1:
        return this.getPL1(params);
      case 2:
        return this.getPL2(params);
      case 3:
        return this.getPL3(params);
      case 4:
        return this.getPL4(params);
      case 5:
        return this.getPL5(params);
      case 6:
        return this.getPL6(params);
      default:
        return { total: 0, data: [], limited: false };
    }
  }
}
