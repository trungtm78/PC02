import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import { dynamicReportsApi } from '../api';
import { extractApiError } from '@/lib/api-errors';
import { A11Y_FOCUS_RING } from '@/constants/styles';
import GridTable from './GridTable';
import type { CellActivation, GridPick } from './GridTable';
import GridEntry from './GridEntry';
import type { GridEntryProps } from './GridEntry';
import GridContributorsPopover from './GridContributorsPopover';
import { evaluateAggregate, evaluateGrid } from './gridEvaluation';
import type { GridField, SubmittedValues } from './gridEvaluation';
import { addressOf } from './gridIndex';
import type { Pos, Rect } from './navigation';
import type { GridModel } from '../engine/generated/grid-types';
import type { FieldAggregateView, FormulaCellView, FormulaSource } from '../types';

/**
 * The read-only template grid with its chrome: sheet tabs, zoom, and the
 * "only rows with inputs" filter. Fetches the model by template version
 * (immutable, so it is cached for the session; the browser revalidates with
 * the server's ETag across sessions).
 *
 * If the server cannot build the grid (422 GRID_UNAVAILABLE / 503 GRID_BUSY),
 * it says so and calls `onUnavailable` so the page can fall back to the list
 * form — never a blank sheet.
 */

const ZOOMS = [80, 100, 125] as const;

/** What turns the viewer into an entry grid: the editable fields and how a typed value is stored. */
export type GridEntryBinding = Pick<
  GridEntryProps,
  'fields' | 'editable' | 'valueOf' | 'onChange' | 'onChangeMany' | 'onLeave' | 'onProblem' | 'serverErrors'
>;

/**
 * The aggregate (S15) view of a period: input cells carry the AGGREGATED figures and formula cells the figures
 * the server worked out; clicking a figure lists the teams behind it. Nothing is typed and nothing is recalculated.
 */
export interface GridAggregateBinding {
  fields: readonly FieldAggregateView[];
  formulaValues: Readonly<Record<string, FormulaCellView>> | null;
  formulaSource: FormulaSource;
  calcEngineVersion: number | null;
}

/**
 * Wizard step S03/S04: the author drags over the template to turn cells into inputs. The grid only PICKS cells;
 * the batch form (type, format, label) and `applyWebMarks` remain the one place that marks them.
 */
export interface GridMarkBinding {
  /** Cells that may be marked as inputs, as "Sheet!A1". */
  candidates: ReadonlySet<string>;
  /** The candidates chosen so far. */
  chosen: ReadonlySet<string>;
  /** A drag ended over these candidates (row-major). `additive`: Ctrl/⌘ was held, add instead of replace. */
  onPick: (keys: string[], additive: boolean) => void;
}

export interface GridViewerProps {
  versionId: string;
  /** A model already in hand (the wizard's preview of a file not yet saved): shown as is, nothing is fetched. */
  grid?: GridModel;
  /** Present: the cells can be picked by dragging (see `GridMarkBinding`). */
  mark?: GridMarkBinding;
  /** The submission's fields and values (entry / read-only views). Not used by the aggregate view. */
  fields?: readonly GridField[];
  values?: SubmittedValues;
  /** Present: the aggregate view. */
  aggregate?: GridAggregateBinding;
  /** Present: the grid can be typed into. Absent: a read-only view. */
  entry?: GridEntryBinding;
  /** Called once if the grid cannot be shown, so the caller can show the list instead. */
  onUnavailable?: (reason: string) => void;
}

const NO_FIELDS: readonly GridField[] = [];

function rectOf(a: Pos, b: Pos): Rect {
  return {
    top: Math.min(a.row, b.row),
    left: Math.min(a.col, b.col),
    bottom: Math.max(a.row, b.row),
    right: Math.max(a.col, b.col),
  };
}

/** The markable and chosen cells of ONE sheet, by address. */
function markersOf(mark: GridMarkBinding, sheetName: string): Map<string, 'candidate' | 'chosen'> {
  const out = new Map<string, 'candidate' | 'chosen'>();
  const prefix = `${sheetName}!`;
  for (const key of mark.candidates) {
    if (!key.startsWith(prefix)) continue;
    out.set(key.slice(prefix.length), mark.chosen.has(key) ? 'chosen' : 'candidate');
  }
  return out;
}
const NO_VALUES: SubmittedValues = {};

function formulaSourceNote(aggregate: GridAggregateBinding): string {
  switch (aggregate.formulaSource) {
    case 'LIVE':
      return 'Số ở các ô công thức được tính từ tổng đang hiển thị.';
    case 'FROZEN':
      return `Số ở các ô công thức là số đã chốt khi chốt kỳ (bộ tính v${aggregate.calcEngineVersion ?? '?'}).`;
    case 'UNAVAILABLE':
      return 'Chưa có số công thức cho kỳ này — các ô công thức hiện dấu —.';
  }
}

export default function GridViewer({
  versionId,
  grid: preloaded,
  mark,
  fields = NO_FIELDS,
  values = NO_VALUES,
  aggregate,
  entry,
  onUnavailable,
}: GridViewerProps) {
  const fetched = useQuery({
    queryKey: ['dynamic-reports', 'grid', versionId],
    queryFn: () => dynamicReportsApi.getVersionGrid(versionId),
    // A version's file never changes, so neither does its model.
    staleTime: Infinity,
    retry: false,
    enabled: !preloaded,
  });
  const grid = preloaded ?? fetched.data;
  const isLoading = !preloaded && fetched.isLoading;
  const error = preloaded ? null : fetched.error;

  const [sheetChoice, setSheetChoice] = useState<string | null>(null);
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]>(100);
  const [onlyInputRows, setOnlyInputRows] = useState(false);

  const evaluation = useMemo(() => {
    if (!grid) return null;
    return aggregate
      ? evaluateAggregate(grid, aggregate.fields, aggregate.formulaValues)
      : evaluateGrid(grid, fields, values);
  }, [grid, aggregate, fields, values]);

  // The figure whose teams are listed; a second click on the same cell closes it.
  const [opened, setOpened] = useState<{ fieldKey: string; element: HTMLElement } | null>(null);
  const openedField = useMemo(
    () => (opened && aggregate ? (aggregate.fields.find((f) => f.fieldKey === opened.fieldKey) ?? null) : null),
    [opened, aggregate],
  );

  // Picking cells by dragging (mark mode). The block lives here, the cells it covers are worked out when the
  // button is released anywhere — a release outside the grid must still end the drag.
  const [drag, setDrag] = useState<{ anchor: Pos; focus: Pos; additive: boolean } | null>(null);
  const markRef = useRef(mark);
  markRef.current = mark;
  const sheetNameRef = useRef('');
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const finish = () => {
      const d = dragRef.current;
      setDrag(null);
      const binding = markRef.current;
      if (!d || !binding) return;
      const top = Math.min(d.anchor.row, d.focus.row);
      const bottom = Math.max(d.anchor.row, d.focus.row);
      const left = Math.min(d.anchor.col, d.focus.col);
      const right = Math.max(d.anchor.col, d.focus.col);
      const keys: string[] = [];
      for (let r = top; r <= bottom; r++) {
        for (let c = left; c <= right; c++) {
          const key = `${sheetNameRef.current}!${addressOf(r, c)}`;
          if (binding.candidates.has(key)) keys.push(key);
        }
      }
      binding.onPick(keys, d.additive);
    };
    document.addEventListener('mouseup', finish);
    return () => document.removeEventListener('mouseup', finish);
  }, [dragging]);

  function activate(a: CellActivation) {
    setOpened((cur) => (cur?.fieldKey === a.field.fieldKey ? null : { fieldKey: a.field.fieldKey, element: a.element }));
  }

  const unavailableMessage = useMemo(() => {
    if (isLoading) return null;
    if (error) return extractApiError(error).message;
    if (!grid) return 'Chưa dựng được lưới cho mẫu này — dùng dạng danh sách.';
    return null;
  }, [isLoading, error, grid]);

  // Tell the page once per failure; it decides what to show instead. The
  // callback is read through a ref so a parent that passes a fresh function on
  // every render cannot make one failure announce itself again and again.
  const onUnavailableRef = useRef(onUnavailable);
  onUnavailableRef.current = onUnavailable;
  const announced = useRef<string | null>(null);
  useEffect(() => {
    if (!unavailableMessage) {
      announced.current = null;
      return;
    }
    const id = `${versionId}:${unavailableMessage}`;
    if (announced.current === id) return;
    announced.current = id;
    onUnavailableRef.current?.(unavailableMessage);
  }, [unavailableMessage, versionId]);

  if (isLoading) {
    return (
      <div className="text-sm text-slate-500 p-4" data-testid="grid-loading">
        Đang dựng bảng…
      </div>
    );
  }

  if (unavailableMessage || !grid || !evaluation) {
    const message = unavailableMessage ?? 'Chưa dựng được lưới cho mẫu này — dùng dạng danh sách.';
    return (
      <div
        className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2"
        data-testid="grid-unavailable"
        role="alert"
      >
        <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0" />
        <p className="text-sm text-amber-800">{message}</p>
      </div>
    );
  }

  const sheetName =
    sheetChoice && grid.sheetOrder.includes(sheetChoice) ? sheetChoice : grid.sheetOrder[0];
  sheetNameRef.current = sheetName;

  const pick: GridPick | undefined = mark
    ? {
        markers: markersOf(mark, sheetName),
        selection: drag ? rectOf(drag.anchor, drag.focus) : null,
        onCellMouseDown: (pos: Pos, e: ReactMouseEvent) => {
          if (e.button !== 0) return;
          e.preventDefault(); // no text selection while dragging over cells
          setDrag({ anchor: pos, focus: pos, additive: e.ctrlKey || e.metaKey });
        },
        onCellMouseEnter: (pos: Pos) => {
          setDrag((cur) => (cur ? { ...cur, focus: pos } : cur));
        },
      }
    : undefined;

  return (
    <div data-testid="grid-viewer">
      <div className="flex flex-wrap items-center gap-3 mb-2">
        {grid.sheetOrder.length > 1 && (
          <div role="tablist" aria-label="Sheet" className="flex gap-1">
            {grid.sheetOrder.map((name) => (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={name === sheetName}
                data-testid={`grid-tab-${name}`}
                onClick={() => {
                  setSheetChoice(name);
                  setOpened(null);
                }}
                className={`px-3 py-1 text-xs rounded-t border border-b-0 ${
                  name === sheetName
                    ? 'bg-white border-slate-300 font-semibold text-slate-800'
                    : 'bg-slate-100 border-transparent text-slate-600 hover:bg-slate-200'
                } ${A11Y_FOCUS_RING}`}
              >
                {name}
              </button>
            ))}
          </div>
        )}
        <label className="flex items-center gap-1 text-xs text-slate-600 ml-auto">
          Phóng
          <select
            data-testid="grid-zoom"
            value={zoom}
            onChange={(e) => {
              setZoom(Number(e.target.value) as (typeof ZOOMS)[number]);
              setOpened(null);
            }}
            className={`border border-slate-300 rounded px-1 py-0.5 text-xs ${A11Y_FOCUS_RING}`}
          >
            {ZOOMS.map((z) => (
              <option key={z} value={z}>
                {z}%
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1 text-xs text-slate-600">
          <input
            type="checkbox"
            data-testid="grid-only-inputs"
            checked={onlyInputRows}
            onChange={(e) => {
              setOnlyInputRows(e.target.checked);
              setOpened(null);
            }}
          />
          Chỉ hiện dòng có ô nhập
        </label>
      </div>

      {grid.warnings.length > 0 && (
        <p className="text-xs text-amber-700 mb-2" data-testid="grid-warnings">
          Một số định dạng của mẫu chưa vẽ được ({grid.warnings.length}).
        </p>
      )}

      {mark && (
        <p className="text-xs text-slate-600 mb-2" data-testid="mark-legend">
          <span style={{ outline: '2px dashed #d97706', outlineOffset: -2 }} className="inline-block w-3 h-3 align-middle mr-1" />
          ô có thể đánh dấu ·{' '}
          <span style={{ background: '#fde68a', outline: '2px solid #d97706', outlineOffset: -2 }} className="inline-block w-3 h-3 align-middle mr-1" />
          ô đã chọn ·{' '}
          <span style={{ background: '#eef6ff', outline: '1px solid #93c5fd' }} className="inline-block w-3 h-3 align-middle mr-1" />
          ô nhập đã có. Kéo chuột trên bảng để chọn nhiều ô (giữ Ctrl để thêm).
        </p>
      )}

      {aggregate && (
        <p className="text-xs text-slate-500 mb-2" data-testid="formula-source-note">
          {formulaSourceNote(aggregate)}
        </p>
      )}

      {entry ? (
        <GridEntry
          grid={grid}
          sheetName={sheetName}
          evaluation={evaluation}
          zoom={zoom}
          onlyInputRows={onlyInputRows}
          {...entry}
        />
      ) : (
        <GridTable
          grid={grid}
          sheetName={sheetName}
          evaluation={evaluation}
          zoom={zoom}
          onlyInputRows={onlyInputRows}
          onCellActivate={aggregate ? activate : undefined}
          pick={pick}
        />
      )}
      {opened && openedField && (
        <GridContributorsPopover field={openedField} anchor={opened.element} onClose={() => setOpened(null)} />
      )}
    </div>
  );
}
