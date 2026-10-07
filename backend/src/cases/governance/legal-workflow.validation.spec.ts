import {
  civilDate,
  validateDecision,
  validateCondition,
  evaluateCondition,
} from './legal-workflow.validation';
describe('CG05 complete dates and CG06 declarative conditions', () => {
  it('complete-looking OCR/estimated date facts remain insufficient for a committed decision', () => {
    const d = {
      type: 'CONCLUSION',
      number: '1',
      date: '2026-10-01',
      effectiveDate: '2026-10-02',
      issuer: 'Authority',
      signatory: 'Signer',
      legalBasis: 'Provision',
      sourceDocumentId: 'doc',
    };
    for (const quality of [
      'EXTRACTED_ONLY',
      'OCR_ONLY',
      'PARTIAL',
      'ESTIMATED',
      'INFERRED',
    ])
      expect(() => validateDecision({ ...d, dateQuality: quality })).toThrow();
  });
  it('accepts actual leap date without using server now', () =>
    expect(civilDate('2024-02-29').toISOString()).toBe(
      '2024-02-29T00:00:00.000Z',
    ));
  it.each([
    '2023-02-29',
    '2026-04-31',
    '2026-02',
    '2026',
    '2026-10-06T00:00:00Z',
    '0000-01-01',
    '',
  ])('rejects incomplete/impossible civil date %s', (date) =>
    expect(() => civilDate(date)).toThrow(),
  );
  it('requires effective date and nonblank signed decision facts', () => {
    const d = {
      type: 'CONCLUSION',
      number: '01',
      date: '2026-10-01',
      effectiveDate: '2026-10-02',
      issuer: 'Competent authority',
      signatory: 'Signer',
      legalBasis: 'Reviewed provision',
      sourceDocumentId: 'doc',
    };
    expect(validateDecision(d)).toMatchObject({
      number: '01',
      date: new Date('2026-10-01'),
    });
    for (const key of Object.keys(d))
      expect(() => validateDecision({ ...d, [key]: ' ' })).toThrow();
  });
  it('supports all/any safe own-property facts, preserving zero/false', () => {
    const c = {
      all: [
        { path: 'case.count', op: 'eq', value: 0 },
        { any: [{ path: 'payload.confirmed', op: 'eq', value: false }] },
      ],
    };
    expect(() => validateCondition(c)).not.toThrow();
    expect(
      evaluateCondition(c, {
        case: { count: 0 },
        payload: { confirmed: false },
      }),
    ).toBe(true);
    expect(
      evaluateCondition(c, { case: {}, payload: { confirmed: false } }),
    ).toBe(false);
  });
  it.each([
    { path: 'case.__proto__.admin', op: 'eq', value: true },
    { path: 'case.status', op: 'sql', value: 'DROP' },
    { eval: 'true' },
    { all: [] },
  ])('rejects unsafe or unsupported grammar', (c) =>
    expect(() => validateCondition(c)).toThrow(),
  );
  it('never reads inherited properties', () =>
    expect(
      evaluateCondition(
        { path: 'case.status', op: 'eq', value: 'DANG_DIEU_TRA' },
        { case: Object.create({ status: 'DANG_DIEU_TRA' }) },
      ),
    ).toBe(false));
});
