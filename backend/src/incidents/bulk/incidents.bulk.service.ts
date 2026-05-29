import { BadRequestException, Injectable } from '@nestjs/common';
import type { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { IncidentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import type { DataScope } from '../../auth/services/unit-scope.service';
import { buildScopeFilter } from '../../common/utils/scope-filter.util';
import { BcaExcelHelper } from '../../common/bca-excel.helper';
import { INCIDENT_STATUS_LABEL } from '../../common/constants/status-labels.constants';
import { TERMINAL_STATUSES } from '../incidents.constants';
import { runBulk } from '../../common/bulk/run-bulk';
import type { BulkResult, BulkSkippedItem } from '../../common/bulk/run-bulk';

export interface BulkAssignIncidentsInput {
  ids: string[];
  /** Incidents: either assignedTeamId hoặc investigatorId (cả 2 optional). Ít nhất 1 phải có. */
  assignedTeamId?: string;
  investigatorId?: string;
  reason?: string;
  idempotencyKey?: string;
  expectedUpdatedAtByIncidentId?: Record<string, Date>;
  actorId: string;
  dataScope: DataScope | null | undefined;
  meta?: { ipAddress?: string; userAgent?: string };
}

export interface BulkExportIncidentsInput {
  ids: string[];
  dataScope: DataScope | null | undefined;
  res: Response;
  actorId: string;
  meta?: { ipAddress?: string; userAgent?: string };
}

const CONCURRENT_PREFIX = '__CONCURRENT_MODIFICATION__:';
class ConcurrentModificationError extends Error {
  constructor(id: string) {
    super(`${CONCURRENT_PREFIX}${id}`);
    this.name = 'ConcurrentModificationError';
  }
}

/**
 * v0.48 PR1 B4 — Incidents bulk service (bulkAssign + bulkExport).
 * Mirror CasesBulkService pattern: pre-validate ONCE, runBulk per-item tx,
 * audit inside tx, scope filter via preflight.
 */
@Injectable()
export class IncidentsBulkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async bulkAssign(
    input: BulkAssignIncidentsInput,
  ): Promise<BulkResult<{ incidentId: string }>> {
    if (!input.assignedTeamId && !input.investigatorId) {
      throw new BadRequestException(
        'Phải chỉ định ít nhất tổ điều tra hoặc điều tra viên',
      );
    }
    // Pre-validate investigator active + on team (nếu cả hai có).
    if (input.investigatorId) {
      const investigator = await this.prisma.user.findFirst({
        where: { id: input.investigatorId, isActive: true },
      });
      if (!investigator) {
        throw new BadRequestException('Điều tra viên không tồn tại hoặc đã ngừng hoạt động');
      }
      if (input.assignedTeamId) {
        const member = await this.prisma.userTeam.findFirst({
          where: { userId: input.investigatorId, teamId: input.assignedTeamId },
        });
        if (!member) {
          throw new BadRequestException('Điều tra viên không thuộc tổ được chỉ định');
        }
      }
    }

    const { bulkOperationId } = await this.audit.logBulkHeader({
      actorId: input.actorId,
      resource: 'Incident',
      action: 'BULK_ASSIGN',
      idempotencyKey: input.idempotencyKey,
    });

    const result = await runBulk<{ incidentId: string }, Prisma.TransactionClient>({
      ids: input.ids,
      prisma: this.prisma as unknown as {
        $transaction: <R>(cb: (tx: Prisma.TransactionClient) => Promise<R>) => Promise<R>;
      },
      preflight: async (ids) => {
        // Codex post-deploy P2: preflight phải lấy status để skip TERMINAL_STATUSES
        // (match assignInvestigator invariant — không phân công cho vụ việc đã kết thúc).
        const inScope = await this.prisma.incident.findMany({
          where: {
            id: { in: ids },
            deletedAt: null,
            ...buildScopeFilter(input.dataScope),
          },
          select: { id: true, status: true },
        });
        const inScopeMap = new Map(inScope.map((c) => [c.id, c.status]));
        const skipped: BulkSkippedItem[] = [];
        const validIds: string[] = [];
        for (const id of ids) {
          const status = inScopeMap.get(id);
          if (status === undefined) {
            skipped.push({ id, reason: 'PERMISSION' });
            continue;
          }
          if (TERMINAL_STATUSES.includes(status)) {
            skipped.push({
              id,
              reason: 'INELIGIBLE',
              message: 'Không thể phân công điều tra viên cho vụ việc đã kết thúc',
            });
            continue;
          }
          validIds.push(id);
        }
        return { validIds, skipped };
      },
      executeOne: async (id, tx) => {
        const expectedAt = input.expectedUpdatedAtByIncidentId?.[id];
        try {
          await tx.incident.update({
            where: {
              id,
              ...(expectedAt ? { updatedAt: expectedAt } : {}),
            },
            data: {
              ...(input.assignedTeamId ? { assignedTeamId: input.assignedTeamId } : {}),
              ...(input.investigatorId ? { investigatorId: input.investigatorId } : {}),
              // Codex post-deploy P2: khi assign investigator → transition DANG_XAC_MINH
              // (match single-assign invariant ở incidents.service.ts:1127).
              ...(input.investigatorId ? { status: IncidentStatus.DANG_XAC_MINH } : {}),
            },
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
            action: 'INCIDENT_ASSIGNED',
            subject: 'Incident',
            subjectId: id,
            metadata: {
              toTeamId: input.assignedTeamId ?? null,
              toInvestigatorId: input.investigatorId ?? null,
              reason: input.reason,
            },
            ipAddress: input.meta?.ipAddress,
            userAgent: input.meta?.userAgent,
          },
          tx,
        );
        return { incidentId: id };
      },
    });

    const reclassified: BulkResult<{ incidentId: string }> = {
      succeeded: result.succeeded,
      skipped: [
        ...result.skipped,
        ...result.failed
          .filter((f) => f.error.startsWith(CONCURRENT_PREFIX))
          .map<BulkSkippedItem>((f) => ({
            id: f.id,
            reason: 'CONCURRENT_MODIFICATION',
            message: 'Vụ việc đã được chỉnh sửa bởi người khác',
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

  async bulkExport(input: BulkExportIncidentsInput): Promise<void> {
    if (input.ids.length === 0) {
      throw new BadRequestException('Cần ít nhất 1 vụ việc để xuất Excel');
    }
    if (input.ids.length > 1000) {
      throw new BadRequestException('Tối đa 1000 vụ việc mỗi lần xuất');
    }

    await this.audit.log({
      userId: input.actorId,
      action: 'INCIDENT_BULK_EXPORTED',
      subject: 'Incident',
      metadata: { idsRequested: input.ids.length, format: 'xlsx' },
      ipAddress: input.meta?.ipAddress,
      userAgent: input.meta?.userAgent,
    });

    const where: Prisma.IncidentWhereInput = {
      id: { in: input.ids },
      deletedAt: null,
    };
    const scopeFilter = buildScopeFilter(input.dataScope);
    if (scopeFilter) {
      where.AND = [scopeFilter as Prisma.IncidentWhereInput];
    }

    const records = await this.prisma.incident.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        code: true,
        name: true,
        incidentType: true,
        unitId: true,
        createdAt: true,
        status: true,
        investigator: { select: { firstName: true, lastName: true } },
      },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Vụ việc');
    const COL_COUNT = 8;
    const HEADERS = [
      'STT',
      'Mã vụ việc',
      'Tên vụ việc',
      'Loại vụ việc',
      'Đơn vị thụ lý',
      'ĐTV phụ trách',
      'Ngày tiếp nhận',
      'Trạng thái',
    ];
    const WIDTHS = [6, 18, 30, 20, 20, 20, 16, 20];

    BcaExcelHelper.addHeader(
      sheet,
      COL_COUNT,
      'DANH SÁCH VỤ VIỆC ĐÃ CHỌN',
      `Xuất theo lựa chọn (${records.length} bản ghi)`,
    );
    const headerRow = sheet.getRow(7);
    BcaExcelHelper.addColumnHeaders(headerRow, HEADERS, WIDTHS);

    records.forEach((rec, idx) => {
      const investigatorName = rec.investigator
        ? `${rec.investigator.firstName ?? ''} ${rec.investigator.lastName ?? ''}`.trim()
        : '';
      const dataRow = sheet.addRow([
        idx + 1,
        rec.code ?? rec.id,
        rec.name ?? '',
        rec.incidentType ?? '',
        rec.unitId ?? '',
        investigatorName,
        rec.createdAt ? rec.createdAt.toLocaleDateString('vi-VN') : '',
        INCIDENT_STATUS_LABEL[rec.status as IncidentStatus] ?? rec.status ?? '',
      ]);
      BcaExcelHelper.styleDataRow(dataRow, idx % 2 === 1, COL_COUNT);
    });

    const lastDataRow = sheet.lastRow?.number ?? 7;
    BcaExcelHelper.addFooter(sheet, lastDataRow + 2, COL_COUNT);
    BcaExcelHelper.setPrintSetup(sheet);

    const filename = `VuViec_DaChon_${new Date().toISOString().slice(0, 10)}.xlsx`;
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

  /**
   * v0.50 PR3 — Bulk soft-delete Incidents. Mirror Cases pattern.
   *
   * Preflight per-item (match previewDelete invariants ở incidents.service.ts:681):
   * - status TIEP_NHAN only → khác → INELIGIBLE skip
   * - 0 linked petitions → có → INELIGIBLE
   * - 0 linked documents → có → INELIGIBLE
   * - dataScope filter → out-of-scope = PERMISSION skip
   */
  async bulkDelete(input: BulkDeleteIncidentsInput): Promise<BulkResult<{ incidentId: string }>> {
    if (input.ids.length === 0) throw new BadRequestException('Cần ít nhất 1 vụ việc để xóa');
    if (input.ids.length > 100) throw new BadRequestException('Tối đa 100 vụ việc mỗi đợt');

    const { bulkOperationId } = await this.audit.logBulkHeader({
      actorId: input.actorId,
      resource: 'Incident',
      action: 'BULK_DELETE',
      idempotencyKey: input.idempotencyKey,
    });

    const result = await runBulk<{ incidentId: string }, Prisma.TransactionClient>({
      ids: input.ids,
      prisma: this.prisma as unknown as {
        $transaction: <R>(cb: (tx: Prisma.TransactionClient) => Promise<R>) => Promise<R>;
      },
      preflight: async (ids) => {
        const inScope = await this.prisma.incident.findMany({
          where: {
            id: { in: ids },
            deletedAt: null,
            ...buildScopeFilter(input.dataScope),
          },
          include: {
            petitions: { where: { deletedAt: null }, select: { id: true } },
            documents: { where: { deletedAt: null }, select: { id: true } },
          },
        });
        const inScopeMap = new Map(inScope.map((i) => [i.id, i]));
        const skipped: BulkSkippedItem[] = [];
        const validIds: string[] = [];
        for (const id of ids) {
          const inc = inScopeMap.get(id);
          if (!inc) {
            skipped.push({ id, reason: 'PERMISSION' });
            continue;
          }
          if (inc.status !== IncidentStatus.TIEP_NHAN) {
            skipped.push({
              id,
              reason: 'INELIGIBLE',
              message: 'Chỉ xóa được vụ việc ở trạng thái Tiếp nhận',
            });
            continue;
          }
          if (inc.petitions.length > 0) {
            skipped.push({
              id,
              reason: 'INELIGIBLE',
              message: `Có ${inc.petitions.length} đơn thư đang liên kết`,
            });
            continue;
          }
          if (inc.documents.length > 0) {
            skipped.push({
              id,
              reason: 'INELIGIBLE',
              message: `Có ${inc.documents.length} tài liệu đính kèm`,
            });
            continue;
          }
          validIds.push(id);
        }
        return { validIds, skipped };
      },
      executeOne: async (id, tx) => {
        try {
          await tx.incident.update({
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
            action: 'INCIDENT_DELETED',
            subject: 'Incident',
            subjectId: id,
            metadata: { reason: input.reason },
            ipAddress: input.meta?.ipAddress,
            userAgent: input.meta?.userAgent,
          },
          tx,
        );
        return { incidentId: id };
      },
    });

    const reclassified = reclassifyConcurrent(result, 'Vụ việc đã được xóa bởi người khác');
    await this.audit.completeBulk(bulkOperationId, {
      succeeded: reclassified.succeeded.length,
      skipped: reclassified.skipped.length,
      failed: reclassified.failed.length,
    });
    return reclassified;
  }

  /**
   * v0.50 PR3 — Bulk restore Incidents (admin-only at controller layer).
   */
  async bulkRestore(input: BulkRestoreIncidentsInput): Promise<BulkResult<{ incidentId: string }>> {
    if (input.ids.length === 0) throw new BadRequestException('Cần ít nhất 1 vụ việc để khôi phục');
    if (input.ids.length > 100) throw new BadRequestException('Tối đa 100 vụ việc mỗi đợt');

    const { bulkOperationId } = await this.audit.logBulkHeader({
      actorId: input.actorId,
      resource: 'Incident',
      action: 'BULK_RESTORE',
      idempotencyKey: input.idempotencyKey,
    });

    const result = await runBulk<{ incidentId: string }, Prisma.TransactionClient>({
      ids: input.ids,
      prisma: this.prisma as unknown as {
        $transaction: <R>(cb: (tx: Prisma.TransactionClient) => Promise<R>) => Promise<R>;
      },
      preflight: async (ids) => {
        const deleted = await this.prisma.incident.findMany({
          where: { id: { in: ids }, deletedAt: { not: null } },
          select: { id: true },
        });
        const deletedSet = new Set(deleted.map((c) => c.id));
        const skipped: BulkSkippedItem[] = ids
          .filter((id) => !deletedSet.has(id))
          .map((id) => ({
            id,
            reason: 'NOT_FOUND' as const,
            message: 'Vụ việc không tồn tại hoặc chưa bị xóa',
          }));
        return { validIds: ids.filter((id) => deletedSet.has(id)), skipped };
      },
      executeOne: async (id, tx) => {
        try {
          await tx.incident.update({
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
            action: 'INCIDENT_RESTORED',
            subject: 'Incident',
            subjectId: id,
            metadata: { reason: input.reason },
            ipAddress: input.meta?.ipAddress,
            userAgent: input.meta?.userAgent,
          },
          tx,
        );
        return { incidentId: id };
      },
    });

    const reclassified = reclassifyConcurrent(result, 'Vụ việc đã được khôi phục bởi người khác');
    await this.audit.completeBulk(bulkOperationId, {
      succeeded: reclassified.succeeded.length,
      skipped: reclassified.skipped.length,
      failed: reclassified.failed.length,
    });
    return reclassified;
  }
}

export interface BulkDeleteIncidentsInput {
  ids: string[];
  reason: string;
  actorId: string;
  idempotencyKey?: string;
  dataScope: DataScope | null | undefined;
  meta?: { ipAddress?: string; userAgent?: string };
}

export interface BulkRestoreIncidentsInput {
  ids: string[];
  reason: string;
  actorId: string;
  idempotencyKey?: string;
  meta?: { ipAddress?: string; userAgent?: string };
}

function reclassifyConcurrent<T>(
  result: BulkResult<T>,
  message: string,
): BulkResult<T> {
  return {
    succeeded: result.succeeded,
    skipped: [
      ...result.skipped,
      ...result.failed
        .filter((f) => f.error.startsWith(CONCURRENT_PREFIX))
        .map<BulkSkippedItem>((f) => ({
          id: f.id,
          reason: 'CONCURRENT_MODIFICATION',
          message,
        })),
    ],
    failed: result.failed.filter((f) => !f.error.startsWith(CONCURRENT_PREFIX)),
  };
}
