import { useMemo } from 'react';
import type { CSSProperties, MouseEvent, ReactNode, Ref } from 'react';
import type { GridCell, GridModel, GridRun, GridStyle } from '../engine/generated/grid-types';
import { formatAddress } from '../engine/generated/paste';
import { buildSheetIndex, key, layoutMerges } from './gridIndex';
import type { SheetIndex } from './gridIndex';
import { cssForDxf, cssForStyle } from './styleToCss';
import { viewOf } from './gridEvaluation';
import type { CellView, GridEvaluation } from './gridEvaluation';
import { overlayFor } from './conditional';
import { drawnRowsOf, inputRowSet, rectsOverlap } from './gridLayout';
import type { Pos, Rect } from './navigation';

/**
 * Read-only drawing of one sheet of a template, as a real <table>: merged
 * blocks as row/col spans, widths and heights from the file, borders, fills,
 * fonts and number formats as the officer sees them in Excel, frozen panes as
 * sticky rows/columns, hidden rows/columns omitted.
 *
 * Gridlines are an inset shadow rather than borders so they never compete with
 * the template's own borders in `border-collapse` resolution.
 */

/**
 * What turns the read-only drawing into something an officer types into: which
 * cells are selected, where the cursor is, and what a click does. Absent, the
 * table is a plain read-only view.
 */
export interface GridInteraction {
  /** Selected block (inclusive sheet rectangle), shaded over the cells' own fill. */
  selection: Rect | null;
  /** The cell that has the cursor (the cell that draws a merged block). */
  active: Pos | null;
  /** Addresses (of the cell that holds the value) the officer must fix. */
  invalid: ReadonlySet<string>;
  /** Addresses of input cells that must be filled before submitting. */
  required: ReadonlySet<string>;
  onCellMouseDown: (pos: Pos, e: MouseEvent) => void;
  onCellMouseEnter: (pos: Pos, e: MouseEvent) => void;
  onCellDoubleClick: (pos: Pos, e: MouseEvent) => void;
}

export interface GridTableProps {
  grid: GridModel;
  sheetName: string;
  evaluation: GridEvaluation;
  /** Percent, 100 = actual size. */
  zoom?: number;
  /** Excel-style A, B, C… / 1, 2, 3… headers. */
  showHeaders?: boolean;
  /** Hide every row that has no input cell (frozen heading rows stay). */
  onlyInputRows?: boolean;
  /** CSS max-height of the scroll area. */
  maxHeight?: string;
  interaction?: GridInteraction;
  /** The scroll area, for callers that need to measure cells or scroll them into view. */
  containerRef?: Ref<HTMLDivElement>;
  /** Drawn on top of the table inside the scrolling area (the cell editor). */
  children?: ReactNode;
}

const HEADER_BG = '#f1f3f4';
const HEADER_COLOR = '#5f6368';
const GRIDLINE = '#d9d9d9';
const INPUT_BG = '#eef6ff';
const INPUT_RING = '#93c5fd';

function columnLetters(index: number): string {
  return formatAddress({ col: index, row: 1 }).replace(/\d+$/, '');
}

function renderRuns(runs: GridRun[]): ReactNode {
  return runs.map((run, i) => {
    const css: CSSProperties = {};
    if (run.bold) css.fontWeight = 700;
    if (run.italic) css.fontStyle = 'italic';
    if (run.underline) css.textDecoration = 'underline';
    if (run.color) css.color = run.color;
    return (
      <span key={i} style={css}>
        {run.text}
      </span>
    );
  });
}

function styleOfCell(
  grid: GridModel,
  index: SheetIndex,
  row: number,
  col: number,
  cell: GridCell | undefined,
): GridStyle {
  if (cell) return grid.styles[cell.s] ?? {};
  // A cell the file does not hold takes its row's formatting, else its column's.
  const sheet = index.sheet;
  const rowStyle = sheet.rowStyles[row];
  if (rowStyle !== undefined) return grid.styles[rowStyle] ?? {};
  const colStyle = sheet.colStyles.find((c) => c.min <= col && col <= c.max);
  return colStyle ? (grid.styles[colStyle.s] ?? {}) : {};
}

export default function GridTable({
  grid,
  sheetName,
  evaluation,
  zoom = 100,
  showHeaders = true,
  onlyInputRows = false,
  maxHeight = '70vh',
  interaction,
  containerRef,
  children,
}: GridTableProps) {
  const sheet = grid.sheets.find((s) => s.name === sheetName);
  const index = useMemo(() => (sheet ? buildSheetIndex(sheet) : null), [sheet]);

  const inputRows = useMemo(
    () => (sheet ? inputRowSet(sheet.name, evaluation.fieldAt.values()) : new Set<number>()),
    [sheet, evaluation],
  );

  if (!sheet || !index) return null;

  const z = zoom / 100;
  const cssCtx = { defaultFont: grid.defaultFont, z };
  const headerH = showHeaders ? Math.round(20 * z) : 0;
  const headerW = showHeaders ? Math.round(40 * z) : 0;
  const freezeRows = sheet.freeze.rows;
  const freezeCols = sheet.freeze.cols;
  const ctx = evaluation.evaluator.contextFor(sheet.name);

  const rows = drawnRowsOf(index, inputRows, onlyInputRows);

  // Merged blocks are placed on what is actually drawn: a hidden or filtered-out
  // anchor row/column must not leave the block's remaining cells shifted.
  const merges = layoutMerges(sheet, rows, index.visibleCols);

  // A frozen row sticks just below the headers and the frozen rows above it.
  // Frozen rows are never filtered out, so they always stack the same way.
  const frozenTop = (r: number): number => {
    let top = headerH;
    for (const vr of index.visibleRows) {
      if (vr >= r) break;
      if (vr < freezeRows) top += Math.round((sheet.rowHeightsPx[vr] ?? 0) * z);
    }
    return top;
  };

  const tableStyle: CSSProperties = {
    tableLayout: 'fixed',
    borderCollapse: 'collapse',
    width: Math.round(index.totalWidth * z) + headerW,
    backgroundColor: '#fff',
  };

  return (
    <div
      ref={containerRef}
      className="overflow-auto border border-slate-300 rounded bg-white"
      style={{ maxHeight }}
      data-testid={`grid-scroll-${sheet.name}`}
      // The spreadsheet keyboard belongs to the grid: F2 edits a cell here, it does not "Save".
      {...(interaction ? { 'data-shortcut-zone': 'grid' } : {})}
    >
      <div data-grid-surface style={{ position: 'relative', width: tableStyle.width }}>
      <table
        style={tableStyle}
        role="grid"
        aria-readonly={interaction ? undefined : 'true'}
        aria-label={`Bảng ${sheet.name}`}
        aria-rowcount={sheet.rows + (showHeaders ? 1 : 0)}
        aria-colcount={sheet.cols + (showHeaders ? 1 : 0)}
        data-testid="grid-table"
      >
        <colgroup>
          {showHeaders && <col style={{ width: headerW }} />}
          {index.visibleCols.map((c) => (
            <col key={c} style={{ width: Math.round((sheet.colWidthsPx[c] ?? 0) * z) }} />
          ))}
        </colgroup>

        {showHeaders && (
          <thead>
            <tr style={{ height: headerH }} aria-rowindex={1}>
              <th
                scope="col"
                aria-colindex={1}
                style={{
                  position: 'sticky',
                  top: 0,
                  left: 0,
                  zIndex: 4,
                  background: HEADER_BG,
                  border: `1px solid ${GRIDLINE}`,
                }}
              />
              {index.visibleCols.map((c) => (
                <th
                  key={c}
                  scope="col"
                  aria-colindex={c + 1 + (showHeaders ? 1 : 0)}
                  style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: c < freezeCols ? 3 : 2,
                    left: c < freezeCols ? headerW + Math.round((index.colLeft.get(c) ?? 0) * z) : undefined,
                    background: HEADER_BG,
                    color: HEADER_COLOR,
                    fontWeight: 400,
                    fontSize: `${11 * z}px`,
                    border: `1px solid ${GRIDLINE}`,
                  }}
                >
                  {columnLetters(c)}
                </th>
              ))}
            </tr>
          </thead>
        )}

        <tbody>
          {rows.map((r) => (
            <tr key={r} style={{ height: Math.round((sheet.rowHeightsPx[r] ?? 0) * z) }} aria-rowindex={r + 1 + (showHeaders ? 1 : 0)}>
              {showHeaders && (
                <th
                  scope="row"
                  aria-colindex={1}
                  style={{
                    position: 'sticky',
                    left: 0,
                    top: r < freezeRows ? frozenTop(r) : undefined,
                    zIndex: r < freezeRows ? 3 : 1,
                    background: HEADER_BG,
                    color: HEADER_COLOR,
                    fontWeight: 400,
                    fontSize: `${11 * z}px`,
                    border: `1px solid ${GRIDLINE}`,
                  }}
                >
                  {r + 1}
                </th>
              )}
              {index.visibleCols.map((c) => {
                const k = key(r, c);
                if (merges.covered.has(k)) return null;

                // A drawn block takes its content and look from its anchor cell.
                const drawn = merges.owners.get(k);
                const span = drawn ?? { merge: null, rowSpan: 1, colSpan: 1 };
                const sourceRow = drawn ? drawn.merge.top : r;
                const sourceCol = drawn ? drawn.merge.left : c;

                const address = formatAddress({ col: sourceCol, row: sourceRow + 1 });
                const cell = sheet.cells[address];
                const style = styleOfCell(grid, index, sourceRow, sourceCol, cell);
                const view: CellView = viewOf(evaluation, sheet, address, cell, style);

                const own = cssForStyle(style, cssCtx);
                const {
                  transform: rotateTransform,
                  writingMode,
                  textOrientation,
                  verticalAlign,
                  ...cellCss
                } = own;
                const pad = Math.max(1, Math.round(2 * z));
                const css: CSSProperties = {
                  ...cellCss,
                  boxShadow: sheet.showGridlines ? `inset -1px -1px 0 ${GRIDLINE}` : undefined,
                  overflow: 'hidden',
                  verticalAlign: 'top',
                  paddingTop: 0,
                  paddingBottom: 0,
                  paddingRight: pad,
                  // The indent, when the style has one, arrives in cellCss.paddingLeft.
                  paddingLeft: cellCss.paddingLeft ?? pad,
                  // General alignment: numbers right, text left; an explicit one wins.
                  textAlign: cellCss.textAlign ?? view.align,
                };
                if (view.color) css.color = view.color;
                if (view.isError) css.color = '#b91c1c';

                const overlay = sheet.conditionalFormats.length > 0 ? overlayFor(sheet, sourceRow, sourceCol, ctx) : null;
                if (overlay) Object.assign(css, cssForDxf(overlay));

                if (view.kind === 'input' && !css.backgroundColor) {
                  css.backgroundColor = INPUT_BG;
                }
                if (view.kind === 'input') {
                  css.outline = `1px solid ${INPUT_RING}`;
                  css.outlineOffset = '-1px';
                }

                const block: Rect = drawn
                  ? { top: drawn.merge.top, left: drawn.merge.left, bottom: drawn.merge.bottom, right: drawn.merge.right }
                  : { top: r, left: c, bottom: r, right: c };
                const isActive = !!interaction?.active && interaction.active.row === r && interaction.active.col === c;
                const isSelected = !!interaction?.selection && rectsOverlap(block, interaction.selection);
                const isInvalid = !!interaction?.invalid.has(address);
                if (isSelected && !isActive) {
                  // Shade over the cell's own fill instead of replacing it.
                  css.backgroundImage = 'linear-gradient(rgba(37,99,235,0.14), rgba(37,99,235,0.14))';
                }
                if (isInvalid) {
                  css.outline = '2px solid #dc2626';
                  css.outlineOffset = '-2px';
                }
                if (isActive) {
                  css.outline = `2px solid ${isInvalid ? '#dc2626' : '#2563eb'}`;
                  css.outlineOffset = '-2px';
                }

                const frozenRow = r < freezeRows;
                const frozenCol = c < freezeCols;
                if (frozenRow || frozenCol) {
                  css.position = 'sticky';
                  if (frozenRow) css.top = frozenTop(r);
                  if (frozenCol) css.left = headerW + Math.round((index.colLeft.get(c) ?? 0) * z);
                  css.zIndex = frozenRow && frozenCol ? 3 : 2;
                  if (!css.backgroundColor) css.backgroundColor = '#fff';
                } else if (interaction) {
                  css.position = 'relative'; // the "*" marker of a required cell is placed against the cell
                }

                const content =
                  view.kind === 'static' && cell?.k === 'text' && cell.runs && cell.runs.length > 0
                    ? renderRuns(cell.runs)
                    : view.text;

                // Excel clips a cell to its row height; a table row would grow
                // instead and push every frozen offset below it out of place.
                let blockHeight = 0;
                const blockRows = drawn
                  ? rows.filter((vr) => vr >= drawn.merge.top && vr <= drawn.merge.bottom)
                  : [r];
                for (const vr of blockRows) blockHeight += Math.round((sheet.rowHeightsPx[vr] ?? 0) * z);
                const rotated = writingMode !== undefined;
                const wrapStyle: CSSProperties = {
                  height: blockHeight,
                  overflow: 'hidden',
                  ...(rotated
                    ? { writingMode, textOrientation, transform: rotateTransform }
                    : {
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent:
                          verticalAlign === 'top' ? 'flex-start' : verticalAlign === 'middle' ? 'center' : 'flex-end',
                      }),
                };

                return (
                  <td
                    key={c}
                    id={`gcell-${sheet.name}-${r}-${c}`}
                    role="gridcell"
                    aria-colindex={c + 1 + (showHeaders ? 1 : 0)}
                    aria-readonly={interaction && view.kind === 'input' ? undefined : 'true'}
                    aria-selected={interaction ? isSelected : undefined}
                    aria-invalid={isInvalid ? true : undefined}
                    data-pos={`${r},${c}`}
                    onMouseDown={interaction ? (e) => interaction.onCellMouseDown({ row: r, col: c }, e) : undefined}
                    onMouseEnter={interaction ? (e) => interaction.onCellMouseEnter({ row: r, col: c }, e) : undefined}
                    onDoubleClick={interaction ? (e) => interaction.onCellDoubleClick({ row: r, col: c }, e) : undefined}
                    rowSpan={span.rowSpan > 1 ? span.rowSpan : undefined}
                    colSpan={span.colSpan > 1 ? span.colSpan : undefined}
                    style={css}
                    title={view.isError ? view.hint : view.formula ? `=${view.formula}` : undefined}
                    data-testid={`cell-${address}`}
                    data-kind={view.kind}
                    data-error={view.isError ? 'true' : undefined}
                  >
                    <div style={wrapStyle}>{content}</div>
                    {interaction?.required.has(address) && view.kind === 'input' && (
                      <span aria-hidden="true" style={{ position: 'absolute', top: 0, right: 2, color: '#dc2626', fontSize: 10, lineHeight: 1 }}>
                        *
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {children}
      </div>
    </div>
  );
}
