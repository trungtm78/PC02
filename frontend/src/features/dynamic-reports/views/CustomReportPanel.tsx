/**
 * "Báo cáo tuỳ chọn" on the aggregate screen of a period: the custom reports saved on the report (shared by its
 * managers), and the way into the builder.
 *
 * For managers and admins of the report only. The page it sits on also opens for viewers, whom the server answers
 * 404: the whole section then stays out of sight, without an error. Every saved report can be opened, exported,
 * renamed, archived and restored, deleted.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, Plus } from 'lucide-react';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type { SummaryMode } from '@/features/dynamic-reports/types';
import { parseBlobError } from '@/features/document-templates/export.api';
import { extractApiError } from '@/lib/api-errors';
import { formatVNDateTime } from '@/lib/dates';
import { A11Y_FOCUS_RING } from '@/constants/styles';
import { customReportErrorText, reportCriteria } from '@/locales/reportCriteria.vi';
import { reportViewsApi, reportViewsKey } from './api';
import CustomReportBuilder from './CustomReportBuilder';
import type { ReportViewDto } from './types';

const t = reportCriteria.customReport;

interface Props {
  reportId: string;
  periodId: string;
  /** The calculation mode chosen on the page ("Chế độ tính"). */
  mode: SummaryMode;
  /** Whether the period is closed: a preview read before a closing (or a reopening) is not asked for again by itself. */
  periodStatus: 'OPEN' | 'FINALIZED';
  previewDelayMs?: number;
}

export default function CustomReportPanel({ reportId, periodId, mode, periodStatus, previewDelayMs }: Props) {
  const queryClient = useQueryClient();
  const viewsQ = useQuery({
    queryKey: reportViewsKey(reportId),
    queryFn: () => reportViewsApi.list(reportId),
    // A viewer is answered 404: asking again would only keep the answer waiting.
    retry: false,
    refetchOnWindowFocus: false,
  });

  // The builder is one at a time; `opened` counts the openings so that each one starts clean.
  const [builder, setBuilder] = useState<{ view: ReportViewDto | null; opened: number } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Not known yet, or not for this person: nothing at all.
  if (viewsQ.isLoading) return null;
  if (viewsQ.isError && extractApiError(viewsQ.error).status === 404) return null;

  const views = viewsQ.data ?? [];
  const inUse = views.filter((v) => v.archivedAt === null);
  const archived = views.filter((v) => v.archivedAt !== null);
  const refresh = () => void queryClient.invalidateQueries({ queryKey: reportViewsKey(reportId) });

  function openBuilder(view: ReportViewDto | null) {
    setNotice(null);
    setError(null);
    setBuilder((current) => ({ view, opened: (current?.opened ?? 0) + 1 }));
  }

  async function act(view: ReportViewDto, action: () => Promise<string>, download = false) {
    setBusyId(view.id);
    setExportingId(download ? view.id : null);
    setError(null);
    setNotice(null);
    try {
      setNotice(await action());
      if (!download) refresh();
    } catch (err) {
      const e = extractApiError(download ? await parseBlobError(err) : err);
      setError(customReportErrorText(e.code, e.message));
      // Whatever was refused, the list on the screen may be behind what is saved.
      refresh();
    } finally {
      setBusyId(null);
      setExportingId(null);
    }
  }

  const handleExport = (view: ReportViewDto) =>
    act(
      view,
      async () => {
        const { exportId, fileName } = await reportViewsApi.createExport(periodId, { viewId: view.id, mode });
        await dynamicReportsApi.downloadExport(exportId, fileName);
        return t.done.exported(fileName);
      },
      true,
    );

  const handleRename = (view: ReportViewDto, name: string) =>
    act(view, async () => {
      const renamed = await reportViewsApi.update(view.id, { expectedRevision: view.revision, name: name.trim() });
      setRenaming(null);
      return t.done.renamed(renamed.name);
    });

  const handleArchive = (view: ReportViewDto) =>
    act(view, async () => t.done.archived((await reportViewsApi.archive(view.id, view.revision)).name));

  const handleRestore = (view: ReportViewDto) =>
    act(view, async () => t.done.restored((await reportViewsApi.restore(view.id, view.revision)).name));

  const handleDelete = (view: ReportViewDto) =>
    act(view, async () => {
      await reportViewsApi.remove(view.id, view.revision);
      setDeletingId(null);
      if (builder?.view?.id === view.id) setBuilder(null);
      return t.done.deleted(view.name);
    });

  const small = `px-2 py-1 text-xs rounded border disabled:opacity-50 ${A11Y_FOCUS_RING}`;
  const plain = `${small} border-slate-300 text-slate-700 hover:bg-slate-50`;
  const danger = `${small} border-red-200 text-red-700 hover:bg-red-50`;

  function row(view: ReportViewDto) {
    const isArchived = view.archivedAt !== null;
    const busy = busyId === view.id;
    return (
      <li key={view.id} className="py-2" data-testid={`custom-report-view-${view.id}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800 break-words">{view.name}</p>
            <p className="text-xs text-slate-500">
              {t.viewSummary(view.itemKeys?.length ?? null, view.teamIds?.length ?? null)}
              {' · '}
              {t.changedBy(view.updatedBy?.name ?? null, formatVNDateTime(view.updatedAt))}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {!isArchived && (
              <>
                <button type="button" data-testid={`custom-report-open-${view.id}`} title={t.openTitle} disabled={busy} onClick={() => openBuilder(view)} className={`${small} border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100`}>
                  {t.open}
                </button>
                <button type="button" data-testid={`custom-report-export-${view.id}`} disabled={busy} onClick={() => void handleExport(view)} className={`${plain} inline-flex items-center gap-1`}>
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  {exportingId === view.id ? t.exporting : t.export}
                </button>
                <button type="button" data-testid={`custom-report-rename-${view.id}`} disabled={busy} onClick={() => setRenaming({ id: view.id, name: view.name })} className={plain}>
                  {t.rename}
                </button>
                <button type="button" data-testid={`custom-report-archive-${view.id}`} disabled={busy} onClick={() => void handleArchive(view)} className={plain}>
                  {t.archive}
                </button>
              </>
            )}
            {isArchived && (
              <button type="button" data-testid={`custom-report-restore-${view.id}`} disabled={busy} onClick={() => void handleRestore(view)} className={plain}>
                {t.restore}
              </button>
            )}
            <button type="button" data-testid={`custom-report-delete-${view.id}`} disabled={busy} onClick={() => setDeletingId(view.id)} className={danger}>
              {t.remove}
            </button>
          </div>
        </div>

        {renaming?.id === view.id && (
          <div className="flex flex-wrap items-center gap-2 mt-2" data-testid={`custom-report-rename-box-${view.id}`}>
            <input
              type="text"
              data-testid={`custom-report-rename-input-${view.id}`}
              aria-label={t.renameLabel(view.name)}
              value={renaming.name}
              maxLength={120}
              disabled={busy}
              onChange={(e) => setRenaming({ id: view.id, name: e.target.value })}
              className="flex-1 min-w-48 border border-slate-300 rounded px-2 py-1 text-sm"
            />
            <button
              type="button"
              data-testid={`custom-report-rename-save-${view.id}`}
              disabled={busy || renaming.name.trim() === '' || renaming.name.trim() === view.name}
              onClick={() => void handleRename(view, renaming.name)}
              className={`${small} border-blue-600 bg-blue-600 text-white hover:bg-blue-700`}
            >
              {t.renameSave}
            </button>
            <button type="button" data-testid={`custom-report-rename-cancel-${view.id}`} disabled={busy} onClick={() => setRenaming(null)} className={plain}>
              {t.cancel}
            </button>
          </div>
        )}

        {deletingId === view.id && (
          <div className="mt-2 border border-red-200 bg-red-50 rounded-lg p-3" data-testid={`custom-report-delete-confirm-${view.id}`} role="alertdialog" aria-label={t.remove}>
            <p className="text-sm text-red-800 mb-2">{t.confirmDelete(view.name)}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" data-testid={`custom-report-delete-yes-${view.id}`} disabled={busy} onClick={() => void handleDelete(view)} className={`${small} border-red-600 bg-red-600 text-white hover:bg-red-700`}>
                {t.confirmDeleteYes}
              </button>
              <button type="button" data-testid={`custom-report-delete-no-${view.id}`} disabled={busy} onClick={() => setDeletingId(null)} className={plain}>
                {t.cancel}
              </button>
            </div>
          </div>
        )}
      </li>
    );
  }

  return (
    <section className="bg-white border border-slate-200 rounded-lg p-4 mb-6" data-testid="custom-report-panel" aria-labelledby="custom-report-heading">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id="custom-report-heading" className="text-base font-semibold text-slate-800">
            {t.heading}
          </h2>
          <p className="text-sm text-slate-500">{t.help}</p>
        </div>
        <button
          type="button"
          data-testid="custom-report-create"
          onClick={() => openBuilder(null)}
          className={`inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 ${A11Y_FOCUS_RING}`}
        >
          <Plus className="w-4 h-4" />
          {t.create}
        </button>
      </div>

      {notice && (
        <p className="text-sm text-green-700 mt-2" data-testid="custom-report-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="text-sm text-red-700 mt-2" data-testid="custom-report-list-error" role="alert">
          {error}
        </p>
      )}

      {viewsQ.isError ? (
        <div className="text-sm text-red-700 mt-2" data-testid="custom-report-load-error" role="alert">
          <p>{t.loadError}</p>
          <button
            type="button"
            data-testid="custom-report-load-retry"
            onClick={() => void viewsQ.refetch()}
            className={`mt-1 px-3 py-1 border border-red-300 rounded-lg hover:bg-red-50 ${A11Y_FOCUS_RING}`}
          >
            {t.retry}
          </button>
        </div>
      ) : (
        <>
          {inUse.length === 0 ? (
            <p className="text-sm text-slate-500 mt-3" data-testid="custom-report-empty">
              {t.empty}
            </p>
          ) : (
            <div className="mt-3">
              <p className="text-xs font-medium text-slate-600">
                {t.savedHeading} <span className="font-normal text-slate-500">— {t.savedNote}</span>
              </p>
              <ul className="divide-y divide-slate-100" data-testid="custom-report-list">
                {inUse.map(row)}
              </ul>
            </div>
          )}

          {archived.length > 0 && (
            <div className="mt-2">
              <button
                type="button"
                data-testid="custom-report-toggle-archived"
                aria-expanded={showArchived}
                onClick={() => setShowArchived((v) => !v)}
                className={`text-xs text-slate-600 underline hover:text-slate-900 ${A11Y_FOCUS_RING}`}
              >
                {showArchived ? t.hideArchived : t.showArchived(archived.length)}
              </button>
              {showArchived && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-slate-600">{t.archivedHeading}</p>
                  <ul className="divide-y divide-slate-100" data-testid="custom-report-archived-list">
                    {archived.map(row)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {builder && (
        <CustomReportBuilder
          key={builder.opened}
          reportId={reportId}
          periodId={periodId}
          mode={mode}
          periodStatus={periodStatus}
          initialView={builder.view}
          previewDelayMs={previewDelayMs}
          onClose={() => setBuilder(null)}
          onWritten={refresh}
          onDeleted={(name) => {
            setBuilder(null);
            setNotice(t.done.deleted(name));
            refresh();
          }}
        />
      )}
    </section>
  );
}
