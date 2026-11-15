import { PROCESSING_ERROR, type ProcessingErrorCode } from '../contract/processing-codes';
import { validateThresholds } from '../engine/bands';
import { MAX_DURATION_VALUE } from '../engine/compute-due';
import type { AnchorKind, DurationUnit } from '../engine/types';
import { ANCHORS_WITH_TIME, type RecordKind } from '../gateway/record-snapshot';
import type { ConditionKey, FlowStep } from './flow-steps';

export interface StepIssue {
  code: ProcessingErrorCode;
  /** The position of the step in the list (absent for an issue of the flow as a whole). */
  stepIndex?: number;
  /** The key of the step, when it has one already. */
  stepKey?: string;
}

/** Dates only a case carries: the day of prosecution, and the day on the hand-over minutes. */
const CASE_ONLY_ANCHORS: readonly AnchorKind[] = ['PROSECUTED', 'MINUTES_RECEIVED'];

/** The record kinds whose records carry the fact a condition reads. The gravity of a crime is a column of a case. */
const KINDS_OF_CONDITION: Readonly<Record<ConditionKey, readonly RecordKind[]>> = { CRIME_GRAVITY: ['CASE'] };

const wholeFrom = (min: number, value: number): boolean => Number.isInteger(value) && value >= min && value <= MAX_DURATION_VALUE;

/**
 * What stops a list of steps from being published as a version of a flow of `recordKind`. Empty = it may be.
 *
 * A draft that breaks these rules is still saved (the issues come back as warnings); publishing refuses it. In the
 * order of the steps, and within a step always in the same order.
 */
export function validateSteps(steps: readonly FlowStep[], recordKind: RecordKind): StepIssue[] {
  if (steps.length === 0) return [{ code: PROCESSING_ERROR.FLOW_HAS_NO_STEPS }];
  const issues: StepIssue[] = [];
  let recordDeadlineSteps = 0;

  steps.forEach((step, stepIndex) => {
    const issue = (code: ProcessingErrorCode): void => void issues.push({ code, stepIndex, ...(step.stepKey ? { stepKey: step.stepKey } : {}) });

    if (step.name.trim() === '') issue(PROCESSING_ERROR.STEP_NAME_REQUIRED);

    if (step.parties.filter((party) => party.role === 'MAIN').length !== 1) issue(PROCESSING_ERROR.STEP_NEEDS_ONE_MAIN);
    const units = step.parties.map((party) => `${party.partyKind}:${party.teamId ?? ''}`);
    if (new Set(units).size !== units.length) issue(PROCESSING_ERROR.DUPLICATE_PARTY);

    const figuresOk =
      wholeFrom(0, step.durationValue) &&
      wholeFrom(0, step.maxExtensions) &&
      (step.extensionValue === null || wholeFrom(1, step.extensionValue)) &&
      step.variants.every(
        (variant) =>
          wholeFrom(0, variant.durationValue) &&
          (variant.maxExtensions === null || wholeFrom(0, variant.maxExtensions)) &&
          (variant.extensionValue === null || wholeFrom(1, variant.extensionValue)),
      );
    if (!figuresOk) issue(PROCESSING_ERROR.DURATION_INVALID);

    // A variant takes from its step what it does not say itself.
    const extensionSettings: Array<{ max: number; value: number | null; unit: DurationUnit | null }> = [
      { max: step.maxExtensions, value: step.extensionValue, unit: step.extensionUnit },
      ...step.variants.map((variant) => ({
        max: variant.maxExtensions ?? step.maxExtensions,
        value: variant.extensionValue ?? step.extensionValue,
        unit: variant.extensionUnit ?? step.extensionUnit,
      })),
    ];
    if (extensionSettings.some((setting) => setting.max > 0 && (setting.value === null || setting.unit === null))) {
      issue(PROCESSING_ERROR.EXTENSION_INCOMPLETE);
    }

    try {
      validateThresholds(step);
    } catch {
      issue(PROCESSING_ERROR.THRESHOLDS_NOT_ASCENDING);
    }

    if (recordKind !== 'CASE' && CASE_ONLY_ANCHORS.includes(step.anchor)) issue(PROCESSING_ERROR.ANCHOR_NOT_AVAILABLE_FOR_KIND);
    if (stepIndex === 0 && step.anchor === 'PREVIOUS_STEP_DONE') issue(PROCESSING_ERROR.PREVIOUS_STEP_ANCHOR_ON_FIRST_STEP);

    // The completion of a step is an instant; a date of the record carries a time only where the gateway says so.
    const anchorHasTime = step.anchor === 'PREVIOUS_STEP_DONE' || (ANCHORS_WITH_TIME[recordKind] as readonly string[]).includes(step.anchor);
    const countsHours = step.durationUnit === 'HOUR' || step.variants.some((variant) => variant.durationUnit === 'HOUR');
    if (countsHours && !anchorHasTime) issue(PROCESSING_ERROR.HOUR_ANCHOR_HAS_NO_TIME);

    if (step.setsRecordDeadline) {
      recordDeadlineSteps += 1;
      if (recordDeadlineSteps > 1) issue(PROCESSING_ERROR.MULTIPLE_RECORD_DEADLINE_STEPS);
    }

    const conditions = step.variants.map((variant) => `${variant.conditionKey}=${variant.conditionValue}`);
    if (new Set(conditions).size !== conditions.length) issue(PROCESSING_ERROR.VARIANT_DUPLICATE);
    if (step.variants.some((variant) => !KINDS_OF_CONDITION[variant.conditionKey].includes(recordKind))) {
      issue(PROCESSING_ERROR.VARIANT_NOT_AVAILABLE_FOR_KIND);
    }
  });
  return issues;
}
