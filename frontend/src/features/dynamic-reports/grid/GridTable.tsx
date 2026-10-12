import { useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { GridCell, GridModel, GridRun, GridStyle } from '../engine/generated/grid-types';
import { formatAddress } from '../engine/generated/paste';
import { buildSheetIndex, spanOf, key } from './gridIndex';
import type { SheetIndex } from './gridIndex';
import { cssForDxf, cssForStyle } from './styleToCss';
import { viewOf } from './gridEvaluation';
import type { CellView, GridEvaluation } from './gridEvaluation';
import { overlayFor } from './conditional';

/**
 * Read-only drawing of one sheet of a template, as a real <table>: merged
 * blocks as row/col spans, widths and heights from the file, borders, fills,
 * fonts and number formats as the officer sees them in Excel, frozen panes as
 * sticky rows/columns, hidden rows/columns omitted.
 *
 * Gridlines are an inset shadow rather than borders so they never compete with
 * the template's own borders in `border-collapse` resolution.
 */

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
}: GridTableProps) {
  const sheet = grid.sheets.find((s) => s.name === sheetName);
  const index = useMemo(() => (sheet ? buildSheetIndex(sheet) : null), [sheet]);

  const inputRows = useMemo(() => {
    const rows = new Set<number>();
    if (!sheet) return rows;
    for (const f of evaluation.fieldAt.values()) {
      if (f.sheetKey !== sheet.name) continue;
      const m = /^[A-Z]+(\d+)$/.exec(f.address);
      if (m) rows.add(Number(m[1]) - 1);
    }
    return rows;
  }, [sheet, evaluation]);

  if (!sheet || !index) return null;

  const z = zoom / 100;
  const cssCtx = { defaultFont: grid.defaultFont, z };
  const headerH = showHeaders ? Math.round(20 * z) : 0;
  const headerW = showHeaders ? Math.round(40 * z) : 0;
  const freezeRows = sheet.freeze.rows;
  const freezeCols = sheet.freeze.cols;
  const ctx = evaluation.evaluator.contextFor(sheet.name);

  const rows = index.visibleRows.filter(
    (r) => !onlyInputRows || r < freezeRows || inputRows.has(r),
  );

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
      className="overflow-auto border border-slate-300 rounded bg-white"
      style={{ maxHeight }}
      data-testid={`grid-scroll-${sheet.name}`}
    >
      <table
        style={tableStyle}
        role="grid"
        aria-readonly="true"
        aria-label={`Bảng ${sheet.name}`}
        aria-rowcount={sheet.rows}
        aria-colcount={sheet.cols}
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
            <tr style={{ height: headerH }}>
              <th
                scope="col"
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
            <tr key={r} style={{ height: Math.round((sheet.rowHeightsPx[r] ?? 0) * z) }} aria-rowindex={r + 1}>
              {showHeaders && (
                <th
                  scope="row"
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
                if (index.covered.has(k)) return null;

                const merge = index.mergeByAnchor.get(k);
                const span = merge ? spanOf(index, merge) : { rowSpan: 1, colSpan: 1 };
                if (span.rowSpan === 0 || span.colSpan === 0) return null;

                const address = formatAddress({ col: c, row: r + 1 });
                const cell = sheet.cells[address];
                const style = styleOfCell(grid, index, r, c, cell);
                const view: CellView = viewOf(evaluation, sheet, address, cell, style);

                const css: CSSProperties = {
                  ...cssForStyle(style, cssCtx),
                  boxShadow: sheet.showGridlines ? `inset -1px -1px 0 ${GRIDLINE}` : undefined,
                  overflow: 'hidden',
                  paddingTop: 0,
                  paddingBottom: 0,
                  paddingLeft: style.indent ? undefined : Math.max(1, Math.round(2 * z)),
                  paddingRight: Math.max(1, Math.round(2 * z)),
                  textAlign: style.hAlign ? undefined : view.align,
                  ...(style.hAlign === 'left' || style.hAlign === 'right' || style.hAlign === 'center'
                    ? { textAlign: style.hAlign }
                    : {}),
                };
                if (view.color) css.color = view.color;
                if (view.isError) css.color = '#b91c1c';

                const overlay = sheet.conditionalFormats.length > 0 ? overlayFor(sheet, r, c, ctx) : null;
                if (overlay) Object.assign(css, cssForDxf(overlay));

                if (view.kind === 'input' && !css.backgroundColor) {
                  css.backgroundColor = INPUT_BG;
                }
                if (view.kind === 'input') {
                  css.outline = `1px solid ${INPUT_RING}`;
                  css.outlineOffset = '-1px';
                }

                const frozenRow = r < freezeRows;
                const frozenCol = c < freezeCols;
                if (frozenRow || frozenCol) {
                  css.position = 'sticky';
                  if (frozenRow) css.top = frozenTop(r);
                  if (frozenCol) css.left = headerW + Math.round((index.colLeft.get(c) ?? 0) * z);
                  css.zIndex = frozenRow && frozenCol ? 3 : 2;
                  if (!css.backgroundColor) css.backgroundColor = '#fff';
                }

                const content =
                  view.kind === 'static' && cell?.k === 'text' && cell.runs && cell.runs.length > 0
                    ? renderRuns(cell.runs)
                    : view.text;

                return (
                  <td
                    key={c}
                    role="gridcell"
                    aria-colindex={c + 1}
                    aria-readonly="true"
                    rowSpan={span.rowSpan > 1 ? span.rowSpan : undefined}
                    colSpan={span.colSpan > 1 ? span.colSpan : undefined}
                    style={css}
                    title={view.isError ? view.hint : view.formula ? `=${view.formula}` : undefined}
                    data-testid={`cell-${address}`}
                    data-kind={view.kind}
                    data-error={view.isError ? 'true' : undefined}
                  >
                    {content}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
