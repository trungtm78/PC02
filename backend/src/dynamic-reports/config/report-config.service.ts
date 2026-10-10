import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { computeSha256 } from '../../xlsx-imports/hostile-xlsx-guard';
import { generatePeriods } from '../engine/period';
import type { ScheduleRule } from '../engine/period';
import type { SaveReportConfigDto } from './dto/save-report-config.dto';

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
    if (input.publish) {
      this.validateForPublish(input);
    } else if (input.fields.length === 0 && input.selectedSheets.length === 0) {
      throw new ReportConfigError(
        'Phải chọn ít nhất một sheet trước khi lưu nháp.',
        'TEMPLATE_INVALID',
      );
    }

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
          layout: {
            layout: input.layout,
            formulas: input.formulas,
          } as Prisma.InputJsonValue,
          dateSystem: input.dateSystem,
          parserVersion: PARSER_VERSION,
          engineVersion: ENGINE_VERSION,
          publishedAt: input.publish ? now : null,
          createdById: actorId,
        },
      });

      if (input.fields.length > 0) {
        await tx.dynReportField.createMany({
          data: input.fields.map((f) => ({
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
            scale: f.scale,
            maxLength: f.maxLength,
            helpText: f.helpText,
            source: f.source,
          })),
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
}
