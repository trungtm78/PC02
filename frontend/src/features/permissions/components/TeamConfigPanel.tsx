import { useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { permissions as L } from '@/locales/permissions.vi';
import { permissionsApi } from '../api';
import { explainError, type ExplainedError } from '../errors';
import type { CatalogueIndex } from '../labels';
import { cleanOverrides, emptyTeamConfig, sameDoc } from '../overrides';
import { TEAM_MODE, TEMPLATE_STATUS, type PreviewResult, type TeamConfig, type TeamMode, type TeamRow, type TemplateSummary } from '../types';
import { ApplyToTeamsDialog } from './ApplyToTeamsDialog';
import { OverridesTable } from './OverridesTable';
import { BTN, BTN_DANGER, BTN_PRIMARY, CARD, ErrorBox, INPUT, PreviewBox } from './ui';

interface Props {
  team: TeamRow;
  teams: readonly TeamRow[];
  templates: readonly TemplateSummary[];
  index: CatalogueIndex;
  canWrite: boolean;
  /** Something was written: say so and load everything again. */
  onDone: (message: string) => void;
  onReload: () => void;
}

const T = L.teams;
const MODES: { mode: TeamMode; label: string }[] = [
  { mode: TEAM_MODE.INHERIT, label: T.modeInherit },
  { mode: TEAM_MODE.EXPLICIT, label: T.modeExplicit },
];

/** One team's configuration: follow the team above or set its own templates, plus (advanced) its exceptions. */
export function TeamConfigPanel({ team, teams, templates, index, canWrite, onDone, onReload }: Props) {
  const initial = useMemo<TeamConfig>(() => team.config ?? emptyTeamConfig(), [team]);
  const [form, setForm] = useState<TeamConfig>(initial);
  const [reason, setReason] = useState('');
  const [advanced, setAdvanced] = useState(initial.overrides.length > 0);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [error, setError] = useState<ExplainedError | null>(null);
  const [copied, setCopied] = useState('');
  const [applying, setApplying] = useState(false);

  const config: TeamConfig = { ...form, overrides: cleanOverrides(form.overrides) };
  const dirty = !sameDoc(config, initial);
  const explicit = form.mode === TEAM_MODE.EXPLICIT;
  const patch = (change: Partial<TeamConfig>) => {
    setForm((f) => ({ ...f, ...change }));
    setPreview(null);
  };
  const fail = (err: unknown) => setError(explainError(err, index));

  const save = useMutation({
    mutationFn: () =>
      permissionsApi.saveTeam(team.teamId, { ...config, expectedRevision: team.revision, ...(reason.trim() ? { reason: reason.trim() } : {}) }),
    onSuccess: (result) => onDone(result.changed ? L.common.saved : L.common.savedNothing),
    onError: fail,
  });
  const runPreview = useMutation({
    mutationFn: () => permissionsApi.preview({ teams: [{ teamId: team.teamId, config }] }),
    onSuccess: (result) => {
      setError(null);
      setPreview(result);
    },
    onError: fail,
  });
  const removeOwn = useMutation({
    mutationFn: () => permissionsApi.removeTeamConfig(team.teamId, team.revision),
    onSuccess: () => onDone(T.removed),
    onError: fail,
  });

  /** Templates on offer: those in use, plus the one already chosen even if it has been archived since. */
  const templateOptions = (selected: string | null) =>
    templates
      .filter((t) => t.status === TEMPLATE_STATUS.ACTIVE || t.id === selected)
      .map((t) => (
        <option key={t.id} value={t.id}>
          {t.status === TEMPLATE_STATUS.ARCHIVED ? `${t.name} ${T.archivedSuffix}` : t.name}
        </option>
      ));
  const sources = teams.filter((t) => t.teamId !== team.teamId && t.config);
  const copyFrom = (teamId: string) => {
    const source = sources.find((t) => t.teamId === teamId);
    if (!source?.config) return;
    setForm({ ...source.config, overrides: source.config.overrides.map((o) => ({ ...o })) });
    setAdvanced(source.config.overrides.length > 0);
    setPreview(null);
    setCopied(T.copied(source.name));
  };

  return (
    <div className={`${CARD} space-y-3 p-4`} data-testid="team-config-panel">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-bold text-slate-700">
          {team.name} · {T.members(team.members)}
        </h2>
        {dirty && (
          <span data-testid="team-unsaved" className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
            {L.common.unsaved}
          </span>
        )}
      </div>
      {!canWrite && <p className="text-xs text-slate-500">{L.common.readOnly}</p>}

      <fieldset className="flex flex-wrap items-center gap-4 text-sm">
        <legend className="mb-1 text-xs font-medium text-slate-600">{T.mode}</legend>
        {MODES.map(({ mode, label }) => (
          <label key={mode} className="inline-flex items-center gap-1">
            <input type="radio" name="team-mode" data-testid={`team-mode-${mode}`} checked={form.mode === mode} disabled={!canWrite} onChange={() => patch({ mode })} />
            {label}
          </label>
        ))}
      </fieldset>
      {!explicit && (
        <p className="text-sm text-slate-600" data-testid="team-inherit-note">
          {team.governedByTeamName && team.governedByTeamId !== team.teamId ? T.inheritFrom(team.governedByTeamName) : T.inheritRole}
        </p>
      )}

      {explicit && (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-xs font-medium text-slate-600">
            {T.memberTemplate}
            <select
              data-testid="team-member-template"
              className={`${INPUT} mt-1 block w-full`}
              value={form.memberTemplateId ?? ''}
              disabled={!canWrite}
              onChange={(e) => patch({ memberTemplateId: e.target.value || null })}
            >
              <option value="">{T.noTemplate}</option>
              {templateOptions(form.memberTemplateId)}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            {T.leaderTemplate}
            <select
              data-testid="team-leader-template"
              className={`${INPUT} mt-1 block w-full`}
              value={form.leaderTemplateId ?? ''}
              disabled={!canWrite}
              onChange={(e) => patch({ leaderTemplateId: e.target.value || null })}
            >
              <option value="">{T.sameAsMember}</option>
              {templateOptions(form.leaderTemplateId)}
            </select>
          </label>
        </div>
      )}

      {explicit && advanced && (
        <div data-testid="team-advanced">
          <h3 className="mb-1 text-xs font-semibold text-slate-600">{T.overridesTitle}</h3>
          <OverridesTable rows={form.overrides} onChange={(overrides) => patch({ overrides })} index={index} withAudience readOnly={!canWrite} testId="team-override" />
        </div>
      )}

      {canWrite && (
        <label className="block text-xs font-medium text-slate-600">
          {L.common.reason}
          <input data-testid="team-reason" className={`${INPUT} mt-1 block w-full max-w-xl`} value={reason} maxLength={500} placeholder={L.common.reasonPlaceholder} onChange={(e) => setReason(e.target.value)} />
        </label>
      )}

      {copied && dirty && (
        <p className="text-sm text-slate-600" data-testid="team-copied">
          {copied}
        </p>
      )}
      <ErrorBox error={error} onReload={onReload} testId="team-error" />
      <PreviewBox result={preview} index={index} testId="team-preview" />

      <div className="flex flex-wrap items-center gap-2">
        {explicit && (
          <button type="button" data-testid="team-advanced-toggle" className={BTN} onClick={() => setAdvanced((v) => !v)}>
            {advanced ? L.common.advancedHide : L.common.advancedShow}
          </button>
        )}
        <button type="button" data-testid="team-preview-btn" className={BTN} disabled={!dirty || runPreview.isPending} onClick={() => runPreview.mutate()}>
          {runPreview.isPending ? T.previewing : T.preview}
        </button>
        {canWrite && (
          <>
            <button type="button" data-testid="team-save" className={BTN_PRIMARY} disabled={!dirty || save.isPending} onClick={() => { setError(null); save.mutate(); }}>
              {save.isPending ? L.common.saving : L.common.save}
            </button>
            {sources.length > 0 && (
              <select data-testid="team-copy-from" aria-label={T.copyFrom} className={INPUT} value="" onChange={(e) => copyFrom(e.target.value)}>
                <option value="">{T.copyFrom}</option>
                {sources.map((t) => (
                  <option key={t.teamId} value={t.teamId}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
            <button type="button" data-testid="team-apply-many" className={BTN} onClick={() => setApplying(true)}>
              {T.applyMany}
            </button>
            {team.config && (
              <button
                type="button"
                data-testid="team-remove-own"
                className={BTN_DANGER}
                disabled={removeOwn.isPending}
                onClick={() => {
                  if (window.confirm(T.confirmRemove(team.name))) removeOwn.mutate();
                }}
              >
                {T.removeOwn}
              </button>
            )}
          </>
        )}
      </div>

      {applying && (
        <ApplyToTeamsDialog
          teams={teams}
          sourceTeamId={team.teamId}
          config={config}
          reason={reason.trim()}
          index={index}
          onClose={() => setApplying(false)}
          onDone={onDone}
          onReload={onReload}
        />
      )}
    </div>
  );
}
