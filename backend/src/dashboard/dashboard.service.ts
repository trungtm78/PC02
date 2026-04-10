import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CaseStatus, IncidentStatus, PetitionStatus, SubjectType } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  // GET /api/v1/dashboard/stats
  async getStats() {
    const now = new Date();

    const [
      totalCases,
      newCasesThisMonth,
      overdueCases,
      processedCases,
      totalIncidents,
      totalPetitions,
    ] = await Promise.all([
      // Tổng vụ án active
      this.prisma.case.count({ where: { deletedAt: null } }),
      // Vụ án mới trong tháng này
      this.prisma.case.count({
        where: {
          deletedAt: null,
          createdAt: {
            gte: new Date(now.getFullYear(), now.getMonth(), 1),
          },
        },
      }),
      // Vụ án quá hạn (deadline < now và chưa kết thúc)
      this.prisma.case.count({
        where: {
          deletedAt: null,
          deadline: { lt: now },
          status: {
            notIn: [
              CaseStatus.DA_KET_LUAN,
              CaseStatus.DA_LUU_TRU,
              CaseStatus.DINH_CHI,
            ],
          },
        },
      }),
      // Vụ án đã xử lý (kết luận hoặc lưu trữ)
      this.prisma.case.count({
        where: {
          deletedAt: null,
          status: {
            in: [CaseStatus.DA_KET_LUAN, CaseStatus.DA_LUU_TRU],
          },
        },
      }),
      // Tổng vụ việc
      this.prisma.incident.count({ where: { deletedAt: null } }),
      // Tổng đơn thư
      this.prisma.petition.count({ where: { deletedAt: null } }),
    ]);

    return {
      success: true,
      data: {
        totalCases,
        newCases: newCasesThisMonth,
        overdueCases,
        processedCases,
        totalIncidents,
        totalPetitions,
      },
    };
  }

  // GET /api/v1/dashboard/charts
  async getCharts() {
    const now = new Date();
    const year = now.getFullYear();

    // Monthly trend: 12 months of the current year
    const monthlyTrend = await Promise.all(
      Array.from({ length: 12 }, async (_, i) => {
        const monthStart = new Date(year, i, 1);
        const monthEnd = new Date(year, i + 1, 0, 23, 59, 59, 999);
        const [cases, incidents, petitions] = await Promise.all([
          this.prisma.case.count({
            where: {
              deletedAt: null,
              createdAt: { gte: monthStart, lte: monthEnd },
            },
          }),
          this.prisma.incident.count({
            where: {
              deletedAt: null,
              createdAt: { gte: monthStart, lte: monthEnd },
            },
          }),
          this.prisma.petition.count({
            where: {
              deletedAt: null,
              createdAt: { gte: monthStart, lte: monthEnd },
            },
          }),
        ]);
        return {
          month: `T${i + 1}`,
          cases,
          incidents,
          petitions,
        };
      }),
    );

    // Case status breakdown
    const caseStatusCounts = await this.prisma.case.groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: { id: true },
    });

    const STATUS_LABELS: Record<string, string> = {
      TIEP_NHAN: 'Tiếp nhận',
      DANG_XAC_MINH: 'Đang xác minh',
      DA_XAC_MINH: 'Đã xác minh',
      DANG_DIEU_TRA: 'Đang điều tra',
      TAM_DINH_CHI: 'Tạm đình chỉ',
      DINH_CHI: 'Đình chỉ',
      DA_KET_LUAN: 'Đã kết luận',
      DANG_TRUY_TO: 'Đang truy tố',
      DANG_XET_XU: 'Đang xét xử',
      DA_LUU_TRU: 'Đã lưu trữ',
    };

    const structure = caseStatusCounts.map((item) => ({
      name: STATUS_LABELS[item.status] ?? item.status,
      value: item._count.id,
    }));

    return {
      success: true,
      data: {
        trends: monthlyTrend,
        structure,
      },
    };
  }

  // GET /api/v1/dashboard/badge-counts
  async getBadgeCounts() {
    const now = new Date();

    const [
      totalCases,
      suspectCount,
      petitionCount,
      incidentCount,
      overdueCasesCount,
    ] = await Promise.all([
      // Danh sách vụ án: tổng vụ án đang active
      this.prisma.case.count({ where: { deletedAt: null } }),
      // Bị can / Bị cáo: đang điều tra
      this.prisma.subject.count({
        where: {
          deletedAt: null,
          type: SubjectType.SUSPECT,
        },
      }),
      // Quản lý đơn thư: chưa giải quyết
      this.prisma.petition.count({
        where: {
          deletedAt: null,
          status: {
            notIn: [PetitionStatus.DA_GIAI_QUYET, PetitionStatus.DA_LUU_DON],
          },
        },
      }),
      // Quản lý vụ việc: chưa giải quyết
      this.prisma.incident.count({
        where: {
          deletedAt: null,
          status: {
            notIn: [IncidentStatus.DA_GIAI_QUYET],
          },
        },
      }),
      // Hồ sơ trễ hạn
      this.prisma.case.count({
        where: {
          deletedAt: null,
          deadline: { lt: now },
          status: {
            notIn: [
              CaseStatus.DA_KET_LUAN,
              CaseStatus.DA_LUU_TRU,
              CaseStatus.DINH_CHI,
            ],
          },
        },
      }),
    ]);

    return {
      success: true,
      data: {
        cases: totalCases,
        suspects: suspectCount,
        petitions: petitionCount,
        incidents: incidentCount,
        overdueRecords: overdueCasesCount,
      },
    };
  }

}