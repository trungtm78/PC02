import { bandInstants } from '../engine/bands';
import { computeDue } from '../engine/compute-due';
import { buildWorkingCalendar } from '../engine/working-calendar';
import type { FlowStep } from './flow-steps';
import { previewSchedule } from './preview-schedule';

const step = (over: Partial<FlowStep> = {}): FlowStep => ({
  stepKey: 'k1',
  name: 'Step',
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
  parties: [{ partyKind: 'RECORD_TEAM', teamId: null, role: 'MAIN', note: null }],
  variants: [],
  ...over,
});

/** Weekends off, no holidays, no year confirmed. */
const calendar = buildWorkingCalendar([]);
const confirmed2026 = buildWorkingCalendar([{ year: 2026, weekendDays: [6, 0], status: 'CONFIRMED', days: [] }]);
/** A date column: the calendar day at 00:00 UTC. */
const day = (iso: string) => ({ at: new Date(`${iso}T00:00:00.000Z`), hasTime: false });

describe('previewSchedule', () => {
  it('a step counted from a date of the record: the deadline, its bands, and where it starts', () => {
    // Monday 2 March 2026 + 20 days = Sunday 22 March, rolled to Monday 23 March, end of day in Vietnam.
    const result = previewSchedule([step({ setsRecordDeadline: true })], { RECEIVED: day('2026-03-02') }, confirmed2026);

    expect(result.steps).toEqual([
      {
        stepIndex: 0,
        stepKey: 'k1',
        startAt: new Date('2026-03-02T00:00:00.000Z'),
        dueAt: new Date('2026-03-23T16:59:59.999Z'),
        provisional: false,
        greenFrom: new Date('2026-03-17T17:00:00.000Z'),
        yellowFrom: new Date('2026-03-19T17:00:00.000Z'),
        redFrom: new Date('2026-03-21T17:00:00.000Z'),
        variant: null,
        problem: null,
      },
    ]);
    expect(result.recordDeadline).toEqual(new Date('2026-03-23T16:59:59.999Z'));
    expect(result.provisional).toBe(false);
  });

  it('a step counted from the previous step starts at the previous deadline, to the millisecond', () => {
    const first = step({ durationValue: 10 });
    const second = step({ stepKey: 'k2', anchor: 'PREVIOUS_STEP_DONE', durationValue: 30, setsRecordDeadline: true });
    const result = previewSchedule([first, second], { RECEIVED: day('2026-03-02') }, calendar);

    const firstDue = computeDue({ anchor: day('2026-03-02'), value: 10, unit: 'DAY', rollToWorkingDay: true, calendar }).dueAt;
    const secondDue = computeDue({ anchor: { at: firstDue, hasTime: true }, value: 30, unit: 'DAY', rollToWorkingDay: true, calendar }).dueAt;
    expect(result.steps[1]).toMatchObject({ stepKey: 'k2', startAt: firstDue, dueAt: secondDue, problem: null });
    expect(result.steps[1]).toMatchObject(bandInstants(secondDue, second));
    expect(result.recordDeadline).toEqual(secondDue);
  });

  it('hours after a step run from its deadline instant', () => {
    const result = previewSchedule(
      [step({ durationValue: 0, rollToWorkingDay: false }), step({ stepKey: 'k2', anchor: 'PREVIOUS_STEP_DONE', durationValue: 24, durationUnit: 'HOUR' })],
      { RECEIVED: day('2026-03-02') },
      calendar,
    );
    expect(result.steps[0].dueAt).toEqual(new Date('2026-03-02T16:59:59.999Z'));
    expect(result.steps[1].dueAt).toEqual(new Date('2026-03-03T16:59:59.999Z'));
  });

  it('provisional: the calendar of a year nobody confirmed was looked at', () => {
    const result = previewSchedule([step()], { RECEIVED: day('2026-03-02') }, calendar);
    expect(result.steps[0].provisional).toBe(true);
    expect(result.provisional).toBe(true);
    // No step sets the record deadline.
    expect(result.recordDeadline).toBeNull();
  });

  it('a step whose date the sample does not carry has no deadline, and neither have the steps counted from it', () => {
    const result = previewSchedule(
      [step({ anchor: 'ACCEPTED' }), step({ stepKey: 'k2', anchor: 'PREVIOUS_STEP_DONE', setsRecordDeadline: true }), step({ stepKey: 'k3' })],
      { RECEIVED: day('2026-03-02') },
      calendar,
    );
    expect(result.steps.map((row) => [row.stepKey, row.problem, row.dueAt === null])).toEqual([
      ['k1', 'ANCHOR_DATE_MISSING', true],
      ['k2', 'ANCHOR_DATE_MISSING', true],
      ['k3', null, false],
    ]);
    expect(result.steps[0]).toMatchObject({ startAt: null, greenFrom: null, yellowFrom: null, redFrom: null, provisional: false });
    expect(result.recordDeadline).toBeNull();
  });

  it('a refusal of the engine is the problem of that step, not an exception', () => {
    const result = previewSchedule(
      [step({ durationUnit: 'HOUR' }), step({ stepKey: 'k2', redDays: 9 }), step({ stepKey: 'k3', durationValue: -1 })],
      { RECEIVED: day('2026-03-02') },
      calendar,
    );
    expect(result.steps.map((row) => row.problem)).toEqual(['HOUR_ANCHOR_HAS_NO_TIME', 'THRESHOLDS_NOT_ASCENDING', 'DURATION_INVALID']);
    expect(result.steps.every((row) => row.dueAt === null)).toBe(true);
  });

  it('a step with variants takes the duration of the variant that matches the sample, otherwise its own', () => {
    const investigation = step({
      anchor: 'PROSECUTED',
      durationValue: 2,
      durationUnit: 'MONTH',
      variants: [
        { conditionKey: 'CRIME_GRAVITY', conditionValue: 'RAT_NGHIEM_TRONG', durationValue: 4, durationUnit: 'MONTH', maxExtensions: null, extensionValue: null, extensionUnit: null },
      ],
    });
    const anchors = { PROSECUTED: day('2026-01-05') };

    const own = previewSchedule([investigation], anchors, calendar);
    expect(own.steps[0]).toMatchObject({ variant: null, dueAt: new Date('2026-03-05T16:59:59.999Z') });

    const other = previewSchedule([investigation], anchors, calendar, { CRIME_GRAVITY: 'NGHIEM_TRONG' });
    expect(other.steps[0]).toMatchObject({ variant: null, dueAt: new Date('2026-03-05T16:59:59.999Z') });

    const matched = previewSchedule([investigation], anchors, calendar, { CRIME_GRAVITY: 'RAT_NGHIEM_TRONG' });
    expect(matched.steps[0]).toMatchObject({ variant: 'RAT_NGHIEM_TRONG', dueAt: new Date('2026-05-05T16:59:59.999Z') });
  });

  it('no steps: nothing', () => {
    expect(previewSchedule([], {}, calendar)).toEqual({ steps: [], recordDeadline: null, provisional: false });
  });
});
