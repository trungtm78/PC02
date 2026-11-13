import * as ExcelJS from 'exceljs';
import { escapeXlsxCell } from '../../common/utils/xlsx-formula-escape.util';

/**
 * The criteria each team reports, as an Excel sheet the author can edit and send back: one row per criterion, one
 * column per team, a mark where the team reports it.
 *
 * The sheet identifies its rows and columns by machine keys kept in a hidden column (the criterion's item key) and a
 * hidden row (the team id), never by the visible names: a renamed team or a retyped criterion name cannot send a mark
 * to the wrong place.
 */
export const MATRIX_MARK = 'x';
export const MATRIX_SHEET = 'Ma trận';
const SIGNATURE = 'PC02_CRITERIA_MATRIX';
const KEY_ROW = 1;
const HEADER_ROW = 3;
const FIRST_DATA_ROW = 4;
const FIRST_TEAM_COLUMN = 4;

export interface MatrixCriterion {
  itemKey: string;
  code: string | null;
  label: string;
}
export interface MatrixTeam {
  teamId: string;
  name: string;
  /** The criteria the team reports now; null = every criterion. */
  itemKeys: readonly string[] | null;
}
export type MatrixError =
  | { code: 'MATRIX_NOT_RECOGNISED' }
  | { code: 'MATRIX_CRITERION_UNKNOWN'; row: number }
  | { code: 'MATRIX_CRITERION_MISSING'; itemKey: string }
  | { code: 'MATRIX_TEAM_UNKNOWN'; column: string }
  | { code: 'MATRIX_TEAM_MISSING'; teamId: string; name: string }
  | { code: 'MATRIX_TEAM_EMPTY'; teamId: string; name: string };

export interface MatrixTeamResult {
  teamId: string;
  name: string;
  /** What the file says the team reports; null = every criterion. */
  itemKeys: string[] | null;
  added: string[];
  removed: string[];
}

const text = (value: ExcelJS.CellValue): string => (value === null || value === undefined ? '' : String(value).trim());

export async function buildCriteriaMatrix(
  criteria: readonly MatrixCriterion[],
  teams: readonly MatrixTeam[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(MATRIX_SHEET);
  sheet.getCell(KEY_ROW, 1).value = SIGNATURE;
  sheet.getRow(KEY_ROW).hidden = true;
  sheet.getColumn(1).hidden = true;
  sheet.getCell(2, 2).value = `Đánh dấu "${MATRIX_MARK}" vào ô của tổ phải báo tiêu chí đó. Không sửa hàng và cột bị ẩn.`;
  sheet.getRow(HEADER_ROW).font = { bold: true };
  sheet.getCell(HEADER_ROW, 2).value = 'Mã';
  sheet.getCell(HEADER_ROW, 3).value = 'Tiêu chí';
  sheet.getColumn(2).width = 10;
  sheet.getColumn(3).width = 50;
  teams.forEach((team, i) => {
    const column = FIRST_TEAM_COLUMN + i;
    sheet.getCell(KEY_ROW, column).value = team.teamId;
    sheet.getCell(HEADER_ROW, column).value = escapeXlsxCell(team.name);
    sheet.getColumn(column).width = 16;
  });
  criteria.forEach((criterion, r) => {
    const row = FIRST_DATA_ROW + r;
    sheet.getCell(row, 1).value = criterion.itemKey;
    sheet.getCell(row, 2).value = escapeXlsxCell(criterion.code ?? '');
    sheet.getCell(row, 3).value = escapeXlsxCell(criterion.label);
    teams.forEach((team, i) => {
      if (team.itemKeys === null || team.itemKeys.includes(criterion.itemKey)) {
        const cell = sheet.getCell(row, FIRST_TEAM_COLUMN + i);
        cell.value = MATRIX_MARK;
        cell.alignment = { horizontal: 'center' };
      }
    });
  });
  sheet.views = [{ state: 'frozen', xSplit: 3, ySplit: HEADER_ROW }];
  return Buffer.from((await workbook.xlsx.writeBuffer()) as ArrayBuffer);
}

/**
 * Reads a matrix back against the report as it is NOW. Every criterion and every team of the report must be in the
 * file, and nothing else: a file made for another report, or before a team or criterion was added, is refused with
 * what is wrong instead of being applied to whatever happens to match.
 */
export async function parseCriteriaMatrix(
  buffer: Buffer,
  criteria: readonly MatrixCriterion[],
  teams: readonly MatrixTeam[],
): Promise<{ teams: MatrixTeamResult[]; errors: MatrixError[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);
  const sheet = workbook.getWorksheet(MATRIX_SHEET) ?? workbook.worksheets[0];
  if (!sheet || text(sheet.getCell(KEY_ROW, 1).value) !== SIGNATURE) {
    return { teams: [], errors: [{ code: 'MATRIX_NOT_RECOGNISED' }] };
  }

  const errors: MatrixError[] = [];
  const knownCriteria = new Set(criteria.map((c) => c.itemKey));
  const teamById = new Map(teams.map((t) => [t.teamId, t]));

  const columnOf = new Map<string, number>();
  for (let column = FIRST_TEAM_COLUMN; column <= sheet.columnCount; column += 1) {
    const teamId = text(sheet.getCell(KEY_ROW, column).value);
    if (!teamId) continue;
    if (!teamById.has(teamId)) errors.push({ code: 'MATRIX_TEAM_UNKNOWN', column: sheet.getColumn(column).letter });
    else columnOf.set(teamId, column);
  }
  for (const team of teams) {
    if (!columnOf.has(team.teamId)) errors.push({ code: 'MATRIX_TEAM_MISSING', teamId: team.teamId, name: team.name });
  }

  const rowOf = new Map<string, number>();
  for (let row = FIRST_DATA_ROW; row <= sheet.rowCount; row += 1) {
    const itemKey = text(sheet.getCell(row, 1).value);
    if (!itemKey) continue;
    if (!knownCriteria.has(itemKey)) errors.push({ code: 'MATRIX_CRITERION_UNKNOWN', row });
    else rowOf.set(itemKey, row);
  }
  for (const criterion of criteria) {
    if (!rowOf.has(criterion.itemKey)) errors.push({ code: 'MATRIX_CRITERION_MISSING', itemKey: criterion.itemKey });
  }
  if (errors.length > 0) return { teams: [], errors };

  const results = teams.map((team): MatrixTeamResult => {
    const column = columnOf.get(team.teamId) as number;
    const marked = criteria
      .filter((c) => text(sheet.getCell(rowOf.get(c.itemKey) as number, column).value) !== '')
      .map((c) => c.itemKey);
    const before = team.itemKeys === null ? criteria.map((c) => c.itemKey) : team.itemKeys;
    if (marked.length === 0) errors.push({ code: 'MATRIX_TEAM_EMPTY', teamId: team.teamId, name: team.name });
    return {
      teamId: team.teamId,
      name: team.name,
      itemKeys: marked.length === criteria.length ? null : marked,
      added: marked.filter((k) => !before.includes(k)),
      removed: before.filter((k) => !marked.includes(k)),
    };
  });
  return errors.length > 0 ? { teams: [], errors } : { teams: results, errors };
}
