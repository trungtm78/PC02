import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import type { DataScope } from '../../auth/services/unit-scope.service';
import { buildScopeFilter } from '../../common/utils/scope-filter.util';
import { runBulk } from '../../common/bulk/run-bulk';
import type { BulkResult, BulkSkippedItem } from '../../common/bulk/run-bulk';

/**
 * Input cho bulk-assign 1 batch case về 1 team + investigator chung.
 * Constraint thiết kế: 1 request = 1 (teamId, investigatorId) pair áp cho N cases.
 * Caller cần assign tới nhiều team khác nhau → gọi nhiều request riêng.
 */
export interface BulkAssignCasesInput {
  ids: string[];
  assignedTeamId: string;
  investigatorId?: string;
  /** Optimistic lock map: caseId → updatedAt snapshot. Plan eng E-H2. */
  expectedUpdatedAtByCaseId?: Record<string, Date>;
  /** Lý do phân công (bắt buộc ở DTO layer ≥10 char). */
  reason?: string;
  /** Retry-safe key. Plan eng E-H10. */
  idempotencyKey?: string;
  actorId: string;
  // Nullable: admin → null, `buildScopeFilter` handles null = no filter.
  // Codex P1 review (B3a): ScopedRequest.dataScope is `DataScope | null | undefined`,
  // controller passes through directly → input type must accept null.
  dataScope: DataScope | null | undefined;
  meta?: { ipAddress?: string; userAgent?: string };
}

/**
 * v0.48 PR1 B3a — Bulk-assign cases service.
 *
 * Architecture (plan v2):
 * - Composition utility `runBulk` (KHÔNG base class — E-C1).
 * - DispatchGuard gated at controller (E-C4); service trust caller.
 * - Pre-validate team + investigator ONCE before loop (cheap fail-fast).
 * - Preflight scope filter on ids (E-H4 — out-of-scope = silent PERMISSION skip).
 * - Per-item Prisma $transaction (E-C5 Postgres abort semantics).
 * - Audit inside per-item tx (E-H3 atomic với data write).
 * - Optimistic lock via updatedAt snapshot (E-H2).
 * - Header row STARTED → COMPLETED with counts (E-H3).
 */
@Injectable()
export class CasesBulkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async bulkAssign(
    input: BulkAssignCasesInput,
  ): Promise<BulkResult<{ caseId: string }>> {
    // 1) Validate team + investigator ONCE — cheap fail-fast trước khi tạo header.
    const team = await this.prisma.team.findFirst({
      where: { id: input.assignedTeamId, isActive: true },
    });
    if (!team) {
      throw new BadRequestException(
        `Tổ điều tra không tồn tại hoặc đã ngừng hoạt động (id: ${input.assignedTeamId})`,
      );
    }
    if (input.investigatorId) {
      const member = await this.prisma.userTeam.findFirst({
        where: { userId: input.investigatorId, teamId: input.assignedTeamId },
      });
      if (!member) {
        throw new BadRequestException(
          'Điều tra viên không thuộc tổ được chỉ định',
        );
      }
    }

    // 2) Tạo bulk_operations header (STARTED).
    const { bulkOperationId } = await this.audit.logBulkHeader({
      actorId: input.actorId,
      resource: 'Case',
      action: 'BULK_ASSIGN',
      idempotencyKey: input.idempotencyKey,
    });

    // 3) runBulk: preflight scope-filter + per-item tx assign.
    const result = await runBulk<{ caseId: string }, Prisma.TransactionClient>({
      ids: input.ids,
      prisma: this.prisma as unknown as {
        $transaction: <R>(
          cb: (tx: Prisma.TransactionClient) => Promise<R>,
        ) => Promise<R>;
      },
      preflight: async (ids) => {
        // Scope filter: caller submit ids ngoài dataScope → silent PERMISSION skip.
        // KHÔNG enumerate (mirror existing 404 pattern, E-H4).
        const inScope = await this.prisma.case.findMany({
          where: {
            id: { in: ids },
            deletedAt: null,
            ...buildScopeFilter(input.dataScope),
          },
          select: { id: true },
        });
        const inScopeSet = new Set(inScope.map((c) => c.id));
        const skipped: BulkSkippedItem[] = ids
          .filter((id) => !inScopeSet.has(id))
          .map((id) => ({ id, reason: 'PERMISSION' as const }));
        return { validIds: ids.filter((id) => inScopeSet.has(id)), skipped };
      },
      executeOne: async (id, tx) => {
        const expectedAt = input.expectedUpdatedAtByCaseId?.[id];
        try {
          await tx.case.update({
            where: {
              id,
              ...(expectedAt ? { updatedAt: expectedAt } : {}),
            },
            data: {
              assignedTeamId: input.assignedTeamId,
              investigatorId: input.investigatorId ?? null,
            },
          });
        } catch (e) {
          if ((e as { code?: string })?.code === 'P2025') {
            // Optimistic lock conflict — rethrow as concrete signal cho runBulk catch.
            // runBulk classify all errors là `failed`; em remap CONCURRENT_MODIFICATION
            // ở post-loop (xem step 4).
            throw new ConcurrentModificationError(id);
          }
          throw e;
        }
        // Audit inside SAME tx — rollback đồng bộ nếu post-audit step fail.
        await this.audit.logBulkItem(
          {
            bulkOperationId,
            userId: input.actorId,
            action: 'CASE_ASSIGNED',
            subject: 'Case',
            subjectId: id,
            metadata: {
              toTeamId: input.assignedTeamId,
              toInvestigatorId: input.investigatorId ?? null,
              reason: input.reason,
            },
            ipAddress: input.meta?.ipAddress,
            userAgent: input.meta?.userAgent,
          },
          tx,
        );
        return { caseId: id };
      },
    });

    // 4) Reclassify ConcurrentModificationError từ failed → skipped (better UX signal).
    const reclassified: BulkResult<{ caseId: string }> = {
      succeeded: result.succeeded,
      skipped: [
        ...result.skipped,
        ...result.failed
          .filter((f) => f.error.startsWith(CONCURRENT_PREFIX))
          .map<BulkSkippedItem>((f) => ({
            id: f.id,
            reason: 'CONCURRENT_MODIFICATION',
            message: 'Vụ án đã được chỉnh sửa bởi người khác',
          })),
      ],
      failed: result.failed.filter((f) => !f.error.startsWith(CONCURRENT_PREFIX)),
    };

    // 5) Complete header (COMPLETED + counts).
    await this.audit.completeBulk(bulkOperationId, {
      succeeded: reclassified.succeeded.length,
      skipped: reclassified.skipped.length,
      failed: reclassified.failed.length,
    });

    return reclassified;
  }
}

// Marker error cho optimistic-lock conflict. runBulk catch generic Error → message
// dùng để classify CONCURRENT_MODIFICATION ở post-loop reclassify (step 4).
const CONCURRENT_PREFIX = '__CONCURRENT_MODIFICATION__:';
class ConcurrentModificationError extends Error {
  constructor(id: string) {
    super(`${CONCURRENT_PREFIX}${id}`);
    this.name = 'ConcurrentModificationError';
  }
}
