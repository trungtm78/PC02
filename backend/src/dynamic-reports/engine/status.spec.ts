import {
  formatRatioLabel,
  computeAccessState,
  computeTimelinessState,
  computeKpiSummary,
} from './status';
import type { AssignmentFact } from './status';

/**
 * Status engine — the independent status dimensions and KPI math for màn
 * C "Tình trạng nhập liệu" (FRD §7.2-§7.3, D04 note in spec §3.2). Pure, no
 * I/O. Progress itself reuses access.ts's SubmissionState directly (no
 * second copy of that enum); this file adds the three dimensions that are
 * independent of it — quyền nhập, đúng hạn, nghĩa vụ — plus the KPI roll-up.
 */

function fact(overrides: Partial<AssignmentFact> = {}): AssignmentFact {
  return {
    state: 'DRAFT',
    exempt: false,
    hasAnySavedData: true,
    originalDueAt: new Date('2026-10-09T10:00:00.000Z'),
    currentCompletedAt: null,
    hasActiveGrant: false,
    now: new Date('2026-10-05T00:00:00.000Z'),
    periodOpen: true,
    ...overrides,
  };
}

describe('formatRatioLabel — mẫu số 0 (FRD §7.3)', () => {
  it('formats a normal ratio as "N/D"', () => {
    expect(formatRatioLabel(16, 24)).toBe('16/24');
  });

  it('never divides by zero — shows "— / Không có lượt được giao" instead', () => {
    expect(formatRatioLabel(0, 0)).toBe('— / Không có lượt được giao');
  });
});

describe('computeAccessState', () => {
  it('NOT_YET_OPEN when the period has not opened', () => {
    expect(computeAccessState(fact({ periodOpen: false }))).toBe(
      'NOT_YET_OPEN',
    );
  });

  it('OPEN before the deadline with no active grant', () => {
    expect(
      computeAccessState(fact({ now: new Date('2026-10-05T00:00:00.000Z') })),
    ).toBe('OPEN');
  });

  it('LOCKED after the deadline with no active grant', () => {
    expect(
      computeAccessState(fact({ now: new Date('2026-10-10T00:00:00.000Z') })),
    ).toBe('LOCKED');
  });

  it('REOPENED when a grant is active after the original deadline', () => {
    expect(
      computeAccessState(
        fact({
          now: new Date('2026-10-10T00:00:00.000Z'),
          hasActiveGrant: true,
        }),
      ),
    ).toBe('REOPENED');
  });

  it('still OPEN (not REOPENED) when a grant happens to be active before the deadline too', () => {
    expect(
      computeAccessState(
        fact({
          now: new Date('2026-10-05T00:00:00.000Z'),
          hasActiveGrant: true,
        }),
      ),
    ).toBe('OPEN');
  });
});

describe('computeTimelinessState', () => {
  it('NOT_YET_DUE before the deadline, not yet completed', () => {
    expect(
      computeTimelinessState(
        fact({ now: new Date('2026-10-05T00:00:00.000Z') }),
      ),
    ).toBe('NOT_YET_DUE');
  });

  it('ON_TIME when completed before the original deadline', () => {
    const f = fact({
      currentCompletedAt: new Date('2026-10-08T00:00:00.000Z'),
      now: new Date('2026-10-09T09:00:00.000Z'),
    });
    expect(computeTimelinessState(f)).toBe('ON_TIME');
  });

  it('LATE when completed after the original deadline (e.g. via a reopen)', () => {
    const f = fact({
      currentCompletedAt: new Date('2026-10-10T00:00:00.000Z'),
      now: new Date('2026-10-11T00:00:00.000Z'),
    });
    expect(computeTimelinessState(f)).toBe('LATE');
  });

  it('OVERDUE_NOT_DONE when the deadline has passed and current revision is still not completed', () => {
    const f = fact({
      currentCompletedAt: null,
      now: new Date('2026-10-10T00:00:00.000Z'),
    });
    expect(computeTimelinessState(f)).toBe('OVERDUE_NOT_DONE');
  });

  it('OVERDUE_NOT_DONE still applies even while a reopen grant is active (BRD: "mở lại không xóa trễ")', () => {
    const f = fact({
      currentCompletedAt: null,
      now: new Date('2026-10-10T00:00:00.000Z'),
      hasActiveGrant: true,
    });
    expect(computeTimelinessState(f)).toBe('OVERDUE_NOT_DONE');
  });
});

describe('computeKpiSummary', () => {
  it('counts required/completed/notStarted/overdue correctly and excludes exempt assignments from the denominator', () => {
    const facts: AssignmentFact[] = [
      fact({
        state: 'APPROVED',
        currentCompletedAt: new Date('2026-10-08T00:00:00.000Z'),
        now: new Date('2026-10-09T09:00:00.000Z'),
      }), // on-time, completed
      fact({
        state: 'NOT_STARTED',
        hasAnySavedData: false,
        now: new Date('2026-10-05T00:00:00.000Z'),
      }), // not started, not yet due
      fact({
        state: 'DRAFT',
        hasAnySavedData: true,
        now: new Date('2026-10-10T00:00:00.000Z'),
      }), // overdue, in progress, not completed
      fact({ state: 'NOT_STARTED', exempt: true, hasAnySavedData: false }), // exempt — excluded from "phải nộp"
    ];
    const summary = computeKpiSummary(facts);
    expect(summary.requiredCount).toBe(3); // exempt one excluded
    expect(summary.completedCount).toBe(1);
    expect(summary.notStartedCount).toBe(1);
    expect(summary.inProgressCount).toBe(1);
    expect(summary.overdueNotDoneCount).toBe(1);
    expect(summary.exemptCount).toBe(1);
  });

  it('reopened is a reported overlap count, never added into the progress total (FRD §7.2)', () => {
    const facts: AssignmentFact[] = [
      fact({
        state: 'DRAFT',
        now: new Date('2026-10-10T00:00:00.000Z'),
        hasActiveGrant: true,
      }),
    ];
    const summary = computeKpiSummary(facts);
    expect(summary.reopenedCount).toBe(1);
    expect(summary.requiredCount).toBe(1);
    expect(
      summary.notStartedCount +
        summary.inProgressCount +
        summary.completedCount,
    ).toBe(1);
  });

  it('data coverage counts any assignment with saved data, completed or not', () => {
    const facts: AssignmentFact[] = [
      fact({ hasAnySavedData: true, state: 'DRAFT' }),
      fact({ hasAnySavedData: false, state: 'NOT_STARTED' }),
    ];
    const summary = computeKpiSummary(facts);
    expect(summary.dataCoverageLabel).toBe('1/2');
  });

  it('produces "— / Không có lượt được giao" when there are zero required assignments', () => {
    const summary = computeKpiSummary([fact({ exempt: true })]);
    expect(summary.completionRateLabel).toBe('— / Không có lượt được giao');
    expect(summary.requiredCount).toBe(0);
  });

  it('onTimeRate only counts assignments whose deadline has already passed in its denominator (FRD: "kỳ chưa đến hạn không vào mẫu số")', () => {
    const facts: AssignmentFact[] = [
      fact({
        now: new Date('2026-10-05T00:00:00.000Z'),
        currentCompletedAt: null,
      }), // not yet due -> excluded from denominator
      fact({
        state: 'SUBMITTED',
        now: new Date('2026-10-20T00:00:00.000Z'), // deadline (10-09) has passed
        currentCompletedAt: new Date('2026-10-08T00:00:00.000Z'), // completed before the deadline -> on time
      }),
    ];
    const summary = computeKpiSummary(facts);
    expect(summary.onTimeRateLabel).toBe('1/1'); // denominator is 1 (only the past-due one), not 2
  });
});
