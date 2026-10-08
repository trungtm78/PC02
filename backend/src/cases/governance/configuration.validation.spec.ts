import {
  validateRuleDefinition,
  validateFieldDefinition,
  validateCustomValues,
} from './configuration.validation';
const source = {
  instrument: 'Synthetic instrument',
  provision: 'Article 1',
  url: 'https://example.test/law',
  authority: 'Reviewed authority',
  effectiveFrom: '2026-01-01',
};
describe('CG06 rules and runtime typed field schemas', () => {
  it('requires sources separately for every action', () => {
    expect(() =>
      validateRuleDefinition({
        actions: [{ code: 'CONCLUDE_INITIAL', legalSources: [source] }],
      }),
    ).not.toThrow();
    expect(() =>
      validateRuleDefinition({
        actions: [
          { code: 'CONCLUDE_INITIAL', legalSources: [source] },
          { code: 'SUSPEND_INITIAL' },
        ],
      }),
    ).toThrow();
    expect(() =>
      validateRuleDefinition({
        actions: [{ code: 'AUTOMATIC_DISCONTINUE', legalSources: [source] }],
      }),
    ).toThrow();
  });
  it('rejects source reference lacking specific provision/effective date', () => {
    for (const key of Object.keys(source))
      expect(() =>
        validateRuleDefinition({
          actions: [
            {
              code: 'CONCLUDE_INITIAL',
              legalSources: [{ ...source, [key]: '' }],
            },
          ],
        }),
      ).toThrow();
  });
  it('supports false/zero and enforces required/type/options without canonical hijack', () => {
    const d = {
      fields: [
        { key: 'custom_flag', label: 'Flag', type: 'boolean', required: true },
        { key: 'custom_count', label: 'Count', type: 'number', required: true },
        {
          key: 'custom_choice',
          label: 'Choice',
          type: 'select',
          required: false,
          options: ['a', 'b'],
        },
      ],
    };
    expect(() => validateFieldDefinition(d)).not.toThrow();
    expect(
      validateCustomValues(d, { custom_flag: false, custom_count: 0 }),
    ).toEqual({ custom_flag: false, custom_count: 0 });
    expect(() =>
      validateCustomValues(d, { custom_flag: 'false', custom_count: 0 }),
    ).toThrow();
    expect(() =>
      validateCustomValues(d, {
        custom_flag: false,
        custom_count: 0,
        custom_choice: 'c',
      }),
    ).toThrow();
    expect(() =>
      validateCustomValues(d, {
        custom_flag: false,
        custom_count: 0,
        status: 'DINH_CHI',
      }),
    ).toThrow();
    expect(() =>
      validateFieldDefinition({
        fields: [
          { key: 'status', label: 'Status', type: 'text', required: false },
        ],
      }),
    ).toThrow();
    expect(() =>
      validateFieldDefinition({
        fields: [
          { key: '__proto__', label: 'Unsafe', type: 'text', required: false },
        ],
      }),
    ).toThrow();
  });
});
