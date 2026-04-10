import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateDelegationDto } from './dto/create-delegation.dto';
import { DelegationStatus, Prisma } from '@prisma/client';
import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryDelegationsDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() fromDate?: string;
  @IsOptional() @IsString() toDate?: string;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) limit?: number = 20;
  @IsOptional() @IsInt() @Min(0) @Type(() => Number) offset?: number = 0;
}

@Injectable()
export class DelegationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getList(query: QueryDelegationsDto) {
    const { search, status, fromDate, toDate, limit = 20, offset = 0 } = query;
    const where: Prisma.DelegationWhereInput = { deletedAt: null };

    if (search) {
      where.OR = [
        { delegationNumber: { contains: search, mode: 'insensitive' } },
        { receivingUnit: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) where.status = status as DelegationStatus;
    if (fromDate) where.createdAt = { ...(where.createdAt as any), gte: new Date(fromDate) };
    if (toDate) where.createdAt = { ...(where.createdAt as any), lte: new Date(toDate + 'T23:59:59.999Z') };

    const [data, total] = await Promise.all([
      this.prisma.delegation.findMany({
        where,
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          relatedCase: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.delegation.count({ where }),
    ]);

    return { success: true, data, total, page: Math.floor(offset / limit) + 1, pageSize: limit };
  }

  async getById(id: string) {
    const record = await this.prisma.delegation.findFirst({
      where: { id, deletedAt: null },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        relatedCase: { select: { id: true, name: true } },
      },
    });
    if (!record) throw new NotFoundException(`Ủy thác không tồn tại (id: ${id})`);
    return { success: true, data: record };
  }

  async create(dto: CreateDelegationDto, actorId: string, meta?: { ipAddress?: string; userAgent?: string }) {
    const record = await this.prisma.delegation.create({
      data: {
        delegationNumber: dto.delegationNumber,
        delegationDate: dto.delegationDate ? new Date(dto.delegationDate) : new Date(),
        receivingUnit: dto.receivingUnit,
        content: dto.content,
        createdById: actorId,
        status: dto.status ?? DelegationStatus.PENDING,
        relatedCaseId: dto.relatedCaseId,
        notes: dto.notes,
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        relatedCase: { select: { id: true, name: true } },
      },
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

    return { success: true, data: record, message: 'Tạo ủy thác điều tra thành công' };
  }

  async update(id: string, dto: Partial<CreateDelegationDto>, actorId: string, meta?: { ipAddress?: string; userAgent?: string }) {
    const existing = await this.prisma.delegation.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException(`Ủy thác không tồn tại (id: ${id})`);

    const record = await this.prisma.delegation.update({
      where: { id },
      data: {
        ...(dto.receivingUnit !== undefined && { receivingUnit: dto.receivingUnit }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.status !== undefined && { status: dto.status as DelegationStatus }),
        ...(dto.completedDate !== undefined && { completedDate: dto.completedDate ? new Date(dto.completedDate) : null }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'DELEGATION_UPDATED',
      subject: 'Delegation',
      subjectId: id,
      metadata: { changes: dto },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, data: record, message: 'Cập nhật ủy thác thành công' };
  }

  async delete(id: string, actorId: string, meta?: { ipAddress?: string; userAgent?: string }) {
    const existing = await this.prisma.delegation.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException(`Ủy thác không tồn tại (id: ${id})`);

    await this.prisma.delegation.update({ where: { id }, data: { deletedAt: new Date() } });

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
