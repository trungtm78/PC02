/**
 * Submission workflow — one declarative transition table (spec §10 R1)
 * for every DynReportSubmissionState change: SAVE/SUBMIT/RETURN/APPROVE/
 * UNAPPROVE. Pure, no I/O, no Prisma. The calling NestJS service (PR4/PR6/
 * PR7) wraps `applyTransition` in a transaction: it reads the current
 * state under a row lock, calls this, and on success persists the
 * returned `next` state/`nextApprovalLevel`, appends a
 * `DynReportRevision` of kind `revisionKind`, writes an `AuditEvent` with
 * `auditAction`, and emits each notification in `notify` — all in the same
 * transaction. This single table is what replaced the originally-separate
 * ReviewService/UnlockService/AdjustmentService split.
 *
 * R21 multi-level approval: `totalApprovalLevels` (default 1) and
 * `approvalLevel` (how many levels have signed off so far) live on
 * DynReportSubmission. `actingApprovalLevel` is the specific level the
 * current manager is authorized to act at (from their DynReportRole
 * assignment, resolved by the caller before invoking this). APPROVE only
 * succeeds for the manager holding exactly the next level in sequence
 * (`actingApprovalLevel === approvalLevel + 1`); UNAPPROVE only succeeds
 * for the manager holding exactly the highest level that has already
 * approved (`actingApprovalLevel === approvalLevel`) — BRD §6.3: a lower
 * level can never silently undo a higher level's already-given approval.
 */

/**
 * Mirrors the subset of the Prisma `NotificationType` enum this workflow
 * can emit. Declared locally (not imported from `@prisma/client`) so this
 * file stays a plain TS module with no generated-client dependency.
 */
export type NotificationType = 'DYN_REPORT_RETURNED' | 'DYN_REPORT_APPROVED';

export type SubmissionState =
  | 'NOT_STARTED'
  | 'DRAFT'
  | 'SUBMITTED'
  | 'RETURNED'
  | 'APPROVED';
export type SubmissionAction =
  | 'SAVE'
  | 'SUBMIT'
  | 'RETURN'
  | 'APPROVE'
  | 'UNAPPROVE';
export type RevisionKind =
  | 'SAVE'
  | 'IMPORT'
  | 'SUBMIT'
  | 'RETURN'
  | 'APPROVE'
  | 'UNAPPROVE'
  | 'ADJUSTMENT';
export type ActorRole = 'EDITOR' | 'MANAGER' | 'ADMIN';

export interface TransitionContext {
  state: SubmissionState;
  approvalLevel: number;
  totalApprovalLevels: number;
  actorRole: ActorRole;
  /** Only meaningful for MANAGER actions on a multi-level chain. */
  actingApprovalLevel?: number;
  /** SUBMIT guard: every required field on this template has a valid value. */
  hasRequiredFieldsValid: boolean;
  /** SUBMIT guard: at least one ERROR-severity validation rule fails. */
  hasErrorSeverityRuleViolation: boolean;
}

export type TransitionErrorCode = 'INVALID_STATE_TRANSITION' | 'GUARD_FAILED';

export type TransitionResult =
  | {
      ok: true;
      next: SubmissionState;
      nextApprovalLevel: number;
      revisionKind: RevisionKind;
      auditAction: string;
      notify: NotificationType[] | null;
    }
  | { ok: false; code: TransitionErrorCode; message: string };

function err(code: TransitionErrorCode, message: string): TransitionResult {
  return { ok: false, code, message };
}

function applySave(c: TransitionContext): TransitionResult {
  if (
    !(['NOT_STARTED', 'DRAFT', 'RETURNED'] as SubmissionState[]).includes(
      c.state,
    )
  ) {
    return err(
      'INVALID_STATE_TRANSITION',
      `Không thể lưu khi đang ở trạng thái ${c.state}.`,
    );
  }
  if (c.actorRole !== 'EDITOR') {
    return err('GUARD_FAILED', 'Chỉ người nhập của tổ mới được lưu.');
  }
  return {
    ok: true,
    next: 'DRAFT',
    nextApprovalLevel: c.approvalLevel,
    revisionKind: 'SAVE',
    auditAction: 'dyn_report.submission.save',
    notify: null,
  };
}

function applySubmit(c: TransitionContext): TransitionResult {
  if (
    !(['NOT_STARTED', 'DRAFT', 'RETURNED'] as SubmissionState[]).includes(
      c.state,
    )
  ) {
    return err(
      'INVALID_STATE_TRANSITION',
      `Không thể nộp khi đang ở trạng thái ${c.state}.`,
    );
  }
  if (c.actorRole !== 'EDITOR') {
    return err('GUARD_FAILED', 'Chỉ người nhập của tổ mới được nộp.');
  }
  if (!c.hasRequiredFieldsValid) {
    return err('GUARD_FAILED', 'Còn ô bắt buộc chưa hợp lệ.');
  }
  if (c.hasErrorSeverityRuleViolation) {
    return err('GUARD_FAILED', 'Còn vi phạm quy tắc kiểm tra mức lỗi.');
  }
  return {
    ok: true,
    next: 'SUBMITTED',
    nextApprovalLevel: 0,
    revisionKind: 'SUBMIT',
    auditAction: 'dyn_report.submission.submit',
    notify: null,
  };
}

function applyReturn(c: TransitionContext): TransitionResult {
  if (c.state !== 'SUBMITTED') {
    return err(
      'INVALID_STATE_TRANSITION',
      `Không thể trả lại khi đang ở trạng thái ${c.state}.`,
    );
  }
  if (c.actorRole !== 'MANAGER' && c.actorRole !== 'ADMIN') {
    return err('GUARD_FAILED', 'Chỉ người quản lý mới được trả lại.');
  }
  return {
    ok: true,
    next: 'RETURNED',
    nextApprovalLevel: 0,
    revisionKind: 'RETURN',
    auditAction: 'dyn_report.submission.return',
    notify: ['DYN_REPORT_RETURNED'],
  };
}

function applyApprove(c: TransitionContext): TransitionResult {
  if (c.state !== 'SUBMITTED') {
    return err(
      'INVALID_STATE_TRANSITION',
      `Không thể duyệt khi đang ở trạng thái ${c.state}.`,
    );
  }
  if (c.actorRole !== 'MANAGER' && c.actorRole !== 'ADMIN') {
    return err('GUARD_FAILED', 'Chỉ người quản lý mới được duyệt.');
  }
  const actingLevel = c.actingApprovalLevel ?? 1;
  if (actingLevel !== c.approvalLevel + 1) {
    return err(
      'GUARD_FAILED',
      `Chưa đến lượt cấp ${actingLevel} duyệt (đang chờ cấp ${c.approvalLevel + 1}).`,
    );
  }
  const nextApprovalLevel = c.approvalLevel + 1;
  const isFinalLevel = nextApprovalLevel >= c.totalApprovalLevels;
  return {
    ok: true,
    next: isFinalLevel ? 'APPROVED' : 'SUBMITTED',
    nextApprovalLevel,
    revisionKind: 'APPROVE',
    auditAction: 'dyn_report.submission.approve',
    notify: isFinalLevel ? ['DYN_REPORT_APPROVED'] : null,
  };
}

function applyUnapprove(c: TransitionContext): TransitionResult {
  if (c.state !== 'APPROVED') {
    return err(
      'INVALID_STATE_TRANSITION',
      `Không thể huỷ duyệt khi đang ở trạng thái ${c.state}.`,
    );
  }
  if (c.actorRole !== 'MANAGER' && c.actorRole !== 'ADMIN') {
    return err('GUARD_FAILED', 'Chỉ người quản lý mới được huỷ duyệt.');
  }
  const actingLevel = c.actingApprovalLevel ?? 1;
  if (actingLevel !== c.approvalLevel) {
    return err(
      'GUARD_FAILED',
      `Chỉ cấp đã duyệt gần nhất (cấp ${c.approvalLevel}) mới được huỷ duyệt, không phải cấp ${actingLevel}.`,
    );
  }
  return {
    ok: true,
    next: 'SUBMITTED',
    nextApprovalLevel: Math.max(0, c.approvalLevel - 1),
    revisionKind: 'UNAPPROVE',
    auditAction: 'dyn_report.submission.unapprove',
    notify: null,
  };
}

const TRANSITIONS: Record<
  SubmissionAction,
  (ctx: TransitionContext) => TransitionResult
> = {
  SAVE: applySave,
  SUBMIT: applySubmit,
  RETURN: applyReturn,
  APPROVE: applyApprove,
  UNAPPROVE: applyUnapprove,
};

export function applyTransition(
  action: SubmissionAction,
  context: TransitionContext,
): TransitionResult {
  return TRANSITIONS[action](context);
}
