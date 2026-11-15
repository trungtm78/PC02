import type { ProcessingErrorCode } from '../contract/processing-codes';
import type { ConditionKey, FlowStep } from '../config/flow-steps';
import { bandInstants, type BandInstants } from '../engine/bands';
import { computeDue } from '../engine/compute-due';
import { ProcessingEngineError } from '../engine/errors';
import type { StepStatus } from '../engine/types';
import type { WorkingCalendar } from '../engine/working-calendar';
import type { AnchorKey } from '../gateway/record-snapshot';

/** A date a deadline is counted from. `hasTime: false`: only its calendar day means something. */
export interface AnchorInstant {
  at: Date;
  hasTime: boolean;
}

/** The dates of a record that exist, by anchor kind (a kind that is absent is a date nobody has recorded). */
export type RecordAnchors = Partial<Record<AnchorKey, AnchorInstant>>;

/** The facts of a record that pick a variant of a step (`CRIME_GRAVITY: 'NGHIEM_TRONG'`). */
export type RecordConditions = Partial<Record<ConditionKey, string>>;

export type ScheduledStep =
  | ({
      ok: true;
      dueAt: Date;
      provisional: boolean;
      calendarVersion: string | null;
      /** The condition value of the variant whose duration was used; `null`: the step's own duration. */
      variant: string | null;
    } & BandInstants)
  | { ok: false; problem: ProcessingErrorCode };

/**
 * The deadline of one step counted from `anchor`: the step's own duration, or that of the variant whose condition the
 * record meets. A refusal of the engine comes back as `{ ok: false, problem }`; anything else is a bug and is thrown.
 *
 * The ONE place that turns a step and a date into a deadline and the instants its bands start at: the settings screen's
 * preview and the steps of a record both call it, so what a person sees drawn is what a record will get.
 */
export function scheduleStep(step: FlowStep, anchor: AnchorInstant, conditions: RecordConditions, calendar: WorkingCalendar): ScheduledStep {
  const variant = step.variants.find((candidate) => conditions[candidate.conditionKey] === candidate.conditionValue) ?? null;
  try {
    const due = computeDue({
      anchor,
      value: variant?.durationValue ?? step.durationValue,
      unit: variant?.durationUnit ?? step.durationUnit,
      rollToWorkingDay: step.rollToWorkingDay,
      calendar,
    });
    return {
      ok: true,
      dueAt: due.dueAt,
      provisional: due.provisional,
      calendarVersion: due.calendarVersion,
      variant: variant?.conditionValue ?? null,
      ...bandInstants(due.dueAt, step),
    };
  } catch (error) {
    if (!(error instanceof ProcessingEngineError)) throw error;
    return { ok: false, problem: error.code };
  }
}

/** One step of a record, as it is when the flow is applied to it. */
export interface PlannedStep {
  stepKey: string;
  order: number;
  status: Extract<StepStatus, 'WAITING_ANCHOR' | 'OPEN'>;
  /** The date the deadline is counted from; `null` while the step waits. */
  startAt: Date | null;
  dueAt: Date | null;
  provisional: boolean;
  calendarVersion: string | null;
  greenFrom: Date | null;
  yellowFrom: Date | null;
  redFrom: Date | null;
  variant: string | null;
  /** Why a step whose date exists could not be scheduled (a refusal of the engine); `null` otherwise. */
  problem: ProcessingErrorCode | null;
  setsRecordDeadline: boolean;
}

/**
 * The steps a record gets when a flow is applied to it.
 *
 *   - a step counted from a date of the record opens with its deadline when the record has that date;
 *   - a step counted from the completion of the step before waits (it has no deadline until that step is done);
 *   - a step whose date the record does not carry yet (the date of acceptance, until somebody records it) waits;
 *   - a step the engine cannot schedule (an hour-long duration on a date with no time) waits, and says why.
 */
export function planRecordSteps(steps: readonly FlowStep[], anchors: RecordAnchors, conditions: RecordConditions, calendar: WorkingCalendar): PlannedStep[] {
  return steps.map((step, order) => {
    const planned: PlannedStep = {
      stepKey: step.stepKey ?? `step-${order}`,
      order,
      status: 'WAITING_ANCHOR',
      startAt: null,
      dueAt: null,
      provisional: false,
      calendarVersion: null,
      greenFrom: null,
      yellowFrom: null,
      redFrom: null,
      variant: null,
      problem: null,
      setsRecordDeadline: step.setsRecordDeadline,
    };
    if (step.anchor === 'PREVIOUS_STEP_DONE') return planned;
    const anchor = anchors[step.anchor];
    if (!anchor) return planned;

    const scheduled = scheduleStep(step, anchor, conditions, calendar);
    if (!scheduled.ok) return { ...planned, problem: scheduled.problem };
    return {
      ...planned,
      status: 'OPEN',
      startAt: anchor.at,
      dueAt: scheduled.dueAt,
      provisional: scheduled.provisional,
      calendarVersion: scheduled.calendarVersion,
      greenFrom: scheduled.greenFrom,
      yellowFrom: scheduled.yellowFrom,
      redFrom: scheduled.redFrom,
      variant: scheduled.variant,
    };
  });
}
