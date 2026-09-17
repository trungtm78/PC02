import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateGuidanceDto } from './dto/create-guidance.dto';
import { QueryGuidanceDto } from './dto/query-guidance.dto';
import { GuidanceStatus, Prisma } from '@prisma/client';
import type { DataScope } from '../auth/services/unit-scope.service';
import { assertCreatorInScope } from '../common/utils/scope-filter.util';
import { BoTimKiem } from '../common/tim-kiem/bo-tim-kiem';
import { KHOA_TAT_CA, docKhoangNgay } from '../common/tim-kiem/dieu-kien';
import { KHAI_TIM_KIEM_HUONG_DAN } from '../common/tim-kiem/khai/huong-dan.khai';
import { maHoSoHeCu } from '../common/utils/ho-so-code.util';

/** `search` cũ (đường dẫn cũ) → thẻ "tất cả các cột". */
const THAM_SO_CU_HUONG_DAN = { search: KHOA_TAT_CA } as const;

/** Khoá thẻ Trạng thái trong khai Hướng dẫn đơn. */
const KHOA_TRANG_THAI = 'trangThai';

const LECH_GIO_VIET_NAM_MS = 7 * 60 * 60 * 1000;

/** `yyyy-mm-dd` theo giờ Việt Nam. */
const ngayVietNam = (d: Date) =>
  new Date(d.getTime() + LECH_GIO_VIET_NAM_MS).toISOString().slice(0, 10);

/**
 * Cột của một dòng danh sách. Đọc `legacyRaw` chỉ để rút mã `năm-stt` rồi BỎ khỏi kết quả — bản thô
 * hệ cũ ~6,7 KB mỗi hồ sơ, không gửi ra trình duyệt.
 */
const CHON_DONG_DANH_SACH = {
  id: true,
  date: true,
  unit: true,
  createdById: true,
  guidedPerson: true,
  guidedPersonPhone: true,
  subject: true,
  guidanceContent: true,
  notes: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  legacyRaw: true,
  createdBy: {
    select: { id: true, firstName: true, lastName: true, username: true },
  },
} satisfies Prisma.GuidanceRecordSelect;

@Injectable()
export class GuidanceService {
  private boTimKiem?: BoTimKiem;

  /** Tạo LƯỜI: khởi tạo ở khai báo field thì `this.prisma` có thể chưa gán. */
  private get timKiem(): BoTimKiem {
    return (this.boTimKiem ??= new BoTimKiem(
      this.prisma,
      KHAI_TIM_KIEM_HUONG_DAN,
      THAM_SO_CU_HUONG_DAN,
    ));
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getList(query: QueryGuidanceDto, dataScope?: DataScope | null) {
    const { status, limit = 20, offset = 0 } = query;
    const where = await this.dungWhere(query, dataScope);
    if (status) where.status = this.trangThai(status);

    const [rows, total] = await Promise.all([
      this.prisma.guidanceRecord.findMany({
        where,
        select: CHON_DONG_DANH_SACH,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.guidanceRecord.count({ where }),
    ]);

    const data = rows.map(({ legacyRaw, ...dong }) => ({
      ...dong,
      maHoSo: maHoSoHeCu(legacyRaw),
    }));
    return {
      success: true,
      data,
      total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
    };
  }

  /**
   * Thẻ thống kê của màn — đếm ở MÁY CHỦ trên cùng thẻ, khoảng ngày và phạm vi với danh sách. Bỏ lọc
   * trạng thái: thẻ "Đã hoàn thành" không được về 0 khi đang xem "Chờ hoàn thành". Trước đây màn đếm
   * trên 100 dòng đã tải trong khi prod có 541 bản ghi.
   */
  async getStats(
    query: QueryGuidanceDto,
    dataScope?: DataScope | null,
    bayGio: Date = new Date(),
  ) {
    // Thẻ Trạng thái cũng không thu hẹp thống kê — như tham số `status` — để lọc bằng thẻ hay bằng ô
    // chọn cho CÙNG bộ số.
    const tk = (
      Array.isArray(query.tk) ? query.tk : query.tk ? [query.tk] : []
    ).filter((t) => !t.startsWith(`${KHOA_TRANG_THAI}~`));
    const where = await this.dungWhere({ ...query, tk }, dataScope);
    const homNay = docKhoangNgay(ngayVietNam(bayGio));
    const [nhom, today] = await Promise.all([
      this.prisma.guidanceRecord.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      this.prisma.guidanceRecord.count({
        where: {
          ...where,
          AND: [...this.dsAnd(where), ...(homNay ? [{ date: homNay }] : [])],
        },
      }),
    ]);
    const byStatus = Object.fromEntries(
      Object.values(GuidanceStatus).map((t) => [t, 0]),
    ) as Record<GuidanceStatus, number>;
    for (const n of nhom) byStatus[n.status] = n._count._all;
    const total = Object.values(byStatus).reduce((a, b) => a + b, 0);
    return { total, byStatus, today };
  }

  /** Where chung của danh sách và thống kê: thẻ tìm, khoảng ngày (cột `date`), phạm vi dữ liệu. */
  private async dungWhere(
    query: QueryGuidanceDto,
    dataScope?: DataScope | null,
  ): Promise<Prisma.GuidanceRecordWhereInput> {
    // Tìm kiếm và phạm vi là HAI phần tử riêng trong AND — cùng lớp lỗi đã vá ở Tài liệu (b9c1853d):
    // gán chung `where.OR` thì khối chạy sau đè mất khối trước.
    const dieuKien = (await this.timKiem.dieuKien(
      query,
    )) as Prisma.GuidanceRecordWhereInput[];
    const where: Prisma.GuidanceRecordWhereInput = { deletedAt: null };

    // Lọc NGÀY HIỆN TRÊN BẢNG (`date`), theo ngày Việt Nam, gồm trọn ngày cuối. Không lọc `createdAt`:
    // đo prod 17/09/2026, cả 541 bản di trú có `createdAt` = ngày chạy di trú (23/07/2026).
    const tu = this.khoangNgay(query.fromDate);
    const den = this.khoangNgay(query.toDate);
    if (tu || den)
      where.date = { ...(tu && { gte: tu.gte }), ...(den && { lt: den.lt }) };

    if (dataScope) {
      const { userIds, teamIds } = dataScope;
      if (userIds.length === 0 && teamIds.length === 0) {
        dieuKien.push({ id: '__no_access__' });
      } else if (userIds.length > 0) {
        dieuKien.push({ createdById: { in: userIds } });
      }
      // userIds=[] + teamIds non-empty: team leader, no user restriction — show all
    }
    if (dieuKien.length) where.AND = dieuKien;
    return where;
  }

  private dsAnd(
    where: Prisma.GuidanceRecordWhereInput,
  ): Prisma.GuidanceRecordWhereInput[] {
    const and = where.AND;
    return and === undefined ? [] : Array.isArray(and) ? and : [and];
  }

  private khoangNgay(giaTri?: string) {
    if (!giaTri) return undefined;
    const khoang = docKhoangNgay(giaTri);
    if (!khoang || !/^\d{4}-\d{2}-\d{2}$/.test(giaTri.trim())) {
      throw new BadRequestException(
        `Ngày không hợp lệ: ${giaTri} (dạng yyyy-mm-dd)`,
      );
    }
    return khoang;
  }

  private trangThai(giaTri: string): GuidanceStatus {
    if (!(Object.values(GuidanceStatus) as string[]).includes(giaTri)) {
      throw new BadRequestException(`Trạng thái không hợp lệ: ${giaTri}`);
    }
    return giaTri as GuidanceStatus;
  }

  async getById(id: string, dataScope?: DataScope | null) {
    const record = await this.prisma.guidanceRecord.findFirst({
      where: { id, deletedAt: null },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    if (!record)
      throw new NotFoundException(
        `Bản ghi hướng dẫn không tồn tại (id: ${id})`,
      );
    assertCreatorInScope(record.createdById, dataScope);
    return { success: true, data: record };
  }

  async create(
    dto: CreateGuidanceDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const record = await this.prisma.guidanceRecord.create({
      data: {
        date: dto.date ? new Date(dto.date) : new Date(),
        unit: dto.unit,
        createdById: actorId,
        guidedPerson: dto.guidedPerson,
        guidedPersonPhone: dto.guidedPersonPhone,
        subject: dto.subject,
        guidanceContent: dto.guidanceContent,
        notes: dto.notes,
        status: dto.status ?? GuidanceStatus.PENDING,
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'GUIDANCE_CREATED',
      subject: 'GuidanceRecord',
      subjectId: record.id,
      metadata: { guidedPerson: record.guidedPerson },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return {
      success: true,
      data: record,
      message: 'Tạo bản ghi hướng dẫn thành công',
    };
  }

  async update(
    id: string,
    dto: Partial<CreateGuidanceDto>,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
    dataScope?: DataScope | null,
  ) {
    const { data: existing } = await this.getById(id, dataScope);
    assertCreatorInScope(existing.createdById, dataScope, 'write');

    const record = await this.prisma.guidanceRecord.update({
      where: { id },
      data: {
        ...(dto.guidedPerson !== undefined && {
          guidedPerson: dto.guidedPerson,
        }),
        ...(dto.guidedPersonPhone !== undefined && {
          guidedPersonPhone: dto.guidedPersonPhone,
        }),
        ...(dto.subject !== undefined && { subject: dto.subject }),
        ...(dto.guidanceContent !== undefined && {
          guidanceContent: dto.guidanceContent,
        }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.status !== undefined && {
          status: dto.status,
        }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'GUIDANCE_UPDATED',
      subject: 'GuidanceRecord',
      subjectId: id,
      metadata: {
        before: {
          status: existing.status,
          guidedPerson: existing.guidedPerson,
        },
        after: dto,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return {
      success: true,
      data: record,
      message: 'Cập nhật bản ghi hướng dẫn thành công',
    };
  }

  async delete(
    id: string,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
    dataScope?: DataScope | null,
  ) {
    const { data: existing } = await this.getById(id, dataScope);
    assertCreatorInScope(existing.createdById, dataScope, 'write');

    await this.prisma.guidanceRecord.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      userId: actorId,
      action: 'GUIDANCE_DELETED',
      subject: 'GuidanceRecord',
      subjectId: id,
      metadata: { guidedPerson: existing.guidedPerson },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, message: 'Xóa bản ghi hướng dẫn thành công' };
  }
}
