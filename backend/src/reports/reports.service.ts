import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CaseStatus, IncidentStatus, PetitionStatus } from '@prisma/client';

// ─────────────────────────────────────────────
// Stat48 field definitions
// ─────────────────────────────────────────────

const NUMERIC_FIELDS = new Set([
  'Thiệt hại (VNĐ)',
  'Đã thu hồi (VNĐ)',
  'Số bị hại',
  'Số người chết',
  'Số người bị thương',
  'Số đối tượng',
  'Đã bắt giữ',
  'Đã tạm giam',
  'Số ngày xử lý',
  'Số nhân chứng',
  'Tài sản thu giữ',
  'Chứng cứ thu thập',
]);

const STAT_GROUPS = [
  {
    name: 'Nhóm 1: Nguồn tin',
    fields: [
      'Loại nguồn tin', 'Nguồn gốc', 'Loại người báo tin', 'Hình thức tiếp nhận',
      'Mức độ khẩn', 'Đơn vị tiếp báo', 'Ngày xảy ra vụ việc', 'Giờ xảy ra vụ việc',
      'Tỉnh/Thành phố', 'Quận/Huyện', 'Phường/Xã', 'Phân loại ban đầu',
    ],
  },
  {
    name: 'Nhóm 2: Tội phạm',
    fields: [
      'Tội danh chính', 'Tội danh phụ', 'Lĩnh vực', 'Phương thức thủ đoạn',
      'Thiệt hại (VNĐ)', 'Đã thu hồi (VNĐ)', 'Số bị hại', 'Số người chết',
      'Số người bị thương', 'Thiệt hại tài sản', 'Tội phạm có tổ chức', 'Tái phạm',
    ],
  },
  {
    name: 'Nhóm 3: Đối tượng',
    fields: [
      'Số đối tượng', 'Đã bắt giữ', 'Đã tạm giam', 'Giới tính',
      'Độ tuổi', 'Dân tộc', 'Quốc tịch', 'Nghề nghiệp',
      'Trình độ học vấn', 'Tiền án tiền sự', 'Liên quan ma túy', 'Sử dụng vũ khí',
    ],
  },
  {
    name: 'Nhóm 4: Kết quả',
    fields: [
      'Trạng thái xử lý', 'Kết quả điều tra', 'Kết quả truy tố', 'Kết quả xét xử',
      'Mức án', 'Ngày kết thúc', 'Số ngày xử lý', 'Chứng cứ thu thập',
      'Số nhân chứng', 'Tài sản thu giữ', 'Chuyển vụ án', 'Đã báo cáo',
    ],
  },
];

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────
  // GET /api/v1/reports/monthly?year=&month=
  // ─────────────────────────────────────────────
  async getMonthly(year: number, month?: number) {
    const months = month
      ? [month]
      : Array.from({ length: 12 }, (_, i) => i + 1);

    const data = await Promise.all(
      months.map(async (m) => {
        const start = new Date(year, m - 1, 1);
        const end = new Date(year, m, 0, 23, 59, 59, 999);

        const [donThu, vuViec, vuAn, daGiaiQuyet] = await Promise.all([
          this.prisma.petition.count({
            where: { deletedAt: null, createdAt: { gte: start, lte: end } },
          }),
          this.prisma.incident.count({
            where: { deletedAt: null, createdAt: { gte: start, lte: end } },
          }),
          this.prisma.case.count({
            where: { deletedAt: null, createdAt: { gte: start, lte: end } },
          }),
          // Đã giải quyết = cases kết luận + incidents giải quyết + petitions giải quyết
          Promise.all([
            this.prisma.case.count({
              where: {
                deletedAt: null,
                updatedAt: { gte: start, lte: end },
                status: { in: [CaseStatus.DA_KET_LUAN, CaseStatus.DA_LUU_TRU] },
              },
            }),
            this.prisma.incident.count({
              where: {
                deletedAt: null,
                updatedAt: { gte: start, lte: end },
                status: IncidentStatus.DA_GIAI_QUYET,
              },
            }),
            this.prisma.petition.count({
              where: {
                deletedAt: null,
                updatedAt: { gte: start, lte: end },
                status: PetitionStatus.DA_GIAI_QUYET,
              },
            }),
          ]).then(([c, i, p]) => c + i + p),
        ]);

        return {
          month: `T${m}/${year}`,
          donThu,
          vuViec,
          vuAn,
          daGiaiQuyet,
        };
      }),
    );

    // Summary totals
    const totals = data.reduce(
      (acc, row) => ({
        donThu: acc.donThu + row.donThu,
        vuViec: acc.vuViec + row.vuViec,
        vuAn: acc.vuAn + row.vuAn,
        daGiaiQuyet: acc.daGiaiQuyet + row.daGiaiQuyet,
      }),
      { donThu: 0, vuViec: 0, vuAn: 0, daGiaiQuyet: 0 },
    );

    return { success: true, data, totals, year, month };
  }

  // ─────────────────────────────────────────────
  // GET /api/v1/reports/quarterly?year=&quarter=
  // ─────────────────────────────────────────────
  async getQuarterly(year: number, quarter?: number) {
    const quarters = quarter
      ? [quarter]
      : [1, 2, 3, 4];

    const QUARTER_MONTHS: Record<number, number[]> = {
      1: [1, 2, 3],
      2: [4, 5, 6],
      3: [7, 8, 9],
      4: [10, 11, 12],
    };

    const data = await Promise.all(
      quarters.map(async (q) => {
        const ms = QUARTER_MONTHS[q];
        const start = new Date(year, ms[0] - 1, 1);
        const end = new Date(year, ms[ms.length - 1], 0, 23, 59, 59, 999);

        const [donThu, vuViec, vuAn, daGiaiQuyet] = await Promise.all([
          this.prisma.petition.count({
            where: { deletedAt: null, createdAt: { gte: start, lte: end } },
          }),
          this.prisma.incident.count({
            where: { deletedAt: null, createdAt: { gte: start, lte: end } },
          }),
          this.prisma.case.count({
            where: { deletedAt: null, createdAt: { gte: start, lte: end } },
          }),
          Promise.all([
            this.prisma.case.count({
              where: {
                deletedAt: null,
                updatedAt: { gte: start, lte: end },
                status: { in: [CaseStatus.DA_KET_LUAN, CaseStatus.DA_LUU_TRU] },
              },
            }),
            this.prisma.incident.count({
              where: {
                deletedAt: null,
                updatedAt: { gte: start, lte: end },
                status: IncidentStatus.DA_GIAI_QUYET,
              },
            }),
            this.prisma.petition.count({
              where: {
                deletedAt: null,
                updatedAt: { gte: start, lte: end },
                status: PetitionStatus.DA_GIAI_QUYET,
              },
            }),
          ]).then(([c, i, p]) => c + i + p),
        ]);

        return {
          quarter: `Q${q}/${year}`,
          donThu,
          vuViec,
          vuAn,
          daGiaiQuyet,
        };
      }),
    );

    const totals = data.reduce(
      (acc, row) => ({
        donThu: acc.donThu + row.donThu,
        vuViec: acc.vuViec + row.vuViec,
        vuAn: acc.vuAn + row.vuAn,
        daGiaiQuyet: acc.daGiaiQuyet + row.daGiaiQuyet,
      }),
      { donThu: 0, vuViec: 0, vuAn: 0, daGiaiQuyet: 0 },
    );

    return { success: true, data, totals, year, quarter };
  }

  // ─────────────────────────────────────────────
  // GET /api/v1/reports/district-stats?fromDate=&toDate=&district=
  // ─────────────────────────────────────────────
  async getDistrictStats(fromDate?: string, toDate?: string, district?: string) {
    const from = fromDate ? new Date(fromDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = toDate ? new Date(toDate + 'T23:59:59.999Z') : new Date();

    // Daily breakdown for date range
    const dayCount = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
    const limitDays = Math.min(dayCount, 31); // max 31 days for chart

    const dailyData = await Promise.all(
      Array.from({ length: limitDays }, async (_, i) => {
        const dayStart = new Date(from);
        dayStart.setDate(dayStart.getDate() + i);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);

        const [petitions, incidents, cases] = await Promise.all([
          this.prisma.petition.count({
            where: { deletedAt: null, createdAt: { gte: dayStart, lte: dayEnd } },
          }),
          this.prisma.incident.count({
            where: { deletedAt: null, createdAt: { gte: dayStart, lte: dayEnd } },
          }),
          this.prisma.case.count({
            where: { deletedAt: null, createdAt: { gte: dayStart, lte: dayEnd } },
          }),
        ]);

        return {
          date: dayStart.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
          count: petitions + incidents + cases,
          details: { petitions, incidents, cases },
        };
      }),
    );

    // Incident status breakdown
    const incidentStatusCounts = await this.prisma.incident.groupBy({
      by: ['status'],
      where: {
        deletedAt: null,
        createdAt: { gte: from, lte: to },
      },
      _count: { id: true },
    });

    const INCIDENT_STATUS_LABELS: Record<string, string> = {
      TIEP_NHAN: 'Tiếp nhận',
      DANG_XAC_MINH: 'Đang xác minh',
      DA_GIAI_QUYET: 'Đã giải quyết',
      TAM_DINH_CHI: 'Tạm đình chỉ',
      QUA_HAN: 'Quá hạn',
      DA_CHUYEN_VU_AN: 'Đã chuyển vụ án',
    };

    // Case status breakdown
    const caseStatusCounts = await this.prisma.case.groupBy({
      by: ['status'],
      where: {
        deletedAt: null,
        createdAt: { gte: from, lte: to },
      },
      _count: { id: true },
    });

    const CASE_STATUS_LABELS: Record<string, string> = {
      TIEP_NHAN: 'Tiếp nhận',
      DANG_XAC_MINH: 'Đang xác minh',
      DANG_DIEU_TRA: 'Đang điều tra',
      DA_KET_LUAN: 'Đã kết luận',
      DA_LUU_TRU: 'Đã lưu trữ',
      DINH_CHI: 'Đình chỉ',
      TAM_DINH_CHI: 'Tạm đình chỉ',
      DANG_TRUY_TO: 'Đang truy tố',
      DANG_XET_XU: 'Đang xét xử',
      DA_XAC_MINH: 'Đã xác minh',
    };

    const COLORS = ['#1B2B4E', '#D4AF37', '#64748B', '#10B981', '#F59E0B', '#EF4444'];

    return {
      success: true,
      data: {
        daily: dailyData,
        incidentStatus: incidentStatusCounts.map((item, idx) => ({
          name: INCIDENT_STATUS_LABELS[item.status] ?? item.status,
          value: item._count.id,
          color: COLORS[idx % COLORS.length],
        })),
        caseStatus: caseStatusCounts.map((item, idx) => ({
          name: CASE_STATUS_LABELS[item.status] ?? item.status,
          value: item._count.id,
          color: COLORS[idx % COLORS.length],
        })),
      },
      filters: { fromDate: from.toISOString(), toDate: to.toISOString(), district },
    };
  }

  // ─────────────────────────────────────────────
  // GET /api/v1/reports/overdue
  // ─────────────────────────────────────────────
  async getOverdue(search?: string, recordType?: string, priority?: string, minDaysOverdue?: number) {
    const now = new Date();

    const overdueCases = recordType && recordType !== 'case' ? [] : await this.prisma.case.findMany({
      where: {
        deletedAt: null,
        deadline: { lt: now },
        status: {
          notIn: [CaseStatus.DA_KET_LUAN, CaseStatus.DA_LUU_TRU, CaseStatus.DINH_CHI],
        },
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { unit: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      select: {
        id: true,
        name: true,
        deadline: true,
        createdAt: true,
        unit: true,
        status: true,
        investigator: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { deadline: 'asc' },
    });

    const overdueIncidents = recordType && recordType !== 'incident' ? [] : await this.prisma.incident.findMany({
      where: {
        deletedAt: null,
        deadline: { lt: now },
        status: {
          notIn: [IncidentStatus.DA_GIAI_QUYET, IncidentStatus.DA_CHUYEN_VU_AN],
        },
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { unitId: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      select: {
        id: true,
        name: true,
        deadline: true,
        createdAt: true,
        unitId: true,
        status: true,
        investigator: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { deadline: 'asc' },
    });

    const overduePetitions = recordType && recordType !== 'petition' ? [] : await this.prisma.petition.findMany({
      where: {
        deletedAt: null,
        deadline: { lt: now },
        status: {
          notIn: [PetitionStatus.DA_GIAI_QUYET, PetitionStatus.DA_CHUYEN_VU_AN, PetitionStatus.DA_CHUYEN_VU_VIEC],
        },
        ...(search && {
          OR: [
            { senderName: { contains: search, mode: 'insensitive' } },
            { summary: { contains: search, mode: 'insensitive' } },
            { unit: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      select: {
        id: true,
        stt: true,
        summary: true,
        deadline: true,
        receivedDate: true,
        unit: true,
        status: true,
        priority: true,
        assignedTo: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { deadline: 'asc' },
    });

    const toOverdueRecord = (item: any, type: string) => {
      const deadline = new Date(item.deadline);
      const daysOverdue = Math.floor((now.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24));
      const computedPriority = daysOverdue > 30 ? 'critical' : daysOverdue > 14 ? 'high' : 'medium';

      return {
        id: item.id,
        recordType: type,
        recordNumber: item.stt ?? item.code ?? item.id.slice(0, 8).toUpperCase(),
        title: item.name ?? item.summary ?? `Đơn thư ${item.stt}`,
        assignedTo: item.investigator
          ? `${item.investigator.firstName ?? ''} ${item.investigator.lastName ?? ''}`.trim()
          : item.assignedTo
          ? `${item.assignedTo.firstName ?? ''} ${item.assignedTo.lastName ?? ''}`.trim()
          : 'Chưa phân công',
        unit: item.unit ?? item.unitId ?? '',
        dueDate: deadline.toISOString(),
        receivedDate: (item.createdAt ?? item.receivedDate ?? new Date()).toISOString(),
        daysOverdue,
        status: item.status,
        priority: item.priority ?? computedPriority,
      };
    };

    let records = [
      ...overdueCases.map((c) => toOverdueRecord(c, 'case')),
      ...overdueIncidents.map((i) => toOverdueRecord(i, 'incident')),
      ...overduePetitions.map((p) => toOverdueRecord(p, 'petition')),
    ];

    // Filter by minDaysOverdue
    if (minDaysOverdue && minDaysOverdue > 0) {
      records = records.filter((r) => r.daysOverdue >= minDaysOverdue);
    }

    // Sort by daysOverdue descending
    records.sort((a, b) => b.daysOverdue - a.daysOverdue);

    return {
      success: true,
      data: records,
      total: records.length,
    };
  }

  // ─────────────────────────────────────────────
  // GET /api/v1/reports/stat48?fromDate=&toDate=&unit=
  // ─────────────────────────────────────────────
  async getStat48(fromDate: string, toDate: string, unit?: string) {
    const from = new Date(fromDate);
    const to = new Date(toDate + 'T23:59:59.999Z');

    const cases = await this.prisma.case.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        deletedAt: null,
        ...(unit ? { unit } : {}),
      },
      select: { metadata: true },
    });

    if (cases.length > 2000) {
      this.logger.warn(
        `getStat48: ${cases.length} cases — consider narrowing date range`,
      );
    }

    const totalCases = cases.length;
    const nullCount = cases.filter(
      (c) => !(c.metadata as Record<string, unknown> | null)?.['stat48'],
    ).length;
    const nullRatePct =
      totalCases > 0 ? Math.round((nullCount / totalCases) * 100) : 0;

    const groups = STAT_GROUPS.map((group) => ({
      name: group.name,
      fields: group.fields.map((field) => {
        const values = cases
          .map((c) => {
            const meta = c.metadata as Record<string, unknown> | null;
            const stat48 = meta?.['stat48'] as Record<string, unknown> | undefined;
            return stat48?.[field];
          })
          .filter((v) => v != null && v !== '');

        const dataCount = values.length;

        if (NUMERIC_FIELDS.has(field)) {
          const total = values.reduce(
            (a: number, b) => a + Number(b ?? 0),
            0,
          ) as number;
          return {
            field,
            type: 'numeric' as const,
            total,
            dataCount,
            nullCount: totalCases - dataCount,
          };
        } else {
          const dist: Record<string, number> = {};
          values.forEach((v) => {
            const key = String(v);
            dist[key] = (dist[key] ?? 0) + 1;
          });
          return {
            field,
            type: 'categorical' as const,
            distribution: dist,
            dataCount,
            nullCount: totalCases - dataCount,
          };
        }
      }),
    }));

    return {
      success: true,
      totalCases,
      nullCount,
      nullRatePct,
      isDraft: nullRatePct > 50,
      fromDate,
      toDate,
      unit,
      groups,
    };
  }
}
