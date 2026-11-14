/**
 * The builder of a custom report: which criteria and which teams appear, under what title; a live preview; export
 * to Excel; save under a name to use again.
 *
 * Everything is ticked to begin with. "Everything ticked" is sent as null, never as today's list, so a saved report
 * follows the criteria and teams added later. The preview is asked for by itself a moment after every change, with
 * the calculation mode of the page; the Excel file is made by the server from the same answer.
 *
 * Nothing here is a dead end: a saved report can be changed, saved as a new one, archived and restored, deleted.
 *
 * The screen holds only what the person touched (`edited…`, null until touched); everything else is read from the
 * saved report. So when a newer version of the report arrives (after an archive, a restore, a conflict) the
 * untouched fields follow it by themselves, and a save sends only the touched ones: it cannot undo what somebody
 * else changed meanwhile.
 */
import { useEffect, useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { dynamicReportsApi } from '@/features/dynamic-reports/api';
import type { SummaryMode } from '@/features/dynamic-reports/types';
import TeamCriteriaChecklist from '@/features/dynamic-reports/criteria/TeamCriteriaChecklist';
import { periodChecklist, ticksFromTarget } from '@/features/dynamic-reports/criteria/criteria';
import { parseBlobError } from '@/features/document-templates/export.api';
import { extractApiError } from '@/lib/api-errors';
import { A11Y_FOCUS_RING } from '@/constants/styles';
import { customReportErrorText, reportCriteria } from '@/locales/reportCriteria.vi';
import {
  customReportCriteriaKey,
  customReportPreviewKey,
  customReportTeamsKey,
  reportViewsApi,
  teamDirectoryKey,
} from './api';
import { buildTeamTree, selectionForPayload } from './customReport';
import CustomReportPreviewTable from './CustomReportPreviewTable';
import TeamTreePicker from './TeamTreePicker';
import type { CustomReportBody, ReportViewDto, ViewDefinitionInput } from './types';

const t = reportCriteria.customReport;
const b = t.builder;

/** How long after the last change the preview is asked for. */
export const CUSTOM_REPORT_PREVIEW_DELAY_MS = 400;

type Busy = 'save' | 'saveAs' | 'export' | 'archive' | 'restore' | 'delete';

interface Props {
  reportId: string;
  periodId: string;
  /** The calculation mode chosen on the page: the preview and the file use it. */
  mode: SummaryMode;
  /** Whether the period is closed. A closed period is counted on its approved figures: another answer than before. */
  periodStatus: 'OPEN' | 'FINALIZED';
  /** The saved report being opened; null for a new one. */
  initialView: ReportViewDto | null;
  onClose: () => void;
  /** A saved report was created or changed: the list on the panel is out of date. */
  onWritten: () => void;
  /** The saved report was deleted from here: the builder has nothing left to show. */
  onDeleted: (name: string) => void;
  previewDelayMs?: number;
}

export default function CustomReportBuilder({
  reportId,
  periodId,
  mode,
  periodStatus,
  initialView,
  onClose,
  onWritten,
  onDeleted,
  previewDelayMs = CUSTOM_REPORT_PREVIEW_DELAY_MS,
}: Props) {
  const [view, setView] = useState<ReportViewDto | null>(initialView);
  // Null until the person touches the field: it then shows what the saved report says (the default, for a new one).
  const [editedName, setEditedName] = useState<string | null>(null);
  const [editedTitle, setEditedTitle] = useState<string | null>(null);
  const [editedShowFilterLine, setEditedShowFilterLine] = useState<boolean | null>(null);
  const [editedTeamColumns, setEditedTeamColumns] = useState<boolean | null>(null);
  const name = editedName ?? view?.name ?? '';
  const title = editedTitle ?? view?.title ?? '';
  const showFilterLine = editedShowFilterLine ?? view?.showFilterLine ?? true;
  const teamColumns = editedTeamColumns ?? view?.teamColumns ?? true;
  // Null until the person changes a tick: the ticks are then what the saved report says (everything, for a new one).
  const [editedItems, setEditedItems] = useState<Set<string> | null>(null);
  const [editedTeams, setEditedTeams] = useState<Set<string> | null>(null);
  const [busy, setBusy] = useState<Busy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saveAsName, setSaveAsName] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const criteriaQ = useQuery({
    queryKey: customReportCriteriaKey(periodId),
    queryFn: () => dynamicReportsApi.loadPeriodCriteria(periodId),
    refetchOnWindowFocus: false,
  });
  const teamsQ = useQuery({
    queryKey: customReportTeamsKey(periodId),
    queryFn: () => dynamicReportsApi.listAssignments(periodId),
    refetchOnWindowFocus: false,
  });
  // Only decides how the teams are drawn: without it the list is flat, never missing.
  const directoryQ = useQuery({
    queryKey: teamDirectoryKey,
    queryFn: () => reportViewsApi.listTeamDirectory(),
    staleTime: 10 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const checklist = useMemo(() => (criteriaQ.data ? periodChecklist(criteriaQ.data, '') : null), [criteriaQ.data]);
  const teamNodes = useMemo(
    () =>
      teamsQ.data
        ? buildTeamTree(
            teamsQ.data.map((a) => ({ teamId: a.teamId, name: a.teamName || a.teamId })),
            directoryQ.data ?? [],
          )
        : null,
    [teamsQ.data, directoryQ.data],
  );
  const allItemKeys = useMemo(() => checklist?.allKeys ?? [], [checklist]);
  const allTeamIds = useMemo(() => (teamNodes ?? []).filter((n) => n.inPeriod).map((n) => n.id), [teamNodes]);
  const listsReady = checklist !== null && teamNodes !== null;
  const listsFailed = criteriaQ.isError || teamsQ.isError;

  const tickedItems = useMemo(() => editedItems ?? ticksFromTarget(view?.itemKeys, allItemKeys), [editedItems, view, allItemKeys]);
  const tickedTeams = useMemo(() => editedTeams ?? ticksFromTarget(view?.teamIds, allTeamIds), [editedTeams, view, allTeamIds]);

  /** What is on the screen, as the server takes it. A selection nobody touched stays exactly what was saved. */
  const definition = useMemo<Required<ViewDefinitionInput>>(
    () => ({
      title: title.trim() === '' ? null : title.trim(),
      showFilterLine,
      itemKeys: editedItems === null ? (view?.itemKeys ?? null) : selectionForPayload(editedItems, allItemKeys, view?.itemKeys ?? null),
      teamIds: editedTeams === null ? (view?.teamIds ?? null) : selectionForPayload(editedTeams, allTeamIds, view?.teamIds ?? null),
      teamColumns,
    }),
    [title, showFilterLine, teamColumns, editedItems, editedTeams, view, allItemKeys, allTeamIds],
  );
  const definitionChanged =
    view === null ||
    definition.title !== view.title ||
    showFilterLine !== view.showFilterLine ||
    teamColumns !== view.teamColumns ||
    editedItems !== null ||
    editedTeams !== null;
  const unsaved = definitionChanged || name.trim() !== (view?.name ?? '');

  /**
   * What the preview and the export are asked for. An unchanged saved report is asked for by its id alone: the
   * server then also says how many criteria were added to the report since it was saved.
   */
  const request = useMemo<CustomReportBody>(
    () => ({ viewId: view?.id ?? null, ...(definitionChanged ? { definition } : {}), mode }),
    [view, definitionChanged, definition, mode],
  );
  const requestText = JSON.stringify(request);

  // A saved list nobody touched is the server's to judge, even when nothing of it is in this period: the answer then
  // says what was left out and why. Only somebody who unticked everything by hand is told here to tick something.
  const savedItemsUntouched = editedItems === null && view !== null && view.itemKeys !== null;
  const savedTeamsUntouched = editedTeams === null && view !== null && view.teamIds !== null;
  const blockReason = !listsReady
    ? null
    : tickedItems.size === 0 && !savedItemsUntouched
      ? b.noCriteriaTicked
      : tickedTeams.size === 0 && !savedTeamsUntouched
        ? b.noTeamsTicked
        : null;
  const canAsk = listsReady && blockReason === null;

  // The preview follows the choices by itself, a moment after the last change (typing a title is many changes).
  const [settledRequest, setSettledRequest] = useState<string | null>(null);
  useEffect(() => {
    if (!canAsk) return;
    const timer = window.setTimeout(() => setSettledRequest(requestText), previewDelayMs);
    return () => window.clearTimeout(timer);
  }, [canAsk, requestText, previewDelayMs]);

  const previewQ = useQuery({
    // The revision is part of the key: after a save the same request means another saved report. So is the status
    // of the period: closing it (or opening it again) changes the figures the same request is answered with.
    queryKey: customReportPreviewKey(periodId, periodStatus, `${view?.revision ?? 0}:${settledRequest ?? ''}`),
    queryFn: () => reportViewsApi.preview(periodId, JSON.parse(settledRequest as string) as CustomReportBody),
    enabled: canAsk && settledRequest !== null,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
  const previewCurrent = settledRequest === requestText && !previewQ.isPlaceholderData && !previewQ.isFetching;
  const previewError = previewQ.isError ? extractApiError(previewQ.error) : null;
  const autoTitle = previewCurrent && definition.title === null && previewQ.data ? previewQ.data.title : b.autoTitleFallback;
  /** The answer on the screen (possibly of a moment ago, then dimmed). */
  const shownPreview = canAsk && !previewError && previewQ.data ? previewQ.data : null;
  // The server answered a saved report of which nothing exists in this period: nothing to export until something is ticked.
  const criteriaGone = shownPreview !== null && shownPreview.counts.criteria.selected === 0;
  const teamsGone = shownPreview !== null && shownPreview.counts.teams.selected === 0;
  /**
   * Why there is no file to make yet. The file is made by the server from the request on the screen, so it is offered
   * only once the preview of exactly that request has arrived: never while it loads, after it failed, or while the
   * table still shows an earlier state of the form.
   */
  const exportReason = !canAsk
    ? null // The lists, or the sentence about nothing being ticked, already say why.
    : previewError
      ? b.exportNeedsPreview
      : !previewCurrent || !previewQ.isSuccess
        ? b.exportWaitsPreview
        : criteriaGone || teamsGone
          ? b.exportNothingLeft
          : null;

  function fail(err: unknown) {
    const e = extractApiError(err);
    setError(customReportErrorText(e.code, e.message));
    return e;
  }

  /** Somebody else wrote first: take what is saved now; what the person chose stays on the screen. */
  async function reloadAfterConflict(message: string) {
    if (!view) return;
    onWritten();
    try {
      const latest = (await reportViewsApi.list(reportId)).find((v) => v.id === view.id) ?? null;
      if (!latest) {
        // Nothing is saved any more: what is on the screen is all there is, so it becomes the person's own.
        setEditedName(name);
        setEditedTitle(title);
        setEditedShowFilterLine(showFilterLine);
        setEditedTeamColumns(teamColumns);
        setEditedItems(new Set(tickedItems));
        setEditedTeams(new Set(tickedTeams));
      }
      // What the person did not touch follows what is saved now: saving again must not undo the other person's change.
      setView(latest);
      setError(latest ? message : t.conflictGone);
    } catch {
      setError(t.errors.REVISION_CONFLICT);
    }
  }

  async function run(kind: Busy, action: () => Promise<void>, conflictMessage: string = t.errors.REVISION_CONFLICT) {
    setBusy(kind);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (err) {
      const e = fail(kind === 'export' ? await parseBlobError(err) : err);
      if (e.code === 'REVISION_CONFLICT') await reloadAfterConflict(conflictMessage);
    } finally {
      setBusy(null);
    }
  }

  /** The saved report is now `saved`: the screen shows it, with nothing pending. */
  function adopt(saved: ReportViewDto, said: string) {
    setView(saved);
    setEditedName(null);
    setEditedTitle(null);
    setEditedShowFilterLine(null);
    setEditedTeamColumns(null);
    setEditedItems(null);
    setEditedTeams(null);
    setSaveAsName(null);
    setNotice(said);
    onWritten();
  }

  const handleSave = () =>
    run(
      'save',
      async () => {
        if (view === null) {
          const created = await reportViewsApi.create(reportId, { name: name.trim(), ...definition });
          adopt(created, t.done.created(created.name));
          return;
        }
        const updated = await reportViewsApi.update(view.id, {
          expectedRevision: view.revision,
          // What nobody touched is not sent: the server leaves it exactly as it is, also when somebody else changed it.
          ...(editedName !== null ? { name: name.trim() } : {}),
          ...(editedTitle !== null ? { title: definition.title } : {}),
          ...(editedShowFilterLine !== null ? { showFilterLine } : {}),
          ...(editedTeamColumns !== null ? { teamColumns } : {}),
          ...(editedItems !== null ? { itemKeys: definition.itemKeys } : {}),
          ...(editedTeams !== null ? { teamIds: definition.teamIds } : {}),
        });
        adopt(updated, t.done.updated(updated.name));
      },
      t.conflictReloaded,
    );

  const handleSaveAsNew = () =>
    run('saveAs', async () => {
      const created = await reportViewsApi.create(reportId, { name: (saveAsName ?? '').trim(), ...definition });
      adopt(created, t.done.created(created.name));
    });

  const handleExport = () =>
    run('export', async () => {
      const { exportId, fileName } = await reportViewsApi.createExport(periodId, request);
      await dynamicReportsApi.downloadExport(exportId, fileName);
      setNotice(t.done.exported(fileName));
    });

  // Archive, restore and delete go with the revision the screen holds, like a save: somebody else's change in between
  // is a conflict to look at, never passed over. The answer is a newer version: untouched fields follow it.
  const handleArchive = () =>
    run(
      'archive',
      async () => {
        if (!view) return;
        const archived = await reportViewsApi.archive(view.id, view.revision);
        setView(archived);
        setNotice(t.done.archived(archived.name));
        onWritten();
      },
      t.conflictReloadedRetry,
    );

  const handleRestore = () =>
    run(
      'restore',
      async () => {
        if (!view) return;
        const restored = await reportViewsApi.restore(view.id, view.revision);
        setView(restored);
        setNotice(t.done.restored(restored.name));
        onWritten();
      },
      t.conflictReloadedRetry,
    );

  const handleDelete = () =>
    run(
      'delete',
      async () => {
        if (!view) return;
        await reportViewsApi.remove(view.id, view.revision);
        onDeleted(view.name);
      },
      t.conflictReloadedRetry,
    );

  const archived = view !== null && view.archivedAt !== null;
  const working = busy !== null;
  // While something is being written the answer will replace what is on the screen: nothing may be typed meanwhile.
  const writing = busy !== null && busy !== 'export';
  const saveReason = archived ? b.archivedReason : name.trim() === '' ? b.nameNeeded : null;
  const cannotUse = !canAsk || working;
  const cannotExport = cannotUse || exportReason !== null;
  const button = `px-3 py-1.5 text-sm rounded-lg disabled:opacity-50 ${A11Y_FOCUS_RING}`;
  const plainButton = `${button} border border-slate-300 text-slate-700 hover:bg-slate-50`;

  return (
    <section className="border border-blue-300 rounded-lg p-4 mt-3 bg-white" data-testid="custom-report-builder" aria-labelledby="custom-report-builder-heading">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 id="custom-report-builder-heading" className="text-sm font-semibold text-slate-800" data-testid="custom-report-builder-heading">
          {view ? b.editHeading(view.name) : b.newHeading}
          {archived && <span className="ml-2 text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{t.archivedTag}</span>}
        </h3>
        {unsaved && (
          <span className="text-xs text-amber-700" data-testid="custom-report-unsaved">
            {b.unsaved}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <label className="block text-sm text-slate-700" htmlFor="custom-report-name">
          {b.name}
          <input
            id="custom-report-name"
            type="text"
            data-testid="custom-report-name"
            value={name}
            maxLength={120}
            placeholder={b.namePlaceholder}
            disabled={writing}
            onChange={(e) => setEditedName(e.target.value)}
            className="block w-full mt-1 border border-slate-300 rounded px-2 py-1 text-sm disabled:bg-slate-50 disabled:text-slate-500"
          />
          <span className="text-xs text-slate-500">{b.nameHint}</span>
        </label>
        <label className="block text-sm text-slate-700" htmlFor="custom-report-title">
          {b.title}
          <input
            id="custom-report-title"
            type="text"
            data-testid="custom-report-title"
            value={title}
            maxLength={300}
            placeholder={autoTitle}
            disabled={writing}
            onChange={(e) => setEditedTitle(e.target.value)}
            className="block w-full mt-1 border border-slate-300 rounded px-2 py-1 text-sm disabled:bg-slate-50 disabled:text-slate-500"
          />
          <span className="text-xs text-slate-500">{b.titleHint}</span>
        </label>
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 mb-3">
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            data-testid="custom-report-show-filter-line"
            checked={showFilterLine}
            disabled={writing}
            onChange={(e) => setEditedShowFilterLine(e.target.checked)}
          />
          {b.showFilterLine}
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            data-testid="custom-report-team-columns"
            checked={teamColumns}
            disabled={writing}
            onChange={(e) => setEditedTeamColumns(e.target.checked)}
          />
          {b.teamColumns}
        </label>
      </div>

      {!listsReady && !listsFailed && (
        <p className="text-sm text-slate-500" data-testid="custom-report-lists-loading">
          {b.loading}
        </p>
      )}
      {listsFailed && (
        <div className="text-sm text-red-700" data-testid="custom-report-lists-error" role="alert">
          <p>{b.listsError}</p>
          <button
            type="button"
            data-testid="custom-report-lists-retry"
            onClick={() => {
              if (criteriaQ.isError) void criteriaQ.refetch();
              if (teamsQ.isError) void teamsQ.refetch();
            }}
            className={`mt-1 px-3 py-1 border border-red-300 rounded-lg hover:bg-red-50 ${A11Y_FOCUS_RING}`}
          >
            {t.retry}
          </button>
        </div>
      )}

      {checklist && teamNodes && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <TeamCriteriaChecklist
            teamId="custom-report"
            teamName=""
            groups={checklist.groups}
            total={allItemKeys.length}
            ticked={tickedItems}
            onChange={setEditedItems}
            otherTeams={[]}
            onCopyFrom={() => undefined}
            onApplyToAll={() => undefined}
            defaultOpen
            sectionLabel={b.criteriaSection}
            countLabel={b.criteriaCount}
            testIdPrefix="custom-report-criteria"
            disabled={writing}
          />
          <div className="mt-3 border-t border-slate-100 pt-2">
            <TeamTreePicker nodes={teamNodes} total={allTeamIds.length} ticked={tickedTeams} onChange={setEditedTeams} disabled={writing} />
          </div>
        </div>
      )}

      {blockReason && (
        <p className="text-sm text-red-700 mt-3" data-testid="custom-report-block-reason" role="alert">
          {blockReason}
        </p>
      )}

      <div className="mt-4" data-testid="custom-report-preview-area">
        <div className="flex flex-wrap items-baseline gap-x-3 mb-1">
          <h4 className="text-sm font-semibold text-slate-800">{t.preview.heading}</h4>
          <span className="text-xs text-slate-500">{t.preview.auto}</span>
          {canAsk && !previewCurrent && !previewError && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500" data-testid="custom-report-preview-loading">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {t.preview.loading}
            </span>
          )}
        </div>
        {canAsk && previewError && (
          <div className="text-sm text-red-700" data-testid="custom-report-preview-error" role="alert">
            <p>
              {t.preview.error} {customReportErrorText(previewError.code, previewError.message)}
            </p>
            <button
              type="button"
              data-testid="custom-report-preview-retry"
              onClick={() => void previewQ.refetch()}
              className={`mt-1 px-3 py-1 border border-red-300 rounded-lg hover:bg-red-50 ${A11Y_FOCUS_RING}`}
            >
              {t.retry}
            </button>
          </div>
        )}
        {shownPreview && (
          <div className={previewCurrent ? '' : 'opacity-60'}>
            {criteriaGone && (
              <p className="text-sm text-red-700 mb-2" data-testid="custom-report-saved-criteria-gone" role="alert">
                {t.preview.savedCriteriaGone}
              </p>
            )}
            {teamsGone && (
              <p className="text-sm text-red-700 mb-2" data-testid="custom-report-saved-teams-gone" role="alert">
                {/* A team the system no longer knows is worded, never shown by its id. */}
                {t.preview.savedTeamsGone(shownPreview.ignored.teams.map((team) => team.name ?? t.preview.unknownTeam).join(', '))}
              </p>
            )}
            <CustomReportPreviewTable preview={shownPreview} />
          </div>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-700 mt-3" data-testid="custom-report-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="text-sm text-green-700 mt-3" data-testid="custom-report-builder-notice" role="status">
          {notice}
        </p>
      )}

      {saveAsName !== null && (
        <div className="flex flex-wrap items-end gap-2 mt-3 border border-slate-200 rounded-lg p-3" data-testid="custom-report-save-as-box">
          <label className="flex-1 min-w-56 text-sm text-slate-700" htmlFor="custom-report-save-as-name">
            {b.saveAsNewName}
            <input
              id="custom-report-save-as-name"
              type="text"
              data-testid="custom-report-save-as-name"
              value={saveAsName}
              maxLength={120}
              disabled={writing}
              onChange={(e) => setSaveAsName(e.target.value)}
              className="block w-full mt-1 border border-slate-300 rounded px-2 py-1 text-sm"
            />
          </label>
          <button
            type="button"
            data-testid="custom-report-save-as-confirm"
            disabled={cannotUse || saveAsName.trim() === ''}
            onClick={() => void handleSaveAsNew()}
            className={`${button} bg-blue-600 text-white hover:bg-blue-700`}
          >
            {busy === 'saveAs' ? b.saving : b.saveAsNewConfirm}
          </button>
          <button type="button" data-testid="custom-report-save-as-cancel" disabled={working} onClick={() => setSaveAsName(null)} className={plainButton}>
            {t.cancel}
          </button>
        </div>
      )}

      {confirmingDelete && view && (
        <div className="mt-3 border border-red-200 bg-red-50 rounded-lg p-3" data-testid="custom-report-delete-confirm" role="alertdialog" aria-label={t.remove}>
          <p className="text-sm text-red-800 mb-2">{t.confirmDelete(view.name)}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              data-testid="custom-report-delete-yes"
              disabled={working}
              onClick={() => void handleDelete()}
              className={`${button} bg-red-600 text-white hover:bg-red-700`}
            >
              {t.confirmDeleteYes}
            </button>
            <button type="button" data-testid="custom-report-delete-no" disabled={working} onClick={() => setConfirmingDelete(false)} className={plainButton}>
              {t.cancel}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mt-4">
        <button
          type="button"
          data-testid="custom-report-export"
          disabled={cannotExport}
          title={exportReason ?? undefined}
          onClick={() => void handleExport()}
          className={`${button} inline-flex items-center gap-2 border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100`}
        >
          {busy === 'export' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
          {busy === 'export' ? t.exporting : t.export}
        </button>
        <button
          type="button"
          data-testid="custom-report-save"
          disabled={cannotUse || saveReason !== null}
          title={saveReason ?? undefined}
          onClick={() => void handleSave()}
          className={`${button} bg-blue-600 text-white hover:bg-blue-700`}
        >
          {busy === 'save' ? b.saving : b.save}
        </button>
        {view && (
          <button
            type="button"
            data-testid="custom-report-save-as"
            disabled={cannotUse}
            onClick={() => setSaveAsName(b.copyName(name.trim() || view.name))}
            className={plainButton}
          >
            {b.saveAsNew}
          </button>
        )}
        {view && !archived && (
          <button type="button" data-testid="custom-report-archive" disabled={working} onClick={() => void handleArchive()} className={plainButton}>
            {t.archive}
          </button>
        )}
        {view && archived && (
          <button type="button" data-testid="custom-report-restore" disabled={working} onClick={() => void handleRestore()} className={plainButton}>
            {t.restore}
          </button>
        )}
        {view && (
          <button
            type="button"
            data-testid="custom-report-delete"
            disabled={working}
            onClick={() => setConfirmingDelete(true)}
            className={`${button} border border-red-200 text-red-700 hover:bg-red-50`}
          >
            {t.remove}
          </button>
        )}
        <button type="button" data-testid="custom-report-close" disabled={working} onClick={onClose} className={`${button} text-slate-600 hover:bg-slate-50`}>
          {b.close}
        </button>
      </div>
      {exportReason && (
        <p className="text-xs text-slate-500 mt-1" data-testid="custom-report-export-reason">
          {exportReason}
        </p>
      )}
      {saveReason && (
        <p className="text-xs text-slate-500 mt-1" data-testid="custom-report-save-reason">
          {saveReason}
        </p>
      )}
    </section>
  );
}
