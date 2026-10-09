/**
 * Second tier of the two-tier limits (spec §10 R6). The first tier is the
 * generic hostile-xlsx-guard `assertWorkbookLimits` (file-wide: ≤20 sheets,
 * ≤100k rows/sheet) — generous enough that HSLN's 17 sheets upload fine.
 * This tier applies only AFTER the author picks which sheets become report
 * sheets, since a real report template is much smaller than the workbook
 * it was cut from.
 */
export const DYN_REPORT_TEMPLATE_LIMITS = {
  MAX_SELECTED_SHEETS: 5,
  MAX_TOTAL_CELLS: 50_000,
  MAX_INPUT_CELLS: 5_000,
} as const;

export class TemplateLimitError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'TemplateLimitError';
  }
}

export interface TemplateLimitInput {
  selectedSheetCount: number;
  totalCells: number;
  inputCellCount: number;
}

export function assertTemplateLimits(input: TemplateLimitInput): void {
  if (
    input.selectedSheetCount > DYN_REPORT_TEMPLATE_LIMITS.MAX_SELECTED_SHEETS
  ) {
    throw new TemplateLimitError(
      `Số sheet chọn làm mẫu (${input.selectedSheetCount}) vượt giới hạn ${DYN_REPORT_TEMPLATE_LIMITS.MAX_SELECTED_SHEETS}.`,
      'TOO_MANY_SELECTED_SHEETS',
    );
  }
  if (input.totalCells > DYN_REPORT_TEMPLATE_LIMITS.MAX_TOTAL_CELLS) {
    throw new TemplateLimitError(
      `Tổng số ô trong các sheet đã chọn (${input.totalCells}) vượt giới hạn ${DYN_REPORT_TEMPLATE_LIMITS.MAX_TOTAL_CELLS}.`,
      'TOO_MANY_CELLS',
    );
  }
  if (input.inputCellCount > DYN_REPORT_TEMPLATE_LIMITS.MAX_INPUT_CELLS) {
    throw new TemplateLimitError(
      `Số ô nhập (${input.inputCellCount}) vượt giới hạn ${DYN_REPORT_TEMPLATE_LIMITS.MAX_INPUT_CELLS}.`,
      'TOO_MANY_INPUT_CELLS',
    );
  }
}
