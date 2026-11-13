/**
 * "Chọn tiêu chí từ file Excel": pick the criteria in a file, review the list, then turn it into the workbook the
 * rest of the wizard already understands. The wizard only gets the generated file and what each of its cells stands
 * for; from there on it is the ordinary template flow.
 *
 * It stays mounted while the wizard moves on (`collapsed`), so going back shows the same pick and the same list.
 */
import { useState } from 'react';
import { AlertCircle, ArrowRight, Pencil } from 'lucide-react';
import { dynamicReportsApi } from '../api';
import type { CriteriaWarning, Criterion } from '../types';
import { extractApiError } from '@/lib/api-errors';
import { A11Y_FOCUS_RING } from '@/constants/styles';
import { criteriaErrorText, reportCriteria } from '@/locales/reportCriteria.vi';
import CriteriaPicker from './CriteriaPicker';
import CriteriaReviewList from './CriteriaReviewList';
import { fileFromBase64, toDrafts } from './criteria';
import type { CriteriaMeta } from './criteria';

const t = reportCriteria.review;

/** The generated workbook, ready to be read like an uploaded template. */
export interface CriteriaBuilt {
  file: File;
  sheetName: string;
  meta: CriteriaMeta;
}

interface Props {
  /** False while the wizard still lacks what it needs before a template can be read (report code and name). */
  canUse: boolean;
  /** The wizard has moved past this part: show one line and a way back instead of the whole picker. */
  collapsed: boolean;
  /** Reads the generated workbook into the wizard. A rejection is shown here and the author stays on the list. */
  onUse: (built: CriteriaBuilt) => Promise<void>;
  /** The author wants to change the pick or the list again. */
  onEdit: () => void;
}

export default function CriteriaSetup({ canUse, collapsed, onUse, onEdit }: Props) {
  const [criteria, setCriteria] = useState<Criterion[] | null>(null);
  const [warnings, setWarnings] = useState<CriteriaWarning[]>([]);
  const [sourceName, setSourceName] = useState('');
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasBlankName = (criteria ?? []).some((c) => c.name.trim() === '');
  const canBuild = canUse && !!criteria && criteria.length > 0 && !hasBlankName && !building;

  async function handleUse() {
    if (!criteria) return;
    setError(null);
    setBuilding(true);
    try {
      const built = await dynamicReportsApi.buildCriteriaWorkbook(toDrafts(criteria));
      // The server's list is the one that was built (keys filled, text trimmed): keep reviewing that one.
      setCriteria(built.criteria);
      await onUse({
        file: fileFromBase64(built.fileBase64, built.fileName),
        sheetName: built.sheetName,
        meta: { criteria: built.criteria, fields: built.fields },
      });
    } catch (err) {
      const e = extractApiError(err);
      setError(criteriaErrorText(e.code, e.message));
    } finally {
      setBuilding(false);
    }
  }

  return (
    <div data-testid="criteria-setup">
      {collapsed && (
        <div className="flex items-center justify-between gap-3 text-sm" data-testid="criteria-used-note">
          <p className="text-slate-700">{reportCriteria.used.summary(criteria?.length ?? 0, sourceName)}</p>
          <button
            type="button"
            data-testid="btn-edit-criteria"
            onClick={onEdit}
            className={`shrink-0 flex items-center gap-1 px-3 py-1.5 border border-slate-300 text-slate-700 text-sm rounded-lg hover:bg-slate-50 ${A11Y_FOCUS_RING}`}
          >
            <Pencil className="w-4 h-4" />
            {reportCriteria.used.edit}
          </button>
        </div>
      )}

      {/* Hidden, not unmounted: the pick on the sheet and the edited list must be there when the author comes back. */}
      <div hidden={collapsed}>
        <CriteriaPicker
          rereadNote={criteria ? t.rereadNote : undefined}
          onExtracted={(result, file) => {
            setCriteria(result.criteria);
            setWarnings(result.warnings);
            setSourceName(file.name);
            setError(null);
          }}
        />

        {criteria && (
          <div className="mt-6 border-t border-slate-200 pt-6">
            <CriteriaReviewList criteria={criteria} warnings={warnings} onChange={setCriteria} disabled={building} />

            {error && (
              <div
                className="bg-red-50 border border-red-200 rounded-lg p-3 mt-4 flex items-center gap-2"
                data-testid="criteria-build-error"
                role="alert"
              >
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 mt-4">
              {!canUse && (
                <p className="text-sm text-amber-700" data-testid="criteria-need-code-name">
                  {t.needCodeName}
                </p>
              )}
              {canUse && hasBlankName && <p className="text-sm text-amber-700">{t.needNames}</p>}
              <button
                type="button"
                data-testid="btn-use-criteria"
                disabled={!canBuild}
                onClick={() => void handleUse()}
                className={`flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed ${A11Y_FOCUS_RING}`}
              >
                {building ? t.using : t.use}
                {!building && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
