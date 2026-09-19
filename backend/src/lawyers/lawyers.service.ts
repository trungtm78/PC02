import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateLawyerDto } from './dto/create-lawyer.dto';
import { UpdateLawyerDto } from './dto/update-lawyer.dto';
import { QueryLawyersDto } from './dto/query-lawyers.dto';
import { Prisma } from '@prisma/client';
import type { DataScope } from '../auth/services/unit-scope.service';
import { assertParentInScope, buildScopeFilter } from '../common/utils/scope-filter.util';
import { kiemVuAnChaDeGhi } from '../common/utils/kiem-vu-an-cha';
import { BoTimKiem } from '../common/tim-kiem/bo-tim-kiem';
import { KHOA_TAT_CA, noiVaoWhere } from '../common/tim-kiem/dieu-kien';
import { KHAI_TIM_KIEM_LUAT_SU } from '../common/tim-kiem/khai/luat-su.khai';

/** `search` cũ (GlobalSearchBar, đường dẫn cũ) → thẻ "tất cả các cột". */
const THAM_SO_CU_LUAT_SU = { search: KHOA_TAT_CA } as const;

@Injectable()
export class LawyersService {
  private boTimKiem?: BoTimKiem;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private get timKiem(): BoTimKiem {
    return (this.boTimKiem ??= new BoTimKiem(
      this.prisma,
      KHAI_TIM_KIEM_LUAT_SU,
      THAM_SO_CU_LUAT_SU,
    ));
  }

  // ─────────────────────────────────────────────
  // GET LIST
  // ─────────────────────────────────────────────
  async getList(query: QueryLawyersDto, dataScope?: DataScope | null) {
    const {
      caseId,
      subjectId,
      limit = 20,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const where: Prisma.LawyerWhereInput = {
      deletedAt: null,
    };

    // Thẻ tìm kiếm (`tk` + `search` cũ) — bỏ dấu, cùng luật với các màn danh sách khác; khoá lạ → 400.
    noiVaoWhere(
      where as Record<string, unknown>,
      await this.timKiem.dieuKien(query),
    );

    if (caseId) where.caseId = caseId;
    if (subjectId) where.subjectId = subjectId;

    const caseScope = buildScopeFilter(dataScope);
    if (caseScope) {
      // NỐI vào AND, không gán `where.case`: thẻ Vụ án cũng lọc trên quan hệ `case` — gán ở tầng trên
      // là một bên đè bên kia, cán bộ thấy luật sư ngoài phạm vi.
      noiVaoWhere(where as Record<string, unknown>, [{ case: caseScope }]);
    }

    const allowedSortFields = [
      'createdAt',
      'updatedAt',
      'fullName',
      'barNumber',
    ];
    const orderByField = allowedSortFields.includes(sortBy)
      ? sortBy
      : 'createdAt';

    const [data, total] = await Promise.all([
      this.prisma.lawyer.findMany({
        where,
        select: {
          id: true,
          fullName: true,
          lawFirm: true,
          barNumber: true,
          phone: true,
          caseId: true,
          subjectId: true,
          createdAt: true,
          updatedAt: true,
          case: { select: { id: true, name: true, status: true } },
          subject: { select: { id: true, fullName: true, type: true } },
        },
        orderBy: { [orderByField]: sortOrder },
        take: limit,
        skip: offset,
      }),
      this.prisma.lawyer.count({ where }),
    ]);

    return {
      data,
      total,
      limit,
      offset,
    };
  }

  // ─────────────────────────────────────────────
  // GET DETAIL
  // ─────────────────────────────────────────────
  async getById(id: string, dataScope?: DataScope | null) {
    const record = await this.prisma.lawyer.findFirst({
      where: { id, deletedAt: null },
      include: {
        case: { select: { id: true, name: true, status: true, assignedTeamId: true, investigatorId: true } },
        subject: { select: { id: true, fullName: true, type: true } },
      },
    });

    if (!record) {
      throw new NotFoundException(`Luật sư không tồn tại (id: ${id})`);
    }

    assertParentInScope(record.case, dataScope);

    return { success: true, data: record };
  }

  // ─────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────
  async create(
    dto: CreateLawyerDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
    dataScope?: DataScope | null,
  ) {
    // Vụ án cha phải tồn tại và nằm trong phạm vi GHI — trước mọi kiểm khác, để không lộ dữ liệu vụ án ngoài phạm vi.
    await kiemVuAnChaDeGhi(this.prisma, dto.caseId, dataScope);

    // Check duplicate barNumber
    const existing = await this.prisma.lawyer.findFirst({
      where: { barNumber: dto.barNumber, deletedAt: null },
    });
    if (existing) {
      throw new ConflictException(
        `Số thẻ luật sư "${dto.barNumber}" đã tồn tại trong hệ thống`,
      );
    }


    // Validate subjectId if provided (EC-01: lawyer can defend multiple suspects — same lawyer re-assigned means new record)
    if (dto.subjectId) {
      const subjectRecord = await this.prisma.subject.findFirst({
        where: { id: dto.subjectId, caseId: dto.caseId, deletedAt: null },
      });
      if (!subjectRecord) {
        throw new BadRequestException(
          `Bị can không tồn tại trong vụ án (subjectId: ${dto.subjectId})`,
        );
      }
    }

    const record = await this.prisma.lawyer.create({
      data: {
        fullName: dto.fullName,
        lawFirm: dto.lawFirm,
        barNumber: dto.barNumber,
        phone: dto.phone,
        caseId: dto.caseId,
        subjectId: dto.subjectId ?? null,
      },
      include: {
        case: { select: { id: true, name: true, status: true } },
        subject: { select: { id: true, fullName: true, type: true } },
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'LAWYER_CREATED',
      subject: 'Lawyer',
      subjectId: record.id,
      metadata: {
        fullName: record.fullName,
        barNumber: record.barNumber,
        caseId: record.caseId,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, data: record, message: 'Tạo luật sư thành công' };
  }

  // ─────────────────────────────────────────────
  // UPDATE
  // ─────────────────────────────────────────────
  async update(
    id: string,
    dto: UpdateLawyerDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
    dataScope?: DataScope | null,
  ) {
    const { data: existing } = await this.getById(id, dataScope);
    assertParentInScope(existing.case, dataScope, 'write');
    // Chuyển sang vụ án khác phải kiểm phạm vi GHI của vụ án ĐÍCH (kiểm ở trên chỉ là vụ án hiện tại).
    if (dto.caseId && dto.caseId !== existing.caseId) {
      await kiemVuAnChaDeGhi(this.prisma, dto.caseId, dataScope);
    }

    // Check duplicate barNumber (exclude self)
    if (dto.barNumber && dto.barNumber !== existing.barNumber) {
      const dup = await this.prisma.lawyer.findFirst({
        where: { barNumber: dto.barNumber, deletedAt: null, NOT: { id } },
      });
      if (dup) {
        throw new ConflictException(
          `Số thẻ luật sư "${dto.barNumber}" đã tồn tại trong hệ thống`,
        );
      }
    }

    // Validate subjectId if provided
    const targetCaseId = dto.caseId ?? existing.caseId;
    if (dto.subjectId) {
      const subjectRecord = await this.prisma.subject.findFirst({
        where: { id: dto.subjectId, caseId: targetCaseId, deletedAt: null },
      });
      if (!subjectRecord) {
        throw new BadRequestException(
          `Bị can không tồn tại trong vụ án (subjectId: ${dto.subjectId})`,
        );
      }
    }

    const record = await this.prisma.lawyer.update({
      where: { id },
      data: {
        ...(dto.fullName !== undefined && { fullName: dto.fullName }),
        ...(dto.lawFirm !== undefined && { lawFirm: dto.lawFirm }),
        ...(dto.barNumber !== undefined && { barNumber: dto.barNumber }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.caseId !== undefined && { caseId: dto.caseId }),
        ...(dto.subjectId !== undefined && {
          subjectId: dto.subjectId ?? null,
        }),
      },
      include: {
        case: { select: { id: true, name: true, status: true } },
        subject: { select: { id: true, fullName: true, type: true } },
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'LAWYER_UPDATED',
      subject: 'Lawyer',
      subjectId: id,
      metadata: { before: { fullName: existing.fullName, barNumber: existing.barNumber, caseId: existing.caseId }, after: dto },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return {
      success: true,
      data: record,
      message: 'Cập nhật luật sư thành công',
    };
  }

  // ─────────────────────────────────────────────
  // DELETE (soft delete)
  // ─────────────────────────────────────────────
  async delete(
    id: string,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
    dataScope?: DataScope | null,
  ) {
    const { data: existing } = await this.getById(id, dataScope);
    assertParentInScope(existing.case, dataScope, 'write');

    await this.prisma.lawyer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    await this.audit.log({
      userId: actorId,
      action: 'LAWYER_DELETED',
      subject: 'Lawyer',
      subjectId: id,
      metadata: { fullName: existing.fullName, softDelete: true },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, message: 'Xóa luật sư thành công' };
  }
}
