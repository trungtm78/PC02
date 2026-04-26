import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateConclusionDto } from './dto/create-conclusion.dto';
import { ConclusionStatus, Prisma } from '@prisma/client';
import type { DataScope } from '../auth/services/unit-scope.service';
import { assertParentInScope, buildScopeFilter } from '../common/utils/scope-filter.util';
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
  ) {}

  async getList(query: QueryConclusionsDto, dataScope?: DataScope | null) {
    const { caseId, status, limit = 50, offset = 0 } = query;
    const where: Prisma.ConclusionWhereInput = { deletedAt: null };

    if (caseId) where.caseId = caseId;
    if (status) where.status = status as ConclusionStatus;

    const caseScope = buildScopeFilter(dataScope);
    if (caseScope) {
      (where as any).case = caseScope;
    }

    const [data, total] = await Promise.all([
      this.prisma.conclusion.findMany({
        where,
        include: {
          author: { select: { id: true, firstName: true, lastName: true } },
          approvedBy: { select: { id: true, firstName: true, lastName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.conclusion.count({ where }),
    ]);

    return { success: true, data, total };
  }

  async getById(id: string, dataScope?: DataScope | null) {
    const record = await this.prisma.conclusion.findFirst({
      where: { id, deletedAt: null },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
        case: { select: { assignedTeamId: true, investigatorId: true } },
      },
    });
    if (!record) throw new NotFoundException(`Kết luận không tồn tại (id: ${id})`);
    assertParentInScope(record.case, dataScope);
    return { success: true, data: record };
  }

  async create(dto: CreateConclusionDto, actorId: string, meta?: { ipAddress?: string; userAgent?: string }) {
    const record = await this.prisma.conclusion.create({
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
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'CONCLUSION_CREATED',
      subject: 'Conclusion',
      subjectId: record.id,
      metadata: { caseId: dto.caseId, type: dto.type },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, data: record, message: 'Tạo kết luận thành công' };
  }

  async update(id: string, dto: Partial<CreateConclusionDto>, actorId: string, meta?: { ipAddress?: string; userAgent?: string }, dataScope?: DataScope | null) {
    const { data: existing } = await this.getById(id, dataScope);
    assertParentInScope(existing.case, dataScope, 'write');

    const record = await this.prisma.conclusion.update({
      where: { id },
      data: {
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.status !== undefined && { status: dto.status as ConclusionStatus }),
        ...(dto.approvedById !== undefined && { approvedById: dto.approvedById }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true } },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'CONCLUSION_UPDATED',
      subject: 'Conclusion',
      subjectId: id,
      metadata: { before: { type: existing.type, status: existing.status }, after: dto },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, data: record, message: 'Cập nhật kết luận thành công' };
  }

  async delete(id: string, actorId: string, meta?: { ipAddress?: string; userAgent?: string }, dataScope?: DataScope | null) {
    const { data: existing } = await this.getById(id, dataScope);
    assertParentInScope(existing.case, dataScope, 'write');

    await this.prisma.conclusion.update({ where: { id }, data: { deletedAt: new Date() } });

    await this.audit.log({
      userId: actorId,
      action: 'CONCLUSION_DELETED',
      subject: 'Conclusion',
      subjectId: id,
      metadata: {},
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, message: 'Xóa kết luận thành công' };
  }
}
