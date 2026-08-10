import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * D7/D8 — ghi lại mỗi lần một báo cáo rời khỏi hệ thống.
 *
 * Trước đây xuất Phụ lục không để lại dấu vết nào: file đi ra, không ai biết
 * nó đã đi. Với số liệu tố tụng, "ai đang cầm bản này" là câu hỏi có thật.
 *
 * KHÔNG có checksum. Bộ xuất ghi thẳng ra `res` bằng streaming writer; gom cả
 * file vào bộ nhớ để băm là mở lại đúng rủi ro OOM mà kế hoạch đã cảnh báo với
 * bộ dữ liệu lớn. "Ai, gì, khi nào, bao nhiêu dòng" trả lời được câu hỏi thực
 * tế mà không đánh đổi bằng bộ nhớ.
 */
@Injectable()
export class ReportExportLogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ghi một lần xuất. KHÔNG BAO GIỜ ném.
   *
   * Ghi log hỏng mà làm hỏng luôn việc xuất là đánh đổi sai chiều: người dùng
   * mất file vì hệ thống không ghi được sổ. Lỗi ở đây bị nuốt có chủ ý.
   */
  async record(entry: {
    reportType: string;
    fileName: string;
    rowCount?: number;
    periodStart?: Date | null;
    periodEnd?: Date | null;
    succeeded?: boolean;
    errorText?: string | null;
    exportedById?: string | null;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      await this.prisma.reportExportLog.create({
        data: {
          reportType: entry.reportType,
          fileName: entry.fileName,
          rowCount: entry.rowCount ?? 0,
          periodStart: entry.periodStart ?? null,
          periodEnd: entry.periodEnd ?? null,
          succeeded: entry.succeeded ?? true,
          errorText: entry.errorText ?? null,
          exportedById: entry.exportedById ?? null,
          ipAddress: entry.ipAddress ?? null,
          userAgent: entry.userAgent ?? null,
        },
      });
    } catch {
      // Có chủ ý: xem ghi chú trên hàm.
    }
  }

  async list(query: {
    reportType?: string;
    exportedById?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(Number(query.limit) || 50, 100);
    const offset = Math.max(Number(query.offset) || 0, 0);

    const where: Prisma.ReportExportLogWhereInput = {
      ...(query.reportType ? { reportType: query.reportType } : {}),
      ...(query.exportedById ? { exportedById: query.exportedById } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.reportExportLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          exportedBy: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prisma.reportExportLog.count({ where }),
    ]);

    return { data, total, limit, offset };
  }

  async getById(id: string) {
    const record = await this.prisma.reportExportLog.findUnique({
      where: { id },
      include: {
        exportedBy: {
          select: { id: true, username: true, firstName: true, lastName: true },
        },
      },
    });
    if (!record) {
      throw new NotFoundException(
        `Không tìm thấy lượt xuất báo cáo (id: ${id})`,
      );
    }
    return record;
  }
}
