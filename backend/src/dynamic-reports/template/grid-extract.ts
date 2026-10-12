import * as ExcelJS from 'exceljs';
import Decimal from 'decimal.js';
import { GRID_ENGINE_VERSION } from '../engine/grid-types';
import type {
  GridBorderSide,
  GridBorderStyle,
  GridCell,
  GridConditionalFormat,
  GridConditionalRule,
  GridDxf,
  GridModel,
  GridRun,
  GridSheet,
  GridStyle,
  GridValidation,
} from '../engine/grid-types';
import { formatAddress, parseAddress } from '../engine/paste';
import { parseThemeColors, resolveColor } from './grid-color';
import type { ColorContext, ExcelColor } from './grid-color';
import type { RawDataValidation, RawGridInfo } from './grid-raw';
import {
  columnWidthToPx,
  defaultColumnWidthPx,
  defaultRowHeightPt,
  maxDigitWidth,
  rowHeightToPx,
} from './grid-units';

/**
 * Builds the render-ready GridModel (G1) from an uploaded workbook, on the
 * server, from the file itself — never from anything the client sent. The
 * browser then draws the template as the officer knows it: merged blocks,
 * borders, fills, fonts, widths, frozen panes, number formats.
 *
 * Style inheritance follows Excel: a cell that exists in the file uses its
 * own style; a cell that does not exist takes its row's style over its
 * column's. Merged blocks carry their content and composite border on the
 * top-left cell and omit the covered cells.
 */

export class GridTooLargeError extends Error {
  readonly code = 'GRID_TOO_LARGE';
  constructor(message: string) {
    super(message);
    this.name = 'GridTooLargeError';
  }
}

export const MAX_GRID_ROWS = 3000;
export const MAX_GRID_COLS = 128;
export const MAX_GRID_CELLS = 150_000;

export interface GridExtractOptions {
  /** Sheets kept, in tab order. */
  selectedSheets: string[];
  /** Sheets of the workbook the report left out. */
  excludedSheets: string[];
  raw: RawGridInfo;
}

type Dict = Record<string, unknown>;

interface ExcelStyleLike {
  font?: {
    name?: string;
    size?: number;
    bold?: boolean;
    italic?: boolean;
    underline?: boolean | string;
    strike?: boolean;
    color?: ExcelColor;
  };
  fill?: {
    type?: string;
    pattern?: string;
    fgColor?: ExcelColor;
    bgColor?: ExcelColor;
    stops?: Array<{ color?: ExcelColor }>;
  };
  border?: Partial<
    Record<'top' | 'left' | 'bottom' | 'right', { style?: string; color?: ExcelColor }>
  >;
  alignment?: {
    horizontal?: string;
    vertical?: string;
    wrapText?: boolean;
    indent?: number;
    textRotation?: number | string;
  };
  numFmt?: string;
}

const BORDER_STYLE: Record<string, GridBorderStyle> = {
  thin: 'thin',
  medium: 'medium',
  thick: 'thick',
  dashed: 'dashed',
  dotted: 'dotted',
  double: 'double',
  hair: 'hair',
  mediumDashed: 'dashed',
  dashDot: 'dashed',
  mediumDashDot: 'dashed',
  dashDotDot: 'dashed',
  mediumDashDotDot: 'dashed',
  slantDashDot: 'dashed',
};

class StyleTable {
  readonly styles: GridStyle[] = [{}];
  private readonly index = new Map<string, number>([['{}', 0]]);

  add(style: GridStyle): number {
    const key = JSON.stringify(style);
    const hit = this.index.get(key);
    if (hit !== undefined) return hit;
    this.styles.push(style);
    this.index.set(key, this.styles.length - 1);
    return this.styles.length - 1;
  }
}

function toBorderSide(
  side: { style?: string; color?: ExcelColor } | undefined,
  ctx: ColorContext,
): GridBorderSide | undefined {
  if (!side?.style) return undefined;
  const style = BORDER_STYLE[side.style];
  if (!style) return undefined;
  return { style, color: resolveColor(side.color, ctx) ?? '#000000' };
}

function toGridStyle(
  s: ExcelStyleLike | undefined,
  ctx: ColorContext,
  warn: (m: string) => void,
  defaultFont: { name: string; sizePt: number },
): GridStyle {
  const out: GridStyle = {};
  if (!s) return out;

  const f = s.font;
  if (f) {
    // The Normal font is the renderer's fallback, so a cell in it states nothing.
    if (f.name && f.name !== defaultFont.name) out.fontName = f.name;
    if (typeof f.size === 'number' && f.size !== defaultFont.sizePt) out.fontSizePt = f.size;
    if (f.bold) out.bold = true;
    if (f.italic) out.italic = true;
    if (f.underline) out.underline = true;
    if (f.strike) out.strike = true;
    const color = resolveColor(f.color, ctx);
    if (color && color !== '#000000') out.color = color;
  }

  const fill = s.fill;
  if (fill) {
    if (fill.type === 'pattern' && fill.pattern && fill.pattern !== 'none') {
      const color = resolveColor(fill.fgColor, ctx) ?? resolveColor(fill.bgColor, ctx);
      if (color) out.fill = color;
      if (fill.pattern !== 'solid') warn(`mẫu tô "${fill.pattern}" được vẽ thành màu nền đặc`);
    } else if (fill.type === 'gradient') {
      const color = resolveColor(fill.stops?.[0]?.color, ctx);
      if (color) out.fill = color;
      warn('nền chuyển sắc được vẽ thành màu nền đặc');
    }
  }

  const a = s.alignment;
  if (a) {
    const h = a.horizontal;
    if (h === 'left' || h === 'right' || h === 'center' || h === 'justify' || h === 'fill') {
      out.hAlign = h;
    } else if (h === 'centerContinuous') out.hAlign = 'center';
    else if (h === 'distributed') out.hAlign = 'justify';
    const v = a.vertical;
    if (v === 'top' || v === 'bottom') out.vAlign = v;
    else if (v === 'middle' || v === 'center') out.vAlign = 'middle';
    else if (v === 'distributed' || v === 'justify') out.vAlign = 'middle';
    if (a.wrapText) out.wrap = true;
    if (typeof a.indent === 'number' && a.indent > 0) out.indent = a.indent;
    // Excel's "vertical text" (letters stacked upright) is rotation 255.
    const rot =
      typeof a.textRotation === 'number'
        ? a.textRotation
        : a.textRotation === 'vertical'
          ? 255
          : undefined;
    if (rot) out.rotation = rot;
  }

  const b = s.border;
  if (b) {
    const top = toBorderSide(b.top, ctx);
    const right = toBorderSide(b.right, ctx);
    const bottom = toBorderSide(b.bottom, ctx);
    const left = toBorderSide(b.left, ctx);
    if (top) out.borderTop = top;
    if (right) out.borderRight = right;
    if (bottom) out.borderBottom = bottom;
    if (left) out.borderLeft = left;
  }

  if (s.numFmt && s.numFmt.toLowerCase() !== 'general') out.numFmt = s.numFmt;
  return out;
}

function toDxf(s: ExcelStyleLike | undefined, ctx: ColorContext): GridDxf {
  const out: GridDxf = {};
  if (!s) return out;
  if (s.font) {
    const color = resolveColor(s.font.color, ctx);
    if (color) out.color = color;
    if (s.font.bold) out.bold = true;
    if (s.font.italic) out.italic = true;
    if (s.font.underline) out.underline = true;
    if (s.font.strike) out.strike = true;
  }
  if (s.fill) {
    // In a differential format a solid fill's colour lives in bgColor.
    const color = resolveColor(s.fill.bgColor, ctx) ?? resolveColor(s.fill.fgColor, ctx);
    if (color) out.fill = color;
  }
  return out;
}

const ValueType = ExcelJS.ValueType;

function serialOf(date: Date, date1904: boolean): string {
  const epoch = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
  const days = (date.getTime() - epoch) / 86_400_000;
  return new Decimal(days).toDecimalPlaces(10).toFixed();
}

function numberString(n: number): string {
  return new Decimal(n).toFixed();
}

interface RichTextPart {
  text: string;
  font?: ExcelStyleLike['font'];
}

function toRuns(parts: RichTextPart[], ctx: ColorContext): GridRun[] {
  return parts.map((p) => {
    const run: GridRun = { text: p.text };
    const f = p.font;
    if (f) {
      if (f.bold) run.bold = true;
      if (f.italic) run.italic = true;
      if (f.underline) run.underline = true;
      const color = resolveColor(f.color, ctx);
      if (color && color !== '#000000') run.color = color;
      if (typeof f.size === 'number') run.fontSizePt = f.size;
      if (f.name) run.fontName = f.name;
    }
    return run;
  });
}

function contentOf(
  cell: ExcelJS.Cell,
  s: number,
  ctx: ColorContext,
  date1904: boolean,
): GridCell {
  switch (cell.type) {
    case ValueType.Formula: {
      const f = cell.formula;
      return f ? { k: 'formula', f, s } : { k: 'empty', s };
    }
    case ValueType.Number:
      return { k: 'num', v: numberString(cell.value as number), s };
    case ValueType.Date:
      return { k: 'num', v: serialOf(cell.value as Date, date1904), s };
    case ValueType.Boolean:
      return { k: 'bool', v: cell.value as boolean, s };
    case ValueType.RichText: {
      const parts = (cell.value as { richText: RichTextPart[] }).richText;
      const text = parts.map((p) => p.text).join('');
      return text === '' ? { k: 'empty', s } : { k: 'text', v: text, s, runs: toRuns(parts, ctx) };
    }
    case ValueType.Hyperlink:
      return { k: 'text', v: String((cell.value as { text?: string }).text ?? ''), s };
    case ValueType.Error:
      return { k: 'text', v: String((cell.value as { error?: string }).error ?? ''), s };
    case ValueType.String:
    case ValueType.SharedString: {
      const v = String(cell.value);
      return v === '' ? { k: 'empty', s } : { k: 'text', v, s };
    }
    default:
      return { k: 'empty', s };
  }
}

/** Contiguous A1 rectangles covering a set of cells, row-run first then merged vertically. */
export function compressAddresses(addresses: string[]): string[] {
  if (addresses.length === 0) return [];
  const byRow = new Map<number, number[]>();
  for (const a of addresses) {
    const { col, row } = parseAddress(a);
    const list = byRow.get(row) ?? [];
    list.push(col);
    byRow.set(row, list);
  }
  interface Run { c0: number; c1: number; r0: number; r1: number }
  const open = new Map<string, Run>(); // "c0:c1" → run still extending downwards
  const done: Run[] = [];
  let lastRow = -1;
  for (const row of [...byRow.keys()].sort((a, b) => a - b)) {
    const cols = [...new Set(byRow.get(row))].sort((a, b) => a - b);
    const runs: Array<[number, number]> = [];
    for (const c of cols) {
      const last = runs[runs.length - 1];
      if (last && last[1] === c - 1) last[1] = c;
      else runs.push([c, c]);
    }
    const nextOpen = new Map<string, Run>();
    for (const [c0, c1] of runs) {
      const k = `${c0}:${c1}`;
      const prev = open.get(k);
      if (prev && prev.r1 === row - 1 && lastRow === row - 1) {
        prev.r1 = row;
        nextOpen.set(k, prev);
        open.delete(k);
      } else {
        nextOpen.set(k, { c0, c1, r0: row, r1: row });
      }
    }
    for (const r of open.values()) done.push(r);
    open.clear();
    for (const [k, r] of nextOpen) open.set(k, r);
    lastRow = row;
  }
  for (const r of open.values()) done.push(r);
  return done
    .sort((a, b) => a.r0 - b.r0 || a.c0 - b.c0)
    .map((r) => {
      const a = formatAddress({ col: r.c0, row: r.r0 });
      const b = formatAddress({ col: r.c1, row: r.r1 });
      return a === b ? a : `${a}:${b}`;
    });
}

function formulaText(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v === 'number') return numberString(v);
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return undefined;
}

/** The Excel data validation of a sheet, one entry per distinct rule with the cells it covers (OV7). */
export function extractSheetValidations(
  ws: ExcelJS.Worksheet,
  name: string,
  warnings: string[] = [],
  raw?: readonly RawDataValidation[],
): GridValidation[] {
  const validations: GridValidation[] = [];
  if (raw) {
    // As written in the file: the blocks keep their order (relative formulas are anchored at the first) and a
    // bound that is a cell reference stays text.
    for (const r of raw) {
      if (!['whole', 'decimal', 'list', 'date', 'time', 'textLength', 'custom'].includes(r.type)) {
        warnings.push(`${name}!${r.sqref[0]}: quy tắc nhập liệu "${r.type}" chưa được hỗ trợ`);
        continue;
      }
      validations.push({
        ranges: r.sqref,
        type: r.type as GridValidation['type'],
        operator: (r.operator ?? (r.type === 'list' || r.type === 'custom' ? undefined : 'between')) as GridValidation['operator'],
        formula1: r.formula1,
        formula2: r.formula2,
        allowBlank: r.allowBlank,
        showErrorMessage: r.showErrorMessage,
        errorTitle: r.errorTitle,
        errorMessage: r.error,
        promptTitle: r.promptTitle,
        prompt: r.prompt,
      });
    }
    return validations;
  }
  const dv =
    (ws as unknown as { dataValidations?: { model?: Record<string, Record<string, unknown>> } }).dataValidations
      ?.model ?? {};
  const groups = new Map<string, { sample: Record<string, unknown>; addrs: string[] }>();
  for (const [addr, rule] of Object.entries(dv)) {
    const key = JSON.stringify(rule);
    const g = groups.get(key) ?? { sample: rule, addrs: [] };
    g.addrs.push(addr);
    groups.set(key, g);
  }
  for (const { sample, addrs } of groups.values()) {
    const type = String(sample.type);
    if (!['whole', 'decimal', 'list', 'date', 'time', 'textLength', 'custom'].includes(type)) {
      warnings.push(`${name}!${addrs[0]}: quy tắc nhập liệu "${type}" chưa được hỗ trợ`);
      continue;
    }
    const f = (sample.formulae as unknown[] | undefined) ?? [];
    validations.push({
      ranges: compressAddresses(addrs),
      type: type as GridValidation['type'],
      operator: sample.operator as GridValidation['operator'],
      formula1: formulaText(f[0]),
      formula2: formulaText(f[1]),
      allowBlank: sample.allowBlank === true,
      showErrorMessage: sample.showErrorMessage === true,
      errorTitle: typeof sample.errorTitle === 'string' ? sample.errorTitle : undefined,
      errorMessage: typeof sample.error === 'string' ? sample.error : undefined,
      promptTitle: typeof sample.promptTitle === 'string' ? sample.promptTitle : undefined,
      prompt: typeof sample.prompt === 'string' ? sample.prompt : undefined,
    });
  }
  return validations;
}


export function extractGridModel(
  workbook: ExcelJS.Workbook,
  options: GridExtractOptions,
): GridModel {
  const { raw } = options;
  const warnings: string[] = [];
  const themeXml = (workbook as unknown as { _themes?: Record<string, string> })._themes?.theme1;
  const ctx: ColorContext = {
    theme: parseThemeColors(themeXml),
    indexed: raw.indexedColors ?? undefined,
  };
  const date1904 = raw.date1904;
  const table = new StyleTable();
  const mdw = maxDigitWidth(raw.defaultFont.name, raw.defaultFont.sizePt);
  const sheets: GridSheet[] = [];
  const warn = (sheet: string, where: string) => (m: string) => warnings.push(`${sheet}!${where}: ${m}`);

  for (const name of options.selectedSheets) {
    const ws = workbook.getWorksheet(name);
    if (!ws) continue;
    const model = ws.model as unknown as Dict & {
      merges?: string[];
      cols?: Array<{
        min: number;
        max: number;
        width?: number;
        hidden?: boolean;
        style?: ExcelStyleLike;
      }>;
    };
    const merges = (model.merges ?? []).map((m) => {
      const [a, b] = m.split(':');
      const p = parseAddress(a);
      const q = parseAddress(b ?? a);
      return { top: p.row - 1, left: p.col, bottom: q.row - 1, right: q.col };
    });

    // Only cells that exist in the file are visited. exceljs' own iterators
    // either skip styled-but-empty cells (they have no value) or, with
    // `includeEmpty`, invent every missing cell inheriting row/column style;
    // neither is wanted, so read the sparse row/cell arrays directly.
    const existingRows = (
      (ws as unknown as { _rows?: Array<ExcelJS.Row | undefined> })._rows ?? []
    ).filter((r): r is ExcelJS.Row => !!r);
    const cellsOf = (row: ExcelJS.Row): ExcelJS.Cell[] =>
      ((row as unknown as { _cells?: Array<ExcelJS.Cell | undefined> })._cells ?? []).filter(
        (c): c is ExcelJS.Cell => !!c,
      );

    let rows = 0;
    let cols = 0;
    for (const row of existingRows) {
      rows = Math.max(rows, row.number);
      for (const c of cellsOf(row)) cols = Math.max(cols, Number(c.col));
    }
    for (const m of merges) {
      rows = Math.max(rows, m.bottom + 1);
      cols = Math.max(cols, m.right + 1);
    }
    if (rows > MAX_GRID_ROWS || cols > MAX_GRID_COLS || rows * cols > MAX_GRID_CELLS) {
      throw new GridTooLargeError(
        `Sheet "${name}" có ${rows} dòng × ${cols} cột, vượt giới hạn vẽ lưới.`,
      );
    }

    // ---- row / column styles: the fallback for a cell the file does not hold
    const colDefs = model.cols ?? [];
    const colStyles: GridSheet['colStyles'] = [];
    for (const d of colDefs) {
      if (!d.style) continue;
      const s = table.add(toGridStyle(d.style, ctx, warn(name, `cột ${d.min}`), raw.defaultFont));
      if (s !== 0) colStyles.push({ min: d.min - 1, max: d.max - 1, s });
    }
    const rowStyles: GridSheet['rowStyles'] = {};
    for (const row of existingRows) {
      const rs = (row as unknown as { style?: ExcelStyleLike }).style;
      if (!rs) continue;
      const s = table.add(toGridStyle(rs, ctx, warn(name, `dòng ${row.number}`), raw.defaultFont));
      if (s !== 0) rowStyles[row.number - 1] = s;
    }
    // ---- merges: master owns content, covered cells are dropped -----------
    const masterAt = new Map<string, (typeof merges)[number]>();
    const covered = new Set<string>();
    for (const m of merges) {
      masterAt.set(formatAddress({ col: m.left, row: m.top + 1 }), m);
      for (let r = m.top; r <= m.bottom; r++) {
        for (let c = m.left; c <= m.right; c++) {
          if (r === m.top && c === m.left) continue;
          covered.add(formatAddress({ col: c, row: r + 1 }));
        }
      }
    }

    // ---- cells ----------------------------------------------------------------
    const cells: Record<string, GridCell> = {};
    for (const row of existingRows) {
      for (const cell of cellsOf(row)) {
        const colIndex = Number(cell.col) - 1;
        const address = formatAddress({ col: colIndex, row: row.number });
        if (covered.has(address)) continue;

        const gs = toGridStyle(cell.style as ExcelStyleLike, ctx, warn(name, address), raw.defaultFont);

        const master = masterAt.get(address);
        if (master) {
          // A merged block's outline is whatever its edge cells carry: the
          // first border found along each edge, scanning from the corner.
          const edge = (
            cellsAlong: Array<[number, number]>,
            side: 'borderTop' | 'borderRight' | 'borderBottom' | 'borderLeft',
          ): GridBorderSide | undefined => {
            for (const [rr, cc] of cellsAlong) {
              const ec = ws.findRow(rr + 1)?.findCell(cc + 1);
              if (!ec) continue;
              const found = toGridStyle(ec.style as ExcelStyleLike, ctx, () => undefined, raw.defaultFont)[side];
              if (found) return found;
            }
            return undefined;
          };
          const topRow: Array<[number, number]> = [];
          const bottomRow: Array<[number, number]> = [];
          for (let cc = master.left; cc <= master.right; cc++) {
            topRow.push([master.top, cc]);
            bottomRow.push([master.bottom, cc]);
          }
          const leftCol: Array<[number, number]> = [];
          const rightCol: Array<[number, number]> = [];
          for (let rr = master.top; rr <= master.bottom; rr++) {
            leftCol.push([rr, master.left]);
            rightCol.push([rr, master.right]);
          }
          const outline = {
            borderTop: edge(topRow, 'borderTop'),
            borderRight: edge(rightCol, 'borderRight'),
            borderBottom: edge(bottomRow, 'borderBottom'),
            borderLeft: edge(leftCol, 'borderLeft'),
          };
          for (const [k, v] of Object.entries(outline)) {
            if (v) (gs as Record<string, unknown>)[k] = v;
            else delete (gs as Record<string, unknown>)[k];
          }
        }
        const s = table.add(gs);
        const content = contentOf(cell, s, ctx, date1904);
        // A plain empty cell says nothing. (Known limit: a <c> with no value and
        // no style attribute inside a styled column is dropped by exceljs, so the
        // column style shows through where Excel would draw it plain — invisible
        // unless the column style has a fill or border.)
        if (content.k === 'empty' && s === 0) continue;
        cells[address] = content;
      }
    }
    // The drawn extent is where something is: a cell with content or a style,
    // or a merged block. (Scanning stopped at the file's own extent above.)
    rows = 0;
    cols = 0;
    for (const address of Object.keys(cells)) {
      const a = parseAddress(address);
      rows = Math.max(rows, a.row);
      cols = Math.max(cols, a.col + 1);
    }
    for (const m of merges) {
      rows = Math.max(rows, m.bottom + 1);
      cols = Math.max(cols, m.right + 1);
    }

    // ---- columns / rows -----------------------------------------------------
    const defaultColWidth = (ws.properties as unknown as { defaultColWidth?: number })
      .defaultColWidth;
    const colWidthsPx: number[] = [];
    const hiddenCols: number[] = [];
    for (let c = 1; c <= cols; c++) {
      const def = colDefs.find((d) => d.min <= c && c <= d.max);
      if (def?.hidden) hiddenCols.push(c - 1);
      colWidthsPx.push(
        def && typeof def.width === 'number'
          ? columnWidthToPx(def.width, mdw)
          : defaultColumnWidthPx(mdw, defaultColWidth),
      );
    }
    const sheetDefaultRowPt =
      (ws.properties as unknown as { defaultRowHeight?: number }).defaultRowHeight ??
      defaultRowHeightPt(raw.defaultFont.sizePt);
    const rowHeightsPx: number[] = [];
    const hiddenRows: number[] = [];
    for (let r = 1; r <= rows; r++) {
      const row = ws.findRow(r);
      const pt = row && typeof row.height === 'number' ? row.height : sheetDefaultRowPt;
      rowHeightsPx.push(rowHeightToPx(pt));
      if (row?.hidden) hiddenRows.push(r - 1);
    }

    // ---- conditional formats / validations -----------------------------------
    const conditionalFormats: GridConditionalFormat[] = [];
    const cfs = (ws as unknown as { conditionalFormattings?: Array<{ ref: string; rules: Dict[] }> })
      .conditionalFormattings;
    for (const cf of cfs ?? []) {
      const rules: GridConditionalRule[] = [];
      for (const rule of cf.rules) {
        const type = String(rule.type);
        const style = toDxf(rule.style as ExcelStyleLike | undefined, ctx);
        const priority = Number(rule.priority ?? 0);
        const stopIfTrue = rule.stopIfTrue === true;
        const formulae = ((rule.formulae as unknown[] | undefined) ?? [])
          .map(formulaText)
          .filter((x): x is string => x !== undefined);
        if (type === 'cellIs' && typeof rule.operator === 'string') {
          rules.push({
            type: 'cellIs',
            operator: rule.operator as Extract<GridConditionalRule, { type: 'cellIs' }>['operator'],
            formulas: formulae,
            style,
            priority,
            stopIfTrue,
          });
        } else if (type === 'expression' && formulae[0]) {
          rules.push({ type: 'expression', formula: formulae[0], style, priority, stopIfTrue });
        } else {
          warnings.push(`${name}!${cf.ref}: định dạng có điều kiện "${type}" chưa được hỗ trợ`);
        }
      }
      if (rules.length > 0) {
        conditionalFormats.push({ ranges: cf.ref.split(/\s+/), rules });
      }
    }

    const validations = extractSheetValidations(ws, name, warnings, raw.dataValidations[name]);

    // ---- view ------------------------------------------------------------------
    const view = (ws.views?.[0] ?? {}) as {
      state?: string;
      xSplit?: number;
      ySplit?: number;
      showGridLines?: boolean;
      zoomScale?: number;
    };
    sheets.push({
      name,
      rows,
      cols,
      colWidthsPx,
      rowHeightsPx,
      hiddenRows,
      hiddenCols,
      merges: merges.map((m) => ({ ...m })),
      freeze:
        view.state === 'frozen'
          ? { rows: view.ySplit ?? 0, cols: view.xSplit ?? 0 }
          : { rows: 0, cols: 0 },
      showGridlines: view.showGridLines !== false,
      showZeros: raw.showZeros[name] !== false,
      zoom: view.zoomScale ?? 100,
      cells,
      colStyles,
      rowStyles,
      conditionalFormats,
      validations,
    });
  }

  return {
    engineVersion: GRID_ENGINE_VERSION,
    dateSystem: date1904 ? 1904 : 1900,
    sheetOrder: options.selectedSheets.filter((n) => sheets.some((s) => s.name === n)),
    excludedSheets: options.excludedSheets,
    styles: table.styles,
    defaultFont: { name: raw.defaultFont.name, sizePt: raw.defaultFont.sizePt },
    sheets,
    warnings,
  };
}
