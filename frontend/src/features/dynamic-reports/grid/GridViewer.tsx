import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import { dynamicReportsApi } from '../api';
import { extractApiError } from '@/lib/api-errors';
import { A11Y_FOCUS_RING } from '@/constants/styles';
import GridTable from './GridTable';
import GridEntry from './GridEntry';
import type { GridEntryProps } from './GridEntry';
import { evaluateGrid } from './gridEvaluation';
import type { GridField, SubmittedValues } from './gridEvaluation';

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

export interface GridViewerProps {
  versionId: string;
  fields: readonly GridField[];
  values: SubmittedValues;
  /** Present: the grid can be typed into. Absent: a read-only view. */
  entry?: GridEntryBinding;
  /** Called once if the grid cannot be shown, so the caller can show the list instead. */
  onUnavailable?: (reason: string) => void;
}

export default function GridViewer({ versionId, fields, values, entry, onUnavailable }: GridViewerProps) {
  const { data: grid, isLoading, error } = useQuery({
    queryKey: ['dynamic-reports', 'grid', versionId],
    queryFn: () => dynamicReportsApi.getVersionGrid(versionId),
    // A version's file never changes, so neither does its model.
    staleTime: Infinity,
    retry: false,
  });

  const [sheetChoice, setSheetChoice] = useState<string | null>(null);
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]>(100);
  const [onlyInputRows, setOnlyInputRows] = useState(false);

  const evaluation = useMemo(
    () => (grid ? evaluateGrid(grid, fields, values) : null),
    [grid, fields, values],
  );

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
                onClick={() => setSheetChoice(name)}
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
            onChange={(e) => setZoom(Number(e.target.value) as (typeof ZOOMS)[number])}
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
            onChange={(e) => setOnlyInputRows(e.target.checked)}
          />
          Chỉ hiện dòng có ô nhập
        </label>
      </div>

      {grid.warnings.length > 0 && (
        <p className="text-xs text-amber-700 mb-2" data-testid="grid-warnings">
          Một số định dạng của mẫu chưa vẽ được ({grid.warnings.length}).
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
        />
      )}
    </div>
  );
}
