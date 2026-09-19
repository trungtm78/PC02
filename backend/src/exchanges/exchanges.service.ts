import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateExchangeDto,
  CreateExchangeMessageDto,
} from './dto/create-exchange.dto';
import { ExchangeStatus, Prisma } from '@prisma/client';
import type { DataScope } from '../auth/services/unit-scope.service';
import { assertCreatorInScope } from '../common/utils/scope-filter.util';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { UpdateExchangeDto } from './dto/update-exchange.dto';
import { BoTimKiem } from '../common/tim-kiem/bo-tim-kiem';
import {
  DO_DAI_GIA_TRI_TOI_DA,
  KHOA_TAT_CA,
  SO_THE_TOI_DA,
  docKhoangNgay,
} from '../common/tim-kiem/dieu-kien';
import { KHAI_TIM_KIEM_TRAO_DOI } from '../common/tim-kiem/khai/trao-doi.khai';
import { maHoSoHeCu } from '../common/utils/ho-so-code.util';

/** `search` cũ (đường dẫn cũ, cờ thẻ tắt) → thẻ "tất cả các cột". */
const THAM_SO_CU_TRAO_DOI = { search: KHOA_TAT_CA } as const;

/** Một mục `khoá~giá trị`: khoá dài nhất cỡ vài chục ký tự + dấu `~` + giá trị. */
const DO_DAI_MUC_THE_TOI_DA = DO_DAI_GIA_TRI_TOI_DA + 50;

export class QueryExchangesDto {
  /** Thẻ của ô tìm dạng thẻ: `khoá~giá trị`, lặp được. Khoá lạ → 400 (`common/tim-kiem/dieu-kien.ts`). */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? undefined : Array.isArray(value) ? value : [value],
  )
  @IsArray()
  @ArrayMaxSize(SO_THE_TOI_DA)
  @IsString({ each: true })
  @MaxLength(DO_DAI_MUC_THE_TOI_DA, { each: true })
  tk?: string[];

  /** Ô tìm cũ — quy về thẻ "tất cả các cột"; máy chủ tự cắt độ dài. */
  @IsOptional() @IsString() search?: string;
  /** Mã `ExchangeStatus` — lạ → 400 ở service. */
  @IsOptional() @IsString() status?: string;
  /** `yyyy-mm-dd` theo ngày Việt Nam, lọc Thời gian khởi tạo. */
  @IsOptional() @IsString() fromDate?: string;
  /** `yyyy-mm-dd`, gồm trọn ngày này. */
  @IsOptional() @IsString() toDate?: string;
  @IsOptional() @IsInt() @Min(1) @Max(200) @Type(() => Number) limit?: number =
    20;
  @IsOptional() @IsInt() @Min(0) @Type(() => Number) offset?: number = 0;
}

@Injectable()
export class ExchangesService {
  private boTimKiem?: BoTimKiem;

  /** Tạo LƯỜI: khởi tạo ở khai báo field thì `this.prisma` có thể chưa gán. */
  private get timKiem(): BoTimKiem {
    return (this.boTimKiem ??= new BoTimKiem(
      this.prisma,
      KHAI_TIM_KIEM_TRAO_DOI,
      THAM_SO_CU_TRAO_DOI,
    ));
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getList(query: QueryExchangesDto, dataScope?: DataScope | null) {
    const { status, limit = 20, offset = 0 } = query;
    const where = await this.dungWhere(query, dataScope);
    if (status) where.status = this.trangThai(status);

    const [data, total] = await Promise.all([
      this.prisma.exchange.findMany({
        where,
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: {
              sender: { select: { id: true, firstName: true, lastName: true } },
            },
          },
          _count: { select: { messages: true } },
        },
        // Khoá sắp phụ `id`: cùng updatedAt (di trú hàng loạt) thì thứ tự ổn định giữa các trang.
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.exchange.count({ where }),
    ]);

    // Bản thô hệ cũ (~6,7 KB mỗi hồ sơ) chỉ dùng rút mã rồi BỎ — không gửi ra trình duyệt.
    const enriched = data.map(({ legacyRaw, ...ex }) => ({
      ...ex,
      // Mã đang lưu; rỗng (73/76 bản di trú) thì mã `năm-stt` hệ cũ.
      maHoSo: ex.recordCode || maHoSoHeCu(legacyRaw),
      messageCount: ex._count.messages,
      lastMessage: ex.messages[0]?.content ?? null,
      lastMessageTime: ex.messages[0]?.createdAt ?? null,
    }));

    return {
      success: true,
      data: enriched,
      total,
      page: Math.floor(offset / limit) + 1,
      pageSize: limit,
    };
  }

  /**
   * Where của danh sách: thẻ tìm, khoảng Thời gian khởi tạo, phạm vi — các phần tử AND riêng.
   *
   * Phạm vi KHỚP quyền xem chi tiết (`getById` → `assertCreatorInScope`): người điều phối đọc toàn bộ;
   * có userIds → theo người tạo; tổ trưởng (userIds rỗng) → mọi bản CÓ người tạo (bản người tạo rỗng
   * `getById` từ chối 403). Trước 17/09/2026 người điều phối bị lọc theo người tạo, tổ trưởng thấy cả bản
   * mở ra 403.
   */
  private async dungWhere(
    query: QueryExchangesDto,
    dataScope?: DataScope | null,
  ): Promise<Prisma.ExchangeWhereInput> {
    const dieuKien = (await this.timKiem.dieuKien(
      query,
    )) as Prisma.ExchangeWhereInput[];
    const where: Prisma.ExchangeWhereInput = { deletedAt: null };

    const tu = this.khoangNgay(query.fromDate);
    const den = this.khoangNgay(query.toDate);
    if (tu || den)
      where.createdAt = {
        ...(tu && { gte: tu.gte }),
        ...(den && { lt: den.lt }),
      };

    if (dataScope && !dataScope.canDispatch) {
      const { userIds, teamIds } = dataScope;
      if (userIds.length === 0 && teamIds.length === 0) {
        dieuKien.push({ id: '__no_access__' });
      } else if (userIds.length > 0) {
        dieuKien.push({ createdById: { in: userIds } });
      } else {
        dieuKien.push({ createdById: { not: null } });
      }
    }
    if (dieuKien.length) where.AND = dieuKien;
    return where;
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

  private trangThai(giaTri: string): ExchangeStatus {
    if (!(Object.values(ExchangeStatus) as string[]).includes(giaTri)) {
      throw new BadRequestException(`Trạng thái không hợp lệ: ${giaTri}`);
    }
    return giaTri as ExchangeStatus;
  }

  async getById(id: string, dataScope?: DataScope | null) {
    const record = await this.prisma.exchange.findFirst({
      where: { id, deletedAt: null },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: {
            sender: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!record)
      throw new NotFoundException(`Trao đổi không tồn tại (id: ${id})`);
    assertCreatorInScope(record.createdById, dataScope);
    return { success: true, data: record };
  }

  async getMessages(exchangeId: string, dataScope?: DataScope | null) {
    await this.getById(exchangeId, dataScope);

    const messages = await this.prisma.exchangeMessage.findMany({
      where: { exchangeId },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return { success: true, data: messages };
  }

  async create(
    dto: CreateExchangeDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    // Tạo trao đổi và tin nhắn đầu tiên (nội dung form) trong MỘT giao dịch — không để trao đổi rỗng khi
    // ghi tin nhắn hỏng.
    const record = await this.prisma.$transaction(async (tx) => {
      const tao = await tx.exchange.create({
        data: {
          recordCode: dto.recordCode,
          recordType: dto.recordType,
          senderUnit: dto.senderUnit,
          receiverUnit: dto.receiverUnit,
          subject: dto.subject,
          createdById: actorId,
          status: dto.status ?? ExchangeStatus.OPEN,
        },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
        },
      });
      if (dto.content?.trim()) {
        await tx.exchangeMessage.create({
          data: {
            exchangeId: tao.id,
            senderId: actorId,
            content: dto.content.trim(),
            attachments: [],
          },
        });
      }
      return tao;
    });

    await this.audit.log({
      userId: actorId,
      action: 'EXCHANGE_CREATED',
      subject: 'Exchange',
      subjectId: record.id,
      metadata: { subject: record.subject },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, data: record, message: 'Tạo trao đổi thành công' };
  }

  /**
   * Gửi tin nhắn — chỉ vào trao đổi mình XEM được (cùng luật `getById`). Trước 17/09/2026 không kiểm phạm
   * vi: biết id là gửi được tin vào trao đổi của đơn vị khác.
   */
  async addMessage(
    dto: CreateExchangeMessageDto,
    actorId: string,
    dataScope?: DataScope | null,
  ) {
    const exchange = await this.prisma.exchange.findFirst({
      where: { id: dto.exchangeId, deletedAt: null },
    });
    if (!exchange) throw new NotFoundException(`Trao đổi không tồn tại`);
    // Gửi tin là GHI: điều phối viên cũng chỉ trong phạm vi ghi (quyết định 19/09/2026).
    assertCreatorInScope(exchange.createdById, dataScope, 'write');

    const message = await this.prisma.exchangeMessage.create({
      data: {
        exchangeId: dto.exchangeId,
        senderId: actorId,
        content: dto.content,
        attachments: dto.attachments ?? [],
      },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Update exchange updatedAt
    await this.prisma.exchange.update({
      where: { id: dto.exchangeId },
      data: { updatedAt: new Date() },
    });

    return { success: true, data: message, message: 'Gửi tin nhắn thành công' };
  }

  async update(
    id: string,
    dto: UpdateExchangeDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
    dataScope?: DataScope | null,
  ) {
    const { data: existing } = await this.getById(id, dataScope);
    assertCreatorInScope(existing.createdById, dataScope, 'write');

    const record = await this.prisma.exchange.update({
      where: { id },
      data: {
        ...(dto.status !== undefined && {
          status: dto.status,
        }),
        ...(dto.subject !== undefined && { subject: dto.subject }),
        ...(dto.receiverUnit !== undefined && {
          receiverUnit: dto.receiverUnit,
        }),
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'EXCHANGE_UPDATED',
      subject: 'Exchange',
      subjectId: id,
      metadata: {
        before: {
          status: existing.status,
          subject: existing.subject,
          receiverUnit: existing.receiverUnit,
        },
        after: dto,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return {
      success: true,
      data: record,
      message: 'Cập nhật trao đổi thành công',
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

    await this.prisma.exchange.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      userId: actorId,
      action: 'EXCHANGE_DELETED',
      subject: 'Exchange',
      subjectId: id,
      metadata: {},
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, message: 'Xóa trao đổi thành công' };
  }
}
