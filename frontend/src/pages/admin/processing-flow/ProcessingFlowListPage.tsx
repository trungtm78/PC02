/**
 * /admin/quy-trinh — the flows of "Quy trình & hạn xử lý", by record kind. Create (empty, from a legal template, or a
 * copy), open, archive and restore, delete with the name typed back. Reading needs `read:ProcessingFlow`; every write
 * button needs its own permission and is not drawn without it.
 */
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, ChevronDown, Workflow } from 'lucide-react';
import { ListPageShell, ColumnPicker, useBoCucCot, type ColumnDef } from '@/components/shared/ListPageShell';
import { A11Y_FOCUS_RING, BTN_PRIMARY, BTN_SECONDARY } from '@/constants/styles';
import { processingFlow as L } from '@/locales/processingFlow.vi';
import { processingFlowApi } from '@/features/processing-flow/api';
import { RECORD_KINDS } from '@/features/processing-flow/codes';
import { FeatureOffState } from '@/features/processing-flow/components/FeatureOffState';
import { FlowDeletePanel, type FlowDeleteOutcome } from '@/features/processing-flow/components/FlowDeletePanel';
import { explainError, isFeatureOff } from '@/features/processing-flow/errors';
import { boundLabels, copyName, countByKind, versionText, visibleFlows } from '@/features/processing-flow/list';
import { PROCESSING_QUERY_KEYS } from '@/features/processing-flow/queryKeys';
import { useProcessingPermissions } from '@/features/processing-flow/usePermissions';
import type { FlowSummaryDto, RecordKind } from '@/features/processing-flow/types';

/** How many bound types a row names before it says "+N". */
const NAMED_TYPES = 2;

const LINK = `text-xs text-blue-700 hover:underline disabled:cursor-not-allowed disabled:opacity-50 ${A11Y_FOCUS_RING}`;

export default function ProcessingFlowListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const perms = useProcessingPermissions();

  const [kind, setKind] = useState<RecordKind>('PETITION');
  const [showArchived, setShowArchived] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newKind, setNewKind] = useState<RecordKind>('PETITION');
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [deleting, setDeleting] = useState<FlowSummaryDto | null>(null);

  const listQ = useQuery({
    queryKey: PROCESSING_QUERY_KEYS.flowList(showArchived),
    queryFn: () => processingFlowApi.list({ includeArchived: showArchived }),
    staleTime: 15_000,
    retry: false,
  });
  const templatesQ = useQuery({
    queryKey: PROCESSING_QUERY_KEYS.templates,
    queryFn: () => processingFlowApi.templates(),
    enabled: templatesOpen,
    staleTime: 10 * 60_000,
    retry: false,
  });

  const flows = useMemo(() => listQ.data ?? [], [listQ.data]);
  const counts = useMemo(() => countByKind(flows), [flows]);
  const rows = useMemo(() => visibleFlows(flows, kind), [flows, kind]);

  const reload = () => void queryClient.invalidateQueries({ queryKey: PROCESSING_QUERY_KEYS.flows });

  /** One write at a time: every control is disabled while this runs. */
  async function run(job: () => Promise<unknown>, done: string | ((result: unknown) => string | null)) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await job();
      const text = typeof done === 'function' ? done(result) : done;
      if (text) setMessage(text);
      reload();
      return result;
    } catch (err) {
      const e = explainError(err);
      setError(e.message);
      if (e.conflict) reload();
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  async function createFlow(body: Parameters<typeof processingFlowApi.create>[0], done: string) {
    const created = (await run(() => processingFlowApi.create(body), done)) as { id: string } | undefined;
    if (created) {
      setCreating(false);
      setTemplatesOpen(false);
      setNewName('');
      navigate(`/admin/quy-trinh/${created.id}`);
    }
  }

  function onDeleteDone(outcome: FlowDeleteOutcome) {
    setDeleting(null);
    setMessage(outcome === 'deleted' ? L.list.deleted : L.list.archived);
    reload();
  }

  // Rebuilt on every render: the cells call `run`/`createFlow`, which close over the state of this render.
  const columns: ColumnDef<FlowSummaryDto>[] = [
      {
        key: 'name',
        header: L.list.columns.name,
        width: '18rem',
        cellClassName: 'px-3 py-3 text-slate-800',
        render: (f) => (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium" data-testid={`flow-name-${f.id}`}>
              {f.name}
            </span>
            {f.isDefault && (
              <span data-testid={`flow-badge-default-${f.id}`} className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800">
                {L.list.badges.default}
              </span>
            )}
            {f.status === 'ARCHIVED' && (
              <span data-testid={`flow-badge-archived-${f.id}`} className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {L.list.badges.archived}
              </span>
            )}
          </div>
        ),
      },
      {
        key: 'types',
        header: L.list.columns.types,
        width: '22rem',
        optional: 'show',
        cellClassName: 'px-3 py-3 text-slate-700',
        render: (f) => {
          const labels = boundLabels(f);
          if (labels.length === 0) return <span className="text-slate-400" data-testid={`flow-types-${f.id}`}>{L.list.noTypes}</span>;
          const more = labels.length - NAMED_TYPES;
          return (
            <span data-testid={`flow-types-${f.id}`} title={labels.join(', ')}>
              {labels.slice(0, NAMED_TYPES).join(', ')}
              {more > 0 && <span className="ml-1 rounded bg-slate-100 px-1 text-xs font-semibold text-slate-600">{L.list.moreTypes(more)}</span>}
            </span>
          );
        },
      },
      {
        key: 'steps',
        header: L.list.columns.steps,
        width: '6rem',
        optional: 'show',
        headerClassName: 'px-3 py-3 text-right text-xs font-semibold tracking-wide text-slate-600',
        cellClassName: 'px-3 py-3 text-right text-slate-700 tabular-nums',
        render: (f) => <span data-testid={`flow-steps-${f.id}`}>{f.stepCount}</span>,
      },
      {
        key: 'version',
        header: L.list.columns.version,
        width: '14rem',
        optional: 'show',
        cellClassName: 'px-3 py-3 text-slate-700',
        render: (f) => <span data-testid={`flow-version-${f.id}`}>{versionText(f)}</span>,
      },
      {
        key: 'actions',
        header: L.list.columns.actions,
        width: '18rem',
        khongDoiBeRong: true,
        cellClassName: 'px-3 py-3',
        render: (f) => (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <button type="button" className={LINK} data-testid={`flow-open-${f.id}`} onClick={() => navigate(`/admin/quy-trinh/${f.id}`)}>
              {L.list.actions.open}
            </button>
            {perms.canCreate && (
              <button
                type="button"
                className={LINK}
                data-testid={`flow-copy-${f.id}`}
                disabled={busy}
                onClick={() =>
                  void createFlow(
                    {
                      name: copyName(f.name, flows.filter((x) => x.recordKind === f.recordKind).map((x) => x.name)),
                      recordKind: f.recordKind,
                      copyFromFlowId: f.id,
                    },
                    L.list.copied,
                  )
                }
              >
                {L.list.actions.copy}
              </button>
            )}
            {perms.canEdit &&
              (f.status === 'ARCHIVED' ? (
                <button
                  type="button"
                  className={LINK}
                  data-testid={`flow-restore-${f.id}`}
                  disabled={busy}
                  onClick={() => void run(() => processingFlowApi.restore(f.id, f.revision), L.list.restored)}
                >
                  {L.list.actions.restore}
                </button>
              ) : (
                <button
                  type="button"
                  className={LINK}
                  data-testid={`flow-archive-${f.id}`}
                  disabled={busy}
                  onClick={() => void run(() => processingFlowApi.archive(f.id, f.revision), L.list.archived)}
                >
                  {L.list.actions.archive}
                </button>
              ))}
            {perms.canDelete && (
              <button
                type="button"
                className={`${LINK} !text-red-700`}
                data-testid={`flow-delete-${f.id}`}
                disabled={busy}
                onClick={() => {
                  setMessage(null);
                  setError(null);
                  setDeleting(f);
                }}
              >
                {L.list.actions.remove}
              </button>
            )}
          </div>
        ),
      },
  ];

  const { coGhiDeBeRong, visibleColumns, toggleableColumns, isVisible, batTat, datBeRong, xoaBeRong, doiCho, datLai } = useBoCucCot(
    'processing-flows',
    columns,
  );

  if (listQ.isError && isFeatureOff(listQ.error)) return <FeatureOffState />;

  const loadError = listQ.isError ? explainError(listQ.error).message : null;

  return (
    <div data-testid="processing-flow-list-page">
      <ListPageShell>
        <ListPageShell.Header
          icon={Workflow}
          title={L.list.title}
          subtitle={L.list.subtitle}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <ColumnPicker columns={toggleableColumns} isVisible={isVisible} onToggle={batTat} onReset={datLai} onDoiCho={doiCho} />
              {perms.canCreate && (
                <>
                  <button
                    type="button"
                    data-testid="flow-new"
                    className={BTN_PRIMARY}
                    disabled={busy}
                    onClick={() => {
                      setNewKind(kind);
                      setCreating(true);
                      setTemplatesOpen(false);
                    }}
                  >
                    {L.list.create}
                  </button>
                  <div className="relative">
                    <button
                      type="button"
                      data-testid="flow-templates"
                      aria-expanded={templatesOpen}
                      className={`${BTN_SECONDARY} inline-flex items-center gap-1`}
                      disabled={busy}
                      onClick={() => setTemplatesOpen((open) => !open)}
                    >
                      {L.list.templates}
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    </button>
                    {templatesOpen && (
                      <div
                        data-testid="flow-templates-menu"
                        className="absolute right-0 top-full z-20 mt-1 flex w-80 max-w-[82vw] flex-col rounded-lg border border-slate-300 bg-white p-1 shadow-lg"
                      >
                        {templatesQ.isLoading && <p className="px-3 py-2 text-sm text-slate-500">{L.common.loading}</p>}
                        {templatesQ.isError && <p className="px-3 py-2 text-sm text-red-700">{explainError(templatesQ.error).message}</p>}
                        {templatesQ.data?.length === 0 && <p className="px-3 py-2 text-sm text-slate-500">{L.list.templatesEmpty}</p>}
                        {templatesQ.data?.map((t) => (
                          <button
                            key={t.key}
                            type="button"
                            data-testid={`flow-template-${t.key}`}
                            disabled={busy}
                            className="rounded px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-50"
                            onClick={() => void createFlow({ name: t.name, recordKind: t.recordKind, templateKey: t.key }, L.list.created)}
                          >
                            <b className="block">{t.name}</b>
                            <span className="text-xs text-slate-500">{L.list.templateLine(L.recordKinds[t.recordKind], t.steps.length)}</span>
                          </button>
                        ))}
                        <p className="px-3 py-2 text-xs text-slate-500">{L.list.templatesHint}</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          }
        />

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <div role="group" aria-label={L.list.kindsLabel} className="inline-flex overflow-hidden rounded-lg border border-slate-300">
            {RECORD_KINDS.map((k) => (
              <button
                key={k}
                type="button"
                data-testid={`flow-kind-${k}`}
                aria-pressed={kind === k}
                onClick={() => {
                  setKind(k);
                  setDeleting(null);
                }}
                className={`border-l border-slate-300 px-4 py-1.5 text-sm font-medium first:border-l-0 ${
                  kind === k ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'
                } ${A11Y_FOCUS_RING}`}
              >
                {L.recordKinds[k]} ({counts[k]})
              </button>
            ))}
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" data-testid="flow-show-archived" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            {L.list.showArchived}
          </label>
        </div>

        {message && (
          <p data-testid="flow-list-message" role="status" className="mx-4 mt-3 rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            {message}
          </p>
        )}
        {error && (
          <p data-testid="flow-list-error" role="alert" className="mx-4 mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {creating && perms.canCreate && (
          <form
            data-testid="flow-create-panel"
            className="mx-4 mt-3 flex flex-col gap-3 rounded-lg border border-blue-200 bg-white p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (newName.trim()) void createFlow({ name: newName.trim(), recordKind: newKind }, L.list.created);
            }}
          >
            <h2 className="text-sm font-semibold text-slate-800">{L.list.createForm.title}</h2>
            <div className="flex flex-wrap gap-3">
              <label className="flex min-w-60 flex-1 flex-col gap-1 text-sm text-slate-700">
                {L.list.createForm.name}
                <input
                  data-testid="flow-create-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  disabled={busy}
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-slate-700">
                {L.list.createForm.kind}
                <select
                  data-testid="flow-create-kind"
                  value={newKind}
                  onChange={(e) => setNewKind(e.target.value as RecordKind)}
                  disabled={busy}
                  className="rounded border border-slate-300 px-3 py-2 text-sm"
                >
                  {RECORD_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {L.recordKinds[k]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="text-xs text-slate-500">{L.list.createForm.hint}</p>
            <div className="flex gap-2">
              <button type="submit" data-testid="flow-create-submit" className={BTN_PRIMARY} disabled={busy || newName.trim() === ''}>
                {L.list.createForm.submit}
              </button>
              <button type="button" className={BTN_SECONDARY} onClick={() => setCreating(false)} disabled={busy}>
                {L.common.cancel}
              </button>
            </div>
          </form>
        )}

        {deleting && (
          <FlowDeletePanel
            key={deleting.id}
            flow={deleting}
            busy={busy}
            canArchive={perms.canEdit}
            onClose={() => setDeleting(null)}
            onDone={onDeleteDone}
            onConflict={reload}
          />
        )}

        {loadError ? (
          <div data-testid="flow-list-load-error" role="alert" className="m-4 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" aria-hidden="true" />
            <p className="flex-1 text-sm text-red-700">{loadError}</p>
            <button type="button" data-testid="flow-list-retry" className={BTN_SECONDARY} onClick={() => void listQ.refetch()}>
              {L.common.retry}
            </button>
          </div>
        ) : (
          <ListPageShell.Table<FlowSummaryDto>
            state={listQ.isLoading ? 'loading' : rows.length === 0 ? 'empty' : 'ready'}
            fixedLayout
            onKeoGian={datBeRong}
            onVeMacDinhCot={xoaBeRong}
            datTongBeRong={coGhiDeBeRong}
            columns={visibleColumns}
            data={rows}
            rowKey={(f) => f.id}
            getRowClassName={(f) => (f.status === 'ARCHIVED' ? 'text-slate-400' : '')}
            title={L.list.title}
            totalCount={rows.length}
            emptyState={{ title: L.list.empty }}
          />
        )}

        <p className="px-4 py-3 text-xs text-slate-500">{L.list.footnote}</p>
      </ListPageShell>
    </div>
  );
}
