import {
  assertTemplateLimits,
  DYN_REPORT_TEMPLATE_LIMITS,
  TemplateLimitError,
} from './limits';

/**
 * Two-tier limits (spec §10 R6). File-level hostile-xlsx-guard limits
 * (XLSX_LIMITS: 20 sheets, 100k rows/sheet) already ran before this —
 * HSLN's 17 sheets pass that tier. This is the SECOND, dynamic-reports-
 * specific tier that applies only after the author picks which sheets
 * become report sheets: ≤5 selected sheets, ≤50,000 total cells across
 * them, ≤5,000 input (unlocked-with-token) cells.
 */
function thrownCode(fn: () => void): string | undefined {
  try {
    fn();
    return undefined;
  } catch (e) {
    return e instanceof TemplateLimitError ? e.code : undefined;
  }
}

describe('assertTemplateLimits', () => {
  it('passes for a small template well under every limit', () => {
    expect(() =>
      assertTemplateLimits({
        selectedSheetCount: 2,
        totalCells: 500,
        inputCellCount: 33,
      }),
    ).not.toThrow();
  });

  it('rejects more than 5 selected sheets (HSLN has 17 — authors must narrow the selection)', () => {
    expect(
      thrownCode(() =>
        assertTemplateLimits({
          selectedSheetCount: 6,
          totalCells: 100,
          inputCellCount: 1,
        }),
      ),
    ).toBe('TOO_MANY_SELECTED_SHEETS');
  });

  it('allows exactly 5 selected sheets (boundary)', () => {
    expect(() =>
      assertTemplateLimits({
        selectedSheetCount: 5,
        totalCells: 100,
        inputCellCount: 1,
      }),
    ).not.toThrow();
  });

  it('rejects more than 50,000 total cells across selected sheets', () => {
    expect(
      thrownCode(() =>
        assertTemplateLimits({
          selectedSheetCount: 1,
          totalCells: 50_001,
          inputCellCount: 1,
        }),
      ),
    ).toBe('TOO_MANY_CELLS');
  });

  it('rejects more than 5,000 input cells', () => {
    expect(
      thrownCode(() =>
        assertTemplateLimits({
          selectedSheetCount: 1,
          totalCells: 100,
          inputCellCount: 5_001,
        }),
      ),
    ).toBe('TOO_MANY_INPUT_CELLS');
  });

  it('exposes the limit constants for the setup wizard to display', () => {
    expect(DYN_REPORT_TEMPLATE_LIMITS).toEqual({
      MAX_SELECTED_SHEETS: 5,
      MAX_TOTAL_CELLS: 50_000,
      MAX_INPUT_CELLS: 5_000,
    });
  });
});
