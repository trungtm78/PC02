import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { resolveAccess } from '../engine/access';
import type {
  AccessGrant,
  PeriodStatus,
  SubmissionState,
} from '../engine/access';
import { validateFieldValue } from '../engine/values';
import type { FieldDefinitionLike, TypedValue } from '../engine/values';
import { applyTransition } from '../workflow/transitions';

export class SubmissionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'SubmissionError';
  }
}

export interface SubmissionFieldView {
  fieldKey: string;
  sheetKey: string;
  address: string;
  label: string;
  type: FieldDefinitionLike['type'];
  format: string | null;
  aggregate: string;
  required: boolean;
  min: string | null;
  max: string | null;
  scale: number | null;
  maxLength: number | null;
}

export interface SubmissionView {
  assignmentId: string;
  reportName: string;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  opensAt: string;
  dueAt: string;
  state: SubmissionState;
  revision: string;
  values: Record<string, TypedValue>;
  fields: SubmissionFieldView[];
  editable: boolean;
  effectiveLockAt: string | null;
  serverTime: string;
}

export interface SaveValuesResult {
  revision: string;
  state: SubmissionState;
  savedAt: string;
  serverTime: string;
  effectiveLockAt: string | null;
}

export interface AssignmentSummary {
  assignmentId: string;
  reportName: string;
  teamName: string;
  periodKey: string;
  dueAt: string;
  state: SubmissionState;
}

/**
 * S11-S14 (spec §6.1 PR6). The first service to ever READ or WRITE a
 * `DynReportSubmission` — PR5's PeriodScheduler only ever creates one
 * (R5: eagerly, state NOT_STARTED).
 *
 * `save()` is SAVE only this slice (not SUBMIT — that needs validation-rule
 * evaluation via `engine/expr.ts` against `DynReportValidationRule` rows,
 * a separate, larger lift deferred to the next slice). Lock order and
 * clock read follow spec §10 R4/R12 exactly: period (FOR SHARE) →
 * assignment+editor check → submission (FOR UPDATE) → `clock_timestamp()`
 * read AFTER acquiring the submission lock, never the transaction-start
 * `now()` a plain Prisma query would give.
 */
@Injectable()
export class SubmissionService {
  constructor(private readonly prisma: PrismaService) {}

  private async loadEditorAssignment(
    client: Prisma.TransactionClient | PrismaService,
    assignmentId: string,
    userId: string,
  ) {
    const editor = await client.dynReportAssignmentEditor.findFirst({
      where: { assignmentId, userId, isActive: true },
    });
    // 404, not 403 (AC-012/AC-035 convention already used by
    // reports.service.ts mode=input|manage): an assignment outside the
    // caller's scope must look identical to one that doesn't exist.
    if (!editor) {
      throw new NotFoundException('Không tìm thấy lượt giao này.');
    }

    const assignment = await client.dynReportAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        period: {
          include: { report: true, version: { include: { fields: true } } },
        },
        submission: true,
      },
    });
    if (!assignment || !assignment.submission) {
      throw new NotFoundException('Không tìm thấy lượt giao này.');
    }
    return assignment;
  }

  private async grantsFor(
    client: Prisma.TransactionClient | PrismaService,
    assignmentId: string,
  ): Promise<AccessGrant[]> {
    const unlocks = await client.dynReportUnlock.findMany({
      where: { assignmentId, status: 'ACTIVE' },
    });
    return unlocks.map((u) => ({
      startsAt: u.startsAt,
      expiresAt: u.expiresAt,
      revokedAt: u.revokedAt ?? null,
    }));
  }

  private toFieldView(f: {
    fieldKey: string;
    sheetKey: string;
    address: string;
    label: string;
    type: string;
    format: string | null;
    aggregate: string;
    required: boolean;
    min: Prisma.Decimal | null;
    max: Prisma.Decimal | null;
    scale: number | null;
    maxLength: number | null;
  }): SubmissionFieldView {
    return {
      fieldKey: f.fieldKey,
      sheetKey: f.sheetKey,
      address: f.address,
      label: f.label,
      type: f.type as FieldDefinitionLike['type'],
      format: f.format,
      aggregate: f.aggregate,
      required: f.required,
      min: f.min?.toString() ?? null,
      max: f.max?.toString() ?? null,
      scale: f.scale,
      maxLength: f.maxLength,
    };
  }

  /**
   * S11 thanh trên's "combo báo cáo/kỳ" (spec §6.1 PR6) — every assignment
   * the caller is an active editor of, newest period first. No report/
   * period filter yet (a real editor's assignment count is small — one
   * row per report × kỳ đang mở, not thousands); add one if that stops
   * being true.
   */
  async listMyAssignments(userId: string): Promise<AssignmentSummary[]> {
    const editors = await this.prisma.dynReportAssignmentEditor.findMany({
      where: { userId, isActive: true },
      include: {
        assignment: {
          include: {
            period: { include: { report: true } },
            submission: true,
          },
        },
      },
      orderBy: { assignment: { period: { dueAt: 'desc' } } },
    });

    return editors
      .filter((e) => e.assignment.period.status === 'OPEN')
      .map((e) => {
        const { assignment } = e;
        const teamSnapshot = assignment.teamSnapshot as {
          name?: string;
        } | null;
        return {
          assignmentId: assignment.id,
          reportName: assignment.period.report.name,
          teamName: teamSnapshot?.name ?? '',
          periodKey: assignment.period.periodKey,
          dueAt: assignment.period.dueAt.toISOString(),
          state: assignment.submission?.state ?? 'NOT_STARTED',
        };
      });
  }

  async getSubmission(
    assignmentId: string,
    userId: string,
  ): Promise<SubmissionView> {
    const assignment = await this.loadEditorAssignment(
      this.prisma,
      assignmentId,
      userId,
    );
    const { period, submission } = assignment;
    if (!submission)
      throw new NotFoundException('Không tìm thấy lượt giao này.');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true },
    });
    const grants = await this.grantsFor(this.prisma, assignmentId);
    const now = new Date();

    const access = resolveAccess({
      state: submission.state,
      periodStatus: period.status as PeriodStatus,
      opensAt: period.opensAt,
      originalDueAt: period.dueAt,
      returnDueAt: submission.returnDueAt,
      grants,
      userActive: user?.isActive ?? false,
      now,
    });

    return {
      assignmentId,
      reportName: period.report.name,
      periodKey: period.periodKey,
      periodStart: period.startDate.toISOString().slice(0, 10),
      periodEnd: period.endDate.toISOString().slice(0, 10),
      opensAt: period.opensAt.toISOString(),
      dueAt: period.dueAt.toISOString(),
      state: submission.state,
      revision: submission.currentRevision.toString(),
      values: (submission.values as Record<string, TypedValue>) ?? {},
      fields: period.version.fields.map((f) => this.toFieldView(f)),
      editable: access.canEdit,
      effectiveLockAt: access.effectiveLockAt?.toISOString() ?? null,
      serverTime: now.toISOString(),
    };
  }

  async save(
    assignmentId: string,
    userId: string,
    patch: Record<string, string | null>,
    expectedRevision: string,
  ): Promise<SaveValuesResult> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id FROM "dyn_report_periods" WHERE id = (
          SELECT "periodId" FROM "dyn_report_assignments" WHERE id = ${assignmentId}
        ) FOR SHARE`;

      const assignment = await this.loadEditorAssignment(
        tx,
        assignmentId,
        userId,
      );
      const { period } = assignment;
      if (period.status !== 'OPEN') {
        throw new SubmissionError(
          'Kỳ đã chốt, không thể lưu.',
          'REPORT_LOCKED',
        );
      }

      await tx.$queryRaw`
        SELECT id FROM "dyn_report_submissions" WHERE "assignmentId" = ${assignmentId} FOR UPDATE`;

      const submission = await tx.dynReportSubmission.findUnique({
        where: { assignmentId },
      });
      if (!submission)
        throw new NotFoundException('Không tìm thấy lượt giao này.');

      const nowRow = await tx.$queryRaw<
        { now: Date }[]
      >`SELECT clock_timestamp() AS now`;
      const now = nowRow[0].now;

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { isActive: true },
      });
      const grants = await this.grantsFor(tx, assignmentId);
      const access = resolveAccess({
        state: submission.state,
        periodStatus: period.status as PeriodStatus,
        opensAt: period.opensAt,
        originalDueAt: period.dueAt,
        returnDueAt: submission.returnDueAt,
        grants,
        userActive: user?.isActive ?? false,
        now,
      });
      if (!access.canEdit) {
        throw new SubmissionError(
          'Hết quyền ghi vào lúc này.',
          'REPORT_LOCKED',
        );
      }

      if (submission.currentRevision.toString() !== expectedRevision) {
        throw new SubmissionError(
          'Bản nộp đã bị sửa bởi một phiên khác — tải lại để lấy bản mới nhất.',
          'REVISION_CONFLICT',
        );
      }

      const fieldsByKey = new Map(
        period.version.fields.map((f) => [f.fieldKey, f]),
      );
      const validatedPatch: Record<string, TypedValue> = {};
      for (const [fieldKey, raw] of Object.entries(patch)) {
        const field = fieldsByKey.get(fieldKey);
        if (!field) {
          throw new SubmissionError(
            `Ô "${fieldKey}" không thuộc mẫu báo cáo này.`,
            'CELL_VALIDATION',
          );
        }
        const result = validateFieldValue(
          {
            type: field.type as FieldDefinitionLike['type'],
            required: field.required,
            min: field.min?.toString(),
            max: field.max?.toString(),
            scale: field.scale ?? undefined,
            maxLength: field.maxLength ?? undefined,
          },
          raw,
        );
        if (!result.ok) {
          throw new SubmissionError(
            `Ô "${fieldKey}": ${result.error.message}`,
            'CELL_VALIDATION',
          );
        }
        validatedPatch[fieldKey] = result.value;
      }

      const transition = applyTransition('SAVE', {
        state: submission.state,
        approvalLevel: submission.approvalLevel,
        totalApprovalLevels: 1,
        actorRole: 'EDITOR',
        hasRequiredFieldsValid: true,
        hasErrorSeverityRuleViolation: false,
      });
      if (!transition.ok) {
        throw new SubmissionError(transition.message, transition.code);
      }

      const mergedValues = {
        ...(submission.values as Record<string, TypedValue>),
        ...validatedPatch,
      };
      const nextRevision = submission.currentRevision + BigInt(1);

      await tx.dynReportSubmission.update({
        where: { assignmentId },
        data: {
          state: transition.next,
          currentRevision: nextRevision,
          values: mergedValues as Prisma.InputJsonValue,
          firstSavedAt: submission.firstSavedAt ?? now,
        },
      });

      await tx.dynReportRevision.create({
        data: {
          submissionId: submission.id,
          revision: nextRevision,
          kind: transition.revisionKind,
          diff: validatedPatch as Prisma.InputJsonValue,
          actorId: userId,
        },
      });

      const nextAccess = resolveAccess({
        state: transition.next,
        periodStatus: period.status as PeriodStatus,
        opensAt: period.opensAt,
        originalDueAt: period.dueAt,
        returnDueAt: submission.returnDueAt,
        grants,
        userActive: true,
        now,
      });

      return {
        revision: nextRevision.toString(),
        state: transition.next,
        savedAt: now.toISOString(),
        serverTime: now.toISOString(),
        effectiveLockAt: nextAccess.effectiveLockAt?.toISOString() ?? null,
      };
    });
  }
}
