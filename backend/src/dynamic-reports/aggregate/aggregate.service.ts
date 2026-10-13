import { createHash } from 'node:crypto';
import * as ExcelJS from 'exceljs';
import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DynReportPeriodFinalizedEvent } from '../../notifications/events/notification.events';
import { aggregateValues } from '../engine/aggregate';
import { CALC_ENGINE_VERSION } from '../engine/grid-workbook';
import type { FormulaOutcome } from '../engine/grid-workbook';
import { TemplateExportService } from '../export/template-export.service';
import type { PeriodExportScope } from '../export/period-export';
import { FormulaEvaluationService, toFormulaView } from './formula-evaluation.service';
import type { FormulaCellView, FormulaSource } from './formula-evaluation.service';
import type { Contribution } from '../engine/aggregate';
import { computeKpiSummary } from '../engine/status';
import type { AssignmentFact } from '../engine/status';
import type { SubmissionState } from '../engine/access';
import { SubmissionError } from '../submission/submission.service';
import { escapeXlsxCell } from '../../common/utils/xlsx-formula-escape.util';
import { TeamsService } from '../../teams/teams.service';
import { closingBasis, describeExcluded, excludedMessage, totalsNote } from './closing-basis';
import {
  sanitizeSheetName,
  sanitizeFileNamePart,
} from '../export-filename.util';

const EXPORT_TTL_MS = 24 * 60 * 60 * 1000;

export type SummaryMode = 'SUBMITTED' | 'APPROVED' | 'ALL_SAVED';

export interface FieldAggregateView {
  fieldKey: string;
  sheetKey: string;
  address: string;
  label: string;
  /** What the field holds, so a client can show an aggregated number, date or time the way its cell is formatted. */
  type: 'NUM' | 'TEXT' | 'DATE' | 'TIME';
  value: string | null;
  displayNotAggregated: boolean;
  countTotal: number;
  countNonBlank: number;
  /** S18 — exactly the teams counted in `countTotal`/the aggregate above, never more. */
  contributors: FieldContributorView[];
}

export interface FieldContributorView {
  teamName: string;
  value: string | null;
  state: string;
  revision: string;
  updatedAt: string | null;
}

export interface KpiSummaryView {
  requiredCount: number;
  exemptCount: number;
  completedCount: number;
  notStartedCount: number;
  inProgressCount: number;
  overdueNotDoneCount: number;
  reopenedCount: number;
  completionRateLabel: string;
  onTimeRateLabel: string;
  dataCoverageLabel: string;
}

export interface PeriodSummaryView {
  reportId: string;
  /** The template version this period was generated from — key for `GET versions/:versionId/grid`. */
  versionId: string;
  reportName: string;
  periodId: string;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  dueAt: string;
  /** S38 — OPEN shows "Chốt kỳ"; FINALIZED shows "Mở chốt" (admin only, 404 otherwise). */
  status: 'OPEN' | 'FINALIZED';
  mode: SummaryMode;
  kpi: KpiSummaryView;
  fields: FieldAggregateView[];
  /**
   * The OFFICIAL figure of every formula cell of the template, worked out from the aggregated values by the
   * server (GA1): LIVE while the period is open, FROZEN once it is closed (the figures it was closed with),
   * UNAVAILABLE for a period closed before this existed or when the template cannot be calculated.
   */
  formulaValues: Record<string, FormulaCellView> | null;
  formulaSource: FormulaSource;
  calcEngineVersion: number | null;
  serverTime: string;
}

export interface FinalizeResultView {
  periodId: string;
  status: 'FINALIZED';
  finalizedAt: string;
  snapshotId: string;
}

export interface ReopenResultView {
  periodId: string;
  status: 'OPEN';
}

/** S30 — "trước/sau" cho 1 field khi thêm tổ hoặc miễn nộp giữa kỳ. */
export interface MidPeriodFieldImpact {
  fieldKey: string;
  label: string;
  beforeCountTotal: number;
  afterCountTotal: number;
  beforeValue: string | null;
  afterValue: string | null;
}

/**
 * S30 (D09) — xem trước tác động lên mẫu số TRƯỚC khi xác nhận. Luôn tính
 * theo mode=SUBMITTED (mẫu số mặc định S15) để người quản lý thấy đúng con
 * số họ đang nhìn hàng ngày. Thêm tổ KHÔNG đổi `contributingCount`/giá trị
 * field ngay (tổ mới ở NOT_STARTED, chưa tính vào mẫu số cho tới khi nộp) —
 * chỉ `requiredCount` (nghĩa vụ) đổi ngay; FE phải nói rõ điều này, không
 * để người dùng tưởng nhầm số liệu đổi tức thì.
 */
export interface MidPeriodImpactPreview {
  periodId: string;
  teamId: string;
  teamName: string;
  requiredCountBefore: number;
  requiredCountAfter: number;
  contributingCountBefore: number;
  contributingCountAfter: number;
  fields: MidPeriodFieldImpact[];
}

export interface MidPeriodAssignmentView {
  assignmentId: string;
  teamId: string;
  teamName: string;
  obligation: 'REQUIRED' | 'EXEMPT';
}

/** S30 — 1 dòng trong danh sách tổ của kỳ, cho màn thêm tổ/miễn nộp chọn tổ. */
export interface AssignmentListItemView {
  assignmentId: string;
  teamId: string;
  teamName: string;
  obligation: 'REQUIRED' | 'EXEMPT';
  state: string;
  /** The team was added in the middle of the period (not generated with it). */
  addedMidPeriod: boolean;
  /** It can be taken back: added mid-period, the period is open and nobody has entered, commented or asked for anything. */
  removable: boolean;
}

export interface ExportCreateResultView {
  exportId: string;
  fileName: string;
  /**
   * TEMPLATE: the report's own sheets, once for the totals and once for every team. LIST: the plain
   * "Sheet / Chỉ tiêu / Giá trị" workbook, used when the template cannot be drawn or the file would be too large.
   */
  format: 'TEMPLATE' | 'LIST';
}

/**
 * S21 (PR7 slice 8) — metadata only, same R10 contract as S16's
 * `RevisionHistoryEntry`: never the revision's `valuesFull`/`diff`.
 */
export interface AssignmentHistoryEntry {
  revision: string;
  kind: string;
  actorName: string;
  reason: string | null;
  committedAt: string;
}

export interface AssignmentHistoryView {
  assignmentId: string;
  teamName: string;
  state: string;
  currentRevision: string;
  revisions: AssignmentHistoryEntry[];
  /**
   * Field keys whose value differs between the first-ever SUBMIT and the
   * submission's current values — `null` when the team has never submitted
   * (there is no "first submission" to compare against yet). This DOES read
   * raw values (via `valuesFull`), unlike the metadata-only `revisions`
   * array above — allowed here because this whole endpoint already re-checks
   * the caller's manager/admin standing on THIS report, same as S16/S18.
   */
  changedFieldKeysSinceFirstSubmit: string[] | null;
}

export interface ReportHistoryView {
  periodId: string;
  reportName: string;
  periodKey: string;
  assignments: AssignmentHistoryView[];
}

/**
 * T-VIEWER-NAV — the entry point a VIEWER (who owns no assignment, so
 * never appears in `listForManager`) uses to reach `getPeriodSummary`/
 * `getReportHistory`, both already R13-scoped. A MANAGER sees the same
 * list here too (their own `ReportManagerListPage` already has a
 * period-summary link derived from `listForManager`'s assignments, so
 * this is mostly redundant for them — harmless, not worth excluding).
 */
export interface ViewablePeriodView {
  reportId: string;
  reportName: string;
  periodId: string;
  periodKey: string;
  dueAt: string;
}

/** S38 — snapshot engine version tag, bumped only if the snapshot's own shape changes. */
const SNAPSHOT_ENGINE_VERSION = 'v1';

/** How many times a close is redone when the numbers change under the formulas that were worked out for it. */
const FINALIZE_MAX_ATTEMPTS = 3;

/** Formula figures worked out outside the transaction, with the hash of the numbers they came from. */
interface FrozenFormulaPlan {
  sourceHash: string;
  formulas: Prisma.InputJsonValue;
}

/** Thrown inside the close transaction (rolling it back) when someone saved after the figures were worked out. */
class StaleFormulaPlanError extends Error {}

/** Which submission states count as a "live" contribution under each S15 mode (D03). */
const CONTRIBUTING_STATES: Record<SummaryMode, readonly SubmissionState[]> = {
  SUBMITTED: ['SUBMITTED', 'APPROVED'],
  APPROVED: ['APPROVED'],
  ALL_SAVED: ['NOT_STARTED', 'DRAFT', 'SUBMITTED', 'RETURNED', 'APPROVED'],
};

/**
 * S15 thu nhỏ (spec §6.1 PR7 slice 2) — tổng hợp một kỳ qua mọi tổ. Pure
 * orchestration: every real decision (KPI math, per-field SUM/AVG/MIN/MAX,
 * blank handling) lives in `engine/status.ts`/`engine/aggregate.ts` (PR1),
 * never re-derived here. D03: a team excluded from the current mode (e.g.
 * not yet APPROVED under mode=APPROVED) contributes NOTHING to that
 * field's aggregate — not even a null placeholder — because its data
 * isn't official under that mode, not because it's blank. An EXEMPT team
 * never contributes, in any mode.
 */
@Injectable()
export class AggregateService {
  private readonly logger = new Logger(AggregateService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly teamsService: TeamsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly formulas: FormulaEvaluationService,
    private readonly templateExport: TemplateExportService,
  ) {}

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
   * R13 (PR7 slice 9) — read-only access check, for endpoints a VIEWER may
   * also reach (never the write endpoints above, which stay on
   * `resolveManagerRole`: a VIEWER never mutates anything, per D10 "lãnh
   * đạo chỉ xem"). `teamScopeId` null means the whole report; set, it
   * limits the VIEWER to that team's subtree — never the app-wide
   * DataScope (spec §10 R13 explicitly rules that out).
   */
  private async resolveAccessRole(
    client: Prisma.TransactionClient | PrismaService,
    reportId: string,
    userId: string,
    roleId: string,
  ): Promise<
    | { role: 'ADMIN' | 'MANAGER'; teamScopeId: null }
    | { role: 'VIEWER'; teamScopeId: string | null }
    | null
  > {
    const managerRole = await this.resolveManagerRole(
      client,
      reportId,
      userId,
      roleId,
    );
    if (managerRole) return { role: managerRole, teamScopeId: null };

    const now = new Date();
    const viewerRole = await client.dynReportRole.findFirst({
      where: {
        reportId,
        userId,
        role: 'VIEWER',
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
    });
    if (!viewerRole) return null;
    return { role: 'VIEWER', teamScopeId: viewerRole.teamScopeId ?? null };
  }

  /** R13 — the VIEWER's own team plus every descendant; `null` scope means no filtering (whole report). */
  private async scopedTeamIds(
    teamScopeId: string | null,
  ): Promise<Set<string> | null> {
    if (!teamScopeId) return null;
    const descendants = await this.teamsService.getDescendantIds(teamScopeId);
    return new Set([teamScopeId, ...descendants]);
  }

  /**
   * Shared by `finalizePeriod` (the official snapshot) and `exportPeriod`
   * (the "TỔNG" sheet) — mode=APPROVED is the one "số liệu đã chốt" D03
   * meaning, so both consumers must compute it identically or an export
   * taken right after finalize could show a different TỔNG than the
   * snapshot it's supposed to represent.
   */
  private computeApprovedSnapshot(period: {
    id: string;
    versionId: string;
    version: {
      fields: Array<{
        fieldKey: string;
        aggregate: Parameters<typeof aggregateValues>[0];
        blankPolicy: Parameters<typeof aggregateValues>[1];
      }>;
    };
    assignments: Array<{
      id: string;
      teamId: string;
      obligation: string;
      submission: {
        state: string;
        values: unknown;
        currentRevision: bigint;
      } | null;
    }>;
  }, mode: SummaryMode = 'APPROVED'): {
    snapshotValues: Record<
      string,
      { value: string | null; countTotal: number; countNonBlank: number }
    >;
    sourceRevisions: Record<string, string>;
    contributorSetHash: string;
    sourceHash: string;
  } {
    // mode=APPROVED — a team not yet APPROVED simply isn't counted, same
    // rule as getPeriodSummary's own mode=APPROVED path.
    // The default, and the only one a closed period uses; the export of an open period may ask for the mode on screen.
    const contributingStates = CONTRIBUTING_STATES[mode];
    const contributingAssignments = period.assignments.filter(
      (a) =>
        a.obligation !== 'EXEMPT' &&
        contributingStates.includes(
          (a.submission?.state ?? 'NOT_STARTED') as SubmissionState,
        ),
    );

    const snapshotValues: Record<
      string,
      { value: string | null; countTotal: number; countNonBlank: number }
    > = {};
    for (const f of period.version.fields) {
      const contributions: Contribution[] = contributingAssignments.map((a) => {
        const values = (a.submission?.values ?? {}) as Record<
          string,
          { v: string | null } | undefined
        >;
        const raw = values[f.fieldKey]?.v ?? null;
        return { sourceId: a.id, value: raw };
      });
      const result = aggregateValues(f.aggregate, f.blankPolicy, contributions);
      snapshotValues[f.fieldKey] = {
        value: result.value,
        countTotal: result.countTotal,
        countNonBlank: result.countNonBlank,
      };
    }

    const sourceRevisions: Record<string, string> = {};
    for (const a of period.assignments) {
      sourceRevisions[a.id] = a.submission?.currentRevision.toString() ?? '0';
    }
    const contributorTeamIds = contributingAssignments
      .map((a) => a.teamId)
      .sort();

    const sourceHash = createHash('sha256')
      .update(
        JSON.stringify({
          periodId: period.id,
          versionId: period.versionId,
          mode,
          sourceRevisions,
        }),
      )
      .digest('hex');
    const contributorSetHash = createHash('sha256')
      .update(JSON.stringify(contributorTeamIds))
      .digest('hex');

    return { snapshotValues, sourceRevisions, contributorSetHash, sourceHash };
  }

  async getPeriodSummary(
    periodId: string,
    userId: string,
    roleId: string,
    mode: SummaryMode,
  ): Promise<PeriodSummaryView> {
    const period = await this.prisma.dynReportPeriod.findUnique({
      where: { id: periodId },
      include: {
        report: true,
        version: { omit: { fileBytes: true }, include: { fields: true } },
        assignments: {
          include: {
            submission: true,
            unlocks: { where: { status: 'ACTIVE' } },
          },
        },
      },
    });
    // 404, not 403 — same anti-probe convention as the submission module
    // (AC-012/AC-035): a period the caller doesn't manage must look
    // identical to one that doesn't exist.
    if (!period) {
      throw new NotFoundException('Không tìm thấy kỳ báo cáo này.');
    }
    const actorRole = await this.resolveAccessRole(
      this.prisma,
      period.reportId,
      userId,
      roleId,
    );
    if (!actorRole) {
      throw new NotFoundException('Không tìm thấy kỳ báo cáo này.');
    }
    const allowedTeamIds = await this.scopedTeamIds(actorRole.teamScopeId);
    const assignments = allowedTeamIds
      ? period.assignments.filter((a) => allowedTeamIds.has(a.teamId))
      : period.assignments;

    const now = new Date();
    const contributingStates = CONTRIBUTING_STATES[mode];

    const facts: AssignmentFact[] = assignments.map((a) => {
      const state = (a.submission?.state ?? 'NOT_STARTED') as SubmissionState;
      const completed = state === 'SUBMITTED' || state === 'APPROVED';
      return {
        state,
        exempt: a.obligation === 'EXEMPT',
        hasAnySavedData: !!a.submission?.firstSavedAt,
        originalDueAt: period.dueAt,
        currentCompletedAt: completed
          ? (a.submission?.submittedAt ?? null)
          : null,
        hasActiveGrant: a.unlocks.length > 0,
        now,
        periodOpen: period.status === 'OPEN',
      };
    });
    const kpi = computeKpiSummary(facts);

    const contributingAssignments = assignments.filter(
      (a) =>
        a.obligation !== 'EXEMPT' &&
        contributingStates.includes(
          (a.submission?.state ?? 'NOT_STARTED') as SubmissionState,
        ),
    );

    const fields: FieldAggregateView[] = period.version.fields.map((f) => {
      const contributions: Contribution[] = contributingAssignments.map((a) => {
        const values = (a.submission?.values ?? {}) as Record<
          string,
          { v: string | null } | undefined
        >;
        const raw = values[f.fieldKey]?.v ?? null;
        return { sourceId: a.id, value: raw };
      });
      const result = aggregateValues(f.aggregate, f.blankPolicy, contributions);

      // S18 — same population as `contributions` above, by construction
      // (both map `contributingAssignments` in the same order), so the
      // drill-down list always sums to exactly the aggregate shown.
      const contributors: FieldContributorView[] = contributingAssignments.map(
        (a, i) => {
          const teamSnapshot = a.teamSnapshot as { name?: string } | null;
          return {
            teamName: teamSnapshot?.name ?? '',
            value: contributions[i].value,
            state: a.submission?.state ?? 'NOT_STARTED',
            revision: a.submission?.currentRevision.toString() ?? '0',
            updatedAt: a.submission?.updatedAt.toISOString() ?? null,
          };
        },
      );

      return {
        fieldKey: f.fieldKey,
        sheetKey: f.sheetKey,
        address: f.address,
        label: f.label,
        type: f.type as FieldAggregateView['type'],
        value: result.value,
        displayNotAggregated: result.displayNotAggregated,
        countTotal: result.countTotal,
        countNonBlank: result.countNonBlank,
        contributors,
      };
    });

    const formulaPart = await this.resolveFormulas(
      { id: period.id, versionId: period.versionId, status: period.status },
      mode,
      fields,
      allowedTeamIds !== null,
    );

    return {
      reportId: period.reportId,
      versionId: period.versionId,
      reportName: period.report.name,
      periodId: period.id,
      periodKey: period.periodKey,
      periodStart: period.startDate.toISOString().slice(0, 10),
      periodEnd: period.endDate.toISOString().slice(0, 10),
      dueAt: period.dueAt.toISOString(),
      status: period.status as 'OPEN' | 'FINALIZED',
      mode,
      kpi,
      fields,
      ...formulaPart,
      serverTime: now.toISOString(),
    };
  }

  /**
   * The official formula figures for a summary. A closed period shows the figures it was closed with (frozen in
   * its snapshot — a better calculator must never rewrite a number that was already reported); an open one
   * calculates them now from the aggregated values. Failing to calculate (a template too large to draw, a busy
   * worker) must never take the summary down with it: the figures are simply reported as unavailable.
   */
  private async resolveFormulas(
    period: { id: string; versionId: string; status: string },
    mode: SummaryMode,
    fields: ReadonlyArray<{ fieldKey: string; value: string | null }>,
    scopedToSomeTeams: boolean,
  ): Promise<{
    formulaValues: Record<string, FormulaCellView> | null;
    formulaSource: FormulaSource;
    calcEngineVersion: number | null;
  }> {
    const unavailable = { formulaValues: null, formulaSource: 'UNAVAILABLE' as const, calcEngineVersion: null };
    try {
      // The frozen figures were worked out from EVERY team's numbers. A viewer limited to some teams is shown the
      // totals of those teams only, so for them the figures are worked out live from what they can see.
      if (period.status === 'FINALIZED' && mode === 'APPROVED' && !scopedToSomeTeams) {
        const snapshot = await this.prisma.dynReportSnapshot.findFirst({
          where: { periodId: period.id, official: true, invalidatedAt: null },
          orderBy: { createdAt: 'desc' },
        });
        if (snapshot) {
          if (!snapshot.formulaValues) return unavailable; // closed before formula figures were frozen: say so, never recompute
          return {
            formulaValues: toFormulaView(snapshot.formulaValues as unknown as Parameters<typeof toFormulaView>[0]),
            formulaSource: 'FROZEN',
            calcEngineVersion: snapshot.calcEngineVersion,
          };
        }
        // Closed, yet no official snapshot (a reopen raced this read): the frozen figures are the only ones a
        // closed period may show, so say there are none rather than working out new ones.
        return unavailable;
      }
      const outcomes = await this.formulas.evaluate(
        period.versionId,
        Object.fromEntries(fields.map((f) => [f.fieldKey, f.value])),
        'none',
      );
      return {
        formulaValues: toFormulaView(outcomes),
        formulaSource: 'LIVE',
        calcEngineVersion: CALC_ENGINE_VERSION,
      };
    } catch (err) {
      this.logger.warn(
        `Không tính được công thức của kỳ ${period.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return unavailable;
    }
  }

  /**
   * S38 — chốt kỳ. R12 lock order: `FOR UPDATE` on the period row (not
   * `FOR SHARE` — this must WAIT for every in-flight save/submit/approve
   * holding `FOR SHARE` to commit first, exactly the "chờ các lần lưu
   * đang chạy xong" the spec calls for), then build the official snapshot
   * and flip `status` to FINALIZED inside the SAME transaction, so no
   * save can land between "snapshot taken" and "period locked". After
   * this, `lockForWrite`/`lockForManagerWrite`'s own
   * `period.status !== 'OPEN'` check (already in `SubmissionService`)
   * blocks every further write with no new code needed there.
   */
  async finalizePeriod(
    periodId: string,
    userId: string,
    roleId: string,
    acknowledgedBasis?: string,
  ): Promise<FinalizeResultView> {
    // The formulas are worked out BEFORE the transaction: it holds the period row lock and a pooled connection,
    // and the calculation waits for a worker (and may need more connections to load the grid). Inside the
    // transaction the figures are only checked against the numbers they were worked out from; if someone saved
    // in between, the whole thing is simply done again with fresh numbers.
    for (let attempt = 1; ; attempt++) {
      const plan = await this.planFrozenFormulas(periodId, userId, roleId);
      try {
        return await this.finalizeOnce(
          periodId,
          userId,
          roleId,
          plan,
          attempt < FINALIZE_MAX_ATTEMPTS,
          acknowledgedBasis,
        );
      } catch (err) {
        if (err instanceof StaleFormulaPlanError) continue;
        throw err;
      }
    }
  }

  /**
   * The formula figures for the period as it stands now, together with the hash of the numbers they came from.
   * Best effort and unlocked: a caller who may not close the period, or a template that cannot be calculated,
   * simply yields no plan (the transaction then raises the real error, or closes the period without figures).
   */
  private async planFrozenFormulas(
    periodId: string,
    userId: string,
    roleId: string,
  ): Promise<FrozenFormulaPlan | null> {
    try {
      const period = await this.prisma.dynReportPeriod.findUnique({
        where: { id: periodId },
        include: {
          report: true,
          version: { omit: { fileBytes: true }, include: { fields: true } },
          assignments: { include: { submission: true } },
        },
      });
      if (!period || period.status !== 'OPEN') return null;
      const actorRole = await this.resolveManagerRole(this.prisma, period.reportId, userId, roleId);
      if (!actorRole) return null; // do not spend a worker on someone who will be told 404
      const { snapshotValues, sourceHash } = this.computeApprovedSnapshot(period);
      const outcomes = await this.formulas.evaluate(
        period.versionId,
        Object.fromEntries(Object.entries(snapshotValues).map(([k, v]) => [k, v.value])),
        'none',
      );
      return { sourceHash, formulas: outcomes as unknown as Prisma.InputJsonValue };
    } catch (err) {
      this.logger.warn(
        `Chốt kỳ ${periodId}: chưa tính được số công thức (${err instanceof Error ? err.message : String(err)}).`,
      );
      return null;
    }
  }

  private async finalizeOnce(
    periodId: string,
    userId: string,
    roleId: string,
    plan: FrozenFormulaPlan | null,
    mayRetry: boolean,
    acknowledgedBasis: string | undefined,
  ): Promise<FinalizeResultView> {
    const { result, notify } = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "dyn_report_periods" WHERE id = ${periodId} FOR UPDATE`;

      const period = await tx.dynReportPeriod.findUnique({
        where: { id: periodId },
        include: {
          report: true,
          version: { omit: { fileBytes: true }, include: { fields: true } },
          assignments: { include: { submission: true } },
        },
      });
      if (!period) {
        throw new NotFoundException('Không tìm thấy kỳ báo cáo này.');
      }
      const actorRole = await this.resolveManagerRole(
        tx,
        period.reportId,
        userId,
        roleId,
      );
      if (!actorRole) {
        throw new NotFoundException('Không tìm thấy kỳ báo cáo này.');
      }
      if (period.status !== 'OPEN') {
        throw new SubmissionError(
          'Kỳ đã chốt rồi.',
          'INVALID_STATE_TRANSITION',
        );
      }

      // BUG-002 (found by the PR10 UAT agent via a real end-to-end API run):
      // finalize had no guard at all — a brand-new period with every
      // assignment still NOT_STARTED could be chốt kỳ immediately, creating
      // an "official" snapshot of nothing. Block finalize only when NO
      // required team has reached SUBMITTED/APPROVED yet; a period where
      // every team is EXEMPT, or where at least one has submitted and the
      // manager is deliberately closing despite stragglers, is still
      // allowed — this is the narrowest guard that rejects the demonstrated
      // "finalize an empty period" case without inventing a 100%-completion
      // requirement the spec never asked for.
      const requiredAssignments = period.assignments.filter(
        (a) => a.obligation === 'REQUIRED',
      );
      const anyRequiredSubmitted = requiredAssignments.some((a) =>
        (['SUBMITTED', 'APPROVED'] as string[]).includes(
          a.submission?.state ?? '',
        ),
      );
      if (requiredAssignments.length > 0 && !anyRequiredSubmitted) {
        throw new SubmissionError(
          'Chưa có tổ nào nộp dữ liệu cho kỳ này — không thể chốt một kỳ trống.',
          'INVALID_STATE_TRANSITION',
        );
      }

      // The official numbers are the APPROVED teams' (see closing-basis.ts). A period closed with a team submitted
      // but none approved froze an empty total while the screen showed that team's figures (production, 13/10/2026).
      const basis = closingBasis(period.assignments);
      if (basis.requiredCount > 0 && basis.approved.length === 0) {
        throw new SubmissionError(
          'Chưa có tổ nào được duyệt — số chốt chỉ tính các tổ đã duyệt nên kỳ sẽ chốt ra rỗng. ' +
            `Hãy duyệt các tổ đã nộp trước, rồi chốt kỳ. Hiện: ${describeExcluded(basis.excluded)}.`,
          'INVALID_STATE_TRANSITION',
        );
      }
      // Closing with some teams still outstanding stays possible, but never silently.
      if (basis.excluded.length > 0) {
        const shown = excludedMessage(basis);
        // Only a "yes" to exactly this sentence counts (see excludedMessage).
        if (acknowledgedBasis !== shown) throw new SubmissionError(shown, 'UNAPPROVED_TEAMS');
      }

      const {
        snapshotValues,
        sourceRevisions,
        contributorSetHash,
        sourceHash,
      } = this.computeApprovedSnapshot(period);

      // Freeze the formula figures with the snapshot (OV1/OV10), but only figures worked out from exactly these
      // numbers. No plan (the template could not be calculated) still closes the period — its aggregated figures
      // are what matter — and the snapshot says it has none.
      let frozenFormulas: Prisma.InputJsonValue | undefined;
      if (plan) {
        if (plan.sourceHash === sourceHash) {
          frozenFormulas = plan.formulas;
        } else if (mayRetry) {
          throw new StaleFormulaPlanError();
        } else {
          this.logger.warn(`Chốt kỳ ${periodId}: số liệu vẫn đổi giữa các lần tính, đóng băng không kèm số công thức.`);
        }
      }

      const now = new Date();
      const snapshot = await tx.dynReportSnapshot.create({
        data: {
          periodId,
          mode: 'APPROVED',
          sourceHash,
          sourceRevisions,
          contributorSetHash,
          values: snapshotValues,
          engineVersion: SNAPSHOT_ENGINE_VERSION,
          asOf: now,
          official: true,
          formulaValues: frozenFormulas,
          calcEngineVersion: frozenFormulas ? CALC_ENGINE_VERSION : undefined,
        },
      });

      await tx.dynReportPeriod.update({
        where: { id: periodId },
        data: { status: 'FINALIZED', finalizedAt: now, finalizedById: userId },
      });

      const toUserIds = await this.managerIds(tx, period.reportId);

      return {
        result: {
          periodId,
          status: 'FINALIZED' as const,
          finalizedAt: now.toISOString(),
          snapshotId: snapshot.id,
        },
        notify: {
          toUserIds,
          reportName: period.report.name,
          periodKey: period.periodKey,
        },
      };
    });
    if (notify.toUserIds.length > 0) {
      this.eventEmitter.emit(
        'dyn-report.period-finalized',
        new DynReportPeriodFinalizedEvent(
          periodId,
          notify.reportName,
          notify.periodKey,
          notify.toUserIds,
        ),
      );
    }
    return result;
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

  /**
   * S38 — mở chốt. `admin:DynamicReport` specifically (not any report
   * MANAGER) per D10: finalizing is a manager action, reopening it is
   * not — undoing a chốt is a bigger decision than making one. The
   * now-stale official snapshot is marked invalidated, never deleted
   * (spec: "giữ snapshot cũ"); a later re-finalize creates a fresh one.
   * Editing values after a reopen still goes through the normal SAVE
   * transition (kind='SAVE') — a dedicated ADJUSTMENT transition action
   * isn't wired anywhere yet (no UI can reach it), so this intentionally
   * does not fabricate one; deferred until something actually needs it.
   */
  async reopenPeriod(
    periodId: string,
    userId: string,
    roleId: string,
    reason: string,
  ): Promise<ReopenResultView> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "dyn_report_periods" WHERE id = ${periodId} FOR UPDATE`;

      const period = await tx.dynReportPeriod.findUnique({
        where: { id: periodId },
      });
      if (!period) {
        throw new NotFoundException('Không tìm thấy kỳ báo cáo này.');
      }
      const adminGrant = await tx.rolePermission.findFirst({
        where: {
          roleId,
          permission: { subject: 'DynamicReport', action: 'admin' },
        },
      });
      if (!adminGrant) {
        throw new NotFoundException('Không tìm thấy kỳ báo cáo này.');
      }
      if (period.status !== 'FINALIZED') {
        throw new SubmissionError(
          'Kỳ chưa chốt, không thể mở chốt.',
          'CELL_VALIDATION',
        );
      }

      const now = new Date();
      await tx.dynReportSnapshot.updateMany({
        where: { periodId, invalidatedAt: null },
        data: { invalidatedAt: now, invalidatedReason: reason },
      });
      await tx.dynReportPeriod.update({
        where: { id: periodId },
        data: { status: 'OPEN', finalizedAt: null, finalizedById: null },
      });

      return { periodId, status: 'OPEN' };
    });
  }

  /**
   * S30 — tính lại từng field cho một tập assignment GIẢ ĐỊNH (dùng để so
   * "trước/sau" khi thêm tổ hoặc miễn nộp giữa kỳ), dùng lại đúng
   * `aggregateValues` thuần của engine (PR1) — không tự tính lại công thức
   * ở đây. Luôn mode=SUBMITTED, không tham số hoá — xem docstring
   * `MidPeriodImpactPreview`.
   */
  private computeFieldAggregatesFor(
    fields: Array<{
      fieldKey: string;
      aggregate: Parameters<typeof aggregateValues>[0];
      blankPolicy: Parameters<typeof aggregateValues>[1];
    }>,
    assignments: Array<{
      obligation: string;
      submission: { state: string; values: unknown } | null;
    }>,
  ): Record<string, { countTotal: number; value: string | null }> {
    const contributingAssignments = assignments.filter(
      (a) =>
        a.obligation !== 'EXEMPT' &&
        CONTRIBUTING_STATES.SUBMITTED.includes(
          (a.submission?.state ?? 'NOT_STARTED') as SubmissionState,
        ),
    );
    const out: Record<string, { countTotal: number; value: string | null }> =
      {};
    for (const f of fields) {
      const contributions: Contribution[] = contributingAssignments.map(
        (a, i) => {
          const values = (a.submission?.values ?? {}) as Record<
            string,
            { v: string | null } | undefined
          >;
          const raw = values[f.fieldKey]?.v ?? null;
          return { sourceId: String(i), value: raw };
        },
      );
      const result = aggregateValues(f.aggregate, f.blankPolicy, contributions);
      out[f.fieldKey] = {
        countTotal: result.countTotal,
        value: result.value,
      };
    }
    return out;
  }

  private requiredCount(assignments: Array<{ obligation: string }>): number {
    return assignments.filter((a) => a.obligation !== 'EXEMPT').length;
  }

  private contributingCount(
    assignments: Array<{
      obligation: string;
      submission: { state: string } | null;
    }>,
  ): number {
    return assignments.filter(
      (a) =>
        a.obligation !== 'EXEMPT' &&
        CONTRIBUTING_STATES.SUBMITTED.includes(
          (a.submission?.state ?? 'NOT_STARTED') as SubmissionState,
        ),
    ).length;
  }

  /**
   * S30 — danh sách tổ của kỳ (để màn "Thêm tổ/Miễn nộp" biết tổ nào đã có
   * trong kỳ, đang EXEMPT hay REQUIRED). Đọc thẳng từ `assignments` hiện
   * có, không qua `aggregateValues` — không phải số liệu tổng hợp theo
   * field, chỉ là danh sách lượt giao.
   */
  async listAssignmentsForPeriod(
    periodId: string,
    userId: string,
    roleId: string,
  ): Promise<AssignmentListItemView[]> {
    const period = await this.prisma.dynReportPeriod.findUnique({
      where: { id: periodId },
      include: { assignments: { include: { submission: true } } },
    });
    if (!period) {
      throw new NotFoundException('Không tìm thấy kỳ báo cáo này.');
    }
    const actorRole = await this.resolveManagerRole(
      this.prisma,
      period.reportId,
      userId,
      roleId,
    );
    if (!actorRole) {
      throw new NotFoundException('Không tìm thấy kỳ báo cáo này.');
    }
    const ids = period.assignments.map((a) => a.id);
    const [commented, unlocked] = await Promise.all([
      this.prisma.dynReportComment.findMany({ where: { assignmentId: { in: ids } }, select: { assignmentId: true }, distinct: ['assignmentId'] }),
      this.prisma.dynReportUnlock.findMany({ where: { assignmentId: { in: ids } }, select: { assignmentId: true }, distinct: ['assignmentId'] }),
    ]);
    const touchedElsewhere = new Set([...commented, ...unlocked].map((r) => r.assignmentId));
    return period.assignments.map((a) => {
      const teamSnapshot = a.teamSnapshot as { name?: string } | null;
      const untouched =
        (a.submission?.state ?? 'NOT_STARTED') === 'NOT_STARTED' &&
        Number(a.submission?.currentRevision ?? 0) === 0 &&
        !touchedElsewhere.has(a.id);
      return {
        assignmentId: a.id,
        teamId: a.teamId,
        teamName: teamSnapshot?.name ?? '',
        obligation: a.obligation as 'REQUIRED' | 'EXEMPT',
        state: a.submission?.state ?? 'NOT_STARTED',
        addedMidPeriod: !!a.addedMidPeriodReason,
        // The same test the removal itself makes: added in the middle of the period, and nobody has touched it.
        removable: period.status === 'OPEN' && !!a.addedMidPeriodReason && untouched,
      };
    });
  }

  /** S30 — xem trước tác động của việc THÊM 1 tổ vào kỳ đang mở, trước khi xác nhận. */
  async previewAddTeam(
    periodId: string,
    userId: string,
    roleId: string,
    teamId: string,
  ): Promise<MidPeriodImpactPreview> {
    const period = await this.prisma.dynReportPeriod.findUnique({
      where: { id: periodId },
      include: {
        version: { omit: { fileBytes: true }, include: { fields: true } },
        assignments: { include: { submission: true } },
      },
    });
    if (!period) {
      throw new NotFoundException('Không tìm thấy kỳ báo cáo này.');
    }
    const actorRole = await this.resolveManagerRole(
      this.prisma,
      period.reportId,
      userId,
      roleId,
    );
    if (!actorRole) {
      throw new NotFoundException('Không tìm thấy kỳ báo cáo này.');
    }
    if (period.status !== 'OPEN') {
      throw new SubmissionError(
        'Kỳ đã khoá, không thể thêm tổ.',
        'INVALID_STATE_TRANSITION',
      );
    }
    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new SubmissionError('Không tìm thấy tổ này.', 'TEAM_NOT_FOUND');
    }
    if (period.assignments.some((a) => a.teamId === teamId)) {
      throw new SubmissionError(
        'Tổ này đã có trong kỳ.',
        'TEAM_ALREADY_ASSIGNED',
      );
    }

    const before = period.assignments;
    const after = [
      ...period.assignments,
      { obligation: 'REQUIRED', submission: null },
    ];
    const beforeAgg = this.computeFieldAggregatesFor(
      period.version.fields,
      before,
    );
    const afterAgg = this.computeFieldAggregatesFor(
      period.version.fields,
      after,
    );

    return {
      periodId,
      teamId,
      teamName: team.name,
      requiredCountBefore: this.requiredCount(before),
      requiredCountAfter: this.requiredCount(after),
      contributingCountBefore: this.contributingCount(before),
      contributingCountAfter: this.contributingCount(after),
      fields: period.version.fields.map((f) => ({
        fieldKey: f.fieldKey,
        label: f.label,
        beforeCountTotal: beforeAgg[f.fieldKey].countTotal,
        afterCountTotal: afterAgg[f.fieldKey].countTotal,
        beforeValue: beforeAgg[f.fieldKey].value,
        afterValue: afterAgg[f.fieldKey].value,
      })),
    };
  }

  /** S30 — xem trước tác động của việc MIỄN NỘP 1 tổ, trước khi xác nhận. */
  async previewExemptTeam(
    periodId: string,
    userId: string,
    roleId: string,
    assignmentId: string,
  ): Promise<MidPeriodImpactPreview> {
    const period = await this.prisma.dynReportPeriod.findUnique({
      where: { id: periodId },
      include: {
        version: { omit: { fileBytes: true }, include: { fields: true } },
        assignments: { include: { submission: true } },
      },
    });
    if (!period) {
      throw new NotFoundException('Không tìm thấy kỳ báo cáo này.');
    }
    const actorRole = await this.resolveManagerRole(
      this.prisma,
      period.reportId,
      userId,
      roleId,
    );
    if (!actorRole) {
      throw new NotFoundException('Không tìm thấy kỳ báo cáo này.');
    }
    if (period.status !== 'OPEN') {
      throw new SubmissionError(
        'Kỳ đã khoá, không thể miễn nộp.',
        'INVALID_STATE_TRANSITION',
      );
    }
    const target = period.assignments.find((a) => a.id === assignmentId);
    if (!target) {
      throw new NotFoundException('Không tìm thấy lượt giao này.');
    }
    if (target.obligation === 'EXEMPT') {
      throw new SubmissionError(
        'Tổ này đã được miễn nộp rồi.',
        'ALREADY_EXEMPT',
      );
    }
    const teamSnapshot = target.teamSnapshot as { name?: string } | null;

    const before = period.assignments;
    const after = period.assignments.map((a) =>
      a.id === assignmentId ? { ...a, obligation: 'EXEMPT' } : a,
    );
    const beforeAgg = this.computeFieldAggregatesFor(
      period.version.fields,
      before,
    );
    const afterAgg = this.computeFieldAggregatesFor(
      period.version.fields,
      after,
    );

    return {
      periodId,
      teamId: target.teamId,
      teamName: teamSnapshot?.name ?? '',
      requiredCountBefore: this.requiredCount(before),
      requiredCountAfter: this.requiredCount(after),
      contributingCountBefore: this.contributingCount(before),
      contributingCountAfter: this.contributingCount(after),
      fields: period.version.fields.map((f) => ({
        fieldKey: f.fieldKey,
        label: f.label,
        beforeCountTotal: beforeAgg[f.fieldKey].countTotal,
        afterCountTotal: afterAgg[f.fieldKey].countTotal,
        beforeValue: beforeAgg[f.fieldKey].value,
        afterValue: afterAgg[f.fieldKey].value,
      })),
    };
  }

  /**
   * S30 — thêm tổ vào kỳ đang mở, giữa chừng (D09). Cùng khuôn với
   * `PeriodSchedulerService`'s tạo assignment tự động: snapshot tên tổ,
   * obligation=REQUIRED, và tạo NGAY `DynReportSubmission` NOT_STARTED
   * trong CÙNG transaction (R5 — "bản nộp tạo sẵn", mọi đường ghi sau này
   * chỉ cần SELECT ... FOR UPDATE trên dòng đã có sẵn, không bao giờ phải
   * tạo lười).
   */
  async addTeamMidPeriod(
    periodId: string,
    userId: string,
    roleId: string,
    teamId: string,
    reason: string,
  ): Promise<MidPeriodAssignmentView> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "dyn_report_periods" WHERE id = ${periodId} FOR UPDATE`;

      const period = await tx.dynReportPeriod.findUnique({
        where: { id: periodId },
        include: { assignments: true },
      });
      if (!period) {
        throw new NotFoundException('Không tìm thấy kỳ báo cáo này.');
      }
      const actorRole = await this.resolveManagerRole(
        tx,
        period.reportId,
        userId,
        roleId,
      );
      if (!actorRole) {
        throw new NotFoundException('Không tìm thấy kỳ báo cáo này.');
      }
      if (period.status !== 'OPEN') {
        throw new SubmissionError(
          'Kỳ đã khoá, không thể thêm tổ.',
          'INVALID_STATE_TRANSITION',
        );
      }
      const team = await tx.team.findUnique({ where: { id: teamId } });
      if (!team) {
        throw new SubmissionError('Không tìm thấy tổ này.', 'TEAM_NOT_FOUND');
      }
      if (period.assignments.some((a) => a.teamId === teamId)) {
        throw new SubmissionError(
          'Tổ này đã có trong kỳ.',
          'TEAM_ALREADY_ASSIGNED',
        );
      }

      const assignment = await tx.dynReportAssignment.create({
        data: {
          periodId,
          teamId,
          teamSnapshot: { id: team.id, name: team.name, code: team.code },
          obligation: 'REQUIRED',
          addedMidPeriodReason: reason,
        },
      });
      await tx.dynReportSubmission.create({
        data: { assignmentId: assignment.id, state: 'NOT_STARTED' },
      });

      return {
        assignmentId: assignment.id,
        teamId: team.id,
        teamName: team.name,
        obligation: 'REQUIRED' as const,
      };
    });
  }

  /**
   * S30 — miễn nộp 1 tổ trong kỳ đang mở, giữa chừng (D09). KHÔNG xoá
   * assignment/submission đã có — chỉ đổi `obligation`, giữ nguyên dữ liệu
   * và lịch sử đã nhập (nếu có). Chiều ngược lại là `unexemptTeamMidPeriod`
   * (tiêu chuẩn thiết kế: thao tác một chiều phải có chiều ngược).
   */
  async exemptTeamMidPeriod(
    periodId: string,
    userId: string,
    roleId: string,
    assignmentId: string,
    reason: string,
  ): Promise<MidPeriodAssignmentView> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "dyn_report_periods" WHERE id = ${periodId} FOR UPDATE`;

      const period = await tx.dynReportPeriod.findUnique({
        where: { id: periodId },
      });
      if (!period) {
        throw new NotFoundException('Không tìm thấy kỳ báo cáo này.');
      }
      const actorRole = await this.resolveManagerRole(
        tx,
        period.reportId,
        userId,
        roleId,
      );
      if (!actorRole) {
        throw new NotFoundException('Không tìm thấy kỳ báo cáo này.');
      }
      if (period.status !== 'OPEN') {
        throw new SubmissionError(
          'Kỳ đã khoá, không thể miễn nộp.',
          'INVALID_STATE_TRANSITION',
        );
      }
      const assignment = await tx.dynReportAssignment.findUnique({
        where: { id: assignmentId },
      });
      if (!assignment || assignment.periodId !== periodId) {
        throw new NotFoundException('Không tìm thấy lượt giao này.');
      }
      if (assignment.obligation === 'EXEMPT') {
        throw new SubmissionError(
          'Tổ này đã được miễn nộp rồi.',
          'ALREADY_EXEMPT',
        );
      }

      const now = new Date();
      const updated = await tx.dynReportAssignment.update({
        where: { id: assignmentId },
        data: {
          obligation: 'EXEMPT',
          exemptReason: reason,
          exemptById: userId,
          exemptAt: now,
        },
      });
      const teamSnapshot = updated.teamSnapshot as { name?: string } | null;

      return {
        assignmentId: updated.id,
        teamId: updated.teamId,
        teamName: teamSnapshot?.name ?? '',
        obligation: 'EXEMPT' as const,
      };
    });
  }

  /** S30 — bỏ miễn nộp: tổ phải nộp trở lại; số liệu đã nhập (nếu có) vẫn còn nguyên. */
  async unexemptTeamMidPeriod(
    periodId: string,
    userId: string,
    roleId: string,
    assignmentId: string,
  ): Promise<MidPeriodAssignmentView> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "dyn_report_periods" WHERE id = ${periodId} FOR UPDATE`;
      const period = await tx.dynReportPeriod.findUnique({ where: { id: periodId } });
      if (!period) throw new NotFoundException('Không tìm thấy kỳ báo cáo này.');
      const actorRole = await this.resolveManagerRole(tx, period.reportId, userId, roleId);
      if (!actorRole) throw new NotFoundException('Không tìm thấy kỳ báo cáo này.');
      if (period.status !== 'OPEN') {
        throw new SubmissionError('Kỳ đã khoá, không thể bỏ miễn nộp.', 'INVALID_STATE_TRANSITION');
      }
      const assignment = await tx.dynReportAssignment.findUnique({ where: { id: assignmentId } });
      if (!assignment || assignment.periodId !== periodId) {
        throw new NotFoundException('Không tìm thấy lượt giao này.');
      }
      if (assignment.obligation !== 'EXEMPT') {
        throw new SubmissionError('Tổ này không đang được miễn nộp.', 'INVALID_STATE_TRANSITION');
      }
      const updated = await tx.dynReportAssignment.update({
        where: { id: assignmentId },
        data: { obligation: 'REQUIRED', exemptReason: null, exemptById: null, exemptAt: null },
      });
      const teamSnapshot = updated.teamSnapshot as { name?: string } | null;
      return {
        assignmentId: updated.id,
        teamId: updated.teamId,
        teamName: teamSnapshot?.name ?? '',
        obligation: 'REQUIRED' as const,
      };
    });
  }

  /**
   * S30 — gỡ một tổ đã thêm nhầm giữa kỳ. Chỉ gỡ được lượt giao do "thêm tổ giữa kỳ" tạo ra, và chỉ khi chưa ai nhập
   * gì (bản nộp chưa bắt đầu, không ghi chú, không yêu cầu mở lại): đã có số liệu thì dùng "Miễn nộp", không xoá.
   */
  async removeAddedTeamMidPeriod(
    periodId: string,
    userId: string,
    roleId: string,
    assignmentId: string,
  ): Promise<{ removed: true; teamName: string }> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "dyn_report_periods" WHERE id = ${periodId} FOR UPDATE`;
      const period = await tx.dynReportPeriod.findUnique({ where: { id: periodId } });
      if (!period) throw new NotFoundException('Không tìm thấy kỳ báo cáo này.');
      const actorRole = await this.resolveManagerRole(tx, period.reportId, userId, roleId);
      if (!actorRole) throw new NotFoundException('Không tìm thấy kỳ báo cáo này.');
      if (period.status !== 'OPEN') {
        throw new SubmissionError('Kỳ đã khoá, không thể gỡ tổ.', 'INVALID_STATE_TRANSITION');
      }
      const assignment = await tx.dynReportAssignment.findUnique({
        where: { id: assignmentId },
        include: { submission: true },
      });
      if (!assignment || assignment.periodId !== periodId) {
        throw new NotFoundException('Không tìm thấy lượt giao này.');
      }
      if (!assignment.addedMidPeriodReason) {
        throw new SubmissionError(
          'Chỉ gỡ được tổ đã thêm giữa kỳ. Tổ có từ đầu kỳ thì dùng "Miễn nộp".',
          'NOT_ADDED_MID_PERIOD',
        );
      }
      const sub = assignment.submission;
      const [comments, unlocks] = await Promise.all([
        tx.dynReportComment.count({ where: { assignmentId } }),
        tx.dynReportUnlock.count({ where: { assignmentId } }),
      ]);
      if ((sub && (sub.state !== 'NOT_STARTED' || sub.currentRevision > 0)) || comments > 0 || unlocks > 0) {
        throw new SubmissionError(
          'Tổ này đã có số liệu, ghi chú hoặc yêu cầu mở lại nên không gỡ được. Hãy dùng "Miễn nộp".',
          'HAS_DATA',
        );
      }
      // Editors and reminders go with the assignment (Cascade); the submission is Restrict, so it goes first.
      await tx.dynReportSubmission.deleteMany({ where: { assignmentId } });
      await tx.dynReportAssignment.delete({ where: { id: assignmentId } });
      // What was summed with this team in it is no longer true, and neither are the files made with it: a downloadable
      // export would still carry the removed team's sheet (its figures, empty as they were, change no contributor hash).
      await tx.dynReportSnapshot.updateMany({
        where: { periodId, invalidatedAt: null },
        data: { invalidatedAt: new Date(), invalidatedReason: 'TEAM_REMOVED' },
      });
      await tx.dynReportExport.deleteMany({ where: { scope: { path: ['periodId'], equals: periodId } } });
      const teamSnapshot = assignment.teamSnapshot as { name?: string } | null;
      return { removed: true as const, teamName: teamSnapshot?.name ?? '' };
    });
  }

  /**
   * S25 — manager exports a workbook ("TỔNG" + 1 sheet/tổ + "Metadata"),
   * stored once (`DynReportExport`, TTL 24h) and downloaded through a
   * SEPARATE call (`getExportForDownload`) that re-checks standing —
   * exactly the "tải qua API có kiểm quyền lại" requirement, not just a
   * cosmetic extra step. Generated synchronously (no job queue): every
   * real template measured so far (HSLN: 258 rows × a few dozen input
   * cells) renders in well under a second, so "Job + trạng thái + retry"
   * stays deferred until an export this small has ever actually timed
   * out — building retry/polling for a problem that hasn't occurred yet
   * would be guessing at a requirement, not meeting one.
   */
  async exportPeriod(
    periodId: string,
    userId: string,
    roleId: string,
    requestedMode: SummaryMode = 'APPROVED',
  ): Promise<ExportCreateResultView> {
    const period = await this.prisma.dynReportPeriod.findUnique({
      where: { id: periodId },
      include: {
        report: true,
        version: { omit: { fileBytes: true }, include: { fields: true } },
        assignments: { include: { submission: true } },
      },
    });
    if (!period) {
      throw new NotFoundException('Không tìm thấy kỳ báo cáo này.');
    }
    const actorRole = await this.resolveManagerRole(
      this.prisma,
      period.reportId,
      userId,
      roleId,
    );
    if (!actorRole) {
      throw new NotFoundException('Không tìm thấy kỳ báo cáo này.');
    }

    // The teams this file is made from; checked again when it is stored (see below).
    const assignmentIdsAtRead = period.assignments.map((x) => x.id).sort().join(',');
    // A closed period exports its official figures, always the approved teams'. An open one may export what the screen
    // shows (SUBMITTED by default there), marked as provisional in the file.
    const mode: SummaryMode = period.status === 'FINALIZED' ? 'APPROVED' : (requestedMode ?? 'APPROVED');
    const computed = this.computeApprovedSnapshot(period, mode);
    let snapshotValues = computed.snapshotValues;
    let snapshotId: string | null = null;
    let officialFormulaValues: Record<string, FormulaOutcome> | null = null;
    if (period.status === 'FINALIZED') {
      // Once chốt, the export must show the FROZEN official numbers, not
      // a live recompute — the whole point of chốt kỳ is that the number
      // never moves again.
      const officialSnapshot = await this.prisma.dynReportSnapshot.findFirst({
        where: { periodId, official: true, invalidatedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      if (officialSnapshot) {
        snapshotValues = officialSnapshot.values as typeof snapshotValues;
        snapshotId = officialSnapshot.id;
        officialFormulaValues = (officialSnapshot.formulaValues as Record<string, FormulaOutcome> | null) ?? null;
      }
    }

    // The totals' formulas are the figures the screen shows: the ones frozen at close for a closed period,
    // worked out now from the same aggregated numbers for an open one. A closed period without frozen
    // figures has none to offer (the file says so rather than inventing them).
    let totalOutcomes: Record<string, FormulaOutcome> | null = null;
    if (period.status === 'FINALIZED') {
      if (officialFormulaValues) totalOutcomes = officialFormulaValues;
    } else {
      try {
        totalOutcomes = await this.formulas.evaluate(
          period.versionId,
          Object.fromEntries(
            Object.entries(snapshotValues).map(([k, v]) => [k, (v as { value: string | null }).value]),
          ),
          'none',
        );
      } catch (err) {
        this.logger.warn(
          `Xuất kỳ ${periodId}: chưa tính được số công thức (${err instanceof Error ? err.message : String(err)}).`,
        );
      }
    }

    const teams = await this.assignmentsInTeamOrder(period.assignments);
    // The teams whose figures are in the totals: the very ones `computeApprovedSnapshot` adds up (approved, not exempt).
    const counted = new Set(
      period.assignments
        .filter(
          (a) =>
            a.obligation !== 'EXEMPT' &&
            CONTRIBUTING_STATES[mode].includes((a.submission?.state ?? 'NOT_STARTED') as SubmissionState),
        )
        .map((a) => a.teamId),
    );
    const scopes: PeriodExportScope[] = [
      {
        scope: 'TOTAL',
        label: 'TỔNG',
        kind: 'TOTAL',
        values: Object.fromEntries(
          period.version.fields.map((f) => [
            f.fieldKey,
            (snapshotValues[f.fieldKey] as { value: string | null } | undefined)?.value ?? null,
          ]),
        ),
      },
      ...teams.map((a) => {
        const teamSnapshot = a.teamSnapshot as { name?: string } | null;
        const values = (a.submission?.values ?? {}) as Record<string, { t: string; v: string | null } | undefined>;
        return {
          scope: a.teamId,
          label: teamSnapshot?.name || a.teamId,
          kind: 'TEAM' as const,
          counted: counted.has(a.teamId),
          values: Object.fromEntries(period.version.fields.map((f) => [f.fieldKey, values[f.fieldKey]?.v ?? null])),
        };
      }),
    ];

    let fileBuffer: Buffer;
    let format: 'TEMPLATE' | 'LIST' = 'TEMPLATE';
    try {
      ({ buffer: fileBuffer } = await this.templateExport.buildPeriodFile({
        versionId: period.versionId,
        fields: period.version.fields.map((f) => ({
          sheetKey: f.sheetKey,
          address: f.address,
          fieldKey: f.fieldKey,
          type: f.type as 'NUM' | 'TEXT' | 'DATE' | 'TIME',
          aggregate: f.aggregate,
          blankPolicy: f.blankPolicy,
        })),
        scopes,
        totalOutcomes,
        totalsNote: totalsNote(closingBasis(period.assignments, mode), true),
        meta: {
          kind: 'PERIOD',
          reportId: period.reportId,
          versionId: period.versionId,
          periodId,
          periodKey: period.periodKey,
          mode,
          snapshotId: snapshotId ?? '',
          exportedAt: new Date().toISOString(),
        },
      }));
    } catch (err) {
      this.logger.warn(
        `Xuất theo mẫu thất bại cho kỳ ${periodId}, dùng dạng danh sách: ${err instanceof Error ? err.message : String(err)}`,
      );
      format = 'LIST';
      fileBuffer = await this.buildPeriodListWorkbook(period, snapshotValues, teams, totalsNote(closingBasis(period.assignments, mode)), mode);
    }
    const fileName = `${sanitizeFileNamePart(period.report.name)}-${period.periodKey}.xlsx`;

    // The workbook above took a while to render. Deleting the report takes the period FOR UPDATE, so holding it FOR
    // SHARE while the row goes in means either the export lands before the delete (and the delete removes it) or the
    // period is already gone and nothing is written: a deleted report's figures cannot come back as a download.
    const exportRow = await this.prisma.$transaction(async (tx) => {
      const alive = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM dyn_report_periods WHERE id = ${periodId} FOR SHARE
      `;
      if (alive.length === 0) {
        throw new NotFoundException('Kỳ báo cáo không còn tồn tại.');
      }
      // Teams added or taken back while the workbook was being rendered: the file lists the teams it was made from.
      const nowIds = (await tx.dynReportAssignment.findMany({ where: { periodId }, select: { id: true } }))
        .map((a) => a.id)
        .sort()
        .join(',');
      if (nowIds !== assignmentIdsAtRead) {
        throw new ConflictException('Danh sách tổ của kỳ vừa thay đổi trong lúc xuất. Hãy xuất lại.');
      }
      return tx.dynReportExport.create({
        data: {
          requestedById: userId,
          kind: 'MANAGER_FULL',
          // The mode is part of what the file is made of: the download checks the teams against it.
          scope: { periodId, reportId: period.reportId, mode },
          snapshotId,
          status: 'READY',
          fileBytes: fileBuffer as unknown as Uint8Array<ArrayBuffer>,
          fileName,
          contributorSetHash: computed.contributorSetHash,
          expiresAt: new Date(Date.now() + EXPORT_TTL_MS),
        },
      });
    });

    return { exportId: exportRow.id, fileName, format };
  }

  /** The assignments in the order of the team tree (parents before their children, siblings by `order`, then name). */
  private async assignmentsInTeamOrder<T extends { teamId: string }>(assignments: T[]): Promise<T[]> {
    const teams = await this.prisma.team.findMany({
      select: { id: true, name: true, parentId: true, order: true },
    });
    const known = new Set(teams.map((t) => t.id));
    const children = new Map<string | null, typeof teams>();
    for (const t of teams) {
      const key = t.parentId && known.has(t.parentId) ? t.parentId : null;
      children.set(key, [...(children.get(key) ?? []), t]);
    }
    const rank = new Map<string, number>();
    const walk = (parent: string | null) => {
      const list = [...(children.get(parent) ?? [])].sort(
        (a, b) => a.order - b.order || a.name.localeCompare(b.name, 'vi'),
      );
      for (const t of list) {
        rank.set(t.id, rank.size);
        walk(t.id);
      }
    };
    walk(null);
    // A team that is not in the tree any more keeps its relative place, after every team that is.
    return assignments
      .map((a, i) => ({ a, i }))
      .sort((x, y) => (rank.get(x.a.teamId) ?? Infinity) - (rank.get(y.a.teamId) ?? Infinity) || x.i - y.i)
      .map((x) => x.a);
  }

  /** The plain list workbook: used when the template itself cannot be drawn or the file would be too large. */
  private async buildPeriodListWorkbook(
    period: {
      report: { name: string };
      periodKey: string;
      startDate: Date;
      endDate: Date;
      status: string;
      versionId: string;
      version: { fields: Array<{ fieldKey: string; sheetKey: string; label: string | null }> };
    },
    snapshotValues: Record<string, unknown>,
    teams: Array<{ teamId: string; teamSnapshot: unknown; submission: { values: unknown } | null }>,
    note = '',
    mode: SummaryMode = 'APPROVED',
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    const totalSheet = workbook.addWorksheet('TỔNG');
    totalSheet.columns = [
      { header: 'Sheet', key: 'sheetKey', width: 20 },
      { header: 'Chỉ tiêu', key: 'label', width: 32 },
      { header: 'Giá trị tổng hợp', key: 'value', width: 18 },
      { header: 'Số tổ đóng góp', key: 'count', width: 16 },
    ];
    for (const f of period.version.fields) {
      const v = snapshotValues[f.fieldKey] as
        | { value: string | null; countTotal: number; countNonBlank: number }
        | undefined;
      totalSheet.addRow({
        sheetKey: f.sheetKey,
        label: escapeXlsxCell(f.label || f.fieldKey),
        value: v?.value ?? null,
        count: v ? `${v.countNonBlank}/${v.countTotal}` : '0/0',
      });
    }
    if (note) {
      // The plain list has no template to protect: the line goes two rows under the figures, across the table's width.
      const row = totalSheet.rowCount + 2;
      totalSheet.mergeCells(row, 1, row, 4);
      const cell = totalSheet.getCell(row, 1);
      cell.value = note;
      cell.font = { italic: true, color: { argb: 'FF92400E' } };
      cell.alignment = { wrapText: true, vertical: 'top' };
      totalSheet.getRow(row).height = 15 * Math.max(1, Math.ceil(note.length / 80));
    }

    for (const a of teams) {
      const teamSnapshot = a.teamSnapshot as { name?: string } | null;
      const teamName = teamSnapshot?.name || a.teamId;
      const sheet = workbook.addWorksheet(sanitizeSheetName(teamName));
      sheet.columns = [
        { header: 'Sheet', key: 'sheetKey', width: 20 },
        { header: 'Chỉ tiêu', key: 'label', width: 32 },
        { header: 'Giá trị', key: 'value', width: 18 },
      ];
      const values = (a.submission?.values ?? {}) as Record<
        string,
        { t: string; v: string | null } | undefined
      >;
      for (const f of period.version.fields) {
        const typed = values[f.fieldKey];
        sheet.addRow({
          sheetKey: f.sheetKey,
          label: escapeXlsxCell(f.label || f.fieldKey),
          value:
            typed?.t === 'TEXT' ? escapeXlsxCell(typed.v) : (typed?.v ?? null),
        });
      }
    }

    const metaSheet = workbook.addWorksheet('Metadata');
    metaSheet.addRow(['Báo cáo', period.report.name]);
    metaSheet.addRow(['Kỳ', period.periodKey]);
    metaSheet.addRow([
      'Khoảng thời gian',
      `${period.startDate.toISOString().slice(0, 10)} → ${period.endDate.toISOString().slice(0, 10)}`,
    ]);
    metaSheet.addRow(['Trạng thái kỳ', period.status]);
    metaSheet.addRow(['Chế độ tính', mode]);
    metaSheet.addRow(['Xuất lúc', new Date().toISOString()]);
    metaSheet.addRow(['Phiên bản mẫu', period.versionId]);

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  /**
   * S25 — the "kiểm quyền lại khi tải" step. Re-checks the caller still
   * manages this report, the export hasn't expired, AND (R13) the set of
   * contributing teams hasn't shrunk since the export was generated —
   * e.g. a team later marked EXEMPT — rather than silently serving bytes
   * whose scope may now exceed the caller's actual standing.
   */
  async getExportForDownload(
    exportId: string,
    userId: string,
    roleId: string,
  ): Promise<{ fileBytes: Buffer; fileName: string }> {
    const row = await this.prisma.dynReportExport.findUnique({
      where: { id: exportId },
    });
    if (!row || !row.fileBytes || !row.fileName) {
      throw new NotFoundException('Không tìm thấy file xuất này.');
    }
    const scope = row.scope as { periodId: string; reportId: string; mode?: SummaryMode };
    const actorRole = await this.resolveManagerRole(
      this.prisma,
      scope.reportId,
      userId,
      roleId,
    );
    if (!actorRole) {
      throw new NotFoundException('Không tìm thấy file xuất này.');
    }
    if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) {
      throw new SubmissionError(
        'File xuất đã hết hạn, vui lòng xuất lại.',
        'CELL_VALIDATION',
      );
    }

    const period = await this.prisma.dynReportPeriod.findUnique({
      where: { id: scope.periodId },
      include: {
        version: { omit: { fileBytes: true }, include: { fields: true } },
        assignments: { include: { submission: true } },
      },
    });
    if (period) {
      // Files made before the mode existed were the approved teams'.
      const { contributorSetHash } = this.computeApprovedSnapshot(period, scope.mode ?? 'APPROVED');
      if (
        row.contributorSetHash &&
        row.contributorSetHash !== contributorSetHash
      ) {
        throw new SubmissionError(
          'Phạm vi dữ liệu đã thay đổi, vui lòng xuất lại.',
          'CELL_VALIDATION',
        );
      }
    }

    return {
      fileBytes: Buffer.from(row.fileBytes),
      fileName: row.fileName,
    };
  }

  /**
   * S21 (PR7 slice 8) — manager-scoped history/audit for the WHOLE period
   * at once (every team's assignment), not just one assignment like S16's
   * `getSubmissionForManager`. "Thay đổi so với lần nộp đầu" is computed
   * directly from the first SUBMIT revision's `valuesFull` (R9: SUBMIT
   * always writes a full snapshot, never just a diff) — no diff-replay
   * needed, because the exact row we want already holds the full values.
   */
  async getReportHistory(
    periodId: string,
    userId: string,
    roleId: string,
  ): Promise<ReportHistoryView> {
    const period = await this.prisma.dynReportPeriod.findUnique({
      where: { id: periodId },
      include: {
        report: true,
        assignments: {
          include: {
            submission: {
              include: {
                revisions: {
                  orderBy: { revision: 'asc' },
                  select: {
                    revision: true,
                    kind: true,
                    reason: true,
                    committedAt: true,
                    valuesFull: true,
                    actor: {
                      select: {
                        firstName: true,
                        lastName: true,
                        username: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!period) throw new NotFoundException('Không tìm thấy kỳ báo cáo này.');

    const actorRole = await this.resolveAccessRole(
      this.prisma,
      period.reportId,
      userId,
      roleId,
    );
    if (!actorRole)
      throw new NotFoundException('Không tìm thấy kỳ báo cáo này.');
    const allowedTeamIds = await this.scopedTeamIds(actorRole.teamScopeId);
    const scopedAssignments = allowedTeamIds
      ? period.assignments.filter((a) => allowedTeamIds.has(a.teamId))
      : period.assignments;

    const assignments: AssignmentHistoryView[] = scopedAssignments.map((a) => {
      const submission = a.submission;
      const revisions = submission?.revisions ?? [];
      const teamSnapshot = a.teamSnapshot as { name?: string } | null;

      const historyEntries: AssignmentHistoryEntry[] = revisions.map((r) => ({
        revision: r.revision.toString(),
        kind: r.kind,
        actorName:
          `${r.actor.firstName ?? ''} ${r.actor.lastName ?? ''}`.trim() ||
          r.actor.username,
        reason: r.reason,
        committedAt: r.committedAt.toISOString(),
      }));

      let changedFieldKeysSinceFirstSubmit: string[] | null = null;
      if (submission?.firstSubmittedRevision != null) {
        const firstSubmitRow = revisions.find(
          (r) => r.revision === submission.firstSubmittedRevision,
        );
        const firstValues =
          (firstSubmitRow?.valuesFull as Record<string, unknown>) ?? {};
        const currentValues =
          (submission.values as Record<string, unknown>) ?? {};
        const allKeys = new Set([
          ...Object.keys(firstValues),
          ...Object.keys(currentValues),
        ]);
        changedFieldKeysSinceFirstSubmit = Array.from(allKeys).filter(
          (k) =>
            JSON.stringify(firstValues[k] ?? null) !==
            JSON.stringify(currentValues[k] ?? null),
        );
      }

      return {
        assignmentId: a.id,
        teamName: teamSnapshot?.name ?? a.teamId,
        state: submission?.state ?? 'NOT_STARTED',
        currentRevision: (submission?.currentRevision ?? 0n).toString(),
        revisions: historyEntries,
        changedFieldKeysSinceFirstSubmit,
      };
    });

    return {
      periodId,
      reportName: period.report.name,
      periodKey: period.periodKey,
      assignments,
    };
  }

  /**
   * T-VIEWER-NAV — every OPEN period across every report the caller has
   * ANY standing on (admin:DynamicReport, or a MANAGER/VIEWER `DynReportRole`
   * row), so a VIEWER with no assignment of their own still has a way to
   * reach `getPeriodSummary`/`getReportHistory`. Deliberately does not
   * pre-filter by `teamScopeId` here — this list only names periods, never
   * any team's data, so there is nothing to scope yet; the real R13 check
   * happens inside those two endpoints when the caller actually opens one.
   */
  async listPeriodsForViewer(
    userId: string,
    roleId: string,
  ): Promise<ViewablePeriodView[]> {
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
          role: { in: ['MANAGER', 'VIEWER'] },
          validFrom: { lte: now },
          OR: [{ validTo: null }, { validTo: { gt: now } }],
        },
        select: { reportId: true },
      });
      reportIds = roles.map((r) => r.reportId);
    }
    if (reportIds.length === 0) return [];

    const periods = await this.prisma.dynReportPeriod.findMany({
      where: { reportId: { in: reportIds }, status: 'OPEN' },
      include: { report: true },
      orderBy: { dueAt: 'asc' },
    });

    return periods.map((p) => ({
      reportId: p.reportId,
      reportName: p.report.name,
      periodId: p.id,
      periodKey: p.periodKey,
      dueAt: p.dueAt.toISOString(),
    }));
  }
}
