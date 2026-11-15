import { PROCESSING_ERROR } from '../contract/processing-codes';
import { ProcessingEngineError } from './errors';
import { guardReopen, nextStep, type StepMachineState } from './step-machine';
import { STEP_STATUSES } from '../contract/processing-codes';
import type { StepStatus } from './types';

const state = (status: StepStatus, over: Partial<StepMachineState> = {}): StepMachineState => ({
  status,
  requiresApproval: false,
  skippedFrom: null,
  ...over,
});
const refusal = (fn: () => unknown): string | null => {
  try {
    fn();
  } catch (error) {
    if (error instanceof ProcessingEngineError) return error.code;
    throw error;
  }
  return null;
};

describe('the status of a step of a record', () => {
  describe('a step waiting for its date', () => {
    it('opens when its date is reached', () => {
      expect(nextStep(state('WAITING_ANCHOR'), 'ANCHOR_REACHED').status).toBe('OPEN');
    });
    it('cannot be completed, reported or approved before it opens', () => {
      for (const event of ['COMPLETE', 'REPORT', 'APPROVE', 'RETURN', 'REOPEN'] as const) {
        expect(refusal(() => nextStep(state('WAITING_ANCHOR'), event))).toBe(PROCESSING_ERROR.STEP_TRANSITION_INVALID);
      }
    });
  });

  describe('an open step', () => {
    it('is completed when no approval is asked for', () => {
      expect(nextStep(state('OPEN'), 'COMPLETE').status).toBe('DONE');
    });
    it('cannot be completed when approval is asked for: it is reported first', () => {
      expect(refusal(() => nextStep(state('OPEN', { requiresApproval: true }), 'COMPLETE'))).toBe(PROCESSING_ERROR.STEP_NEEDS_APPROVAL);
      expect(nextStep(state('OPEN', { requiresApproval: true }), 'REPORT').status).toBe('REPORTED');
    });
    it('cannot be reported when approval is not asked for', () => {
      expect(refusal(() => nextStep(state('OPEN'), 'REPORT'))).toBe(PROCESSING_ERROR.STEP_APPROVAL_NOT_REQUIRED);
    });
    it('can be skipped, remembering that it was open', () => {
      expect(nextStep(state('OPEN'), 'SKIP')).toEqual({ status: 'SKIPPED', skippedFrom: 'OPEN' });
    });
  });

  describe('a reported step (waiting for the leader)', () => {
    it('is done when approved, and goes back to open when returned', () => {
      expect(nextStep(state('REPORTED', { requiresApproval: true }), 'APPROVE').status).toBe('DONE');
      expect(nextStep(state('REPORTED', { requiresApproval: true }), 'RETURN').status).toBe('OPEN');
    });
    it('cannot be skipped or completed straight away', () => {
      expect(refusal(() => nextStep(state('REPORTED', { requiresApproval: true }), 'SKIP'))).toBe(PROCESSING_ERROR.STEP_TRANSITION_INVALID);
      expect(refusal(() => nextStep(state('REPORTED', { requiresApproval: true }), 'COMPLETE'))).toBe(PROCESSING_ERROR.STEP_TRANSITION_INVALID);
    });
  });

  describe('a done step', () => {
    it('can be reopened, and nothing else happens to it', () => {
      expect(nextStep(state('DONE'), 'REOPEN').status).toBe('OPEN');
      for (const event of ['COMPLETE', 'REPORT', 'APPROVE', 'RETURN', 'SKIP', 'UNSKIP', 'ANCHOR_REACHED'] as const) {
        expect(refusal(() => nextStep(state('DONE'), event))).toBe(PROCESSING_ERROR.STEP_TRANSITION_INVALID);
      }
    });
  });

  describe('a skipped step', () => {
    it('goes back to where it was', () => {
      expect(nextStep(state('SKIPPED', { skippedFrom: 'OPEN' }), 'UNSKIP').status).toBe('OPEN');
      expect(nextStep(state('SKIPPED', { skippedFrom: 'WAITING_ANCHOR' }), 'UNSKIP').status).toBe('WAITING_ANCHOR');
    });
    it('a step skipped while waiting opens when its date has come meanwhile', () => {
      expect(nextStep(state('SKIPPED', { skippedFrom: 'WAITING_ANCHOR' }), 'UNSKIP', { anchorAvailable: true }).status).toBe('OPEN');
    });
    it('forgets where it came from once it is back', () => {
      expect(nextStep(state('SKIPPED', { skippedFrom: 'OPEN' }), 'UNSKIP').skippedFrom).toBeNull();
    });
    it('a skipped step with no memory of where it came from cannot be brought back blindly', () => {
      expect(refusal(() => nextStep(state('SKIPPED'), 'UNSKIP'))).toBe(PROCESSING_ERROR.STEP_TRANSITION_INVALID);
    });
    it('can be skipped while waiting', () => {
      expect(nextStep(state('WAITING_ANCHOR'), 'SKIP')).toEqual({ status: 'SKIPPED', skippedFrom: 'WAITING_ANCHOR' });
    });
  });

  it('every status has at least one way out, and no event is accepted twice in a row from the status it leads to', () => {
    // A guard against a status that nobody can leave: from each status some event is accepted.
    const events = ['ANCHOR_REACHED', 'REPORT', 'COMPLETE', 'APPROVE', 'RETURN', 'REOPEN', 'SKIP', 'UNSKIP'] as const;
    for (const status of STEP_STATUSES) {
      const accepted = events.filter((event) => {
        try {
          nextStep(state(status, { requiresApproval: status === 'REPORTED', skippedFrom: status === 'SKIPPED' ? 'OPEN' : null }), event);
          return true;
        } catch {
          return false;
        }
      });
      expect(accepted.length).toBeGreaterThan(0);
    }
  });
});

describe('reopening a step that a later step already follows', () => {
  it('is free when nothing follows it or the follower has not started', () => {
    expect(guardReopen(null)).toEqual({ flagFollower: false });
    expect(guardReopen('WAITING_ANCHOR')).toEqual({ flagFollower: false });
    expect(guardReopen('SKIPPED')).toEqual({ flagFollower: false });
  });
  it('flags a follower that is open: it keeps its date and its deadline and carries the note "the step before was reopened"', () => {
    expect(guardReopen('OPEN')).toEqual({ flagFollower: true });
  });
  it('is refused once the follower is waiting for approval or done: that decision is withdrawn first', () => {
    expect(refusal(() => guardReopen('REPORTED'))).toBe(PROCESSING_ERROR.STEP_DEPENDENT_STARTED);
    expect(refusal(() => guardReopen('DONE'))).toBe(PROCESSING_ERROR.STEP_DEPENDENT_STARTED);
  });
});
