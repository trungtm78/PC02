import { createHash, randomUUID } from 'node:crypto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Prisma } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DynReportApprovedEvent,
  DynReportReturnedEvent,
  DynReportUnlockGrantedEvent,
  DynReportUnlockRequestedEvent,
} from '../../notifications/events/notification.events';
import {
  assertMagicBytes,
  assertCompressedSize,
  assertNoZipBomb,
  HostileXlsxError,
} from '../../xlsx-imports/hostile-xlsx-guard';
import { resolveAccess } from '../engine/access';
import type {
  AccessGrant,
  PeriodStatus,
  SubmissionState,
} from '../engine/access';
import { validateFieldValue } from '../engine/values';
import type { FieldDefinitionLike, TypedValue } from '../engine/values';
import { readImportCellRaw } from '../engine/import-cell';
import { evaluateRules } from '../engine/rules';
import type { RuleOperator, RuleViolation } from '../engine/rules';
import { escapeXlsxCell } from '../../common/utils/xlsx-formula-escape.util';
import {
  sanitizeSheetName,
  sanitizeFileNamePart,
} from '../export-filename.util';
import type { ImportCellType } from '../engine/import-cell';
import { applyTransition } from '../workflow/transitions';
import { VersionFieldsCacheService } from '../template/version-fields-cache';
import { TemplateExportService } from '../export/template-export.service';
import { readExportMeta } from '../export/template-export';

/** D07 — a manager-created grant's default window when no explicit expiresAt is given. */
const DEFAULT_GRANT_HOURS = 3;

/** S26 (PR6 slice 7) — idempotency record for `save()`, same convention as `report-config.service.ts`. */
const SAVE_IDEMPOTENCY_ACTION = 'dyn_report_save_values';
const SAVE_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

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
  /** The reopening request the caller made that is still waiting for a manager; they can take it back. */
  pendingUnlockRequest: PendingUnlockRequestView | null;
  assignmentId: string;
  /** The template version this period was generated from — key for `GET versions/:versionId/grid`. */
  versionId: string;
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
  /**
   * S16 — "lưu lần cuối". `null` when `firstSavedAt` is still null (R5
   * creates the submission row eagerly at assignment time, so
   * `updatedAt` itself is always set — but showing that creation
   * instant as "lưu lần cuối" before anyone has actually saved anything
   * would be misleading).
   */
  updatedAt: string | null;
  /** S16 (PR7 slice 3) — only ever populated on the manager's read, never the editor's. */
  history?: RevisionHistoryEntry[];
  /** S17 (PR7 slice 4) — the currently ACTIVE grant, if any; only the manager's read. */
  activeGrant?: ActiveGrantView | null;
}

/** S17 — a grant currently inside its [startsAt, expiresAt) window (never a PENDING/REJECTED/REVOKED/EXPIRED row). */
export interface ActiveGrantView {
  id: string;
  expiresAt: string;
  reason: string;
}

/**
 * S16/S21 (spec R10): metadata only — `kind`/`actorName`/`reason`/`committedAt`,
 * NEVER the revision's `valuesFull`/`diff`. Submitted data must only ever
 * surface through an endpoint that re-checks the caller's standing on THIS
 * report (this one does, via `loadAssignmentForManager`) — never through the
 * app-wide audit log, which only requires the unrelated `read:AuditLog`.
 */
export interface RevisionHistoryEntry {
  revision: string;
  kind: string;
  actorName: string;
  reason: string | null;
  committedAt: string;
}

export interface SaveValuesResult {
  revision: string;
  state: SubmissionState;
  savedAt: string;
  serverTime: string;
  effectiveLockAt: string | null;
}

/** S35 (PR6 slice 8) — one field the preview found a real difference on. */
export interface ImportDiffEntry {
  fieldKey: string;
  sheetKey: string;
  address: string;
  label: string;
  current: string | null;
  imported: string | null;
}

export interface ImportPreviewResult {
  /** Every field actually read from the uploaded sheets — ready to re-send to `applyExcelImport` unchanged. */
  values: Record<string, string | null>;
  diff: ImportDiffEntry[];
}

/** S34 — a pending reopen request, as the manager's queue shows it. */
export interface UnlockRequestView {
  id: string;
  assignmentId: string;
  reportName: string;
  periodKey: string;
  teamName: string;
  reason: string;
  requestedAt: string;
  requestedByName: string;
}

/** S34 — one row of a bulk grant attempt; a failure here never blocks the rest of the batch. */
export interface BulkGrantUnlockResult {
  granted: string[];
  skipped: Array<{ assignmentId: string; error: string }>;
}

export interface AssignmentSummary {
  assignmentId: string;
  reportId: string;
  periodId: string;
  reportName: string;
  teamName: string;
  periodKey: string;
  dueAt: string;
  state: SubmissionState;
}

/**
 * S37 (PR9 slice 2) — "Ghi chú/giải trình". `fieldKey` null = ghi chú cho
 * cả bản nộp; có giá trị = ghi chú riêng cho một ô. Append-only trong
 * slice này — không có đường sửa/xoá (giống lịch sử revision: một khi đã
 * ghi là giữ nguyên).
 */
/** An unlock request the caller made and that is still waiting for a manager. */
export interface PendingUnlockRequestView {
  id: string;
  reason: string;
  createdAt: string;
}

export interface CommentView {
  id: string;
  fieldKey: string | null;
  body: string;
  authorName: string;
  createdAt: string;
  /** Written by the caller: only the author edits a comment. */
  mine: boolean;
  /** The caller may delete it: its author, or a manager of the report. */
  canDelete: boolean;
  /** The period is closed: the comment is part of the closed record and stays as it is. */
  locked: boolean;
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
  private readonly logger = new Logger(SubmissionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly versionFieldsCache: VersionFieldsCacheService,
    private readonly templateExport: TemplateExportService,
  ) {}

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
          include: {
            report: true,
            // Never drag the uploaded .xlsx (up to 50 MB) in with every autosave.
            version: { omit: { fileBytes: true } },
          },
        },
        submission: true,
      },
    });
    if (!assignment || !assignment.submission) {
      throw new NotFoundException('Không tìm thấy lượt giao này.');
    }
    // Perf (X04 round 4) — `fields`/`rules` come from a per-versionId cache
    // instead of a per-call `include`: see `version-fields-cache.ts` for why
    // that's safe to do forever (version/field/rule rows are write-once).
    const { fields, rules } = await this.versionFieldsCache.getOrLoad(
      client,
      assignment.period.versionId,
    );
    return {
      ...assignment,
      period: {
        ...assignment.period,
        version: { ...assignment.period.version, fields, rules },
      },
    };
  }

  /**
   * S36 (PR9 slice 1) — defaults to the version's single selected sheet
   * when a rule's expression has no explicit "Sheet!Cell" prefix; with
   * more than one selected sheet there's no unambiguous default, so a
   * bare cell ref only resolves if the rule itself prefixes it.
   */
  private defaultSheetFor(selectedSheets: unknown): string | null {
    const sheets = Array.isArray(selectedSheets) ? selectedSheets : [];
    return sheets.length === 1 ? (sheets[0] as string) : null;
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
          include: { report: true, version: { omit: { fileBytes: true } } },
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
    // Perf (X04 round 4) — same version-fields cache as `loadEditorAssignment`;
    // `lockForManagerWrite` (approve/return/unapprove) holds the submission's
    // `FOR UPDATE` lock across this call just like `lockForWrite` does, so
    // the per-call `include: { fields: true }` was the same N-times-5,000-row
    // reload under lock, just on the manager side.
    const { fields, rules } = await this.versionFieldsCache.getOrLoad(
      client,
      assignment.period.versionId,
    );
    return {
      assignment: {
        ...assignment,
        period: {
          ...assignment.period,
          version: { ...assignment.period.version, fields, rules },
        },
      },
      actorRole,
    };
  }

  /**
   * S37 — comments are readable/writable by EITHER side of the same
   * assignment: the editor who owns it, or a manager/admin of its report.
   * Tries editor first (cheaper: one `findFirst` vs a role lookup), falls
   * back to manager — 404 (never 403) if neither, same anti-probe
   * convention as every other assignment-scoped read in this file.
   */
  private async resolveCommentAccess(
    client: Prisma.TransactionClient | PrismaService,
    assignmentId: string,
    userId: string,
    roleId: string,
  ) {
    const editor = await client.dynReportAssignmentEditor.findFirst({
      where: { assignmentId, userId, isActive: true },
    });
    const assignment = await client.dynReportAssignment.findUnique({
      where: { id: assignmentId },
      include: { period: { include: { report: true } } },
    });
    if (!assignment) {
      throw new NotFoundException('Không tìm thấy lượt giao này.');
    }
    if (editor) return assignment;

    const actorRole = await this.resolveManagerRole(
      client,
      assignment.period.report.id,
      userId,
      roleId,
    );
    if (!actorRole) {
      throw new NotFoundException('Không tìm thấy lượt giao này.');
    }
    return assignment;
  }

  /** S37 — mọi ghi chú của một lượt giao, cũ nhất trước (đọc thuần, không khoá). */
  async listComments(
    assignmentId: string,
    userId: string,
    roleId: string,
  ): Promise<CommentView[]> {
    const assignment = await this.resolveCommentAccess(this.prisma, assignmentId, userId, roleId);
    const comments = await this.prisma.dynReportComment.findMany({
      where: { assignmentId },
      include: { author: true },
      orderBy: { createdAt: 'asc' },
    });
    const locked = assignment.period.status === 'FINALIZED';
    const manager =
      comments.some((c) => c.authorId !== userId) &&
      (await this.resolveManagerRole(this.prisma, assignment.period.report.id, userId, roleId)) !== null;
    return comments.map((c) => ({
      id: c.id,
      fieldKey: c.fieldKey,
      body: c.body,
      authorName:
        `${c.author.firstName ?? ''} ${c.author.lastName ?? ''}`.trim() ||
        c.author.username,
      createdAt: c.createdAt.toISOString(),
      mine: c.authorId === userId,
      canDelete: !locked && (c.authorId === userId || manager),
      locked,
    }));
  }

  /** S37 — thêm một ghi chú (theo ô nếu có `fieldKey`, theo cả bản nộp nếu không). */
  async addComment(
    assignmentId: string,
    userId: string,
    roleId: string,
    fieldKey: string | null,
    body: string,
  ): Promise<CommentView> {
    if (!body.trim()) {
      throw new SubmissionError(
        'Nội dung ghi chú không được để trống.',
        'CELL_VALIDATION',
      );
    }
    await this.resolveCommentAccess(this.prisma, assignmentId, userId, roleId);
    const author = await this.prisma.user.findUnique({ where: { id: userId } });
    const comment = await this.prisma.dynReportComment.create({
      data: { assignmentId, fieldKey, body: body.trim(), authorId: userId },
    });
    return {
      id: comment.id,
      fieldKey: comment.fieldKey,
      body: comment.body,
      authorName:
        `${author?.firstName ?? ''} ${author?.lastName ?? ''}`.trim() ||
        author?.username ||
        '',
      createdAt: comment.createdAt.toISOString(),
      mine: true,
      canDelete: true,
      locked: false,
    };
  }

  /**
   * Design standard "created ⇒ can be taken back": the editor who asked for a reopening can withdraw the request while
   * it is still waiting. Nothing is deleted — the row becomes REVOKED with who and when, so the manager's queue
   * (PENDING only) no longer shows it and the history still does.
   */
  async withdrawUnlockRequest(assignmentId: string, userId: string): Promise<{ withdrawn: true }> {
    await this.loadEditorAssignment(this.prisma, assignmentId, userId);
    const done = await this.prisma.dynReportUnlock.updateMany({
      where: { assignmentId, kind: 'REQUEST', status: 'PENDING', requestedById: userId },
      data: {
        status: 'REVOKED',
        revokedById: userId,
        revokedAt: new Date(),
        revokeReason: 'Người yêu cầu đã rút lại',
      },
    });
    if (done.count === 0) {
      // Decided or withdrawn in the meantime: say so rather than pretend.
      throw new SubmissionError('Không còn yêu cầu mở lại nào đang chờ để rút lại.', 'INVALID_STATE_TRANSITION');
    }
    return { withdrawn: true };
  }

  /**
   * Finds one comment of this assignment for editing/deleting. A comment of an assignment the caller cannot see is
   * "not found" (same rule as listing); a closed period's comments are part of the closed record and stay as they are.
   */
  private async resolveEditableComment(
    tx: Prisma.TransactionClient,
    assignmentId: string,
    commentId: string,
    userId: string,
    roleId: string,
  ) {
    // Closing the period takes it FOR UPDATE; holding it FOR SHARE from here to the write means a comment cannot be
    // changed after the period closed, only before (and then it is part of what was closed).
    await tx.$queryRaw`
      SELECT p.id FROM dyn_report_periods p
      JOIN dyn_report_assignments a ON a."periodId" = p.id
      WHERE a.id = ${assignmentId} FOR SHARE OF p
    `;
    const assignment = await this.resolveCommentAccess(tx, assignmentId, userId, roleId);
    const comment = await tx.dynReportComment.findFirst({
      where: { id: commentId, assignmentId },
      include: { author: true },
    });
    if (!comment) throw new NotFoundException('Không tìm thấy ghi chú này.');
    if (assignment.period.status === 'FINALIZED') {
      throw new SubmissionError('Kỳ đã chốt — ghi chú không còn sửa hay xoá được.', 'REPORT_LOCKED');
    }
    return { assignment, comment };
  }

  /** Design standard "created ⇒ editable": the author can correct what they wrote. */
  async updateComment(
    assignmentId: string,
    commentId: string,
    userId: string,
    roleId: string,
    body: string,
  ): Promise<CommentView> {
    if (!body.trim()) {
      throw new SubmissionError('Nội dung ghi chú không được để trống.', 'CELL_VALIDATION');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const { comment } = await this.resolveEditableComment(tx, assignmentId, commentId, userId, roleId);
      if (comment.authorId !== userId) {
        throw new SubmissionError('Chỉ người viết mới sửa được ghi chú của mình.', 'NOT_AUTHOR');
      }
      return tx.dynReportComment.update({
        where: { id: commentId },
        data: { body: body.trim() },
        include: { author: true },
      });
    });
    return {
      id: updated.id,
      fieldKey: updated.fieldKey,
      body: updated.body,
      authorName: `${updated.author.firstName ?? ''} ${updated.author.lastName ?? ''}`.trim() || updated.author.username,
      createdAt: updated.createdAt.toISOString(),
      mine: true,
      canDelete: true,
      locked: false,
    };
  }

  /** …and delete it. A manager of the report may also remove someone else's comment (moderation). */
  async deleteComment(
    assignmentId: string,
    commentId: string,
    userId: string,
    roleId: string,
  ): Promise<{ deleted: true }> {
    await this.prisma.$transaction(async (tx) => {
      const { assignment, comment } = await this.resolveEditableComment(tx, assignmentId, commentId, userId, roleId);
      if (comment.authorId !== userId) {
        const manager = await this.resolveManagerRole(tx, assignment.period.report.id, userId, roleId);
        if (!manager) {
          throw new SubmissionError('Chỉ người viết hoặc quản lý báo cáo mới xoá được ghi chú này.', 'NOT_AUTHOR');
        }
      }
      await tx.dynReportComment.delete({ where: { id: commentId } });
    });
    return { deleted: true };
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
        reportId: a.period.reportId,
        periodId: a.period.id,
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

    // effectiveLockAt here means "when would this team's write window next
    // close" (hạn gốc hoặc hạn mở lại) for the manager to see — never
    // `canEdit`, which stays meaningless for a manager who never types into
    // cells (D10). Reuses the exact same engine call the editor's own GET
    // makes, just discarding `canEdit`.
    const grants = await this.grantsFor(this.prisma, assignmentId);
    const access = resolveAccess({
      state: submission.state,
      periodStatus: period.status as PeriodStatus,
      opensAt: period.opensAt,
      originalDueAt: period.dueAt,
      returnDueAt: submission.returnDueAt,
      grants,
      userActive: true,
      now,
    });

    const revisions = await this.prisma.dynReportRevision.findMany({
      where: { submissionId: submission.id },
      orderBy: { revision: 'asc' },
      select: {
        revision: true,
        kind: true,
        reason: true,
        committedAt: true,
        actor: { select: { firstName: true, lastName: true, username: true } },
      },
    });
    const history: RevisionHistoryEntry[] = revisions.map((r) => ({
      revision: r.revision.toString(),
      kind: r.kind,
      actorName:
        `${r.actor.firstName ?? ''} ${r.actor.lastName ?? ''}`.trim() ||
        r.actor.username,
      reason: r.reason,
      committedAt: r.committedAt.toISOString(),
    }));

    const activeGrant = await this.findActiveGrant(assignmentId, now);

    return {
      // A manager reads the team's submission; the request in question is the editor's own to withdraw.
      pendingUnlockRequest: null,
      assignmentId,
      versionId: period.versionId,
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
      effectiveLockAt: access.effectiveLockAt?.toISOString() ?? null,
      serverTime: now.toISOString(),
      updatedAt: submission.firstSavedAt
        ? submission.updatedAt.toISOString()
        : null,
      history,
      activeGrant,
    };
  }

  /**
   * S17 — the row the UI can offer "Thu hồi" on. Deliberately re-checks
   * the time window in JS rather than trusting `status: 'ACTIVE'` alone:
   * nothing yet sweeps an expired grant's status to `EXPIRED` (no
   * ReminderScheduler-style job exists for this), so an ACTIVE row past
   * its own `expiresAt` must still be treated as inactive here, exactly
   * like `engine/access.ts#activeGrant` already does for write access.
   */
  private async findActiveGrant(
    assignmentId: string,
    now: Date,
  ): Promise<ActiveGrantView | null> {
    const row = await this.prisma.dynReportUnlock.findFirst({
      where: { assignmentId, status: 'ACTIVE' },
      orderBy: { expiresAt: 'desc' },
    });
    if (!row) return null;
    if (now.getTime() < row.startsAt.getTime()) return null;
    if (now.getTime() >= row.expiresAt.getTime()) return null;
    return {
      id: row.id,
      expiresAt: row.expiresAt.toISOString(),
      reason: row.reason,
    };
  }

  /**
   * An unlock (a manager's grant, or a request they approve) extends the window of a submission that can still be
   * edited. A SUBMITTED one cannot be edited at all — the state machine leaves SUBMITTED only through RETURN (or
   * UNAPPROVE from APPROVED) — so a grant on it changed nothing: the manager saw an active grant, the editor still got
   * "locked" and 409 REPORT_LOCKED (found on production 13/10/2026).
   *
   * So opening a SUBMITTED submission IS returning it: same state (RETURNED), revision, history entry and deadline
   * rule as "Trả lại", with the grant's expiry as the new deadline. The editor corrects and submits again.
   *  - NOT_STARTED / DRAFT / RETURNED: nothing to do, the grant itself is what they need (a deadline already passed).
   *  - APPROVED: refused with what to do first; the caller's transaction rolls back, so a request stays PENDING.
   * Runs inside the caller's transaction: period FOR SHARE, then the submission FOR UPDATE (the module's lock order).
   */
  private async reopenForGrant(
    tx: Prisma.TransactionClient,
    assignmentId: string,
    actorId: string,
    actorRole: 'ADMIN' | 'MANAGER',
    expiresAt: Date,
    reason: string,
  ): Promise<bigint | null> {
    const periodRows = await tx.$queryRaw<{ status: string }[]>`
      SELECT status FROM "dyn_report_periods" WHERE id = (
        SELECT "periodId" FROM "dyn_report_assignments" WHERE id = ${assignmentId}
      ) FOR SHARE`;
    // The caller checked the period before this transaction; closing the period may have committed since.
    if (periodRows[0] && periodRows[0].status !== 'OPEN') {
      throw new SubmissionError('Kỳ đã chốt, không thể mở khoá.', 'REPORT_LOCKED');
    }
    await tx.$queryRaw`
      SELECT id FROM "dyn_report_submissions" WHERE "assignmentId" = ${assignmentId} FOR UPDATE`;
    const submission = await tx.dynReportSubmission.findUnique({ where: { assignmentId } });
    if (!submission) return null;
    if (submission.state === 'APPROVED') {
      throw new SubmissionError(
        'Bản này đã được duyệt. Hãy "Huỷ duyệt" trước, rồi mở lại để người nhập sửa.',
        'INVALID_STATE_TRANSITION',
      );
    }
    if (submission.state !== 'SUBMITTED') return null;

    const transition = applyTransition('RETURN', {
      state: submission.state,
      approvalLevel: submission.approvalLevel,
      totalApprovalLevels: 1,
      actorRole,
      hasRequiredFieldsValid: true,
      hasErrorSeverityRuleViolation: false,
    });
    if (!transition.ok) throw new SubmissionError(transition.message, transition.code);

    const nextRevision = submission.currentRevision + BigInt(1);
    await tx.dynReportSubmission.update({
      where: { assignmentId },
      data: {
        state: transition.next,
        currentRevision: nextRevision,
        approvalLevel: transition.nextApprovalLevel,
        returnedReason: reason,
        returnDueAt: expiresAt,
      },
    });
    await tx.dynReportRevision.create({
      data: {
        submissionId: submission.id,
        revision: nextRevision,
        kind: transition.revisionKind,
        valuesFull: (submission.values ?? {}) as Prisma.InputJsonValue,
        actorId,
        reason,
      },
    });
    return nextRevision;
  }

  /** S17 — manager extends a team's write window past where it would otherwise be blocked (D07). */
  async grantUnlock(
    assignmentId: string,
    userId: string,
    roleId: string,
    reason: string,
    expiresAt?: string,
  ): Promise<ActiveGrantView> {
    const { assignment, actorRole } = await this.loadAssignmentForManager(
      this.prisma,
      assignmentId,
      userId,
      roleId,
    );
    if (assignment.period.status !== 'OPEN') {
      throw new SubmissionError(
        'Kỳ đã chốt, không thể mở khoá.',
        'REPORT_LOCKED',
      );
    }

    const now = new Date();
    const resolvedExpiresAt = expiresAt
      ? new Date(expiresAt)
      : new Date(now.getTime() + DEFAULT_GRANT_HOURS * 60 * 60 * 1000);
    if (resolvedExpiresAt.getTime() <= now.getTime()) {
      throw new SubmissionError(
        'Hạn mở khoá phải ở trong tương lai.',
        'CELL_VALIDATION',
      );
    }

    const unlock = await this.prisma.$transaction(async (tx) => {
      // A submission already handed in is returned first (see `reopenForGrant`); an approved one is refused here.
      const reopenedRevision = await this.reopenForGrant(tx, assignmentId, userId, actorRole, resolvedExpiresAt, reason);
      return tx.dynReportUnlock.create({
        data: {
          assignmentId,
          kind: 'GRANT',
          status: 'ACTIVE',
          startsAt: now,
          expiresAt: resolvedExpiresAt,
          reason,
          decidedById: userId,
          reopenedRevision,
        },
      });
    });

    const toUserIds = await this.activeEditorIds(this.prisma, assignmentId);
    if (toUserIds.length > 0) {
      this.eventEmitter.emit(
        'dyn-report.unlock-granted',
        new DynReportUnlockGrantedEvent(
          assignmentId,
          assignment.period.report.name,
          assignment.period.periodKey,
          toUserIds,
          resolvedExpiresAt.toISOString(),
        ),
      );
    }

    return {
      id: unlock.id,
      expiresAt: unlock.expiresAt.toISOString(),
      reason: unlock.reason,
    };
  }

  /** S17/S31 — manager revokes the currently active grant on this assignment (BRD: thu hồi có lý do). */
  async revokeActiveGrant(
    assignmentId: string,
    userId: string,
    roleId: string,
    reason: string,
  ): Promise<void> {
    await this.loadAssignmentForManager(
      this.prisma,
      assignmentId,
      userId,
      roleId,
    );

    const now = new Date();
    const activeGrant = await this.findActiveGrant(assignmentId, now);
    if (!activeGrant) {
      throw new SubmissionError(
        'Không có lượt mở khoá nào đang hiệu lực để thu hồi.',
        'CELL_VALIDATION',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // The module's lock order (period, then submission) before the unlock row, as deleting a period does.
      await tx.$queryRaw`
        SELECT id FROM "dyn_report_periods" WHERE id = (
          SELECT "periodId" FROM "dyn_report_assignments" WHERE id = ${assignmentId}
        ) FOR SHARE`;
      await tx.$queryRaw`
        SELECT id FROM "dyn_report_submissions" WHERE "assignmentId" = ${assignmentId} FOR UPDATE`;
      await tx.dynReportUnlock.update({
        where: { id: activeGrant.id },
        data: {
          status: 'REVOKED',
          revokedById: userId,
          revokedAt: now,
          revokeReason: reason,
        },
      });
      // A grant on a handed-in submission worked by returning it with the grant's expiry as the deadline; revoking
      // the grant must close that window too, or the editor would keep typing until the original expiry. Only the
      // return this very grant made (nothing saved since): a return a manager issued on its own keeps its deadline.
      const madeReturn = await tx.dynReportUnlock.findUnique({
        where: { id: activeGrant.id },
        select: { reopenedRevision: true },
      });
      if (madeReturn?.reopenedRevision != null) {
        await tx.dynReportSubmission.updateMany({
          where: {
            assignmentId,
            state: 'RETURNED',
            currentRevision: madeReturn.reopenedRevision,
            returnDueAt: new Date(activeGrant.expiresAt),
          },
          data: { returnDueAt: now },
        });
      }
    });
  }

  /**
   * S34 — the editor-side half: a team asks its manager to reopen a locked
   * assignment, instead of only the manager being able to initiate a grant
   * (S17). `startsAt`/`expiresAt` are placeholders (schema has no nullable
   * window for a not-yet-decided request) — `findActiveGrant` only ever
   * queries `status: 'ACTIVE'`, so a PENDING row's window is never read.
   */
  async requestUnlock(
    assignmentId: string,
    userId: string,
    reason: string,
  ): Promise<UnlockRequestView> {
    const assignment = await this.loadEditorAssignment(
      this.prisma,
      assignmentId,
      userId,
    );
    if (assignment.period.status !== 'OPEN') {
      throw new SubmissionError(
        'Kỳ đã chốt, không thể xin mở lại.',
        'REPORT_LOCKED',
      );
    }

    const existing = await this.prisma.dynReportUnlock.findFirst({
      where: { assignmentId, kind: 'REQUEST', status: 'PENDING' },
    });
    if (existing) {
      throw new SubmissionError(
        'Đã có yêu cầu mở lại đang chờ duyệt cho lượt giao này.',
        'CELL_VALIDATION',
      );
    }

    const now = new Date();
    const [unlock, requester] = await Promise.all([
      this.prisma.dynReportUnlock.create({
        data: {
          assignmentId,
          kind: 'REQUEST',
          status: 'PENDING',
          startsAt: now,
          expiresAt: now,
          reason,
          requestedById: userId,
        },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true, username: true },
      }),
    ]);
    const requestedByName = requester
      ? `${requester.firstName ?? ''} ${requester.lastName ?? ''}`.trim() ||
        requester.username
      : '';

    const toUserIds = await this.managerIds(
      this.prisma,
      assignment.period.report.id,
    );
    if (toUserIds.length > 0) {
      this.eventEmitter.emit(
        'dyn-report.unlock-requested',
        new DynReportUnlockRequestedEvent(
          assignmentId,
          assignment.period.report.name,
          assignment.period.periodKey,
          toUserIds,
          requestedByName,
          reason,
        ),
      );
    }

    return {
      id: unlock.id,
      assignmentId,
      reportName: assignment.period.report.name,
      periodKey: assignment.period.periodKey,
      teamName:
        (assignment.teamSnapshot as { name?: string } | null)?.name ??
        assignment.teamId,
      reason: unlock.reason,
      requestedAt: unlock.createdAt.toISOString(),
      requestedByName,
    };
  }

  /** S34 — the manager's queue: every still-PENDING request across every report they manage (or all, if admin). */
  async listPendingRequests(
    userId: string,
    roleId: string,
  ): Promise<UnlockRequestView[]> {
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

    const requests = await this.prisma.dynReportUnlock.findMany({
      where: {
        kind: 'REQUEST',
        status: 'PENDING',
        assignment: { period: { reportId: { in: reportIds } } },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        requestedBy: {
          select: { firstName: true, lastName: true, username: true },
        },
        assignment: {
          include: { period: { include: { report: true } } },
        },
      },
    });

    return requests.map((r) => ({
      id: r.id,
      assignmentId: r.assignmentId,
      reportName: r.assignment.period.report.name,
      periodKey: r.assignment.period.periodKey,
      teamName:
        (r.assignment.teamSnapshot as { name?: string } | null)?.name ??
        r.assignment.teamId,
      reason: r.reason,
      requestedAt: r.createdAt.toISOString(),
      requestedByName: r.requestedBy
        ? `${r.requestedBy.firstName ?? ''} ${r.requestedBy.lastName ?? ''}`.trim() ||
          r.requestedBy.username
        : '',
    }));
  }

  /** S34 — manager approves (promotes the request straight to an ACTIVE grant) or rejects it. */
  async decideRequest(
    unlockId: string,
    userId: string,
    roleId: string,
    decision: 'APPROVE' | 'REJECT',
    decisionReason?: string,
    expiresAt?: string,
  ): Promise<void> {
    const row = await this.prisma.dynReportUnlock.findUnique({
      where: { id: unlockId },
      include: {
        assignment: { include: { period: { include: { report: true } } } },
      },
    });
    if (!row || row.kind !== 'REQUEST') {
      throw new NotFoundException('Không tìm thấy yêu cầu mở lại này.');
    }
    const actorRole = await this.resolveManagerRole(
      this.prisma,
      row.assignment.period.report.id,
      userId,
      roleId,
    );
    if (!actorRole) {
      throw new NotFoundException('Không tìm thấy yêu cầu mở lại này.');
    }
    if (row.status !== 'PENDING') {
      throw new SubmissionError(
        'Yêu cầu này đã được xử lý trước đó.',
        'CELL_VALIDATION',
      );
    }

    if (decision === 'REJECT') {
      if (!decisionReason || !decisionReason.trim()) {
        throw new SubmissionError(
          'Phải nhập lý do khi từ chối yêu cầu mở lại.',
          'CELL_VALIDATION',
        );
      }
      await this.leavePending(unlockId, { status: 'REJECTED', decidedById: userId, decisionReason });
      return;
    }

    const now = new Date();
    const resolvedExpiresAt = expiresAt
      ? new Date(expiresAt)
      : new Date(now.getTime() + DEFAULT_GRANT_HOURS * 60 * 60 * 1000);
    if (resolvedExpiresAt.getTime() <= now.getTime()) {
      throw new SubmissionError(
        'Hạn mở khoá phải ở trong tương lai.',
        'CELL_VALIDATION',
      );
    }
    // One transaction: the request becomes an active grant AND a handed-in submission is returned (see
    // `reopenForGrant`). If the submission cannot be reopened (approved), nothing changes and the request stays PENDING.
    await this.prisma.$transaction(async (tx) => {
      const reopenedRevision = await this.reopenForGrant(
        tx,
        row.assignmentId,
        userId,
        actorRole,
        resolvedExpiresAt,
        decisionReason?.trim() || row.reason,
      );
      await this.leavePending(
        unlockId,
        {
          status: 'ACTIVE',
          startsAt: now,
          expiresAt: resolvedExpiresAt,
          decidedById: userId,
          decisionReason,
          reopenedRevision,
        },
        tx,
      );
    });
  }

  /**
   * A request leaves PENDING exactly once: a manager's decision and the editor's withdrawal both go through a write
   * conditioned on PENDING, so when they race one wins and the other is told the request is no longer waiting —
   * never an "approved" row carrying a withdrawal's timestamp.
   */
  private async leavePending(
    unlockId: string,
    data: Prisma.DynReportUnlockUncheckedUpdateManyInput,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<void> {
    const moved = await client.dynReportUnlock.updateMany({
      where: { id: unlockId, kind: 'REQUEST', status: 'PENDING' },
      data,
    });
    if (moved.count === 0) {
      throw new SubmissionError('Yêu cầu này đã được xử lý hoặc đã được rút lại.', 'INVALID_STATE_TRANSITION');
    }
  }

  /**
   * S34 — grant a window to several assignments in one call (e.g. every
   * still-overdue team after a deadline). Each assignment is checked and
   * written independently: one out-of-scope or already-finalized id is
   * reported in `skipped`, never aborts the whole batch.
   */
  async bulkGrantUnlock(
    assignmentIds: string[],
    userId: string,
    roleId: string,
    reason: string,
    expiresAt?: string,
  ): Promise<BulkGrantUnlockResult> {
    const bulkBatchId = randomUUID();
    const granted: string[] = [];
    const skipped: Array<{ assignmentId: string; error: string }> = [];

    for (const assignmentId of assignmentIds) {
      try {
        const { assignment, actorRole } = await this.loadAssignmentForManager(
          this.prisma,
          assignmentId,
          userId,
          roleId,
        );
        if (assignment.period.status !== 'OPEN') {
          throw new SubmissionError(
            'Kỳ đã chốt, không thể mở khoá.',
            'REPORT_LOCKED',
          );
        }

        const now = new Date();
        const resolvedExpiresAt = expiresAt
          ? new Date(expiresAt)
          : new Date(now.getTime() + DEFAULT_GRANT_HOURS * 60 * 60 * 1000);
        if (resolvedExpiresAt.getTime() <= now.getTime()) {
          throw new SubmissionError(
            'Hạn mở khoá phải ở trong tương lai.',
            'CELL_VALIDATION',
          );
        }

        await this.prisma.$transaction(async (tx) => {
          // One that cannot be reopened (an approved one) is reported in `skipped` with the reason.
          const reopenedRevision = await this.reopenForGrant(tx, assignmentId, userId, actorRole, resolvedExpiresAt, reason);
          await tx.dynReportUnlock.create({
            data: {
              assignmentId,
              kind: 'GRANT',
              status: 'ACTIVE',
              startsAt: now,
              expiresAt: resolvedExpiresAt,
              reason,
              decidedById: userId,
              bulkBatchId,
              reopenedRevision,
            },
          });
        });
        granted.push(assignmentId);
      } catch (err) {
        const message =
          err instanceof SubmissionError || err instanceof NotFoundException
            ? err.message
            : 'Không mở khoá được lượt giao này.';
        skipped.push({ assignmentId, error: message });
      }
    }

    return { granted, skipped };
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
          reportId: assignment.period.reportId,
          periodId: assignment.period.id,
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
    const pending = await this.prisma.dynReportUnlock.findFirst({
      where: { assignmentId, kind: 'REQUEST', status: 'PENDING', requestedById: userId },
      orderBy: { createdAt: 'desc' },
    });

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
      pendingUnlockRequest: pending
        ? { id: pending.id, reason: pending.reason, createdAt: pending.createdAt.toISOString() }
        : null,
      assignmentId,
      versionId: period.versionId,
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
      updatedAt: submission.firstSavedAt
        ? submission.updatedAt.toISOString()
        : null,
    };
  }

  /**
   * "Xuất bản của tổ" — an editor's own export of their team's current values
   * for this period: the report's ORIGINAL template with the numbers filled in
   * (same merged cells, borders, fonts, widths, formulas), so it can be sent
   * on or filed as the form it always was. Scoped to exactly one assignment
   * the caller is an active editor of.
   *
   * If the template cannot be loaded or rewritten (the grid is too large, the
   * worker is busy or timed out, the file is damaged) the export still
   * succeeds with a plain list of "indicator, value" rows rather than failing
   * at the moment someone needs the numbers; the problem is logged.
   */
  async exportOwnSubmission(
    assignmentId: string,
    userId: string,
  ): Promise<{ fileBuffer: Buffer; fileName: string; format: 'TEMPLATE' | 'LIST' }> {
    const assignment = await this.loadEditorAssignment(
      this.prisma,
      assignmentId,
      userId,
    );
    const { period, submission } = assignment;
    if (!submission)
      throw new NotFoundException('Không tìm thấy lượt giao này.');

    const teamSnapshot = assignment.teamSnapshot as { name?: string } | null;
    const teamName = teamSnapshot?.name || assignment.teamId;
    const values = (submission.values ?? {}) as Record<
      string,
      { t: string; v: string | null } | undefined
    >;

    let fileBuffer: Buffer;
    let format: 'TEMPLATE' | 'LIST' = 'TEMPLATE';
    try {
      fileBuffer = await this.templateExport.buildTeamFile({
        versionId: period.versionId,
        fields: period.version.fields.map((f) => ({
          sheetKey: f.sheetKey,
          address: f.address,
          fieldKey: f.fieldKey,
          type: f.type as ImportCellType,
        })),
        values: Object.fromEntries(
          period.version.fields.map((f) => [f.fieldKey, values[f.fieldKey]?.v ?? null]),
        ),
        meta: {
          kind: 'TEAM',
          reportId: period.report.id,
          versionId: period.versionId,
          periodKey: period.periodKey,
          assignmentId,
          teamId: assignment.teamId,
          exportedAt: new Date().toISOString(),
        },
      });
    } catch (err) {
      this.logger.warn(
        `Xuất theo mẫu thất bại cho lượt giao ${assignmentId}, dùng dạng danh sách: ${err instanceof Error ? err.message : String(err)}`,
      );
      format = 'LIST';
      fileBuffer = await this.buildListWorkbook(
        period.version.fields,
        values,
        { reportName: period.report.name, teamName, periodKey: period.periodKey, state: submission.state },
      );
    }

    const fileName = `${sanitizeFileNamePart(period.report.name)}-${sanitizeFileNamePart(teamName)}-${period.periodKey}.xlsx`;
    return { fileBuffer, fileName, format };
  }

  /** The plain "Sheet / Chỉ tiêu / Giá trị" workbook: the fallback when the template itself cannot be used. */
  private async buildListWorkbook(
    fields: ReadonlyArray<{ fieldKey: string; sheetKey: string; label: string | null }>,
    values: Record<string, { t: string; v: string | null } | undefined>,
    info: { reportName: string; teamName: string; periodKey: string; state: string },
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(sanitizeSheetName(info.teamName));
    sheet.columns = [
      { header: 'Sheet', key: 'sheetKey', width: 20 },
      { header: 'Chỉ tiêu', key: 'label', width: 32 },
      { header: 'Giá trị', key: 'value', width: 18 },
    ];
    for (const f of fields) {
      const typed = values[f.fieldKey];
      sheet.addRow({
        sheetKey: f.sheetKey,
        label: escapeXlsxCell(f.label || f.fieldKey),
        value:
          typed?.t === 'TEXT' ? escapeXlsxCell(typed.v) : (typed?.v ?? null),
      });
    }

    const metaSheet = workbook.addWorksheet('Metadata');
    metaSheet.addRow(['Báo cáo', info.reportName]);
    metaSheet.addRow(['Tổ', info.teamName]);
    metaSheet.addRow(['Kỳ', info.periodKey]);
    metaSheet.addRow(['Trạng thái', info.state]);
    metaSheet.addRow(['Xuất lúc', new Date().toISOString()]);

    return Buffer.from(await workbook.xlsx.writeBuffer());
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

    // `AT TIME ZONE 'UTC'` on purpose: the bare `clock_timestamp()` is a timestamptz, and the driver reads it as if its
    // wall-clock digits were UTC — on a server whose TimeZone is Asia/Ho_Chi_Minh (production's) that is 7 hours ahead,
    // so a 3-hour unlock window had already "expired" when the editor tried to save (found 13/10/2026).
    const nowRow = await tx.$queryRaw<
      { now: Date }[]
    >`SELECT (clock_timestamp() AT TIME ZONE 'UTC') AS now`;
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

  /** S26 — hashes everything the idempotency key must stay pinned to (everything but the key itself). */
  private saveRequestHash(
    assignmentId: string,
    patch: Record<string, string | null>,
    expectedRevision: string,
  ): string {
    const hash = createHash('sha256');
    hash.update(JSON.stringify({ assignmentId, patch, expectedRevision }));
    return hash.digest('hex');
  }

  async save(
    assignmentId: string,
    userId: string,
    patch: Record<string, string | null>,
    expectedRevision: string,
    idempotencyKey?: string,
  ): Promise<SaveValuesResult> {
    return this.prisma.$transaction(async (tx) => {
      const requestHash = idempotencyKey
        ? this.saveRequestHash(assignmentId, patch, expectedRevision)
        : null;
      if (idempotencyKey) {
        const existing = await tx.dynReportIdempotency.findUnique({
          where: {
            actorId_action_key: {
              actorId: userId,
              action: SAVE_IDEMPOTENCY_ACTION,
              key: idempotencyKey,
            },
          },
        });
        if (existing) {
          if (existing.requestHash !== requestHash) {
            throw new SubmissionError(
              'Mã idempotency đã dùng cho một yêu cầu khác.',
              'IDEMPOTENCY_MISMATCH',
            );
          }
          if (existing.resultRef) {
            return JSON.parse(existing.resultRef) as SaveValuesResult;
          }
        }
      }

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
            // A draft may hold a blank in a required cell; submit() is where required-ness is enforced.
            required: false,
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

      const result: SaveValuesResult = {
        revision: nextRevision.toString(),
        state: transition.next,
        savedAt: now.toISOString(),
        serverTime: now.toISOString(),
        effectiveLockAt: nextAccess.effectiveLockAt?.toISOString() ?? null,
      };

      if (idempotencyKey && requestHash) {
        await tx.dynReportIdempotency.upsert({
          where: {
            actorId_action_key: {
              actorId: userId,
              action: SAVE_IDEMPOTENCY_ACTION,
              key: idempotencyKey,
            },
          },
          create: {
            actorId: userId,
            action: SAVE_IDEMPOTENCY_ACTION,
            key: idempotencyKey,
            requestHash,
            resultRef: JSON.stringify(result),
            status: 'COMPLETED',
            expiresAt: new Date(now.getTime() + SAVE_IDEMPOTENCY_TTL_MS),
          },
          update: {
            resultRef: JSON.stringify(result),
            status: 'COMPLETED',
          },
        });
      }

      return result;
    });
  }

  /**
   * S35 (PR6 slice 8) — pre-check-only (no DB write): parses the uploaded
   * workbook and reads this version's own fields back out of it, matched
   * by `sheetKey`/`address` exactly as `DynReportField` already records
   * them (R8 fallback path: no `__dr_meta` marker check — nothing ever
   * exported a file carrying one yet, so the only real option today is
   * "structure must match the recorded layout", which this already does
   * by requiring every field's own sheet to exist and every field's own
   * cell to parse as its declared type). A field whose cell can't be read
   * as its declared type rejects the WHOLE file (CELL_VALIDATION) — same
   * "từ chối nguyên khối" convention `engine/paste.ts` already uses for a
   * TSV paste with one bad cell.
   */
  async previewExcelImport(
    assignmentId: string,
    userId: string,
    buffer: Buffer,
  ): Promise<ImportPreviewResult> {
    const assignment = await this.loadEditorAssignment(
      this.prisma,
      assignmentId,
      userId,
    );
    const { period, submission } = assignment;
    if (!submission)
      throw new NotFoundException('Không tìm thấy lượt giao này.');

    try {
      await assertMagicBytes(buffer);
      assertCompressedSize(buffer);
      assertNoZipBomb(buffer);
    } catch (err) {
      if (err instanceof HostileXlsxError) {
        throw new SubmissionError(err.message, 'TEMPLATE_INVALID');
      }
      throw err;
    }

    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    } catch {
      throw new SubmissionError(
        'Không đọc được file Excel — vui lòng kiểm tra lại file.',
        'TEMPLATE_INVALID',
      );
    }

    // A file the system itself exported says what it is. One from another template version, report or team
    // would put figures into the wrong cells without a single error, so it is refused with a plain reason.
    const meta = readExportMeta(workbook);
    if (meta) {
      // A manager's file holds the totals and every team: whichever team's copy a reader picked, importing it
      // would put somebody else's numbers into this assignment.
      if (meta.kind === 'PERIOD') {
        throw new SubmissionError(
          'File này là bản tổng hợp của quản lý (gồm số liệu của nhiều tổ) nên không nhập lại được. Hãy bấm "Xuất Excel" ở chính lượt giao này để lấy file của tổ.',
          'TEMPLATE_INVALID',
        );
      }
      if (meta.versionId && meta.versionId !== period.versionId) {
        throw new SubmissionError(
          'File này được xuất từ một phiên bản mẫu khác với kỳ báo cáo này. Hãy bấm "Xuất Excel" ở kỳ này để lấy file đúng.',
          'TEMPLATE_INVALID',
        );
      }
      if (meta.assignmentId && meta.assignmentId !== assignmentId) {
        throw new SubmissionError(
          'File này được xuất cho một lượt giao khác (kỳ hoặc tổ khác). Hãy dùng file xuất từ chính lượt giao đang mở.',
          'TEMPLATE_INVALID',
        );
      }
    }

    const currentValues =
      (submission.values as Record<string, TypedValue>) ?? {};
    const values: Record<string, string | null> = {};
    const diff: ImportDiffEntry[] = [];
    const missingSheets = new Set<string>();
    const unreadableCells: string[] = [];

    for (const field of period.version.fields) {
      const sheet = workbook.getWorksheet(field.sheetKey);
      if (!sheet) {
        missingSheets.add(field.sheetKey);
        continue;
      }
      const cell = sheet.getCell(field.address);
      const raw = readImportCellRaw(cell, field.type as ImportCellType);
      if (raw === undefined) {
        unreadableCells.push(
          `${field.sheetKey}!${field.address} (${field.label || field.fieldKey})`,
        );
        continue;
      }
      const result = validateFieldValue(
        {
          type: field.type as FieldDefinitionLike['type'],
          // A draft may hold a blank in a required cell; submit() is where required-ness is enforced.
          required: false,
          min: field.min?.toString(),
          max: field.max?.toString(),
          scale: field.scale ?? undefined,
          maxLength: field.maxLength ?? undefined,
        },
        raw,
      );
      if (!result.ok) {
        unreadableCells.push(
          `${field.sheetKey}!${field.address} (${field.label || field.fieldKey}): ${result.error.message}`,
        );
        continue;
      }

      values[field.fieldKey] = raw;
      const currentRaw = currentValues[field.fieldKey]?.v ?? null;
      if (currentRaw !== raw) {
        diff.push({
          fieldKey: field.fieldKey,
          sheetKey: field.sheetKey,
          address: field.address,
          label: field.label || field.fieldKey,
          current: currentRaw,
          imported: raw,
        });
      }
    }

    if (missingSheets.size > 0) {
      throw new SubmissionError(
        `File thiếu sheet: ${Array.from(missingSheets).join(', ')}.`,
        'TEMPLATE_INVALID',
      );
    }
    if (unreadableCells.length > 0) {
      throw new SubmissionError(
        `Không đọc được ${unreadableCells.length} ô: ${unreadableCells.slice(0, 5).join('; ')}${unreadableCells.length > 5 ? '…' : ''}.`,
        'CELL_VALIDATION',
      );
    }

    return { values, diff };
  }

  /**
   * S35 — commits the resolved values from `previewExcelImport` as ONE
   * atomic batch, kind=IMPORT with a FULL snapshot (R9: never a diff,
   * same rule SUBMIT/APPROVE/etc already follow) so the whole imported
   * state is reconstructable from this one revision alone. Re-validates
   * every value again (defense in depth — never trusts an echoed client
   * payload, even one that originated from this server's own preview).
   */
  async applyExcelImport(
    assignmentId: string,
    userId: string,
    values: Record<string, string | null>,
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
      const validated: Record<string, TypedValue> = {};
      for (const [fieldKey, raw] of Object.entries(values)) {
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
            // A draft may hold a blank in a required cell; submit() is where required-ness is enforced.
            required: false,
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
        validated[fieldKey] = result.value;
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
        ...validated,
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
          kind: 'IMPORT',
          valuesFull: mergedValues as Prisma.InputJsonValue,
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
   * S36 (PR9 slice 1) — real rule evaluation, reused by both `submit()`
   * (ERROR-severity only, blocking) and `validateForSubmit()` (every
   * severity, read-only preview for the "Nộp" confirm flow).
   */
  private evaluateRulesFor(
    rules: Array<{
      id: string;
      name: string;
      leftExpr: string;
      operator: string;
      rightExpr: string;
      severity: string;
      message: string;
      missingStrategy: string | null;
    }>,
    values: Record<string, TypedValue>,
    selectedSheets: unknown,
  ): RuleViolation[] {
    return evaluateRules(
      rules.map((r) => ({
        id: r.id,
        name: r.name,
        leftExpr: r.leftExpr,
        operator: r.operator as RuleOperator,
        rightExpr: r.rightExpr,
        severity: r.severity as 'ERROR' | 'WARNING',
        message: r.message,
        missingStrategy: r.missingStrategy,
      })),
      values,
      this.defaultSheetFor(selectedSheets),
    );
  }

  /**
   * S36 — read-only preview of validation-rule violations for the "Nộp"
   * confirm flow: ERROR-severity blocks (mirrors what `submit()` itself
   * will reject), WARNING-severity is shown so the editor can confirm
   * before calling `submit()` — the server does not require a
   * confirmation flag back, because WARNING is a UX nicety, not a
   * security boundary (`submit()` only ever blocks on ERROR).
   */
  async validateForSubmit(
    assignmentId: string,
    userId: string,
  ): Promise<{ errors: RuleViolation[]; warnings: RuleViolation[] }> {
    const assignment = await this.loadEditorAssignment(
      this.prisma,
      assignmentId,
      userId,
    );
    const values =
      (assignment.submission!.values as Record<string, TypedValue>) ?? {};
    const violations = this.evaluateRulesFor(
      assignment.period.version.rules,
      values,
      assignment.period.version.selectedSheets,
    );
    return {
      errors: violations.filter((v) => v.severity === 'ERROR'),
      warnings: violations.filter((v) => v.severity === 'WARNING'),
    };
  }

  /**
   * S29 (spec §6.1 PR6). Takes no value patch — the frontend flushes any
   * pending autosave before calling this, same as the spec's own "chờ
   * autosave xong" requirement.
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
      const errorViolations = this.evaluateRulesFor(
        period.version.rules,
        values,
        period.version.selectedSheets,
      ).filter((v) => v.severity === 'ERROR');
      const hasErrorSeverityRuleViolation = errorViolations.length > 0;

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
        if (hasErrorSeverityRuleViolation) {
          throw new SubmissionError(
            `Còn ${errorViolations.length} quy tắc kiểm tra mức lỗi chưa đạt: ${errorViolations
              .map((v) => v.name)
              .join(', ')}`,
            'VALIDATION_RULE_FAILED',
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

    // `AT TIME ZONE 'UTC'` on purpose: the bare `clock_timestamp()` is a timestamptz, and the driver reads it as if its
    // wall-clock digits were UTC — on a server whose TimeZone is Asia/Ho_Chi_Minh (production's) that is 7 hours ahead,
    // so a 3-hour unlock window had already "expired" when the editor tried to save (found 13/10/2026).
    const nowRow = await tx.$queryRaw<
      { now: Date }[]
    >`SELECT (clock_timestamp() AT TIME ZONE 'UTC') AS now`;
    const now = nowRow[0].now;

    if (submission.currentRevision.toString() !== expectedRevision) {
      throw new SubmissionError(
        'Bản nộp đã bị sửa bởi một phiên khác — tải lại để lấy bản mới nhất.',
        'REVISION_CONFLICT',
      );
    }

    return { submission, now, actorRole, assignment };
  }

  /** PR9 slice 3 — active editors of an assignment, for notification recipients. */
  private async activeEditorIds(
    client: Prisma.TransactionClient | PrismaService,
    assignmentId: string,
  ): Promise<string[]> {
    const editors = await client.dynReportAssignmentEditor.findMany({
      where: { assignmentId, isActive: true },
      select: { userId: true },
    });
    return editors.map((e) => e.userId);
  }

  /**
   * R21 — how many levels this report's approval chain requires: the
   * highest `approvalLevel` configured among its active MANAGER roles.
   * Reports that never set a level stay at the default 1 (single-level,
   * unchanged behavior).
   */
  private async resolveTotalApprovalLevels(
    client: Prisma.TransactionClient | PrismaService,
    reportId: string,
  ): Promise<number> {
    const now = new Date();
    const result = await client.dynReportRole.aggregate({
      where: {
        reportId,
        role: 'MANAGER',
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
      _max: { approvalLevel: true },
    });
    return result._max.approvalLevel ?? 1;
  }

  /**
   * R21 — the level the acting manager is authorized to act at. ADMIN acts
   * via `admin:DynamicReport` oversight, not a `DynReportRole` row, so it
   * is treated as holding whichever level is currently required
   * (`pendingLevel`) rather than being blocked by a chain it isn't part of.
   */
  private async resolveActingApprovalLevel(
    client: Prisma.TransactionClient | PrismaService,
    reportId: string,
    userId: string,
    actorRole: 'ADMIN' | 'MANAGER',
    pendingLevel: number,
  ): Promise<number> {
    if (actorRole === 'ADMIN') return pendingLevel;
    const now = new Date();
    const managerRole = await client.dynReportRole.findFirst({
      where: {
        reportId,
        userId,
        role: 'MANAGER',
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
      select: { approvalLevel: true },
    });
    return managerRole?.approvalLevel ?? 1;
  }

  /** PR9 slice 3 — every active manager/admin of a report, for notification recipients. */
  private async managerIds(
    client: Prisma.TransactionClient | PrismaService,
    reportId: string,
  ): Promise<string[]> {
    const now = new Date();
    const roles = await client.dynReportRole.findMany({
      where: {
        reportId,
        role: 'MANAGER',
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
      select: { userId: true },
    });
    return roles.map((r) => r.userId);
  }

  /** S33 — manager approves a SUBMITTED submission. */
  async approve(
    assignmentId: string,
    userId: string,
    roleId: string,
    expectedRevision: string,
    reason?: string,
  ): Promise<SaveValuesResult> {
    const { result, notify } = await this.prisma.$transaction(async (tx) => {
      const { submission, now, actorRole, assignment } =
        await this.lockForManagerWrite(
          tx,
          assignmentId,
          userId,
          roleId,
          expectedRevision,
        );

      const reportId = assignment.period.report.id;
      const totalApprovalLevels = await this.resolveTotalApprovalLevels(
        tx,
        reportId,
      );
      const actingApprovalLevel = await this.resolveActingApprovalLevel(
        tx,
        reportId,
        userId,
        actorRole,
        submission.approvalLevel + 1,
      );

      const transition = applyTransition('APPROVE', {
        state: submission.state,
        approvalLevel: submission.approvalLevel,
        totalApprovalLevels,
        actorRole,
        actingApprovalLevel,
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

      const notify =
        transition.next === 'APPROVED'
          ? {
              toUserIds: await this.activeEditorIds(tx, assignmentId),
              reportName: assignment.period.report.name,
              periodKey: assignment.period.periodKey,
            }
          : null;

      return {
        result: {
          revision: nextRevision.toString(),
          state: transition.next,
          savedAt: now.toISOString(),
          serverTime: now.toISOString(),
          effectiveLockAt: null,
        },
        notify,
      };
    });
    if (notify && notify.toUserIds.length > 0) {
      this.eventEmitter.emit(
        'dyn-report.approved',
        new DynReportApprovedEvent(
          assignmentId,
          notify.reportName,
          notify.periodKey,
          notify.toUserIds,
        ),
      );
    }
    return result;
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
    const { result, notify } = await this.prisma.$transaction(async (tx) => {
      const { submission, now, actorRole, assignment } =
        await this.lockForManagerWrite(
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

      const notify = {
        toUserIds: await this.activeEditorIds(tx, assignmentId),
        reportName: assignment.period.report.name,
        periodKey: assignment.period.periodKey,
      };

      return {
        result: {
          revision: nextRevision.toString(),
          state: transition.next,
          savedAt: now.toISOString(),
          serverTime: now.toISOString(),
          effectiveLockAt: parsedReturnDueAt.toISOString(),
        },
        notify,
      };
    });
    if (notify && notify.toUserIds.length > 0) {
      this.eventEmitter.emit(
        'dyn-report.returned',
        new DynReportReturnedEvent(
          assignmentId,
          notify.reportName,
          notify.periodKey,
          notify.toUserIds,
          reason,
        ),
      );
    }
    return result;
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
      const { submission, now, actorRole, assignment } =
        await this.lockForManagerWrite(
          tx,
          assignmentId,
          userId,
          roleId,
          expectedRevision,
        );

      const reportId = assignment.period.report.id;
      const totalApprovalLevels = await this.resolveTotalApprovalLevels(
        tx,
        reportId,
      );
      const actingApprovalLevel = await this.resolveActingApprovalLevel(
        tx,
        reportId,
        userId,
        actorRole,
        submission.approvalLevel,
      );

      const transition = applyTransition('UNAPPROVE', {
        state: submission.state,
        approvalLevel: submission.approvalLevel,
        totalApprovalLevels,
        actorRole,
        actingApprovalLevel,
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
