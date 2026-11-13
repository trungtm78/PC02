/**
 * "Tiêu chí" of one team in a period that is running (D09): the configuration never reaches a running period by
 * itself; this does, with a reason. The same checklist as the teams step, ticked with what the team reports now.
 *
 * The way back is the action itself: tick the criteria again and save. Everything ticked is sent as null ("every
 * criterion"), so the team is back to reporting the whole report.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import TeamCriteriaChecklist from '@/features/dynamic-reports/criteria/TeamCriteriaChecklist';
import { itemKeysForPayload, periodChecklist } from '@/features/dynamic-reports/criteria/criteria';
import { extractApiError } from '@/lib/api-errors';
import { A11Y_FOCUS_RING } from '@/constants/styles';
import { periodCriteriaErrorText, reportCriteria } from '@/locales/reportCriteria.vi';

const t = reportCriteria.period;

export const PERIOD_CRITERIA_QUERY_KEY = (periodId: string) => ['dynamic-reports', 'period-criteria', periodId];

interface Props {
  periodId: string;
  assignmentId: string;
  teamId: string;
  teamName: string;
  onClose: () => void;
  /** The server answered: `changed` false means the team already reported exactly this. */
  onSaved: (result: { changed: boolean; ticked: number; total: number }) => void;
}

export default function PeriodTeamCriteriaPanel({ periodId, assignmentId, teamId, teamName, onClose, onSaved }: Props) {
  const criteriaQ = useQuery({
    queryKey: PERIOD_CRITERIA_QUERY_KEY(periodId),
    queryFn: () => dynamicReportsApi.loadPeriodCriteria(periodId),
    // What the team reports now must be what the server has now, not what an earlier visit saw.
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
  const checklist = useMemo(
    () => (criteriaQ.data ? periodChecklist(criteriaQ.data, assignmentId) : null),
    [criteriaQ.data, assignmentId],
  );
  // Null until the person changes a tick: the ticks are then what the team reports now.
  const [edited, setEdited] = useState<Set<string> | null>(null);
  const [reason, setReason] = useState('');
  const [reasonMissing, setReasonMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ticked = edited ?? checklist?.ticked ?? new Set<string>();
  const total = checklist?.allKeys.length ?? 0;
  const canSave = !!checklist && total > 0 && ticked.size > 0 && reason.trim() !== '' && !busy;

  async function save() {
    if (!checklist) return;
    if (reason.trim() === '') {
      setReasonMissing(true);
      return;
    }
    if (ticked.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const result = await dynamicReportsApi.setAssignmentCriteria(
        periodId,
        assignmentId,
        // Everything ticked is "every criterion", not today's list: null.
        itemKeysForPayload(ticked, checklist.allKeys) ?? null,
        reason.trim(),
      );
      onSaved({ changed: result.changed, ticked: ticked.size, total });
    } catch (err) {
      const e = extractApiError(err);
      setError(periodCriteriaErrorText(e.code, e.message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white border border-blue-300 rounded-lg p-4 mb-6" data-testid="criteria-panel">
      <p className="text-sm font-medium text-slate-800 mb-1">{t.title(teamName)}</p>
      <p className="text-xs text-slate-500 mb-2">{t.hint}</p>

      {error && (
        <p className="text-sm text-red-700 mb-2" data-testid="criteria-error" role="alert">
          {error}
        </p>
      )}

      {criteriaQ.isLoading && (
        <p className="text-sm text-slate-500" data-testid="criteria-loading">
          {t.loading}
        </p>
      )}
      {criteriaQ.isError && (
        <div className="text-sm text-red-700" data-testid="criteria-load-error" role="alert">
          <p>{t.loadError}</p>
          <button
            type="button"
            data-testid="btn-criteria-retry"
            onClick={() => void criteriaQ.refetch()}
            className={`mt-1 px-3 py-1 border border-red-300 rounded-lg hover:bg-red-50 ${A11Y_FOCUS_RING}`}
          >
            {t.retry}
          </button>
        </div>
      )}
      {checklist && total === 0 && (
        <p className="text-sm text-slate-500" data-testid="criteria-none">
          {t.noCriteria}
        </p>
      )}

      {checklist && total > 0 && (
        <>
          <TeamCriteriaChecklist
            teamId={teamId}
            teamName={teamName}
            groups={checklist.groups}
            total={total}
            ticked={ticked}
            onChange={setEdited}
            otherTeams={[]}
            onCopyFrom={() => undefined}
            onApplyToAll={() => undefined}
            defaultOpen
          />
          {ticked.size === 0 && (
            <p className="text-sm text-red-700 mt-2" data-testid="criteria-empty-error" role="alert">
              {t.emptyTicks}
            </p>
          )}

          <label className="block text-sm text-slate-600 mt-3 mb-1" htmlFor="criteria-reason">
            {t.reason}
          </label>
          <textarea
            id="criteria-reason"
            data-testid="criteria-reason-input"
            value={reason}
            required
            aria-invalid={reasonMissing && reason.trim() === '' ? true : undefined}
            onChange={(e) => {
              setReason(e.target.value);
              setReasonMissing(false);
            }}
            onBlur={() => setReasonMissing(reason.trim() === '')}
            rows={2}
            className="w-full border border-slate-300 rounded px-2 py-1 text-sm"
            placeholder={t.reasonPlaceholder}
          />
          {reasonMissing && reason.trim() === '' && (
            <p className="text-xs text-red-700" data-testid="criteria-reason-error">
              {t.reasonRequired}
            </p>
          )}
        </>
      )}

      <div className="flex items-center gap-2 mt-2">
        {checklist && total > 0 && (
          <button
            type="button"
            data-testid="btn-confirm-criteria"
            disabled={!canSave}
            onClick={() => void save()}
            className={`px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 ${A11Y_FOCUS_RING}`}
          >
            {busy ? t.saving : t.save}
          </button>
        )}
        <button
          type="button"
          data-testid="btn-cancel-criteria"
          disabled={busy}
          onClick={onClose}
          className={`px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 rounded-lg disabled:opacity-50 ${A11Y_FOCUS_RING}`}
        >
          {t.cancel}
        </button>
      </div>
    </div>
  );
}
