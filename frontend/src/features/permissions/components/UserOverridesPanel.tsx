import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoadErrorBanner } from '@/components/shared/LoadErrorBanner';
import { extractApiError } from '@/lib/api-errors';
import { permissions as L } from '@/locales/permissions.vi';
import { authzKeys, permissionsApi } from '../api';
import { explainError, type ExplainedError } from '../errors';
import type { CatalogueIndex } from '../labels';
import { cleanOverrides, sameDoc } from '../overrides';
import type { Override, PreviewResult, UserOverrides } from '../types';
import { OverridesTable } from './OverridesTable';
import { BTN, BTN_PRIMARY, CARD, ErrorBox, INPUT, Notice, PreviewBox } from './ui';

interface Props {
  userId: string;
  index: CatalogueIndex;
  canWrite: boolean;
}

const T = L.lookup;

function OverridesForm({
  userId,
  loaded,
  index,
  canWrite,
  onReload,
  onNotice,
}: Props & { loaded: UserOverrides; onReload: () => void; onNotice: (message: string) => void }) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<Override[]>(() => loaded.overrides.map((o) => ({ ...o })));
  const [reason, setReason] = useState('');
  const [error, setError] = useState<ExplainedError | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const overrides = cleanOverrides(rows);
  const dirty = !sameDoc(overrides, loaded.overrides);
  const fail = (err: unknown) => setError(explainError(err, index));

  const save = useMutation({
    mutationFn: () =>
      permissionsApi.saveUserOverrides(userId, { overrides, expectedToken: loaded.token, ...(reason.trim() ? { reason: reason.trim() } : {}) }),
    onSuccess: (result) => {
      onNotice(result.changed ? L.common.saved : L.common.savedNothing);
      void queryClient.invalidateQueries({ queryKey: authzKeys.all });
    },
    onError: fail,
  });
  const runPreview = useMutation({
    mutationFn: () => permissionsApi.preview({ users: [{ userId, overrides }] }),
    onSuccess: (result) => {
      setError(null);
      setPreview(result);
    },
    onError: fail,
  });

  return (
    <div className="space-y-2">
      <OverridesTable
        rows={rows}
        onChange={(next) => {
          setRows(next);
          setPreview(null);
          onNotice('');
        }}
        index={index}
        withAudience={false}
        readOnly={!canWrite}
        testId="user-override"
      />
      {canWrite && (
        <label className="block text-xs font-medium text-slate-600">
          {L.common.reason}
          <input data-testid="user-overrides-reason" className={`${INPUT} mt-1 block w-full max-w-xl`} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
        </label>
      )}
      {dirty && (
        <span data-testid="user-overrides-unsaved" className="inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
          {L.common.unsaved}
        </span>
      )}
      <ErrorBox error={error} onReload={onReload} testId="user-overrides-error" />
      <PreviewBox result={preview} index={index} testId="user-overrides-preview" />
      <div className="flex gap-2">
        <button type="button" data-testid="user-overrides-preview-btn" className={BTN} disabled={!dirty || runPreview.isPending} onClick={() => runPreview.mutate()}>
          {runPreview.isPending ? L.teams.previewing : L.teams.preview}
        </button>
        {canWrite && (
          <button
            type="button"
            data-testid="user-overrides-save"
            className={BTN_PRIMARY}
            disabled={!dirty || save.isPending}
            onClick={() => {
              setError(null);
              save.mutate();
            }}
          >
            {save.isPending ? L.common.saving : L.common.save}
          </button>
        )}
      </div>
    </div>
  );
}

/** A person's own exceptions. Saving replaces the whole list, with the token it was read at. */
export function UserOverridesPanel({ userId, index, canWrite }: Props) {
  const [reloads, setReloads] = useState(0);
  const [notice, setNotice] = useState('');
  const query = useQuery({ queryKey: authzKeys.userOverrides(userId), queryFn: () => permissionsApi.userOverrides(userId) });
  const loadError = query.isError ? extractApiError(query.error, L.common.unknownError).message : '';

  return (
    <div className={`${CARD} space-y-2 p-4`} data-testid="user-overrides-panel">
      <h3 className="text-sm font-bold text-slate-700">{T.ownTitle}</h3>
      <p className="text-xs text-slate-500">{T.ownHint}</p>
      <LoadErrorBanner error={loadError} what={T.ownWhat} onRetry={() => void query.refetch()} loading={query.isFetching} data-testid="user-overrides-load-error" />
      <Notice text={notice} testId="user-overrides-notice" />
      {query.isLoading && <p className="text-sm text-slate-400">{L.common.loading}</p>}
      {query.data && (
        <OverridesForm
          key={`${userId}:${query.data.token}:${reloads}`}
          userId={userId}
          loaded={query.data}
          index={index}
          canWrite={canWrite}
          onNotice={setNotice}
          onReload={() => {
            setReloads((n) => n + 1);
            void query.refetch();
          }}
        />
      )}
    </div>
  );
}
