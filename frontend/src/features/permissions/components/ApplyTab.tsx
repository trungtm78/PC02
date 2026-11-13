import { useMemo, useState, useSyncExternalStore } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoadErrorBanner } from '@/components/shared/LoadErrorBanner';
import { extractApiError } from '@/lib/api-errors';
import { formatVNDateTime } from '@/lib/dates';
import { permissions as L, permissionErrorText } from '@/locales/permissions.vi';
import { authStore } from '@/stores/auth.store';
import { authzKeys, permissionsApi } from '../api';
import { explainError, type ExplainedError } from '../errors';
import type { CatalogueIndex } from '../labels';
import {
  AUTHZ_MODE,
  AUTHZ_MODE_ERROR,
  AUTHZ_MODE_STALE_ERRORS,
  MODE_CHANGE_STATUS,
  type AuthzMode,
  type ModeChange,
  type PersonImpact,
  type SwitchableMode,
} from '../types';
import { BTN, BTN_DANGER, BTN_PRIMARY, CARD, ErrorBox, ImpactList, INPUT, Notice } from './ui';

interface Props {
  index: CatalogueIndex;
  canWrite: boolean;
}

const T = L.apply;
const REASON_MAX = 500;
const SUMMARY_KEYS = ['people', 'affected', 'losing', 'gaining', 'changing'] as const;
const BTN_DANGER_SOLID = 'px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50';

const has = (table: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(table, key);
const modeName = (mode: string) => (has(T.modeNames, mode) ? T.modeNames[mode] : mode);
/** The same rule as the server's "losing" count: a permission gone, or one kept that reaches less somewhere. */
const loses = (impact: PersonImpact) => impact.lost.length > 0 || impact.changed.some((d) => d.narrower === true);

function statusText(change: ModeChange, now: number): string {
  if (change.status === MODE_CHANGE_STATUS.PENDING && change.expiresAt && new Date(change.expiresAt).getTime() <= now) return T.statusExpired;
  return has(T.statuses, change.status) ? T.statuses[change.status] : change.status;
}

/** The signed-in person's id, from the cached profile; null until the profile is loaded. */
function useCurrentUserId(): string | null {
  return useSyncExternalStore(
    (onChange) => authStore.onTokenChanged(onChange),
    () => authStore.getProfile()?.id ?? null,
  );
}

type Action =
  | { kind: 'request'; reason: string; acknowledge: string }
  | { kind: 'approve'; id: string; acknowledge: string }
  | { kind: 'close'; id: string; own: boolean }
  | { kind: 'switch'; from: AuthzMode; mode: SwitchableMode; reason: string };

function run(action: Action): Promise<unknown> {
  switch (action.kind) {
    case 'request':
      return permissionsApi.requestEnforce({ reason: action.reason, acknowledge: action.acknowledge });
    case 'approve':
      return permissionsApi.approveEnforce(action.id, { acknowledge: action.acknowledge });
    case 'close':
      return permissionsApi.closeEnforceRequest(action.id);
    case 'switch':
      return permissionsApi.setMode({ mode: action.mode, reason: action.reason });
  }
}

function doneText(action: Action): string {
  switch (action.kind) {
    case 'request':
      return T.done.requested;
    case 'approve':
      return T.done.approved;
    case 'close':
      return action.own ? T.done.withdrawn : T.done.rejected;
    case 'switch':
      if (action.mode === AUTHZ_MODE.SHADOW) return T.done.shadowOn;
      return action.from === AUTHZ_MODE.ENFORCE ? T.done.switchedOff : T.done.shadowOff;
  }
}

/**
 * Switching permissions by team on and off: the mode now, who would gain and lose what, the actions (each with its way
 * back on this same tab), and the past switches. Enforcing takes two administrators, both on the comparison they read.
 */
export function ApplyTab({ index, canWrite }: Props) {
  const queryClient = useQueryClient();
  const currentUserId = useCurrentUserId();
  const [reason, setReason] = useState('');
  // The fingerprint that was on screen when the box was ticked: another comparison arriving unticks it by itself.
  const [readFingerprint, setReadFingerprint] = useState<string | null>(null);
  const [switchTo, setSwitchTo] = useState<SwitchableMode | null>(null);
  const [switchReason, setSwitchReason] = useState('');
  const [error, setError] = useState<ExplainedError | null>(null);
  const [notice, setNotice] = useState('');

  const status = useQuery({ queryKey: authzKeys.mode, queryFn: permissionsApi.mode });
  const comparison = useQuery({ queryKey: authzKeys.modeComparison, queryFn: permissionsApi.modeComparison });

  const statusError = status.isError ? extractApiError(status.error, L.common.unknownError) : null;
  const comparisonError = comparison.isError ? extractApiError(comparison.error, L.common.unknownError) : null;
  const loadText = (e: { code?: string; message: string } | null) => (e ? permissionErrorText(e.code, e.message) : '');

  const fingerprint = comparison.data?.fingerprint ?? null;
  const hasRead = fingerprint !== null && readFingerprint === fingerprint;
  const people = useMemo(() => {
    const impacts = comparison.data?.impacts ?? [];
    // Stable: within each half the server's order is kept.
    return [...impacts.filter(loses), ...impacts.filter((i) => !loses(i))];
  }, [comparison.data]);

  const reloadAll = () => {
    void queryClient.invalidateQueries({ queryKey: authzKeys.mode });
    void queryClient.invalidateQueries({ queryKey: authzKeys.modeComparison });
  };

  const act = useMutation({
    mutationFn: run,
    onSuccess: (_result, action) => {
      setError(null);
      setNotice(doneText(action));
      setReason('');
      setReadFingerprint(null);
      setSwitchTo(null);
      setSwitchReason('');
      // Everything under `authz`: the mode banner of the page reads the catalogue.
      void queryClient.invalidateQueries({ queryKey: authzKeys.all });
    },
    onError: (err) => {
      const explained = explainError(err, index);
      setNotice('');
      setError(explained);
      // What was read is no longer what would happen: it has to be read again.
      if (explained.code === AUTHZ_MODE_ERROR.COMPARISON_CHANGED) setReadFingerprint(null);
      if (explained.code && AUTHZ_MODE_STALE_ERRORS.includes(explained.code)) reloadAll();
    },
  });
  const start = (action: Action) => {
    setError(null);
    setNotice('');
    act.mutate(action);
  };
  const busy = act.isPending;

  const mode = status.data?.mode;
  const pending = status.data?.pending ?? null;
  const enforceAvailable = status.data?.enforceAvailable ?? false;
  const isAsker = pending !== null && currentUserId !== null && pending.requestedById === currentUserId;
  // When the state was read: a request already past its time then reads "expired", not "waiting".
  const now = status.dataUpdatedAt;

  const openSwitch = (target: SwitchableMode) => {
    setError(null);
    setSwitchReason('');
    setSwitchTo(target);
  };
  const switchButton = (target: SwitchableMode, label: string, hint: string, className: string) => (
    <div className="space-y-1" data-testid={`apply-switch-block-${target}`}>
      <button type="button" data-testid={`apply-switch-${target}`} className={className} disabled={busy} onClick={() => openSwitch(target)}>
        {label}
      </button>
      <p className="text-xs text-slate-500">{hint}</p>
      {switchTo === target && mode && (
        <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3" data-testid="apply-switch-form">
          {pending && <p className="text-xs text-amber-700" data-testid="apply-switch-lapses">{T.pendingLapses}</p>}
          <label className="block text-xs font-medium text-slate-600">
            {T.switchReason}
            <textarea
              data-testid="apply-switch-reason"
              className={`${INPUT} mt-1 block w-full`}
              rows={2}
              maxLength={REASON_MAX}
              value={switchReason}
              onChange={(e) => setSwitchReason(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="apply-switch-confirm"
              className={BTN_PRIMARY}
              disabled={!switchReason.trim() || busy}
              onClick={() => start({ kind: 'switch', from: mode, mode: target, reason: switchReason.trim() })}
            >
              {busy ? T.working : T.switchConfirm}
            </button>
            <button type="button" data-testid="apply-switch-cancel" className={BTN} disabled={busy} onClick={() => setSwitchTo(null)}>
              {L.common.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const readCheckbox = (
    <label className="flex items-start gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        data-testid="apply-read"
        className="mt-0.5"
        checked={hasRead}
        disabled={fingerprint === null || busy}
        onChange={(e) => setReadFingerprint(e.target.checked ? fingerprint : null)}
      />
      {T.readConfirm}
    </label>
  );

  return (
    <div className="space-y-4" data-testid="apply-tab">
      <LoadErrorBanner error={loadText(statusError)} what={T.what} onRetry={() => void status.refetch()} loading={status.isFetching} data-testid="apply-load-error" />

      <section className={`${CARD} space-y-1 p-4`} data-testid="apply-state" data-mode={mode ?? ''}>
        <h2 className="text-sm font-semibold text-slate-800">{T.stateTitle}</h2>
        {status.isLoading && <p className="text-sm text-slate-400">{L.common.loading}</p>}
        {status.data && (
          <>
            <p className="text-base font-semibold text-slate-900" data-testid="apply-state-mode">
              {has(T.state, status.data.mode) ? T.state[status.data.mode] : status.data.mode}
            </p>
            {status.data.mode === AUTHZ_MODE.ENFORCE && !status.data.enforcing && (
              <p role="alert" data-testid="apply-not-in-effect" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {T.notInEffect}
              </p>
            )}
            {!status.data.enforceAvailable && (
              <p data-testid="apply-enforce-unavailable" className="text-sm text-amber-800">
                {T.enforceUnavailable}
              </p>
            )}
          </>
        )}
      </section>

      <section className={`${CARD} space-y-2 p-4`} data-testid="apply-comparison">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-sm font-semibold text-slate-800">{mode === AUTHZ_MODE.ENFORCE ? T.comparisonTitleEnforcing : T.comparisonTitle}</h2>
          <button type="button" data-testid="apply-reload" className={BTN} disabled={comparison.isFetching || status.isFetching} onClick={reloadAll}>
            {comparison.isFetching ? L.common.loading : L.common.reload}
          </button>
        </div>
        <p className="text-xs text-slate-500">{T.comparisonHint}</p>
        <LoadErrorBanner
          error={loadText(comparisonError)}
          what={T.comparisonWhat}
          onRetry={() => void comparison.refetch()}
          loading={comparison.isFetching}
          data-testid="apply-comparison-load-error"
        />
        {comparison.isLoading && <p className="text-sm text-slate-400">{L.common.loading}</p>}
        {comparison.data && (
          <>
            <dl className="flex flex-wrap gap-2" data-testid="apply-summary">
              {SUMMARY_KEYS.map((key) => (
                <div key={key} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                  <dt className="text-xs text-slate-500">{T.summary[key]}</dt>
                  <dd className="text-lg font-semibold text-slate-900" data-testid={`apply-summary-${key}`}>
                    {key === 'people' ? comparison.data.people : comparison.data.summary[key]}
                  </dd>
                </div>
              ))}
            </dl>
            {people.length === 0 ? (
              <p className="text-sm text-slate-500" data-testid="apply-nobody">
                {T.nobody}
              </p>
            ) : (
              <div className="text-sm text-slate-800" data-testid="apply-people">
                <ImpactList impacts={people} teamNames={comparison.data.teamNames} index={index} testId="apply" />
              </div>
            )}
          </>
        )}
      </section>

      {status.data && mode && canWrite && (
        <section className={`${CARD} space-y-3 p-4`} data-testid="apply-actions">
          <h2 className="text-sm font-semibold text-slate-800">{T.actionsTitle}</h2>
          <Notice text={notice} testId="apply-notice" />
          <ErrorBox error={error} testId="apply-error" />

          {mode === AUTHZ_MODE.ENFORCE && switchButton(AUTHZ_MODE.OFF, T.switchOff, T.switchOffHint, BTN_DANGER_SOLID)}

          {mode !== AUTHZ_MODE.ENFORCE && pending && (
            <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3" data-testid="apply-pending">
              <h3 className="text-sm font-semibold text-amber-900">{T.pendingTitle}</h3>
              <p className="text-sm text-slate-800">{T.pendingBy(pending.requestedByName, formatVNDateTime(pending.createdAt))}</p>
              <p className="text-sm text-slate-800">{T.pendingReason(pending.reason)}</p>
              {pending.expiresAt && <p className="text-xs text-slate-600">{T.pendingExpires(formatVNDateTime(pending.expiresAt))}</p>}
              {isAsker ? (
                <>
                  <p className="text-sm text-slate-700" data-testid="apply-needs-second">
                    {T.needsSecond}
                  </p>
                  <button type="button" data-testid="apply-withdraw" className={BTN_DANGER} disabled={busy} onClick={() => start({ kind: 'close', id: pending.id, own: true })}>
                    {busy ? T.working : T.withdraw}
                  </button>
                </>
              ) : (
                <>
                  {enforceAvailable && (
                    <>
                      {readCheckbox}
                      <p className="text-xs text-slate-600">{T.approveHint}</p>
                    </>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {enforceAvailable && (
                      <button
                        type="button"
                        data-testid="apply-approve"
                        className={BTN_PRIMARY}
                        disabled={!hasRead || busy}
                        onClick={() => fingerprint !== null && start({ kind: 'approve', id: pending.id, acknowledge: fingerprint })}
                      >
                        {busy ? T.working : T.approve}
                      </button>
                    )}
                    <button type="button" data-testid="apply-reject" className={BTN_DANGER} disabled={busy} onClick={() => start({ kind: 'close', id: pending.id, own: false })}>
                      {T.reject}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {mode !== AUTHZ_MODE.ENFORCE && !pending && enforceAvailable && (
            <div className="space-y-2 rounded-md border border-slate-200 p-3" data-testid="apply-request">
              <h3 className="text-sm font-semibold text-slate-800">{T.requestTitle}</h3>
              <p className="text-xs text-slate-500">{T.requestHint}</p>
              <label className="block text-xs font-medium text-slate-600">
                {T.requestReason}
                <textarea
                  data-testid="apply-request-reason"
                  className={`${INPUT} mt-1 block w-full`}
                  rows={2}
                  maxLength={REASON_MAX}
                  placeholder={T.requestReasonPlaceholder}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
              {readCheckbox}
              <button
                type="button"
                data-testid="apply-request-submit"
                className={BTN_PRIMARY}
                disabled={!reason.trim() || !hasRead || busy}
                onClick={() => fingerprint !== null && start({ kind: 'request', reason: reason.trim(), acknowledge: fingerprint })}
              >
                {busy ? T.working : T.requestSubmit}
              </button>
            </div>
          )}

          {mode === AUTHZ_MODE.OFF && switchButton(AUTHZ_MODE.SHADOW, T.shadowOn, T.shadowOnHint, BTN)}
          {mode === AUTHZ_MODE.SHADOW && switchButton(AUTHZ_MODE.OFF, T.shadowOff, T.shadowOffHint, BTN)}
        </section>
      )}

      {status.data && (
        <section className={`${CARD} p-4`} data-testid="apply-history">
          <h2 className="text-sm font-semibold text-slate-800">{T.historyTitle}</h2>
          {status.data.history.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400" data-testid="apply-history-empty">
              {T.historyEmpty}
            </p>
          ) : (
            <ul className="mt-2">
              {status.data.history.map((change) => (
                <li key={change.id} data-testid={`apply-history-row-${change.id}`} className="border-b border-slate-100 py-2 text-sm last:border-b-0">
                  <p className="text-slate-800">
                    <span className="font-medium">{T.historyChange(modeName(change.fromMode), modeName(change.toMode))}</span>
                    <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700" data-testid={`apply-history-status-${change.id}`}>
                      {statusText(change, now)}
                    </span>
                    <span className="ml-2 text-xs text-slate-500">{formatVNDateTime(change.createdAt)}</span>
                  </p>
                  <p className="text-xs text-slate-600">
                    {T.historyAsked(change.requestedByName)}
                    {change.decidedByName && ` · ${T.historyDecided(change.decidedByName, change.decidedAt ? formatVNDateTime(change.decidedAt) : '')}`}
                  </p>
                  <p className="text-xs text-slate-500">{T.historyReason(change.reason)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
