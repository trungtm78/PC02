/**
 * GridModel — the render-ready description of a report template's sheets
 * (G0 types, G1 produces them from the uploaded .xlsx on the server).
 *
 * What it carries is what a person sees in Excel: text, numbers, formulas,
 * merged blocks, column widths and row heights in CSS pixels, fonts, fills,
 * borders, number formats, frozen panes, hidden rows/columns, conditional
 * formats and the data-validation rules of the original file.
 *
 * What it deliberately does NOT carry is which cells are inputs. That lives
 * in `DynReportField` and is joined in at render time, so there is exactly
 * one source of truth for editability (plan §1).
 *
 * Colours are already resolved to `#RRGGBB` by the server (theme + tint +
 * indexed palette), so the browser never needs the workbook's theme.
 *
 * Pure types: no imports, copied verbatim to the frontend.
 */

/** Bump when the shape or the extraction rules change; cached models are rebuilt. */
export const GRID_ENGINE_VERSION = 1;

export type GridBorderStyle =
  | 'thin'
  | 'medium'
  | 'thick'
  | 'dashed'
  | 'dotted'
  | 'double'
  | 'hair';

export interface GridBorderSide {
  style: GridBorderStyle;
  /** `#RRGGBB` */
  color: string;
}

export interface GridStyle {
  fontName?: string;
  fontSizePt?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  /** Font colour, `#RRGGBB`. */
  color?: string;
  /** Background fill, `#RRGGBB`. */
  fill?: string;
  hAlign?: 'left' | 'center' | 'right' | 'justify' | 'fill';
  vAlign?: 'top' | 'middle' | 'bottom';
  wrap?: boolean;
  indent?: number;
  /** Degrees, -90..90, or 255 for vertical stacked text (Excel). */
  rotation?: number;
  borderTop?: GridBorderSide;
  borderRight?: GridBorderSide;
  borderBottom?: GridBorderSide;
  borderLeft?: GridBorderSide;
  /** Excel number-format code, as stored in the file. */
  numFmt?: string;
}

/** A run of differently-formatted text inside one cell. */
export interface GridRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  fontSizePt?: number;
  fontName?: string;
}

/** Cells are sparse: an address missing from `GridSheet.cells` is plain and empty. */
export type GridCell =
  | { k: 'text'; v: string; s: number; runs?: GridRun[] }
  /** Canonical decimal string. */
  | { k: 'num'; v: string; s: number }
  | { k: 'bool'; v: boolean; s: number }
  /** Formula source without the leading "=". */
  | { k: 'formula'; f: string; s: number }
  /** Empty but styled (borders, fill). */
  | { k: 'empty'; s: number };

/** A merged block, 0-based and inclusive. The top-left cell owns the content. */
export interface GridMerge {
  top: number;
  left: number;
  bottom: number;
  right: number;
}

/** The look a conditional format applies on top of the cell's own style. */
export interface GridDxf {
  color?: string;
  fill?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
}

export type GridConditionalRule =
  | {
      type: 'cellIs';
      operator:
        | 'equal'
        | 'notEqual'
        | 'greaterThan'
        | 'greaterThanOrEqual'
        | 'lessThan'
        | 'lessThanOrEqual'
        | 'between'
        | 'notBetween';
      /** One or two formulas/constants, no leading "=". */
      formulas: string[];
      style: GridDxf;
      priority: number;
      stopIfTrue: boolean;
    }
  | {
      type: 'expression';
      /** Written relative to the top-left cell of `GridConditionalFormat.ranges`. */
      formula: string;
      style: GridDxf;
      priority: number;
      stopIfTrue: boolean;
    };

export interface GridConditionalFormat {
  /** A1 ranges the rules apply to, e.g. ["G10:G28"]. */
  ranges: string[];
  rules: GridConditionalRule[];
}

/** The Excel data-validation rule attached to a block of cells (OV7). */
export interface GridValidation {
  ranges: string[];
  type: 'whole' | 'decimal' | 'list' | 'date' | 'time' | 'textLength' | 'custom';
  operator?:
    | 'between'
    | 'notBetween'
    | 'equal'
    | 'notEqual'
    | 'greaterThan'
    | 'lessThan'
    | 'greaterThanOrEqual'
    | 'lessThanOrEqual';
  formula1?: string;
  formula2?: string;
  allowBlank: boolean;
  showErrorMessage: boolean;
  errorTitle?: string;
  errorMessage?: string;
  promptTitle?: string;
  prompt?: string;
}

export interface GridSheet {
  name: string;
  /** Used range extent: number of rows and columns to draw. */
  rows: number;
  cols: number;
  /** CSS pixels, one entry per column / row of the used range. */
  colWidthsPx: number[];
  rowHeightsPx: number[];
  /** 0-based indexes. */
  hiddenRows: number[];
  hiddenCols: number[];
  merges: GridMerge[];
  /** Frozen pane: number of leading rows / columns that stay in view. */
  freeze: { rows: number; cols: number };
  showGridlines: boolean;
  /** Excel "Show a zero in cells that have zero value". `false` hides zeros (OV8). */
  showZeros: boolean;
  /** Percent, 100 = actual size. */
  zoom: number;
  /**
   * Keyed by A1 address. Holds the cells that exist in the file. A cell that
   * is absent is drawn with its row's style, else its column's (Excel's
   * rule); only when neither exists is it plain.
   */
  cells: Record<string, GridCell>;
  /** Style index for every column in an inclusive 0-based range (a `<col style>`). */
  colStyles: Array<{ min: number; max: number; s: number }>;
  /** Style index by 0-based row, for rows with their own formatting. */
  rowStyles: Record<number, number>;
  conditionalFormats: GridConditionalFormat[];
  validations: GridValidation[];
}

export interface GridModel {
  engineVersion: number;
  /** 1900 or 1904 — how a numeric date cell is read. */
  dateSystem: 1900 | 1904;
  /** Tab order of the sheets that were kept; it defines what a 3-D reference spans. */
  sheetOrder: string[];
  /** Sheets the report left out; a reference into one is "out of scope". */
  excludedSheets: string[];
  /** Style table, de-duplicated; `GridCell.s` indexes into it. Entry 0 is always the empty style. */
  styles: GridStyle[];
  /** The workbook's Normal font: text with no font of its own is drawn in it. */
  defaultFont: { name: string; sizePt: number };
  sheets: GridSheet[];
  /**
   * What the extractor met and could not reproduce (an unsupported
   * conditional-format type, a fill pattern it approximated…), as
   * "Sheet!A1: reason". The grid says so instead of silently drawing less.
   */
  warnings: string[];
}
