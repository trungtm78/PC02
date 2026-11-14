import * as ExcelJS from 'exceljs';
import { escapeXlsxCell } from '../../common/utils/xlsx-formula-escape.util';
import { assertMagicBytes, assertNoZipBomb, HostileXlsxError } from '../../xlsx-imports/hostile-xlsx-guard';

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
/** In the hidden key row: the revision of the configuration the file was taken out at. */
const VERSION_COLUMN = 2;
const HEADER_ROW = 3;
const FIRST_DATA_ROW = 4;
const FIRST_TEAM_COLUMN = 4;
/** A matrix is a small sheet: what it may unpack to, and how far it is scanned. */
export const MATRIX_LIMITS = {
  MAX_UNCOMPRESSED_BYTES: 30 * 1024 * 1024,
  MAX_ROWS: 6000,
  MAX_COLUMNS: 2000,
} as const;

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
  | { code: 'MATRIX_TOO_LARGE' }
  | { code: 'MATRIX_VERSION_MISSING' }
  | { code: 'MATRIX_CRITERION_DUPLICATE'; row: number }
  | { code: 'MATRIX_TEAM_DUPLICATE'; column: string }
  | { code: 'MATRIX_CELL_NOT_PLAIN'; cell: string }
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

/**
 * What a cell says, as plain text. Rich text is its runs joined; a formula, an error or any other object has no
 * plain text here (`null`): the caller decides whether that is an error (a mark) or simply not a key.
 */
function plain(value: ExcelJS.CellValue): string | null {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  if (typeof value === 'object' && 'richText' in value && Array.isArray(value.richText)) {
    return value.richText.map((run) => run.text ?? '').join('').trim();
  }
  return null;
}
const text = (value: ExcelJS.CellValue): string => plain(value) ?? '';

export async function buildCriteriaMatrix(
  criteria: readonly MatrixCriterion[],
  teams: readonly MatrixTeam[],
  /** The revision of the report's configuration these marks were read at: an import is only taken against it. */
  configVersion: number,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(MATRIX_SHEET);
  sheet.getCell(KEY_ROW, 1).value = SIGNATURE;
  sheet.getCell(KEY_ROW, VERSION_COLUMN).value = configVersion;
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

export interface ParsedMatrix {
  teams: MatrixTeamResult[];
  errors: MatrixError[];
  /**
   * The revision of the configuration the file was taken out at; null when the file carries none (taken out by a
   * build that did not write it, or the cell was emptied). The caller refuses a file that is not of the revision the
   * report has now: applying it would put back what somebody else has changed since.
   */
  configVersion: number | null;
}

const refused = (errors: MatrixError[]): ParsedMatrix => ({ teams: [], errors, configVersion: null });

/** A whole number, written as a number or as its digits; anything else is "no revision". */
function revisionOf(value: ExcelJS.CellValue): number | null {
  const raw = plain(value);
  if (raw === null || !/^\d{1,9}$/.test(raw)) return null;
  return Number(raw);
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
): Promise<ParsedMatrix> {
  // Refused before it is unpacked: the upload cap only bounds the COMPRESSED bytes.
  try {
    await assertMagicBytes(buffer);
    assertNoZipBomb(buffer, MATRIX_LIMITS.MAX_UNCOMPRESSED_BYTES);
  } catch (err) {
    if (!(err instanceof HostileXlsxError)) throw err;
    const tooLarge = err.code.startsWith('ZIP_BOMB');
    return refused([{ code: tooLarge ? 'MATRIX_TOO_LARGE' : 'MATRIX_NOT_RECOGNISED' }]);
  }
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as never);
  } catch {
    return refused([{ code: 'MATRIX_NOT_RECOGNISED' }]);
  }
  const sheet = workbook.getWorksheet(MATRIX_SHEET) ?? workbook.worksheets[0];
  if (!sheet || text(sheet.getCell(KEY_ROW, 1).value) !== SIGNATURE) {
    return refused([{ code: 'MATRIX_NOT_RECOGNISED' }]);
  }
  if (sheet.rowCount > MATRIX_LIMITS.MAX_ROWS || sheet.columnCount > MATRIX_LIMITS.MAX_COLUMNS) {
    return refused([{ code: 'MATRIX_TOO_LARGE' }]);
  }

  const configVersion = revisionOf(sheet.getCell(KEY_ROW, VERSION_COLUMN).value);
  const errors: MatrixError[] = [];
  const knownCriteria = new Set(criteria.map((c) => c.itemKey));
  const teamById = new Map(teams.map((t) => [t.teamId, t]));

  const columnOf = new Map<string, number>();
  for (let column = FIRST_TEAM_COLUMN; column <= sheet.columnCount; column += 1) {
    const teamId = text(sheet.getCell(KEY_ROW, column).value);
    if (!teamId) continue;
    if (!teamById.has(teamId)) errors.push({ code: 'MATRIX_TEAM_UNKNOWN', column: sheet.getColumn(column).letter });
    // The same team twice: which column is meant cannot be known, so neither is taken.
    else if (columnOf.has(teamId)) errors.push({ code: 'MATRIX_TEAM_DUPLICATE', column: sheet.getColumn(column).letter });
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
    else if (rowOf.has(itemKey)) errors.push({ code: 'MATRIX_CRITERION_DUPLICATE', row });
    else rowOf.set(itemKey, row);
  }
  for (const criterion of criteria) {
    if (!rowOf.has(criterion.itemKey)) errors.push({ code: 'MATRIX_CRITERION_MISSING', itemKey: criterion.itemKey });
  }
  if (errors.length > 0) return { teams: [], errors, configVersion };

  // A mark is plain text in a cell of its own. A formula may show nothing and still be "something"; a merged cell
  // answers for its neighbours. Neither can be read as a yes or a no, so the file is refused, naming the cell.
  const isMarked = (row: number, column: number): boolean => {
    const cell = sheet.getCell(row, column);
    const value = plain(cell.value);
    if (cell.isMerged || value === null) {
      errors.push({ code: 'MATRIX_CELL_NOT_PLAIN', cell: cell.address });
      return false;
    }
    return value !== '';
  };
  const results = teams.map((team): MatrixTeamResult => {
    const column = columnOf.get(team.teamId) as number;
    const marked = criteria.filter((c) => isMarked(rowOf.get(c.itemKey) as number, column)).map((c) => c.itemKey);
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
  if (errors.some((e) => e.code === 'MATRIX_CELL_NOT_PLAIN')) {
    return { teams: [], errors: errors.filter((e) => e.code === 'MATRIX_CELL_NOT_PLAIN'), configVersion };
  }
  return errors.length > 0 ? { teams: [], errors, configVersion } : { teams: results, errors, configVersion };
}
