import { CaseChildAccessService } from '../case-child-access/case-child-access.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateConclusionDto } from './dto/create-conclusion.dto';
import { ConclusionStatus, Prisma } from '@prisma/client';
import type { DataScope } from '../auth/services/unit-scope.service';
import { assertParentInScope } from '../common/utils/scope-filter.util';
import { kiemVuAnChaDeGhi } from '../common/utils/kiem-vu-an-cha';
import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryConclusionsDto {
  @IsOptional() @IsString() caseId?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) limit?: number = 50;
  @IsOptional() @IsInt() @Min(0) @Type(() => Number) offset?: number = 0;
}

@Injectable()
export class ConclusionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly childAccess: CaseChildAccessService,
  ) {}

  async getList(
    query: QueryConclusionsDto,
    dataScope?: DataScope | null,
    actorId?: string,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    dataScope = await this.childAccess.scope(actorId, db);
    await this.childAccess.entity('Case', 'read', actorId, db);

    const { caseId, status, limit = 50, offset = 0 } = query;
    const where: Prisma.ConclusionWhereInput = { deletedAt: null };

    if (caseId) where.caseId = caseId;
    if (status) where.status = status as ConclusionStatus;

    where.case = await this.childAccess.listWhere(actorId, db);

    const [data, total] = await Promise.all([
      db.conclusion.findMany({
        where,
        include: {
          author: { select: { id: true, firstName: true, lastName: true } },
          approvedBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.conclusion.count({ where }),
    ]);

    return {
      success: true,
      data: await Promise.all(
        data.map((row) =>
          this.childAccess.serialize(row.caseId, row, actorId, db),
        ),
      ),
      total,
    };
  }

  async getById(
    id: string,
    dataScope?: DataScope | null,
    actorId?: string,
    db: Prisma.TransactionClient = this.prisma,
  ) {
    dataScope = await this.childAccess.scope(actorId, db);
    await this.childAccess.entity('Case', 'read', actorId, db);

    const record = await db.conclusion.findFirst({
      where: { id, deletedAt: null },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
        case: { select: { assignedTeamId: true, investigatorId: true } },
      },
    });
    if (!record)
      throw new NotFoundException(`Kết luận không tồn tại (id: ${id})`);
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

  async create(
    dto: CreateConclusionDto,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
    dataScope?: DataScope | null,
  ) {
    return this.childAccess.write(
      [dto.caseId],
      actorId,
      'Case',
      'write',
      async (tx) => {
        dataScope = await this.childAccess.scope(actorId, tx);

        await kiemVuAnChaDeGhi(tx, dto.caseId, dataScope);
        const record = await tx.conclusion.create({
          data: {
            caseId: dto.caseId,
            type: dto.type,
            content: dto.content,
            authorId: actorId,
            approvedById: dto.approvedById,
            status: dto.status ?? ConclusionStatus.DU_THAO,
            notes: dto.notes,
          },
          include: {
            author: { select: { id: true, firstName: true, lastName: true } },
            approvedBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        });

        await this.audit.log(
          {
            userId: actorId,
            action: 'CONCLUSION_CREATED',
            subject: 'Case',
            subjectId: record.id,
            metadata: { caseId: dto.caseId, type: dto.type },
            ipAddress: meta?.ipAddress,
            userAgent: meta?.userAgent,
          },
          tx,
        );

        return {
          success: true,
          data: record,
          message: 'Tạo kết luận thành công',
        };
      },
    );
  }

  async update(
    id: string,
    dto: Partial<CreateConclusionDto>,
    actorId: string,
    meta?: { ipAddress?: string; userAgent?: string },
    dataScope?: DataScope | null,
  ) {
    const { data: existing } = await this.getById(id, dataScope, actorId);
    return this.childAccess.write(
      [existing.caseId, ...(dto.caseId ? [dto.caseId] : [])],
      actorId,
      'Case',
      'edit',
      async (tx, parents) => {
        dataScope = await this.childAccess.scope(actorId, tx);

        assertParentInScope(
          this.childAccess.parent(parents, existing.caseId),
          dataScope,
          'write',
        );

        const record = await tx.conclusion.update({
          where: { id, caseId: existing.caseId, updatedAt: existing.updatedAt },
          data: {
            ...(dto.type !== undefined && { type: dto.type }),
            ...(dto.content !== undefined && { content: dto.content }),
            ...(dto.status !== undefined && {
              status: dto.status,
            }),
            ...(dto.approvedById !== undefined && {
              approvedById: dto.approvedById,
            }),
            ...(dto.notes !== undefined && { notes: dto.notes }),
          },
          include: {
            author: { select: { id: true, firstName: true, lastName: true } },
            approvedBy: {
              select: { id: true, firstName: true, lastName: true },
            },
          },
        });

        await this.audit.log(
          {
            userId: actorId,
            action: 'CONCLUSION_UPDATED',
            subject: 'Case',
            subjectId: id,
            metadata: {
              before: { type: existing.type, status: existing.status },
              after: dto,
            },
            ipAddress: meta?.ipAddress,
            userAgent: meta?.userAgent,
          },
          tx,
        );

        return {
          success: true,
          data: record,
          message: 'Cập nhật kết luận thành công',
        };
      },
    );
  }

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
      'Case',
      'delete',
      async (tx, parents) => {
        dataScope = await this.childAccess.scope(actorId, tx);

        assertParentInScope(
          this.childAccess.parent(parents, existing.caseId),
          dataScope,
          'write',
        );

        await tx.conclusion.update({
          where: { id, caseId: existing.caseId, updatedAt: existing.updatedAt },
          data: { deletedAt: new Date() },
        });

        await this.audit.log(
          {
            userId: actorId,
            action: 'CONCLUSION_DELETED',
            subject: 'Case',
            subjectId: id,
            metadata: {},
            ipAddress: meta?.ipAddress,
            userAgent: meta?.userAgent,
          },
          tx,
        );

        return { success: true, message: 'Xóa kết luận thành công' };
      },
    );
  }
}
