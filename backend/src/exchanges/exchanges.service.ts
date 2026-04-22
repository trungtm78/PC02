import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateExchangeDto, CreateExchangeMessageDto } from './dto/create-exchange.dto';
import { ExchangeStatus, Prisma } from '@prisma/client';
import type { DataScope } from '../auth/services/unit-scope.service';
import { assertCreatorInScope } from '../common/utils/scope-filter.util';
import { IsOptional, IsString, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryExchangesDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) limit?: number = 20;
  @IsOptional() @IsInt() @Min(0) @Type(() => Number) offset?: number = 0;
}

@Injectable()
export class ExchangesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getList(query: QueryExchangesDto, dataScope?: DataScope | null) {
    const { search, status, limit = 20, offset = 0 } = query;
    const where: Prisma.ExchangeWhereInput = { deletedAt: null };

    if (search) {
      where.OR = [
        { recordCode: { contains: search, mode: 'insensitive' } },
        { senderUnit: { contains: search, mode: 'insensitive' } },
        { receiverUnit: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (status) where.status = status as ExchangeStatus;

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
      this.prisma.exchange.findMany({
        where,
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { sender: { select: { id: true, firstName: true, lastName: true } } },
          },
          _count: { select: { messages: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.exchange.count({ where }),
    ]);

    const enriched = data.map((ex) => ({
      ...ex,
      messageCount: ex._count.messages,
      lastMessage: ex.messages[0]?.content ?? null,
      lastMessageTime: ex.messages[0]?.createdAt ?? null,
    }));

    return { success: true, data: enriched, total, page: Math.floor(offset / limit) + 1, pageSize: limit };
  }

  async getById(id: string, dataScope?: DataScope | null) {
    const record = await this.prisma.exchange.findFirst({
      where: { id, deletedAt: null },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { sender: { select: { id: true, firstName: true, lastName: true } } },
        },
      },
    });
    if (!record) throw new NotFoundException(`Trao đổi không tồn tại (id: ${id})`);
    assertCreatorInScope(record.createdById, dataScope);
    return { success: true, data: record };
  }

  async getMessages(exchangeId: string, dataScope?: DataScope | null) {
    await this.getById(exchangeId, dataScope);

    const messages = await this.prisma.exchangeMessage.findMany({
      where: { exchangeId },
      include: { sender: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return { success: true, data: messages };
  }

  async create(dto: CreateExchangeDto, actorId: string, meta?: { ipAddress?: string; userAgent?: string }) {
    const record = await this.prisma.exchange.create({
      data: {
        recordCode: dto.recordCode,
        recordType: dto.recordType,
        senderUnit: dto.senderUnit,
        receiverUnit: dto.receiverUnit,
        subject: dto.subject,
        createdById: actorId,
        status: dto.status ?? ExchangeStatus.OPEN,
      },
      include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
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

  async addMessage(dto: CreateExchangeMessageDto, actorId: string) {
    const exchange = await this.prisma.exchange.findFirst({ where: { id: dto.exchangeId, deletedAt: null } });
    if (!exchange) throw new NotFoundException(`Trao đổi không tồn tại`);

    const message = await this.prisma.exchangeMessage.create({
      data: {
        exchangeId: dto.exchangeId,
        senderId: actorId,
        content: dto.content,
        attachments: dto.attachments ?? [],
      },
      include: { sender: { select: { id: true, firstName: true, lastName: true } } },
    });

    // Update exchange updatedAt
    await this.prisma.exchange.update({ where: { id: dto.exchangeId }, data: { updatedAt: new Date() } });

    return { success: true, data: message, message: 'Gửi tin nhắn thành công' };
  }

  async update(id: string, dto: Partial<CreateExchangeDto>, actorId: string, meta?: { ipAddress?: string; userAgent?: string }, dataScope?: DataScope | null) {
    await this.getById(id, dataScope);

    const record = await this.prisma.exchange.update({
      where: { id },
      data: {
        ...(dto.status !== undefined && { status: dto.status as ExchangeStatus }),
        ...(dto.subject !== undefined && { subject: dto.subject }),
        ...(dto.receiverUnit !== undefined && { receiverUnit: dto.receiverUnit }),
      },
    });

    return { success: true, data: record, message: 'Cập nhật trao đổi thành công' };
  }

  async delete(id: string, actorId: string, meta?: { ipAddress?: string; userAgent?: string }, dataScope?: DataScope | null) {
    await this.getById(id, dataScope);

    await this.prisma.exchange.update({ where: { id }, data: { deletedAt: new Date() } });

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
