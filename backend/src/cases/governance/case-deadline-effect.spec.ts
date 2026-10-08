import {
  evaluateDeadlineEffect,
  getDeadlineEffectRequiredInputs,
  validateDeadlineEffect,
} from './case-deadline-effect';

// All durations and calendars are synthetic review fixtures, not statutory rules.
const calendar = {
  id: 'SYNTHETIC-OFFICE',
  version: 'review-1',
  effectiveFrom: '2024-01-01',
  effectiveTo: '2028-12-31',
  weekendDays: [0, 6],
  nonworkingDates: [] as string[],
  workingOverrides: [] as string[],
  sourceReferenceIds: ['synthetic-calendar-review'],
};
function definition(phase = 'INITIAL', value = 1, unit = 'MONTHS') {
  return {
    code: 'SYNTHETIC',
    deadlineEffect: {
      mode: 'CALCULATE',
      algorithm: 'CIVIL_PERIOD',
      version: 1,
      phase,
      anchors:
        phase === 'INITIAL'
          ? { initiation: 'payload.facts.initiation' }
          : phase === 'RESTORED'
            ? { restoration: 'payload.facts.restoration' }
            : {
                dossierReceipt: 'payload.facts.dossierReceipt',
                requestReceipt: 'payload.facts.requestReceipt',
              },
      gravityPath: 'case.gravity',
      ...(phase === 'SUPPLEMENTARY'
        ? { authorityPath: 'payload.authority' }
        : {}),
      durations:
        phase === 'SUPPLEMENTARY'
          ? [
              { gravity: 'SERIOUS', authority: 'VKS', value, unit },
              { gravity: 'SERIOUS', authority: 'TOA', value: value + 1, unit },
            ]
          : [{ gravity: 'SERIOUS', value, unit }],
      calendar: structuredClone(calendar),
      sourceReferenceIds: ['synthetic-policy-review'],
    },
  };
}
const fact = (date: string, quality = 'VERIFIED') => ({
  date,
  quality,
  sourceReferenceIds: ['synthetic-source-document'],
});
const record = {
  gravity: 'SERIOUS',
  deadline: new Date('2000-01-01T00:00:00.000Z'),
};
const clock = () => new Date('2030-01-01T00:00:00.000Z');
function calculate(date: string, value = 1, unit = 'MONTHS') {
  return evaluateDeadlineEffect(
    definition('INITIAL', value, unit),
    record,
    { facts: { initiation: fact(date) } },
    clock,
  );
}

describe('versioned investigation deadline effects', () => {
  it.each([
    ['2024-01-31', 1, 'MONTHS', '2024-02-29'],
    ['2025-01-31', 1, 'MONTHS', '2025-02-28'],
    ['2024-02-29', 12, 'MONTHS', '2025-02-28'],
    ['2024-12-31', 2, 'MONTHS', '2025-02-28'],
    ['2024-02-28', 1, 'DAYS', '2024-02-29'],
    ['2025-02-28', 1, 'DAYS', '2025-03-03'],
  ])('calendar oracle %s + %s %s ends %s', (date, n, unit, due) => {
    const result = calculate(date, n, unit);
    expect(result.deadline?.toISOString()).toBe(`${due}T16:59:59.999Z`);
    expect(result.provenance).toMatchObject({
      algorithm: 'CIVIL_PERIOD',
      version: 1,
      status: 'VERIFIED_POLICY',
      timezone: 'Asia/Ho_Chi_Minh',
      civilDueDate: due,
      phase: 'INITIAL',
      anchorDate: date,
      gravity: 'SERIOUS',
      sourceReferenceIds: ['synthetic-policy-review'],
    });
  });

  it.each(['SUPPLEMENTARY', 'REINVESTIGATION'])(
    '%s uses both receipt facts rather than the decision date',
    (phase) => {
      const result = evaluateDeadlineEffect(
        definition(phase, 2, 'DAYS'),
        record,
        {
          authority: 'VKS',
          decision: { date: '2024-03-20' },
          facts: {
            dossierReceipt: fact('2024-03-04'),
            requestReceipt: fact('2024-03-06'),
          },
        },
        clock,
      );
      expect(result.deadline?.toISOString()).toBe('2024-03-08T16:59:59.999Z');
      expect(result.provenance).toMatchObject({ anchorDate: '2024-03-06' });
    },
  );

  it('restoration uses the confirmed restoration decision and replaces the old deadline', () => {
    const result = evaluateDeadlineEffect(
      definition('RESTORED'),
      record,
      {
        facts: { restoration: fact('2024-03-01') },
      },
      clock,
    );
    expect(result.deadline?.toISOString()).toBe('2024-04-01T16:59:59.999Z');
  });

  it('returns actual dependencies for the caller to authorize before calculation', () => {
    expect(
      getDeadlineEffectRequiredInputs(definition('SUPPLEMENTARY')),
    ).toEqual([
      'payload.facts.dossierReceipt',
      'payload.facts.requestReceipt',
      'case.gravity',
      'payload.authority',
    ]);
  });

  it.each([undefined, {}, { mode: 'CALCULATE', algorithm: 'DETENTION' }])(
    'rejects missing or unsupported effects %j',
    (effect) => {
      expect(() =>
        evaluateDeadlineEffect({ deadlineEffect: effect }, record, {}, clock),
      ).toThrow();
    },
  );

  it('preserves only an explicitly declared legacy value without certification', () => {
    const result = evaluateDeadlineEffect(
      { deadlineEffect: { mode: 'PRESERVE' } },
      record,
      {},
    );
    expect(result.deadline).toEqual(record.deadline);
    expect(result.provenance).toMatchObject({
      status: 'LEGACY_UNVERIFIED',
      algorithm: 'PRESERVE',
      dependencies: ['case.deadline'],
    });
  });

  it.each([
    undefined,
    null,
    '2024-03',
    fact('2024-02-30'),
    fact('2024-03-01', 'EXTRACTED'),
    { date: '2024-03-01' },
  ])(
    'unready anchor %j fails generically without substituting now or legacy',
    (anchor) => {
      expect(() =>
        evaluateDeadlineEffect(
          definition(),
          record,
          { facts: { initiation: anchor } },
          clock,
        ),
      ).toThrow('Deadline inputs are not ready');
    },
  );

  it('validates the definition independently from the input facts', () => {
    expect(validateDeadlineEffect(definition().deadlineEffect)).toEqual(
      definition().deadlineEffect,
    );
  });

  it('selects a reviewed authority and gravity mapping', () => {
    const d = definition('SUPPLEMENTARY', 1, 'MONTHS');
    d.deadlineEffect.durations.push({
      gravity: 'LOW',
      authority: 'TOA',
      value: 3,
      unit: 'MONTHS',
    });
    const p = {
      authority: 'TOA',
      facts: {
        dossierReceipt: fact('2024-03-04'),
        requestReceipt: fact('2024-03-01'),
      },
    };
    expect(
      evaluateDeadlineEffect(d, record, p, clock).deadline?.toISOString(),
    ).toBe('2024-05-06T16:59:59.999Z');
    expect(
      evaluateDeadlineEffect(
        d,
        { gravity: 'LOW' },
        p,
        clock,
      ).deadline?.toISOString(),
    ).toBe('2024-06-04T16:59:59.999Z');
    expect(() =>
      evaluateDeadlineEffect(d, record, { ...p, authority: 'POLICE' }, clock),
    ).toThrow('Deadline inputs are not ready');
    expect(() =>
      evaluateDeadlineEffect(d, { gravity: 'UNKNOWN' }, p, clock),
    ).toThrow('Deadline inputs are not ready');
  });

  it('rolls consecutive nonworking days but honors explicit working overrides', () => {
    const d = definition('INITIAL', 1, 'DAYS');
    d.deadlineEffect.calendar.nonworkingDates = ['2024-03-04', '2024-03-05'];
    const p = { facts: { initiation: fact('2024-03-01') } };
    const result = evaluateDeadlineEffect(d, record, p, clock);
    expect(result.deadline?.toISOString()).toBe('2024-03-06T16:59:59.999Z');
    expect(result.provenance).toMatchObject({
      unadjustedCivilDueDate: '2024-03-02',
      rolledDays: 4,
    });
    d.deadlineEffect.calendar.workingOverrides = ['2024-03-03'];
    expect(
      evaluateDeadlineEffect(d, record, p, clock).deadline?.toISOString(),
    ).toBe('2024-03-03T16:59:59.999Z');
  });

  it.each(['2023-12-31', '2028-12-31'])(
    'rejects insufficient pinned calendar coverage starting %s',
    (date) => {
      expect(() => calculate(date)).toThrow(
        'Deadline calendar coverage is insufficient',
      );
    },
  );

  it('bounds calendar roll when the published calendar has no working day', () => {
    const d = definition('INITIAL', 1, 'DAYS');
    d.deadlineEffect.calendar.weekendDays = [0, 1, 2, 3, 4, 5, 6];
    expect(() =>
      evaluateDeadlineEffect(
        d,
        record,
        { facts: { initiation: fact('2024-03-01') } },
        clock,
      ),
    ).toThrow('Deadline calendar roll limit exceeded');
  });

  it('uses the injected clock in the local civil zone for future-fact readiness', () => {
    const p = { facts: { initiation: fact('2024-03-02') } };
    expect(() =>
      evaluateDeadlineEffect(
        definition(),
        record,
        p,
        () => new Date('2024-03-01T16:59:59.999Z'),
      ),
    ).toThrow('Deadline inputs are not ready');
    expect(
      evaluateDeadlineEffect(
        definition(),
        record,
        p,
        () => new Date('2024-03-01T17:00:00.000Z'),
      ).deadline?.toISOString(),
    ).toBe('2024-04-02T16:59:59.999Z');
    expect(() =>
      evaluateDeadlineEffect(
        definition(),
        record,
        p,
        () => new Date('invalid'),
      ),
    ).toThrow('Deadline inputs are not ready');
  });

  it('records immutable actual anchor/source/calendar basis without rewriting the inputs', () => {
    const d = definition();
    const p = { facts: { initiation: fact('2024-01-31', 'COMPLETE') } };
    const before = JSON.stringify({ d, p, record });
    const result = evaluateDeadlineEffect(d, record, p, clock);
    expect(JSON.stringify({ d, p, record })).toBe(before);
    expect(result.provenance).toMatchObject({
      anchors: [
        {
          role: 'initiation',
          path: 'payload.facts.initiation',
          date: '2024-01-31',
          sourceReferenceIds: ['synthetic-source-document'],
        },
      ],
      duration: { gravity: 'SERIOUS', value: 1, unit: 'MONTHS' },
      calendar: {
        id: 'SYNTHETIC-OFFICE',
        version: 'review-1',
        sourceReferenceIds: ['synthetic-calendar-review'],
      },
      resultingInstant: '2024-02-29T16:59:59.999Z',
      statutoryCertification: false,
    });
    const basis = result.provenance.calendar as { hash: string };
    expect(basis.hash).toMatch(/^[0-9a-f]{64}$/);
    p.facts.initiation.sourceReferenceIds.push('later-change');
    d.deadlineEffect.calendar.weekendDays.push(1);
    expect(JSON.stringify(result.provenance)).not.toContain('later-change');
  });

  it('binds effect and calendar references to declared per-action legal source IDs', () => {
    const d = {
      ...definition(),
      legalSources: [
        { id: 'synthetic-policy-review' },
        { id: 'synthetic-calendar-review' },
      ],
    };
    expect(
      evaluateDeadlineEffect(
        d,
        record,
        { facts: { initiation: fact('2024-03-01') } },
        clock,
      ).deadline,
    ).toBeInstanceOf(Date);
    d.legalSources.pop();
    expect(() => evaluateDeadlineEffect(d, record, {}, clock)).toThrow(
      'Deadline source reference is not declared',
    );
  });

  it('preserves null without fabricating a date and copies dates rather than sharing mutable objects', () => {
    const d = { deadlineEffect: { mode: 'PRESERVE' } };
    expect(
      evaluateDeadlineEffect(d, { deadline: null }, {}).deadline,
    ).toBeNull();
    const out = evaluateDeadlineEffect(d, record, {});
    expect(out.deadline).not.toBe(record.deadline);
    expect(() =>
      evaluateDeadlineEffect(d, { deadline: new Date('invalid') }, {}),
    ).toThrow('Deadline inputs are not ready');
  });

  it.each([
    ['algorithm', 'EVAL'],
    ['version', 2],
    ['phase', 'DETENTION'],
    ['mode', 'UNKNOWN'],
    ['gravityPath', 'case.__proto__.secret'],
    ['gravityPath', 'case..gravity'],
    ['gravityPath', 'case.constructor.gravity'],
    ['gravityPath', 'metadata.gravity'],
    ['unknown', true],
  ])('rejects unsupported/unsafe configuration %s=%j', (key, value) => {
    const e = { ...definition().deadlineEffect, [key]: value };
    expect(() => validateDeadlineEffect(e)).toThrow();
  });

  it.each([0, -1, 1.5, Infinity, NaN, 1000001, Number.MAX_SAFE_INTEGER])(
    'rejects unsafe duration %s',
    (value) => {
      expect(() =>
        validateDeadlineEffect(definition('INITIAL', value).deadlineEffect),
      ).toThrow();
    },
  );

  it.each(['YEARS', 'HOURS', 'WORKING_DAYS'])(
    'rejects unsupported duration unit %s',
    (unit) => {
      expect(() =>
        validateDeadlineEffect(definition('INITIAL', 1, unit).deadlineEffect),
      ).toThrow();
    },
  );

  it.each([
    { weekendDays: [7] },
    { weekendDays: [6, 6] },
    { weekendDays: [1.5] },
    { nonworkingDates: ['2024-02-30'] },
    { nonworkingDates: ['2024-03-01', '2024-03-01'] },
    { workingOverrides: ['2024-03-01', '2024-03-01'] },
    { nonworkingDates: ['2023-12-31'] },
    { workingOverrides: ['2029-01-01'] },
    { nonworkingDates: ['2024-03-01'], workingOverrides: ['2024-03-01'] },
    { effectiveFrom: '2026-01-01', effectiveTo: '2025-01-01' },
    { effectiveFrom: '2024-01' },
    { sourceReferenceIds: [] },
    { version: '' },
    { irrelevant: true },
    { id: 'x'.repeat(257) },
  ])('rejects invalid pinned calendar %j', (changes) => {
    const e = definition().deadlineEffect;
    Object.assign(e.calendar, changes);
    expect(() => validateDeadlineEffect(e)).toThrow();
  });

  it('rejects duplicate/missing mappings and incomplete phase-specific anchors', () => {
    const e = definition().deadlineEffect;
    const durations: unknown[] = e.durations;
    durations.push(e.durations[0]);
    expect(() => validateDeadlineEffect(e)).toThrow();
    expect(() => validateDeadlineEffect({ ...e, durations: [] })).toThrow();
    expect(() =>
      validateDeadlineEffect({
        ...definition('SUPPLEMENTARY').deadlineEffect,
        authorityPath: undefined,
      }),
    ).toThrow();
    expect(() =>
      validateDeadlineEffect({
        ...definition('REINVESTIGATION').deadlineEffect,
        anchors: { dossierReceipt: 'payload.receipt' },
      }),
    ).toThrow();
    expect(() =>
      validateDeadlineEffect({
        ...definition().deadlineEffect,
        anchors: { restoration: 'payload.date' },
      }),
    ).toThrow();
    expect(() =>
      validateDeadlineEffect({ mode: 'PRESERVE', phase: 'INITIAL' }),
    ).toThrow();
  });

  it('rejects inherited/prototype/accessor config and never evaluates fact getters', () => {
    const e = definition().deadlineEffect;
    expect(() => validateDeadlineEffect(Object.create(e))).toThrow();
    expect(() =>
      validateDeadlineEffect(JSON.parse('{"mode":"PRESERVE","__proto__":{}}')),
    ).toThrow();
    const configGetter = jest.fn(() => 'PRESERVE');
    expect(() =>
      validateDeadlineEffect(
        Object.defineProperty({}, 'mode', {
          enumerable: true,
          get: configGetter,
        }),
      ),
    ).toThrow();
    expect(configGetter).not.toHaveBeenCalled();
    const inputGetter = jest.fn(() => fact('2024-03-01'));
    const p = {
      facts: Object.defineProperty({}, 'initiation', {
        enumerable: true,
        get: inputGetter,
      }),
    };
    expect(() =>
      evaluateDeadlineEffect(definition(), record, p, clock),
    ).toThrow('Deadline inputs are not ready');
    expect(inputGetter).not.toHaveBeenCalled();
    expect(() =>
      evaluateDeadlineEffect(
        definition(),
        record,
        { facts: Object.create({ initiation: fact('2024-03-01') }) as unknown },
        clock,
      ),
    ).toThrow('Deadline inputs are not ready');
  });

  it('rejects a cyclic or excessively nested configuration before traversal', () => {
    const e: Record<string, unknown> = { ...definition().deadlineEffect };
    e.self = e;
    expect(() => validateDeadlineEffect(e)).toThrow();
    let deep: unknown = {};
    for (let i = 0; i < 15; i++) deep = { nested: deep };
    expect(() => validateDeadlineEffect(deep)).toThrow();
  });

  it('does not treat an inaccessible preserved deadline as a known null', () => {
    const d = { deadlineEffect: { mode: 'PRESERVE' } };
    expect(() => evaluateDeadlineEffect(d, {}, {})).toThrow(
      'Deadline inputs are not ready',
    );
    const getter = jest.fn(() => record.deadline);
    const protectedRecord = Object.defineProperty({}, 'deadline', {
      get: getter,
    });
    expect(() => evaluateDeadlineEffect(d, protectedRecord, {})).toThrow(
      'Deadline inputs are not ready',
    );
    expect(getter).not.toHaveBeenCalled();
  });
});
