import { useState } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoadErrorBanner } from '@/components/shared/LoadErrorBanner';
import { useOfficerOptions } from '@/hooks/useOfficerOptions';
import { extractApiError } from '@/lib/api-errors';
import { formatVNDateTime } from '@/lib/dates';
import { permissions as L } from '@/locales/permissions.vi';
import { authzKeys, permissionsApi } from '../api';
import { explainError, type ExplainedError } from '../errors';
import type { CatalogueIndex } from '../labels';
import { CHANGE_TYPE, HISTORY_PAGE, type ChangeItem, type ChangeSet } from '../types';
import { BTN, BTN_PRIMARY, BTN_SMALL, CARD, ErrorBox, INPUT, Notice } from './ui';

interface Props {
  index: CatalogueIndex;
  canWrite: boolean;
}

const T = L.history;
const kindLabel = (kind: string) => (Object.prototype.hasOwnProperty.call(L.changeKinds, kind) ? L.changeKinds[kind] : kind);
const nameIn = (doc: unknown): string | null =>
  doc && typeof doc === 'object' && typeof (doc as { name?: unknown }).name === 'string' ? (doc as { name: string }).name : null;

/** Every change of the configuration, newest first, each with its way back. */
export function HistoryTab({ index, canWrite }: Props) {
  const queryClient = useQueryClient();
  const [failure, setFailure] = useState<{ id: string; error: ExplainedError } | null>(null);
  const [undoReason, setUndoReason] = useState('');
  const [notice, setNotice] = useState('');

  const query = useInfiniteQuery({
    queryKey: authzKeys.changes,
    queryFn: ({ pageParam }) => permissionsApi.changes({ limit: HISTORY_PAGE, ...(pageParam ? { before: pageParam } : {}) }),
    initialPageParam: '',
    getNextPageParam: (last) => (last.length === HISTORY_PAGE ? last[last.length - 1].id : undefined),
  });
  // Names for the objects of a change. Only decoration: without them the row shows the id.
  const teams = useQuery({ queryKey: authzKeys.teams, queryFn: permissionsApi.teams });
  const officers = useOfficerOptions();

  const rows = query.data?.pages.flat() ?? [];
  const loadError = query.isError ? extractApiError(query.error, L.common.unknownError).message : '';

  const objectText = (item: ChangeItem): string => {
    let name: string | undefined;
    if (item.type === CHANGE_TYPE.TEMPLATE) name = nameIn(item.after) ?? nameIn(item.before) ?? undefined;
    else if (item.type === CHANGE_TYPE.TEAM) name = teams.data?.find((t) => t.teamId === item.id)?.name;
    else if (item.type === CHANGE_TYPE.USER) name = officers.data?.find((o) => o.value === item.id)?.label;
    const describe = Object.prototype.hasOwnProperty.call(T.object, item.type) ? T.object[item.type] : (n: string) => n;
    return describe(name ?? item.id);
  };

  const undo = useMutation({
    mutationFn: ({ change, reason }: { change: ChangeSet; reason?: string }) => permissionsApi.undo(change.id, reason),
    onSuccess: () => {
      setFailure(null);
      setUndoReason('');
      setNotice(T.undoDone);
      void queryClient.invalidateQueries({ queryKey: authzKeys.all });
    },
    onError: (err, { change }) => {
      setNotice('');
      setFailure({ id: change.id, error: explainError(err, index) });
    },
  });
  const startUndo = (change: ChangeSet) => {
    if (!window.confirm(T.confirmUndo(kindLabel(change.kind)))) return;
    setFailure(null);
    setUndoReason('');
    undo.mutate({ change });
  };
  const reload = () => {
    setFailure(null);
    void queryClient.invalidateQueries({ queryKey: authzKeys.changes });
  };

  return (
    <div className="space-y-3" data-testid="history-tab">
      <LoadErrorBanner error={loadError} what={T.what} onRetry={() => void query.refetch()} loading={query.isFetching} data-testid="history-load-error" />
      <Notice text={notice} testId="history-notice" />
      <div className={CARD}>
        {query.isLoading ? (
          <p className="p-6 text-center text-sm text-slate-400">{L.common.loading}</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-400" data-testid="history-empty">
            {loadError ? L.templates.notLoaded : T.empty}
          </p>
        ) : (
          <ul>
            {rows.map((change) => (
              <li key={change.id} data-testid={`history-row-${change.id}`} className="border-b border-slate-100 px-4 py-2 text-sm">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-slate-800">
                      <span className="font-medium">{kindLabel(change.kind)}</span>
                      <span className="ml-2 text-xs text-slate-500">
                        {formatVNDateTime(change.createdAt)} · {change.actorName}
                      </span>
                    </p>
                    <p className="text-xs text-slate-600" data-testid={`history-objects-${change.id}`}>
                      {T.objects}: {change.changes.map(objectText).join('; ')}
                    </p>
                    <p className="text-xs text-slate-500">
                      {T.reason}: {change.reason || T.noReason}
                    </p>
                  </div>
                  {change.undoneById ? (
                    <span data-testid={`history-undone-${change.id}`} className="text-xs text-slate-400">
                      {T.undone}
                    </span>
                  ) : (
                    canWrite && (
                      <button type="button" data-testid={`history-undo-${change.id}`} className={BTN_SMALL} disabled={undo.isPending} onClick={() => startUndo(change)}>
                        {undo.isPending && undo.variables?.change.id === change.id ? T.undoing : T.undo}
                      </button>
                    )
                  )}
                </div>
                {failure?.id === change.id && (
                  <div className="mt-2 space-y-2">
                    <ErrorBox error={failure.error} onReload={reload} testId="history-error" />
                    {failure.error.needsReason && (
                      <div className="flex flex-wrap items-end gap-2">
                        <label className="text-xs font-medium text-slate-600">
                          {T.undoReason}
                          <input data-testid="history-undo-reason" className={`${INPUT} mt-1 block w-72`} value={undoReason} maxLength={500} onChange={(e) => setUndoReason(e.target.value)} />
                        </label>
                        <button
                          type="button"
                          data-testid="history-undo-retry"
                          className={BTN_PRIMARY}
                          disabled={!undoReason.trim() || undo.isPending}
                          onClick={() => undo.mutate({ change, reason: undoReason.trim() })}
                        >
                          {T.undoRetry}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {query.hasNextPage && (
        <button type="button" data-testid="history-more" className={BTN} disabled={query.isFetchingNextPage} onClick={() => void query.fetchNextPage()}>
          {query.isFetchingNextPage ? T.loadingMore : T.more}
        </button>
      )}
    </div>
  );
}
