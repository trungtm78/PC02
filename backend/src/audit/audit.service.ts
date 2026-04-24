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
