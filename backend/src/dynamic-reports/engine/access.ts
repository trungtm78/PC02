/**
 * Access engine — decides whether a write is allowed right now (Detail
 * Design "Quyền ghi và khóa giao dịch", FRD §5/§6.3). Pure, no I/O, no
 * clock reads: `now` is always a parameter, so the exact deadline-boundary
 * instants (T-1ms/T/T+1ms) are reproducible in tests. The caller is
 * responsible for re-reading `now` at the actual moment of commit inside
 * the write transaction (spec §10 R4: Postgres `clock_timestamp()`, not
 * the transaction-start `now()`) — this engine only encodes the decision
 * logic, never when it runs.
 */

export type SubmissionState =
  | 'NOT_STARTED'
  | 'DRAFT'
  | 'SUBMITTED'
  | 'RETURNED'
  | 'APPROVED';
export type PeriodStatus = 'OPEN' | 'FINALIZED';

export interface AccessGrant {
  startsAt: Date;
  expiresAt: Date;
  revokedAt?: Date | null;
}

export interface AccessInput {
  state: SubmissionState;
  periodStatus: PeriodStatus;
  opensAt: Date;
  /** Never changed by a grant — BRD §6.3: "một grant ngắn hơn không rút ngắn hạn gốc". */
  originalDueAt: Date;
  /** Only consulted when state === 'RETURNED'. */
  returnDueAt?: Date | null;
  grants: AccessGrant[];
  userActive: boolean;
  now: Date;
}

export type AccessDeniedReason =
  | 'USER_INACTIVE'
  | 'PERIOD_FINALIZED'
  | 'WRONG_STATE'
  | 'NOT_YET_OPEN'
  | 'PAST_DEADLINE';

export interface AccessResult {
  canEdit: boolean;
  /** The next instant access would stop, for a countdown display. null once already past with no active grant. */
  effectiveLockAt: Date | null;
  reason: AccessDeniedReason | null;
}

const EDITABLE_STATES: readonly SubmissionState[] = [
  'NOT_STARTED',
  'DRAFT',
  'RETURNED',
];

function activeGrant(grants: AccessGrant[], now: Date): AccessGrant | null {
  const active = grants.filter(
    (g) =>
      !g.revokedAt &&
      g.startsAt.getTime() <= now.getTime() &&
      now.getTime() < g.expiresAt.getTime(),
  );
  if (active.length === 0) return null;
  // Pick the latest-expiring one if several happen to be active at once.
  return active.reduce((a, b) =>
    b.expiresAt.getTime() > a.expiresAt.getTime() ? b : a,
  );
}

export function resolveAccess(input: AccessInput): AccessResult {
  if (!input.userActive) {
    return { canEdit: false, effectiveLockAt: null, reason: 'USER_INACTIVE' };
  }
  if (input.periodStatus === 'FINALIZED') {
    return {
      canEdit: false,
      effectiveLockAt: null,
      reason: 'PERIOD_FINALIZED',
    };
  }
  if (!EDITABLE_STATES.includes(input.state)) {
    return { canEdit: false, effectiveLockAt: null, reason: 'WRONG_STATE' };
  }
  if (input.now.getTime() < input.opensAt.getTime()) {
    return {
      canEdit: false,
      effectiveLockAt: input.opensAt,
      reason: 'NOT_YET_OPEN',
    };
  }

  const grant = activeGrant(input.grants, input.now);
  if (grant) {
    return { canEdit: true, effectiveLockAt: grant.expiresAt, reason: null };
  }

  const deadline =
    input.state === 'RETURNED' && input.returnDueAt
      ? input.returnDueAt
      : input.originalDueAt;

  if (input.now.getTime() < deadline.getTime()) {
    return { canEdit: true, effectiveLockAt: deadline, reason: null };
  }

  return { canEdit: false, effectiveLockAt: null, reason: 'PAST_DEADLINE' };
}
