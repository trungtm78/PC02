import { describe, it, expect } from 'vitest';
import {
  addParty,
  addVariant,
  anchorsForStep,
  draftFromDto,
  isDirty,
  moveStep,
  newStepFrom,
  removeStep,
  setExtensions,
  setRecordDeadlineStep,
  toPreviewPayload,
  toStepPayload,
  unverifiedCount,
  type StepDraft,
} from '../steps';
import type { StepDto } from '../types';

const keys = (() => {
  let n = 0;
  return () => `k${++n}`;
})();

const DTO: StepDto = {
  stepKey: 'step-1',
  order: 0,
  name: 'Kiểm tra, xác minh',
  description: 'Mô tả',
  durationValue: 20,
  durationUnit: 'DAY',
  anchor: 'RECEIVED',
  rollToWorkingDay: true,
  redDays: 1,
  yellowDays: 3,
  greenDays: 5,
  legalBasis: 'Điều 147 BLTTHS 2015',
  legalDocNumber: null,
  legalDocUrl: null,
  setsRecordDeadline: true,
  requiresApproval: true,
  maxExtensions: 2,
  extensionValue: 2,
  extensionUnit: 'MONTH',
  escalateAfterDays: null,
  escalateLeadershipAfterDays: 4,
  legalVerifiedAt: '2026-11-01T03:00:00.000Z',
  legalVerifiedById: 'u1',
  parties: [
    { partyKind: 'RECORD_TEAM', teamId: null, role: 'MAIN', note: null, teamName: null, teamStatus: null },
    { partyKind: 'TEAM', teamId: 't5', role: 'COORDINATE', note: 'ghi chú', teamName: 'Tổ 5', teamStatus: 'ACTIVE' },
  ],
  variants: [
    {
      conditionKey: 'CRIME_GRAVITY',
      conditionValue: 'IT_NGHIEM_TRONG',
      durationValue: 2,
      durationUnit: 'MONTH',
      maxExtensions: null,
      extensionValue: null,
      extensionUnit: null,
    },
  ],
};

const draft = (over: Partial<StepDraft> = {}): StepDraft => ({ ...draftFromDto(DTO, keys), ...over });

describe('the payload of a step', () => {
  it('carries exactly the fields the server accepts and no other', () => {
    const payload = toStepPayload(draft());
    expect(Object.keys(payload).sort()).toEqual(
      [
        'stepKey', 'name', 'description', 'durationValue', 'durationUnit', 'anchor', 'rollToWorkingDay', 'redDays', 'yellowDays',
        'greenDays', 'legalBasis', 'legalDocNumber', 'legalDocUrl', 'setsRecordDeadline', 'requiresApproval', 'maxExtensions',
        'extensionValue', 'extensionUnit', 'escalateAfterDays', 'escalateLeadershipAfterDays', 'parties', 'variants',
      ].sort(),
    );
    expect(payload).not.toHaveProperty('order');
    expect(payload).not.toHaveProperty('legalVerifiedAt');
    expect(payload).not.toHaveProperty('legalVerifiedById');
    expect(payload).not.toHaveProperty('key');
  });

  it('a party carries exactly partyKind, teamId (a named unit only), role and note', () => {
    const { parties } = toStepPayload(draft());
    expect(parties[0]).toEqual({ partyKind: 'RECORD_TEAM', role: 'MAIN', note: null });
    expect(parties[1]).toEqual({ partyKind: 'TEAM', teamId: 't5', role: 'COORDINATE', note: 'ghi chú' });
    expect(Object.keys(parties[1]).sort()).toEqual(['note', 'partyKind', 'role', 'teamId']);
  });

  it('a variant carries exactly the seven fields of the contract', () => {
    const [variant] = toStepPayload(draft()).variants;
    expect(Object.keys(variant).sort()).toEqual(
      ['conditionKey', 'conditionValue', 'durationUnit', 'durationValue', 'extensionUnit', 'extensionValue', 'maxExtensions'],
    );
  });

  it('a step that was never saved has no stepKey at all (not null)', () => {
    expect(toStepPayload(draft({ stepKey: null }))).not.toHaveProperty('stepKey');
    expect(toStepPayload(draft())).toHaveProperty('stepKey', 'step-1');
  });

  it('empty texts are sent as null, and kept figures round-trip', () => {
    const p = toStepPayload(draft({ description: '   ', legalDocUrl: '', legalDocNumber: ' 12/2020 ' }));
    expect(p.description).toBeNull();
    expect(p.legalDocUrl).toBeNull();
    expect(p.legalDocNumber).toBe('12/2020');
    expect(p.escalateLeadershipAfterDays).toBe(4);
    expect(p.escalateAfterDays).toBeNull();
  });

  it('the preview payload leaves out a unit row that has no unit chosen yet', () => {
    const half = draft({ parties: [...draft().parties, { key: 'x', partyKind: 'TEAM', teamId: null, role: 'INFORM', note: null, teamName: null }] });
    expect(toStepPayload(half).parties).toHaveLength(3);
    expect(toPreviewPayload([half])[0].parties).toHaveLength(2);
  });
});

describe('adding a step', () => {
  it('copies the units, duration and thresholds of the row above, counts from the previous step, and starts unverified and not general', () => {
    const next = newStepFrom(draft(), 'Bước mới', keys);
    expect(next.name).toBe('Bước mới');
    expect(next.stepKey).toBeNull();
    expect(next.anchor).toBe('PREVIOUS_STEP_DONE');
    expect(next.durationValue).toBe(20);
    expect(next.durationUnit).toBe('DAY');
    expect([next.redDays, next.yellowDays, next.greenDays]).toEqual([1, 3, 5]);
    expect(next.parties.map((p) => [p.partyKind, p.teamId, p.role])).toEqual([
      ['RECORD_TEAM', null, 'MAIN'],
      ['TEAM', 't5', 'COORDINATE'],
    ]);
    expect(next.setsRecordDeadline).toBe(false);
    expect(next.requiresApproval).toBe(false);
    expect(next.legalBasis).toBe('');
    expect(next.legalVerifiedAt).toBeNull();
    expect(next.maxExtensions).toBe(0);
    expect(next.variants).toEqual([]);
  });

  it('does not share party objects with the row above (editing one must not change the other)', () => {
    const above = draft();
    const next = newStepFrom(above, 'x', keys);
    next.parties[0].role = 'CHECK';
    expect(above.parties[0].role).toBe('MAIN');
  });

  it('the first step of an empty flow is held by the record unit, counted from the receipt, with thresholds 1/2/3', () => {
    const first = newStepFrom(null, 'Bước 1', keys);
    expect(first.anchor).toBe('RECEIVED');
    expect(first.parties).toHaveLength(1);
    expect(first.parties[0]).toMatchObject({ partyKind: 'RECORD_TEAM', role: 'MAIN' });
    expect([first.redDays, first.yellowDays, first.greenDays]).toEqual([1, 2, 3]);
  });
});

describe('moving, removing and flagging steps', () => {
  const three = (): StepDraft[] => ['a', 'b', 'c'].map((name) => draft({ name, key: name }));

  it('up and down swap neighbours and return a new list', () => {
    const list = three();
    expect(moveStep(list, 1, 'up').map((s) => s.name)).toEqual(['b', 'a', 'c']);
    expect(moveStep(list, 1, 'down').map((s) => s.name)).toEqual(['a', 'c', 'b']);
    expect(list.map((s) => s.name)).toEqual(['a', 'b', 'c']);
  });

  it('cannot move the first up or the last down: the list is returned unchanged', () => {
    const list = three();
    expect(moveStep(list, 0, 'up')).toBe(list);
    expect(moveStep(list, 2, 'down')).toBe(list);
  });

  it('removes a step by position', () => {
    expect(removeStep(three(), 1).map((s) => s.name)).toEqual(['a', 'c']);
  });

  it('flags exactly one step as the deadline of the record, and can flag none', () => {
    const list = setRecordDeadlineStep(three(), 2);
    expect(list.map((s) => s.setsRecordDeadline)).toEqual([false, false, true]);
    expect(setRecordDeadlineStep(list, null).map((s) => s.setsRecordDeadline)).toEqual([false, false, false]);
  });
});

describe('anchors', () => {
  it('a petition or incident cannot count from a date only a case has', () => {
    expect(anchorsForStep('PETITION', 1)).toEqual(['RECEIVED', 'PROPOSED', 'ASSIGNED_TO_UNIT', 'ACCEPTED', 'PREVIOUS_STEP_DONE']);
    expect(anchorsForStep('INCIDENT', 1)).not.toContain('PROSECUTED');
    expect(anchorsForStep('INCIDENT', 1)).not.toContain('MINUTES_RECEIVED');
  });

  it('a case has all seven', () => {
    expect(anchorsForStep('CASE', 1)).toHaveLength(7);
    expect(anchorsForStep('CASE', 1)).toContain('PROSECUTED');
  });

  it('the first step cannot count from the previous step', () => {
    expect(anchorsForStep('CASE', 0)).not.toContain('PREVIOUS_STEP_DONE');
    expect(anchorsForStep('PETITION', 0)).not.toContain('PREVIOUS_STEP_DONE');
  });
});

describe('extensions, parties and variants', () => {
  it('switching extensions on asks for at least one extension of a month; off clears all three fields', () => {
    const on = setExtensions(draft({ maxExtensions: 0, extensionValue: null, extensionUnit: null }), true);
    expect([on.maxExtensions, on.extensionValue, on.extensionUnit]).toEqual([1, 1, 'MONTH']);
    const off = setExtensions(on, false);
    expect([off.maxExtensions, off.extensionValue, off.extensionUnit]).toEqual([0, null, null]);
  });

  it('switching extensions on keeps what the step already says', () => {
    const on = setExtensions(draft(), true);
    expect([on.maxExtensions, on.extensionValue, on.extensionUnit]).toEqual([2, 2, 'MONTH']);
  });

  it('a new unit row is a named unit with no unit chosen yet, informing', () => {
    const next = addParty(draft(), keys);
    expect(next.parties.at(-1)).toMatchObject({ partyKind: 'TEAM', teamId: null, role: 'INFORM' });
  });

  it('a new variant takes the first gravity not used yet and the duration of the step', () => {
    const base = draft({ variants: [] });
    const one = addVariant(base, keys);
    expect(one.variants[0]).toMatchObject({ conditionKey: 'CRIME_GRAVITY', conditionValue: 'IT_NGHIEM_TRONG', durationValue: 20, durationUnit: 'DAY' });
    const two = addVariant(one, keys);
    expect(two.variants.map((v) => v.conditionValue)).toEqual(['IT_NGHIEM_TRONG', 'NGHIEM_TRONG']);
  });

  it('stops offering variants when all four gravities are taken', () => {
    let s = draft({ variants: [] });
    for (let i = 0; i < 6; i++) s = addVariant(s, keys);
    expect(s.variants).toHaveLength(4);
  });
});

describe('dirty and unverified', () => {
  it('a draft is dirty only when what would be sent differs from what was saved', () => {
    const saved = [toStepPayload(draft())];
    expect(isDirty([draft()], saved)).toBe(false);
    expect(isDirty([draft({ name: 'Khác' })], saved)).toBe(true);
    expect(isDirty([draft(), draft()], saved)).toBe(true);
  });

  it('counts the steps whose legal basis has not been compared with the source text, new rows included', () => {
    expect(unverifiedCount([draft(), draft({ legalVerifiedAt: null }), newStepFrom(null, 'n', keys)])).toBe(2);
  });
});
