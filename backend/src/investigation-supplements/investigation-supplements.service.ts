import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateInvestigationSupplementDto } from './dto/create-investigation-supplement.dto';
import { Prisma } from '@prisma/client';
import type { DataScope } from '../auth/services/unit-scope.service';
import { assertParentInScope, buildScopeFilter } from '../common/utils/scope-filter.util';
import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryInvestigationSupplementsDto {
  @IsOptional() @IsString() caseId?: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) limit?: number = 50;
  @IsOptional() @IsInt() @Min(0) @Type(() => Number) offset?: number = 0;
}

@Injectable()
export class InvestigationSupplementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getList(query: QueryInvestigationSupplementsDto, dataScope?: DataScope | null) {
    const { caseId, type, limit = 50, offset = 0 } = query;
    const where: Prisma.InvestigationSupplementWhereInput = {};

    if (caseId) where.caseId = caseId;
    if (type) where.type = type;

    const caseScope = buildScopeFilter(dataScope);
    if (caseScope) {
      (where as any).case = caseScope;
    }

    const [data, total] = await Promise.all([
      this.prisma.investigationSupplement.findMany({
        where,
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true, username: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.investigationSupplement.count({ where }),
    ]);

    return { success: true, data, total };
  }

  async getById(id: string, dataScope?: DataScope | null) {
    const record = await this.prisma.investigationSupplement.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true, username: true } },
        case: { select: { id: true, name: true, status: true, assignedTeamId: true, investigatorId: true } },
      },
    });
    if (!record) throw new NotFoundException(`Quyết định điều tra bổ sung không tồn tại (id: ${id})`);
    assertParentInScope(record.case, dataScope);
    return { success: true, data: record };
  }

  async create(dto: CreateInvestigationSupplementDto, actorId: string, meta?: { ipAddress?: string; userAgent?: string }) {
    const record = await this.prisma.investigationSupplement.create({
      data: {
        caseId: dto.caseId,
        type: dto.type,
        decisionNumber: dto.decisionNumber,
        decisionDate: dto.decisionDate ? new Date(dto.decisionDate) : null,
        reason: dto.reason,
        deadline: dto.deadline ? new Date(dto.deadline) : null,
        createdById: actorId,
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true, username: true } },
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'INVESTIGATION_SUPPLEMENT_CREATED',
      subject: 'InvestigationSupplement',
      subjectId: record.id,
      metadata: { caseId: dto.caseId, type: dto.type, decisionNumber: dto.decisionNumber },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, data: record, message: 'Tạo quyết định điều tra bổ sung thành công' };
  }

  async delete(id: string, actorId: string, meta?: { ipAddress?: string; userAgent?: string }, dataScope?: DataScope | null) {
    await this.getById(id, dataScope);

    await this.prisma.investigationSupplement.delete({ where: { id } });

    await this.audit.log({
      userId: actorId,
      action: 'INVESTIGATION_SUPPLEMENT_DELETED',
      subject: 'InvestigationSupplement',
      subjectId: id,
      metadata: {},
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, message: 'Xóa quyết định điều tra bổ sung thành công' };
  }
}
