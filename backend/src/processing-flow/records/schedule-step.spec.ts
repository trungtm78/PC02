import { PROCESSING_ERROR } from '../contract/processing-codes';
import type { FlowStep } from '../config/flow-steps';
import { buildWorkingCalendar } from '../engine/working-calendar';
import { planRecordSteps, scheduleStep } from './schedule-step';

const step = (over: Partial<FlowStep> = {}): FlowStep => ({
  stepKey: 'k1',
  name: 'Tiếp nhận',
  description: null,
  durationValue: 5,
  durationUnit: 'DAY',
  anchor: 'RECEIVED',
  rollToWorkingDay: false,
  redDays: 1,
  yellowDays: 2,
  greenDays: 3,
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
  parties: [],
  variants: [],
  ...over,
});

const calendar = buildWorkingCalendar([]);
const day = (iso: string) => ({ at: new Date(`${iso}T00:00:00.000Z`), hasTime: false });

describe('the deadline of one step', () => {
  it('counts the duration from the anchor and gives the instants the bands start at', () => {
    const result = scheduleStep(step(), day('2026-12-01'), {}, calendar);
    expect(result).toMatchObject({ ok: true, variant: null, provisional: false });
    if (!result.ok) throw new Error('unreachable');
    // 1 December + 5 days: the end of the 6th, Vietnam time.
    expect(result.dueAt.toISOString()).toBe('2026-12-06T16:59:59.999Z');
    expect(result.redFrom.toISOString()).toBe('2026-12-04T17:00:00.000Z');
  });

  it('is provisional when working days leaned on the calendar of a year nobody confirmed', () => {
    const result = scheduleStep(step({ durationUnit: 'WORKING_DAY' }), day('2026-12-01'), {}, calendar);
    expect(result).toMatchObject({ ok: true, provisional: true });
  });

  it('uses the variant whose condition the record meets', () => {
    const withVariant = step({ variants: [{ conditionKey: 'CRIME_GRAVITY', conditionValue: 'NGHIEM_TRONG', durationValue: 10, durationUnit: 'DAY', maxExtensions: null, extensionValue: null, extensionUnit: null }] });
    const own = scheduleStep(withVariant, day('2026-12-01'), {}, calendar);
    const varied = scheduleStep(withVariant, day('2026-12-01'), { CRIME_GRAVITY: 'NGHIEM_TRONG' }, calendar);
    if (!own.ok || !varied.ok) throw new Error('unreachable');
    expect(varied.variant).toBe('NGHIEM_TRONG');
    expect(varied.dueAt.getTime()).toBeGreaterThan(own.dueAt.getTime());
  });

  it('gives a refusal of the engine as a problem, not as an exception', () => {
    expect(scheduleStep(step({ durationUnit: 'HOUR' }), day('2026-12-01'), {}, calendar)).toEqual({ ok: false, problem: PROCESSING_ERROR.HOUR_ANCHOR_HAS_NO_TIME });
  });
});

describe('the steps a record gets', () => {
  const anchors = { RECEIVED: day('2026-12-01') };

  it('opens the step whose date the record has, with its deadline', () => {
    const [first] = planRecordSteps([step()], anchors, {}, calendar);
    expect(first).toMatchObject({ status: 'OPEN', stepKey: 'k1', order: 0, problem: null });
    expect(first.startAt?.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(first.dueAt?.toISOString()).toBe('2026-12-06T16:59:59.999Z');
  });

  it('keeps a step counted from the completion of the one before waiting, with no deadline yet', () => {
    const plan = planRecordSteps([step(), step({ stepKey: 'k2', anchor: 'PREVIOUS_STEP_DONE' })], anchors, {}, calendar);
    expect(plan[1]).toMatchObject({ status: 'WAITING_ANCHOR', startAt: null, dueAt: null, problem: null });
  });

  it('keeps a step whose date the record does not carry waiting (the date a person has yet to record)', () => {
    const [first] = planRecordSteps([step({ anchor: 'ACCEPTED' })], anchors, {}, calendar);
    expect(first).toMatchObject({ status: 'WAITING_ANCHOR', dueAt: null, problem: null });
  });

  it('opens it as soon as that date is given', () => {
    const [first] = planRecordSteps([step({ anchor: 'ACCEPTED' })], { ...anchors, ACCEPTED: day('2026-12-10') }, {}, calendar);
    expect(first.status).toBe('OPEN');
  });

  it('keeps a step the engine cannot schedule waiting and says why', () => {
    const [first] = planRecordSteps([step({ durationUnit: 'HOUR' })], anchors, {}, calendar);
    expect(first).toMatchObject({ status: 'WAITING_ANCHOR', dueAt: null, problem: PROCESSING_ERROR.HOUR_ANCHOR_HAS_NO_TIME });
  });

  it('marks the step that sets the deadline of the record', () => {
    const plan = planRecordSteps([step(), step({ stepKey: 'k2', setsRecordDeadline: true })], anchors, {}, calendar);
    expect(plan.map((p) => p.setsRecordDeadline)).toEqual([false, true]);
  });
});
