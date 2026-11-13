import * as ExcelJS from 'exceljs';
import { escapeXlsxCell } from '../../common/utils/xlsx-formula-escape.util';
import { aggregateValues } from '../engine/aggregate';
import { contributing, contributionsFor, obligated, owns } from '../aggregate/contributors';
import { sanitizeSheetName } from '../export-filename.util';

/**
 * The file a closed period is kept as.
 *
 * Sheet 1 "Tổng hợp": one row per criterion with the official total, how many teams delivered it out of how many owe
 * it, then one column per team. After it, one sheet per team with only the criteria that team reports.
 *
 * It is written as a plain list for every kind of report: the point of this file is to be read and filed, and a list
 * has the same shape whatever the template looks like. (The template-shaped export of a period still exists.)
 *
 * Everything is decided by the same helper the system's own totals use (`contributors.ts`), so the file cannot
 * disagree with the screen: a team is in a criterion's total only when it owns it and is approved.
 */
export const OFFICIAL_SUMMARY_SHEET = 'Tổng hợp';

const MISSING = 'thiếu';
const NOT_ASSIGNED = '—';
const NOT_APPROVED = 'chưa duyệt';
const EXEMPT = 'miễn nộp';
const MISSING_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
const MUTED_FONT: Partial<ExcelJS.Font> = { color: { argb: 'FF808080' } };

export interface OfficialWorkbookInput {
  reportName: string;
  periodKey: string;
  fields: Array<{
    fieldKey: string;
    label: string;
    code: string | null;
    unit: string | null;
    type: 'NUM' | 'TEXT' | 'DATE' | 'TIME';
    aggregate: Parameters<typeof aggregateValues>[0];
    blankPolicy: Parameters<typeof aggregateValues>[1];
  }>;
  /** In the order the columns and the sheets should appear. */
  teams: Array<{
    teamId: string;
    name: string;
    obligation: string;
    state: string;
    ownedFieldKeys: readonly string[] | null;
    values: Record<string, string | null | undefined>;
  }>;
}

/** A number Excel holds exactly (15 significant digits) is written as a number; anything else stays the text it is. */
function cellValue(raw: string | null | undefined): number | string | null {
  if (raw === null || raw === undefined || raw === '') return null;
  if (/^-?\d+(\.\d+)?$/.test(raw) && raw.replace(/[-.]/g, '').replace(/^0+/, '').length <= 15) return Number(raw);
  return escapeXlsxCell(raw);
}

function uniqueSheetNames(names: string[]): string[] {
  const taken = new Set<string>([OFFICIAL_SUMMARY_SHEET.toLowerCase()]);
  return names.map((name) => {
    const base = sanitizeSheetName(name);
    let candidate = base;
    for (let n = 2; taken.has(candidate.toLowerCase()); n += 1) {
      const suffix = ` (${n})`;
      candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
    }
    taken.add(candidate.toLowerCase());
    return candidate;
  });
}

/** The most criterion-by-team cells one file may hold: beyond it the workbook would not fit in memory safely. */
export const OFFICIAL_FILE_MAX_CELLS = 400_000;

export class OfficialFileTooLargeError extends Error {
  constructor(public readonly cells: number) {
    super(`OFFICIAL_FILE_TOO_LARGE: ${cells} cells, at most ${OFFICIAL_FILE_MAX_CELLS}`);
  }
}

export async function buildOfficialWorkbook(input: OfficialWorkbookInput): Promise<Buffer> {
  const cells = input.fields.length * Math.max(input.teams.length, 1);
  if (cells > OFFICIAL_FILE_MAX_CELLS) throw new OfficialFileTooLargeError(cells);

  // The shape `contributors.ts` reads: one row per team with its submission.
  const rows = input.teams.map((t) => ({
    id: t.teamId,
    obligation: t.obligation,
    ownedFieldKeys: t.ownedFieldKeys,
    submission: {
      state: t.state,
      values: Object.fromEntries(Object.entries(t.values).map(([k, v]) => [k, { v: v ?? null }])),
    },
  }));
  const filled = (teamIndex: number, fieldKey: string) => {
    const v = input.teams[teamIndex].values[fieldKey];
    return v !== null && v !== undefined && v !== '';
  };

  const workbook = new ExcelJS.Workbook();
  const title = (sheet: ExcelJS.Worksheet, sub: string) => {
    sheet.getCell('A1').value = escapeXlsxCell(input.reportName);
    sheet.getCell('A1').font = { bold: true, size: 13 };
    sheet.getCell('A2').value = escapeXlsxCell(`Kỳ ${input.periodKey} · ${sub}`);
    sheet.getRow(4).font = { bold: true };
    sheet.views = [{ state: 'frozen', ySplit: 4 }];
  };

  // ---- sheet 1: the summary
  const summary = workbook.addWorksheet(OFFICIAL_SUMMARY_SHEET);
  title(summary, 'Số liệu chính thức (các tổ đã duyệt)');
  summary.getRow(4).values = ['Mã', 'Tiêu chí', 'ĐVT', 'Tổng', 'Đã nhận/Phải nộp', '%', ...input.teams.map((t) => escapeXlsxCell(t.name))];
  summary.columns.forEach((column, i) => {
    column.width = i === 1 ? 50 : i < 6 ? 16 : 14;
  });

  input.fields.forEach((f, index) => {
    const r = 5 + index;
    const owing = rows.map((row) => obligated(row, f.fieldKey));
    const owed = owing.filter(Boolean).length;
    const received = rows.filter((row, i) => contributing(row, f.fieldKey, 'APPROVED') && filled(i, f.fieldKey)).length;
    // Always the engine's own answer (a COUNT nobody owes is 0, not blank): the same figure the closed snapshot holds.
    const total = aggregateValues(f.aggregate, f.blankPolicy, contributionsFor(rows, f.fieldKey, 'APPROVED')).value;

    const row = summary.getRow(r);
    row.getCell(1).value = escapeXlsxCell(f.code ?? '');
    row.getCell(2).value = escapeXlsxCell(f.label);
    row.getCell(3).value = escapeXlsxCell(f.unit ?? '');
    row.getCell(4).value = cellValue(total);
    row.getCell(5).value = `${received}/${owed}`;
    row.getCell(6).value = owed === 0 ? NOT_ASSIGNED : `${Math.round((received / owed) * 100)}%`;

    input.teams.forEach((team, i) => {
      const cell = row.getCell(7 + i);
      if (!owns(rows[i], f.fieldKey)) {
        cell.value = NOT_ASSIGNED;
        cell.font = MUTED_FONT;
      } else if (team.obligation === 'EXEMPT') {
        cell.value = EXEMPT;
        cell.font = MUTED_FONT;
      } else if (!contributing(rows[i], f.fieldKey, 'APPROVED')) {
        cell.value = NOT_APPROVED;
        cell.fill = MISSING_FILL;
      } else if (!filled(i, f.fieldKey)) {
        cell.value = MISSING;
        cell.fill = MISSING_FILL;
      } else {
        cell.value = cellValue(team.values[f.fieldKey]);
      }
    });
  });

  // ---- one sheet per team, with only what that team reports
  const sheetNames = uniqueSheetNames(input.teams.map((t) => t.name));
  input.teams.forEach((team, i) => {
    const sheet = workbook.addWorksheet(sheetNames[i]);
    title(sheet, escapeXlsxCell(team.name));
    sheet.getRow(4).values = ['Mã', 'Tiêu chí', 'ĐVT', 'Giá trị'];
    sheet.columns = [{ width: 10 }, { width: 50 }, { width: 12 }, { width: 18 }];
    let r = 5;
    for (const f of input.fields) {
      if (!owns(rows[i], f.fieldKey)) continue;
      sheet.getRow(r).values = [
        escapeXlsxCell(f.code ?? ''),
        escapeXlsxCell(f.label),
        escapeXlsxCell(f.unit ?? ''),
        cellValue(team.values[f.fieldKey]),
      ];
      r += 1;
    }
  });

  return Buffer.from((await workbook.xlsx.writeBuffer()) as ArrayBuffer);
}
