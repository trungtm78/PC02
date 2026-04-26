import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogCreateInput {
  userId?: string;
  action: string;
  subject?: string;
  subjectId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogCreateInput, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    // Use $executeRaw to bypass Prisma's strict relation typing for userId
    await client.$executeRaw`
      INSERT INTO "audit_logs" (id, "userId", action, subject, "subjectId", metadata, "ipAddress", "userAgent", "createdAt")
      VALUES (
        gen_random_uuid()::text,
        ${input.userId ?? null},
        ${input.action},
        ${input.subject ?? null},
        ${input.subjectId ?? null},
        ${input.metadata ? JSON.stringify(input.metadata) : null}::jsonb,
        ${input.ipAddress ?? null},
        ${input.userAgent ?? null},
        NOW()
      )
    `;
  }

  async wrapUpdate<T>(opts: {
    fetchFn: () => Promise<T>;
    updateFn: () => Promise<T>;
    action: string;
    subject: string;
    subjectId: string;
    userId: string;
    meta?: { ipAddress?: string; userAgent?: string };
  }): Promise<T> {
    const before = await opts.fetchFn();
    const after = await opts.updateFn();
    await this.log({
      userId: opts.userId,
      action: opts.action,
      subject: opts.subject,
      subjectId: opts.subjectId,
      metadata: { before: before as Record<string, unknown>, after: after as Record<string, unknown> },
      ipAddress: opts.meta?.ipAddress,
      userAgent: opts.meta?.userAgent,
    });
    return after;
  }

  async findAll(params: {
    action?: string;
    userId?: string;
    subjectId?: string;
    subject?: string;
    limit?: number;
    offset?: number;
  }) {
    const { action, userId, subjectId, subject, limit = 20, offset = 0 } = params;
    const where = {
      ...(action && { action }),
      ...(userId && { userId }),
      ...(subjectId && { subjectId }),
      ...(subject && { subject }),
    };
    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              username: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data, total, limit, offset };
  }
}
