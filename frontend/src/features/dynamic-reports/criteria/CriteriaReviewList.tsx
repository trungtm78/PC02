/**
 * "Chọn tiêu chí từ file Excel", second half: the criteria read from the file, for the author to correct. Every row
 * can be renamed, given a unit or removed, and a criterion the file does not have can be typed by hand.
 */
import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { CriteriaWarning, Criterion } from '../types';
import { A11Y_FOCUS_RING } from '@/constants/styles';
import { criteriaWarningText, reportCriteria } from '@/locales/reportCriteria.vi';
import { addManualCriterion, depthsOf, parentKeysOf, removeCriterion, splitWarnings, updateCriterion } from './criteria';

const t = reportCriteria.review;

interface Props {
  criteria: Criterion[];
  warnings: CriteriaWarning[];
  onChange: (criteria: Criterion[]) => void;
  disabled?: boolean;
}

export default function CriteriaReviewList({ criteria, warnings, onChange, disabled }: Props) {
  const [newName, setNewName] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [newParent, setNewParent] = useState('');

  const depths = depthsOf(criteria);
  const parents = parentKeysOf(criteria);
  const { byRow, blankRows } = splitWarnings(warnings);

  function add() {
    if (!newName.trim()) return;
    onChange(addManualCriterion(criteria, { name: newName, unit: newUnit, parentItemKey: newParent || null }));
    setNewName('');
    setNewUnit('');
  }

  return (
    <div data-testid="criteria-review">
      <h3 className="text-sm font-semibold text-slate-700 mb-1">{t.heading}</h3>
      <p className="text-sm text-slate-600 mb-2" data-testid="criteria-total">
        {t.total(criteria.length, parents.size)}
      </p>
      {blankRows.length > 0 && (
        <p className="text-xs text-amber-700 mb-2" data-testid="criteria-blank-skipped">
          {t.blankSkipped(blankRows.join(', '))}
        </p>
      )}

      {criteria.length === 0 ? (
        <p className="text-sm text-amber-700 mb-3" data-testid="criteria-empty">
          {t.empty}
        </p>
      ) : (
        <ol className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-96 overflow-y-auto mb-3" data-testid="criteria-list">
          {criteria.map((c, i) => {
            const rowWarnings = c.sourceRow !== null ? (byRow.get(c.sourceRow) ?? []) : [];
            const isParent = parents.has(c.itemKey);
            return (
              <li key={c.itemKey} className="px-3 py-2 text-sm" data-testid={`criterion-${c.itemKey}`} data-depth={depths.get(c.itemKey) ?? 0}>
                <div className="flex items-center gap-2" style={{ paddingLeft: (depths.get(c.itemKey) ?? 0) * 20 }}>
                  <input
                    type="text"
                    data-testid={`criterion-name-${c.itemKey}`}
                    aria-label={t.nameOf(i + 1)}
                    aria-invalid={c.name.trim() === '' ? true : undefined}
                    value={c.name}
                    disabled={disabled}
                    onChange={(e) => onChange(updateCriterion(criteria, c.itemKey, { name: e.target.value }))}
                    className={`flex-1 min-w-0 border rounded px-2 py-1 text-sm ${
                      c.name.trim() === '' ? 'border-red-400' : 'border-slate-200'
                    } ${isParent ? 'font-semibold' : ''}`}
                  />
                  <input
                    type="text"
                    data-testid={`criterion-unit-${c.itemKey}`}
                    aria-label={t.unitOf(i + 1)}
                    placeholder={t.unit}
                    value={c.unit ?? ''}
                    disabled={disabled}
                    onChange={(e) => onChange(updateCriterion(criteria, c.itemKey, { unit: e.target.value || null }))}
                    className="w-28 shrink-0 border border-slate-200 rounded px-2 py-1 text-sm"
                  />
                  <button
                    type="button"
                    data-testid={`btn-remove-criterion-${c.itemKey}`}
                    aria-label={t.removeOf(c.name)}
                    title={t.remove}
                    disabled={disabled}
                    onClick={() => onChange(removeCriterion(criteria, c.itemKey))}
                    className={`shrink-0 text-slate-400 hover:text-red-600 disabled:opacity-50 ${A11Y_FOCUS_RING}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mt-1 text-xs" style={{ paddingLeft: (depths.get(c.itemKey) ?? 0) * 20 }}>
                  {c.origin === 'MANUAL' ? (
                    <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700" data-testid={`criterion-manual-${c.itemKey}`}>
                      {t.manualTag}
                    </span>
                  ) : (
                    c.sourceRow !== null && <span className="text-slate-400">{t.sourceRow(c.sourceRow)}</span>
                  )}
                  {isParent && (
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600" data-testid={`criterion-parent-${c.itemKey}`}>
                      {t.parentTag}
                    </span>
                  )}
                  {c.name.trim() === '' && <span className="text-red-700">{t.nameRequired}</span>}
                  {rowWarnings.map((code) => (
                    <span key={code} className="text-amber-700" data-testid={`criterion-warning-${c.itemKey}-${code}`}>
                      {criteriaWarningText(code)}
                    </span>
                  ))}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <fieldset className="border border-dashed border-slate-300 rounded-lg p-3" data-testid="criteria-add-row">
        <legend className="text-xs font-semibold text-slate-600 px-1">{t.addHeading}</legend>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-700 flex-1 min-w-48">
            {t.addName}
            <input
              type="text"
              data-testid="criteria-add-name"
              value={newName}
              disabled={disabled}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  add();
                }
              }}
              className="block w-full border border-slate-300 rounded px-2 py-1.5 text-sm mt-1"
            />
          </label>
          <label className="text-xs text-slate-700">
            {t.addUnit}
            <input
              type="text"
              data-testid="criteria-add-unit"
              value={newUnit}
              disabled={disabled}
              onChange={(e) => setNewUnit(e.target.value)}
              className="block border border-slate-300 rounded px-2 py-1.5 text-sm mt-1 w-32"
            />
          </label>
          <label className="text-xs text-slate-700">
            {t.addParent}
            <select
              data-testid="criteria-add-parent"
              value={criteria.some((c) => c.itemKey === newParent) ? newParent : ''}
              disabled={disabled}
              onChange={(e) => setNewParent(e.target.value)}
              className={`block border border-slate-300 rounded px-2 py-1.5 text-sm mt-1 max-w-56 ${A11Y_FOCUS_RING}`}
            >
              <option value="">{t.addNoParent}</option>
              {criteria.map((c) => (
                <option key={c.itemKey} value={c.itemKey}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            data-testid="btn-add-criterion"
            disabled={disabled || !newName.trim()}
            onClick={add}
            className={`flex items-center gap-1 px-3 py-2 bg-slate-600 text-white text-sm rounded-lg hover:bg-slate-700 disabled:opacity-50 ${A11Y_FOCUS_RING}`}
          >
            <Plus className="w-4 h-4" />
            {t.add}
          </button>
        </div>
      </fieldset>
    </div>
  );
}
