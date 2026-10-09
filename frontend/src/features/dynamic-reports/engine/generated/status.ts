import type { SubmissionState } from './access';

/**
 * Status engine — independent status dimensions and KPI roll-up for màn C
 * "Tình trạng nhập liệu" (FRD §7.2-§7.3). Pure, no I/O, no clock reads.
 * Progress itself is just `SubmissionState` from access.ts (no duplicate
 * enum); this file adds the three dimensions FRD keeps explicitly
 * independent of it — quyền nhập, đúng hạn, nghĩa vụ — plus KPI math.
 */

export type AccessState = 'NOT_YET_OPEN' | 'OPEN' | 'LOCKED' | 'REOPENED';
export type TimelinessState =
  | 'NOT_YET_DUE'
  | 'ON_TIME'
  | 'LATE'
  | 'OVERDUE_NOT_DONE';

export interface AssignmentFact {
  state: SubmissionState;
  exempt: boolean;
  hasAnySavedData: boolean;
  originalDueAt: Date;
  /** The CURRENT revision's completion instant, or null if not currently completed. Carries forward even through a later reopen-and-resave (FRD: "Bản hiện tại đang chỉnh sửa; từng hoàn thành đúng hạn lúc ..." uses history separately, not this field). */
  currentCompletedAt: Date | null;
  hasActiveGrant: boolean;
  now: Date;
  periodOpen: boolean;
}

/**
 * FRD §7.3: "Mẫu số 0 hiển thị '— / Không có lượt được giao', không chia
 * cho 0 hoặc hiện 100% vô nghĩa."
 */
export function formatRatioLabel(
  numerator: number,
  denominator: number,
): string {
  if (denominator === 0) return '— / Không có lượt được giao';
  return `${numerator}/${denominator}`;
}

export function computeAccessState(fact: AssignmentFact): AccessState {
  if (!fact.periodOpen) return 'NOT_YET_OPEN';
  const pastDeadline = fact.now.getTime() >= fact.originalDueAt.getTime();
  if (fact.hasActiveGrant && pastDeadline) return 'REOPENED';
  if (pastDeadline) return 'LOCKED';
  return 'OPEN';
}

/**
 * FRD §7.2: "Không gộp 'mở lại' vào trạng thái tiến độ" — reopen is
 * reported as a separate overlapping flag (computeAccessState), never
 * folded into this dimension.
 */
export function computeTimelinessState(fact: AssignmentFact): TimelinessState {
  const pastDeadline = fact.now.getTime() >= fact.originalDueAt.getTime();
  if (fact.currentCompletedAt) {
    return fact.currentCompletedAt.getTime() <= fact.originalDueAt.getTime()
      ? 'ON_TIME'
      : 'LATE';
  }
  // FRD/BRD: "mở lại không xóa trễ" — an active grant does not change this
  // dimension; overdue-and-not-done stays overdue-and-not-done.
  return pastDeadline ? 'OVERDUE_NOT_DONE' : 'NOT_YET_DUE';
}

export interface KpiSummary {
  requiredCount: number;
  exemptCount: number;
  completedCount: number;
  notStartedCount: number;
  inProgressCount: number;
  overdueNotDoneCount: number;
  /** Overlapping indicator — never added into the progress total (FRD §7.2/§7.3). */
  reopenedCount: number;
  completionRateLabel: string;
  onTimeRateLabel: string;
  dataCoverageLabel: string;
}

// D04: "Nộp xong là khoá" — the act of submitting IS the completion
// declaration (what pre-D04 FRD called "Hoàn thành"); a later manager
// approval does not change whether the obligation was met on time, so both
// states count as "completed" for KPI purposes.
const COMPLETED_STATES: readonly SubmissionState[] = ['SUBMITTED', 'APPROVED'];

export function computeKpiSummary(facts: AssignmentFact[]): KpiSummary {
  const required = facts.filter((f) => !f.exempt);
  const exemptCount = facts.length - required.length;

  let completedCount = 0;
  let notStartedCount = 0;
  let inProgressCount = 0;
  let overdueNotDoneCount = 0;
  let reopenedCount = 0;
  let dataCoverageCount = 0;
  let pastDueCount = 0;
  let onTimeCount = 0;

  for (const f of required) {
    if (COMPLETED_STATES.includes(f.state)) {
      completedCount++;
    } else if (!f.hasAnySavedData && f.state === 'NOT_STARTED') {
      notStartedCount++;
    } else {
      inProgressCount++;
    }

    if (computeTimelinessState(f) === 'OVERDUE_NOT_DONE') overdueNotDoneCount++;
    if (computeAccessState(f) === 'REOPENED') reopenedCount++;
    if (f.hasAnySavedData) dataCoverageCount++;

    const pastDeadline = f.now.getTime() >= f.originalDueAt.getTime();
    if (pastDeadline) {
      pastDueCount++;
      // ON_TIME already implies currentCompletedAt was set at/before the
      // deadline (see computeTimelinessState) — no need to also re-check
      // `state` here, which keeps this metric decoupled from exactly how
      // the caller labels submission state.
      if (computeTimelinessState(f) === 'ON_TIME') {
        onTimeCount++;
      }
    }
  }

  return {
    requiredCount: required.length,
    exemptCount,
    completedCount,
    notStartedCount,
    inProgressCount,
    overdueNotDoneCount,
    reopenedCount,
    completionRateLabel: formatRatioLabel(completedCount, required.length),
    onTimeRateLabel: formatRatioLabel(onTimeCount, pastDueCount),
    dataCoverageLabel: formatRatioLabel(dataCoverageCount, required.length),
  };
}
