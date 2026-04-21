import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateGuidanceDto } from './dto/create-guidance.dto';
import { QueryGuidanceDto } from './dto/query-guidance.dto';
import { GuidanceStatus, Prisma } from '@prisma/client';
import type { DataScope } from '../auth/services/unit-scope.service';
import { assertCreatorInScope } from '../common/utils/scope-filter.util';

@Injectable()
export class GuidanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getList(query: QueryGuidanceDto, dataScope?: DataScope | null) {
    const { search, status, fromDate, toDate, limit = 20, offset = 0 } = query;
    const where: Prisma.GuidanceRecordWhereInput = { deletedAt: null };

    if (search) {
      where.OR = [
        { guidedPerson: { contains: search, mode: 'insensitive' } },
        { guidedPersonPhone: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { guidanceContent: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) where.status = status as GuidanceStatus;
    if (fromDate) where.createdAt = { ...(where.createdAt as any), gte: new Date(fromDate) };
    if (toDate) where.createdAt = { ...(where.createdAt as any), lte: new Date(toDate + 'T23:59:59.999Z') };

    if (dataScope) {
      const { userIds, teamIds } = dataScope;
      const isDenyAll = userIds.length === 0 && teamIds.length === 0;
      if (isDenyAll) {
        (where as any).id = '__no_access__';
      } else if (userIds.length > 0) {
        (where as any).createdById = { in: userIds };
      }
      // userIds=[] + teamIds non-empty: team leader, no user restriction — show all
    }

    const [data, total] = await Promise.all([
      this.prisma.guidanceRecord.findMany({
        where,
        include: { createdBy: { select: { id: true, firstName: true, lastName: true, username: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.guidanceRecord.count({ where }),
    ]);

    return { success: true, data, total, page: Math.floor(offset / limit) + 1, pageSize: limit };
  }

  async getById(id: string, dataScope?: DataScope | null) {
    const record = await this.prisma.guidanceRecord.findFirst({
      where: { id, deletedAt: null },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
    });
    if (!record) throw new NotFoundException(`Bản ghi hướng dẫn không tồn tại (id: ${id})`);
    assertCreatorInScope(record.createdById, dataScope);
    return { success: true, data: record };
  }

  async create(dto: CreateGuidanceDto, actorId: string, meta?: { ipAddress?: string; userAgent?: string }) {
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
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
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

    return { success: true, data: record, message: 'Tạo bản ghi hướng dẫn thành công' };
  }

  async update(id: string, dto: Partial<CreateGuidanceDto>, actorId: string, meta?: { ipAddress?: string; userAgent?: string }, dataScope?: DataScope | null) {
    await this.getById(id, dataScope);

    const record = await this.prisma.guidanceRecord.update({
      where: { id },
      data: {
        ...(dto.guidedPerson !== undefined && { guidedPerson: dto.guidedPerson }),
        ...(dto.guidedPersonPhone !== undefined && { guidedPersonPhone: dto.guidedPersonPhone }),
        ...(dto.subject !== undefined && { subject: dto.subject }),
        ...(dto.guidanceContent !== undefined && { guidanceContent: dto.guidanceContent }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.status !== undefined && { status: dto.status as GuidanceStatus }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'GUIDANCE_UPDATED',
      subject: 'GuidanceRecord',
      subjectId: id,
      metadata: { changes: dto },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return { success: true, data: record, message: 'Cập nhật bản ghi hướng dẫn thành công' };
  }

  async delete(id: string, actorId: string, meta?: { ipAddress?: string; userAgent?: string }, dataScope?: DataScope | null) {
    const { data: existing } = await this.getById(id, dataScope);

    await this.prisma.guidanceRecord.update({ where: { id }, data: { deletedAt: new Date() } });

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
