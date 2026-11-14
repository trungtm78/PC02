import * as ExcelJS from 'exceljs';
import { escapeXlsxCell } from '../../common/utils/xlsx-formula-escape.util';
import { sanitizeSheetName } from '../export-filename.util';
import { CUSTOM_REPORT_TEXT } from '../views/custom-report-text';
import type { CustomSummary, CustomSummaryCell } from '../views/custom-summary';
import { OFFICIAL_FILE_MAX_CELLS } from './official-workbook';

/**
 * The Excel file of a custom report: ONE sheet with the title, the line that says what is in it, the table
 * `Mã | Tiêu chí | ĐVT | Tổng` (+ one column per team), then the notes.
 *
 * It is written from the summary and from nothing else, so it shows what the preview shows. Plain values only: the
 * report's own template is not reused, because hiding rows of it would leave the headings' formulas adding up rows the
 * reader cannot see.
 */
export const CUSTOM_HEADER_ROW = 4;
/** The same ceiling as the official file: beyond it the workbook would not fit in memory safely. */
export const CUSTOM_FILE_MAX_CELLS = OFFICIAL_FILE_MAX_CELLS;

const FIXED_COLUMNS = 4;
const MUTED_FONT: Partial<ExcelJS.Font> = { color: { argb: 'FF808080' } };

export class CustomFileTooLargeError extends Error {
  constructor(public readonly cells: number) {
    super(`CUSTOM_REPORT_TOO_LARGE: ${cells} cells, at most ${CUSTOM_FILE_MAX_CELLS}`);
  }
}

/** A number Excel holds exactly (15 significant digits) is written as a number; anything else stays the text it is. */
function numberOrText(raw: string | null): number | string | null {
  if (raw === null || raw === '') return null;
  if (/^-?\d+(\.\d+)?$/.test(raw) && raw.replace(/[-.]/g, '').replace(/^0+/, '').length <= 15) return Number(raw);
  return escapeXlsxCell(raw);
}

export async function buildCustomWorkbook(summary: CustomSummary): Promise<Buffer> {
  const teamColumns = summary.columns.length - FIXED_COLUMNS;
  const cells = summary.rows.length * Math.max(teamColumns, 1);
  if (cells > CUSTOM_FILE_MAX_CELLS) throw new CustomFileTooLargeError(cells);

  const text = CUSTOM_REPORT_TEXT;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sanitizeSheetName(text.sheetName));

  sheet.getCell('A1').value = escapeXlsxCell(summary.title);
  sheet.getCell('A1').font = { bold: true, size: 13 };
  if (summary.filterLine !== null) {
    sheet.getCell('A2').value = escapeXlsxCell(summary.filterLine);
    sheet.getCell('A2').font = { italic: true };
  }

  const header = sheet.getRow(CUSTOM_HEADER_ROW);
  header.values = summary.columns.map((c) => escapeXlsxCell(c.label));
  header.font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: CUSTOM_HEADER_ROW }];
  summary.columns.forEach((_, i) => {
    sheet.getColumn(i + 1).width = i === 1 ? 50 : i < FIXED_COLUMNS ? 14 : 16;
  });

  const teamCell = (cell: ExcelJS.Cell, value: CustomSummaryCell, numeric: boolean) => {
    if (value.mark !== null) {
      cell.value = text.cellMark(value.mark, summary.mode);
      cell.font = MUTED_FONT;
      return;
    }
    cell.value = numeric ? numberOrText(value.value) : escapeXlsxCell(value.value);
  };

  summary.rows.forEach((row, index) => {
    const r = sheet.getRow(CUSTOM_HEADER_ROW + 1 + index);
    r.getCell(1).value = escapeXlsxCell(row.code ?? '');
    r.getCell(2).value = escapeXlsxCell(row.label);
    r.getCell(2).alignment = { indent: row.depth, wrapText: true, vertical: 'top' };
    r.getCell(3).value = escapeXlsxCell(row.unit ?? '');
    r.getCell(4).value = numberOrText(row.total);
    row.cells.forEach((value, i) => teamCell(r.getCell(FIXED_COLUMNS + 1 + i), value, row.type === 'NUM'));
    if (row.kind === 'GROUP') r.font = { bold: true };
  });

  if (summary.notes.length > 0) {
    // One empty row under the table, then the notes, each on its own row.
    let r = CUSTOM_HEADER_ROW + summary.rows.length + 2;
    sheet.getCell(r, 1).value = text.noteHeading;
    sheet.getCell(r, 1).font = { bold: true };
    for (const note of summary.notes) {
      r += 1;
      sheet.getCell(r, 1).value = escapeXlsxCell(`• ${text.note(note)}`);
      sheet.getCell(r, 1).font = { italic: true };
    }
  }

  return Buffer.from((await workbook.xlsx.writeBuffer()) as ArrayBuffer);
}
