import { createHash } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { aggregateValues } from '../engine/aggregate';
import type { Contribution } from '../engine/aggregate';
import { computeKpiSummary } from '../engine/status';
import type { AssignmentFact } from '../engine/status';
import type { SubmissionState } from '../engine/access';
import { SubmissionError } from '../submission/submission.service';

export type SummaryMode = 'SUBMITTED' | 'APPROVED' | 'ALL_SAVED';

export interface FieldAggregateView {
  fieldKey: string;
  sheetKey: string;
  address: string;
  label: string;
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

/** S38 — snapshot engine version tag, bumped only if the snapshot's own shape changes. */
const SNAPSHOT_ENGINE_VERSION = 'v1';

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
  constructor(private readonly prisma: PrismaService) {}

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
        version: { include: { fields: true } },
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
    const actorRole = await this.resolveManagerRole(
      this.prisma,
      period.reportId,
      userId,
      roleId,
    );
    if (!actorRole) {
      throw new NotFoundException('Không tìm thấy kỳ báo cáo này.');
    }

    const now = new Date();
    const contributingStates = CONTRIBUTING_STATES[mode];

    const facts: AssignmentFact[] = period.assignments.map((a) => {
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

    const contributingAssignments = period.assignments.filter(
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
        return {
          sourceId: a.id,
          value: raw !== null ? Number(raw) : null,
        };
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
            value:
              contributions[i].value !== null
                ? String(contributions[i].value)
                : null,
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
        value: result.value !== null ? String(result.value) : null,
        displayNotAggregated: result.displayNotAggregated,
        countTotal: result.countTotal,
        countNonBlank: result.countNonBlank,
        contributors,
      };
    });

    return {
      reportId: period.reportId,
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
      serverTime: now.toISOString(),
    };
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
  ): Promise<FinalizeResultView> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "dyn_report_periods" WHERE id = ${periodId} FOR UPDATE`;

      const period = await tx.dynReportPeriod.findUnique({
        where: { id: periodId },
        include: {
          version: { include: { fields: true } },
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

      // Official snapshot: mode=APPROVED, the "số liệu đã chốt" D03 mode —
      // a team not yet APPROVED simply isn't counted, same rule as
      // getPeriodSummary's own mode=APPROVED path.
      const contributingStates = CONTRIBUTING_STATES.APPROVED;
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
        const contributions: Contribution[] = contributingAssignments.map(
          (a) => {
            const values = (a.submission?.values ?? {}) as Record<
              string,
              { v: string | null } | undefined
            >;
            const raw = values[f.fieldKey]?.v ?? null;
            return { sourceId: a.id, value: raw !== null ? Number(raw) : null };
          },
        );
        const result = aggregateValues(
          f.aggregate,
          f.blankPolicy,
          contributions,
        );
        snapshotValues[f.fieldKey] = {
          value: result.value !== null ? String(result.value) : null,
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
            periodId,
            versionId: period.versionId,
            mode: 'APPROVED',
            sourceRevisions,
          }),
        )
        .digest('hex');
      const contributorSetHash = createHash('sha256')
        .update(JSON.stringify(contributorTeamIds))
        .digest('hex');

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
        },
      });

      await tx.dynReportPeriod.update({
        where: { id: periodId },
        data: { status: 'FINALIZED', finalizedAt: now, finalizedById: userId },
      });

      return {
        periodId,
        status: 'FINALIZED',
        finalizedAt: now.toISOString(),
        snapshotId: snapshot.id,
      };
    });
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
}
