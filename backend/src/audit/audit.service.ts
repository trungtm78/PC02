import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
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

  // ───────────────────────────────────────────────
  // v0.48 PR1 B2 — Bulk operations audit
  // logBulkHeader (outside tx, status STARTED) → loop runBulk per item
  //   calling logBulkItem (inside tx, atomic với data write) → completeBulk
  //   (outside tx, status COMPLETED + counts). Plan eng E-H3 atomicity model.
  // ───────────────────────────────────────────────

  /**
   * Tạo 1 header row trong `bulk_operations` với status STARTED.
   * Caller giữ `bulkOperationId` trả về để: (1) pass cho `logBulkItem` mỗi item,
   * (2) gọi `completeBulk` cuối loop. Idempotency key optional cho retry-safe
   * (plan eng E-H10) — combo `(actorId, idempotencyKey)` UNIQUE ở DB layer.
   */
  async logBulkHeader(input: {
    actorId: string;
    resource: string;
    action: string;
    idempotencyKey?: string;
  }): Promise<{ bulkOperationId: string }> {
    const id = randomUUID();
    try {
      await this.prisma.$executeRaw`
        INSERT INTO "bulk_operations" (
          id, "actorId", resource, action, status, "idempotencyKey", "startedAt"
        ) VALUES (
          ${id},
          ${input.actorId},
          ${input.resource},
          ${input.action},
          'STARTED'::"BulkOperationStatus",
          ${input.idempotencyKey ?? null},
          NOW()
        )
      `;
      return { bulkOperationId: id };
    } catch (e) {
      // Codex post-deploy P2 fix: retry với same idempotencyKey không nên crash.
      // P2002 = Prisma unique constraint violation. UNIQUE (actorId, idempotencyKey)
      // → caller retry trên cùng request → trả lại bulkOperationId hiện có.
      // KHÔNG có idempotencyKey → bug thực sự, rethrow.
      if (
        input.idempotencyKey &&
        (e as { code?: string })?.code === 'P2002'
      ) {
        const existing = await this.prisma.$queryRaw<{ id: string }[]>`
          SELECT id FROM "bulk_operations"
          WHERE "actorId" = ${input.actorId}
            AND "idempotencyKey" = ${input.idempotencyKey}
          LIMIT 1
        `;
        if (existing.length > 0) {
          return { bulkOperationId: existing[0].id };
        }
      }
      throw e;
    }
  }

  /**
   * Ghi 1 item row vào audit_logs với `bulkOperationId` set. PHẢI gọi inside tx
   * của data write (plan eng E-H3): rollback đồng bộ nếu Case update fail thì
   * audit row cũng rollback. Caller truyền `tx` từ `prisma.$transaction(...)`.
   * Bỏ tx → fallback ghi qua prisma chính (chỉ cho test/internal use).
   */
  async logBulkItem(
    input: {
      bulkOperationId: string;
      userId: string;
      action: string;
      subject: string;
      subjectId: string;
      metadata?: Record<string, unknown>;
      ipAddress?: string;
      userAgent?: string;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    const safeMetadata = input.metadata
      ? sanitizeMetadataRecursive(input.metadata)
      : null;
    await client.$executeRaw`
      INSERT INTO "audit_logs" (
        id, "userId", action, subject, "subjectId", metadata,
        "ipAddress", "userAgent", "bulkOperationId", "createdAt"
      ) VALUES (
        gen_random_uuid()::text,
        ${input.userId},
        ${input.action},
        ${input.subject},
        ${input.subjectId},
        ${safeMetadata ? JSON.stringify(safeMetadata) : null}::jsonb,
        ${input.ipAddress ?? null},
        ${input.userAgent ?? null},
        ${input.bulkOperationId},
        NOW()
      )
    `;
  }

  /**
   * Cập nhật header row sau khi loop xong: status COMPLETED|FAILED, counts,
   * completedAt. Gọi OUTSIDE per-item tx (sau khi runBulk return).
   * `status` mặc định 'COMPLETED'; gọi với 'FAILED' khi toàn bộ batch fail
   * (vd preflight throw).
   */
  async completeBulk(
    bulkOperationId: string,
    counts: {
      succeeded: number;
      skipped: number;
      failed: number;
      status?: 'COMPLETED' | 'FAILED';
    },
  ): Promise<void> {
    const status = counts.status ?? 'COMPLETED';
    await this.prisma.$executeRaw`
      UPDATE "bulk_operations"
      SET status = ${status}::"BulkOperationStatus",
          "succeededCount" = ${counts.succeeded},
          "skippedCount" = ${counts.skipped},
          "failedCount" = ${counts.failed},
          "completedAt" = NOW()
      WHERE id = ${bulkOperationId}
    `;
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
