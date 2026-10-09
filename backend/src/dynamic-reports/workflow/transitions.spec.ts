import { applyTransition } from './transitions';
import type { TransitionContext } from './transitions';

/**
 * Submission workflow — one declarative transition table (spec §10 R1)
 * replacing what the original design split across four services
 * (ReviewService/UnlockService/AdjustmentService + implicit save logic).
 * Pure, no I/O, no Prisma — the NestJS service wraps this in a transaction
 * and persists whatever it returns (next state, revision kind, audit
 * action, notification). Covers D04's "nộp xong là khoá" state machine and
 * R21's multi-level approval chain.
 */

function ctx(overrides: Partial<TransitionContext> = {}): TransitionContext {
  return {
    state: 'DRAFT',
    approvalLevel: 0,
    totalApprovalLevels: 1,
    actorRole: 'EDITOR',
    hasRequiredFieldsValid: true,
    hasErrorSeverityRuleViolation: false,
    actingApprovalLevel: 1,
    ...overrides,
  };
}

describe('SAVE', () => {
  it('NOT_STARTED -> DRAFT on first save', () => {
    const result = applyTransition('SAVE', ctx({ state: 'NOT_STARTED' }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.next).toBe('DRAFT');
      expect(result.revisionKind).toBe('SAVE');
    }
  });

  it('DRAFT -> DRAFT (stays) on subsequent saves', () => {
    const result = applyTransition('SAVE', ctx({ state: 'DRAFT' }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.next).toBe('DRAFT');
  });

  it('RETURNED -> DRAFT when the team edits after a return', () => {
    const result = applyTransition('SAVE', ctx({ state: 'RETURNED' }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.next).toBe('DRAFT');
  });

  it('rejects SAVE from SUBMITTED (locked until returned or granted)', () => {
    const result = applyTransition('SAVE', ctx({ state: 'SUBMITTED' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('INVALID_STATE_TRANSITION');
  });

  it('rejects SAVE from APPROVED', () => {
    const result = applyTransition('SAVE', ctx({ state: 'APPROVED' }));
    expect(result.ok).toBe(false);
  });

  it('only an EDITOR may SAVE', () => {
    const result = applyTransition(
      'SAVE',
      ctx({ state: 'DRAFT', actorRole: 'MANAGER' }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('GUARD_FAILED');
  });
});

describe('SUBMIT', () => {
  it('DRAFT -> SUBMITTED when required fields are valid and no ERROR rule violation', () => {
    const result = applyTransition('SUBMIT', ctx({ state: 'DRAFT' }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.next).toBe('SUBMITTED');
      expect(result.revisionKind).toBe('SUBMIT');
    }
  });

  it('allows submitting directly from NOT_STARTED when there are no required fields (FRD §7.3)', () => {
    const result = applyTransition('SUBMIT', ctx({ state: 'NOT_STARTED' }));
    expect(result.ok).toBe(true);
  });

  it('RETURNED -> SUBMITTED (resubmit after a return)', () => {
    const result = applyTransition('SUBMIT', ctx({ state: 'RETURNED' }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.next).toBe('SUBMITTED');
  });

  it('blocks submit when a required field is missing/invalid', () => {
    const result = applyTransition(
      'SUBMIT',
      ctx({ state: 'DRAFT', hasRequiredFieldsValid: false }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('GUARD_FAILED');
  });

  it('blocks submit when an ERROR-severity validation rule is violated', () => {
    const result = applyTransition(
      'SUBMIT',
      ctx({ state: 'DRAFT', hasErrorSeverityRuleViolation: true }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects SUBMIT from SUBMITTED (no-op resubmit is not a transition)', () => {
    const result = applyTransition('SUBMIT', ctx({ state: 'SUBMITTED' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('INVALID_STATE_TRANSITION');
  });

  it('rejects SUBMIT from APPROVED directly (must UNAPPROVE first)', () => {
    const result = applyTransition('SUBMIT', ctx({ state: 'APPROVED' }));
    expect(result.ok).toBe(false);
  });

  it('only an EDITOR may SUBMIT', () => {
    const result = applyTransition(
      'SUBMIT',
      ctx({ state: 'DRAFT', actorRole: 'MANAGER' }),
    );
    expect(result.ok).toBe(false);
  });
});

describe('RETURN', () => {
  it('SUBMITTED -> RETURNED, only a MANAGER may return', () => {
    const result = applyTransition(
      'RETURN',
      ctx({ state: 'SUBMITTED', actorRole: 'MANAGER' }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.next).toBe('RETURNED');
      expect(result.revisionKind).toBe('RETURN');
    }
  });

  it('an EDITOR cannot return their own submission', () => {
    const result = applyTransition(
      'RETURN',
      ctx({ state: 'SUBMITTED', actorRole: 'EDITOR' }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('GUARD_FAILED');
  });

  it('rejects RETURN from DRAFT (nothing submitted yet to return)', () => {
    const result = applyTransition(
      'RETURN',
      ctx({ state: 'DRAFT', actorRole: 'MANAGER' }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('INVALID_STATE_TRANSITION');
  });
});

describe('APPROVE — single level (default, totalApprovalLevels=1)', () => {
  it('SUBMITTED -> APPROVED, only a MANAGER may approve', () => {
    const result = applyTransition(
      'APPROVE',
      ctx({ state: 'SUBMITTED', actorRole: 'MANAGER' }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.next).toBe('APPROVED');
      expect(result.nextApprovalLevel).toBe(1);
      expect(result.revisionKind).toBe('APPROVE');
    }
  });

  it('an EDITOR cannot approve', () => {
    const result = applyTransition(
      'APPROVE',
      ctx({ state: 'SUBMITTED', actorRole: 'EDITOR' }),
    );
    expect(result.ok).toBe(false);
  });

  it("blocks a level-1 manager from approving when it is level-2's turn (R21: must approve in sequence)", () => {
    const result = applyTransition(
      'APPROVE',
      ctx({
        state: 'SUBMITTED',
        actorRole: 'MANAGER',
        approvalLevel: 1,
        totalApprovalLevels: 3,
        actingApprovalLevel: 1,
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('GUARD_FAILED');
  });

  it('rejects APPROVE from DRAFT', () => {
    const result = applyTransition(
      'APPROVE',
      ctx({ state: 'DRAFT', actorRole: 'MANAGER' }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('INVALID_STATE_TRANSITION');
  });
});

describe('APPROVE — multi-level chain (R21)', () => {
  it('level 1 of 3 approves: state stays SUBMITTED, approvalLevel advances, no final APPROVED yet', () => {
    const result = applyTransition(
      'APPROVE',
      ctx({
        state: 'SUBMITTED',
        actorRole: 'MANAGER',
        approvalLevel: 0,
        totalApprovalLevels: 3,
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.next).toBe('SUBMITTED'); // not yet the final state
      expect(result.nextApprovalLevel).toBe(1);
    }
  });

  it('the final level approves: state becomes APPROVED', () => {
    const result = applyTransition(
      'APPROVE',
      ctx({
        state: 'SUBMITTED',
        actorRole: 'MANAGER',
        approvalLevel: 2,
        totalApprovalLevels: 3,
        actingApprovalLevel: 3,
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.next).toBe('APPROVED');
      expect(result.nextApprovalLevel).toBe(3);
    }
  });
});

describe('UNAPPROVE', () => {
  it('APPROVED -> SUBMITTED, approvalLevel steps back one, when the acting manager holds the highest level that approved', () => {
    const result = applyTransition(
      'UNAPPROVE',
      ctx({
        state: 'APPROVED',
        actorRole: 'MANAGER',
        approvalLevel: 3,
        totalApprovalLevels: 3,
        actingApprovalLevel: 3,
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.next).toBe('SUBMITTED');
      expect(result.nextApprovalLevel).toBe(2);
      expect(result.revisionKind).toBe('UNAPPROVE');
    }
  });

  it('a lower approval level may not unapprove once a higher level has already approved (D04/BRD §6.3 "chỉ huỷ duyệt khi chưa có cấp cao hơn duyệt")', () => {
    // approvalLevel=3 means level-3 (the highest) already signed off;
    // a level-1 reviewer attempting to unapprove is blocked.
    const result = applyTransition(
      'UNAPPROVE',
      ctx({
        state: 'APPROVED',
        actorRole: 'MANAGER',
        approvalLevel: 3,
        totalApprovalLevels: 3,
        actingApprovalLevel: 1,
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('GUARD_FAILED');
  });

  it('rejects UNAPPROVE from SUBMITTED (nothing to undo)', () => {
    const result = applyTransition(
      'UNAPPROVE',
      ctx({ state: 'SUBMITTED', actorRole: 'MANAGER' }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('INVALID_STATE_TRANSITION');
  });

  it('an EDITOR cannot unapprove', () => {
    const result = applyTransition(
      'UNAPPROVE',
      ctx({ state: 'APPROVED', actorRole: 'EDITOR' }),
    );
    expect(result.ok).toBe(false);
  });
});

describe('notifications', () => {
  it('RETURN notifies the editor', () => {
    const result = applyTransition(
      'RETURN',
      ctx({ state: 'SUBMITTED', actorRole: 'MANAGER' }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.notify).toEqual(['DYN_REPORT_RETURNED']);
  });

  it('final APPROVE notifies the editor', () => {
    const result = applyTransition(
      'APPROVE',
      ctx({ state: 'SUBMITTED', actorRole: 'MANAGER' }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.notify).toEqual(['DYN_REPORT_APPROVED']);
  });

  it("a non-final intermediate APPROVE does not notify the editor yet (only the next-level approver would be notified, out of this engine's scope)", () => {
    const result = applyTransition(
      'APPROVE',
      ctx({
        state: 'SUBMITTED',
        actorRole: 'MANAGER',
        approvalLevel: 0,
        totalApprovalLevels: 3,
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.notify).toBeNull();
  });

  it('SAVE and SUBMIT do not notify anyone', () => {
    const save = applyTransition('SAVE', ctx({ state: 'DRAFT' }));
    const submit = applyTransition('SUBMIT', ctx({ state: 'DRAFT' }));
    expect(save.ok && save.notify).toBeNull();
    expect(submit.ok && submit.notify).toBeNull();
  });
});
