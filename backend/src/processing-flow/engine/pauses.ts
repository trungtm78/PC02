import { PROCESSING_ERROR } from '../contract/processing-codes';
import { ProcessingEngineError } from './errors';

/** A stretch during which the clock of a record stood still. `to: null`: it has not ended. */
export interface Pause {
  from: Date;
  to: Date | null;
}

export interface ShiftedDue {
  dueAt: Date;
  /** The clock stands still at `now`: there is a pause that has begun and has not ended. */
  paused: boolean;
}

/**
 * A deadline under pauses: a clock that stops while a record is suspended.
 *
 * The rule:
 * - Time spent paused is not time spent working, so each pause that BEGINS BEFORE the deadline moves the deadline
 *   later by the whole length of that pause, to the millisecond. The result is not snapped to an end of day and not
 *   rolled to a working day.
 * - Pauses are taken in order of time and compared with the deadline AS IT STANDS after the earlier ones: a pause that
 *   begins after the original deadline but before the already moved one still counts.
 * - A pause that begins at or after the deadline (as it stands) does not move it: the deadline was already missed
 *   when the clock stopped.
 * - Pauses that overlap or touch are one pause: shared time counts once. The order of the list does not matter.
 * - An open pause (`to: null`) runs up to `now`: the deadline has moved by the time paused so far and keeps moving
 *   with `now`; the answer says `paused: true`. An open pause that begins later than `now` has not begun: it changes
 *   nothing.
 * - A closed pause counts in full even when it ends later than `now` (the end was entered ahead of time).
 * - A pause of no length changes nothing. A pause that ends before it starts, or holds an invalid date, is refused
 *   (`PAUSE_INVALID`).
 */
export function shiftForPauses(dueAt: Date, pauses: ReadonlyArray<Pause>, now: Date): ShiftedDue {
  const nowMs = now.getTime();
  let paused = false;
  const spans: Array<[from: number, to: number]> = [];
  for (const pause of pauses) {
    const from = pause.from.getTime();
    const to = pause.to === null ? null : pause.to.getTime();
    if (Number.isNaN(from) || (to !== null && (Number.isNaN(to) || to < from))) {
      throw new ProcessingEngineError(PROCESSING_ERROR.PAUSE_INVALID);
    }
    if (to !== null) {
      spans.push([from, to]);
    } else if (from <= nowMs) {
      paused = true;
      spans.push([from, nowMs]);
    }
  }
  spans.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

  const merged: Array<[number, number]> = [];
  for (const [from, to] of spans) {
    const last = merged[merged.length - 1];
    if (last && from <= last[1]) last[1] = Math.max(last[1], to);
    else merged.push([from, to]);
  }

  let due = dueAt.getTime();
  for (const [from, to] of merged) {
    if (from >= due) break;
    due += to - from;
  }
  return { dueAt: new Date(due), paused };
}
