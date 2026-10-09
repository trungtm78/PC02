import { resolveAccess } from './access';
import type { AccessInput } from './access';

/**
 * Access engine — decides whether a write is allowed right now (FRD §5/§6.1
 * Detail Design "Quyền ghi và khóa giao dịch"): pure, no I/O, no clock
 * reads — `now` is always a parameter so boundary instants (T-1ms/T/T+1ms)
 * are exactly reproducible in tests. The calling service re-reads this at
 * the moment of commit inside the write transaction (spec §10 R4,
 * clock_timestamp()), not earlier — this engine only encodes the decision
 * logic, not when it's invoked.
 */

const T = new Date('2026-10-09T10:00:00.000Z'); // original due instant

function baseInput(overrides: Partial<AccessInput> = {}): AccessInput {
  return {
    state: 'DRAFT',
    periodStatus: 'OPEN',
    opensAt: new Date('2026-10-01T00:00:00.000Z'),
    originalDueAt: T,
    returnDueAt: null,
    grants: [],
    userActive: true,
    now: T,
    ...overrides,
  };
}

describe('resolveAccess — deadline boundary (T-1ms / T / T+1ms)', () => {
  it('allows writing 1ms before the original deadline', () => {
    const result = resolveAccess(baseInput({ now: new Date(T.getTime() - 1) }));
    expect(result.canEdit).toBe(true);
  });

  it('blocks writing exactly AT the original deadline (strict less-than, FRD: "Tại đúng thời điểm khóa: từ chối ghi")', () => {
    const result = resolveAccess(baseInput({ now: T }));
    expect(result.canEdit).toBe(false);
    expect(result.reason).toBe('PAST_DEADLINE');
  });

  it('blocks writing 1ms after the original deadline', () => {
    const result = resolveAccess(baseInput({ now: new Date(T.getTime() + 1) }));
    expect(result.canEdit).toBe(false);
  });
});

describe('resolveAccess — not yet open', () => {
  it('blocks writing before opensAt', () => {
    const result = resolveAccess(
      baseInput({ now: new Date('2026-09-30T00:00:00.000Z') }),
    );
    expect(result.canEdit).toBe(false);
    expect(result.reason).toBe('NOT_YET_OPEN');
  });

  it('allows writing exactly at opensAt (inclusive, FRD: "opens_at <= now")', () => {
    const opensAt = new Date('2026-10-01T00:00:00.000Z');
    const result = resolveAccess(baseInput({ now: opensAt, opensAt }));
    expect(result.canEdit).toBe(true);
  });
});

describe('resolveAccess — user state and submission state', () => {
  it('blocks a disabled account immediately, regardless of deadline', () => {
    const result = resolveAccess(
      baseInput({ userActive: false, now: new Date(T.getTime() - 1) }),
    );
    expect(result.canEdit).toBe(false);
    expect(result.reason).toBe('USER_INACTIVE');
  });

  it('blocks writes once the period is finalized, even if a grant would otherwise be active', () => {
    const result = resolveAccess(
      baseInput({
        periodStatus: 'FINALIZED',
        now: new Date(T.getTime() - 1000),
        grants: [
          {
            startsAt: new Date(T.getTime() - 3600_000),
            expiresAt: new Date(T.getTime() + 3600_000),
            revokedAt: null,
          },
        ],
      }),
    );
    expect(result.canEdit).toBe(false);
    expect(result.reason).toBe('PERIOD_FINALIZED');
  });

  it('blocks SUBMITTED (locked until returned or granted)', () => {
    const result = resolveAccess(
      baseInput({ state: 'SUBMITTED', now: new Date(T.getTime() - 1) }),
    );
    expect(result.canEdit).toBe(false);
    expect(result.reason).toBe('WRONG_STATE');
  });

  it('blocks APPROVED the same way', () => {
    const result = resolveAccess(
      baseInput({ state: 'APPROVED', now: new Date(T.getTime() - 1) }),
    );
    expect(result.canEdit).toBe(false);
    expect(result.reason).toBe('WRONG_STATE');
  });

  it('allows NOT_STARTED to be written (first save)', () => {
    const result = resolveAccess(
      baseInput({ state: 'NOT_STARTED', now: new Date(T.getTime() - 1) }),
    );
    expect(result.canEdit).toBe(true);
  });
});

describe('resolveAccess — RETURNED state uses returnDueAt, not the original deadline', () => {
  it('allows writing before returnDueAt even though the original deadline has already passed', () => {
    const returnDueAt = new Date(T.getTime() + 3600_000);
    const result = resolveAccess(
      baseInput({
        state: 'RETURNED',
        now: new Date(T.getTime() + 1800_000),
        returnDueAt,
      }),
    );
    expect(result.canEdit).toBe(true);
    expect(result.effectiveLockAt).toEqual(returnDueAt);
  });

  it('blocks writing once returnDueAt itself has passed', () => {
    const returnDueAt = new Date(T.getTime() + 3600_000);
    const result = resolveAccess(
      baseInput({
        state: 'RETURNED',
        now: new Date(returnDueAt.getTime() + 1),
        returnDueAt,
      }),
    );
    expect(result.canEdit).toBe(false);
  });
});

describe('resolveAccess — unlock grants', () => {
  it('a grant active after the original deadline allows writing, with effectiveLockAt = the grant expiry', () => {
    const expiresAt = new Date(T.getTime() + 3 * 3600_000);
    const result = resolveAccess(
      baseInput({
        now: new Date(T.getTime() + 1800_000),
        grants: [{ startsAt: T, expiresAt, revokedAt: null }],
      }),
    );
    expect(result.canEdit).toBe(true);
    expect(result.effectiveLockAt).toEqual(expiresAt);
  });

  it('a grant shorter than the original deadline never shortens it (BRD §6.3: "một grant ngắn hơn không rút ngắn hạn gốc")', () => {
    const shortGrantExpiry = new Date(T.getTime() - 3600_000); // expires BEFORE the original deadline
    const result = resolveAccess(
      baseInput({
        now: new Date(T.getTime() - 1800_000), // still before the original deadline
        grants: [
          {
            startsAt: new Date(T.getTime() - 7200_000),
            expiresAt: shortGrantExpiry,
            revokedAt: null,
          },
        ],
      }),
    );
    expect(result.canEdit).toBe(true);
    expect(result.effectiveLockAt).toEqual(T); // original deadline still governs, not the shorter grant
  });

  it('a revoked grant is ignored — access reverts to checking the original deadline', () => {
    const expiresAt = new Date(T.getTime() + 3 * 3600_000);
    const result = resolveAccess(
      baseInput({
        now: new Date(T.getTime() + 1800_000), // after original deadline
        grants: [
          { startsAt: T, expiresAt, revokedAt: new Date(T.getTime() + 60_000) },
        ],
      }),
    );
    expect(result.canEdit).toBe(false);
    expect(result.reason).toBe('PAST_DEADLINE');
  });

  it('an expired (but not revoked) grant also reverts to the original deadline check', () => {
    const expiresAt = new Date(T.getTime() + 3600_000);
    const result = resolveAccess(
      baseInput({
        now: new Date(expiresAt.getTime() + 1), // after the grant itself expired
        grants: [{ startsAt: T, expiresAt, revokedAt: null }],
      }),
    );
    expect(result.canEdit).toBe(false);
  });

  it('a not-yet-started future grant does not grant access early', () => {
    const futureStart = new Date(T.getTime() + 3600_000);
    const result = resolveAccess(
      baseInput({
        now: new Date(T.getTime() + 1800_000), // after original deadline, before the grant starts
        grants: [
          {
            startsAt: futureStart,
            expiresAt: new Date(futureStart.getTime() + 3600_000),
            revokedAt: null,
          },
        ],
      }),
    );
    expect(result.canEdit).toBe(false);
  });

  it('picks the latest-expiring active grant when multiple are active', () => {
    const laterExpiry = new Date(T.getTime() + 5 * 3600_000);
    const result = resolveAccess(
      baseInput({
        now: new Date(T.getTime() + 1800_000),
        grants: [
          {
            startsAt: T,
            expiresAt: new Date(T.getTime() + 3600_000),
            revokedAt: null,
          },
          { startsAt: T, expiresAt: laterExpiry, revokedAt: null },
        ],
      }),
    );
    expect(result.effectiveLockAt).toEqual(laterExpiry);
  });
});
