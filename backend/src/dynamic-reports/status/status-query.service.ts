import { Injectable, NotFoundException } from '@nestjs/common';
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
  /** S27 "người nhập" (PR8 slice 8) — assignment has this user as an active editor. */
  editorUserId?: string;
  /** S27 "quản lý" — the assignment's report has this user as an active MANAGER role. */
  managerUserId?: string;
  /** S27 "loại kỳ" — matched against `DynReportPeriod.scheduleSnapshot.periodType`, captured when the period was generated. */
  periodType?: string;
}

export interface StatusListResult {
  items: AssignmentStatusRow[];
  total: number;
  kpi: KpiSummary;
  asOf: string;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
/** S20 (spec §6.1 PR8) — "≤12 cột, nhiều hơn thì chuyển sang bảng" (dùng bảng S19 thay thế). */
const MATRIX_MAX_PERIODS = 12;

export interface StatusMatrixCell {
  /** `true` → team has no assignment for this period at all ("Không giao"), distinct from NOT_STARTED ("Chưa nhập"). */
  notAssigned: boolean;
  state: SubmissionState | null;
  accessState: AccessState | null;
  timelinessState: TimelinessState | null;
  exempt: boolean;
  dueAt: string | null;
}

export interface StatusMatrixView {
  periods: Array<{ periodId: string; periodKey: string; dueAt: string }>;
  teams: Array<{ teamId: string; teamName: string }>;
  /** `cells[teamId][periodId]`. */
  cells: Record<string, Record<string, StatusMatrixCell>>;
  asOf: string;
}

export interface ReportOption {
  reportId: string;
  reportName: string;
}

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

    // SECURITY (R13): `filters.reportId` must narrow WITHIN the caller's own
    // scope, never replace it — the two conditions share the same Prisma
    // `reportId` key under `period`, so spreading both in the same object
    // literal would let the second one silently overwrite the first and let
    // a caller request any reportId regardless of role. A non-admin asking
    // for a reportId outside their own scope gets zero rows, not that
    // report's data.
    if (
      filters.reportId &&
      reportIds !== 'ALL' &&
      !reportIds.includes(filters.reportId)
    ) {
      return { rows: [], kpi: computeKpiSummary([]), asOf: now.toISOString() };
    }
    const reportIdCondition: string | { in: string[] } | undefined =
      filters.reportId ?? (reportIds !== 'ALL' ? { in: reportIds } : undefined);

    let teamIdFilter: string[] | undefined;
    if (filters.teamId) {
      const descendants = await this.teamsService.getDescendantIds(
        filters.teamId,
      );
      teamIdFilter = [filters.teamId, ...descendants];
    }

    const where: Prisma.DynReportAssignmentWhereInput = {
      period: {
        ...(reportIdCondition ? { reportId: reportIdCondition } : {}),
        ...(filters.periodId ? { id: filters.periodId } : {}),
        ...(filters.periodType
          ? {
              scheduleSnapshot: {
                path: ['periodType'],
                equals: filters.periodType,
              },
            }
          : {}),
        ...(filters.managerUserId
          ? {
              report: {
                roles: {
                  some: {
                    userId: filters.managerUserId,
                    role: 'MANAGER',
                    validFrom: { lte: now },
                    OR: [{ validTo: null }, { validTo: { gt: now } }],
                  },
                },
              },
            }
          : {}),
      },
      ...(teamIdFilter ? { teamId: { in: teamIdFilter } } : {}),
      ...(filters.state ? { submission: { state: filters.state } } : {}),
      ...(filters.editorUserId
        ? {
            editors: { some: { userId: filters.editorUserId, isActive: true } },
          }
        : {}),
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

  /** S20's own report picker — every report the caller may see (same R13 scope as the rest of this service). */
  async listReportsInScope(
    userId: string,
    roleId: string,
  ): Promise<ReportOption[]> {
    const reportIds = await this.resolveReportIds(userId, roleId);
    if (reportIds !== 'ALL' && reportIds.length === 0) return [];
    const reports = await this.prisma.dynReport.findMany({
      where: reportIds === 'ALL' ? {} : { id: { in: reportIds } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
    return reports.map((r) => ({ reportId: r.id, reportName: r.name }));
  }

  /**
   * S20 ma trận: Tổ × Kỳ cho MỘT báo cáo. Hàng = mọi tổ hiện là target của
   * báo cáo HOẶC có assignment trong các kỳ được chọn (tổ đã bị gỡ khỏi
   * target nhưng còn dữ liệu kỳ cũ vẫn phải hiện). Cột = tối đa
   * `MATRIX_MAX_PERIODS` kỳ gần nhất. Ô không có assignment nào (dù là
   * target hiện tại) → `notAssigned=true` ("Không giao"), khác với
   * `state=NOT_STARTED` ("Chưa nhập", có assignment nhưng chưa làm gì).
   */
  async getStatusMatrix(
    userId: string,
    roleId: string,
    reportId: string,
  ): Promise<StatusMatrixView> {
    const now = new Date();
    const reportIds = await this.resolveReportIds(userId, roleId);
    if (reportIds !== 'ALL' && !reportIds.includes(reportId)) {
      throw new NotFoundException('Không tìm thấy báo cáo này.');
    }

    const periodsDesc = await this.prisma.dynReportPeriod.findMany({
      where: { reportId },
      orderBy: { startDate: 'desc' },
      take: MATRIX_MAX_PERIODS,
    });
    if (periodsDesc.length === 0) {
      return { periods: [], teams: [], cells: {}, asOf: now.toISOString() };
    }
    const periods = [...periodsDesc].reverse();
    const periodIds = periods.map((p) => p.id);

    const [targets, assignments] = await Promise.all([
      this.prisma.dynReportTarget.findMany({
        where: {
          reportId,
          validFrom: { lte: now },
          OR: [{ validTo: null }, { validTo: { gt: now } }],
        },
        include: { team: { select: { id: true, name: true } } },
      }),
      this.prisma.dynReportAssignment.findMany({
        where: { periodId: { in: periodIds } },
        include: {
          submission: true,
          unlocks: { where: { kind: 'GRANT' }, orderBy: { startsAt: 'desc' } },
        },
      }),
    ]);

    const teamNameById = new Map<string, string>();
    for (const t of targets) teamNameById.set(t.teamId, t.team.name);
    for (const a of assignments) {
      if (!teamNameById.has(a.teamId)) {
        const snapshot = a.teamSnapshot as { name?: string } | null;
        teamNameById.set(a.teamId, snapshot?.name ?? a.teamId);
      }
    }
    const teams = [...teamNameById.entries()]
      .map(([teamId, teamName]) => ({ teamId, teamName }))
      .sort((a, b) => a.teamName.localeCompare(b.teamName, 'vi'));

    const assignmentByKey = new Map<string, (typeof assignments)[number]>();
    for (const a of assignments)
      assignmentByKey.set(`${a.teamId}:${a.periodId}`, a);

    const cells: Record<string, Record<string, StatusMatrixCell>> = {};
    for (const { teamId } of teams) {
      cells[teamId] = {};
      for (const period of periods) {
        const a = assignmentByKey.get(`${teamId}:${period.id}`);
        if (!a) {
          cells[teamId][period.id] = {
            notAssigned: true,
            state: null,
            accessState: null,
            timelinessState: null,
            exempt: false,
            dueAt: null,
          };
          continue;
        }
        const submission = a.submission;
        const state = (submission?.state ?? 'NOT_STARTED') as SubmissionState;
        const completed = state === 'SUBMITTED' || state === 'APPROVED';
        const activeGrants = a.unlocks.filter(
          (u) =>
            !u.revokedAt &&
            u.startsAt.getTime() <= now.getTime() &&
            now.getTime() < u.expiresAt.getTime(),
        );
        const fact: AssignmentFact = {
          state,
          exempt: a.obligation === 'EXEMPT',
          hasAnySavedData: !!submission?.firstSavedAt,
          originalDueAt: period.dueAt,
          currentCompletedAt: completed
            ? (submission?.submittedAt ?? null)
            : null,
          hasActiveGrant: activeGrants.length > 0,
          now,
          periodOpen: period.status === 'OPEN',
        };
        cells[teamId][period.id] = {
          notAssigned: false,
          state,
          accessState: computeAccessState(fact),
          timelinessState: computeTimelinessState(fact),
          exempt: fact.exempt,
          dueAt: period.dueAt.toISOString(),
        };
      }
    }

    return {
      periods: periods.map((p) => ({
        periodId: p.id,
        periodKey: p.periodKey,
        dueAt: p.dueAt.toISOString(),
      })),
      teams,
      cells,
      asOf: now.toISOString(),
    };
  }
}
