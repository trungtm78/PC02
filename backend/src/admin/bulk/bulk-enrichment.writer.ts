import * as ExcelJS from 'exceljs';
import { sanitizeForExcel } from './bulk-import.parser';

export interface RowOutcome {
  rowIndex: number;
  userId?: string;
  enrollmentUrl?: string;
  expiresAt?: Date | string;
  error?: string;
}

/**
 * Load original xlsx/csv buffer → append 2 cột `Link đăng ký` + `Hết hạn`
 * → return Buffer.
 *
 * Per autoplan Eng E8: KHÔNG promise styling preservation. Preserve column
 * values + thêm 2 cột mới. User formatting (conditional format, drawing,
 * comment) có thể mất.
 *
 * E2 security: sanitize cell value (Excel formula injection prevention).
 */
export async function buildEnrichedFile(
  originalBuffer: Buffer,
  outcomes: RowOutcome[],
  format: 'xlsx' | 'csv',
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();

  if (format === 'csv') {
    const stream = require('stream');
    const readable = new stream.Readable();
    readable.push(originalBuffer);
    readable.push(null);
    await wb.csv.read(readable);
  } else {
    await wb.xlsx.load(originalBuffer as unknown as ArrayBuffer);
  }

  // Pick sheet đầu tiên có data (skip "Hướng dẫn")
  let dataSheet: ExcelJS.Worksheet | null = null;
  for (const ws of wb.worksheets) {
    const name = ws.name.toLowerCase();
    if (name.includes('hướng dẫn') || name.includes('huong dan') || name.includes('instruction'))
      continue;
    dataSheet = ws;
    break;
  }
  if (!dataSheet) dataSheet = wb.worksheets[0];

  // Find next free column for "Link đăng ký" + "Hết hạn"
  const headerRow = dataSheet.getRow(1);
  let lastCol = 1;
  headerRow.eachCell({ includeEmpty: false }, (_cell, colIdx) => {
    if (colIdx > lastCol) lastCol = colIdx;
  });
  const linkCol = lastCol + 1;
  const expiryCol = lastCol + 2;

  headerRow.getCell(linkCol).value = 'Link đăng ký';
  headerRow.getCell(expiryCol).value = 'Hết hạn';
  headerRow.commit();

  // Index outcomes by rowIndex (1-based, theo file gốc)
  const byIndex = new Map<number, RowOutcome>();
  for (const o of outcomes) byIndex.set(o.rowIndex, o);

  for (const [rowIdx, outcome] of byIndex) {
    const row = dataSheet.getRow(rowIdx);
    if (outcome.error) {
      row.getCell(linkCol).value = sanitizeForExcel(`[LỖI: ${outcome.error}]`);
      row.getCell(expiryCol).value = '';
    } else if (outcome.enrollmentUrl) {
      row.getCell(linkCol).value = sanitizeForExcel(outcome.enrollmentUrl);
      const expiry =
        outcome.expiresAt instanceof Date ? outcome.expiresAt : new Date(outcome.expiresAt ?? Date.now());
      row.getCell(expiryCol).value = sanitizeForExcel(
        expiry.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }),
      );
    }
    row.commit();
  }

  if (format === 'csv') {
    return Buffer.from(await wb.csv.writeBuffer());
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
