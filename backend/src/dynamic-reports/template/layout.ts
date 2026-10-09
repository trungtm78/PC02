import * as ExcelJS from 'exceljs';

/**
 * Layout extraction (spec §4.1 template-parser row). Structural facts only
 * — see layout.spec.ts header for the scope decision on why per-cell
 * visual style (font/border/fill/numFmt) is not pre-extracted here.
 */
export interface UsedRange {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export interface FreezePane {
  xSplit: number;
  ySplit: number;
  topLeftCell: string;
}

export interface SheetLayout {
  sheetKey: string;
  state: 'visible' | 'hidden' | 'veryHidden';
  usedRange: UsedRange | null;
  merges: string[];
  columnWidths: Record<number, number>;
  rowHeights: Record<number, number>;
  freeze: FreezePane | null;
  printArea: string | null;
}

export interface Layout {
  sheetOrder: string[];
  sheets: SheetLayout[];
}

interface DimensionsModel extends UsedRange {
  readonly top: number;
}

function extractUsedRange(sheet: ExcelJS.Worksheet): UsedRange | null {
  const dims = (
    sheet.dimensions as unknown as { model?: DimensionsModel } | null
  )?.model;
  if (!dims || dims.right === 0 || dims.bottom === 0) return null;
  return {
    top: dims.top,
    left: dims.left,
    bottom: dims.bottom,
    right: dims.right,
  };
}

function extractMerges(sheet: ExcelJS.Worksheet): string[] {
  const model = (sheet as unknown as { model: { merges?: string[] } }).model;
  return model.merges ?? [];
}

function extractColumnWidths(sheet: ExcelJS.Worksheet): Record<number, number> {
  const widths: Record<number, number> = {};
  sheet.columns?.forEach((column, index) => {
    if (typeof column.width === 'number') widths[index + 1] = column.width;
  });
  return widths;
}

function extractRowHeights(sheet: ExcelJS.Worksheet): Record<number, number> {
  const heights: Record<number, number> = {};
  sheet.eachRow({ includeEmpty: true }, (row, rowNumber) => {
    if (typeof row.height === 'number') heights[rowNumber] = row.height;
  });
  return heights;
}

function extractFreeze(sheet: ExcelJS.Worksheet): FreezePane | null {
  const view = sheet.views?.[0] as
    | { state?: string; xSplit?: number; ySplit?: number; topLeftCell?: string }
    | undefined;
  if (!view || view.state !== 'frozen') return null;
  return {
    xSplit: view.xSplit ?? 0,
    ySplit: view.ySplit ?? 0,
    topLeftCell: view.topLeftCell ?? 'A1',
  };
}

export function extractLayout(
  workbook: ExcelJS.Workbook,
  selectedSheetNames: string[],
): Layout {
  const sheets: SheetLayout[] = [];
  for (const sheetName of selectedSheetNames) {
    const sheet = workbook.getWorksheet(sheetName);
    if (!sheet) continue;

    sheets.push({
      sheetKey: sheetName,
      state: sheet.state as SheetLayout['state'],
      usedRange: extractUsedRange(sheet),
      merges: extractMerges(sheet),
      columnWidths: extractColumnWidths(sheet),
      rowHeights: extractRowHeights(sheet),
      freeze: extractFreeze(sheet),
      printArea: sheet.pageSetup?.printArea ?? null,
    });
  }

  return { sheetOrder: selectedSheetNames, sheets };
}
