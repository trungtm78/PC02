import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { TeamsService } from '../../teams/teams.service';
import {
  computeAccessState,
  computeKpiSummary,
  computeTimelinessState,
  formatRatioLabel,
} from '../engine/status';
import type {
  AccessState,
  AssignmentFact,
  KpiSummary,
  TimelinessState,
} from '../engine/status';
import type { SubmissionState } from '../engine/access';

export interface AssignmentStatusRow {
  assignmentId: string;
  reportId: string;
  reportName: string;
  periodId: string;
  periodKey: string;
  periodStart: string;
  periodEnd: string;
  teamId: string;
  teamName: string;
  parentTeamName: string | null;
  dataCoverageLabel: string;
  /** "Tiến độ" (FRD §7.2) — independent of the three dimensions below. */
  state: SubmissionState;
  /** "Quyền nhập". */
  accessState: AccessState;
  /** "Đúng hạn" — never folded into `state`, FRD §7.2. */
  timelinessState: TimelinessState;
  /** "Nghĩa vụ". */
  exempt: boolean;
  dueAt: string;
  effectiveLockAt: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  updatedAt: string | null;
  grantCount: number;
  changedSinceReopen: boolean;
}

export interface StatusListFilters {
  reportId?: string;
  periodId?: string;
  /** Matched against this team AND every descendant (cây tổ). */
  teamId?: string;
  state?: SubmissionState;
  overdue?: boolean;
  reopened?: boolean;
}

export interface StatusListResult {
  items: AssignmentStatusRow[];
  total: number;
  kpi: KpiSummary;
  asOf: string;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

/**
 * S19/S23 (spec §6.1 PR8). The first CROSS-REPORT read in this module —
 * every other query service so far (`AggregateService`, `SubmissionService`)
 * is scoped to one report/period at a time. R13 still applies exactly the
 * same way: scope comes only from `admin:DynamicReport` or the caller's own
 * `DynReportRole` rows (MANAGER/VIEWER), never the app-wide DataScope —
 * same `resolveReportIds` shape `listPeriodsForViewer` (T-VIEWER-NAV)
 * already established.
 *
 * Pagination/sorting happen in JS, not SQL: `accessState`/`timelinessState`/
 * `overdue`/`reopened` are all DERIVED from `now`, dueAt and grants
 * (`engine/status.ts`, pure, no I/O) — there is no DB column to filter or
 * sort on directly. Acceptable at this module's documented scale (spec's
 * own benchmark target is 5,000 input fields / 200 teams, not more).
 */
@Injectable()
export class StatusQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teamsService: TeamsService,
  ) {}

  private async resolveReportIds(
    userId: string,
    roleId: string,
  ): Promise<string[] | 'ALL'> {
    const adminGrant = await this.prisma.rolePermission.findFirst({
      where: {
        roleId,
        permission: { subject: 'DynamicReport', action: 'admin' },
      },
    });
    if (adminGrant) return 'ALL';

    const now = new Date();
    const roles = await this.prisma.dynReportRole.findMany({
      where: {
        userId,
        role: { in: ['MANAGER', 'VIEWER'] },
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
      select: { reportId: true },
    });
    return [...new Set(roles.map((r) => r.reportId))];
  }

  /**
   * The part shared by `listAssignmentStatuses` (paginated) and
   * `queryAllForExport` (unpaginated) — every row matching `filters`,
   * sorted, with the KPI summary over that same scope. Neither caller
   * paginates here; `listAssignmentStatuses` slices the result itself.
   */
  private async queryRows(
    userId: string,
    roleId: string,
    filters: StatusListFilters,
  ): Promise<{ rows: AssignmentStatusRow[]; kpi: KpiSummary; asOf: string }> {
    const now = new Date();
    const reportIds = await this.resolveReportIds(userId, roleId);
    if (reportIds !== 'ALL' && reportIds.length === 0) {
      return { rows: [], kpi: computeKpiSummary([]), asOf: now.toISOString() };
    }

    let teamIdFilter: string[] | undefined;
    if (filters.teamId) {
      const descendants = await this.teamsService.getDescendantIds(
        filters.teamId,
      );
      teamIdFilter = [filters.teamId, ...descendants];
    }

    const where: Prisma.DynReportAssignmentWhereInput = {
      period: {
        ...(reportIds !== 'ALL' ? { reportId: { in: reportIds } } : {}),
        ...(filters.reportId ? { reportId: filters.reportId } : {}),
        ...(filters.periodId ? { id: filters.periodId } : {}),
      },
      ...(teamIdFilter ? { teamId: { in: teamIdFilter } } : {}),
      ...(filters.state ? { submission: { state: filters.state } } : {}),
    };

    const assignments = await this.prisma.dynReportAssignment.findMany({
      where,
      include: {
        period: {
          include: { report: true, version: { include: { fields: true } } },
        },
        submission: true,
        unlocks: { where: { kind: 'GRANT' }, orderBy: { startsAt: 'desc' } },
      },
    });

    const teamIds = [...new Set(assignments.map((a) => a.teamId))];
    const teams =
      teamIds.length > 0
        ? await this.prisma.team.findMany({
            where: { id: { in: teamIds } },
            include: { parent: { select: { name: true } } },
          })
        : [];
    const parentNameByTeamId = new Map(
      teams.map((t) => [t.id, t.parent?.name ?? null]),
    );

    const facts: AssignmentFact[] = assignments.map((a) => {
      const submission = a.submission;
      const state = (submission?.state ?? 'NOT_STARTED') as SubmissionState;
      const completed = state === 'SUBMITTED' || state === 'APPROVED';
      const activeGrants = a.unlocks.filter(
        (u) =>
          !u.revokedAt &&
          u.startsAt.getTime() <= now.getTime() &&
          now.getTime() < u.expiresAt.getTime(),
      );
      return {
        state,
        exempt: a.obligation === 'EXEMPT',
        hasAnySavedData: !!submission?.firstSavedAt,
        originalDueAt: a.period.dueAt,
        currentCompletedAt: completed
          ? (submission?.submittedAt ?? null)
          : null,
        hasActiveGrant: activeGrants.length > 0,
        now,
        periodOpen: a.period.status === 'OPEN',
      };
    });
    const kpi = computeKpiSummary(facts);

    let rows: AssignmentStatusRow[] = assignments.map((a, i) => {
      const submission = a.submission;
      const fact = facts[i];
      const accessState = computeAccessState(fact);
      const timelinessState = computeTimelinessState(fact);

      const values =
        (submission?.values as Record<
          string,
          { v: string | null } | undefined
        >) ?? {};
      const fields = a.period.version.fields;
      const countTotal = fields.length;
      const countNonBlank = fields.filter((f) => {
        const v = values[f.fieldKey]?.v;
        return v !== null && v !== undefined && v !== '';
      }).length;

      const latestGrant = a.unlocks[0];
      const activeGrant = a.unlocks.find(
        (u) =>
          !u.revokedAt &&
          u.startsAt.getTime() <= now.getTime() &&
          now.getTime() < u.expiresAt.getTime(),
      );
      const changedSinceReopen = !!(
        latestGrant &&
        submission?.updatedAt &&
        submission.updatedAt.getTime() > latestGrant.startsAt.getTime()
      );

      const teamSnapshot = a.teamSnapshot as { name?: string } | null;

      return {
        assignmentId: a.id,
        reportId: a.period.reportId,
        reportName: a.period.report.name,
        periodId: a.periodId,
        periodKey: a.period.periodKey,
        periodStart: a.period.startDate.toISOString().slice(0, 10),
        periodEnd: a.period.endDate.toISOString().slice(0, 10),
        teamId: a.teamId,
        teamName: teamSnapshot?.name ?? a.teamId,
        parentTeamName: parentNameByTeamId.get(a.teamId) ?? null,
        dataCoverageLabel: formatRatioLabel(countNonBlank, countTotal),
        state: fact.state,
        accessState,
        timelinessState,
        exempt: fact.exempt,
        dueAt: a.period.dueAt.toISOString(),
        effectiveLockAt: activeGrant
          ? activeGrant.expiresAt.toISOString()
          : null,
        submittedAt: submission?.submittedAt?.toISOString() ?? null,
        approvedAt: submission?.approvedAt?.toISOString() ?? null,
        updatedAt: submission?.updatedAt?.toISOString() ?? null,
        grantCount: a.unlocks.length,
        changedSinceReopen,
      };
    });

    if (filters.overdue !== undefined) {
      rows = rows.filter((r) =>
        filters.overdue
          ? r.timelinessState === 'OVERDUE_NOT_DONE'
          : r.timelinessState !== 'OVERDUE_NOT_DONE',
      );
    }
    if (filters.reopened !== undefined) {
      rows = rows.filter((r) =>
        filters.reopened
          ? r.accessState === 'REOPENED'
          : r.accessState !== 'REOPENED',
      );
    }

    // Default sort (spec S19): quá hạn chưa nộp trước, rồi sắp đến hạn.
    rows.sort((a, b) => {
      const aOverdue = a.timelinessState === 'OVERDUE_NOT_DONE' ? 0 : 1;
      const bOverdue = b.timelinessState === 'OVERDUE_NOT_DONE' ? 0 : 1;
      if (aOverdue !== bOverdue) return aOverdue - bOverdue;
      return a.dueAt.localeCompare(b.dueAt);
    });

    return { rows, kpi, asOf: now.toISOString() };
  }

  async listAssignmentStatuses(
    userId: string,
    roleId: string,
    filters: StatusListFilters,
    page = 1,
    pageSize = DEFAULT_PAGE_SIZE,
  ): Promise<StatusListResult> {
    const { rows, kpi, asOf } = await this.queryRows(userId, roleId, filters);

    const total = rows.length;
    const clampedPageSize = Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE);
    const safePage = Math.max(page, 1);
    const start = (safePage - 1) * clampedPageSize;
    const items = rows.slice(start, start + clampedPageSize);

    return { items, total, kpi, asOf };
  }

  /** S19 "Xuất" — same filters/scope as the list, every matching row, no pagination. */
  async queryAllForExport(
    userId: string,
    roleId: string,
    filters: StatusListFilters,
  ): Promise<{ rows: AssignmentStatusRow[]; asOf: string }> {
    const { rows, asOf } = await this.queryRows(userId, roleId, filters);
    return { rows, asOf };
  }
}
