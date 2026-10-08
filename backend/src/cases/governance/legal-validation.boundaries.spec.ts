import {
  validateRuleDefinition,
  validateFieldDefinition,
  validateCustomValues,
} from './configuration.validation';
import {
  civilDate,
  object,
  validateCondition,
  evaluateCondition,
  nonblank,
} from './legal-workflow.validation';
import { planLegalAction } from './legal-action.validation';
const source = {
  instrument: 'Synthetic',
  provision: '1',
  url: 'https://example.test',
  authority: 'Authority',
  effectiveFrom: '2026-01-01',
};
const decision = {
  type: 'SYNTHETIC',
  number: '1',
  date: '2026-10-01',
  effectiveDate: '2026-10-02',
  issuer: 'Authority',
  signatory: 'Signer',
  legalBasis: 'Provision',
  sourceDocumentId: 'doc',
};
describe('CG04/05/06 malformed authority/definition/date boundaries', () => {
  it.each([
    null,
    {},
    [],
    { actions: [] },
    {
      actions: [
        { code: 'CONCLUDE_INITIAL', unknown: true, legalSources: [source] },
      ],
    },
    {
      actions: [
        {
          code: 'CONCLUDE_INITIAL',
          deadlineAlgorithmId: 'EVAL',
          legalSources: [source],
        },
      ],
    },
    {
      actions: [
        {
          code: 'CONCLUDE_INITIAL',
          requiredFields: ['unsafe'],
          legalSources: [source],
        },
      ],
    },
    {
      actions: [
        {
          code: 'CONCLUDE_INITIAL',
          legalSources: [{ ...source, url: 'http://insecure.test' }],
        },
      ],
    },
    {
      actions: [
        {
          code: 'CONCLUDE_INITIAL',
          legalSources: [{ ...source, effectiveTo: '2025-01-01' }],
        },
      ],
    },
    {
      actions: [
        { code: 'CONCLUDE_INITIAL', legalSources: [source] },
        { code: 'CONCLUDE_INITIAL', legalSources: [source] },
      ],
    },
  ])('rejects malformed rule publication %#', (rule) =>
    expect(() => validateRuleDefinition(rule)).toThrow(),
  );
  it('validates supported Case type allowlists and immutable source effective boundary', () => {
    expect(() =>
      validateRuleDefinition({
        actions: [
          {
            code: 'SPLIT_CASE',
            allowedCaseTypes: ['REGULAR', 'UY_THAC_DIEU_TRA'],
            legalSources: [source],
          },
        ],
      }),
    ).not.toThrow();
    expect(() =>
      validateRuleDefinition({
        actions: [
          {
            code: 'SPLIT_CASE',
            allowedCaseTypes: ['ADMIN'],
            legalSources: [source],
          },
        ],
      }),
    ).toThrow();
  });
  it.each([
    {
      fields: [{ key: 'custom_a', label: 'A', type: 'eval', required: false }],
    },
    {
      fields: [
        { key: 'custom_a', label: 'A', type: 'text', required: 'false' },
      ],
    },
    {
      fields: [
        {
          key: 'custom_a',
          label: 'A',
          type: 'number',
          required: false,
          options: ['wrong'],
        },
      ],
    },
    {
      fields: [
        {
          key: 'custom_a',
          label: 'A',
          type: 'select',
          required: false,
          options: ['x', 'x'],
        },
      ],
    },
    {
      fields: [
        {
          key: 'custom_a',
          label: 'A',
          type: 'text',
          required: false,
          sensitivity: 'SECRET',
        },
      ],
    },
    {
      fields: [
        { key: 'custom_a', label: 'A', type: 'text', required: false, tab: '' },
      ],
    },
    {
      fields: [
        { key: 'custom_a', label: 'A', type: 'text', required: false },
        { key: 'custom_a', label: 'B', type: 'text', required: false },
      ],
    },
    {
      fields: [
        {
          key: 'custom_a',
          label: 'A',
          type: 'text',
          required: false,
          actorId: 'forged',
        },
      ],
    },
  ])('rejects unsafe typed field schema %#', (d) =>
    expect(() => validateFieldDefinition(d)).toThrow(),
  );
  it('enforces actual typed values and explicit required nulls', () => {
    for (const [type, value] of [
      ['text', 1],
      ['textarea', false],
      ['number', '0'],
      ['number', Infinity],
      ['date', '2026-02-30'],
      ['boolean', 0],
    ])
      expect(() =>
        validateCustomValues(
          {
            fields: [
              { key: 'custom_value', label: 'Value', type, required: true },
            ],
          },
          { custom_value: value },
        ),
      ).toThrow();
    expect(() =>
      validateCustomValues(
        {
          fields: [
            {
              key: 'custom_value',
              label: 'Value',
              type: 'text',
              required: true,
            },
          ],
        },
        { custom_value: null },
      ),
    ).toThrow();
    expect(
      validateCustomValues(
        {
          fields: [
            {
              key: 'custom_value',
              label: 'Value',
              type: 'date',
              required: false,
            },
          ],
        },
        { custom_value: null },
      ),
    ).toEqual({ custom_value: null });
  });
  it.each([
    { path: 'case.count', op: 'exists', value: 'yes' },
    { path: 'case.count', op: 'in', value: [] },
    { path: 'case.count', op: 'in', value: [{}] },
    { path: 'case.count', op: 'eq', value: {} },
    { path: 'case..count', op: 'eq', value: 0 },
  ])('rejects malformed declarative operator %#', (c) =>
    expect(() => validateCondition(c)).toThrow(),
  );
  it('exists/in conditions preserve zero and reject missing own property', () => {
    expect(
      evaluateCondition(
        { path: 'case.value', op: 'exists', value: true },
        { case: { value: 0 } },
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { path: 'case.value', op: 'in', value: [0, false] },
        { case: { value: false } },
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { path: 'case.value', op: 'exists', value: false },
        { case: {} },
      ),
    ).toBe(true);
    expect(() => object([])).toThrow();
    expect(() => nonblank(' '.repeat(10001), 'number')).toThrow();
    expect(() => civilDate(null)).toThrow();
  });
  it.each([
    'SPLIT_CASE',
    'CORRECT_DECISION',
    'LINK_RELATED',
    'LINK_SOURCE',
    'CLASSIFY_SENSITIVITY',
  ])('validates supplementary action explicit facts %s', (code) => {
    const payload = {
      decision,
      newCase: { name: 'New' },
      correctedDecisionId: 'original',
      targetCaseId: 'target',
      sourceType: 'INCIDENT',
      sourceId: 'existing',
      sensitivity: 'RESTRICTED',
      reason: 'Reviewed',
      inspectionPurpose: 'Authority review',
    };
    expect(
      planLegalAction(
        code,
        { status: 'DANG_DIEU_TRA', investigationPhase: 'INITIAL' },
        payload,
      ).status,
    ).toBe('DANG_DIEU_TRA');
  });
  it('unknown/source-kind/classification facts never manufacture legal progress', () => {
    for (const [code, payload] of [
      ['UNREGISTERED', { decision }],
      ['LINK_SOURCE', { decision, sourceType: 'OTHER', sourceId: 'id' }],
      [
        'CLASSIFY_SENSITIVITY',
        {
          decision,
          sensitivity: 'UNKNOWN',
          reason: 'why',
          inspectionPurpose: 'why',
        },
      ],
    ])
      expect(() =>
        planLegalAction(
          code as string,
          { status: 'DANG_DIEU_TRA', investigationPhase: null },
          payload,
        ),
      ).toThrow();
  });
});
