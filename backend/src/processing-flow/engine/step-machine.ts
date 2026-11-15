import { PROCESSING_ERROR } from '../contract/processing-codes';
import { ProcessingEngineError } from './errors';
import type { StepStatus } from './types';

/**
 * The life of one step of a record.
 *
 *   WAITING_ANCHOR  the date its deadline is counted from does not exist yet (a step counted from the previous step's
 *                   completion, or from a date nobody has recorded)
 *   OPEN            being worked; its deadline runs
 *   REPORTED        the unit has reported; the leader has not decided (only a step that asks for approval)
 *   DONE            finished (a step that asks for approval: approved)
 *   SKIPPED         set aside by a person; it remembers where it came from
 *
 * Pure: no clock, no database. The command layer asks `nextStep` before it writes anything.
 */
export type StepEvent = 'ANCHOR_REACHED' | 'REPORT' | 'COMPLETE' | 'APPROVE' | 'RETURN' | 'REOPEN' | 'SKIP' | 'UNSKIP';

export interface StepMachineState {
  status: StepStatus;
  requiresApproval: boolean;
  /** Only meaningful while SKIPPED: the status to go back to. */
  skippedFrom: Extract<StepStatus, 'WAITING_ANCHOR' | 'OPEN'> | null;
}

export interface StepMachineContext {
  /** The date of the step exists now (for a step that was skipped while waiting for it). */
  anchorAvailable?: boolean;
}

const refuse = (code: keyof typeof PROCESSING_ERROR): never => {
  throw new ProcessingEngineError(PROCESSING_ERROR[code]);
};

export function nextStep(state: StepMachineState, event: StepEvent, context: StepMachineContext = {}): Pick<StepMachineState, 'status' | 'skippedFrom'> {
  const { status } = state;
  const to = (next: StepStatus): Pick<StepMachineState, 'status' | 'skippedFrom'> => ({ status: next, skippedFrom: null });

  switch (event) {
    case 'ANCHOR_REACHED':
      return status === 'WAITING_ANCHOR' ? to('OPEN') : refuse('STEP_TRANSITION_INVALID');

    case 'COMPLETE':
      if (status !== 'OPEN') return refuse('STEP_TRANSITION_INVALID');
      return state.requiresApproval ? refuse('STEP_NEEDS_APPROVAL') : to('DONE');

    case 'REPORT':
      if (status !== 'OPEN') return refuse('STEP_TRANSITION_INVALID');
      return state.requiresApproval ? to('REPORTED') : refuse('STEP_APPROVAL_NOT_REQUIRED');

    case 'APPROVE':
      return status === 'REPORTED' ? to('DONE') : refuse('STEP_TRANSITION_INVALID');

    case 'RETURN':
      return status === 'REPORTED' ? to('OPEN') : refuse('STEP_TRANSITION_INVALID');

    case 'REOPEN':
      return status === 'DONE' ? to('OPEN') : refuse('STEP_TRANSITION_INVALID');

    case 'SKIP':
      if (status === 'WAITING_ANCHOR' || status === 'OPEN') return { status: 'SKIPPED', skippedFrom: status };
      return refuse('STEP_TRANSITION_INVALID');

    case 'UNSKIP':
      if (status !== 'SKIPPED' || state.skippedFrom === null) return refuse('STEP_TRANSITION_INVALID');
      return to(state.skippedFrom === 'WAITING_ANCHOR' && context.anchorAvailable ? 'OPEN' : state.skippedFrom);
  }
}

/**
 * What reopening a step means for the step that is counted from its completion (its follower).
 *
 *   no follower, or one that has not started (waiting, skipped): nothing
 *   a follower that is OPEN: it keeps its date and its deadline (the clock of a person already at work is not moved
 *   under them) and is flagged "the step before was reopened"
 *   a follower waiting for approval or done: refused; that decision has to be withdrawn first
 */
export function guardReopen(followerStatus: StepStatus | null): { flagFollower: boolean } {
  if (followerStatus === 'REPORTED' || followerStatus === 'DONE') throw new ProcessingEngineError(PROCESSING_ERROR.STEP_DEPENDENT_STARTED);
  return { flagFollower: followerStatus === 'OPEN' };
}
