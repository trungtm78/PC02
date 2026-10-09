import { suggestValidationRules } from './suggest-rules';

/**
 * Validation-rule suggestion (spec §10 PR3 checklist: "gợi ý validation
 * rule từ IF(a=b,TRUE,FALSE)"). Legacy BCA templates encode a cross-check
 * as `=IF(D10=D11+D12,TRUE,FALSE)` — this is a MANUAL check the author
 * wrote directly into the sheet, not a DynReportValidationRule row.
 * Detecting the pattern lets the wizard offer "turn this into a real
 * validation rule" instead of leaving it as an inert static formula cell.
 */
describe('suggestValidationRules', () => {
  it('suggests a rule from IF(a=b,TRUE,FALSE)', () => {
    const suggestions = suggestValidationRules([
      {
        sheetKey: 'Sheet1',
        address: 'E5',
        expression: 'IF(D10=D11+D12,TRUE,FALSE)',
      },
    ]);
    expect(suggestions).toEqual([
      {
        sheetKey: 'Sheet1',
        address: 'E5',
        leftExpr: 'D10',
        operator: 'EQUAL',
        rightExpr: 'D11+D12',
      },
    ]);
  });

  it('is insensitive to whitespace around the comparison and the TRUE/FALSE literals', () => {
    const suggestions = suggestValidationRules([
      {
        sheetKey: 'Sheet1',
        address: 'E5',
        expression: 'IF( D10 = D11+D12 , TRUE , FALSE )',
      },
    ]);
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].leftExpr).toBe('D10');
    expect(suggestions[0].rightExpr).toBe('D11+D12');
  });

  it('ignores a formula that is not an IF(...,TRUE,FALSE) shape', () => {
    const suggestions = suggestValidationRules([
      { sheetKey: 'Sheet1', address: 'E5', expression: 'SUM(D10:D12)' },
      {
        sheetKey: 'Sheet1',
        address: 'E6',
        expression: 'IF(D10>D11,"Lỗi","OK")',
      },
    ]);
    expect(suggestions).toHaveLength(0);
  });

  it('can report more than one suggestion across different formula cells', () => {
    const suggestions = suggestValidationRules([
      {
        sheetKey: 'Sheet1',
        address: 'E5',
        expression: 'IF(D10=D11+D12,TRUE,FALSE)',
      },
      {
        sheetKey: 'Sheet1',
        address: 'E6',
        expression: 'IF(D20=D21+D22,TRUE,FALSE)',
      },
    ]);
    expect(suggestions).toHaveLength(2);
  });

  it('returns an empty array for an empty formula list', () => {
    expect(suggestValidationRules([])).toEqual([]);
  });
});
