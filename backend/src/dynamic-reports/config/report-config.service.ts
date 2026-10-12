import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { computeSha256 } from '../../xlsx-imports/hostile-xlsx-guard';
import { generatePeriods } from '../engine/period';
import type { ScheduleRule } from '../engine/period';
import type { SaveReportConfigDto } from './dto/save-report-config.dto';
import { detectUnsupportedFeatures } from '../template/unsupported-features';
import { parseTemplateInWorker, TemplateParseTimeoutError } from '../template/parse-in-worker';
import { RunnerBusyError } from '../template/bounded-runner';
import { TemplateLimitError } from '../template/limits';
import { reconcileFieldsWithWorkbook } from './publish-reconcile';
import type { ParseTemplateResult } from '../template/types';
import { deriveFromValidations } from '../template/validation-constraints';
import type { DerivedConstraints } from '../template/validation-constraints';

export class ReportConfigError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'ReportConfigError';
  }
}

export interface SaveReportConfigResult {
  reportId: string;
  versionId: string;
  status: 'DRAFT' | 'PUBLISHED';
}

export interface VersionListItem {
  versionId: string;
  version: number;
  status: 'DRAFT' | 'PUBLISHED' | 'RETIRED';
  publishedAt: string | null;
  createdAt: string;
  periodKeys: string[];
}

const PARSER_VERSION = 'pr3-v1';
const ENGINE_VERSION = 'pr1-v1';
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

function toScheduleRule(s: SaveReportConfigDto['schedule']): ScheduleRule {
  return {
    periodType: s.periodType,
    periodStartDay: s.periodStartDay,
    due: s.dueRule as ScheduleRule['due'],
    open: s.openRule as ScheduleRule['open'],
    shiftNonWorking: s.shiftNonWorking,
    oneTimeDate: s.oneTimeDate,
  };
}

/**
 * S09/S10 (spec §6.1 PR4 bước 4/4) — the first place in this module that
 * actually PERSISTS a report config. Everything in PR4 slice 1-4 lived in
 * the wizard's React state only; this is where it finally reaches the DB.
 *
 * One combined create-or-publish call, not separate draft/publish
 * endpoints with a resumable-draft update path: nothing can be "resumed"
 * yet, because no prior slice ever wrote a draft to resume from — that
 * capability is S22 ("tiếp tục nháp"), explicitly a separate screen in the
 * plan, not implied by S09/S10 alone.
 */
@Injectable()
export class ReportConfigService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * BUG-003 (found by the PR10 UAT agent via a real end-to-end API call):
   * `detectUnsupportedFeatures` flags external links as ERROR severity —
   * the comment on that function says plainly "a reject (same tier as
   * macro/OLE)" — but nothing downstream ever acted on that severity.
   * `/templates/preview` surfaces the issue to the wizard UI as a warning
   * the user can simply ignore, and `save()` never re-checked the file at
   * all before persisting it as PUBLISHED. Re-running the same zip-level
   * scan here, on the actual bytes being persisted, closes that gap
   * server-side — the one place a direct API call (bypassing the wizard
   * entirely) can't route around it.
   */
  private async assertNoBlockingFeatureIssues(
    fileBuffer: Buffer,
  ): Promise<void> {
    const issues = await detectUnsupportedFeatures(fileBuffer);
    const blocking = issues.find((i) => i.severity === 'ERROR');
    if (blocking) {
      throw new ReportConfigError(blocking.message, 'TEMPLATE_INVALID');
    }
  }

  /**
   * OV3 — the request is a CLAIM about the template; the file is the fact.
   * Re-reads the uploaded bytes and refuses a field list that disagrees with
   * them (a formula or locked cell made editable, a token that is not in the
   * file, an input the template declares but the request dropped). Returns
   * the layout and formulas derived from the file itself, which are what gets
   * stored: nothing the client sent about structure is trusted.
   */
  private async reconcileWithFile(
    input: SaveReportConfigDto,
    fileBuffer: Buffer,
  ): Promise<ParseTemplateResult> {
    let parsed: ParseTemplateResult;
    try {
      parsed = await parseTemplateInWorker(fileBuffer, input.selectedSheets);
    } catch (err) {
      // Saturation is the server's condition, not a flaw in the file: say so, so the
      // client retries instead of sending the user off to fix a template.
      if (err instanceof RunnerBusyError) {
        throw new ReportConfigError(err.message, 'WORKER_BUSY');
      }
      if (err instanceof TemplateLimitError || err instanceof TemplateParseTimeoutError) {
        throw new ReportConfigError(err.message, 'TEMPLATE_INVALID');
      }
      throw new ReportConfigError(
        `Không đọc được file mẫu để đối chiếu: ${err instanceof Error ? err.message : String(err)}`,
        'TEMPLATE_INVALID',
      );
    }

    const blocking = parsed.issues.find((i) => i.severity === 'ERROR');
    if (blocking) {
      throw new ReportConfigError(
        `${blocking.sheetKey}${blocking.address ? '!' + blocking.address : ''}: ${blocking.message}`,
        'TEMPLATE_INVALID',
      );
    }

    const { problems } = reconcileFieldsWithWorkbook(
      parsed,
      input.selectedSheets,
      input.fields,
    );
    if (problems.length > 0) {
      throw new ReportConfigError(
        `Danh sách ô nhập không khớp file mẫu:\n- ${problems.join('\n- ')}`,
        'TEMPLATE_INVALID',
      );
    }
    return parsed;
  }

  private validateForPublish(input: SaveReportConfigDto): void {
    if (input.fields.length === 0) {
      throw new ReportConfigError(
        'Phải có ít nhất một ô nhập trước khi xuất bản.',
        'TEMPLATE_INVALID',
      );
    }
    if (!input.roles.some((r) => r.role === 'MANAGER')) {
      throw new ReportConfigError(
        'Phải có ít nhất một quản lý trước khi xuất bản.',
        'TEMPLATE_INVALID',
      );
    }
    if (input.targets.length === 0) {
      throw new ReportConfigError(
        'Phải có ít nhất một tổ phải nộp trước khi xuất bản.',
        'TEMPLATE_INVALID',
      );
    }
    if (input.targets.some((t) => t.editorUserIds.length === 0)) {
      throw new ReportConfigError(
        'Mỗi tổ phải có ít nhất một người nhập.',
        'TEMPLATE_INVALID',
      );
    }
    if (
      input.schedule.periodType === 'ONE_TIME' &&
      !input.schedule.oneTimeDate
    ) {
      throw new ReportConfigError(
        'Loại kỳ "Một lần" phải chọn ngày của kỳ.',
        'TEMPLATE_INVALID',
      );
    }
    try {
      generatePeriods(toScheduleRule(input.schedule), new Date(), 1);
    } catch (err) {
      throw new ReportConfigError(
        `Không tính được lịch: ${err instanceof Error ? err.message : String(err)}`,
        'TEMPLATE_INVALID',
      );
    }
  }

  /** Hashes everything the idempotency key must stay pinned to — every
   * field EXCEPT the key itself (comparing it against itself would be
   * meaningless). */
  private requestHash(input: SaveReportConfigDto, fileBuffer: Buffer): string {
    const rest: Omit<SaveReportConfigDto, 'idempotencyKey'> = {
      code: input.code,
      name: input.name,
      description: input.description,
      reportingUnit: input.reportingUnit,
      selectedSheets: input.selectedSheets,
      dateSystem: input.dateSystem,
      fields: input.fields,
      layout: input.layout,
      formulas: input.formulas,
      schedule: input.schedule,
      roles: input.roles,
      targets: input.targets,
      rules: input.rules,
      effectiveFrom: input.effectiveFrom,
      publish: input.publish,
    };
    const hash = createHash('sha256');
    hash.update(JSON.stringify(rest));
    hash.update(fileBuffer);
    return hash.digest('hex');
  }

  async save(
    input: SaveReportConfigDto,
    fileBuffer: Buffer,
    fileName: string,
    actorId: string,
  ): Promise<SaveReportConfigResult> {
    const requestHash = this.requestHash(input, fileBuffer);
    const existingIdempotency =
      await this.prisma.dynReportIdempotency.findUnique({
        where: {
          actorId_action_key: {
            actorId,
            action: 'save_report_config',
            key: input.idempotencyKey,
          },
        },
      });
    if (existingIdempotency) {
      if (existingIdempotency.requestHash !== requestHash) {
        throw new ReportConfigError(
          'Mã idempotency đã dùng cho một yêu cầu khác.',
          'IDEMPOTENCY_MISMATCH',
        );
      }
      if (existingIdempotency.resultRef) {
        return JSON.parse(
          existingIdempotency.resultRef,
        ) as SaveReportConfigResult;
      }
    }

    let derived: ParseTemplateResult | null = null;
    if (input.publish) {
      this.validateForPublish(input);
      await this.assertNoBlockingFeatureIssues(fileBuffer);
      derived = await this.reconcileWithFile(input, fileBuffer);
    } else if (input.fields.length === 0 && input.selectedSheets.length === 0) {
      throw new ReportConfigError(
        'Phải chọn ít nhất một sheet trước khi lưu nháp.',
        'TEMPLATE_INVALID',
      );
    }

    const status = input.publish ? 'PUBLISHED' : 'DRAFT';
    const sha256 = computeSha256(fileBuffer);
    const effectiveFrom = new Date(input.effectiveFrom);
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      let report: { id: string };
      try {
        report = await tx.dynReport.create({
          data: {
            code: input.code,
            name: input.name,
            description: input.description,
            reportingUnit: input.reportingUnit ?? 'TEAM',
            status,
            effectiveFrom,
            configVersion: 1,
            createdById: actorId,
          },
        });
      } catch (err) {
        if ((err as { code?: string })?.code === 'P2002') {
          throw new ReportConfigError(
            `Mã báo cáo "${input.code}" đã được dùng.`,
            'REPORT_CODE_TAKEN',
          );
        }
        throw err;
      }

      const version = await tx.dynReportVersion.create({
        data: {
          reportId: report.id,
          version: 1,
          status: input.publish ? 'PUBLISHED' : 'DRAFT',
          fileBytes: fileBuffer as unknown as Uint8Array<ArrayBuffer>,
          sha256,
          fileName,
          selectedSheets: input.selectedSheets as Prisma.InputJsonValue,
          // A published version stores what the FILE says about its structure;
          // only a draft (never executed) keeps the wizard's copy.
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

      if (input.fields.length > 0) {
        // What the template itself says a cell may hold (OV7). The author's own choice wins; the file fills the gaps.
        const fromTemplate = derived
          ? deriveFromValidations(
              derived.dataValidations,
              input.fields.map((f) => ({
                sheetKey: f.sheetKey,
                address: f.address,
                fieldKey: f.fieldKey,
                type: f.type as 'NUM' | 'TEXT' | 'DATE' | 'TIME',
              })),
            ).constraints
          : new Map<string, DerivedConstraints>();
        await tx.dynReportField.createMany({
          data: input.fields.map((f) => {
            const t = fromTemplate.get(f.fieldKey);
            return {
            versionId: version.id,
            sheetKey: f.sheetKey,
            address: f.address,
            fieldKey: f.fieldKey,
            label: f.label,
            type: f.type,
            format: f.format,
            aggregate: f.aggregate,
            blankPolicy: f.blankPolicy ?? 'ZERO',
            required: f.required ?? false,
            min: t?.min,
            max: t?.max,
            scale: f.scale ?? t?.scale,
            maxLength: f.maxLength ?? t?.maxLength,
            helpText: f.helpText ?? t?.helpText,
            source: f.source,
            };
          }),
        });
      }

      await tx.dynReportSchedule.create({
        data: {
          reportId: report.id,
          periodType: input.schedule.periodType,
          periodStartDay: input.schedule.periodStartDay,
          dueRule: input.schedule.dueRule as Prisma.InputJsonValue,
          openRule: input.schedule.openRule as Prisma.InputJsonValue,
          shiftNonWorking: input.schedule.shiftNonWorking ?? false,
          oneTimeDate: input.schedule.oneTimeDate,
          timezone: input.schedule.timezone ?? 'Asia/Ho_Chi_Minh',
          effectiveFrom,
        },
      });

      for (const role of input.roles) {
        await tx.dynReportRole.create({
          data: {
            reportId: report.id,
            userId: role.userId,
            role: role.role,
            teamScopeId: role.teamScopeId,
          },
        });
      }

      for (const target of input.targets) {
        const createdTarget = await tx.dynReportTarget.create({
          data: { reportId: report.id, teamId: target.teamId },
        });
        if (target.editorUserIds.length > 0) {
          await tx.dynReportTargetEditor.createMany({
            data: target.editorUserIds.map((userId) => ({
              targetId: createdTarget.id,
              userId,
            })),
          });
        }
      }

      if (input.rules && input.rules.length > 0) {
        await tx.dynReportValidationRule.createMany({
          data: input.rules.map((r) => ({
            versionId: version.id,
            name: r.name,
            leftExpr: r.leftExpr,
            operator: r.operator,
            rightExpr: r.rightExpr,
            severity: r.severity,
            message: r.message,
            missingStrategy: r.missingStrategy ?? null,
            origin: 'MANUAL',
          })),
        });
      }

      const payload: SaveReportConfigResult = {
        reportId: report.id,
        versionId: version.id,
        status,
      };
      await tx.dynReportIdempotency.upsert({
        where: {
          actorId_action_key: {
            actorId,
            action: 'save_report_config',
            key: input.idempotencyKey,
          },
        },
        create: {
          actorId,
          action: 'save_report_config',
          key: input.idempotencyKey,
          requestHash,
          resultRef: JSON.stringify(payload),
          status: 'COMPLETED',
          expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
        },
        update: {
          resultRef: JSON.stringify(payload),
          status: 'COMPLETED',
        },
      });

      return payload;
    });

    return result;
  }

  /**
   * S31 "Ngừng phát sinh" (spec §6.1 PR4 slice 6, D09). Flips
   * `DynReport.status` PUBLISHED → SUSPENDED, which is the ONLY thing
   * `PeriodSchedulerService.generateForAllReports` checks
   * (`where: { status: 'PUBLISHED' }`) before generating a report's next
   * period — so this alone is enough to stop future periods. It does
   * NOT touch any already-generated period/assignment/submission: a kỳ
   * that's already OPEN keeps running exactly as before (spec: "không tự
   * đóng kỳ đang mở; đóng kỳ là thao tác riêng có nhật ký" — that's S38
   * chốt kỳ, a different action entirely).
   */
  async suspendGeneration(reportId: string): Promise<{ status: 'SUSPENDED' }> {
    const report = await this.prisma.dynReport.findUnique({
      where: { id: reportId },
    });
    if (!report) {
      throw new ReportConfigError(
        'Không tìm thấy báo cáo này.',
        'REPORT_NOT_FOUND',
      );
    }
    if (report.status !== 'PUBLISHED') {
      throw new ReportConfigError(
        'Chỉ ngừng phát sinh được báo cáo đang ở trạng thái "Đã xuất bản".',
        'INVALID_STATE',
      );
    }
    await this.prisma.dynReport.update({
      where: { id: reportId },
      data: { status: 'SUSPENDED' },
    });
    return { status: 'SUSPENDED' };
  }

  /**
   * The counterpart of `suspendGeneration`: a SUSPENDED report starts generating periods again. Only a report that
   * still has a PUBLISHED version can resume — a suspended report always had one, but a defensive check keeps a
   * hand-edited row from producing a report the scheduler would skip with a warning on every tick.
   */
  async resumeGeneration(reportId: string): Promise<{ status: 'PUBLISHED' }> {
    const report = await this.prisma.dynReport.findUnique({ where: { id: reportId } });
    if (!report) {
      throw new ReportConfigError('Không tìm thấy báo cáo này.', 'REPORT_NOT_FOUND');
    }
    if (report.status !== 'SUSPENDED') {
      throw new ReportConfigError(
        'Chỉ tiếp tục phát sinh được báo cáo đang ở trạng thái "Ngừng phát sinh".',
        'INVALID_STATE',
      );
    }
    const published = await this.prisma.dynReportVersion.count({
      where: { reportId, status: 'PUBLISHED' },
    });
    if (published === 0) {
      throw new ReportConfigError(
        'Báo cáo chưa có phiên bản đã xuất bản để phát sinh kỳ.',
        'INVALID_STATE',
      );
    }
    await this.prisma.dynReport.update({
      where: { id: reportId },
      data: { status: 'PUBLISHED', configVersion: { increment: 1 } },
    });
    return { status: 'PUBLISHED' };
  }

  /**
   * S22 "Danh sách phiên bản" — read-only. Shows every version of this
   * report and which periods were generated against it, newest first.
   * Deliberately scoped to the LIST half of S22 only: "tạo phiên bản
   * mới" (D09 — apply immediately if no team has data yet, else from
   * the next period) and "tiếp tục nháp" are separate mutating actions
   * left for a later slice — this one has no write path at all.
   */
  async listVersions(reportId: string): Promise<VersionListItem[]> {
    const report = await this.prisma.dynReport.findUnique({
      where: { id: reportId },
    });
    if (!report) {
      throw new ReportConfigError(
        'Không tìm thấy báo cáo này.',
        'REPORT_NOT_FOUND',
      );
    }

    const versions = await this.prisma.dynReportVersion.findMany({
      where: { reportId },
      orderBy: { version: 'desc' },
      include: {
        periods: { select: { periodKey: true }, orderBy: { startDate: 'asc' } },
      },
    });

    return versions.map((v) => ({
      versionId: v.id,
      version: v.version,
      status: v.status,
      publishedAt: v.publishedAt?.toISOString() ?? null,
      createdAt: v.createdAt.toISOString(),
      periodKeys: v.periods.map((p) => p.periodKey),
    }));
  }
}
