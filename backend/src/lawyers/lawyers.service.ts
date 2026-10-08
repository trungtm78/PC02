import { CaseChildAccessService } from '../case-child-access/case-child-access.service';
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
import { assertParentInScope } from '../common/utils/scope-filter.util';
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
    private readonly childAccess: CaseChildAccessService,
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
  async getList(
    query: QueryLawyersDto,
    dataScope?: DataScope | null,
    actorId?: string,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    dataScope = await this.childAccess.scope(actorId, db);
    await this.childAccess.entity('Lawyer', 'read', actorId, db);

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
      await this.childAccess.policyQuery(
        await this.timKiem.dieuKien(query),
        'case',
        actorId,
        db,
      ),
    );

    if (caseId) where.caseId = caseId;
    if (subjectId) where.subjectId = subjectId;

    noiVaoWhere(where as Record<string, unknown>, [
      { case: await this.childAccess.listWhere(actorId, db) },
    ]);

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
      db.lawyer.findMany({
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
      db.lawyer.count({ where }),
    ]);

    return {
      data: await Promise.all(
        data.map((row) =>
          this.childAccess.serialize(row.caseId, row, actorId, db),
        ),
      ),
      total,
      limit,
      offset,
    };
  }

  // ─────────────────────────────────────────────
  // GET DETAIL
  // ─────────────────────────────────────────────
  async getById(
    id: string,
    dataScope?: DataScope | null,
    actorId?: string,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    dataScope = await this.childAccess.scope(actorId, db);
    await this.childAccess.entity('Lawyer', 'read', actorId, db);

    const record = await db.lawyer.findFirst({
      where: { id, deletedAt: null },
      include: {
        case: {
          select: {
            id: true,
            name: true,
            status: true,
            assignedTeamId: true,
            investigatorId: true,
          },
        },
        subject: { select: { id: true, fullName: true, type: true } },
      },
    });

    if (!record) {
      throw new NotFoundException(`Luật sư không tồn tại (id: ${id})`);
    }

    assertParentInScope(record.case, dataScope);
    await this.childAccess.read(record.caseId, actorId, db);

    return {
      success: true,
      data: await this.childAccess.serialize(
        record.caseId,
        record,
        actorId,
        db,
      ),
    };
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
    return this.childAccess.write(
      [dto.caseId],
      actorId,
      'Lawyer',
      'write',
      async (tx) => {
        dataScope = await this.childAccess.scope(actorId, tx);

        // Vụ án cha phải tồn tại và nằm trong phạm vi GHI — trước mọi kiểm khác, để không lộ dữ liệu vụ án ngoài phạm vi.
        await kiemVuAnChaDeGhi(tx, dto.caseId, dataScope);

        // Check duplicate barNumber
        const existing = await tx.lawyer.findFirst({
          where: { barNumber: dto.barNumber, deletedAt: null },
        });
        if (existing) {
          throw new ConflictException(
            `Số thẻ luật sư "${dto.barNumber}" đã tồn tại trong hệ thống`,
          );
        }

        // Validate subjectId if provided (EC-01: lawyer can defend multiple suspects — same lawyer re-assigned means new record)
        if (dto.subjectId) {
          const subjectRecord = await tx.subject.findFirst({
            where: { id: dto.subjectId, caseId: dto.caseId, deletedAt: null },
          });
          if (!subjectRecord) {
            throw new BadRequestException(
              `Bị can không tồn tại trong vụ án (subjectId: ${dto.subjectId})`,
            );
          }
        }

        const record = await tx.lawyer.create({
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

        await this.audit.log(
          {
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
          },
          tx,
        );

        return {
          success: true,
          data: await this.childAccess.serialize(
            record.caseId,
            record,
            actorId,
            tx,
          ),
          message: 'Tạo luật sư thành công',
        };
      },
    );
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
    const { data: existing } = await this.getById(id, dataScope, actorId);
    return this.childAccess.write(
      [existing.caseId, ...(dto.caseId ? [dto.caseId] : [])],
      actorId,
      'Lawyer',
      'edit',
      async (tx, parents) => {
        dataScope = await this.childAccess.scope(actorId, tx);

        assertParentInScope(
          this.childAccess.parent(parents, existing.caseId),
          dataScope,
          'write',
        );
        // Chuyển sang vụ án khác phải kiểm phạm vi GHI của vụ án ĐÍCH (kiểm ở trên chỉ là vụ án hiện tại).
        if (dto.caseId && dto.caseId !== existing.caseId) {
          await kiemVuAnChaDeGhi(tx, dto.caseId, dataScope);
        }

        // Check duplicate barNumber (exclude self)
        if (dto.barNumber && dto.barNumber !== existing.barNumber) {
          const dup = await tx.lawyer.findFirst({
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
          const subjectRecord = await tx.subject.findFirst({
            where: { id: dto.subjectId, caseId: targetCaseId, deletedAt: null },
          });
          if (!subjectRecord) {
            throw new BadRequestException(
              `Bị can không tồn tại trong vụ án (subjectId: ${dto.subjectId})`,
            );
          }
        }

        const record = await tx.lawyer.update({
          where: { id, caseId: existing.caseId, updatedAt: existing.updatedAt },
          data: {
            ...(dto.fullName !== undefined && { fullName: dto.fullName }),
            ...(dto.lawFirm !== undefined && { lawFirm: dto.lawFirm }),
            ...(dto.barNumber !== undefined && { barNumber: dto.barNumber }),
            ...(dto.phone !== undefined && { phone: dto.phone }),
            ...(dto.caseId !== undefined && { caseId: dto.caseId }),
            ...(dto.subjectId !== undefined && {
              subjectId: dto.subjectId ?? null,
            }),
            // Đổi vụ án mà không chọn lại bị can → bỏ bị can của vụ án CŨ (bị can thuộc đúng một vụ án).
            ...(dto.subjectId === undefined &&
              dto.caseId &&
              dto.caseId !== existing.caseId && { subjectId: null }),
          },
          include: {
            case: { select: { id: true, name: true, status: true } },
            subject: { select: { id: true, fullName: true, type: true } },
          },
        });

        await this.audit.log(
          {
            userId: actorId,
            action: 'LAWYER_UPDATED',
            subject: 'Lawyer',
            subjectId: id,
            metadata: {
              before: {
                fullName: existing.fullName,
                barNumber: existing.barNumber,
                caseId: existing.caseId,
              },
              after: dto,
            },
            ipAddress: meta?.ipAddress,
            userAgent: meta?.userAgent,
          },
          tx,
        );

        return {
          success: true,
          data: await this.childAccess.serialize(
            record.caseId,
            record,
            actorId,
            tx,
          ),
          message: 'Cập nhật luật sư thành công',
        };
      },
    );
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
    const { data: existing } = await this.getById(id, dataScope, actorId);
    return this.childAccess.write(
      [existing.caseId],
      actorId,
      'Lawyer',
      'delete',
      async (tx, parents) => {
        dataScope = await this.childAccess.scope(actorId, tx);

        assertParentInScope(
          this.childAccess.parent(parents, existing.caseId),
          dataScope,
          'write',
        );

        await tx.lawyer.update({
          where: { id, caseId: existing.caseId, updatedAt: existing.updatedAt },
          data: { deletedAt: new Date() },
        });

        await this.audit.log(
          {
            userId: actorId,
            action: 'LAWYER_DELETED',
            subject: 'Lawyer',
            subjectId: id,
            metadata: { fullName: existing.fullName, softDelete: true },
            ipAddress: meta?.ipAddress,
            userAgent: meta?.userAgent,
          },
          tx,
        );

        return { success: true, message: 'Xóa luật sư thành công' };
      },
    );
  }
}
