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

export interface BulkDeleteSubjectsInput {
  ids: string[];
  reason: string;
  actorId: string;
  idempotencyKey?: string;
  dataScope: DataScope | null | undefined;
  meta?: { ipAddress?: string; userAgent?: string };
}

export interface BulkExportSubjectsInput {
  ids: string[];
  dataScope: DataScope | null | undefined;
  res: Response;
  actorId: string;
  meta?: { ipAddress?: string; userAgent?: string };
}

// Subject type label map for Excel output
const SUBJECT_TYPE_LABEL: Record<string, string> = {
  SUSPECT: 'Bị can',
  VICTIM: 'Bị hại',
  WITNESS: 'Nhân chứng',
};

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

  /**
   * F5 — Bulk-export N subjects ra xlsx stream (polymorphic SUSPECT/VICTIM/WITNESS).
   * Type column preserved trong xlsx.
   */
  async bulkExport(input: BulkExportSubjectsInput): Promise<void> {
    if (input.ids.length === 0) {
      throw new BadRequestException('Cần ít nhất 1 đối tượng để xuất Excel');
    }
    if (input.ids.length > 1000) {
      throw new BadRequestException(
        'Tối đa 1000 đối tượng mỗi lần xuất (chia thành nhiều đợt nếu nhiều hơn)',
      );
    }

    await this.audit.log({
      userId: input.actorId,
      action: 'SUBJECT_BULK_EXPORTED',
      subject: 'Subject',
      metadata: { idsRequested: input.ids.length, format: 'xlsx' },
      ipAddress: input.meta?.ipAddress,
      userAgent: input.meta?.userAgent,
    });

    const where: Prisma.SubjectWhereInput = {
      id: { in: input.ids },
      deletedAt: null,
    };
    const scopeFilter = buildScopeFilter(input.dataScope);
    if (scopeFilter) {
      where.case = scopeFilter as Prisma.CaseWhereInput;
    }

    const records = await this.prisma.subject.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        type: true,
        status: true,
        idNumber: true,
        dateOfBirth: true,
        gender: true,
        phone: true,
        address: true,
        createdAt: true,
        case: { select: { caseCode: true, name: true } },
      },
    });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Đối tượng');
    sheet.columns = [
      { header: 'STT', key: 'stt', width: 6 },
      { header: 'Họ tên', key: 'fullName', width: 28 },
      { header: 'Loại', key: 'type', width: 12 },
      { header: 'Trạng thái', key: 'status', width: 18 },
      { header: 'CCCD', key: 'idNumber', width: 16 },
      { header: 'Ngày sinh', key: 'dateOfBirth', width: 14 },
      { header: 'Giới tính', key: 'gender', width: 10 },
      { header: 'SĐT', key: 'phone', width: 14 },
      { header: 'Địa chỉ', key: 'address', width: 32 },
      { header: 'Mã vụ án', key: 'caseCode', width: 18 },
      { header: 'Tên vụ án', key: 'caseName', width: 32 },
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
        type: SUBJECT_TYPE_LABEL[rec.type] ?? rec.type,
        status: rec.status,
        idNumber: rec.idNumber ?? '',
        dateOfBirth: rec.dateOfBirth ? rec.dateOfBirth.toISOString().slice(0, 10) : '',
        gender: rec.gender,
        phone: rec.phone ?? '',
        address: rec.address ?? '',
        caseCode: rec.case?.caseCode ?? '',
        caseName: rec.case?.name ?? '',
        createdAt: rec.createdAt.toISOString().slice(0, 10),
      });
    });

    const filename = `DoiTuong_${new Date().toISOString().slice(0, 10)}.xlsx`;
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
