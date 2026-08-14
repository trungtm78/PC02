import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BulkOperationStatus, Prisma, RecordReturnType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateRecordReturnDto,
  RevertRecordReturnDto,
  type ReturnTarget,
} from './dto/create-record-return.dto';
import type { DataScope } from '../auth/services/unit-scope.service';
import { buildScopeFilter } from '../common/utils/scope-filter.util';
import type { BulkResult } from '../common/bulk/run-bulk';

/** Postgres code for a violated CHECK constraint. */
const CHECK_VIOLATION = '23514';

const TARGETS: Record<
  ReturnTarget,
  {
    column: 'caseId' | 'incidentId' | 'petitionId';
    model: 'case' | 'incident' | 'petition';
    label: string;
  }
> = {
  case: { column: 'caseId', model: 'case', label: 'vụ án' },
  incident: { column: 'incidentId', model: 'incident', label: 'vụ việc' },
  petition: { column: 'petitionId', model: 'petition', label: 'đơn thư' },
};

@Injectable()
export class RecordReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Return a batch of records to the unit that sent them.
   *
   * Per record, not per batch: one file failing must not roll back the twenty
   * that succeeded, and the caller needs to know exactly which ones did not go.
   * Records outside the caller's data scope are reported as skipped rather than
   * failed — they are not an error, they are simply not this officer's to return.
   */
  async createMany(
    dto: CreateRecordReturnDto,
    actorId: string,
    dataScope: DataScope | null | undefined,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<BulkResult<{ returnId: string }>> {
    const target = TARGETS[dto.target];
    const scopeFilter = buildScopeFilter(dataScope, 'write');

    const delegate = this.prisma[target.model] as {
      findMany: (args: unknown) => Promise<Array<{ id: string }>>;
    };
    const inScope = await delegate.findMany({
      where: { id: { in: dto.ids }, deletedAt: null, ...scopeFilter },
      select: { id: true },
    });
    const allowed = new Set(inScope.map((r) => r.id));

    const bulk = await this.prisma.bulkOperation.create({
      data: {
        actorId,
        resource:
          target.model === 'case'
            ? 'Case'
            : target.model === 'incident'
              ? 'Incident'
              : 'Petition',
        action: 'BULK_RECORD_RETURN',
      },
    });

    const result: BulkResult<{ returnId: string }> = {
      succeeded: [],
      skipped: [],
      failed: [],
    };

    for (const id of dto.ids) {
      if (!allowed.has(id)) {
        result.skipped.push({
          id,
          reason: 'NOT_FOUND',
          message: `Không tìm thấy ${target.label}, hoặc nằm ngoài phạm vi dữ liệu của bạn`,
        });
        continue;
      }

      const open = await this.prisma.recordReturn.findFirst({
        where: { [target.column]: id, revertedAt: null },
        select: { id: true },
      });
      if (open) {
        result.skipped.push({
          id,
          reason: 'INELIGIBLE',
          message: `${target.label} này đã được trả và chưa hoàn tác`,
        });
        continue;
      }

      try {
        const created = await this.prisma.recordReturn.create({
          data: {
            [target.column]: id,
            returnType: dto.returnType,
            reason: dto.reason,
            toUnit: dto.toUnit,
            documentNo: dto.documentNo ?? null,
            returnedById: actorId,
            bulkOperationId: bulk.id,
          },
        });
        await this.audit.log({
          userId: actorId,
          action: 'RECORD_RETURNED',
          subject:
            target.model === 'case'
              ? 'Case'
              : target.model === 'incident'
                ? 'Incident'
                : 'Petition',
          subjectId: id,
          metadata: {
            returnId: created.id,
            returnType: dto.returnType,
            reason: dto.reason,
            toUnit: dto.toUnit,
            documentNo: dto.documentNo ?? null,
            bulkOperationId: bulk.id,
          },
          ipAddress: meta?.ipAddress,
          userAgent: meta?.userAgent,
        });
        result.succeeded.push({ id, data: { returnId: created.id } });
      } catch (err) {
        result.failed.push({ id, error: this.explain(err, target.label) });
      }
    }

    await this.prisma.bulkOperation.update({
      where: { id: bulk.id },
      data: {
        // The enum has no PARTIAL. A batch where some rows failed is still a
        // batch that ran, and the per-item counts below say exactly what
        // happened — inventing a status value here would need a migration to
        // record something the counts already carry.
        status: BulkOperationStatus.COMPLETED,
        completedAt: new Date(),
        succeededCount: result.succeeded.length,
        skippedCount: result.skipped.length,
        failedCount: result.failed.length,
      },
    });

    return result;
  }

  /**
   * Turn a database error into something an officer can act on.
   *
   * The `num_nonnulls = 1` CHECK is the invariant that stops a return pointing
   * at two files or none. When it fires, Postgres says
   * `new row for relation "record_returns" violates check constraint
   * "record_returns_exactly_one_target"` — accurate, and useless on a screen in
   * a duty room. Anything unrecognised keeps a generic message rather than
   * leaking the raw driver text.
   */
  private explain(err: unknown, label: string): string {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      const code =
        (err.meta as { code?: string } | undefined)?.code ?? err.code;
      if (code === CHECK_VIOLATION || err.code === 'P2010') {
        return `Bản ghi trả hồ sơ phải trỏ tới đúng một ${label}. Vui lòng chọn lại.`;
      }
      if (err.code === 'P2003') {
        return `Không tìm thấy ${label} để trả — hồ sơ có thể vừa bị xoá.`;
      }
    }
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code?: string }).code === CHECK_VIOLATION
    ) {
      return `Bản ghi trả hồ sơ phải trỏ tới đúng một ${label}. Vui lòng chọn lại.`;
    }
    return `Không trả được ${label}. Vui lòng thử lại hoặc báo quản trị viên.`;
  }

  /** Withdraw a return without erasing that it happened. */
  async revert(
    id: string,
    dto: RevertRecordReturnDto,
    actorId: string,
    dataScope: DataScope | null | undefined,
    meta?: { ipAddress?: string; userAgent?: string },
  ) {
    const existing = await this.prisma.recordReturn.findFirst({
      where: { id, revertedAt: null },
    });
    if (!existing) {
      throw new NotFoundException(
        'Không tìm thấy bản ghi trả hồ sơ đang hiệu lực',
      );
    }

    const target = existing.caseId
      ? { model: 'case' as const, subject: 'Case', id: existing.caseId }
      : existing.incidentId
        ? {
            model: 'incident' as const,
            subject: 'Incident',
            id: existing.incidentId,
          }
        : existing.petitionId
          ? {
              model: 'petition' as const,
              subject: 'Petition',
              id: existing.petitionId,
            }
          : null;
    if (!target) {
      // Only reachable if the CHECK constraint were dropped.
      throw new BadRequestException(
        'Bản ghi trả hồ sơ không trỏ tới hồ sơ nào',
      );
    }

    const scopeFilter = buildScopeFilter(dataScope, 'write');
    const delegate = this.prisma[target.model] as {
      findFirst: (args: unknown) => Promise<{ id: string } | null>;
    };
    const inScope = await delegate.findFirst({
      where: { id: target.id, ...scopeFilter },
      select: { id: true },
    });
    if (!inScope) {
      throw new NotFoundException('Hồ sơ nằm ngoài phạm vi dữ liệu của bạn');
    }

    const updated = await this.prisma.recordReturn.update({
      where: { id },
      data: {
        revertedAt: new Date(),
        revertedById: actorId,
        revertReason: dto.revertReason,
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'RECORD_RETURN_REVERTED',
      subject: target.subject,
      subjectId: target.id,
      metadata: {
        returnId: id,
        revertReason: dto.revertReason,
        returnType: existing.returnType,
      },
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    });

    return updated;
  }

  async list(
    query: {
      target?: ReturnTarget;
      returnType?: RecordReturnType;
      includeReverted?: string;
      limit?: number;
      offset?: number;
    },
    dataScope: DataScope | null | undefined,
  ) {
    const limit = Math.min(Number(query.limit) || 50, 100);
    const offset = Math.max(Number(query.offset) || 0, 0);
    const scopeFilter = buildScopeFilter(dataScope);

    const where: Prisma.RecordReturnWhereInput = {
      ...(query.includeReverted === 'true' ? {} : { revertedAt: null }),
      ...(query.returnType ? { returnType: query.returnType } : {}),
      ...(query.target
        ? { [TARGETS[query.target].column]: { not: null } }
        : {}),
      // Scope is applied through whichever file the row points at, so a return
      // for another unit's case never appears in this unit's list.
      OR: [
        { case: { is: { ...scopeFilter } } },
        { incident: { is: { ...scopeFilter } } },
        { petition: { is: { ...scopeFilter } } },
      ],
    };

    const [data, total] = await Promise.all([
      this.prisma.recordReturn.findMany({
        where,
        orderBy: { returnedAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          case: { select: { id: true, caseCode: true, name: true } },
          incident: { select: { id: true, code: true, name: true } },
          petition: { select: { id: true, stt: true, senderName: true } },
          returnedBy: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prisma.recordReturn.count({ where }),
    ]);

    return { data, total, limit, offset };
  }
}
