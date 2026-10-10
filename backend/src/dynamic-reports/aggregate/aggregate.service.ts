import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { aggregateValues } from '../engine/aggregate';
import type { Contribution } from '../engine/aggregate';
import { computeKpiSummary } from '../engine/status';
import type { AssignmentFact } from '../engine/status';
import type { SubmissionState } from '../engine/access';

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
  mode: SummaryMode;
  kpi: KpiSummaryView;
  fields: FieldAggregateView[];
  serverTime: string;
}

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
    reportId: string,
    userId: string,
    roleId: string,
  ): Promise<'ADMIN' | 'MANAGER' | null> {
    const adminGrant = await this.prisma.rolePermission.findFirst({
      where: {
        roleId,
        permission: { subject: 'DynamicReport', action: 'admin' },
      },
    });
    if (adminGrant) return 'ADMIN';

    const now = new Date();
    const managerRole = await this.prisma.dynReportRole.findFirst({
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
      return {
        fieldKey: f.fieldKey,
        sheetKey: f.sheetKey,
        address: f.address,
        label: f.label,
        value: result.value !== null ? String(result.value) : null,
        displayNotAggregated: result.displayNotAggregated,
        countTotal: result.countTotal,
        countNonBlank: result.countNonBlank,
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
      mode,
      kpi,
      fields,
      serverTime: now.toISOString(),
    };
  }
}
