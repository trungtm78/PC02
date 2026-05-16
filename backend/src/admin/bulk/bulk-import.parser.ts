import * as ExcelJS from 'exceljs';

/**
 * Bulk import file parser (v0.25.0.0).
 *
 * - Hỗ trợ xlsx + csv (exceljs handles both)
 * - Header auto-detect flexible: tiếng Việt + English + diacritics-insensitive
 * - Formula sanitize: prefix `'` cho cell bắt đầu `[= + - @]` (Excel injection)
 * - Skip "Hướng dẫn" sheet — pick sheet đầu tiên có ≥2 header match (E7)
 *
 * Không dùng `xlsx` (SheetJS) vì CVE prototype pollution + ReDoS.
 */

export interface RawRow {
  rowIndex: number; // 1-based, theo file gốc
  fullName?: string | null;
  workId?: string | null;
  phone?: string | null;
  email?: string | null;
  username?: string | null;
  roleName?: string | null;
  departmentName?: string | null;
  position?: string | null;
}

export interface ParseResult {
  rows: RawRow[];
  sheetName: string;
  headerMapping: Record<string, string>; // raw header → mapped field
  warnings: string[];
}

const HEADER_MAP: Record<string, string[]> = {
  fullName: ['ho ten', 'ho va ten', 'fullname', 'full name', 'ho ten can bo', 'ten', 'name'],
  workId: ['so hieu', 'so hieu nganh', 'ma can bo', 'workid', 'work id', 'ma so', 'so hieu nganh ca'],
  phone: ['so dien thoai', 'sdt', 'phone', 'dien thoai', 'mobile', 'so dt'],
  email: ['email', 'thu dien tu', 'mail', 'thu'],
  username: ['username', 'tai khoan', 'ten dang nhap', 'tai khoan dang nhap'],
  roleName: ['vai tro', 'role', 'quyen', 'chuc danh'],
  departmentName: ['don vi', 'phong ban', 'department', 'to', 'to/doi', 'don vi cong tac', 'doi'],
  position: ['chuc vu', 'position', 'vi tri'],
};

const FORMULA_PREFIX_CHARS = ['=', '+', '-', '@', '\t', '\r'];

function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .trim();
}

function detectField(header: string): string | null {
  const norm = normalize(header);
  for (const [field, candidates] of Object.entries(HEADER_MAP)) {
    if (candidates.includes(norm)) return field;
    if (candidates.some((c) => norm === c || norm.startsWith(c + ' '))) return field;
  }
  return null;
}

/**
 * Sanitize cell value to prevent Excel formula injection (CVE-2014-3524 class).
 * Prefix `'` (apostrophe — Excel renders literal, không evaluate) cho cell
 * bắt đầu bằng `= + - @ \t \r`.
 */
export function sanitizeForExcel(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.length === 0) return '';
  if (FORMULA_PREFIX_CHARS.includes(str[0])) {
    return `'${str}`;
  }
  return str;
}

/**
 * Tìm sheet đầu tiên có ≥2 header match. Skip sheet "Hướng dẫn"/"Instructions".
 */
function pickDataSheet(wb: ExcelJS.Workbook): ExcelJS.Worksheet | null {
  for (const ws of wb.worksheets) {
    const nameNorm = normalize(ws.name);
    if (nameNorm.includes('huong dan') || nameNorm.includes('instruction')) continue;
    const row1 = ws.getRow(1);
    let matchCount = 0;
    row1.eachCell({ includeEmpty: false }, (cell) => {
      const val = cell.value;
      if (typeof val === 'string' && detectField(val)) matchCount++;
    });
    if (matchCount >= 2) return ws;
  }
  return null;
}

export async function parseBulkImportFile(
  buffer: Buffer,
  filename: string,
): Promise<ParseResult> {
  const wb = new ExcelJS.Workbook();
  const isCsv = filename.toLowerCase().endsWith('.csv');

  if (isCsv) {
    // ExcelJS CSV API uses stream — load from buffer via temp string parsing
    const stream = require('stream');
    const readable = new stream.Readable();
    readable.push(buffer);
    readable.push(null);
    await wb.csv.read(readable);
  } else {
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  }

  const sheet = pickDataSheet(wb);
  if (!sheet) {
    throw new Error(
      'Không tìm thấy sheet có header phù hợp. File phải có ≥2 cột: Họ tên, Số hiệu, SĐT, Email...',
    );
  }

  const warnings: string[] = [];
  const headerMapping: Record<string, string> = {};
  const columnFieldMap: Record<number, string> = {};

  const headerRow = sheet.getRow(1);
  headerRow.eachCell({ includeEmpty: false }, (cell, colIdx) => {
    const val = cell.value;
    if (typeof val !== 'string') return;
    const field = detectField(val);
    if (field) {
      if (Object.values(columnFieldMap).includes(field)) {
        warnings.push(`Cột "${val}" trùng field "${field}" — chỉ lấy cột đầu tiên`);
        return;
      }
      columnFieldMap[colIdx] = field;
      headerMapping[val] = field;
    } else {
      warnings.push(`Cột "${val}" không nhận diện được — bỏ qua`);
    }
  });

  const rows: RawRow[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const excelRow = sheet.getRow(r);
    if (!excelRow.hasValues) continue;
    const raw: RawRow = { rowIndex: r };
    let anyValue = false;
    for (const [colStr, field] of Object.entries(columnFieldMap)) {
      const colIdx = Number(colStr);
      const cell = excelRow.getCell(colIdx);
      let val: unknown = cell.value;
      // Handle ExcelJS rich text + formula objects
      if (typeof val === 'object' && val !== null) {
        if ('result' in val && val.result !== undefined) val = val.result;
        else if ('text' in val) val = (val as { text: string }).text;
        else if ('richText' in val && Array.isArray((val as { richText: { text: string }[] }).richText)) {
          val = (val as { richText: { text: string }[] }).richText.map((rt) => rt.text).join('');
        }
      }
      if (val === null || val === undefined || val === '') continue;
      const str = String(val).trim();
      if (str.length === 0) continue;
      anyValue = true;
      (raw as unknown as Record<string, unknown>)[field] = str;
    }
    if (anyValue) rows.push(raw);
  }

  return { rows, sheetName: sheet.name, headerMapping, warnings };
}

/**
 * Auto-split fullName VN convention: last word = firstName, rest = lastName.
 * "Hoàng Công Tùng" → firstName "Tùng", lastName "Hoàng Công"
 * "Trần Hùng" → firstName "Hùng", lastName "Trần"
 * "" → null/null
 */
export function splitFullName(fullName: string | null | undefined): {
  firstName: string | null;
  lastName: string | null;
} {
  if (!fullName) return { firstName: null, lastName: null };
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  const firstName = parts[parts.length - 1];
  const lastName = parts.slice(0, -1).join(' ');
  return { firstName, lastName };
}

/**
 * Normalize phone: strip whitespace/dash/dot. Validate shape ≥9 digits.
 */
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const cleaned = String(phone).replace(/[\s.\-()]/g, '');
  if (!/^\+?[0-9]{9,15}$/.test(cleaned)) return null;
  return cleaned;
}
