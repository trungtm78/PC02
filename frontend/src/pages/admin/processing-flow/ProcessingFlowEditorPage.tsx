/**
 * /admin/quy-trinh/:id — one flow: its name, the information types it is applied to, its steps as a table and as a
 * Gantt chart, its versions. Editing is on a DRAFT only; a published version is read-only (and shows "Tạo bản nháp
 * mới"). Every write carries the revision the person looked at: the flow's for the flow, the VERSION's for steps,
 * publishing and the legal check.
 */
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY } from '@/constants/styles';
import { useDirectoryOptions } from '@/hooks/useDirectoryOptions';
import { useOfficerOptions } from '@/hooks/useOfficerOptions';
import { processingFlow as L } from '@/locales/processingFlow.vi';
import { processingFlowApi } from '@/features/processing-flow/api';
import { CODE } from '@/features/processing-flow/codes';
import { BindingsBar } from '@/features/processing-flow/components/BindingsBar';
import { FeatureOffState } from '@/features/processing-flow/components/FeatureOffState';
import { FlowMetaPanel } from '@/features/processing-flow/components/FlowMetaPanel';
import { SchedulePreviewSection } from '@/features/processing-flow/components/SchedulePreviewSection';
import { StepsTable } from '@/features/processing-flow/components/StepsTable';
import { VersionHistoryPanel } from '@/features/processing-flow/components/VersionHistoryPanel';
import { boundConflictsOf, explainError, inactiveTeamsOf, isFeatureOff, isForbidden, issuesOf } from '@/features/processing-flow/errors';
import { ForbiddenState } from '@/features/processing-flow/components/ForbiddenState';
import { boundConflictLines, inactiveTeamLine, issueLine } from '@/features/processing-flow/issueText';
import { PROCESSING_QUERY_KEYS } from '@/features/processing-flow/queryKeys';
import { draftFromDto, isDirty, newStepFrom, toStepPayloads, unverifiedCount, type StepDraft } from '@/features/processing-flow/steps';
import type { FlowDetailDto, StepIssue, VersionDto } from '@/features/processing-flow/types';
import { useProcessingPermissions } from '@/features/processing-flow/usePermissions';
import { useTeamChoices } from '@/features/processing-flow/useTeamChoices';

type View = 'draft' | 'published';

/** Which version the editor shows: the draft when there is one (unless the person asked for the published), else the published. */
function versionShown(flow: FlowDetailDto, view: View | null): { version: VersionDto | null; view: View } {
  if (view === 'published' && flow.published) return { version: flow.published, view: 'published' };
  if (flow.draft) return { version: flow.draft, view: 'draft' };
  return { version: flow.published, view: 'published' };
}

const draftsOf = (version: VersionDto | null): StepDraft[] => (version ? version.steps.map((s) => draftFromDto(s)) : []);

export default function ProcessingFlowEditorPage() {
  const { id = '' } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const flowQ = useQuery({
    queryKey: PROCESSING_QUERY_KEYS.flow(id),
    queryFn: () => processingFlowApi.get(id),
    enabled: id !== '',
    retry: false,
    refetchOnWindowFocus: false,
  });

  // A failed REFRESH (the flow was read before) must not take the form away: it holds what the person typed.
  if (flowQ.isError && !flowQ.data) {
    if (isFeatureOff(flowQ.error)) return <FeatureOffState />;
    if (isForbidden(flowQ.error)) return <ForbiddenState />;
    return (
      <div data-testid="editor-load-error" role="alert" className="m-4 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
        <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" aria-hidden="true" />
        <p className="flex-1 text-sm text-red-700">{explainError(flowQ.error).message}</p>
        <button type="button" className={BTN_SECONDARY} onClick={() => void flowQ.refetch()}>
          {L.common.retry}
        </button>
        <Link to="/admin/quy-trinh" className="text-sm text-blue-700 hover:underline">
          {L.editor.back}
        </Link>
      </div>
    );
  }
  if (!flowQ.data) {
    return (
      <p data-testid="editor-loading" role="status" className="m-4 text-sm text-slate-500">
        {L.common.loading}
      </p>
    );
  }

  return (
    <EditorBody
      key={id}
      flow={flowQ.data}
      setFlow={(next) => {
        queryClient.setQueryData(PROCESSING_QUERY_KEYS.flow(id), next);
        void queryClient.invalidateQueries({ queryKey: PROCESSING_QUERY_KEYS.flows });
      }}
      reload={() => void flowQ.refetch()}
      refreshing={flowQ.isFetching}
      refreshFailed={flowQ.isError}
    />
  );
}

interface BodyProps {
  flow: FlowDetailDto;
  setFlow: (flow: FlowDetailDto) => void;
  reload: () => void;
  /** The flow is being read again (after a conflict). */
  refreshing: boolean;
  /** The last read failed while an earlier answer is still held. */
  refreshFailed: boolean;
}

function EditorBody({ flow, setFlow, reload, refreshing, refreshFailed }: BodyProps) {
  const perms = useProcessingPermissions();
  const teamsQ = useTeamChoices();
  const catalogueQ = useDirectoryOptions('LOAI_THONG_TIN', { returnId: true, limit: 1000 });
  const officersQ = useOfficerOptions();

  const [view, setView] = useState<View | null>(null);
  const shown = versionShown(flow, view);
  const [steps, setSteps] = useState<StepDraft[]>(() => draftsOf(shown.version));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [warnings, setWarnings] = useState<StepIssue[]>([]);
  const [bindingError, setBindingError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [metaOpen, setMetaOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishIssues, setPublishIssues] = useState<StepIssue[] | null>(null);
  const [inactive, setInactive] = useState<string[] | null>(null);
  const [dropDraftOpen, setDropDraftOpen] = useState(false);

  const teams = teamsQ.data ?? [];
  const officers = officersQ.data ?? [];
  const userName = (userId: string | null): string | null => (userId ? (officers.find((o) => o.value === userId)?.label ?? null) : null);

  const version = shown.version;
  const archived = flow.status === 'ARCHIVED';
  const onDraft = shown.view === 'draft' && version?.status === 'DRAFT';
  const editable = onDraft && perms.canEdit && !archived;
  const dirty = version ? isDirty(steps, toStepPayloads(draftsOf(version))) : false;
  /**
   * After a conflict nothing may be written until the person has taken the newer flow: the screen holds the contents of
   * an OLDER revision, and the refresh has already moved `flow.revision` on under it.
   */
  const locked = busy || conflict;

  /** The person's own edit of the steps: it also withdraws a publish confirmation that was opened for the contents before it. */
  const changeSteps = (next: StepDraft[] | ((prev: StepDraft[]) => StepDraft[])) => {
    setPublishOpen(false);
    setSteps(next);
  };

  /** The person takes the newer flow: its contents replace the screen, and every panel built on the old one closes. */
  function takeNewerFlow() {
    if (refreshFailed) {
      reload();
      return;
    }
    setConflict(false);
    setSteps(draftsOf(version));
    setMetaOpen(false);
    setPublishOpen(false);
    setDropDraftOpen(false);
    setBindingError(null);
  }

  /** Replace what is on screen with a flow the server just sent (a save, a publish, a new draft…). */
  function applyFlow(next: FlowDetailDto, nextView: View | null) {
    setFlow(next);
    setView(nextView);
    setSteps(draftsOf(versionShown(next, nextView).version));
  }

  function resetNotices() {
    setMessage(null);
    setError(null);
    setConflict(false);
  }

  /** One write at a time: every control is disabled while it runs. `job` answers `false` when it handled a refusal itself. */
  async function run(job: () => Promise<void>) {
    setBusy(true);
    resetNotices();
    try {
      await job();
    } catch (err) {
      const e = explainError(err);
      if (e.conflict) {
        setConflict(true);
        reload();
      } else {
        setError(e.message);
      }
    } finally {
      setBusy(false);
    }
  }

  const save = () =>
    run(async () => {
      if (!version) return;
      const result = await processingFlowApi.saveSteps(flow.id, version.id, toStepPayloads(steps), version.revision);
      applyFlow(result.flow, 'draft');
      setWarnings(result.warnings);
      setMessage(L.editor.saved);
    });

  const publish = async () => {
    if (!version || dirty || conflict) return;
    setBusy(true);
    resetNotices();
    setPublishIssues(null);
    setInactive(null);
    try {
      const next = await processingFlowApi.publish(flow.id, version.id, version.revision);
      applyFlow(next, null);
      setWarnings([]);
      setPublishOpen(false);
      setMessage(L.publish.published(version.versionNo));
    } catch (err) {
      const e = explainError(err);
      if (e.code === CODE.FLOW_INVALID) setPublishIssues(issuesOf(e.details));
      else if (e.code === CODE.TEAM_NOT_ACTIVE) {
        const names = steps.map((s) => s.name);
        const nameOfTeam = (teamId: string) =>
          steps.flatMap((s) => s.parties).find((p) => p.teamId === teamId)?.teamName ?? teams.find((t) => t.id === teamId)?.name ?? null;
        setInactive(inactiveTeamsOf(e.details).map((d) => inactiveTeamLine(d, names, nameOfTeam)));
      } else if (e.conflict) {
        setConflict(true);
        setPublishOpen(false);
        reload();
      } else setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const verify = (stepKey: string, on: boolean) =>
    run(async () => {
      if (!version) return;
      const call = on ? processingFlowApi.verifyLegal : processingFlowApi.unverifyLegal;
      const next = await call(flow.id, version.id, stepKey, version.revision);
      applyFlow(next, shown.view);
      setMessage(on ? L.editor.verify.done : L.editor.verify.undone);
    });

  const newDraft = () =>
    run(async () => {
      applyFlow(await processingFlowApi.createDraft(flow.id), 'draft');
      setWarnings([]);
    });

  const dropDraft = () =>
    run(async () => {
      if (!version) return;
      const next = await processingFlowApi.deleteDraft(flow.id, version.id, version.revision);
      setDropDraftOpen(false);
      applyFlow(next, 'published');
    });

  const saveBindings = (directoryIds: string[], deadlineGroups: string[]) =>
    run(async () => {
      setBindingError(null);
      try {
        setFlow(await processingFlowApi.setBindings(flow.id, directoryIds, deadlineGroups, flow.revision));
      } catch (err) {
        const e = explainError(err);
        if (e.conflict) throw err;
        const catalogue = catalogueQ.data ?? [];
        const lines = boundConflictLines(boundConflictsOf(e.details), (c) =>
          c.deadlineGroup
            ? (L.deadlineGroups[c.deadlineGroup] ?? c.deadlineGroup)
            : (catalogue.find((o) => o.value === c.directoryId)?.label ?? flow.boundTypes.find((t) => t.directoryId === c.directoryId)?.name ?? c.directoryId ?? ''),
        );
        setBindingError([e.message, ...lines].join(' '));
      }
    });

  const saveMeta = (values: { name: string; description: string | null; isDefault: boolean }) =>
    run(async () => {
      setFlow(await processingFlowApi.update(flow.id, { ...values, expectedRevision: flow.revision }));
      setMetaOpen(false);
      setMessage(L.editor.meta.saved);
    });

  const stepNames = steps.map((s) => s.name);
  const unverified = unverifiedCount(steps);

  return (
    <div data-testid="processing-flow-editor-page" className="flex flex-col gap-3 p-4">
      <div>
        <Link to="/admin/quy-trinh" className="text-sm text-blue-700 hover:underline">
          {L.editor.back}
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 data-testid="editor-title" className="text-xl font-bold text-[#003973]">
              {flow.name}
            </h1>
            {flow.isDefault && (
              <span data-testid="editor-badge-default" className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800">
                {L.list.badges.default}
              </span>
            )}
            {archived && (
              <span data-testid="editor-badge-archived" className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                {L.list.badges.archived}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-600">
            <span data-testid="editor-record-kind">{L.recordKinds[flow.recordKind]}</span>
            {' · '}
            <span data-testid="editor-version-line">
              {version ? L.editor.versionLine(version.versionNo, L.editor.versionStatus[version.status] ?? version.status) : L.editor.noVersion}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {flow.draft && flow.published && (
            <div role="group" className="inline-flex overflow-hidden rounded-lg border border-slate-300">
              <button
                type="button"
                data-testid="editor-view-draft"
                aria-pressed={shown.view === 'draft'}
                disabled={locked}
                onClick={() => {
                  if (shown.view === 'draft') return;
                  setView('draft');
                  setSteps(draftsOf(flow.draft));
                }}
                className={`px-3 py-1.5 text-sm ${shown.view === 'draft' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700'}`}
              >
                {L.editor.viewDraft}
              </button>
              <button
                type="button"
                data-testid="editor-view-published"
                aria-pressed={shown.view === 'published'}
                disabled={locked || (dirty && shown.view === 'draft')}
                title={dirty && shown.view === 'draft' ? L.editor.unsaved : undefined}
                onClick={() => {
                  if (shown.view === 'published') return;
                  setView('published');
                  setSteps(draftsOf(flow.published));
                }}
                className={`border-l border-slate-300 px-3 py-1.5 text-sm ${shown.view === 'published' ? 'bg-blue-600 text-white' : 'bg-white text-slate-700'}`}
              >
                {L.editor.viewPublished}
              </button>
            </div>
          )}
          {perms.canEdit && !archived && (
            <button type="button" data-testid="editor-edit-meta" className={BTN_SECONDARY} disabled={locked} onClick={() => setMetaOpen((o) => !o)}>
              {L.editor.editMeta}
            </button>
          )}
          <button type="button" data-testid="editor-history-btn" className={BTN_SECONDARY} aria-expanded={historyOpen} onClick={() => setHistoryOpen((o) => !o)}>
            {L.editor.history}
          </button>
          {!flow.draft && perms.canEdit && !archived && (
            <button type="button" data-testid="editor-new-draft" className={BTN_PRIMARY} disabled={locked} onClick={() => void newDraft()}>
              {L.editor.newDraft}
            </button>
          )}
          {onDraft && flow.published && perms.canEdit && !archived && (
            <button type="button" data-testid="editor-delete-draft" className={BTN_SECONDARY} disabled={locked} onClick={() => setDropDraftOpen(true)}>
              {L.editor.deleteDraft}
            </button>
          )}
          {editable && (
            <button type="button" data-testid="editor-save" className={BTN_SECONDARY} disabled={locked || !dirty} onClick={() => void save()}>
              {busy ? L.common.saving : L.editor.saveDraft}
            </button>
          )}
          {onDraft && perms.canPublish && !archived && (
            <button
              type="button"
              data-testid="editor-publish"
              className={BTN_PRIMARY}
              disabled={locked || dirty}
              title={dirty ? L.editor.unsaved : undefined}
              onClick={() => {
                resetNotices();
                setPublishIssues(null);
                setInactive(null);
                setPublishOpen(true);
              }}
            >
              {L.editor.publish}
            </button>
          )}
        </div>
      </div>

      {message && (
        <p data-testid="editor-message" role="status" className="rounded border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
          {message}
        </p>
      )}
      {error && (
        <p data-testid="editor-error" role="alert" className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {conflict && (
        <div data-testid="editor-conflict" role="alert" className="flex flex-wrap items-center gap-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <div className="min-w-0 flex-1">
            <b>{L.conflict.title}</b> {L.conflict.body}
          </div>
          <button type="button" data-testid="editor-conflict-reload" className={BTN_SECONDARY} disabled={refreshing} onClick={takeNewerFlow}>
            {refreshing ? L.conflict.reloading : refreshFailed ? L.common.retry : L.conflict.reload}
          </button>
          {refreshFailed && !refreshing && (
            <span data-testid="editor-refresh-failed" className="basis-full text-red-700">
              {L.conflict.refreshFailed}
            </span>
          )}
        </div>
      )}
      {dirty && editable && (
        <p data-testid="editor-unsaved" className="text-xs text-amber-800">
          {L.editor.unsaved}
        </p>
      )}
      {archived && (
        <p data-testid="editor-archived-note" className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          {L.editor.archivedNote}
        </p>
      )}
      {!archived && shown.view === 'published' && (
        <p data-testid="editor-readonly-note" className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          {L.editor.readOnly}
        </p>
      )}

      {metaOpen && perms.canEdit && !archived && <FlowMetaPanel flow={flow} busy={locked} onSave={(v) => void saveMeta(v)} onClose={() => setMetaOpen(false)} />}

      {dropDraftOpen && version && (
        <section data-testid="editor-delete-draft-panel" className="flex flex-col gap-2 rounded-lg border border-red-200 bg-white p-3">
          <p className="text-sm text-slate-700">{L.editor.deleteDraftConfirm(version.versionNo)}</p>
          <div className="flex gap-2">
            <button type="button" className={BTN_SECONDARY} onClick={() => setDropDraftOpen(false)} disabled={busy}>
              {L.common.cancel}
            </button>
            <button type="button" data-testid="editor-delete-draft-confirm" className={BTN_DANGER} disabled={locked} onClick={() => void dropDraft()}>
              {L.editor.deleteDraftYes}
            </button>
          </div>
        </section>
      )}

      {historyOpen && <VersionHistoryPanel versions={flow.versions} userName={userName} />}

      {publishOpen && version && (
        <section data-testid="editor-publish-panel" className="flex flex-col gap-2 rounded-lg border border-blue-300 bg-slate-50 p-3">
          <b className="text-sm text-slate-800">{L.publish.title(version.versionNo)}</b>
          <span data-testid="editor-publish-sentence" className="text-sm text-slate-600">
            {L.publish.sentence(version.versionNo)}
          </span>
          {publishIssues && (
            <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-800">
              <p className="font-medium">{L.publish.invalidTitle}</p>
              <ul data-testid="editor-publish-invalid" className="mt-1 list-disc pl-5">
                {publishIssues.map((issue, i) => (
                  <li key={`${issue.code}-${issue.stepIndex ?? 'flow'}-${i}`}>{issueLine(issue, stepNames)}</li>
                ))}
              </ul>
            </div>
          )}
          {inactive && (
            <div data-testid="editor-publish-teams" className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-800">
              <p className="font-medium">{L.publish.inactiveTeamsTitle}</p>
              <ul className="mt-1 list-disc pl-5">
                {inactive.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          )}
          {error && <p className="text-sm text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button type="button" data-testid="editor-publish-confirm" className={BTN_PRIMARY} disabled={locked || dirty} onClick={() => void publish()}>
              {L.publish.confirm(version.versionNo)}
            </button>
            <button type="button" data-testid="editor-publish-cancel" className={BTN_SECONDARY} disabled={busy} onClick={() => setPublishOpen(false)}>
              {L.common.cancel}
            </button>
          </div>
        </section>
      )}

      <BindingsBar
        flow={flow}
        catalogue={catalogueQ.data ?? []}
        editable={perms.canEdit && !archived}
        busy={locked}
        onSave={(ids, groups) => void saveBindings(ids, groups)}
        error={bindingError}
      />

      {unverified > 0 && (
        <p data-testid="editor-unverified" className="rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900">
          {L.editor.unverifiedWarning(unverified)}
        </p>
      )}
      {warnings.length > 0 && (
        <div data-testid="editor-warnings" className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p className="font-medium">{L.editor.warningsTitle}</p>
          <ul className="mt-1 list-disc pl-5">
            {warnings.map((w, i) => (
              <li key={`${w.code}-${w.stepIndex ?? 'flow'}-${i}`}>{issueLine(w, stepNames)}</li>
            ))}
          </ul>
        </div>
      )}

      <StepsTable
        recordKind={flow.recordKind}
        steps={steps}
        editable={editable && !locked}
        onChange={changeSteps}
        teams={teams}
        canVerify={perms.canVerify && !archived}
        verifyBlocked={locked || dirty}
        onVerify={(key, on) => void verify(key, on)}
        userName={userName}
      />
      {editable && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" data-testid="editor-add-step" className={BTN_SECONDARY} disabled={locked} onClick={() => changeSteps((prev) => [...prev, newStepFrom(prev.at(-1) ?? null, L.editor.steps.newStepName)])}>
            {L.editor.steps.addStep}
          </button>
          <span className="text-xs text-slate-500">{L.editor.steps.addStepHint}</span>
        </div>
      )}

      <SchedulePreviewSection recordKind={flow.recordKind} steps={steps} />
    </div>
  );
}
