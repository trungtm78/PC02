import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import type { DataScope } from '../../auth/services/unit-scope.service';
import { buildScopeFilter } from '../../common/utils/scope-filter.util';
import { runBulk } from '../../common/bulk/run-bulk';
import type { BulkResult, BulkSkippedItem } from '../../common/bulk/run-bulk';

export interface BulkDeleteSubjectsInput {
  ids: string[];
  reason: string;
  actorId: string;
  idempotencyKey?: string;
  dataScope: DataScope | null | undefined;
  meta?: { ipAddress?: string; userAgent?: string };
}

const CONCURRENT_PREFIX = '__CONCURRENT_MODIFICATION__:';
class ConcurrentModificationError extends Error {
  constructor(id: string) {
    super(`${CONCURRENT_PREFIX}${id}`);
  }
}

/**
 * v0.51 — Subjects (Bị can/Bị hại/Nhân chứng/Luật sư representation) bulk-delete.
 * Scope check qua parent case (subjects.service.ts:317 assertParentInScope pattern).
 */
@Injectable()
export class SubjectsBulkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async bulkDelete(
    input: BulkDeleteSubjectsInput,
  ): Promise<BulkResult<{ subjectId: string }>> {
    if (input.ids.length === 0)
      throw new BadRequestException('Cần ít nhất 1 đối tượng để xóa');
    if (input.ids.length > 100)
      throw new BadRequestException('Tối đa 100 đối tượng mỗi đợt');

    const { bulkOperationId } = await this.audit.logBulkHeader({
      actorId: input.actorId,
      resource: 'Subject',
      action: 'BULK_DELETE',
      idempotencyKey: input.idempotencyKey,
    });

    const result = await runBulk<{ subjectId: string }, Prisma.TransactionClient>({
      ids: input.ids,
      prisma: this.prisma as unknown as {
        $transaction: <R>(cb: (tx: Prisma.TransactionClient) => Promise<R>) => Promise<R>;
      },
      preflight: async (ids) => {
        const scopeFilter = buildScopeFilter(input.dataScope);
        const inScope = await this.prisma.subject.findMany({
          where: {
            id: { in: ids },
            deletedAt: null,
            ...(scopeFilter ? { case: scopeFilter as Prisma.CaseWhereInput } : {}),
          },
          select: { id: true },
        });
        const inScopeSet = new Set(inScope.map((s) => s.id));
        const skipped: BulkSkippedItem[] = ids
          .filter((id) => !inScopeSet.has(id))
          .map((id) => ({ id, reason: 'PERMISSION' as const }));
        return { validIds: ids.filter((id) => inScopeSet.has(id)), skipped };
      },
      executeOne: async (id, tx) => {
        try {
          await tx.subject.update({
            where: { id, deletedAt: null },
            data: { deletedAt: new Date() },
          });
        } catch (e) {
          if ((e as { code?: string })?.code === 'P2025')
            throw new ConcurrentModificationError(id);
          throw e;
        }
        await this.audit.logBulkItem(
          {
            bulkOperationId,
            userId: input.actorId,
            action: 'SUBJECT_DELETED',
            subject: 'Subject',
            subjectId: id,
            metadata: { reason: input.reason, softDelete: true },
            ipAddress: input.meta?.ipAddress,
            userAgent: input.meta?.userAgent,
          },
          tx,
        );
        return { subjectId: id };
      },
    });

    const reclassified: BulkResult<{ subjectId: string }> = {
      succeeded: result.succeeded,
      skipped: [
        ...result.skipped,
        ...result.failed
          .filter((f) => f.error.startsWith(CONCURRENT_PREFIX))
          .map<BulkSkippedItem>((f) => ({
            id: f.id,
            reason: 'CONCURRENT_MODIFICATION',
            message: 'Đối tượng đã được xóa bởi người khác',
          })),
      ],
      failed: result.failed.filter((f) => !f.error.startsWith(CONCURRENT_PREFIX)),
    };
    await this.audit.completeBulk(bulkOperationId, {
      succeeded: reclassified.succeeded.length,
      skipped: reclassified.skipped.length,
      failed: reclassified.failed.length,
    });
    return reclassified;
  }
}
