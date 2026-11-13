import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { computeSha256 } from '../../xlsx-imports/hostile-xlsx-guard';
import { ReportConfigError, ReportConfigService, criteriaGroupsColumn, criteriaGroupsOf } from './report-config.service';
import type { SaveReportVersionDto } from './dto/save-report-version.dto';
import type { ParseTemplateResult } from '../template/types';
import { generatePeriods } from '../engine/period';
import type { ScheduleRule } from '../engine/period';
import { freezeOwnedFieldKeys, itemKeyOf } from '../aggregate/contributors';

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

export interface PublishDraftResult {
  reportId: string;
  versionId: string;
  version: number;
  status: 'PUBLISHED';
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
      // Two overlapping requests with the same key both missed the lookup above; the report lock serialized them,
      // so whoever comes second must look again now, or it creates a second version and undoes the first.
      const again = await tx.dynReportIdempotency.findUnique({ where: key });
      if (again) {
        if (again.requestHash !== requestHash) {
          throw new ReportConfigError('Mã idempotency đã dùng cho một yêu cầu khác.', 'IDEMPOTENCY_MISMATCH');
        }
        if (again.resultRef) return JSON.parse(again.resultRef) as CreateVersionResult;
      }
      if (input.publish && locked.status === 'DRAFT') {
        await this.assertReadyToPublish(tx, reportId);
      }

      // The very same workbook as a version this report already has (the author pressed "use the current file"):
      // what each cell stands for is known, even though nothing in the file itself says it.
      const inherited = await this.inheritCriteriaOfSameFile(tx, reportId, sha256, input);
      input = { ...input, fields: inherited.fields, sourceKind: inherited.sourceKind, criteriaGroups: inherited.criteriaGroups };

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
          sourceKind: input.sourceKind ?? 'TEMPLATE',
          ...criteriaGroupsColumn(input.criteriaGroups),
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

  /**
   * "Xuất bản" a report that was only saved as a draft. A draft is a temporary save: everything the wizard had — the
   * template file, the cells, the schedule, the managers, the teams and their editors — is already stored, so publishing
   * is deciding that it is ready, not entering it again. The same checks as publishing from the wizard run here, against
   * what is stored: the file is re-read and the stored cells must agree with it (OV3), and the stored schedule, managers and
   * teams must be complete.
   *
   * The newest draft version becomes the published one and the report goes live (the scheduler starts making its periods).
   * Any other draft version stays a draft. A draft report has no periods, so there is nothing to move (D09).
   */
  async publishDraft(reportId: string): Promise<PublishDraftResult> {
    const report = await this.prisma.dynReport.findUnique({ where: { id: reportId } });
    if (!report) throw new ReportConfigError('Không tìm thấy báo cáo này.', 'REPORT_NOT_FOUND');
    this.assertIsDraft(report.status);

    const version = await this.prisma.dynReportVersion.findFirst({
      where: { reportId, status: 'DRAFT' },
      orderBy: { version: 'desc' },
    });
    if (!version) {
      throw new ReportConfigError('Báo cáo nháp này chưa có phiên bản mẫu nào để xuất bản.', 'TEMPLATE_INVALID');
    }
    const stored = await this.prisma.dynReportField.findMany({ where: { versionId: version.id }, orderBy: { address: 'asc' } });
    if (stored.length === 0) {
      throw new ReportConfigError('Phải có ít nhất một ô nhập trước khi xuất bản.', 'TEMPLATE_INVALID');
    }
    const selectedSheets = version.selectedSheets as string[];
    const fields = stored.map((f) => ({
      sheetKey: f.sheetKey,
      address: f.address,
      fieldKey: f.fieldKey,
      label: f.label,
      type: f.type,
      format: f.format ?? undefined,
      aggregate: f.aggregate,
      blankPolicy: f.blankPolicy,
      required: f.required,
      scale: f.scale ?? undefined,
      maxLength: f.maxLength ?? undefined,
      helpText: f.helpText ?? undefined,
      source: f.source,
      // What the cell stands for: without these a team's subset would name criteria the published version lacks.
      itemKey: f.itemKey ?? undefined,
      criterionCode: f.criterionCode ?? undefined,
      unit: f.unit ?? undefined,
      parentItemKey: f.parentItemKey ?? undefined,
      origin: f.origin ?? undefined,
    }));

    // The file checks parse the workbook in a worker: done before the transaction so no row lock is held meanwhile.
    const fileBuffer = Buffer.from(version.fileBytes);
    await this.configService.assertNoBlockingFeatureIssues(fileBuffer);
    const derived = await this.configService.reconcileWithFile(
      { selectedSheets, fields } as never,
      fileBuffer,
    );

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM dyn_reports WHERE id = ${reportId} FOR UPDATE`;
      const locked = await tx.dynReport.findUnique({ where: { id: reportId } });
      if (!locked) throw new ReportConfigError('Không tìm thấy báo cáo này.', 'REPORT_NOT_FOUND');
      this.assertIsDraft(locked.status);
      // Anything saved while the file was being read (another edit, a version deleted) invalidates what was checked above.
      // Saving a draft version does not bump configVersion, so a newer draft that landed meanwhile is looked for directly:
      // the one that was checked must still be the newest, or v1 would go live while the newer v2 is left behind.
      const newest = await tx.dynReportVersion.findFirst({
        where: { reportId, status: 'DRAFT' },
        orderBy: { version: 'desc' },
        select: { id: true },
      });
      if (locked.configVersion !== report.configVersion || newest?.id !== version.id) {
        throw new ReportConfigError(
          'Cấu hình báo cáo vừa được thay đổi. Hãy mở lại báo cáo rồi xuất bản.',
          'REVISION_CONFLICT',
        );
      }

      await this.assertReadyToPublish(tx, reportId);
      const schedule = await tx.dynReportSchedule.findFirst({ where: { reportId, supersededAt: null } });
      if (schedule) {
        if (schedule.periodType === 'ONE_TIME' && !schedule.oneTimeDate) {
          throw new ReportConfigError('Loại kỳ "Một lần" phải chọn ngày của kỳ.', 'TEMPLATE_INVALID');
        }
        try {
          generatePeriods(
            {
              periodType: schedule.periodType as ScheduleRule['periodType'],
              periodStartDay: schedule.periodStartDay ?? undefined,
              due: schedule.dueRule as ScheduleRule['due'],
              open: schedule.openRule as ScheduleRule['open'],
              shiftNonWorking: schedule.shiftNonWorking,
              oneTimeDate: schedule.oneTimeDate ?? undefined,
            },
            new Date(),
            1,
          );
        } catch (err) {
          throw new ReportConfigError(
            `Không tính được lịch: ${err instanceof Error ? err.message : String(err)}`,
            'TEMPLATE_INVALID',
          );
        }
      }

      // What a published version stores is what the FILE says (OV3); the cells are written again with the template's own constraints.
      await tx.dynReportField.deleteMany({ where: { versionId: version.id } });
      await this.configService.persistFields(tx, version.id, fields as never, derived);
      await tx.dynReportVersion.update({
        where: { id: version.id },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
          layout: { layout: derived.layout, formulas: derived.formulas } as unknown as Prisma.InputJsonValue,
          parserVersion: PARSER_VERSION,
          engineVersion: ENGINE_VERSION,
        },
      });
      // The schedule starts when the report goes live, not when the draft was saved: otherwise the scheduler, which walks
      // from `effectiveFrom`, would make every period since then at once (a daily report saved three weeks ago: 21 past
      // periods). A start the author deliberately put in the future is kept.
      const goLiveAt = new Date();
      const anchor = (d: Date) => (d.getTime() < goLiveAt.getTime() ? goLiveAt : d);
      await tx.dynReportSchedule.updateMany({
        where: { reportId, supersededAt: null },
        data: { effectiveFrom: anchor(schedule?.effectiveFrom ?? goLiveAt) },
      });
      await tx.dynReport.update({
        where: { id: reportId },
        data: { status: 'PUBLISHED', configVersion: { increment: 1 }, effectiveFrom: anchor(locked.effectiveFrom ?? goLiveAt) },
      });
      return { reportId, versionId: version.id, version: version.version, status: 'PUBLISHED' as const };
    });
  }

  private assertIsDraft(status: string): void {
    if (status === 'DRAFT') return;
    throw new ReportConfigError(
      status === 'ARCHIVED'
        ? 'Báo cáo đã lưu trữ — hãy khôi phục trước.'
        : 'Báo cáo này đã được xuất bản rồi, không còn là bản nháp.',
      'INVALID_STATE',
    );
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
    // Lock order report -> periods -> submissions. A save holds its period FOR SHARE before it writes a submission, so
    // taking them FOR UPDATE here waits for every save in flight to commit; what is read below is what is committed,
    // and a period closed in the meantime shows up as FINALIZED instead of being moved.
    await tx.$queryRaw`SELECT id FROM dyn_report_periods WHERE "reportId" = ${reportId} FOR UPDATE`;
    const open = await tx.dynReportPeriod.findMany({
      where: { reportId, status: 'OPEN', versionId: { not: newVersionId } },
      select: { id: true, periodKey: true, versionId: true },
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
      // A subset is frozen as cell addresses of the OLD version; the same criterion may sit elsewhere in the new one.
      // Re-freeze each through its criterion code. A team left with nothing keeps the period on the version it has.
      const remapped = await this.remapSubsets(tx, period.id, period.versionId, newVersionId);
      if (remapped === null) {
        kept.push(period.periodKey);
        continue;
      }
      for (const [assignmentId, ownedFieldKeys] of remapped) {
        await tx.dynReportAssignment.update({ where: { id: assignmentId }, data: { ownedFieldKeys } });
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
   * A criteria workbook carries no item keys in its cells: they travel in the request. When the request has none and
   * the file is byte-for-byte a version of this report that has them, they are taken from that version (by cell), so
   * re-publishing the current file can never strip the codes the teams' subsets are written in.
   */
  private async inheritCriteriaOfSameFile(
    tx: Prisma.TransactionClient,
    reportId: string,
    sha256: string,
    input: SaveReportVersionDto,
  ): Promise<Pick<SaveReportVersionDto, 'fields' | 'sourceKind' | 'criteriaGroups'>> {
    const asSent = { fields: input.fields, sourceKind: input.sourceKind, criteriaGroups: input.criteriaGroups };
    if (input.fields.some((f) => f.itemKey)) return asSent;
    const same = await tx.dynReportVersion.findFirst({
      where: { reportId, sha256, sourceKind: 'CRITERIA' },
      orderBy: { version: 'desc' },
      select: {
        sourceSelection: true,
        fields: {
          select: { fieldKey: true, itemKey: true, criterionCode: true, unit: true, parentItemKey: true, origin: true },
        },
      },
    });
    if (!same) return asSent;
    const known = new Map(same.fields.map((f) => [f.fieldKey, f]));
    const groups = criteriaGroupsOf(same.sourceSelection).map((g) => ({
      itemKey: g.itemKey,
      code: g.code ?? undefined,
      name: g.name,
      parentItemKey: g.parentItemKey ?? undefined,
    }));
    return {
      sourceKind: 'CRITERIA',
      criteriaGroups: input.criteriaGroups ?? groups,
      fields: input.fields.map((f) => {
        const k = known.get(f.fieldKey);
        return k?.itemKey
          ? {
              ...f,
              itemKey: k.itemKey,
              criterionCode: f.criterionCode ?? k.criterionCode ?? undefined,
              unit: f.unit ?? k.unit ?? undefined,
              parentItemKey: k.parentItemKey ?? undefined,
              origin: k.origin ?? undefined,
            }
          : f;
      }),
    };
  }

  /**
   * The subsets of a period's assignments expressed in the fields of another version: assignment id -> field keys.
   * Assignments that own everything are not in the map. Returns null when some team would be left with no field at
   * all (its criteria are not in the new version): the caller then leaves the period where it is.
   */
  private async remapSubsets(
    tx: Prisma.TransactionClient,
    periodId: string,
    oldVersionId: string,
    newVersionId: string,
  ): Promise<Map<string, string[]> | null> {
    const assignments = await tx.dynReportAssignment.findMany({
      where: { periodId },
      select: { id: true, ownedFieldKeys: true },
    });
    const withSubset = assignments.filter((a) => Array.isArray(a.ownedFieldKeys));
    const out = new Map<string, string[]>();
    if (withSubset.length === 0) return out;
    const select = { fieldKey: true, itemKey: true } as const;
    const orderBy = [{ sheetKey: 'asc' as const }, { address: 'asc' as const }];
    const oldFields = await tx.dynReportField.findMany({ where: { versionId: oldVersionId }, select, orderBy });
    const newFields = await tx.dynReportField.findMany({ where: { versionId: newVersionId }, select, orderBy });
    const itemKeyByFieldKey = new Map(oldFields.map((f) => [f.fieldKey, itemKeyOf(f)]));
    for (const a of withSubset) {
      const owned = a.ownedFieldKeys as string[];
      // An empty subset was already "nothing to report" (the team is exempt); it stays empty.
      const itemKeys = owned.map((k) => itemKeyByFieldKey.get(k)).filter((k): k is string => k !== undefined);
      const next = freezeOwnedFieldKeys(itemKeys, newFields) ?? [];
      if (owned.length > 0 && next.length === 0) return null;
      out.set(a.id, next);
    }
    return out;
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
