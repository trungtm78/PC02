import { MAX_DURATION_VALUE } from '../engine/compute-due';
import type { FlowStep, FlowStepParty, FlowStepVariant } from './flow-steps';
import { validateSteps } from './validate-steps';

const main: FlowStepParty = { partyKind: 'RECORD_TEAM', teamId: null, role: 'MAIN', note: null };
const team = (teamId: string, role: FlowStepParty['role'] = 'COORDINATE'): FlowStepParty => ({ partyKind: 'TEAM', teamId, role, note: null });

const step = (over: Partial<FlowStep> = {}): FlowStep => ({
  stepKey: 'k1',
  name: 'Check',
  description: null,
  durationValue: 20,
  durationUnit: 'DAY',
  anchor: 'RECEIVED',
  rollToWorkingDay: true,
  redDays: 1,
  yellowDays: 3,
  greenDays: 5,
  legalBasis: null,
  legalDocNumber: null,
  legalDocUrl: null,
  setsRecordDeadline: false,
  requiresApproval: false,
  maxExtensions: 0,
  extensionValue: null,
  extensionUnit: null,
  escalateAfterDays: null,
  escalateLeadershipAfterDays: null,
  parties: [main],
  variants: [],
  ...over,
});

const variant = (over: Partial<FlowStepVariant> = {}): FlowStepVariant => ({
  conditionKey: 'CRIME_GRAVITY',
  conditionValue: 'NGHIEM_TRONG',
  durationValue: 3,
  durationUnit: 'MONTH',
  maxExtensions: null,
  extensionValue: null,
  extensionUnit: null,
  ...over,
});

const codes = (steps: FlowStep[], kind: 'PETITION' | 'INCIDENT' | 'CASE' = 'PETITION') => validateSteps(steps, kind).map((issue) => issue.code);

describe('validateSteps', () => {
  it('a flow of well-formed steps has nothing to say', () => {
    expect(validateSteps([step(), step({ stepKey: 'k2', anchor: 'PREVIOUS_STEP_DONE', setsRecordDeadline: true })], 'PETITION')).toEqual([]);
  });

  it('FLOW_HAS_NO_STEPS: a flow needs at least one step', () => {
    expect(validateSteps([], 'CASE')).toEqual([{ code: 'FLOW_HAS_NO_STEPS' }]);
  });

  it('STEP_NAME_REQUIRED: a blank name, and the issue says which step', () => {
    expect(validateSteps([step(), step({ stepKey: 'k2', name: '   ' })], 'PETITION')).toEqual([
      { code: 'STEP_NAME_REQUIRED', stepIndex: 1, stepKey: 'k2' },
    ]);
  });

  it('a step that has no key yet is named by its position alone', () => {
    expect(validateSteps([step({ stepKey: null, name: '' })], 'PETITION')).toEqual([{ code: 'STEP_NAME_REQUIRED', stepIndex: 0 }]);
  });

  it('STEP_NEEDS_ONE_MAIN: none, and two', () => {
    expect(codes([step({ parties: [] })])).toEqual(['STEP_NEEDS_ONE_MAIN']);
    expect(codes([step({ parties: [team('t1', 'CHECK')] })])).toEqual(['STEP_NEEDS_ONE_MAIN']);
    expect(codes([step({ parties: [main, team('t1', 'MAIN')] })])).toEqual(['STEP_NEEDS_ONE_MAIN']);
    expect(codes([step({ parties: [main, team('t1', 'CHECK'), team('t2', 'INFORM')] })])).toEqual([]);
  });

  it('THRESHOLDS_NOT_ASCENDING: red <= yellow <= green, none negative', () => {
    expect(codes([step({ redDays: 4, yellowDays: 3, greenDays: 5 })])).toEqual(['THRESHOLDS_NOT_ASCENDING']);
    expect(codes([step({ redDays: 1, yellowDays: 6, greenDays: 5 })])).toEqual(['THRESHOLDS_NOT_ASCENDING']);
    expect(codes([step({ redDays: -1, yellowDays: 3, greenDays: 5 })])).toEqual(['THRESHOLDS_NOT_ASCENDING']);
    expect(codes([step({ redDays: 2, yellowDays: 2, greenDays: 2 })])).toEqual([]);
  });

  it('HOUR_ANCHOR_HAS_NO_TIME: hours only where the record carries a time of day (a petition received), or after a step', () => {
    expect(codes([step({ durationUnit: 'HOUR', anchor: 'RECEIVED' })], 'PETITION')).toEqual([]);
    expect(codes([step({ durationUnit: 'HOUR', anchor: 'RECEIVED' })], 'INCIDENT')).toEqual(['HOUR_ANCHOR_HAS_NO_TIME']);
    expect(codes([step({ durationUnit: 'HOUR', anchor: 'RECEIVED' })], 'CASE')).toEqual(['HOUR_ANCHOR_HAS_NO_TIME']);
    expect(codes([step({ durationUnit: 'HOUR', anchor: 'PROPOSED' })], 'PETITION')).toEqual(['HOUR_ANCHOR_HAS_NO_TIME']);
    // The completion of the previous step is an instant.
    expect(codes([step(), step({ stepKey: 'k2', durationUnit: 'HOUR', anchor: 'PREVIOUS_STEP_DONE' })], 'CASE')).toEqual([]);
    // A variant counted in hours needs the time just as much.
    expect(codes([step({ anchor: 'PROSECUTED', variants: [variant({ durationUnit: 'HOUR' })] })], 'CASE')).toEqual(['HOUR_ANCHOR_HAS_NO_TIME']);
  });

  it('MULTIPLE_RECORD_DEADLINE_STEPS: at most one step sets the deadline of the record', () => {
    expect(
      validateSteps(
        [step({ setsRecordDeadline: true }), step({ stepKey: 'k2', setsRecordDeadline: true }), step({ stepKey: 'k3', setsRecordDeadline: true })],
        'PETITION',
      ),
    ).toEqual([
      { code: 'MULTIPLE_RECORD_DEADLINE_STEPS', stepIndex: 1, stepKey: 'k2' },
      { code: 'MULTIPLE_RECORD_DEADLINE_STEPS', stepIndex: 2, stepKey: 'k3' },
    ]);
    expect(codes([step(), step({ stepKey: 'k2' })])).toEqual([]);
  });

  it('PREVIOUS_STEP_ANCHOR_ON_FIRST_STEP: the first step has no step before it', () => {
    expect(validateSteps([step({ anchor: 'PREVIOUS_STEP_DONE' })], 'PETITION')).toEqual([
      { code: 'PREVIOUS_STEP_ANCHOR_ON_FIRST_STEP', stepIndex: 0, stepKey: 'k1' },
    ]);
  });

  it('DURATION_INVALID: a whole number from 0 to the engine limit, for the step, its variants and its extension', () => {
    expect(codes([step({ durationValue: 0 })])).toEqual([]);
    expect(codes([step({ durationValue: MAX_DURATION_VALUE })])).toEqual([]);
    expect(codes([step({ durationValue: -1 })])).toEqual(['DURATION_INVALID']);
    expect(codes([step({ durationValue: 1.5 })])).toEqual(['DURATION_INVALID']);
    expect(codes([step({ durationValue: MAX_DURATION_VALUE + 1 })])).toEqual(['DURATION_INVALID']);
    expect(codes([step({ anchor: 'PROSECUTED', variants: [variant({ durationValue: -3 })] })], 'CASE')).toEqual(['DURATION_INVALID']);
    expect(codes([step({ maxExtensions: 1, extensionValue: 0, extensionUnit: 'DAY' })])).toEqual(['DURATION_INVALID']);
    expect(codes([step({ maxExtensions: -1 })])).toEqual(['DURATION_INVALID']);
    // Several bad figures in one step are one issue.
    expect(codes([step({ durationValue: -1, maxExtensions: -1 })])).toEqual(['DURATION_INVALID']);
  });

  it('EXTENSION_INCOMPLETE: extensions need a length and a unit', () => {
    expect(codes([step({ maxExtensions: 2, extensionValue: 30, extensionUnit: 'DAY' })])).toEqual([]);
    expect(codes([step({ maxExtensions: 2 })])).toEqual(['EXTENSION_INCOMPLETE']);
    expect(codes([step({ maxExtensions: 2, extensionValue: 30 })])).toEqual(['EXTENSION_INCOMPLETE']);
    expect(codes([step({ maxExtensions: 2, extensionUnit: 'DAY' })])).toEqual(['EXTENSION_INCOMPLETE']);
    expect(codes([step({ maxExtensions: 0 })])).toEqual([]);
  });

  it('EXTENSION_INCOMPLETE: a variant takes what it does not say from its step', () => {
    const base = { anchor: 'PROSECUTED' as const };
    // The variant allows extensions, nobody says how long.
    expect(codes([step({ ...base, variants: [variant({ maxExtensions: 2 })] })], 'CASE')).toEqual(['EXTENSION_INCOMPLETE']);
    // The step says how long.
    expect(codes([step({ ...base, extensionValue: 2, extensionUnit: 'MONTH', variants: [variant({ maxExtensions: 2 })] })], 'CASE')).toEqual([]);
    // The variant says it itself.
    expect(codes([step({ ...base, variants: [variant({ maxExtensions: 2, extensionValue: 3, extensionUnit: 'MONTH' })] })], 'CASE')).toEqual([]);
    // The step allows extensions and says how long; the variant says nothing.
    expect(codes([step({ ...base, maxExtensions: 1, extensionValue: 2, extensionUnit: 'MONTH', variants: [variant()] })], 'CASE')).toEqual([]);
  });

  it('DUPLICATE_PARTY: the same unit twice in one step, whatever its roles', () => {
    expect(codes([step({ parties: [main, team('t1', 'CHECK'), team('t1', 'INFORM')] })])).toEqual(['DUPLICATE_PARTY']);
    expect(codes([step({ parties: [main, { ...main, role: 'INFORM' }] })])).toEqual(['DUPLICATE_PARTY']);
    expect(codes([step({ parties: [main, team('t1'), team('t2')] })])).toEqual([]);
  });

  it('VARIANT_DUPLICATE: one variant per condition value', () => {
    const twice = [variant(), variant({ durationValue: 4 })];
    expect(codes([step({ anchor: 'PROSECUTED', variants: twice })], 'CASE')).toEqual(['VARIANT_DUPLICATE']);
    expect(codes([step({ anchor: 'PROSECUTED', variants: [variant(), variant({ conditionValue: 'RAT_NGHIEM_TRONG' })] })], 'CASE')).toEqual([]);
  });

  it('VARIANT_NOT_AVAILABLE_FOR_KIND: the gravity of a crime is a fact of a case only', () => {
    expect(codes([step({ variants: [variant()] })], 'PETITION')).toEqual(['VARIANT_NOT_AVAILABLE_FOR_KIND']);
    expect(codes([step({ variants: [variant()] })], 'INCIDENT')).toEqual(['VARIANT_NOT_AVAILABLE_FOR_KIND']);
  });

  it('ANCHOR_NOT_AVAILABLE_FOR_KIND: prosecution and hand-over minutes belong to a case', () => {
    for (const anchor of ['PROSECUTED', 'MINUTES_RECEIVED'] as const) {
      expect(codes([step({ anchor })], 'PETITION')).toEqual(['ANCHOR_NOT_AVAILABLE_FOR_KIND']);
      expect(codes([step({ anchor })], 'INCIDENT')).toEqual(['ANCHOR_NOT_AVAILABLE_FOR_KIND']);
      expect(codes([step({ anchor })], 'CASE')).toEqual([]);
    }
    for (const anchor of ['RECEIVED', 'PROPOSED', 'ASSIGNED_TO_UNIT', 'ACCEPTED'] as const) {
      for (const kind of ['PETITION', 'INCIDENT', 'CASE'] as const) expect(codes([step({ anchor })], kind)).toEqual([]);
    }
  });

  it('every issue of every step is reported, in the order of the steps', () => {
    expect(
      validateSteps(
        [step({ anchor: 'PREVIOUS_STEP_DONE', name: '' }), step({ stepKey: 'k2', parties: [], redDays: 9 })],
        'PETITION',
      ).map((issue) => `${issue.stepIndex}:${issue.code}`),
    ).toEqual(['0:STEP_NAME_REQUIRED', '0:PREVIOUS_STEP_ANCHOR_ON_FIRST_STEP', '1:STEP_NEEDS_ONE_MAIN', '1:THRESHOLDS_NOT_ASCENDING']);
  });
});
