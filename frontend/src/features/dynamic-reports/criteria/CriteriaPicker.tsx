/**
 * "Chọn tiêu chí từ file Excel", first half: upload any workbook, choose ONE sheet, then point at one column (all of
 * it, or some of its cells) on the drawn sheet. The browser only says WHERE it picked; the server reads the text.
 *
 * When the sheet cannot be drawn the author types the column letter and a row range instead: never a dead end.
 */
import { useMemo, useState } from 'react';
import { AlertCircle, ListChecks } from 'lucide-react';
import { dynamicReportsApi } from '../api';
import GridViewer from '../grid/GridViewer';
import type { GridMarkBinding } from '../grid/GridViewer';
import type { GridModel } from '../engine/generated/grid-types';
import type { CriteriaExtractResult, CriteriaHierarchy, SheetInfo } from '../types';
import { extractApiError } from '@/lib/api-errors';
import { A11Y_FOCUS_RING } from '@/constants/styles';
import { criteriaErrorText, reportCriteria } from '@/locales/reportCriteria.vi';
import {
  applyCellPick,
  candidateAddresses,
  chosenKeys,
  columnLetters,
  normaliseColumn,
  rowsFromRange,
  selectWholeColumn,
  sheetColumns,
} from './criteria';
import type { ColumnSelection } from './criteria';

const t = reportCriteria.picker;
const HIERARCHIES: Array<{ value: CriteriaHierarchy; label: string }> = [
  { value: 'NONE', label: t.hierarchyNone },
  { value: 'INDENT', label: t.hierarchyIndent },
  { value: 'NUMBERING', label: t.hierarchyNumbering },
];
/** Offered for the code / unit column when the sheet could not be drawn and its width is unknown. */
const FALLBACK_COLUMNS = Array.from({ length: 26 }, (_, i) => columnLetters(i));
const NO_FIELDS: never[] = [];
const NO_VALUES = {};

interface Props {
  /** The criteria read from the picked cells, and the file they came from. */
  onExtracted: (result: CriteriaExtractResult, file: File) => void;
  /** Shown under the read button when a list is already under review (reading again replaces it). */
  rereadNote?: string;
}

export default function CriteriaPicker({ onExtracted, rereadNote }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<SheetInfo[]>([]);
  const [sheetName, setSheetName] = useState('');
  // undefined = not asked yet; null = the server could not draw this sheet.
  const [grid, setGrid] = useState<GridModel | null | undefined>(undefined);
  const [selection, setSelection] = useState<ColumnSelection | null>(null);
  const [switchedTo, setSwitchedTo] = useState<string | null>(null);
  const [manualColumn, setManualColumn] = useState('');
  const [manualFrom, setManualFrom] = useState('');
  const [manualTo, setManualTo] = useState('');
  const [codeColumn, setCodeColumn] = useState('');
  const [unitColumn, setUnitColumn] = useState('');
  const [hierarchy, setHierarchy] = useState<CriteriaHierarchy>('NONE');
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sheet = useMemo(() => grid?.sheets.find((s) => s.name === sheetName) ?? null, [grid, sheetName]);
  const candidates = useMemo(() => (sheet ? candidateAddresses(sheet) : []), [sheet]);
  const candidateKeys = useMemo(() => new Set(candidates.map((a) => `${sheetName}!${a}`)), [candidates, sheetName]);
  const chosen = useMemo(() => chosenKeys(sheetName, selection, candidates), [sheetName, selection, candidates]);
  const columns = sheet ? sheetColumns(sheet) : FALLBACK_COLUMNS;

  function resetPick() {
    setSelection(null);
    setSwitchedTo(null);
    setManualColumn('');
    setManualFrom('');
    setManualTo('');
    setCodeColumn('');
    setUnitColumn('');
  }

  async function handleFile(f: File | null) {
    setError(null);
    setFile(f);
    setSheets([]);
    setSheetName('');
    setGrid(undefined);
    resetPick();
    if (!f) return;
    setLoading(true);
    try {
      setSheets(await dynamicReportsApi.listTemplateSheets(f));
    } catch (err) {
      const e = extractApiError(err);
      setError(criteriaErrorText(e.code, e.message));
    } finally {
      setLoading(false);
    }
  }

  async function handleSheet(name: string) {
    setError(null);
    setSheetName(name);
    setGrid(undefined);
    resetPick();
    if (!file || !name) return;
    setLoading(true);
    try {
      const preview = await dynamicReportsApi.previewTemplate(file, [name]);
      setGrid(preview.grid?.sheets.some((s) => s.name === name) ? preview.grid : null);
    } catch {
      // The sheet could not be read as a template; its column can still be named by hand below.
      setGrid(null);
    } finally {
      setLoading(false);
    }
  }

  const mark: GridMarkBinding = {
    candidates: candidateKeys,
    chosen,
    legend: t.legend,
    onPick: (keys, additive) => {
      const prefix = `${sheetName}!`;
      const outcome = applyCellPick(
        selection,
        keys.filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length)),
        additive,
      );
      setSelection(outcome.selection);
      setSwitchedTo(outcome.switched && outcome.selection ? outcome.selection.column : null);
    },
  };

  // What will be sent: the pick on the grid, or the typed column and rows when there is no grid.
  const typedColumn = normaliseColumn(manualColumn);
  const typedRows = rowsFromRange(manualFrom, manualTo);
  const typedTouched = manualColumn.trim() !== '' || manualFrom.trim() !== '' || manualTo.trim() !== '';
  const picked: ColumnSelection | null =
    grid === null ? (typedColumn && typedRows ? { column: typedColumn, rows: typedRows.rows } : null) : selection;
  const canExtract = !!file && !!sheetName && picked !== null && !extracting && !loading;

  async function handleExtract() {
    if (!file || !picked) return;
    setError(null);
    setExtracting(true);
    try {
      const result = await dynamicReportsApi.extractCriteria(file, {
        sheet: sheetName,
        column: picked.column,
        ...(picked.rows ? { rows: picked.rows } : {}),
        ...(codeColumn ? { codeColumn } : {}),
        ...(unitColumn ? { unitColumn } : {}),
        hierarchy,
      });
      onExtracted(result, file);
    } catch (err) {
      const e = extractApiError(err);
      setError(criteriaErrorText(e.code, e.message));
    } finally {
      setExtracting(false);
    }
  }

  return (
    <div data-testid="criteria-picker">
      <label className="block text-sm font-medium text-slate-700 mb-2" htmlFor="criteria-file-input">
        {t.fileLabel}
      </label>
      <input
        id="criteria-file-input"
        type="file"
        accept=".xlsx"
        data-testid="criteria-file-input"
        disabled={loading || extracting}
        onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
        className="block w-full text-sm text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:text-sm file:font-medium hover:file:bg-blue-100"
      />

      {loading && (
        <p className="text-sm text-slate-500 mt-3" data-testid="criteria-loading">
          {t.loading}
        </p>
      )}

      {sheets.length > 0 && (
        <label className="block text-sm mt-4 max-w-sm">
          <span className="font-medium text-slate-700">{t.sheetLabel}</span>
          <select
            data-testid="criteria-sheet"
            value={sheetName}
            disabled={loading || extracting}
            onChange={(e) => void handleSheet(e.target.value)}
            className={`block w-full mt-1 border border-slate-300 rounded px-3 py-2 text-sm ${A11Y_FOCUS_RING}`}
          >
            <option value="">{t.sheetPlaceholder}</option>
            {sheets.map((s) => (
              <option key={s.name} value={s.name}>
                {s.state === 'visible' ? s.name : `${s.name} (${t.hidden})`}
              </option>
            ))}
          </select>
        </label>
      )}

      {sheetName && grid && sheet && (
        <div className="mt-4" data-testid="criteria-grid-section">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">{t.gridHeading}</h3>
          <GridViewer
            versionId="criteria-source"
            grid={grid}
            fields={NO_FIELDS}
            values={NO_VALUES}
            mark={mark}
            onColumnHeaderClick={(column) => {
              setSwitchedTo(selection && selection.column !== column ? column : null);
              setSelection(selectWholeColumn(column));
            }}
            selectedColumn={selection?.column ?? null}
            columnHeaderLabel={t.columnHeaderTitle}
          />
          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm">
            <span className="font-medium text-slate-800" data-testid="criteria-selected-count" aria-live="polite">
              {selection
                ? `${t.selected(chosen.size, selection.column)}${selection.rows === null ? ` (${t.wholeColumn})` : ''}`
                : t.nothingSelected}
            </span>
            {selection && (
              <button
                type="button"
                data-testid="btn-criteria-clear"
                onClick={() => {
                  setSelection(null);
                  setSwitchedTo(null);
                }}
                className={`text-slate-600 underline hover:text-slate-900 ${A11Y_FOCUS_RING}`}
              >
                {t.clear}
              </button>
            )}
          </div>
          {switchedTo && (
            <p className="text-sm text-amber-700 mt-1" data-testid="criteria-switched-note" role="status">
              {t.switched(switchedTo)}
            </p>
          )}
        </div>
      )}

      {sheetName && grid === null && (
        <div className="mt-4 border border-amber-200 bg-amber-50 rounded-lg p-3" data-testid="criteria-manual-range">
          <p className="text-sm text-amber-800 mb-2">{t.noGrid}</p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-slate-700">
              {t.manualColumn}
              <input
                type="text"
                data-testid="criteria-manual-column"
                value={manualColumn}
                maxLength={3}
                onChange={(e) => setManualColumn(e.target.value)}
                className="block border border-slate-300 rounded px-2 py-1.5 text-sm mt-1 w-28 bg-white"
              />
            </label>
            <label className="text-xs text-slate-700">
              {t.manualFrom}
              <input
                type="text"
                inputMode="numeric"
                data-testid="criteria-manual-from"
                value={manualFrom}
                onChange={(e) => setManualFrom(e.target.value)}
                className="block border border-slate-300 rounded px-2 py-1.5 text-sm mt-1 w-24 bg-white"
              />
            </label>
            <label className="text-xs text-slate-700">
              {t.manualTo}
              <input
                type="text"
                inputMode="numeric"
                data-testid="criteria-manual-to"
                value={manualTo}
                onChange={(e) => setManualTo(e.target.value)}
                className="block border border-slate-300 rounded px-2 py-1.5 text-sm mt-1 w-24 bg-white"
              />
            </label>
          </div>
          <p className="text-xs text-slate-600 mt-2">{t.manualHint}</p>
          {typedTouched && picked === null && (
            <p className="text-xs text-red-700 mt-1" data-testid="criteria-manual-invalid">
              {t.manualInvalid}
            </p>
          )}
        </div>
      )}

      {sheetName && grid !== undefined && (
        <div className="mt-4">
          <div className="flex flex-wrap items-end gap-4">
            <label className="text-xs text-slate-700">
              {t.codeColumn}
              <select
                data-testid="criteria-code-column"
                value={codeColumn}
                onChange={(e) => setCodeColumn(e.target.value)}
                className={`block border border-slate-300 rounded px-2 py-1.5 text-sm mt-1 ${A11Y_FOCUS_RING}`}
              >
                <option value="">{t.noColumn}</option>
                {columns.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-700">
              {t.unitColumn}
              <select
                data-testid="criteria-unit-column"
                value={unitColumn}
                onChange={(e) => setUnitColumn(e.target.value)}
                className={`block border border-slate-300 rounded px-2 py-1.5 text-sm mt-1 ${A11Y_FOCUS_RING}`}
              >
                <option value="">{t.noColumn}</option>
                {columns.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="text-xs text-slate-700">
              <legend className="mb-1">{t.hierarchy}</legend>
              <div className="flex gap-3">
                {HIERARCHIES.map((h) => (
                  <label key={h.value} className="flex items-center gap-1 text-sm">
                    <input
                      type="radio"
                      name="criteria-hierarchy"
                      data-testid={`criteria-hierarchy-${h.value}`}
                      checked={hierarchy === h.value}
                      onChange={() => setHierarchy(h.value)}
                    />
                    {h.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <button
            type="button"
            data-testid="btn-extract-criteria"
            disabled={!canExtract}
            onClick={() => void handleExtract()}
            className={`mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed ${A11Y_FOCUS_RING}`}
          >
            <ListChecks className="w-4 h-4" />
            {extracting ? t.extracting : t.extract}
          </button>
          {rereadNote && <p className="text-xs text-slate-500 mt-1">{rereadNote}</p>}
        </div>
      )}

      {error && (
        <div
          className="bg-red-50 border border-red-200 rounded-lg p-3 mt-4 flex items-center gap-2"
          data-testid="criteria-picker-error"
          role="alert"
        >
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
}
