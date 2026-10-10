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

  /**
   * S33/PR7 — manager-side actor resolution. Deliberately NOT the app-wide
   * DataScope (spec §10 R13): `admin:DynamicReport` (checked the same way
   * `reports.service.ts#getGrants` does, kept duplicated here rather than
   * shared — a 3-line permission lookup isn't worth a new shared module
   * for two consumers) overrides any report, otherwise an active
   * `DynReportRole` row with role=MANAGER for this exact report.
   */
  private async resolveManagerRole(
    client: Prisma.TransactionClient | PrismaService,
    reportId: string,
    userId: string,
    roleId: string,
  ): Promise<'ADMIN' | 'MANAGER' | null> {
    const adminGrant = await client.rolePermission.findFirst({
      where: {
        roleId,
        permission: { subject: 'DynamicReport', action: 'admin' },
      },
    });
    if (adminGrant) return 'ADMIN';

    const now = new Date();
    const managerRole = await client.dynReportRole.findFirst({
      where: {
        reportId,
        userId,
        role: 'MANAGER',
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
    });
    return managerRole ? 'MANAGER' : null;
  }

  /**
   * Same 404-not-403 anti-probe convention as `loadEditorAssignment`: a
   * report this caller doesn't manage must look identical to an
   * assignment that doesn't exist.
   */
  private async loadAssignmentForManager(
    client: Prisma.TransactionClient | PrismaService,
    assignmentId: string,
    userId: string,
    roleId: string,
  ) {
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
    const actorRole = await this.resolveManagerRole(
      client,
      assignment.period.report.id,
      userId,
      roleId,
    );
    if (!actorRole) {
      throw new NotFoundException('Không tìm thấy lượt giao này.');
    }
    return { assignment, actorRole };
  }

  /**
   * S15 thu nhỏ cho slice 1 — danh sách phẳng mọi lượt giao thuộc các báo
   * cáo caller quản lý (hoặc mọi báo cáo nếu có `admin:DynamicReport`),
   * đủ để điều hướng vào `getSubmissionForManager`/duyệt-trả-huỷ. Tổng
   * hợp theo báo cáo (S15 đầy đủ) cần `AggregateService`, chưa có — dời
   * slice sau.
   */
  async listForManager(
    userId: string,
    roleId: string,
  ): Promise<AssignmentSummary[]> {
    const adminGrant = await this.prisma.rolePermission.findFirst({
      where: {
        roleId,
        permission: { subject: 'DynamicReport', action: 'admin' },
      },
    });

    const now = new Date();
    let reportIds: string[];
    if (adminGrant) {
      const reports = await this.prisma.dynReport.findMany({
        select: { id: true },
      });
      reportIds = reports.map((r) => r.id);
    } else {
      const roles = await this.prisma.dynReportRole.findMany({
        where: {
          userId,
          role: 'MANAGER',
          validFrom: { lte: now },
          OR: [{ validTo: null }, { validTo: { gt: now } }],
        },
        select: { reportId: true },
      });
      reportIds = roles.map((r) => r.reportId);
    }
    if (reportIds.length === 0) return [];

    const assignments = await this.prisma.dynReportAssignment.findMany({
      where: { period: { reportId: { in: reportIds }, status: 'OPEN' } },
      include: {
        period: { include: { report: true } },
        submission: true,
      },
      orderBy: { period: { dueAt: 'desc' } },
    });

    return assignments.map((a) => {
      const teamSnapshot = a.teamSnapshot as { name?: string } | null;
      return {
        assignmentId: a.id,
        reportName: a.period.report.name,
        teamName: teamSnapshot?.name ?? '',
        periodKey: a.period.periodKey,
        dueAt: a.period.dueAt.toISOString(),
        state: a.submission?.state ?? 'NOT_STARTED',
      };
    });
  }

  /**
   * Manager's read-only view of one submission (S16 thu nhỏ). Always
   * `editable: false` / `effectiveLockAt: null` — write-access windows are
   * a per-editor computation (`resolveAccess` needs ONE caller's
   * `userActive`), meaningless for a manager who never types into cells;
   * a true S16 showing the editor's own access state is a later slice.
   */
  async getSubmissionForManager(
    assignmentId: string,
    userId: string,
    roleId: string,
  ): Promise<SubmissionView> {
    const { assignment } = await this.loadAssignmentForManager(
      this.prisma,
      assignmentId,
      userId,
      roleId,
    );
    const { period, submission } = assignment;
    if (!submission)
      throw new NotFoundException('Không tìm thấy lượt giao này.');
    const now = new Date();

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
      editable: false,
      effectiveLockAt: null,
      serverTime: now.toISOString(),
    };
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

  /**
   * R12 lock order + R4 clock read, shared by every write path (`save`,
   * `submit`): period (FOR SHARE) → assignment+editor check → submission
   * (FOR UPDATE) → `clock_timestamp()` → access check → CAS on
   * `expectedRevision`. Factored out once a second write path (`submit`)
   * needed the exact same sequence — duplicating it would risk the two
   * paths silently drifting apart on a security-relevant check.
   */
  private async lockForWrite(
    tx: Prisma.TransactionClient,
    assignmentId: string,
    userId: string,
    expectedRevision: string,
  ) {
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
      throw new SubmissionError('Kỳ đã chốt, không thể lưu.', 'REPORT_LOCKED');
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
      throw new SubmissionError('Hết quyền ghi vào lúc này.', 'REPORT_LOCKED');
    }

    if (submission.currentRevision.toString() !== expectedRevision) {
      throw new SubmissionError(
        'Bản nộp đã bị sửa bởi một phiên khác — tải lại để lấy bản mới nhất.',
        'REVISION_CONFLICT',
      );
    }

    return { period, submission, now, grants };
  }

  async save(
    assignmentId: string,
    userId: string,
    patch: Record<string, string | null>,
    expectedRevision: string,
  ): Promise<SaveValuesResult> {
    return this.prisma.$transaction(async (tx) => {
      const { period, submission, now, grants } = await this.lockForWrite(
        tx,
        assignmentId,
        userId,
        expectedRevision,
      );

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

  /**
   * S29 (spec §6.1 PR6). Takes no value patch — the frontend flushes any
   * pending autosave before calling this, same as the spec's own "chờ
   * autosave xong" requirement. `hasErrorSeverityRuleViolation` is always
   * false: `DynReportValidationRule` has no evaluation path wired yet
   * (needs `engine/expr.ts`, PR9 S36) and, more to the point, no UI
   * exists anywhere to create a rule row, so this can never actually be
   * true in practice today — not a shortcut, just an honest reflection
   * of what's reachable.
   */
  async submit(
    assignmentId: string,
    userId: string,
    expectedRevision: string,
  ): Promise<SaveValuesResult> {
    return this.prisma.$transaction(async (tx) => {
      const { period, submission, now, grants } = await this.lockForWrite(
        tx,
        assignmentId,
        userId,
        expectedRevision,
      );

      const values = (submission.values as Record<string, TypedValue>) ?? {};
      const missingRequired = period.version.fields.filter(
        (f) => f.required && !values[f.fieldKey]?.v,
      );
      const hasRequiredFieldsValid = missingRequired.length === 0;
      const hasErrorSeverityRuleViolation = false;

      const transition = applyTransition('SUBMIT', {
        state: submission.state,
        approvalLevel: submission.approvalLevel,
        totalApprovalLevels: 1,
        actorRole: 'EDITOR',
        hasRequiredFieldsValid,
        hasErrorSeverityRuleViolation,
      });
      if (!transition.ok) {
        if (!hasRequiredFieldsValid) {
          throw new SubmissionError(
            `Còn ${missingRequired.length} ô bắt buộc chưa điền: ${missingRequired
              .map((f) => f.label || f.fieldKey)
              .join(', ')}`,
            'CELL_VALIDATION',
          );
        }
        throw new SubmissionError(transition.message, transition.code);
      }

      const nextRevision = submission.currentRevision + BigInt(1);

      await tx.dynReportSubmission.update({
        where: { assignmentId },
        data: {
          state: transition.next,
          currentRevision: nextRevision,
          submittedAt: now,
          firstSubmittedAt: submission.firstSubmittedAt ?? now,
          firstSubmittedRevision:
            submission.firstSubmittedRevision ?? nextRevision,
        },
      });

      await tx.dynReportRevision.create({
        data: {
          submissionId: submission.id,
          revision: nextRevision,
          kind: transition.revisionKind,
          valuesFull: values as Prisma.InputJsonValue,
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

  /**
   * S33/PR7 manager-write lock order — the same R12 shape as
   * `lockForWrite` (period FOR SHARE → submission FOR UPDATE →
   * `clock_timestamp()` → CAS), but the mid-step access check is replaced
   * with `resolveManagerRole`: a manager's approve/return/unapprove right
   * is NEVER a function of `resolveAccess`'s editable-window logic (that
   * engine answers "can an editor type into cells right now", which is
   * false for SUBMITTED/APPROVED — the exact states a manager needs to
   * act on). Deliberately a separate method rather than branching inside
   * `lockForWrite`: the two write paths authorize completely differently,
   * and folding them into one function would risk one path's guard
   * silently leaking into the other on a future edit.
   */
  private async lockForManagerWrite(
    tx: Prisma.TransactionClient,
    assignmentId: string,
    userId: string,
    roleId: string,
    expectedRevision: string,
  ) {
    await tx.$queryRaw`
      SELECT id FROM "dyn_report_periods" WHERE id = (
        SELECT "periodId" FROM "dyn_report_assignments" WHERE id = ${assignmentId}
      ) FOR SHARE`;

    const { assignment, actorRole } = await this.loadAssignmentForManager(
      tx,
      assignmentId,
      userId,
      roleId,
    );
    const { period } = assignment;
    if (period.status !== 'OPEN') {
      throw new SubmissionError(
        'Kỳ đã chốt, không thể duyệt/trả lại/huỷ duyệt.',
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

    if (submission.currentRevision.toString() !== expectedRevision) {
      throw new SubmissionError(
        'Bản nộp đã bị sửa bởi một phiên khác — tải lại để lấy bản mới nhất.',
        'REVISION_CONFLICT',
      );
    }

    return { submission, now, actorRole };
  }

  /** S33 — manager approves a SUBMITTED submission. */
  async approve(
    assignmentId: string,
    userId: string,
    roleId: string,
    expectedRevision: string,
    reason?: string,
  ): Promise<SaveValuesResult> {
    return this.prisma.$transaction(async (tx) => {
      const { submission, now, actorRole } = await this.lockForManagerWrite(
        tx,
        assignmentId,
        userId,
        roleId,
        expectedRevision,
      );

      const transition = applyTransition('APPROVE', {
        state: submission.state,
        approvalLevel: submission.approvalLevel,
        totalApprovalLevels: 1,
        actorRole,
        actingApprovalLevel: 1,
        hasRequiredFieldsValid: true,
        hasErrorSeverityRuleViolation: false,
      });
      if (!transition.ok) {
        throw new SubmissionError(transition.message, transition.code);
      }

      const nextRevision = submission.currentRevision + BigInt(1);
      const values = (submission.values as Record<string, TypedValue>) ?? {};

      await tx.dynReportSubmission.update({
        where: { assignmentId },
        data: {
          state: transition.next,
          currentRevision: nextRevision,
          approvalLevel: transition.nextApprovalLevel,
          ...(transition.next === 'APPROVED'
            ? { approvedAt: now, approvedById: userId }
            : {}),
        },
      });

      await tx.dynReportRevision.create({
        data: {
          submissionId: submission.id,
          revision: nextRevision,
          kind: transition.revisionKind,
          valuesFull: values as Prisma.InputJsonValue,
          actorId: userId,
          reason: reason ?? null,
        },
      });

      return {
        revision: nextRevision.toString(),
        state: transition.next,
        savedAt: now.toISOString(),
        serverTime: now.toISOString(),
        effectiveLockAt: null,
      };
    });
  }

  /** S33 — manager returns a SUBMITTED submission with a reason and a new edit deadline. */
  async returnSubmission(
    assignmentId: string,
    userId: string,
    roleId: string,
    expectedRevision: string,
    reason: string,
    returnDueAt: string,
  ): Promise<SaveValuesResult> {
    const parsedReturnDueAt = new Date(returnDueAt);
    return this.prisma.$transaction(async (tx) => {
      const { submission, now, actorRole } = await this.lockForManagerWrite(
        tx,
        assignmentId,
        userId,
        roleId,
        expectedRevision,
      );

      if (parsedReturnDueAt.getTime() <= now.getTime()) {
        throw new SubmissionError(
          'Hạn sửa phải ở trong tương lai.',
          'CELL_VALIDATION',
        );
      }

      const transition = applyTransition('RETURN', {
        state: submission.state,
        approvalLevel: submission.approvalLevel,
        totalApprovalLevels: 1,
        actorRole,
        hasRequiredFieldsValid: true,
        hasErrorSeverityRuleViolation: false,
      });
      if (!transition.ok) {
        throw new SubmissionError(transition.message, transition.code);
      }

      const nextRevision = submission.currentRevision + BigInt(1);
      const values = (submission.values as Record<string, TypedValue>) ?? {};

      await tx.dynReportSubmission.update({
        where: { assignmentId },
        data: {
          state: transition.next,
          currentRevision: nextRevision,
          approvalLevel: transition.nextApprovalLevel,
          returnedReason: reason,
          returnDueAt: parsedReturnDueAt,
        },
      });

      await tx.dynReportRevision.create({
        data: {
          submissionId: submission.id,
          revision: nextRevision,
          kind: transition.revisionKind,
          valuesFull: values as Prisma.InputJsonValue,
          actorId: userId,
          reason,
        },
      });

      return {
        revision: nextRevision.toString(),
        state: transition.next,
        savedAt: now.toISOString(),
        serverTime: now.toISOString(),
        effectiveLockAt: parsedReturnDueAt.toISOString(),
      };
    });
  }

  /** S33 — manager undoes their own already-given approval. */
  async unapprove(
    assignmentId: string,
    userId: string,
    roleId: string,
    expectedRevision: string,
    reason?: string,
  ): Promise<SaveValuesResult> {
    return this.prisma.$transaction(async (tx) => {
      const { submission, now, actorRole } = await this.lockForManagerWrite(
        tx,
        assignmentId,
        userId,
        roleId,
        expectedRevision,
      );

      const transition = applyTransition('UNAPPROVE', {
        state: submission.state,
        approvalLevel: submission.approvalLevel,
        totalApprovalLevels: 1,
        actorRole,
        actingApprovalLevel: 1,
        hasRequiredFieldsValid: true,
        hasErrorSeverityRuleViolation: false,
      });
      if (!transition.ok) {
        throw new SubmissionError(transition.message, transition.code);
      }

      const nextRevision = submission.currentRevision + BigInt(1);
      const values = (submission.values as Record<string, TypedValue>) ?? {};

      await tx.dynReportSubmission.update({
        where: { assignmentId },
        data: {
          state: transition.next,
          currentRevision: nextRevision,
          approvalLevel: transition.nextApprovalLevel,
          approvedAt: null,
          approvedById: null,
        },
      });

      await tx.dynReportRevision.create({
        data: {
          submissionId: submission.id,
          revision: nextRevision,
          kind: transition.revisionKind,
          valuesFull: values as Prisma.InputJsonValue,
          actorId: userId,
          reason: reason ?? null,
        },
      });

      return {
        revision: nextRevision.toString(),
        state: transition.next,
        savedAt: now.toISOString(),
        serverTime: now.toISOString(),
        effectiveLockAt: null,
      };
    });
  }
}
