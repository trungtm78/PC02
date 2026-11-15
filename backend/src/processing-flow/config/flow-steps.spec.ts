import { FlowShapeError, legalFingerprint, MAX_STEPS, normaliseSteps } from './flow-steps';

const raw = (over: Record<string, unknown> = {}) => ({
  name: '  Check  ',
  durationValue: 20,
  durationUnit: 'DAY',
  anchor: 'RECEIVED',
  redDays: 1,
  yellowDays: 3,
  greenDays: 5,
  parties: [{ partyKind: 'RECORD_TEAM', role: 'MAIN' }],
  ...over,
});

const problems = (value: unknown): unknown => {
  try {
    normaliseSteps(value);
  } catch (error) {
    if (error instanceof FlowShapeError) return error.details;
    throw error;
  }
  return 'ACCEPTED';
};

describe('normaliseSteps', () => {
  it('fills what a step may leave out and trims its texts', () => {
    expect(normaliseSteps([raw({ description: '  ', legalBasis: ' Điều 147 ' })])).toEqual([
      {
        stepKey: null,
        name: 'Check',
        description: null,
        durationValue: 20,
        durationUnit: 'DAY',
        anchor: 'RECEIVED',
        rollToWorkingDay: true,
        redDays: 1,
        yellowDays: 3,
        greenDays: 5,
        legalBasis: 'Điều 147',
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
      },
    ]);
  });

  it('keeps everything a step says', () => {
    const [step] = normaliseSteps([
      raw({
        stepKey: 'k1',
        rollToWorkingDay: false,
        setsRecordDeadline: true,
        requiresApproval: true,
        maxExtensions: 2,
        extensionValue: 2,
        extensionUnit: 'MONTH',
        escalateAfterDays: 3,
        escalateLeadershipAfterDays: 7,
        legalDocNumber: '101/2015/QH13',
        legalDocUrl: 'https://example.test/law',
        parties: [
          { partyKind: 'RECORD_TEAM', role: 'MAIN' },
          { partyKind: 'TEAM', teamId: 't1', role: 'CHECK', note: ' second look ' },
        ],
        variants: [{ conditionKey: 'CRIME_GRAVITY', conditionValue: 'NGHIEM_TRONG', durationValue: 3, durationUnit: 'MONTH', maxExtensions: 2 }],
      }),
    ]);
    expect(step).toMatchObject({
      stepKey: 'k1',
      rollToWorkingDay: false,
      setsRecordDeadline: true,
      requiresApproval: true,
      maxExtensions: 2,
      extensionValue: 2,
      extensionUnit: 'MONTH',
      escalateAfterDays: 3,
      escalateLeadershipAfterDays: 7,
      legalDocNumber: '101/2015/QH13',
      legalDocUrl: 'https://example.test/law',
    });
    expect(step.parties[1]).toEqual({ partyKind: 'TEAM', teamId: 't1', role: 'CHECK', note: 'second look' });
    expect(step.variants).toEqual([
      { conditionKey: 'CRIME_GRAVITY', conditionValue: 'NGHIEM_TRONG', durationValue: 3, durationUnit: 'MONTH', maxExtensions: 2, extensionValue: null, extensionUnit: null },
    ]);
  });

  it('a business mistake is not a shape mistake: it is stored, and told at publish', () => {
    expect(problems([raw({ name: '', parties: [], redDays: 9, durationValue: -4, anchor: 'PREVIOUS_STEP_DONE' })])).toBe('ACCEPTED');
    expect(problems([])).toBe('ACCEPTED');
  });

  it.each([
    ['not a list', { steps: [] }, [{ field: 'steps' }]],
    ['a step that is not an object', ['x'], [{ stepIndex: 0, field: 'step' }]],
    ['an unknown unit', [raw({ durationUnit: 'WEEK' })], [{ stepIndex: 0, field: 'durationUnit' }]],
    ['an unknown anchor', [raw(), raw({ anchor: 'SOMEDAY' })], [{ stepIndex: 1, field: 'anchor' }]],
    ['a duration that is not a whole number', [raw({ durationValue: 1.5 })], [{ stepIndex: 0, field: 'durationValue' }]],
    ['a duration no column can hold', [raw({ durationValue: 3_000_000_000 })], [{ stepIndex: 0, field: 'durationValue' }]],
    ['a threshold that is text', [raw({ yellowDays: '3' })], [{ stepIndex: 0, field: 'yellowDays' }]],
    ['a name that is not text', [raw({ name: 5 })], [{ stepIndex: 0, field: 'name' }]],
    ['an unknown extension unit', [raw({ extensionUnit: 'YEAR' })], [{ stepIndex: 0, field: 'extensionUnit' }]],
    ['a negative escalation', [raw({ escalateAfterDays: -1 })], [{ stepIndex: 0, field: 'escalateAfterDays' }]],
    ['a flag that is not a boolean', [raw({ setsRecordDeadline: 'yes' })], [{ stepIndex: 0, field: 'setsRecordDeadline' }]],
    ['a link that is not a web address', [raw({ legalDocUrl: 'javascript:alert(1)' })], [{ stepIndex: 0, field: 'legalDocUrl' }]],
    ['parties that are not a list', [raw({ parties: 'x' })], [{ stepIndex: 0, field: 'parties' }]],
    ['an unknown party kind', [raw({ parties: [{ partyKind: 'PERSON', role: 'MAIN' }] })], [{ stepIndex: 0, field: 'parties.0.partyKind' }]],
    ['an unknown role', [raw({ parties: [{ partyKind: 'RECORD_TEAM', role: 'BOSS' }] })], [{ stepIndex: 0, field: 'parties.0.role' }]],
    ['a named unit without its id', [raw({ parties: [{ partyKind: 'TEAM', role: 'MAIN' }] })], [{ stepIndex: 0, field: 'parties.0.teamId' }]],
    ['"the unit holding the record" with an id', [raw({ parties: [{ partyKind: 'RECORD_TEAM', teamId: 't1', role: 'MAIN' }] })], [{ stepIndex: 0, field: 'parties.0.teamId' }]],
    ['an unknown condition', [raw({ variants: [{ conditionKey: 'WEATHER', conditionValue: 'RAIN', durationValue: 1, durationUnit: 'DAY' }] })], [{ stepIndex: 0, field: 'variants.0.conditionKey' }]],
    [
      'a gravity the law does not know',
      [raw({ variants: [{ conditionKey: 'CRIME_GRAVITY', conditionValue: 'KINDA_BAD', durationValue: 1, durationUnit: 'DAY' }] })],
      [{ stepIndex: 0, field: 'variants.0.conditionValue' }],
    ],
    ['a key that is not text', [raw({ stepKey: 7 })], [{ stepIndex: 0, field: 'stepKey' }]],
    ['the same key twice', [raw({ stepKey: 'k1' }), raw({ stepKey: 'k1' })], [{ stepIndex: 1, field: 'stepKey' }]],
    ['a field the step does not have', [raw({ colour: 'red' })], [{ stepIndex: 0, field: 'colour' }]],
  ])('refuses %s', (_what, value, expected) => {
    expect(problems(value)).toEqual(expected);
  });

  it('refuses more steps than a flow may have', () => {
    expect(problems(Array.from({ length: MAX_STEPS + 1 }, () => raw()))).toEqual([{ field: 'steps' }]);
    expect(problems(Array.from({ length: MAX_STEPS }, () => raw()))).toBe('ACCEPTED');
  });

  it('every problem is listed, not only the first', () => {
    expect(problems([raw({ durationUnit: 'WEEK', anchor: 'SOMEDAY' }), raw({ redDays: null })])).toEqual([
      { stepIndex: 0, field: 'durationUnit' },
      { stepIndex: 0, field: 'anchor' },
      { stepIndex: 1, field: 'redDays' },
    ]);
  });
});

describe('legalFingerprint', () => {
  const [base] = normaliseSteps([raw({ legalBasis: 'Điều 147', maxExtensions: 1, extensionValue: 2, extensionUnit: 'MONTH' })]);

  it('is the same for the same legal figures, whatever else changes', () => {
    expect(legalFingerprint({ ...base, name: 'Other', description: 'x', redDays: 0, parties: [], requiresApproval: true, escalateAfterDays: 4 })).toBe(
      legalFingerprint(base),
    );
  });

  it.each([
    ['the duration', { durationValue: 21 }],
    ['the unit', { durationUnit: 'WORKING_DAY' as const }],
    ['the anchor', { anchor: 'PROPOSED' as const }],
    ['rolling to a working day', { rollToWorkingDay: false }],
    ['the legal basis', { legalBasis: 'Điều 148' }],
    ['the document number', { legalDocNumber: '1' }],
    ['the number of extensions', { maxExtensions: 2 }],
    ['the length of an extension', { extensionValue: 3 }],
    ['a variant', { variants: [{ conditionKey: 'CRIME_GRAVITY' as const, conditionValue: 'NGHIEM_TRONG', durationValue: 3, durationUnit: 'MONTH' as const, maxExtensions: null, extensionValue: null, extensionUnit: null }] }],
  ])('changes with %s', (_what, change) => {
    expect(legalFingerprint({ ...base, ...change })).not.toBe(legalFingerprint(base));
  });
});
