import { BadRequestException, Injectable } from '@nestjs/common';
import type { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { CaseStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import type { DataScope } from '../../auth/services/unit-scope.service';
import { buildScopeFilter } from '../../common/utils/scope-filter.util';
import { BcaExcelHelper } from '../../common/bca-excel.helper';
import { CASE_STATUS_LABEL } from '../../common/constants/status-labels.constants';
import { ROLE_NAMES } from '../../common/constants/role.constants';
import { runBulk } from '../../common/bulk/run-bulk';
import type { BulkResult, BulkSkippedItem } from '../../common/bulk/run-bulk';

/**
 * Input cho bulk-assign 1 batch case về 1 team + investigator chung.
 * Constraint thiết kế: 1 request = 1 (teamId, investigatorId) pair áp cho N cases.
 * Caller cần assign tới nhiều team khác nhau → gọi nhiều request riêng.
 */
/**
 * Input cho bulk-export N cases ra xlsx stream.
 * Read-only → KHÔNG dùng runBulk (không cần per-item tx).
 * Scope filter áp dụng ở `findMany WHERE id IN + scopeFilter` → out-of-scope ids
 * silently excluded từ output (no enumeration leak, plan eng E-H4).
 *
 * Cap 1000 ids (cao hơn write cap 100 vì read-only an toàn hơn nhưng vẫn cần
 * giới hạn cho memory + JSON payload size, plan eng E-H1).
 */
export interface BulkExportCasesInput {
  ids: string[];
  dataScope: DataScope | null | undefined;
  res: Response;
  actorId: string;
  meta?: { ipAddress?: string; userAgent?: string };
}

/**
 * v0.49 PR2 — Input cho bulk-delete Cases (soft delete).
 *
 * Per-item preflight check (match single-delete invariants ở cases.service.ts:1058):
 * 1. Status TIEP_NHAN only → khác trạng thái → INELIGIBLE skip.
 * 2. No linked records (subjects/lawyers/conclusions/documents) → có → INELIGIBLE.
 * 3. Actor là creator hoặc ADMIN → khác → INELIGIBLE.
 * 4. Soft delete: set deletedAt = NOW(), reason ghi trong audit metadata.
 */
export interface BulkDeleteCasesInput {
  ids: string[];
  reason: string;
  actorId: string;
  actorRole: string;
  idempotencyKey?: string;
  dataScope: DataScope | null | undefined;
  meta?: { ipAddress?: string; userAgent?: string };
}

/**
 * v0.49 PR2 — Input cho bulk-restore Cases (admin-only at controller layer).
 * Pairs với v0.32 soft-delete restore endpoint. Items có deletedAt = null → NOT_FOUND skip.
 */
export interface BulkRestoreCasesInput {
  ids: string[];
  reason: string;
  actorId: string;
  idempotencyKey?: string;
  meta?: { ipAddress?: string; userAgent?: string };
}

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

  /**
   * Bulk-export N cases ra xlsx stream. Read-only → no per-item tx.
   * - Validates ids 1..1000.
   * - findMany WHERE id IN + scope filter → silent exclude out-of-scope (E-H4).
   * - Audit log CASE_BULK_EXPORTED (PII bulk leak path — match exportWardCases pattern).
   * - Writes xlsx to Response stream.
   */
  async bulkExport(input: BulkExportCasesInput): Promise<void> {
    if (input.ids.length === 0) {
      throw new BadRequestException('Cần ít nhất 1 vụ án để xuất Excel');
    }
    if (input.ids.length > 1000) {
      throw new BadRequestException(
        'Tối đa 1000 vụ án mỗi lần xuất (chia thành nhiều đợt nếu nhiều hơn)',
      );
    }

    // Audit PII export trail — match exportWardCases (cases.service.ts:1568).
    await this.audit.log({
      userId: input.actorId,
      action: 'CASE_BULK_EXPORTED',
      subject: 'Case',
      metadata: {
        idsRequested: input.ids.length,
        format: 'xlsx',
      },
      ipAddress: input.meta?.ipAddress,
      userAgent: input.meta?.userAgent,
    });

    // Build WHERE: id IN + scope filter (admin → null → no extra filter).
    const where: Prisma.CaseWhereInput = {
      id: { in: input.ids },
      deletedAt: null,
    };
    const scopeFilter = buildScopeFilter(input.dataScope);
    if (scopeFilter) {
      where.AND = [scopeFilter as Prisma.CaseWhereInput];
    }

    const records = await this.prisma.case.findMany({
      where,
      // Cùng thứ tự với DANH SÁCH trên màn hình (ngày tiếp nhận, mới→cũ). Trước đây
      // dùng `createdAt` — cột mà toàn bộ hồ sơ di trú đều mang cùng một giá trị, nên
      // thứ tự file xuất ra là ngẫu nhiên và không khớp thứ tự cán bộ vừa nhìn thấy.
      orderBy: [{ ngayDeXuat: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
      select: {
        id: true,
        caseCode: true,
        name: true,
        crime: true,
        unit: true,
        createdAt: true,
        status: true,
        investigator: { select: { firstName: true, lastName: true } },
      },
    });

    // ───── XLSX assembly (BCA-branded, match exportWardCases style) ─────
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Vụ án');
    const COL_COUNT = 8;
    const HEADERS = [
      'STT',
      'Mã vụ án',
      'Tên vụ án',
      'Loại tội phạm',
      'Phường/Xã',
      'ĐTV phụ trách',
      'Ngày tiếp nhận',
      'Trạng thái',
    ];
    const WIDTHS = [6, 18, 30, 20, 20, 20, 16, 20];

    BcaExcelHelper.addHeader(
      sheet,
      COL_COUNT,
      'DANH SÁCH VỤ ÁN ĐÃ CHỌN',
      `Xuất theo lựa chọn (${records.length} bản ghi)`,
    );
    // addColumnHeaders nhận row, không nhận sheet — set widths riêng.
    const headerRow = sheet.getRow(7);
    BcaExcelHelper.addColumnHeaders(headerRow, HEADERS, WIDTHS);

    records.forEach((rec, idx) => {
      const investigatorName = rec.investigator
        ? `${rec.investigator.firstName ?? ''} ${rec.investigator.lastName ?? ''}`.trim()
        : '';
      const dataRow = sheet.addRow([
        idx + 1,
        rec.caseCode ?? rec.id,
        rec.name ?? '',
        rec.crime ?? '',
        rec.unit ?? '',
        investigatorName,
        rec.createdAt ? rec.createdAt.toLocaleDateString('vi-VN') : '',
        CASE_STATUS_LABEL[rec.status as CaseStatus] ?? rec.status ?? '',
      ]);
      BcaExcelHelper.styleDataRow(dataRow, idx % 2 === 1, COL_COUNT);
    });

    const lastDataRow = sheet.lastRow?.number ?? 7;
    BcaExcelHelper.addFooter(sheet, lastDataRow + 2, COL_COUNT);
    BcaExcelHelper.setPrintSetup(sheet);

    const filename = `VuAn_DaChon_${new Date().toISOString().slice(0, 10)}.xlsx`;
    input.res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    input.res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    try {
      await workbook.xlsx.write(input.res);
    } catch (err) {
      if (!input.res.headersSent) {
        input.res.status(500).json({ error: 'Bulk export failed' });
      } else {
        input.res.destroy();
      }
      throw err;
    }
    input.res.end();
  }

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

  /**
   * v0.49 PR2 — Bulk soft-delete Cases.
   *
   * Preflight per-item check (match single-delete invariants):
   * - status TIEP_NHAN → khác → INELIGIBLE
   * - 0 linked subjects/lawyers/conclusions/documents → có → INELIGIBLE
   * - actor là creator HOẶC ADMIN → khác → INELIGIBLE
   * - dataScope filter applied (out-of-scope = PERMISSION skip)
   *
   * Per-item tx: tx.case.update({deletedAt: NOW}) + audit.logBulkItem (E-H3).
   */
  async bulkDelete(
    input: BulkDeleteCasesInput,
  ): Promise<BulkResult<{ caseId: string }>> {
    if (input.ids.length === 0) {
      throw new BadRequestException('Cần ít nhất 1 vụ án để xóa');
    }
    if (input.ids.length > 100) {
      throw new BadRequestException(
        'Tối đa 100 vụ án mỗi đợt (chia nhỏ nếu nhiều hơn)',
      );
    }

    const { bulkOperationId } = await this.audit.logBulkHeader({
      actorId: input.actorId,
      resource: 'Case',
      action: 'BULK_DELETE',
      idempotencyKey: input.idempotencyKey,
    });

    const isAdmin = input.actorRole === ROLE_NAMES.ADMIN;

    const result = await runBulk<{ caseId: string }, Prisma.TransactionClient>({
      ids: input.ids,
      prisma: this.prisma as unknown as {
        $transaction: <R>(cb: (tx: Prisma.TransactionClient) => Promise<R>) => Promise<R>;
      },
      preflight: async (ids) => {
        // Single query: load all cases + linked counts + scope filter.
        const inScope = await this.prisma.case.findMany({
          where: {
            id: { in: ids },
            deletedAt: null,
            ...buildScopeFilter(input.dataScope),
          },
          include: {
            subjects: { where: { deletedAt: null }, select: { id: true } },
            lawyers: { where: { deletedAt: null }, select: { id: true } },
            conclusions: { where: { deletedAt: null }, select: { id: true } },
            documents: { where: { deletedAt: null }, select: { id: true } },
          },
        });
        const inScopeMap = new Map(inScope.map((c) => [c.id, c]));
        const skipped: BulkSkippedItem[] = [];
        const validIds: string[] = [];
        for (const id of ids) {
          const c = inScopeMap.get(id);
          if (!c) {
            skipped.push({ id, reason: 'PERMISSION' });
            continue;
          }
          if (c.status !== CaseStatus.TIEP_NHAN) {
            skipped.push({
              id,
              reason: 'INELIGIBLE',
              message: 'Chỉ xóa được vụ án ở trạng thái Tiếp nhận',
            });
            continue;
          }
          if (c.subjects.length > 0) {
            skipped.push({
              id,
              reason: 'INELIGIBLE',
              message: `Có ${c.subjects.length} đối tượng — xóa các đối tượng trước`,
            });
            continue;
          }
          if (c.lawyers.length > 0) {
            skipped.push({
              id,
              reason: 'INELIGIBLE',
              message: `Có ${c.lawyers.length} luật sư đăng ký`,
            });
            continue;
          }
          if (c.conclusions.length > 0) {
            skipped.push({
              id,
              reason: 'INELIGIBLE',
              message: `Có ${c.conclusions.length} kết luận điều tra`,
            });
            continue;
          }
          if (c.documents.length > 0) {
            skipped.push({
              id,
              reason: 'INELIGIBLE',
              message: `Có ${c.documents.length} tài liệu đính kèm`,
            });
            continue;
          }
          if (!isAdmin && c.createdById !== input.actorId) {
            skipped.push({
              id,
              reason: 'INELIGIBLE',
              message: 'Chỉ người tạo hoặc quản trị viên mới được xóa',
            });
            continue;
          }
          validIds.push(id);
        }
        return { validIds, skipped };
      },
      executeOne: async (id, tx) => {
        try {
          await tx.case.update({
            where: { id, deletedAt: null },
            data: { deletedAt: new Date() },
          });
        } catch (e) {
          if ((e as { code?: string })?.code === 'P2025') {
            throw new ConcurrentModificationError(id);
          }
          throw e;
        }
        await this.audit.logBulkItem(
          {
            bulkOperationId,
            userId: input.actorId,
            action: 'CASE_DELETED',
            subject: 'Case',
            subjectId: id,
            metadata: { reason: input.reason },
            ipAddress: input.meta?.ipAddress,
            userAgent: input.meta?.userAgent,
          },
          tx,
        );
        return { caseId: id };
      },
    });

    const reclassified: BulkResult<{ caseId: string }> = {
      succeeded: result.succeeded,
      skipped: [
        ...result.skipped,
        ...result.failed
          .filter((f) => f.error.startsWith(CONCURRENT_PREFIX))
          .map<BulkSkippedItem>((f) => ({
            id: f.id,
            reason: 'CONCURRENT_MODIFICATION',
            message: 'Vụ án đã được xóa bởi người khác',
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

  /**
   * v0.49 PR2 — Bulk restore Cases (admin-only at controller layer).
   * Preflight: items có deletedAt = null → NOT_FOUND skip (không tồn tại hoặc đã restored).
   */
  async bulkRestore(
    input: BulkRestoreCasesInput,
  ): Promise<BulkResult<{ caseId: string }>> {
    if (input.ids.length === 0) {
      throw new BadRequestException('Cần ít nhất 1 vụ án để khôi phục');
    }
    if (input.ids.length > 100) {
      throw new BadRequestException('Tối đa 100 vụ án mỗi đợt');
    }

    const { bulkOperationId } = await this.audit.logBulkHeader({
      actorId: input.actorId,
      resource: 'Case',
      action: 'BULK_RESTORE',
      idempotencyKey: input.idempotencyKey,
    });

    const result = await runBulk<{ caseId: string }, Prisma.TransactionClient>({
      ids: input.ids,
      prisma: this.prisma as unknown as {
        $transaction: <R>(cb: (tx: Prisma.TransactionClient) => Promise<R>) => Promise<R>;
      },
      preflight: async (ids) => {
        const deleted = await this.prisma.case.findMany({
          where: { id: { in: ids }, deletedAt: { not: null } },
          select: { id: true },
        });
        const deletedSet = new Set(deleted.map((c) => c.id));
        const skipped: BulkSkippedItem[] = ids
          .filter((id) => !deletedSet.has(id))
          .map((id) => ({
            id,
            reason: 'NOT_FOUND' as const,
            message: 'Vụ án không tồn tại hoặc chưa bị xóa',
          }));
        return { validIds: ids.filter((id) => deletedSet.has(id)), skipped };
      },
      executeOne: async (id, tx) => {
        try {
          await tx.case.update({
            where: { id, deletedAt: { not: null } },
            data: { deletedAt: null },
          });
        } catch (e) {
          if ((e as { code?: string })?.code === 'P2025') {
            throw new ConcurrentModificationError(id);
          }
          throw e;
        }
        await this.audit.logBulkItem(
          {
            bulkOperationId,
            userId: input.actorId,
            action: 'CASE_RESTORED',
            subject: 'Case',
            subjectId: id,
            metadata: { reason: input.reason },
            ipAddress: input.meta?.ipAddress,
            userAgent: input.meta?.userAgent,
          },
          tx,
        );
        return { caseId: id };
      },
    });

    const reclassified: BulkResult<{ caseId: string }> = {
      succeeded: result.succeeded,
      skipped: [
        ...result.skipped,
        ...result.failed
          .filter((f) => f.error.startsWith(CONCURRENT_PREFIX))
          .map<BulkSkippedItem>((f) => ({
            id: f.id,
            reason: 'CONCURRENT_MODIFICATION',
            message: 'Vụ án đã được khôi phục bởi người khác',
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

// Marker error cho optimistic-lock conflict. runBulk catch generic Error → message
// dùng để classify CONCURRENT_MODIFICATION ở post-loop reclassify (step 4).
const CONCURRENT_PREFIX = '__CONCURRENT_MODIFICATION__:';
class ConcurrentModificationError extends Error {
  constructor(id: string) {
    super(`${CONCURRENT_PREFIX}${id}`);
    this.name = 'ConcurrentModificationError';
  }
}
