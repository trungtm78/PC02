import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateProposalDto } from './dto/create-proposal.dto';
import { QueryProposalsDto } from './dto/query-proposals.dto';
import { ProposalStatus, Prisma } from '@prisma/client';
import type { DataScope } from '../auth/services/unit-scope.service';
import { assertParentInScope, assertCreatorInScope, buildScopeFilter } from '../common/utils/scope-filter.util';

@Injectable()
export class ProposalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getList(query: QueryProposalsDto, dataScope?: DataScope | null) {
    const { search, status, fromDate, toDate, limit = 20, offset = 0 } = query;

    const where: Prisma.ProposalWhereInput = { deletedAt: null };

    if (search) {
      where.OR = [
        { proposalNumber: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
        { unit: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) where.status = status as ProposalStatus;
    if (fromDate) where.createdAt = { ...(where.createdAt as any), gte: new Date(fromDate) };
    if (toDate) where.createdAt = { ...(where.createdAt as any), lte: new Date(toDate + 'T23:59:59.999Z') };

    if (dataScope) {
      const { userIds, teamIds } = dataScope;
      const isDenyAll = userIds.length === 0 && teamIds.length === 0;
      if (isDenyAll) {
        (where as any).id = '__no_access__';
      } else {
        const caseScope = buildScopeFilter(dataScope);
        const conditions: any[] = [];
        if (caseScope) conditions.push({ relatedCase: caseScope });
        if (userIds.length > 0) conditions.push({ relatedCase: null, createdById: { in: userIds } });
        if (conditions.length > 0) (where as any).OR = conditions;
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.proposal.findMany({
        where,
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true, username: true } },
          relatedCase: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.proposal.count({ where }),
    ]);

    return { success: true, data, total, page: Math.floor(offset / limit) + 1, pageSize: limit };
  }

  async getById(id: string, dataScope?: DataScope | null) {
    const record = await this.prisma.proposal.findFirst({
      where: { id, deletedAt: null },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true, username: true } },
        relatedCase: { select: { id: true, name: true, assignedTeamId: true, investigatorId: true } },
      },
    });
    if (!record) throw new NotFoundException(`Đề xuất không tồn tại (id: ${id})`);
    if (record.relatedCase) {
      assertParentInScope(record.relatedCase, dataScope);
    } else {
      assertCreatorInScope(record.createdById, dataScope);
    }
    return { success: true, data: record };
  }

  async create(dto: CreateProposalDto, actorId: string, meta?: { ipAddress?: string; userAgent?: string }) {
    const record = await this.prisma.proposal.create({
      data: {
        proposalNumber: dto.proposalNumber,
        relatedCaseId: dto.relatedCaseId,
        caseType: dto.caseType,
        content: dto.content,
        unit: dto.unit,
        createdById: actorId,
        status: dto.status ?? ProposalStatus.CHO_GUI,
        sentDate: dto.sentDate ? new Date(dto.sentDate) : undefined,
        response: dto.response,
        responseDate: dto.responseDate ? new Date(dto.responseDate) : undefined,
        notes: dto.notes,
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'PROPOSAL_CREATED',
      subject: 'Proposal',
      subjectId: record.id,
      metadata: { proposalNumber: record.proposalNumber },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, data: record, message: 'Tạo đề xuất thành công' };
  }

  async update(id: string, dto: Partial<CreateProposalDto>, actorId: string, meta?: { ipAddress?: string; userAgent?: string }, dataScope?: DataScope | null) {
    const { data: existing } = await this.getById(id, dataScope);
    if (existing.relatedCase) {
      assertParentInScope(existing.relatedCase, dataScope, 'write');
    } else {
      assertCreatorInScope(existing.createdById, dataScope, 'write');
    }

    const record = await this.prisma.proposal.update({
      where: { id },
      data: {
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.status !== undefined && { status: dto.status as ProposalStatus }),
        ...(dto.sentDate !== undefined && { sentDate: dto.sentDate ? new Date(dto.sentDate) : null }),
        ...(dto.response !== undefined && { response: dto.response }),
        ...(dto.responseDate !== undefined && { responseDate: dto.responseDate ? new Date(dto.responseDate) : null }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.caseType !== undefined && { caseType: dto.caseType }),
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'PROPOSAL_UPDATED',
      subject: 'Proposal',
      subjectId: id,
      metadata: { changes: dto },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, data: record, message: 'Cập nhật đề xuất thành công' };
  }

  async delete(id: string, actorId: string, meta?: { ipAddress?: string; userAgent?: string }, dataScope?: DataScope | null) {
    const { data: existing } = await this.getById(id, dataScope);
    if (existing.relatedCase) {
      assertParentInScope(existing.relatedCase, dataScope, 'write');
    } else {
      assertCreatorInScope(existing.createdById, dataScope, 'write');
    }

    await this.prisma.proposal.update({ where: { id }, data: { deletedAt: new Date() } });

    await this.audit.log({
      userId: actorId,
      action: 'PROPOSAL_DELETED',
      subject: 'Proposal',
      subjectId: id,
      metadata: { proposalNumber: existing.proposalNumber },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, message: 'Xóa đề xuất thành công' };
  }
}
