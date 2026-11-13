import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LoadErrorBanner } from '@/components/shared/LoadErrorBanner';
import { extractApiError } from '@/lib/api-errors';
import { permissions as L } from '@/locales/permissions.vi';
import { authzKeys, permissionsApi } from '../api';
import { explainError, type ExplainedError } from '../errors';
import type { CatalogueIndex } from '../labels';
import { TEMPLATE_STATUS, TEMPLATE_STATUSES, type CatalogueResource, type TemplateStatus, type TemplateSummary } from '../types';
import { TemplateEditor } from './TemplateEditor';
import { BTN, BTN_PRIMARY, BTN_SMALL, CARD, ErrorBox, INPUT, Notice } from './ui';

interface Props {
  resources: readonly CatalogueResource[];
  index: CatalogueIndex;
  canWrite: boolean;
}

const T = L.templates;
type Editing = { template: TemplateSummary | null } | null;

/** The templates: what a kind of member may do. Each can be edited, copied, archived and restored, and deleted. */
export function TemplatesTab({ resources, index, canWrite }: Props) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<TemplateStatus>(TEMPLATE_STATUS.ACTIVE);
  const [editing, setEditing] = useState<Editing>(null);
  const [copying, setCopying] = useState<TemplateSummary | null>(null);
  const [copyName, setCopyName] = useState('');
  const [copyReason, setCopyReason] = useState('');
  const [error, setError] = useState<ExplainedError | null>(null);
  const [notice, setNotice] = useState('');

  const query = useQuery({ queryKey: authzKeys.templates, queryFn: permissionsApi.templates });
  const all = query.data ?? [];
  const shown = all.filter((t) => t.status === filter);
  const loadError = query.isError ? extractApiError(query.error, L.common.unknownError).message : '';
  const sensitiveKeys = new Set(resources.flatMap((r) => r.sensitive));
  const hasSensitive = (t: TemplateSummary) => Object.keys(t.entries).some((key) => sensitiveKeys.has(key));

  const reload = () => {
    setError(null);
    setEditing(null);
    void queryClient.invalidateQueries({ queryKey: authzKeys.all });
  };
  const done = (message: string) => {
    setError(null);
    setNotice(message);
    void queryClient.invalidateQueries({ queryKey: authzKeys.all });
  };
  const failed = (err: unknown) => {
    setNotice('');
    setError(explainError(err, index));
  };

  const state = useMutation({
    mutationFn: ({ template, archive }: { template: TemplateSummary; archive: boolean }) =>
      archive ? permissionsApi.archiveTemplate(template.id, template.revision) : permissionsApi.restoreTemplate(template.id, template.revision),
    onSuccess: (_r, { archive }) => done(archive ? T.done.archived : T.done.restored),
    onError: failed,
  });
  const remove = useMutation({
    mutationFn: (template: TemplateSummary) => permissionsApi.deleteTemplate(template.id, template.revision),
    onSuccess: () => done(T.done.deleted),
    onError: failed,
  });
  const copy = useMutation({
    mutationFn: () =>
      permissionsApi.copyTemplate((copying as TemplateSummary).id, {
        name: copyName.trim(),
        ...(copyReason.trim() ? { reason: copyReason.trim() } : {}),
      }),
    onSuccess: () => {
      setCopying(null);
      done(T.done.copied);
    },
    onError: failed,
  });

  const starters = useMutation({
    mutationFn: permissionsApi.createStarterTemplates,
    onSuccess: (result) => done(result.created.length > 0 ? T.startersCreated(result.created.length) : T.startersExisting),
    onError: failed,
  });

  const startCopy = (template: TemplateSummary) => {
    setError(null);
    setCopying(template);
    setCopyName(T.copyDefault(template.name));
    setCopyReason('');
  };
  const copyNeedsReason = !!copying && hasSensitive(copying);

  if (editing) {
    return (
      <TemplateEditor
        key={editing.template?.id ?? 'new'}
        resources={resources}
        index={index}
        template={editing.template}
        canWrite={canWrite}
        onClose={() => setEditing(null)}
        onReload={reload}
        onSaved={(message) => {
          setEditing(null);
          done(message);
        }}
      />
    );
  }

  return (
    <div className="space-y-3" data-testid="templates-tab">
      <LoadErrorBanner error={loadError} what={T.what} onRetry={() => void query.refetch()} loading={query.isFetching} data-testid="templates-load-error" />
      <ErrorBox error={error} onReload={reload} testId="templates-error" />
      <Notice text={notice} testId="templates-notice" />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1" role="tablist">
          {TEMPLATE_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              role="tab"
              aria-selected={filter === status}
              data-testid={`templates-filter-${status}`}
              onClick={() => setFilter(status)}
              className={`rounded-md border px-3 py-1.5 text-sm ${
                filter === status ? 'border-primary bg-blue-50 font-semibold text-primary' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {T.filter[status]} ({query.isSuccess ? all.filter((t) => t.status === status).length : '—'})
            </button>
          ))}
        </div>
        {canWrite && (
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="template-starters"
              className={BTN}
              disabled={starters.isPending}
              onClick={() => {
                setError(null);
                setNotice('');
                starters.mutate();
              }}
            >
              {starters.isPending ? T.startersWorking : T.starters}
            </button>
            <button type="button" data-testid="template-add" className={BTN_PRIMARY} onClick={() => setEditing({ template: null })}>
              {T.add}
            </button>
          </div>
        )}
      </div>
      {canWrite && (
        <p className="text-right text-xs text-slate-500" data-testid="template-starters-hint">
          {T.startersHint}
        </p>
      )}

      {copying && (
        <div className={`${CARD} p-4`} data-testid="template-copy-dialog">
          <h2 className="mb-2 text-sm font-bold text-slate-700">{T.copyTitle(copying.name)}</h2>
          <label className="block text-xs font-medium text-slate-600">
            {T.copyName}
            <input data-testid="template-copy-name" className={`${INPUT} mt-1 block w-full max-w-md`} value={copyName} maxLength={120} onChange={(e) => setCopyName(e.target.value)} />
          </label>
          {copyNeedsReason && (
            <label className="mt-2 block text-xs font-medium text-slate-600">
              {L.common.reasonRequired}
              <input data-testid="template-copy-reason" className={`${INPUT} mt-1 block w-full max-w-md`} value={copyReason} maxLength={500} onChange={(e) => setCopyReason(e.target.value)} />
              <span className="mt-1 block font-normal text-amber-800">{T.copyReasonHint}</span>
            </label>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              data-testid="template-copy-confirm"
              className={BTN_PRIMARY}
              disabled={!copyName.trim() || (copyNeedsReason && !copyReason.trim()) || copy.isPending}
              onClick={() => copy.mutate()}
            >
              {T.copyConfirm}
            </button>
            <button type="button" className={BTN} onClick={() => setCopying(null)}>
              {L.common.cancel}
            </button>
          </div>
        </div>
      )}

      <div className={CARD}>
        {query.isLoading ? (
          <p className="p-6 text-center text-sm text-slate-400">{L.common.loading}</p>
        ) : shown.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-400" data-testid="templates-empty">
            {loadError ? T.notLoaded : T.empty[filter]}
          </p>
        ) : (
          <ul>
            {shown.map((template) => (
              <li key={template.id} data-testid={`template-row-${template.id}`} className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-4 py-2">
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-slate-800">{template.name}</span>
                  <span className="ml-2 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{T.filter[template.status]}</span>
                  <span className="ml-2 text-xs text-slate-500">
                    {T.usedBy(template.usedByTeams)} · {T.granted(Object.keys(template.entries).length)}
                  </span>
                  {template.description && <p className="truncate text-xs text-slate-500">{template.description}</p>}
                </div>
                <div className="flex flex-wrap gap-1">
                  <button type="button" data-testid={`template-edit-${template.id}`} className={BTN_SMALL} onClick={() => setEditing({ template })}>
                    {canWrite ? T.edit : T.view}
                  </button>
                  {canWrite && (
                    <>
                      <button type="button" data-testid={`template-copy-${template.id}`} className={BTN_SMALL} onClick={() => startCopy(template)}>
                        {T.copy}
                      </button>
                      {template.status === TEMPLATE_STATUS.ACTIVE ? (
                        <button
                          type="button"
                          data-testid={`template-archive-${template.id}`}
                          className={BTN_SMALL}
                          disabled={state.isPending}
                          onClick={() => {
                            if (window.confirm(T.confirmArchive(template.name))) state.mutate({ template, archive: true });
                          }}
                        >
                          {T.archive}
                        </button>
                      ) : (
                        <button
                          type="button"
                          data-testid={`template-restore-${template.id}`}
                          className={BTN_SMALL}
                          disabled={state.isPending}
                          onClick={() => state.mutate({ template, archive: false })}
                        >
                          {T.restore}
                        </button>
                      )}
                      <button
                        type="button"
                        data-testid={`template-delete-${template.id}`}
                        className={`${BTN_SMALL} border-red-200 text-red-600`}
                        disabled={template.usedByTeams > 0 || remove.isPending}
                        title={template.usedByTeams > 0 ? T.deleteBlocked : undefined}
                        onClick={() => {
                          if (window.confirm(T.confirmDelete(template.name))) remove.mutate(template);
                        }}
                      >
                        {T.delete}
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
