import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { computeSha256 } from '../../xlsx-imports/hostile-xlsx-guard';
import { ReportConfigError, ReportConfigService } from './report-config.service';
import type { SaveReportVersionDto } from './dto/save-report-version.dto';
import type { ParseTemplateResult } from '../template/types';

const PARSER_VERSION = 'pr3-v1';
const ENGINE_VERSION = 'pr1-v1';
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const ACTION = 'create_report_version';

export interface CreateVersionResult {
  reportId: string;
  versionId: string;
  version: number;
  status: 'DRAFT' | 'PUBLISHED';
  /** Open periods that moved to the new version at once (D09: nobody had entered anything there). */
  appliedToPeriods: string[];
  /** Open periods that stay on the version their teams already typed into; the new one applies from the next period. */
  keptOnOldVersionPeriods: string[];
}

/**
 * "Cập nhật mẫu": a published version is immutable, so editing the template means a NEW version.
 *
 * D09 decides where it applies. A period still open in which no team has entered anything moves to the new
 * version immediately (nobody has anything to lose); a period in which someone has typed keeps the version its
 * figures were entered against, and the new one starts with the next period the scheduler generates. Closed
 * periods are never touched.
 */
@Injectable()
export class ReportVersioningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ReportConfigService,
  ) {}

  private requestHash(input: SaveReportVersionDto, reportId: string, fileBuffer: Buffer): string {
    const { idempotencyKey: _ignored, ...rest } = input;
    void _ignored;
    const hash = createHash('sha256');
    hash.update(reportId);
    hash.update(JSON.stringify(rest));
    hash.update(fileBuffer);
    return hash.digest('hex');
  }

  async createVersion(
    reportId: string,
    input: SaveReportVersionDto,
    fileBuffer: Buffer,
    fileName: string,
    actorId: string,
  ): Promise<CreateVersionResult> {
    const requestHash = this.requestHash(input, reportId, fileBuffer);
    const key = { actorId_action_key: { actorId, action: ACTION, key: input.idempotencyKey } };
    const existing = await this.prisma.dynReportIdempotency.findUnique({ where: key });
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new ReportConfigError('Mã idempotency đã dùng cho một yêu cầu khác.', 'IDEMPOTENCY_MISMATCH');
      }
      if (existing.resultRef) return JSON.parse(existing.resultRef) as CreateVersionResult;
    }

    const report = await this.prisma.dynReport.findUnique({ where: { id: reportId } });
    if (!report) throw new ReportConfigError('Không tìm thấy báo cáo này.', 'REPORT_NOT_FOUND');
    if (report.status === 'ARCHIVED') {
      throw new ReportConfigError('Báo cáo đã lưu trữ — hãy khôi phục trước khi cập nhật mẫu.', 'INVALID_STATE');
    }

    let derived: ParseTemplateResult | null = null;
    if (input.publish) {
      if (input.fields.length === 0) {
        throw new ReportConfigError('Phải có ít nhất một ô nhập trước khi xuất bản.', 'TEMPLATE_INVALID');
      }
      await this.configService.assertNoBlockingFeatureIssues(fileBuffer);
      derived = await this.configService.reconcileWithFile(input, fileBuffer);
    } else if (input.fields.length === 0 && input.selectedSheets.length === 0) {
      throw new ReportConfigError('Phải chọn ít nhất một sheet trước khi lưu nháp.', 'TEMPLATE_INVALID');
    }

    const sha256 = computeSha256(fileBuffer);
    const now = new Date();

    return this.prisma.$transaction(async (tx) => {
      // Serialize with the scheduler, another save and a delete: the report row is the one thing they all touch.
      await tx.$queryRaw`SELECT id FROM dyn_reports WHERE id = ${reportId} FOR UPDATE`;
      const locked = await tx.dynReport.findUnique({ where: { id: reportId } });
      if (!locked) throw new ReportConfigError('Không tìm thấy báo cáo này.', 'REPORT_NOT_FOUND');
      if (locked.status === 'ARCHIVED') {
        throw new ReportConfigError('Báo cáo đã lưu trữ — hãy khôi phục trước khi cập nhật mẫu.', 'INVALID_STATE');
      }
      if (input.publish && locked.status === 'DRAFT') {
        await this.assertReadyToPublish(tx, reportId);
      }

      const last = await tx.dynReportVersion.aggregate({ where: { reportId }, _max: { version: true } });
      const versionNo = (last._max.version ?? 0) + 1;
      const version = await tx.dynReportVersion.create({
        data: {
          reportId,
          version: versionNo,
          status: input.publish ? 'PUBLISHED' : 'DRAFT',
          fileBytes: fileBuffer as unknown as Uint8Array<ArrayBuffer>,
          sha256,
          fileName,
          selectedSheets: input.selectedSheets as Prisma.InputJsonValue,
          layout: {
            layout: derived ? derived.layout : input.layout,
            formulas: derived ? derived.formulas : input.formulas,
          } as Prisma.InputJsonValue,
          dateSystem: input.dateSystem,
          parserVersion: PARSER_VERSION,
          engineVersion: ENGINE_VERSION,
          publishedAt: input.publish ? now : null,
          createdById: actorId,
        },
      });
      await this.configService.persistFields(tx, version.id, input.fields, derived);
      await this.configService.persistRules(tx, version.id, input.rules);

      let appliedToPeriods: string[] = [];
      let keptOnOldVersionPeriods: string[] = [];
      if (input.publish) {
        await tx.dynReportVersion.updateMany({
          where: { reportId, status: 'PUBLISHED', id: { not: version.id } },
          data: { status: 'RETIRED' },
        });
        ({ applied: appliedToPeriods, kept: keptOnOldVersionPeriods } = await this.applyToOpenPeriods(
          tx,
          reportId,
          version.id,
        ));
        await tx.dynReport.update({
          where: { id: reportId },
          data: {
            configVersion: { increment: 1 },
            ...(locked.status === 'DRAFT' ? { status: 'PUBLISHED' as const } : {}),
          },
        });
      }

      const payload: CreateVersionResult = {
        reportId,
        versionId: version.id,
        version: versionNo,
        status: input.publish ? 'PUBLISHED' : 'DRAFT',
        appliedToPeriods,
        keptOnOldVersionPeriods,
      };
      await tx.dynReportIdempotency.upsert({
        where: key,
        create: {
          actorId,
          action: ACTION,
          key: input.idempotencyKey,
          requestHash,
          resultRef: JSON.stringify(payload),
          status: 'COMPLETED',
          expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
        },
        update: { resultRef: JSON.stringify(payload), status: 'COMPLETED' },
      });
      return payload;
    });
  }

  /** A draft report becomes live with its first published version: what the first publish would have required must hold. */
  private async assertReadyToPublish(tx: Prisma.TransactionClient, reportId: string): Promise<void> {
    const [schedule, managers, targets] = await Promise.all([
      tx.dynReportSchedule.count({ where: { reportId, supersededAt: null } }),
      tx.dynReportRole.count({ where: { reportId, role: 'MANAGER', validTo: null } }),
      tx.dynReportTarget.findMany({
        where: { reportId, validTo: null },
        include: { editors: { where: { validTo: null } } },
      }),
    ]);
    if (schedule === 0) {
      throw new ReportConfigError('Báo cáo nháp chưa có lịch — hãy đặt lịch trước khi xuất bản.', 'TEMPLATE_INVALID');
    }
    if (managers === 0) {
      throw new ReportConfigError('Phải có ít nhất một quản lý trước khi xuất bản.', 'TEMPLATE_INVALID');
    }
    if (targets.length === 0 || targets.some((t) => t.editors.length === 0)) {
      throw new ReportConfigError('Phải có ít nhất một tổ, và mỗi tổ có người nhập, trước khi xuất bản.', 'TEMPLATE_INVALID');
    }
  }

  /** D09: move every open period nobody has entered anything in to the new version; leave the others where they are. */
  private async applyToOpenPeriods(
    tx: Prisma.TransactionClient,
    reportId: string,
    newVersionId: string,
  ): Promise<{ applied: string[]; kept: string[] }> {
    const open = await tx.dynReportPeriod.findMany({
      where: { reportId, status: 'OPEN', versionId: { not: newVersionId } },
      select: { id: true, periodKey: true },
      orderBy: { startDate: 'asc' },
    });
    const applied: string[] = [];
    const kept: string[] = [];
    for (const period of open) {
      const touched = await tx.dynReportSubmission.count({
        where: {
          assignment: { periodId: period.id },
          OR: [{ state: { not: 'NOT_STARTED' } }, { currentRevision: { gt: 0 } }],
        },
      });
      if (touched > 0) {
        kept.push(period.periodKey);
        continue;
      }
      await tx.dynReportPeriod.update({ where: { id: period.id }, data: { versionId: newVersionId } });
      // Whatever was summed on the old template no longer describes this period.
      await tx.dynReportSnapshot.updateMany({
        where: { periodId: period.id, invalidatedAt: null },
        data: { invalidatedAt: new Date(), invalidatedReason: 'TEMPLATE_VERSION_CHANGED' },
      });
      applied.push(period.periodKey);
    }
    return { applied, kept };
  }

  /**
   * Removes a version nobody depends on: a draft, or a retired version no period was ever generated from.
   * The version a report currently runs on, and any version a period points at, stay.
   */
  async deleteVersion(reportId: string, versionId: string): Promise<{ deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM dyn_reports WHERE id = ${reportId} FOR UPDATE`;
      const version = await tx.dynReportVersion.findFirst({ where: { id: versionId, reportId } });
      if (!version) throw new ReportConfigError('Không tìm thấy phiên bản này.', 'REPORT_NOT_FOUND');
      if (version.status === 'PUBLISHED') {
        throw new ReportConfigError(
          'Không xoá được phiên bản đang áp dụng. Hãy tạo phiên bản mới thay thế, hoặc lưu trữ/xoá cả báo cáo.',
          'VERSION_CURRENT',
        );
      }
      const used = await tx.dynReportPeriod.count({ where: { versionId } });
      if (used > 0) {
        throw new ReportConfigError(
          `Phiên bản này đang được ${used} kỳ báo cáo dùng nên không xoá được.`,
          'VERSION_IN_USE',
        );
      }
      await tx.dynReportVersion.delete({ where: { id: versionId } });
      return { deleted: true as const };
    });
  }
}
