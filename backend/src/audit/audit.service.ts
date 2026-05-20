import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { sanitizePII, computeFieldDiff, ChangedField, sanitizeMetadataRecursive } from './audit.utils';

export interface AuditLogCreateInput {
  userId?: string;
  action: string;
  subject?: string;
  subjectId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface FindAllParams {
  action?: string;
  userId?: string;
  subjectId?: string;
  subject?: string;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
  /** v0.29 fix: internal-only flag để bypass LIMIT_MAX clamp cho export endpoint. */
  forExport?: boolean;
}

// v0.29 bounds — defense in depth. Controller DTO cũng validate, đây là safety net.
const LIMIT_MIN = 1;
const LIMIT_MAX = 100;
const LIMIT_EXPORT_MAX = 10000;
const LIMIT_DEFAULT = 20;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    input: AuditLogCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    // v0.29: sanitize metadata ở log() để mọi caller (kể cả audit.log direct, không
    // qua wrapUpdate) đều được protect. Recursive cho before/after nested objects.
    const safeMetadata = input.metadata
      ? sanitizeMetadataRecursive(input.metadata)
      : null;
    // Use $executeRaw to bypass Prisma's strict relation typing for userId
    await client.$executeRaw`
      INSERT INTO "audit_logs" (id, "userId", action, subject, "subjectId", metadata, "ipAddress", "userAgent", "createdAt")
      VALUES (
        gen_random_uuid()::text,
        ${input.userId ?? null},
        ${input.action},
        ${input.subject ?? null},
        ${input.subjectId ?? null},
        ${safeMetadata ? JSON.stringify(safeMetadata) : null}::jsonb,
        ${input.ipAddress ?? null},
        ${input.userAgent ?? null},
        NOW()
      )
    `;
  }

  /**
   * v0.29: wrap an update flow — fetch before-snapshot, run update, audit with sanitized before/after.
   *
   * Critical PII fix: applies `sanitizePII` to `before` and `after` BEFORE persisting metadata.
   * passwordHash, refreshTokenHash, totpSecret, backupCodes, etc. never land in audit_logs.
   *
   * Optional `tx` parameter — caller can wrap whole flow in 1 transaction (fetch + update + log atomic).
   */
  async wrapUpdate<T>(opts: {
    fetchFn: () => Promise<T>;
    updateFn: () => Promise<T>;
    action: string;
    subject: string;
    subjectId: string;
    userId: string;
    meta?: { ipAddress?: string; userAgent?: string };
    tx?: Prisma.TransactionClient;
  }): Promise<T> {
    const before = await opts.fetchFn();
    const after = await opts.updateFn();
    // v0.29: sanitize PII before storing
    const sanitizedBefore = sanitizePII(before as Record<string, unknown>);
    const sanitizedAfter = sanitizePII(after as Record<string, unknown>);
    await this.log(
      {
        userId: opts.userId,
        action: opts.action,
        subject: opts.subject,
        subjectId: opts.subjectId,
        metadata: { before: sanitizedBefore, after: sanitizedAfter },
        ipAddress: opts.meta?.ipAddress,
        userAgent: opts.meta?.userAgent,
      },
      opts.tx,
    );
    return after;
  }

  async findAll(params: FindAllParams) {
    const {
      action,
      userId,
      subjectId,
      subject,
      search,
      dateFrom,
      dateTo,
    } = params;

    // v0.29: clamp limit. Public list path: [LIMIT_MIN, LIMIT_MAX=100].
    // Export path (forExport=true): up to LIMIT_EXPORT_MAX=10k for CSV bulk download.
    const maxLimit = params.forExport ? LIMIT_EXPORT_MAX : LIMIT_MAX;
    let limit = params.limit ?? LIMIT_DEFAULT;
    if (!Number.isFinite(limit)) limit = LIMIT_DEFAULT;
    limit = Math.max(LIMIT_MIN, Math.min(maxLimit, Math.floor(limit)));
    let offset = params.offset ?? 0;
    if (!Number.isFinite(offset)) offset = 0;
    offset = Math.max(0, Math.floor(offset));

    // v0.29: escape % and _ in search to prevent wildcard injection bypass.
    // Also cap length to 200 chars to prevent ReDoS / oversized query.
    const escapedSearch =
      search && typeof search === 'string'
        ? search.slice(0, 200).replace(/[\\%_]/g, (m) => '\\' + m)
        : undefined;

    const where: Prisma.AuditLogWhereInput = {
      ...(action && { action }),
      ...(userId && { userId }),
      ...(subjectId && { subjectId }),
      ...(subject && { subject }),
      ...((dateFrom || dateTo) && {
        createdAt: {
          ...(dateFrom && { gte: dateFrom }),
          ...(dateTo && { lte: dateTo }),
        },
      }),
      // v0.29: search via action/subject/subjectId ILIKE (Prisma compatible).
      // Metadata::text full-text search (using GIN trigram index từ migration)
      // sẽ implement bằng $queryRaw trong v0.30 — Prisma findMany không native
      // support `metadata::text ILIKE`. GIN index không waste vì PostgreSQL planner
      // có thể dùng nó cho future raw queries.
      // PII sanitized at write nên search KHÔNG match hash/token/secret values.
      ...(escapedSearch && {
        OR: [
          { action: { contains: escapedSearch, mode: 'insensitive' } },
          { subject: { contains: escapedSearch, mode: 'insensitive' } },
          { subjectId: { contains: escapedSearch, mode: 'insensitive' } },
        ],
      }),
    };

    const [rawData, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, username: true },
          },
        },
        // v0.29: bug fix — DESC để newest first (audit log convention)
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    // v0.29: compute changedFields per row from metadata.before/after.
    // Strip raw before/after from list response to reduce payload (detail endpoint returns raw).
    const data = rawData.map((row) => {
      const meta = (row.metadata ?? null) as Record<string, unknown> | null;
      let changedFields: ChangedField[] = [];
      if (meta && (meta.before || meta.after)) {
        changedFields = computeFieldDiff(
          (meta.before as Record<string, unknown>) ?? null,
          (meta.after as Record<string, unknown>) ?? null,
        );
      }
      // Strip before/after, keep other metadata keys.
      const { before: _b, after: _a, ...restMeta } = meta ?? {};
      return {
        ...row,
        metadata: Object.keys(restMeta).length > 0 ? restMeta : null,
        changedFields,
      };
    });

    return { data, total, limit, offset };
  }

  /**
   * v0.29: detail endpoint — returns raw sanitized metadata (full before/after).
   */
  async findById(id: string) {
    const row = await this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, username: true },
        },
      },
    });
    if (!row) return null;
    const meta = (row.metadata ?? null) as Record<string, unknown> | null;
    let changedFields: ChangedField[] = [];
    if (meta && (meta.before || meta.after)) {
      changedFields = computeFieldDiff(
        (meta.before as Record<string, unknown>) ?? null,
        (meta.after as Record<string, unknown>) ?? null,
      );
    }
    return { ...row, changedFields };
  }

  /**
   * v0.29: distinct action names for filter dropdown.
   */
  async distinctActions(): Promise<string[]> {
    const rows = await this.prisma.auditLog.findMany({
      select: { action: true },
      distinct: ['action'],
      orderBy: { action: 'asc' },
    });
    return rows.map((r) => r.action);
  }

  /**
   * v0.29: distinct subject types for filter dropdown.
   */
  async distinctSubjects(): Promise<string[]> {
    const rows = await this.prisma.auditLog.findMany({
      select: { subject: true },
      distinct: ['subject'],
      where: { subject: { not: null } },
      orderBy: { subject: 'asc' },
    });
    return rows.map((r) => r.subject!).filter(Boolean);
  }
}
