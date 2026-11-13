import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { permissions as L } from '@/locales/permissions.vi';
import { permissionsApi } from '../api';
import { explainError, type ExplainedError } from '../errors';
import type { CatalogueIndex } from '../labels';
import type { PreviewResult, TeamConfig, TeamRow } from '../types';
import { BTN, BTN_PRIMARY, ErrorBox, PreviewBox } from './ui';

interface Props {
  teams: readonly TeamRow[];
  /** The team whose form is being applied: ticked from the start. */
  sourceTeamId: string;
  config: TeamConfig;
  reason: string;
  index: CatalogueIndex;
  onClose: () => void;
  onDone: (message: string) => void;
  onReload: () => void;
}

const T = L.teams;
const keyOf = (ids: ReadonlySet<string>) => [...ids].sort().join('|');

/**
 * The same configuration for many teams at once: all of them, or none. A preview counts for ONE selection; it
 * unlocks "apply" only while that selection is still the one ticked.
 */
export function ApplyToTeamsDialog({ teams, sourceTeamId, config, reason, index, onClose, onDone, onReload }: Props) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set([sourceTeamId]));
  const [preview, setPreview] = useState<{ key: string; result: PreviewResult } | null>(null);
  const [error, setError] = useState<ExplainedError | null>(null);
  const teamIds = teams.filter((t) => selected.has(t.teamId)).map((t) => t.teamId);
  const current = preview && preview.key === keyOf(selected) ? preview.result : null;

  const toggle = (teamId: string) => {
    const next = new Set(selected);
    if (next.has(teamId)) next.delete(teamId);
    else next.add(teamId);
    setSelected(next);
  };
  const fail = (err: unknown) => setError(explainError(err, index));

  const runPreview = useMutation({
    mutationFn: () => permissionsApi.preview({ teams: teamIds.map((teamId) => ({ teamId, config })) }),
    onSuccess: (result) => {
      setError(null);
      setPreview({ key: keyOf(selected), result });
    },
    onError: fail,
  });
  const apply = useMutation({
    mutationFn: () =>
      permissionsApi.applyTeams({
        teamIds,
        config,
        // The revision of EVERY team, as it was read (0 = the team has no configuration of its own).
        expected: Object.fromEntries(teams.filter((t) => selected.has(t.teamId)).map((t) => [t.teamId, t.revision])),
        ...(reason ? { reason } : {}),
      }),
    onSuccess: () => onDone(T.applied(teamIds.length)),
    onError: fail,
  });

  return (
    <div data-testid="team-apply-dialog" className="rounded-lg border border-slate-300 bg-slate-50 p-4">
      <h3 className="text-sm font-bold text-slate-700">{T.applyTitle}</h3>
      <p className="mt-1 text-xs text-slate-500">{T.applyHint}</p>
      <ul className="mt-2 max-h-56 overflow-y-auto rounded border border-slate-200 bg-white p-2 text-sm">
        {teams.map((t) => (
          <li key={t.teamId}>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" data-testid={`team-apply-pick-${t.teamId}`} checked={selected.has(t.teamId)} onChange={() => toggle(t.teamId)} />
              {t.name}
            </label>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-slate-600" data-testid="team-apply-count">
        {T.applySelected(teamIds.length)}
      </p>
      <div className="mt-2 space-y-2">
        <ErrorBox error={error} onReload={onReload} testId="team-apply-error" />
        <PreviewBox result={current} index={index} testId="team-apply-preview" />
        {!current && <p className="text-xs text-slate-500">{T.applyNeedsPreview}</p>}
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" data-testid="team-apply-preview-btn" className={BTN} disabled={teamIds.length === 0 || runPreview.isPending} onClick={() => runPreview.mutate()}>
          {runPreview.isPending ? T.previewing : T.preview}
        </button>
        <button type="button" data-testid="team-apply-confirm" className={BTN_PRIMARY} disabled={!current || teamIds.length === 0 || apply.isPending} onClick={() => { setError(null); apply.mutate(); }}>
          {apply.isPending ? T.applying : T.applyConfirm}
        </button>
        <button type="button" data-testid="team-apply-cancel" className={BTN} onClick={onClose}>
          {L.common.cancel}
        </button>
      </div>
    </div>
  );
}
