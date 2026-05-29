import { BadRequestException, Injectable } from '@nestjs/common';
import type { Response } from 'express';
import * as ExcelJS from 'exceljs';
import { PetitionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../audit/audit.service';
import type { DataScope } from '../../auth/services/unit-scope.service';
import { buildScopeFilter } from '../../common/utils/scope-filter.util';
import { BcaExcelHelper } from '../../common/bca-excel.helper';
import { PETITION_STATUS_LABEL } from '../../common/constants/status-labels.constants';
import { runBulk } from '../../common/bulk/run-bulk';
import type { BulkResult, BulkSkippedItem } from '../../common/bulk/run-bulk';

export interface BulkAssignPetitionsInput {
  ids: string[];
  assignedToId: string;
  reason?: string;
  idempotencyKey?: string;
  actorId: string;
  dataScope: DataScope | null | undefined;
  meta?: { ipAddress?: string; userAgent?: string };
}

export interface BulkExportPetitionsInput {
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
  }
}

/**
 * v0.48 PR1 B5 — Petitions bulk service (bulkAssign + bulkExport).
 * Note: Existing batch endpoint POST /petitions/export-document-batch (v0.47 PR3)
 * handles Word docs ZIP. This module adds xlsx export + assign.
 */
@Injectable()
export class PetitionsBulkService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async bulkAssign(
    input: BulkAssignPetitionsInput,
  ): Promise<BulkResult<{ petitionId: string }>> {
    const user = await this.prisma.user.findFirst({
      where: { id: input.assignedToId, isActive: true },
    });
    if (!user) {
      throw new BadRequestException('Người được phân công không tồn tại hoặc đã ngừng hoạt động');
    }

    const { bulkOperationId } = await this.audit.logBulkHeader({
      actorId: input.actorId,
      resource: 'Petition',
      action: 'BULK_ASSIGN',
      idempotencyKey: input.idempotencyKey,
    });

    const result = await runBulk<{ petitionId: string }, Prisma.TransactionClient>({
      ids: input.ids,
      prisma: this.prisma as unknown as {
        $transaction: <R>(cb: (tx: Prisma.TransactionClient) => Promise<R>) => Promise<R>;
      },
      preflight: async (ids) => {
        const inScope = await this.prisma.petition.findMany({
          where: {
            id: { in: ids },
            deletedAt: null,
            ...buildScopeFilter(input.dataScope),
          },
          select: { id: true },
        });
        const inScopeSet = new Set(inScope.map((p) => p.id));
        const skipped: BulkSkippedItem[] = ids
          .filter((id) => !inScopeSet.has(id))
          .map((id) => ({ id, reason: 'PERMISSION' as const }));
        return { validIds: ids.filter((id) => inScopeSet.has(id)), skipped };
      },
      executeOne: async (id, tx) => {
        try {
          await tx.petition.update({
            where: { id },
            data: { assignedToId: input.assignedToId },
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
            action: 'PETITION_ASSIGNED',
            subject: 'Petition',
            subjectId: id,
            metadata: { toUserId: input.assignedToId, reason: input.reason },
            ipAddress: input.meta?.ipAddress,
            userAgent: input.meta?.userAgent,
          },
          tx,
        );
        return { petitionId: id };
      },
    });

    const reclassified: BulkResult<{ petitionId: string }> = {
      succeeded: result.succeeded,
      skipped: [
        ...result.skipped,
        ...result.failed
          .filter((f) => f.error.startsWith(CONCURRENT_PREFIX))
          .map<BulkSkippedItem>((f) => ({
            id: f.id,
            reason: 'CONCURRENT_MODIFICATION',
            message: 'Đơn thư đã được chỉnh sửa bởi người khác',
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

  async bulkExport(input: BulkExportPetitionsInput): Promise<void> {
    if (input.ids.length === 0) {
      throw new BadRequestException('Cần ít nhất 1 đơn thư để xuất Excel');
    }
    if (input.ids.length > 1000) {
      throw new BadRequestException('Tối đa 1000 đơn thư mỗi lần xuất');
    }

    await this.audit.log({
      userId: input.actorId,
      action: 'PETITION_BULK_EXPORTED',
      subject: 'Petition',
      metadata: { idsRequested: input.ids.length, format: 'xlsx' },
      ipAddress: input.meta?.ipAddress,
      userAgent: input.meta?.userAgent,
    });

    const where: Prisma.PetitionWhereInput = {
      id: { in: input.ids },
      deletedAt: null,
    };
    const scopeFilter = buildScopeFilter(input.dataScope);
    if (scopeFilter) {
      where.AND = [scopeFilter as Prisma.PetitionWhereInput];
    }

    const records = await this.prisma.petition.findMany({
      where,
      orderBy: { receivedDate: 'desc' },
      select: {
        id: true,
        stt: true,
        senderName: true,
        petitionType: true,
        status: true,
        receivedDate: true,
        unit: true,
        assignedTo: { select: { firstName: true, lastName: true } },
      },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Đơn thư');
    const COL_COUNT = 8;
    const HEADERS = [
      'STT',
      'Số đơn',
      'Người gửi',
      'Loại đơn',
      'Đơn vị',
      'Người phụ trách',
      'Ngày nhận',
      'Trạng thái',
    ];
    const WIDTHS = [6, 18, 25, 20, 18, 22, 14, 20];

    BcaExcelHelper.addHeader(
      sheet,
      COL_COUNT,
      'DANH SÁCH ĐƠN THƯ ĐÃ CHỌN',
      `Xuất theo lựa chọn (${records.length} bản ghi)`,
    );
    BcaExcelHelper.addColumnHeaders(sheet.getRow(7), HEADERS, WIDTHS);

    records.forEach((rec, idx) => {
      const assignedToName = rec.assignedTo
        ? `${rec.assignedTo.firstName ?? ''} ${rec.assignedTo.lastName ?? ''}`.trim()
        : '';
      const dataRow = sheet.addRow([
        idx + 1,
        rec.stt ?? rec.id,
        rec.senderName ?? '',
        rec.petitionType ?? '',
        rec.unit ?? '',
        assignedToName,
        rec.receivedDate ? rec.receivedDate.toLocaleDateString('vi-VN') : '',
        PETITION_STATUS_LABEL[rec.status as PetitionStatus] ?? rec.status ?? '',
      ]);
      BcaExcelHelper.styleDataRow(dataRow, idx % 2 === 1, COL_COUNT);
    });

    const lastDataRow = sheet.lastRow?.number ?? 7;
    BcaExcelHelper.addFooter(sheet, lastDataRow + 2, COL_COUNT);
    BcaExcelHelper.setPrintSetup(sheet);

    const filename = `DonThu_DaChon_${new Date().toISOString().slice(0, 10)}.xlsx`;
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
}
