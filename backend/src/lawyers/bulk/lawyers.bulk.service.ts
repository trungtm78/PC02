import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import type { DataScope } from '../../auth/services/unit-scope.service';
import { buildScopeFilter } from '../../common/utils/scope-filter.util';
import { runBulk } from '../../common/bulk/run-bulk';
import type { BulkResult, BulkSkippedItem } from '../../common/bulk/run-bulk';

export interface BulkExportLawyersInput {
  ids: string[];
  dataScope: DataScope | null | undefined;
  res: Response;
  actorId: string;
  meta?: { ipAddress?: string; userAgent?: string };
}

export interface BulkDeleteLawyersInput {
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
 * v0.51 — Lawyers bulk-delete service.
 * Scope check: thực hiện qua parent case (assertParentInScope pattern ở
 * lawyers.service.ts:285). Preflight load lawyer + case relation để filter
 * scope cho mỗi item.
 */
@Injectable()
export class LawyersBulkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async bulkDelete(
    input: BulkDeleteLawyersInput,
  ): Promise<BulkResult<{ lawyerId: string }>> {
    if (input.ids.length === 0)
      throw new BadRequestException('Cần ít nhất 1 luật sư để xóa');
    if (input.ids.length > 100)
      throw new BadRequestException('Tối đa 100 luật sư mỗi đợt');

    const { bulkOperationId } = await this.audit.logBulkHeader({
      actorId: input.actorId,
      resource: 'Lawyer',
      action: 'BULK_DELETE',
      idempotencyKey: input.idempotencyKey,
    });

    const result = await runBulk<{ lawyerId: string }, Prisma.TransactionClient>({
      ids: input.ids,
      prisma: this.prisma as unknown as {
        $transaction: <R>(cb: (tx: Prisma.TransactionClient) => Promise<R>) => Promise<R>;
      },
      preflight: async (ids) => {
        // Scope check qua parent case (assertParentInScope pattern).
        // Xoá là thao tác ghi: dùng writableTeamIds, không phải teamIds đọc.
        const scopeFilter = buildScopeFilter(input.dataScope, 'write');
        const inScope = await this.prisma.lawyer.findMany({
          where: {
            id: { in: ids },
            deletedAt: null,
            ...(scopeFilter ? { case: scopeFilter as Prisma.CaseWhereInput } : {}),
          },
          select: { id: true },
        });
        const inScopeSet = new Set(inScope.map((l) => l.id));
        const skipped: BulkSkippedItem[] = ids
          .filter((id) => !inScopeSet.has(id))
          .map((id) => ({ id, reason: 'PERMISSION' as const }));
        return { validIds: ids.filter((id) => inScopeSet.has(id)), skipped };
      },
      executeOne: async (id, tx) => {
        try {
          await tx.lawyer.update({
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
            action: 'LAWYER_DELETED',
            subject: 'Lawyer',
            subjectId: id,
            metadata: { reason: input.reason, softDelete: true },
            ipAddress: input.meta?.ipAddress,
            userAgent: input.meta?.userAgent,
          },
          tx,
        );
        return { lawyerId: id };
      },
    });

    const reclassified: BulkResult<{ lawyerId: string }> = {
      succeeded: result.succeeded,
      skipped: [
        ...result.skipped,
        ...result.failed
          .filter((f) => f.error.startsWith(CONCURRENT_PREFIX))
          .map<BulkSkippedItem>((f) => ({
            id: f.id,
            reason: 'CONCURRENT_MODIFICATION',
            message: 'Luật sư đã được xóa bởi người khác',
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
   * F5 — Bulk-export N lawyers ra xlsx stream.
   * Read-only → no per-item tx. Scope filter qua parent case.
   * Audit LAWYER_BULK_EXPORTED (PII bulk leak trail).
   */
  async bulkExport(input: BulkExportLawyersInput): Promise<void> {
    if (input.ids.length === 0) {
      throw new BadRequestException('Cần ít nhất 1 luật sư để xuất Excel');
    }
    if (input.ids.length > 1000) {
      throw new BadRequestException(
        'Tối đa 1000 luật sư mỗi lần xuất (chia thành nhiều đợt nếu nhiều hơn)',
      );
    }

    await this.audit.log({
      userId: input.actorId,
      action: 'LAWYER_BULK_EXPORTED',
      subject: 'Lawyer',
      metadata: { idsRequested: input.ids.length, format: 'xlsx' },
      ipAddress: input.meta?.ipAddress,
      userAgent: input.meta?.userAgent,
    });

    const where: Prisma.LawyerWhereInput = {
      id: { in: input.ids },
      deletedAt: null,
    };
    const scopeFilter = buildScopeFilter(input.dataScope);
    if (scopeFilter) {
      where.case = scopeFilter as Prisma.CaseWhereInput;
    }

    const records = await this.prisma.lawyer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        barNumber: true,
        lawFirm: true,
        phone: true,
        createdAt: true,
        case: { select: { caseCode: true, name: true } },
        subject: { select: { fullName: true } },
      },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Luật sư');
    sheet.columns = [
      { header: 'STT', key: 'stt', width: 6 },
      { header: 'Họ tên', key: 'fullName', width: 28 },
      { header: 'Số thẻ luật sư', key: 'barNumber', width: 18 },
      { header: 'Văn phòng', key: 'lawFirm', width: 28 },
      { header: 'SĐT', key: 'phone', width: 14 },
      { header: 'Mã vụ án', key: 'caseCode', width: 18 },
      { header: 'Tên vụ án', key: 'caseName', width: 32 },
      { header: 'Bị can / Thân chủ', key: 'subjectName', width: 24 },
      { header: 'Ngày tạo', key: 'createdAt', width: 16 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8F0FE' },
    };

    records.forEach((rec, idx) => {
      sheet.addRow({
        stt: idx + 1,
        fullName: rec.fullName,
        barNumber: rec.barNumber,
        lawFirm: rec.lawFirm ?? '',
        phone: rec.phone ?? '',
        caseCode: rec.case?.caseCode ?? '',
        caseName: rec.case?.name ?? '',
        subjectName: rec.subject?.fullName ?? '',
        createdAt: rec.createdAt.toISOString().slice(0, 10),
      });
    });

    const filename = `LuatSu_${new Date().toISOString().slice(0, 10)}.xlsx`;
    input.res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    input.res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`,
    );
    await workbook.xlsx.write(input.res);
    input.res.end();
  }
}
