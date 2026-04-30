import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TdcReportData, TdcReportRow } from './types';

const QUERY_TIMEOUT_MS = 30_000;

interface CacheEntry {
  data: TdcReportData;
  expiresAt: number;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Query timeout: ${label}`)), ms),
    ),
  ]);
}

@Injectable()
export class TdacService {
  private readonly logger = new Logger(TdacService.name);
  private readonly cache = new Map<string, CacheEntry>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────
  // Cache helpers
  // ─────────────────────────────────────────────

  private cacheKey(type: string, fromDate: Date, toDate: Date, teamIds: string[]): string {
    return `${type}-${fromDate.toISOString()}-${toDate.toISOString()}-${[...teamIds].sort().join(',')}`;
  }

  private getCache(key: string): TdcReportData | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  private setCache(key: string, data: TdcReportData): void {
    this.cache.set(key, { data, expiresAt: Date.now() + this.CACHE_TTL_MS });
  }

  // ─────────────────────────────────────────────
  // computeTdcVuAn  (Vụ án TĐC điều tra)
  // ─────────────────────────────────────────────

  async computeTdcVuAn(fromDate: Date, toDate: Date, teamIds: string[]): Promise<TdcReportData> {
    const key = this.cacheKey('vu-an', fromDate, toDate, teamIds);
    const cached = this.getCache(key);
    if (cached) return cached;

    const rows = await withTimeout(
      this._buildVuAnRows(fromDate, toDate, teamIds),
      QUERY_TIMEOUT_MS,
      'computeTdcVuAn',
    );

    const result: TdcReportData = { rows, fromDate, toDate, teamIds, generatedAt: new Date() };
    this.setCache(key, result);
    return result;
  }

  // Build a Prisma.sql fragment for team filtering.
  // Prisma.join([]) throws when teamIds is empty — always use this helper.
  private teamFilter(alias: string, teamIds: string[]): Prisma.Sql {
    if (teamIds.length === 0) return Prisma.sql`TRUE`;
    return Prisma.sql`${Prisma.raw(alias)}."assignedTeamId" = ANY(ARRAY[${Prisma.join(teamIds.map(id => Prisma.sql`${id}`))}]::text[])`;
  }

  private async _buildVuAnRows(
    fromDate: Date,
    toDate: Date,
    teamIds: string[],
  ): Promise<TdcReportRow[]> {
    const tf = this.teamFilter('c', teamIds);
    // ── Row 1: Tồn đầu kỳ ────────────────────────────────────────────────────
    // Cases where the LATEST CaseStatusHistory entry with changedAt <= fromDate
    // has toStatus = 'TAM_DINH_CHI'
    const row1Raw = await this.prisma.$queryRaw<{ teamId: string | null; cnt: bigint }[]>`
      SELECT c."assignedTeamId" AS "teamId", COUNT(DISTINCT c.id) AS cnt
      FROM cases c
      WHERE c."deletedAt" IS NULL
        AND ${tf}
        AND (
          SELECT h."toStatus"
          FROM case_status_history h
          WHERE h."caseId" = c.id
            AND h."changedAt" <= ${fromDate}
          ORDER BY h."changedAt" DESC
          LIMIT 1
        ) = 'TAM_DINH_CHI'
      GROUP BY c."assignedTeamId"
    `;

    // ── Row 2: Số ra QĐ TĐC trong kỳ ────────────────────────────────────────
    const row2Raw = await this.prisma.$queryRaw<{ teamId: string | null; cnt: bigint }[]>`
      SELECT c."assignedTeamId" AS "teamId", COUNT(DISTINCT h."caseId") AS cnt
      FROM case_status_history h
      JOIN cases c ON c.id = h."caseId"
      WHERE c."deletedAt" IS NULL
        AND h."toStatus" = 'TAM_DINH_CHI'
        AND h."changedAt" >= ${fromDate}
        AND h."changedAt" <= ${toDate}
        AND ${tf}
      GROUP BY c."assignedTeamId"
    `;

    // ── Rows 2.1-2.8: sub-breakdown by lyDoTamDinhChiVuAn ───────────────────
    const lyDoValues = [
      'CHUA_XAC_DINH_BI_CAN',
      'KHONG_BIET_BI_CAN_O_DAU',
      'BI_CAN_BENH_TAM_THAN',
      'CHUA_CO_KET_QUA_GIAM_DINH',
      'CHUA_CO_KET_QUA_DINH_GIA',
      'CHUA_CO_KET_QUA_TUONG_TRO',
      'YEU_CAU_TAI_LIEU_CHUA_CO',
      'BAT_KHA_KHANG',
    ];

    const row2SubRaw = await this.prisma.$queryRaw<
      { lyDo: string | null; teamId: string | null; cnt: bigint }[]
    >`
      SELECT c."lyDoTamDinhChiVuAn"::text AS "lyDo", c."assignedTeamId" AS "teamId",
             COUNT(DISTINCT h."caseId") AS cnt
      FROM case_status_history h
      JOIN cases c ON c.id = h."caseId"
      WHERE c."deletedAt" IS NULL
        AND h."toStatus" = 'TAM_DINH_CHI'
        AND h."changedAt" >= ${fromDate}
        AND h."changedAt" <= ${toDate}
        AND ${tf}
      GROUP BY c."lyDoTamDinhChiVuAn", c."assignedTeamId"
    `;

    // ── Row 3: Số ra QĐ phục hồi ─────────────────────────────────────────────
    const row3Raw = await this.prisma.$queryRaw<{ teamId: string | null; cnt: bigint }[]>`
      SELECT c."assignedTeamId" AS "teamId", COUNT(DISTINCT c.id) AS cnt
      FROM cases c
      WHERE c."deletedAt" IS NULL
        AND c."ngayPhucHoi" >= ${fromDate}
        AND c."ngayPhucHoi" <= ${toDate}
        AND ${tf}
      GROUP BY c."assignedTeamId"
    `;

    // Row 3.1: TĐC trong kỳ AND phục hồi trong kỳ
    const row31Raw = await this.prisma.$queryRaw<{ teamId: string | null; cnt: bigint }[]>`
      SELECT c."assignedTeamId" AS "teamId", COUNT(DISTINCT c.id) AS cnt
      FROM cases c
      WHERE c."deletedAt" IS NULL
        AND c."ngayPhucHoi" >= ${fromDate}
        AND c."ngayPhucHoi" <= ${toDate}
        AND c."ngayTamDinhChi" >= ${fromDate}
        AND ${tf}
      GROUP BY c."assignedTeamId"
    `;

    // Rows 3.3.1-3.3.5: grouped by ketQuaPhucHoiVuAn
    const ketQuaValues = [
      'KET_LUAN_DE_NGHI_TRUY_TO',
      'DINH_CHI_DIEU_TRA',
      'TAM_DINH_CHI_LAI',
      'DANG_DIEU_TRA_XAC_MINH',
      'CHUYEN_CO_QUAN_DIEU_TRA_KHAC',
    ];

    const row33SubRaw = await this.prisma.$queryRaw<
      { ketQua: string | null; teamId: string | null; cnt: bigint }[]
    >`
      SELECT c."ketQuaPhucHoiVuAn"::text AS "ketQua", c."assignedTeamId" AS "teamId",
             COUNT(DISTINCT c.id) AS cnt
      FROM cases c
      WHERE c."deletedAt" IS NULL
        AND c."ngayPhucHoi" >= ${fromDate}
        AND c."ngayPhucHoi" <= ${toDate}
        AND ${tf}
      GROUP BY c."ketQuaPhucHoiVuAn", c."assignedTeamId"
    `;

    // ── Row 4: DINH_CHI với soLanGiaHan >= 2, chuyển sang DINH_CHI trong kỳ
    const row4Raw = await this.prisma.$queryRaw<{ teamId: string | null; cnt: bigint }[]>`
      SELECT c."assignedTeamId" AS "teamId", COUNT(DISTINCT c.id) AS cnt
      FROM cases c
      JOIN case_status_history h ON h."caseId" = c.id
      WHERE c."deletedAt" IS NULL
        AND c."status" = 'DINH_CHI'
        AND c."soLanGiaHan" >= 2
        AND h."toStatus" = 'DINH_CHI'
        AND h."changedAt" >= ${fromDate}
        AND h."changedAt" <= ${toDate}
        AND ${tf}
      GROUP BY c."assignedTeamId"
    `;

    // ── Row 5: Tồn cuối kỳ (Row1 + Row2 - Row3 - Row4, >= 0) ────────────────
    // We need the IDs of Row 5 cases to compute sub-rows
    const row5CasesRaw = await this.prisma.$queryRaw<
      {
        id: string;
        teamId: string | null;
        laCongNgheCao: boolean;
        soLanGiaHan: number;
        daRaSoat: boolean;
        lyDo: string | null;
      }[]
    >`
      SELECT DISTINCT c.id, c."assignedTeamId" AS "teamId",
             c."laCongNgheCao", c."soLanGiaHan", c."daRaSoat",
             c."lyDoTamDinhChiVuAn"::text AS "lyDo"
      FROM cases c
      WHERE c."deletedAt" IS NULL
        AND ${tf}
        AND (
          SELECT h."toStatus"
          FROM case_status_history h
          WHERE h."caseId" = c.id
            AND h."changedAt" <= ${toDate}
          ORDER BY h."changedAt" DESC
          LIMIT 1
        ) = 'TAM_DINH_CHI'
    `;

    // VksMeetingRecord for Row 5 cases
    const row5CaseIds = row5CasesRaw.map(r => r.id);

    const row5VksRaw =
      row5CaseIds.length > 0
        ? await this.prisma.$queryRaw<{ caseId: string; teamId: string | null }[]>`
        SELECT v."caseId", c."assignedTeamId" AS "teamId"
        FROM vks_meeting_records v
        JOIN cases c ON c.id = v."caseId"
        WHERE v."caseId" = ANY(${Prisma.sql`ARRAY[${Prisma.join(row5CaseIds.map(id => Prisma.sql`${id}`))}]::text[]`})
          AND v."ngayTrao" >= ${fromDate}
          AND v."ngayTrao" <= ${toDate}
      `
        : [];

    // SuspensionActionPlan DAM_BAO for Row 5 cases
    const row5ActionRaw =
      row5CaseIds.length > 0
        ? await this.prisma.$queryRaw<{ caseId: string; teamId: string | null }[]>`
        SELECT a."caseId", c."assignedTeamId" AS "teamId"
        FROM suspension_action_plans a
        JOIN cases c ON c.id = a."caseId"
        WHERE a."caseId" = ANY(${Prisma.sql`ARRAY[${Prisma.join(row5CaseIds.map(id => Prisma.sql`${id}`))}]::text[]`})
          AND a."tienDo" = 'DAM_BAO'
      `
        : [];

    // ── Build rows ────────────────────────────────────────────────────────────

    const sumByTeam = (raw: { teamId: string | null; cnt: bigint }[]): Map<string, number> => {
      const m = new Map<string, number>();
      for (const r of raw) {
        const k = r.teamId ?? '__none__';
        m.set(k, (m.get(k) ?? 0) + Number(r.cnt));
      }
      return m;
    };

    const makeRow = (
      rowKey: string,
      label: string,
      teamMap: Map<string, number>,
      allTeamIds: string[],
    ): TdcReportRow => {
      const byTeam = allTeamIds.map(tid => ({
        teamId: tid,
        teamName: tid, // caller can enrich with real names
        value: teamMap.get(tid) ?? 0,
      }));
      const total = [...teamMap.values()].reduce((a, b) => a + b, 0);
      return { rowKey, label, total, byTeam };
    };

    const r1Map = sumByTeam(row1Raw);
    const r2Map = sumByTeam(row2Raw);
    const r3Map = sumByTeam(row3Raw);
    const r31Map = sumByTeam(row31Raw);
    const r4Map = sumByTeam(row4Raw);

    // Row 5 from actual DB query (cases with TAM_DINH_CHI as last status at toDate)
    const r5Map = new Map<string, number>();
    for (const c of row5CasesRaw) {
      const k = c.teamId ?? '__none__';
      r5Map.set(k, (r5Map.get(k) ?? 0) + 1);
    }

    // Row 3.2 = Row 3 - Row 3.1
    const r32Map = new Map<string, number>();
    for (const [k, v] of r3Map) {
      r32Map.set(k, Math.max(0, v - (r31Map.get(k) ?? 0)));
    }

    // Row 2 sub-rows
    const r2SubMaps = new Map<string, Map<string, number>>();
    for (const lyDo of lyDoValues) {
      r2SubMaps.set(lyDo, new Map());
    }
    for (const r of row2SubRaw) {
      if (r.lyDo && r2SubMaps.has(r.lyDo)) {
        const m = r2SubMaps.get(r.lyDo)!;
        const k = r.teamId ?? '__none__';
        m.set(k, (m.get(k) ?? 0) + Number(r.cnt));
      }
    }

    // Row 3.3 sub-rows
    const r33SubMaps = new Map<string, Map<string, number>>();
    for (const kq of ketQuaValues) {
      r33SubMaps.set(kq, new Map());
    }
    for (const r of row33SubRaw) {
      if (r.ketQua && r33SubMaps.has(r.ketQua)) {
        const m = r33SubMaps.get(r.ketQua)!;
        const k = r.teamId ?? '__none__';
        m.set(k, (m.get(k) ?? 0) + Number(r.cnt));
      }
    }

    // Row 5 sub-rows
    const r51Map = new Map<string, number>(); // laCongNgheCao
    const r52Map = new Map<string, number>(); // soLanGiaHan >= 2
    const r53Map = new Map<string, number>(); // daRaSoat
    const r54Map = new Map<string, number>(); // VksMeeting count
    const r55Map = new Map<string, number>(); // ActionPlan DAM_BAO
    const r5LyDoMaps = new Map<string, Map<string, number>>();
    for (const lyDo of lyDoValues) {
      r5LyDoMaps.set(lyDo, new Map());
    }

    for (const c of row5CasesRaw) {
      const k = c.teamId ?? '__none__';
      if (c.laCongNgheCao) r51Map.set(k, (r51Map.get(k) ?? 0) + 1);
      if (c.soLanGiaHan >= 2) r52Map.set(k, (r52Map.get(k) ?? 0) + 1);
      if (c.daRaSoat) r53Map.set(k, (r53Map.get(k) ?? 0) + 1);
      if (c.lyDo && r5LyDoMaps.has(c.lyDo)) {
        const m = r5LyDoMaps.get(c.lyDo)!;
        m.set(k, (m.get(k) ?? 0) + 1);
      }
    }

    for (const r of row5VksRaw) {
      const k = r.teamId ?? '__none__';
      r54Map.set(k, (r54Map.get(k) ?? 0) + 1);
    }
    for (const r of row5ActionRaw) {
      const k = r.teamId ?? '__none__';
      r55Map.set(k, (r55Map.get(k) ?? 0) + 1);
    }

    const lyDoLabels: Record<string, string> = {
      CHUA_XAC_DINH_BI_CAN: 'Chưa xác định được bị can (Điều 229.1.a)',
      KHONG_BIET_BI_CAN_O_DAU: 'Không biết rõ bị can đang ở đâu (Điều 229.1.b)',
      BI_CAN_BENH_TAM_THAN: 'Bị can bị bệnh tâm thần hoặc hiểm nghèo (Điều 229.1.c)',
      CHUA_CO_KET_QUA_GIAM_DINH: 'Chưa có kết quả trưng cầu giám định (Điều 229.1.d-1)',
      CHUA_CO_KET_QUA_DINH_GIA: 'Chưa có kết quả yêu cầu định giá (Điều 229.1.d-2)',
      CHUA_CO_KET_QUA_TUONG_TRO: 'Chưa có kết quả yêu cầu tương trợ TP (Điều 229.1.d-3)',
      YEU_CAU_TAI_LIEU_CHUA_CO: 'Đã yêu cầu cung cấp tài liệu nhưng chưa có kết quả (Điều 229.1.đ)',
      BAT_KHA_KHANG: 'Bất khả kháng: thiên tai, dịch bệnh (Điều 229.1.e)',
    };

    const ketQuaLabels: Record<string, string> = {
      KET_LUAN_DE_NGHI_TRUY_TO: 'Kết luận điều tra đề nghị truy tố',
      DINH_CHI_DIEU_TRA: 'Đình chỉ điều tra',
      TAM_DINH_CHI_LAI: 'Tạm đình chỉ điều tra lại',
      DANG_DIEU_TRA_XAC_MINH: 'Đang điều tra, xác minh',
      CHUYEN_CO_QUAN_DIEU_TRA_KHAC: 'Chuyển cơ quan điều tra khác',
    };

    const rows: TdcReportRow[] = [
      makeRow('1', 'Tồn đầu kỳ', r1Map, teamIds),
      makeRow('2', 'Số ra QĐ TĐC trong kỳ', r2Map, teamIds),
      ...lyDoValues.map((lyDo, i) =>
        makeRow(`2.${i + 1}`, lyDoLabels[lyDo], r2SubMaps.get(lyDo)!, teamIds),
      ),
      makeRow('3', 'Số ra QĐ phục hồi', r3Map, teamIds),
      makeRow('3.1', 'TĐC trong kỳ, phục hồi trong kỳ', r31Map, teamIds),
      makeRow('3.2', 'TĐC trước kỳ, phục hồi trong kỳ', r32Map, teamIds),
      makeRow('3.3', 'Tổng phục hồi (= Row 3)', r3Map, teamIds),
      ...ketQuaValues.map((kq, i) =>
        makeRow(`3.3.${i + 1}`, ketQuaLabels[kq], r33SubMaps.get(kq)!, teamIds),
      ),
      makeRow('4', 'Số vụ đình chỉ (soLanGiaHan ≥ 2, trong kỳ)', r4Map, teamIds),
      makeRow('5', 'Tồn cuối kỳ', r5Map, teamIds),
      makeRow('5.1', 'Trong đó: Liên quan công nghệ cao', r51Map, teamIds),
      makeRow('5.2', 'Trong đó: Số lần gia hạn ≥ 2', r52Map, teamIds),
      makeRow('5.3', 'Trong đó: Đã ra soát', r53Map, teamIds),
      makeRow('5.4', 'Số lần trao đổi VKS (trong kỳ)', r54Map, teamIds),
      makeRow('5.5', 'Số kế hoạch khắc phục đảm bảo tiến độ', r55Map, teamIds),
      ...lyDoValues.map((lyDo, i) =>
        makeRow(`5.6.${i + 1}`, `Tồn cuối kỳ - ${lyDoLabels[lyDo]}`, r5LyDoMaps.get(lyDo)!, teamIds),
      ),
    ];

    return rows;
  }

  // ─────────────────────────────────────────────
  // computeTdcVuViec  (Vụ việc TĐC giải quyết)
  // ─────────────────────────────────────────────

  async computeTdcVuViec(fromDate: Date, toDate: Date, teamIds: string[]): Promise<TdcReportData> {
    const key = this.cacheKey('vu-viec', fromDate, toDate, teamIds);
    const cached = this.getCache(key);
    if (cached) return cached;

    const rows = await withTimeout(
      this._buildVuViecRows(fromDate, toDate, teamIds),
      QUERY_TIMEOUT_MS,
      'computeTdcVuViec',
    );

    const result: TdcReportData = { rows, fromDate, toDate, teamIds, generatedAt: new Date() };
    this.setCache(key, result);
    return result;
  }

  private async _buildVuViecRows(
    fromDate: Date,
    toDate: Date,
    teamIds: string[],
  ): Promise<TdcReportRow[]> {
    const tfi = this.teamFilter('i', teamIds);
    // ── Row 1: Tồn đầu kỳ ────────────────────────────────────────────────────
    // IncidentStatusHistory uses createdAt (not changedAt)
    const row1Raw = await this.prisma.$queryRaw<{ teamId: string | null; cnt: bigint }[]>`
      SELECT i."assignedTeamId" AS "teamId", COUNT(DISTINCT i.id) AS cnt
      FROM incidents i
      WHERE i."deletedAt" IS NULL
        AND ${tfi}
        AND (
          SELECT h."toStatus"
          FROM incident_status_history h
          WHERE h."incidentId" = i.id
            AND h."createdAt" <= ${fromDate}
          ORDER BY h."createdAt" DESC
          LIMIT 1
        ) = 'TAM_DINH_CHI'
      GROUP BY i."assignedTeamId"
    `;

    // ── Row 2: Số ra QĐ TĐC trong kỳ ─────────────────────────────────────────
    const row2Raw = await this.prisma.$queryRaw<{ teamId: string | null; cnt: bigint }[]>`
      SELECT i."assignedTeamId" AS "teamId", COUNT(DISTINCT h."incidentId") AS cnt
      FROM incident_status_history h
      JOIN incidents i ON i.id = h."incidentId"
      WHERE i."deletedAt" IS NULL
        AND h."toStatus" = 'TAM_DINH_CHI'
        AND h."createdAt" >= ${fromDate}
        AND h."createdAt" <= ${toDate}
        AND ${tfi}
      GROUP BY i."assignedTeamId"
    `;

    // ── Rows 2.1-2.6: sub-breakdown by lyDoTamDinhChiVuViec ─────────────────
    const lyDoVVValues = [
      'CHUA_CO_KET_QUA_GIAM_DINH',
      'CHUA_CO_KET_QUA_DINH_GIA',
      'CHUA_CO_KET_QUA_TUONG_TRO',
      'YEU_CAU_TAI_LIEU_CHUA_CO',
      'BAT_KHA_KHANG',
      'CAN_CU_KHAC',
    ];

    const row2SubRaw = await this.prisma.$queryRaw<
      { lyDo: string | null; teamId: string | null; cnt: bigint }[]
    >`
      SELECT i."lyDoTamDinhChiVuViec"::text AS "lyDo", i."assignedTeamId" AS "teamId",
             COUNT(DISTINCT h."incidentId") AS cnt
      FROM incident_status_history h
      JOIN incidents i ON i.id = h."incidentId"
      WHERE i."deletedAt" IS NULL
        AND h."toStatus" = 'TAM_DINH_CHI'
        AND h."createdAt" >= ${fromDate}
        AND h."createdAt" <= ${toDate}
        AND ${tfi}
      GROUP BY i."lyDoTamDinhChiVuViec", i."assignedTeamId"
    `;

    // ── Row 3: Số ra QĐ phục hồi ─────────────────────────────────────────────
    const row3Raw = await this.prisma.$queryRaw<{ teamId: string | null; cnt: bigint }[]>`
      SELECT i."assignedTeamId" AS "teamId", COUNT(DISTINCT i.id) AS cnt
      FROM incidents i
      WHERE i."deletedAt" IS NULL
        AND i."ngayPhucHoiVV" >= ${fromDate}
        AND i."ngayPhucHoiVV" <= ${toDate}
        AND ${tfi}
      GROUP BY i."assignedTeamId"
    `;

    // Row 3.1: TĐC trong kỳ, phục hồi trong kỳ
    const row31Raw = await this.prisma.$queryRaw<{ teamId: string | null; cnt: bigint }[]>`
      SELECT i."assignedTeamId" AS "teamId", COUNT(DISTINCT i.id) AS cnt
      FROM incidents i
      WHERE i."deletedAt" IS NULL
        AND i."ngayPhucHoiVV" >= ${fromDate}
        AND i."ngayPhucHoiVV" <= ${toDate}
        AND i."ngayTamDinhChiVV" >= ${fromDate}
        AND ${tfi}
      GROUP BY i."assignedTeamId"
    `;

    // Rows 3.3.1-3.3.5: grouped by ketQuaPhucHoiVuViec
    const ketQuaVVValues = [
      'QUYET_DINH_KHOI_TO',
      'QUYET_DINH_KHONG_KHOI_TO',
      'TAM_DINH_CHI_LAI',
      'DANG_XAC_MINH',
      'CHUYEN_CO_QUAN_KHAC',
    ];

    const row33SubRaw = await this.prisma.$queryRaw<
      { ketQua: string | null; teamId: string | null; cnt: bigint }[]
    >`
      SELECT i."ketQuaPhucHoiVuViec"::text AS "ketQua", i."assignedTeamId" AS "teamId",
             COUNT(DISTINCT i.id) AS cnt
      FROM incidents i
      WHERE i."deletedAt" IS NULL
        AND i."ngayPhucHoiVV" >= ${fromDate}
        AND i."ngayPhucHoiVV" <= ${toDate}
        AND ${tfi}
      GROUP BY i."ketQuaPhucHoiVuViec", i."assignedTeamId"
    `;

    // ── Row 4: DINH_CHI với soLanGiaHan >= 2, chuyển sang DINH_CHI trong kỳ
    const row4Raw = await this.prisma.$queryRaw<{ teamId: string | null; cnt: bigint }[]>`
      SELECT i."assignedTeamId" AS "teamId", COUNT(DISTINCT i.id) AS cnt
      FROM incidents i
      JOIN incident_status_history h ON h."incidentId" = i.id
      WHERE i."deletedAt" IS NULL
        AND i."status" = 'DINH_CHI'
        AND i."soLanGiaHan" >= 2
        AND h."toStatus" = 'DINH_CHI'
        AND h."createdAt" >= ${fromDate}
        AND h."createdAt" <= ${toDate}
        AND ${tfi}
      GROUP BY i."assignedTeamId"
    `;

    // ── Row 5: Tồn cuối kỳ ───────────────────────────────────────────────────
    const row5CasesRaw = await this.prisma.$queryRaw<
      {
        id: string;
        teamId: string | null;
        laCongNgheCaoVV: boolean;
        soLanGiaHan: number;
        daRaSoatVV: boolean;
        lyDo: string | null;
      }[]
    >`
      SELECT DISTINCT i.id, i."assignedTeamId" AS "teamId",
             i."laCongNgheCaoVV", i."soLanGiaHan", i."daRaSoatVV",
             i."lyDoTamDinhChiVuViec"::text AS "lyDo"
      FROM incidents i
      WHERE i."deletedAt" IS NULL
        AND ${tfi}
        AND (
          SELECT h."toStatus"
          FROM incident_status_history h
          WHERE h."incidentId" = i.id
            AND h."createdAt" <= ${toDate}
          ORDER BY h."createdAt" DESC
          LIMIT 1
        ) = 'TAM_DINH_CHI'
    `;

    const row5IncidentIds = row5CasesRaw.map(r => r.id);

    const row5VksRaw =
      row5IncidentIds.length > 0
        ? await this.prisma.$queryRaw<{ incidentId: string; teamId: string | null }[]>`
        SELECT v."incidentId", i."assignedTeamId" AS "teamId"
        FROM vks_meeting_records v
        JOIN incidents i ON i.id = v."incidentId"
        WHERE v."incidentId" = ANY(${Prisma.sql`ARRAY[${Prisma.join(row5IncidentIds.map(id => Prisma.sql`${id}`))}]::text[]`})
          AND v."ngayTrao" >= ${fromDate}
          AND v."ngayTrao" <= ${toDate}
      `
        : [];

    const row5ActionRaw =
      row5IncidentIds.length > 0
        ? await this.prisma.$queryRaw<{ incidentId: string; teamId: string | null }[]>`
        SELECT a."incidentId", i."assignedTeamId" AS "teamId"
        FROM suspension_action_plans a
        JOIN incidents i ON i.id = a."incidentId"
        WHERE a."incidentId" = ANY(${Prisma.sql`ARRAY[${Prisma.join(row5IncidentIds.map(id => Prisma.sql`${id}`))}]::text[]`})
          AND a."tienDo" = 'DAM_BAO'
      `
        : [];

    // ── Build rows ────────────────────────────────────────────────────────────

    const sumByTeam = (raw: { teamId: string | null; cnt: bigint }[]): Map<string, number> => {
      const m = new Map<string, number>();
      for (const r of raw) {
        const k = r.teamId ?? '__none__';
        m.set(k, (m.get(k) ?? 0) + Number(r.cnt));
      }
      return m;
    };

    const makeRow = (
      rowKey: string,
      label: string,
      teamMap: Map<string, number>,
      allTeamIds: string[],
    ): TdcReportRow => {
      const byTeam = allTeamIds.map(tid => ({
        teamId: tid,
        teamName: tid,
        value: teamMap.get(tid) ?? 0,
      }));
      const total = [...teamMap.values()].reduce((a, b) => a + b, 0);
      return { rowKey, label, total, byTeam };
    };

    const r1Map = sumByTeam(row1Raw);
    const r2Map = sumByTeam(row2Raw);
    const r3Map = sumByTeam(row3Raw);
    const r31Map = sumByTeam(row31Raw);
    const r4Map = sumByTeam(row4Raw);

    const r32Map = new Map<string, number>();
    for (const [k, v] of r3Map) {
      r32Map.set(k, Math.max(0, v - (r31Map.get(k) ?? 0)));
    }

    // Row 2 sub-rows
    const r2SubMaps = new Map<string, Map<string, number>>();
    for (const lyDo of lyDoVVValues) {
      r2SubMaps.set(lyDo, new Map());
    }
    for (const r of row2SubRaw) {
      if (r.lyDo && r2SubMaps.has(r.lyDo)) {
        const m = r2SubMaps.get(r.lyDo)!;
        const k = r.teamId ?? '__none__';
        m.set(k, (m.get(k) ?? 0) + Number(r.cnt));
      }
    }

    // Row 3.3 sub-rows
    const r33SubMaps = new Map<string, Map<string, number>>();
    for (const kq of ketQuaVVValues) {
      r33SubMaps.set(kq, new Map());
    }
    for (const r of row33SubRaw) {
      if (r.ketQua && r33SubMaps.has(r.ketQua)) {
        const m = r33SubMaps.get(r.ketQua)!;
        const k = r.teamId ?? '__none__';
        m.set(k, (m.get(k) ?? 0) + Number(r.cnt));
      }
    }

    // Row 5 sub-rows
    const r5Map = new Map<string, number>();
    const r51Map = new Map<string, number>();
    const r52Map = new Map<string, number>();
    const r53Map = new Map<string, number>();
    const r54Map = new Map<string, number>();
    const r55Map = new Map<string, number>();
    const r5LyDoMaps = new Map<string, Map<string, number>>();
    for (const lyDo of lyDoVVValues) {
      r5LyDoMaps.set(lyDo, new Map());
    }

    for (const c of row5CasesRaw) {
      const k = c.teamId ?? '__none__';
      r5Map.set(k, (r5Map.get(k) ?? 0) + 1);
      if (c.laCongNgheCaoVV) r51Map.set(k, (r51Map.get(k) ?? 0) + 1);
      if (c.soLanGiaHan >= 2) r52Map.set(k, (r52Map.get(k) ?? 0) + 1);
      if (c.daRaSoatVV) r53Map.set(k, (r53Map.get(k) ?? 0) + 1);
      if (c.lyDo && r5LyDoMaps.has(c.lyDo)) {
        const m = r5LyDoMaps.get(c.lyDo)!;
        m.set(k, (m.get(k) ?? 0) + 1);
      }
    }

    for (const r of row5VksRaw) {
      const k = r.teamId ?? '__none__';
      r54Map.set(k, (r54Map.get(k) ?? 0) + 1);
    }
    for (const r of row5ActionRaw) {
      const k = r.teamId ?? '__none__';
      r55Map.set(k, (r55Map.get(k) ?? 0) + 1);
    }

    const lyDoVVLabels: Record<string, string> = {
      CHUA_CO_KET_QUA_GIAM_DINH: 'Chưa có kết quả trưng cầu giám định',
      CHUA_CO_KET_QUA_DINH_GIA: 'Chưa có kết quả yêu cầu định giá tài sản',
      CHUA_CO_KET_QUA_TUONG_TRO: 'Chưa có kết quả yêu cầu tương trợ TP',
      YEU_CAU_TAI_LIEU_CHUA_CO: 'Đã yêu cầu cung cấp tài liệu nhưng chưa có kết quả',
      BAT_KHA_KHANG: 'Bất khả kháng: thiên tai, dịch bệnh',
      CAN_CU_KHAC: 'Căn cứ tạm đình chỉ khác',
    };

    const ketQuaVVLabels: Record<string, string> = {
      QUYET_DINH_KHOI_TO: 'Quyết định khởi tố VAHS',
      QUYET_DINH_KHONG_KHOI_TO: 'Quyết định không khởi tố VAHS',
      TAM_DINH_CHI_LAI: 'Tạm đình chỉ lại',
      DANG_XAC_MINH: 'Đang xác minh',
      CHUYEN_CO_QUAN_KHAC: 'Chuyển cơ quan khác',
    };

    const rows: TdcReportRow[] = [
      makeRow('1', 'Tồn đầu kỳ', r1Map, teamIds),
      makeRow('2', 'Số ra QĐ TĐC trong kỳ', r2Map, teamIds),
      ...lyDoVVValues.map((lyDo, i) =>
        makeRow(`2.${i + 1}`, lyDoVVLabels[lyDo], r2SubMaps.get(lyDo)!, teamIds),
      ),
      makeRow('3', 'Số ra QĐ phục hồi', r3Map, teamIds),
      makeRow('3.1', 'TĐC trong kỳ, phục hồi trong kỳ', r31Map, teamIds),
      makeRow('3.2', 'TĐC trước kỳ, phục hồi trong kỳ', r32Map, teamIds),
      makeRow('3.3', 'Tổng phục hồi (= Row 3)', r3Map, teamIds),
      ...ketQuaVVValues.map((kq, i) =>
        makeRow(`3.3.${i + 1}`, ketQuaVVLabels[kq], r33SubMaps.get(kq)!, teamIds),
      ),
      makeRow('4', 'Số vụ việc đình chỉ (soLanGiaHan ≥ 2, trong kỳ)', r4Map, teamIds),
      makeRow('5', 'Tồn cuối kỳ', r5Map, teamIds),
      makeRow('5.1', 'Trong đó: Liên quan công nghệ cao', r51Map, teamIds),
      makeRow('5.2', 'Trong đó: Số lần gia hạn ≥ 2', r52Map, teamIds),
      makeRow('5.3', 'Trong đó: Đã ra soát', r53Map, teamIds),
      makeRow('5.4', 'Số lần trao đổi VKS (trong kỳ)', r54Map, teamIds),
      makeRow('5.5', 'Số kế hoạch khắc phục đảm bảo tiến độ', r55Map, teamIds),
      ...lyDoVVValues.map((lyDo, i) =>
        makeRow(
          `5.6.${i + 1}`,
          `Tồn cuối kỳ - ${lyDoVVLabels[lyDo]}`,
          r5LyDoMaps.get(lyDo)!,
          teamIds,
        ),
      ),
    ];

    return rows;
  }
}
