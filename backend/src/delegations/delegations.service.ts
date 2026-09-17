import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateDelegationDto } from './dto/create-delegation.dto';
import { UpdateDelegationDto } from './dto/update-delegation.dto';
import { DelegationStatus, Prisma } from '@prisma/client';
import type { DataScope } from '../auth/services/unit-scope.service';
import {
  assertParentInScope,
  assertCreatorInScope,
  buildScopeFilter,
} from '../common/utils/scope-filter.util';
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
import { DocumentNumbersService } from '../document-numbers/document-numbers.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UydtAssignedEvent } from '../notifications/events/notification.events';
import { BoTimKiem } from '../common/tim-kiem/bo-tim-kiem';
import {
  DO_DAI_GIA_TRI_TOI_DA,
  KHOA_TAT_CA,
  SO_THE_TOI_DA,
  docKhoangNgay,
} from '../common/tim-kiem/dieu-kien';
import { KHAI_TIM_KIEM_UY_THAC } from '../common/tim-kiem/khai/uy-thac.khai';

/** Ô tìm cũ → khối hoặc: mọi cột trên bảng + TÊN vụ án liên quan (thẻ `*` chỉ gồm cột trên bảng). */
const THAM_SO_CU_UY_THAC = { search: [KHOA_TAT_CA, 'hoSoLienQuan'] } as const;

/** Khoá thẻ Trạng thái — thống kê bỏ thẻ này như bỏ tham số `status`. */
const KHOA_TRANG_THAI = 'trangThai';

/** Một mục `khoá~giá trị`: khoá dài nhất cỡ vài chục ký tự + dấu `~` + giá trị. */
const DO_DAI_MUC_THE_TOI_DA = DO_DAI_GIA_TRI_TOI_DA + 50;

export class QueryDelegationsDto {
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

  /** Ô tìm cũ — quy về khối hoặc mọi cột + tên vụ án liên quan; máy chủ tự cắt độ dài. */
  @IsOptional() @IsString() search?: string;
  /** Mã `DelegationStatus` — lạ → 400 ở service. */
  @IsOptional() @IsString() status?: string;
  /** `yyyy-mm-dd` theo ngày Việt Nam, lọc Ngày ủy thác. */
  @IsOptional() @IsString() fromDate?: string;
  /** `yyyy-mm-dd`, gồm trọn ngày này. */
  @IsOptional() @IsString() toDate?: string;
  @IsOptional() @IsInt() @Min(1) @Max(200) @Type(() => Number) limit?: number =
    20;
  @IsOptional() @IsInt() @Min(0) @Type(() => Number) offset?: number = 0;
}

@Injectable()
export class DelegationsService {
  private boTimKiem?: BoTimKiem;

  /** Tạo LƯỜI: khởi tạo ở khai báo field thì `this.prisma` có thể chưa gán. */
  private get timKiem(): BoTimKiem {
    return (this.boTimKiem ??= new BoTimKiem(
      this.prisma,
      KHAI_TIM_KIEM_UY_THAC,
      THAM_SO_CU_UY_THAC,
    ));
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly docNums: DocumentNumbersService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getList(query: QueryDelegationsDto, dataScope?: DataScope | null) {
    const { status, limit = 20, offset = 0 } = query;
    const where = await this.dungWhere(query, dataScope);
    if (status) where.status = this.trangThai(status);

    const [data, total] = await Promise.all([
      this.prisma.delegation.findMany({
        where,
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          relatedCase: { select: { id: true, name: true } },
        },
        // Khoá sắp phụ `id`: cùng createdAt (nạp hàng loạt) thì thứ tự ổn định giữa các trang.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        skip: offset,
      }),
      this.prisma.delegation.count({ where }),
    ]);

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
   * trạng thái (tham số lẫn thẻ) để các thẻ trạng thái không về 0 khi đang xem một trạng thái.
   */
  async getStats(query: QueryDelegationsDto, dataScope?: DataScope | null) {
    const tk = (
      Array.isArray(query.tk) ? query.tk : query.tk ? [query.tk] : []
    ).filter((t) => !t.startsWith(`${KHOA_TRANG_THAI}~`));
    const where = await this.dungWhere({ ...query, tk }, dataScope);
    const nhom = await this.prisma.delegation.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });
    const byStatus = Object.fromEntries(
      Object.values(DelegationStatus).map((t) => [t, 0]),
    ) as Record<DelegationStatus, number>;
    for (const n of nhom) byStatus[n.status] = n._count._all;
    const total = Object.values(byStatus).reduce((x, y) => x + y, 0);
    return { total, byStatus };
  }

  /**
   * Where chung của danh sách và thống kê: thẻ tìm, khoảng Ngày ủy thác, phạm vi dữ liệu — các phần tử
   * AND riêng. Trước 17/09/2026 ô tìm và phạm vi cùng gán `where.OR`, khối phạm vi đè mất khối tìm.
   */
  private async dungWhere(
    query: QueryDelegationsDto,
    dataScope?: DataScope | null,
  ): Promise<Prisma.DelegationWhereInput> {
    const dieuKien = (await this.timKiem.dieuKien(
      query,
    )) as Prisma.DelegationWhereInput[];
    const where: Prisma.DelegationWhereInput = { deletedAt: null };

    // Lọc NGÀY ỦY THÁC đang hiện trên bảng (trước lọc `createdAt` — ngày nhập máy), theo ngày Việt Nam.
    const tu = this.khoangNgay(query.fromDate);
    const den = this.khoangNgay(query.toDate);
    if (tu || den)
      where.delegationDate = {
        ...(tu && { gte: tu.gte }),
        ...(den && { lt: den.lt }),
      };

    // Phạm vi KHỚP quyền xem chi tiết (`getById`): gắn vụ án → phạm vi vụ án; không gắn → người tạo.
    // Người điều phối đọc toàn bộ; tổ trưởng (userIds rỗng, có tổ) thấy mọi bản không gắn hồ sơ.
    if (dataScope && !dataScope.canDispatch) {
      const { userIds, teamIds } = dataScope;
      if (userIds.length === 0 && teamIds.length === 0) {
        dieuKien.push({ id: '__no_access__' });
      } else {
        const caseScope = buildScopeFilter(dataScope);
        const phamVi: Prisma.DelegationWhereInput[] = [];
        if (caseScope)
          phamVi.push({ relatedCase: caseScope as Prisma.CaseWhereInput });
        phamVi.push(
          userIds.length > 0
            ? { relatedCase: null, createdById: { in: userIds } }
            : // Chỉ bản CÓ người tạo: getById (assertCreatorInScope) từ chối bản createdById rỗng — hiện
              // trong danh sách mà mở ra 403 (người tạo bị xoá → SetNull).
              { relatedCase: null, createdById: { not: null } },
        );
        dieuKien.push({ OR: phamVi });
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

  private trangThai(giaTri: string): DelegationStatus {
    if (!(Object.values(DelegationStatus) as string[]).includes(giaTri)) {
      throw new BadRequestException(`Trạng thái không hợp lệ: ${giaTri}`);
    }
    return giaTri as DelegationStatus;
  }

  async getById(id: string, dataScope?: DataScope | null) {
    const record = await this.prisma.delegation.findFirst({
      where: { id, deletedAt: null },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        relatedCase: {
          select: {
            id: true,
            name: true,
            assignedTeamId: true,
            investigatorId: true,
          },
        },
      },
    });
    if (!record)
      throw new NotFoundException(`Ủy thác không tồn tại (id: ${id})`);
    if (record.relatedCase) {
      assertParentInScope(record.relatedCase, dataScope);
    } else {
      assertCreatorInScope(record.createdById, dataScope);
    }
    return { success: true, data: record };
  }

  async create(
    dto: CreateDelegationDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    let resolvedDelegationNumber: string | undefined = dto.delegationNumber;

    const record = await this.prisma.$transaction(async (tx: any) => {
      if (!resolvedDelegationNumber) {
        const { number, logId } = await this.docNums.commitWithTx(
          'DELEGATION',
          { userId: actorId },
          tx,
        );
        resolvedDelegationNumber = number;
        const rec = await tx.delegation.create({
          data: {
            delegationNumber: resolvedDelegationNumber,
            delegationDate: dto.delegationDate
              ? new Date(dto.delegationDate)
              : new Date(),
            receivingUnit: dto.receivingUnit,
            content: dto.content,
            createdById: actorId,
            assignedToId: dto.assignedToId,
            status: dto.status ?? DelegationStatus.PENDING,
            relatedCaseId: dto.relatedCaseId,
            notes: dto.notes,
          },
          include: {
            createdBy: {
              select: { id: true, firstName: true, lastName: true },
            },
            relatedCase: { select: { id: true, name: true } },
          },
        });
        await tx.documentNumberLog.update({
          where: { id: logId },
          data: { documentId: rec.id },
        });
        return rec;
      }
      return tx.delegation.create({
        data: {
          delegationNumber: resolvedDelegationNumber,
          delegationDate: dto.delegationDate
            ? new Date(dto.delegationDate)
            : new Date(),
          receivingUnit: dto.receivingUnit,
          content: dto.content,
          createdById: actorId,
          assignedToId: dto.assignedToId,
          status: dto.status ?? DelegationStatus.PENDING,
          relatedCaseId: dto.relatedCaseId,
          notes: dto.notes,
        },
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          relatedCase: { select: { id: true, name: true } },
        },
      });
    });

    await this.audit.log({
      userId: actorId,
      action: 'DELEGATION_CREATED',
      subject: 'Delegation',
      subjectId: record.id,
      metadata: { delegationNumber: record.delegationNumber },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    if (dto.assignedToId) {
      const actor = await this.prisma.user.findUnique({
        where: { id: actorId },
        select: { firstName: true, lastName: true },
      });
      const byUserName = actor
        ? `${actor.firstName ?? ''} ${actor.lastName ?? ''}`.trim()
        : '';
      this.eventEmitter.emit(
        'utdt.assigned',
        new UydtAssignedEvent(
          record.id,
          record.delegationNumber,
          dto.assignedToId,
          [],
          actorId,
          byUserName,
        ),
      );
    }

    return {
      success: true,
      data: record,
      message: 'Tạo ủy thác điều tra thành công',
    };
  }

  async update(
    id: string,
    dto: UpdateDelegationDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
    dataScope?: DataScope | null,
  ) {
    const { data: existing } = await this.getById(id, dataScope);
    if (existing.relatedCase) {
      assertParentInScope(existing.relatedCase, dataScope, 'write');
    } else {
      assertCreatorInScope(existing.createdById, dataScope, 'write');
    }

    const record = await this.prisma.delegation.update({
      where: { id },
      data: {
        // Form sửa cho đổi Số và Ngày ủy thác — trước 17/09/2026 hai trường này bị bỏ qua im lặng.
        ...(dto.delegationNumber !== undefined && {
          delegationNumber: dto.delegationNumber,
        }),
        ...(dto.delegationDate !== undefined && {
          delegationDate: new Date(dto.delegationDate),
        }),
        ...(dto.receivingUnit !== undefined && {
          receivingUnit: dto.receivingUnit,
        }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.status !== undefined && {
          status: dto.status,
        }),
        ...(dto.completedDate !== undefined && {
          completedDate: dto.completedDate ? new Date(dto.completedDate) : null,
        }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.assignedToId !== undefined && {
          assignedToId: dto.assignedToId,
        }),
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'DELEGATION_UPDATED',
      subject: 'Delegation',
      subjectId: id,
      metadata: {
        before: {
          status: existing.status,
          receivingUnit: existing.receivingUnit,
        },
        after: dto,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    if (
      dto.assignedToId &&
      dto.assignedToId !== (existing as any).assignedToId
    ) {
      const actor = await this.prisma.user.findUnique({
        where: { id: actorId },
        select: { firstName: true, lastName: true },
      });
      const byUserName = actor
        ? `${actor.firstName ?? ''} ${actor.lastName ?? ''}`.trim()
        : '';
      this.eventEmitter.emit(
        'utdt.assigned',
        new UydtAssignedEvent(
          id,
          existing.delegationNumber,
          dto.assignedToId,
          [],
          actorId,
          byUserName,
        ),
      );
    }

    return {
      success: true,
      data: record,
      message: 'Cập nhật ủy thác thành công',
    };
  }

  async delete(
    id: string,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
    dataScope?: DataScope | null,
  ) {
    const { data: existing } = await this.getById(id, dataScope);
    if (existing.relatedCase) {
      assertParentInScope(existing.relatedCase, dataScope, 'write');
    } else {
      assertCreatorInScope(existing.createdById, dataScope, 'write');
    }

    await this.prisma.delegation.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      userId: actorId,
      action: 'DELEGATION_DELETED',
      subject: 'Delegation',
      subjectId: id,
      metadata: { delegationNumber: existing.delegationNumber },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, message: 'Xóa ủy thác thành công' };
  }
}
