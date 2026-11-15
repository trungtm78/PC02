import { PROCESSING_ERROR, type ProcessingErrorCode } from '../contract/processing-codes';
import { bandInstants } from '../engine/bands';
import { computeDue } from '../engine/compute-due';
import { ProcessingEngineError } from '../engine/errors';
import type { WorkingCalendar } from '../engine/working-calendar';
import type { AnchorKey } from '../gateway/record-snapshot';
import type { ConditionKey, FlowStep } from './flow-steps';

/** The dates of an imagined record: only the ones given exist. */
export type SampleAnchors = Partial<Record<AnchorKey, { at: Date; hasTime: boolean }>>;

/** The facts of the imagined record that pick a variant (`CRIME_GRAVITY: 'NGHIEM_TRONG'`). */
export type SampleConditions = Partial<Record<ConditionKey, string>>;

export interface PreviewRow {
  stepIndex: number;
  stepKey: string | null;
  /** Where the duration is counted from: a date of the sample, or the deadline of the previous step. */
  startAt: Date | null;
  dueAt: Date | null;
  /** The deadline leaned on the calendar of a year nobody has confirmed. */
  provisional: boolean;
  greenFrom: Date | null;
  yellowFrom: Date | null;
  redFrom: Date | null;
  /** The condition value of the variant whose duration was used; `null`: the step's own duration. */
  variant: string | null;
  /** Why the step has no deadline: its date is missing from the sample (`ANCHOR_DATE_MISSING`), or a refusal of the engine. */
  problem: ProcessingErrorCode | null;
}

export interface SchedulePreview {
  steps: PreviewRow[];
  /** The deadline of the step that sets the deadline of the record; `null` when there is none or it has no deadline. */
  recordDeadline: Date | null;
  /** Any step of the preview is provisional. */
  provisional: boolean;
}

/**
 * The deadlines the steps would get on an imagined record, for the chart of the settings screen. Pure: the engine, the
 * calendar handed in, no clock.
 *
 * A step counted from the previous step starts at the previous step's DEADLINE (the latest it may be done). A step
 * whose date the sample lacks has no deadline, and neither has a step counted from it.
 */
export function previewSchedule(
  steps: readonly FlowStep[],
  sampleAnchors: SampleAnchors,
  calendar: WorkingCalendar,
  conditions: SampleConditions = {},
): SchedulePreview {
  const rows: PreviewRow[] = [];
  let previousDue: Date | null = null;

  steps.forEach((step, stepIndex) => {
    const variant = step.variants.find((candidate) => conditions[candidate.conditionKey] === candidate.conditionValue) ?? null;
    const row: PreviewRow = {
      stepIndex,
      stepKey: step.stepKey,
      startAt: null,
      dueAt: null,
      provisional: false,
      greenFrom: null,
      yellowFrom: null,
      redFrom: null,
      variant: variant?.conditionValue ?? null,
      problem: null,
    };
    rows.push(row);

    const anchor = step.anchor === 'PREVIOUS_STEP_DONE' ? (previousDue ? { at: previousDue, hasTime: true } : undefined) : sampleAnchors[step.anchor];
    previousDue = null;
    if (!anchor) {
      row.problem = PROCESSING_ERROR.ANCHOR_DATE_MISSING;
      return;
    }
    try {
      const due = computeDue({
        anchor,
        value: variant?.durationValue ?? step.durationValue,
        unit: variant?.durationUnit ?? step.durationUnit,
        rollToWorkingDay: step.rollToWorkingDay,
        calendar,
      });
      const bands = bandInstants(due.dueAt, step);
      Object.assign(row, { startAt: anchor.at, dueAt: due.dueAt, provisional: due.provisional, ...bands });
      previousDue = due.dueAt;
    } catch (error) {
      if (!(error instanceof ProcessingEngineError)) throw error;
      row.problem = error.code;
    }
  });

  const deadlineStep = steps.findIndex((step) => step.setsRecordDeadline);
  return {
    steps: rows,
    recordDeadline: deadlineStep >= 0 ? rows[deadlineStep].dueAt : null,
    provisional: rows.some((row) => row.provisional),
  };
}
