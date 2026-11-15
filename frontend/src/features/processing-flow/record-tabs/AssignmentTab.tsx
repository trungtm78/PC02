/**
 * "Phân công xử lý": the flow of ONE record. The Gantt chart with real dates, then one row per step: its units, the
 * regulatory deadline and the unit's own target, the colour the server computed, and the actions the person may take.
 * The browser decides nothing about deadlines: it shows what `GET /processing/records/:kind/:id` answered and sends
 * the person's commands with the revision it read.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import { BTN_PRIMARY, BTN_SECONDARY } from '@/constants/styles';
import { formatVNDate, today, toDateInput } from '@/lib/dates';
import { errorText, processingFlow as L } from '@/locales/processingFlow.vi';
import { GanttChart } from '../components/GanttChart';
import { processingRecordApi } from './api';
import { recordGantt } from './ganttRows';
import { isAdjusted, partyLine, problemText, recordDeadlineStep, stepBadge, TONE_CLASS, waitingNote } from './present';
import { RECORD_QUERY_KEYS } from './queryKeys';
import { RecordNotices } from './RecordNotices';
import { StepPanel, type PanelState, type PanelType } from './StepPanel';
import { FIELD_BOX, FIELD_LABEL, LINK_BUTTON, SMALL_PRIMARY, SMALL_SECONDARY } from './styles';
import type { RecordFlowDto, RecordKind, RecordStepDto, RecordStepPartyDto } from './types';
import { useCurrentUserId } from './useCurrentUserId';
import { useRecordFlow, type RecordFlowHandle } from './useRecordFlow';
import { useRecordWrite } from './useRecordWrite';
import { useStepPermissions } from '../usePermissions';

const R = L.recordTabs;

interface Props {
  kind: RecordKind;
  recordId: string;
}

export function AssignmentTab({ kind, recordId }: Props) {
  const handle = useRecordFlow(kind, recordId);
  if (handle.state === 'loading') {
    return (
      <p data-testid="assignment-loading" role="status" className="py-6 text-sm text-slate-500">
        {L.common.loading}
      </p>
    );
  }
  if (handle.state === 'off') {
    return (
      <p data-testid="assignment-off" className="rounded border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">
        {R.off}
      </p>
    );
  }
  if (handle.state === 'error') {
    return (
      <div data-testid="assignment-load-error" role="alert" className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
        <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" aria-hidden="true" />
        <p className="flex-1 text-sm text-red-700">{handle.errorMessage}</p>
        <button type="button" className={BTN_SECONDARY} onClick={() => void handle.refetch()}>
          {L.common.retry}
        </button>
      </div>
    );
  }
  return <AssignmentBody kind={kind} recordId={recordId} handle={handle} />;
}

interface BodyProps extends Props {
  handle: RecordFlowHandle;
}

function AssignmentBody({ kind, recordId, handle }: BodyProps) {
  const flow = handle.flow;
  const perms = useStepPermissions();
  const write = useRecordWrite(kind, recordId, handle);

  const me = useCurrentUserId();

  const [panel, setPanel] = useState<PanelState | null>(null);
  /** The party a person is being chosen for, with the person picked so far. */
  const [assigning, setAssigning] = useState<{ stepKey: string; partyId: string; userId: string } | null>(null);
  const [acceptedDate, setAcceptedDate] = useState(() => today());
  const gantt = useMemo(() => (flow ? recordGantt(flow) : null), [flow]);

  if (!flow) {
    // No flow applied yet: the explanation and, for the person who may, the one button.
    return (
      <div data-testid="assignment-tab" className="flex flex-col gap-3">
        <RecordNotices
          testPrefix="assignment"
          message={write.message}
          error={write.error}
          conflict={write.conflict}
          refreshing={handle.refreshing}
          refreshFailed={handle.refreshFailed}
          onTakeNewer={() => write.takeNewer()}
        />
        <div data-testid="assignment-no-flow" className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
          <h2 className="text-base font-semibold text-slate-800">{R.noFlow.title}</h2>
          <p className="mx-auto mt-1 max-w-xl text-sm text-slate-600">{R.noFlow.body}</p>
          {perms.canAssign ? (
            <button
              type="button"
              data-testid="assignment-apply"
              className={`${BTN_PRIMARY} mt-3`}
              disabled={write.locked}
              onClick={() => void write.run('apply', (key) => processingRecordApi.apply(kind, recordId, { idempotencyKey: key }), R.done.applied)}
            >
              {R.noFlow.apply}
            </button>
          ) : (
            <p data-testid="assignment-apply-denied" className="mt-3 text-sm text-slate-500">
              {R.noFlow.noPermission}
            </p>
          )}
        </div>
      </div>
    );
  }

  const revision = flow.revision;
  const deadlineStep = recordDeadlineStep(flow);
  const waitingForAccepted = flow.steps.find((s) => s.status === 'WAITING_ANCHOR' && s.anchor === 'ACCEPTED');

  /** Run a write, and close the open panel when it went through. */
  const send = async (signature: string, job: (key: string) => Promise<RecordFlowDto>, done: string) => {
    const ok = await write.run(signature, job, done);
    if (ok) setPanel(null);
    return ok;
  };

  const openPanel = (type: PanelType, step: RecordStepDto) => {
    write.setError(null);
    setPanel({ type, stepKey: step.stepKey, reason: '', date: toDateInput(step.dueAt) });
  };

  const requireText = (text: string, code: string): boolean => {
    if (text.trim() !== '') return true;
    write.setError(errorText(code));
    return false;
  };

  const submitPanel = () => {
    if (!panel) return;
    const reason = panel.reason.trim();
    const sig = JSON.stringify([panel.type, panel.stepKey, reason, panel.date]);
    if (panel.type === 'skip') {
      if (!requireText(reason, 'STEP_REASON_REQUIRED')) return;
      void send(sig, (key) => processingRecordApi.skip(kind, recordId, panel.stepKey, { expectedRevision: revision, idempotencyKey: key, reason }), R.done.skipped);
    } else if (panel.type === 'extend') {
      if (!requireText(reason, 'STEP_REASON_REQUIRED')) return;
      void send(sig, (key) => processingRecordApi.extend(kind, recordId, panel.stepKey, { expectedRevision: revision, idempotencyKey: key, reason }), R.done.extended);
    } else if (panel.type === 'reopen') {
      void send(
        sig,
        (key) => processingRecordApi.reopen(kind, recordId, panel.stepKey, { expectedRevision: revision, idempotencyKey: key, ...(reason ? { reason } : {}) }),
        R.done.reopened,
      );
    } else {
      if (!requireText(panel.date, 'DUE_DATE_INVALID')) return;
      void send(
        sig,
        (key) => processingRecordApi.due(kind, recordId, panel.stepKey, { expectedRevision: revision, idempotencyKey: key, date: panel.date, ...(reason ? { reason } : {}) }),
        R.done.adjusted,
      );
    }
  };

  const complete = (step: RecordStepDto) =>
    void write.run(
      JSON.stringify(['complete', step.stepKey]),
      (key) => processingRecordApi.complete(kind, recordId, step.stepKey, { expectedRevision: revision, idempotencyKey: key }),
      R.done.completed,
    );
  const unskip = (step: RecordStepDto) =>
    void write.run(
      JSON.stringify(['unskip', step.stepKey]),
      (key) => processingRecordApi.unskip(kind, recordId, step.stepKey, { expectedRevision: revision, idempotencyKey: key }),
      R.done.unskipped,
    );
  const backToRegulatory = (step: RecordStepDto) =>
    void write.run(
      JSON.stringify(['due-reset', step.stepKey]),
      (key) => processingRecordApi.due(kind, recordId, step.stepKey, { expectedRevision: revision, idempotencyKey: key, date: null }),
      R.done.adjustReset,
    );
  const confirm = () =>
    void write.run('confirm', (key) => processingRecordApi.confirm(kind, recordId, { expectedRevision: revision, idempotencyKey: key }), R.done.confirmed);
  const reapply = () =>
    void write.run('reapply', (key) => processingRecordApi.reapply(kind, recordId, { expectedRevision: revision, idempotencyKey: key }), R.done.reapplied);
  const recordAccepted = () => {
    if (!requireText(acceptedDate, 'ACCEPTED_DATE_INVALID')) return;
    void write.run(
      JSON.stringify(['accepted', acceptedDate]),
      (key) => processingRecordApi.accepted(kind, recordId, { expectedRevision: revision, idempotencyKey: key, date: acceptedDate }),
      R.done.accepted,
    );
  };

  /** Names the person who answers for a party; `null` gives it back to the heads of the unit. */
  const assignParty = async (step: RecordStepDto, party: RecordStepPartyDto, userId: string | null, done: string) => {
    const ok = await write.run(
      JSON.stringify(['assignee', step.stepKey, party.id, userId]),
      (key) => processingRecordApi.assignParty(kind, recordId, step.stepKey, party.id, { expectedRevision: revision, idempotencyKey: key, userId }),
      done,
    );
    if (ok) setAssigning(null);
  };
  const openAssigning = (step: RecordStepDto, party: RecordStepPartyDto) => {
    write.setError(null);
    setPanel(null);
    setAssigning({ stepKey: step.stepKey, partyId: party.id, userId: party.assigneeUserId ?? '' });
  };
  const assigningStep = assigning ? flow.steps.find((s) => s.stepKey === assigning.stepKey) : undefined;
  const assigningParty = assigning ? assigningStep?.parties.find((p) => p.id === assigning.partyId) : undefined;

  const panelStep = panel ? flow.steps.find((s) => s.stepKey === panel.stepKey) : undefined;

  return (
    <div data-testid="assignment-tab" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-700" data-testid="assignment-header">
        <b data-testid="assignment-flow-line">{R.header.flowLine(flow.flowName, flow.versionNo)}</b>
        {deadlineStep && (deadlineStep.regulatoryDueAt ?? deadlineStep.dueAt) && (
          <span data-testid="assignment-record-deadline">{R.header.recordDeadline(formatVNDate(deadlineStep.regulatoryDueAt ?? deadlineStep.dueAt))}</span>
        )}
        {flow.acceptedAt && <span data-testid="assignment-accepted-at">{R.header.acceptedAt(formatVNDate(flow.acceptedAt))}</span>}
      </div>

      {!flow.confirmed && (
        <div data-testid="assignment-proposal" className="flex flex-wrap items-center gap-3 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <div className="min-w-0 flex-1">
            <b>{R.proposal.title}</b> {R.proposal.body}
          </div>
          {perms.canAssign && (
            <div className="flex flex-wrap gap-2">
              <button type="button" data-testid="assignment-confirm" className={SMALL_PRIMARY} disabled={write.locked} onClick={confirm}>
                {R.proposal.confirm}
              </button>
              <button
                type="button"
                data-testid="assignment-reapply"
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                disabled={write.locked}
                onClick={reapply}
              >
                {R.proposal.reapply}
              </button>
            </div>
          )}
        </div>
      )}

      {(flow.suspended || flow.pausedSince) && (
        <p data-testid="assignment-suspended" className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          {flow.pausedSince ? R.suspendedSince(formatVNDate(flow.pausedSince)) : R.suspended}
        </p>
      )}

      <RecordNotices
        testPrefix="assignment"
        message={write.message}
        error={write.error}
        conflict={write.conflict}
        refreshing={handle.refreshing}
        refreshFailed={handle.refreshFailed}
        onTakeNewer={() =>
          write.takeNewer(() => {
            setPanel(null);
            setAssigning(null);
          })
        }
      />

      {waitingForAccepted && perms.canAssign && (
        <section data-testid="assignment-accepted-form" className="flex flex-col gap-2 rounded-lg border border-blue-300 bg-slate-50 p-3">
          <b className="text-sm text-slate-800">{R.panels.accepted.title}</b>
          <span className="text-sm text-slate-600">{R.panels.accepted.hint(flow.steps.indexOf(waitingForAccepted) + 1, waitingForAccepted.name)}</span>
          <div className="flex flex-wrap items-end gap-3">
            <label className={FIELD_LABEL}>
              {R.panels.accepted.date}
              <input
                type="date"
                data-testid="assignment-accepted-date"
                className={`${FIELD_BOX} w-44`}
                value={acceptedDate}
                disabled={write.locked}
                onChange={(e) => setAcceptedDate(e.target.value)}
              />
            </label>
            <button type="button" data-testid="assignment-accepted-submit" className={SMALL_PRIMARY} disabled={write.locked} onClick={recordAccepted}>
              {R.panels.accepted.submit}
            </button>
          </div>
        </section>
      )}

      {gantt && (
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-semibold text-slate-800">{R.gantt.title}</h3>
          <GanttChart steps={gantt.steps} data={gantt.data} extras={gantt.extras} />
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600" data-testid="assignment-gantt-key">
            <span>
              <i className="mr-1 inline-block h-2 w-3.5 rounded-sm bg-slate-300 align-baseline" />
              {R.gantt.keyDone}
            </span>
            <span>
              <i className="mr-1 inline-block h-2 w-3.5 rounded-sm bg-slate-400 align-baseline" />
              {R.gantt.keyBase}
            </span>
            <span>
              <i className="mr-1 inline-block h-2 w-3.5 rounded-sm bg-green-500 align-baseline" />
              {R.gantt.keyGreen}
            </span>
            <span>
              <i className="mr-1 inline-block h-2 w-3.5 rounded-sm bg-amber-500 align-baseline" />
              {R.gantt.keyYellow}
            </span>
            <span>
              <i className="mr-1 inline-block h-2 w-3.5 rounded-sm bg-red-600 align-baseline" />
              {R.gantt.keyRed}
            </span>
            <span>{R.gantt.keyAdjusted}</span>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[960px] border-collapse text-sm" data-testid="assignment-steps">
          <thead>
            <tr className="bg-slate-100 text-left text-xs font-semibold text-slate-600">
              <th className="px-2.5 py-2">{R.columns.step}</th>
              <th className="px-2.5 py-2">{R.columns.units}</th>
              <th className="px-2.5 py-2">{R.columns.regulatory}</th>
              <th className="px-2.5 py-2">{R.columns.own}</th>
              <th className="px-2.5 py-2">{R.columns.band}</th>
              <th className="px-2.5 py-2">{R.columns.actions}</th>
            </tr>
          </thead>
          <tbody>
            {flow.steps.map((step, index) => (
              <StepRow
                key={step.stepKey}
                step={step}
                flow={flow}
                position={index + 1}
                me={me}
                onAssign={openAssigning}
                onTake={(s, p) => void (me && assignParty(s, p, me, R.done.taken))}
                onUnassign={(s, p) => void assignParty(s, p, null, R.done.unassigned)}
                locked={write.locked}
                perms={perms}
                onOpen={openPanel}
                onComplete={complete}
                onUnskip={unskip}
                onBackToRegulatory={backToRegulatory}
              />
            ))}
          </tbody>
        </table>
      </div>

      {panel && panelStep && (
        <StepPanel
          panel={panel}
          step={panelStep}
          position={flow.steps.indexOf(panelStep) + 1}
          locked={write.locked}
          onChange={setPanel}
          onSubmit={submitPanel}
          onClose={() => setPanel(null)}
        />
      )}

      {assigning && assigningStep && assigningParty && (
        <AssigneePanel
          kind={kind}
          recordId={recordId}
          step={assigningStep}
          party={assigningParty}
          position={flow.steps.indexOf(assigningStep) + 1}
          locked={write.locked}
          value={assigning.userId}
          onChange={(userId) => setAssigning({ ...assigning, userId })}
          onSubmit={() => {
            if (!requireText(assigning.userId, 'ASSIGNEE_NOT_ELIGIBLE')) return;
            void assignParty(assigningStep, assigningParty, assigning.userId, R.done.assigned);
          }}
          onClose={() => setAssigning(null)}
        />
      )}

      <p className="text-xs text-slate-500">{R.footnote}</p>
    </div>
  );
}

interface AssigneePanelProps {
  kind: RecordKind;
  recordId: string;
  step: RecordStepDto;
  party: RecordStepPartyDto;
  position: number;
  locked: boolean;
  value: string;
  onChange: (userId: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

/** Picks the person who answers for one party, among the active members of its unit (asked of the server). */
function AssigneePanel({ kind, recordId, step, party, position, locked, value, onChange, onSubmit, onClose }: AssigneePanelProps) {
  const A = R.assignee;
  const candidatesQ = useQuery({
    queryKey: RECORD_QUERY_KEYS.candidates(kind, recordId, step.stepKey, party.id),
    queryFn: () => processingRecordApi.candidates(kind, recordId, step.stepKey, party.id),
    retry: false,
  });
  const candidates = candidatesQ.data ?? [];
  const unit = party.teamName ?? (party.partyKind === 'RECORD_TEAM' ? L.recordTeam : L.common.none);

  return (
    <section data-testid="assignee-panel" className="flex flex-col gap-2 rounded-lg border border-blue-300 bg-slate-50 p-3">
      <b className="text-sm text-slate-800">{A.title(position, step.name, unit)}</b>
      <span className="text-sm text-slate-600">{A.hint}</span>
      {candidatesQ.isLoading ? (
        <p role="status" data-testid="assignee-loading" className="text-sm text-slate-500">
          {A.loading}
        </p>
      ) : candidatesQ.isError ? (
        <div role="alert" data-testid="assignee-load-error" className="flex flex-wrap items-center gap-3 text-sm text-red-700">
          <span>{A.loadFailed}</span>
          <button type="button" className={SMALL_SECONDARY} onClick={() => void candidatesQ.refetch()}>
            {L.common.retry}
          </button>
        </div>
      ) : candidates.length === 0 ? (
        <p data-testid="assignee-empty" className="text-sm text-slate-600">
          {A.empty}
        </p>
      ) : (
        <label className={`${FIELD_LABEL} max-w-md`}>
          {A.person}
          <select data-testid="assignee-select" className={FIELD_BOX} value={value} disabled={locked} onChange={(e) => onChange(e.target.value)}>
            <option value="">{A.choose}</option>
            {candidates.map((c) => (
              <option key={c.userId} value={c.userId}>
                {c.isLeader ? A.leader(c.name) : c.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="flex gap-2">
        <button type="button" data-testid="assignee-submit" className={SMALL_PRIMARY} disabled={locked || candidates.length === 0} onClick={onSubmit}>
          {A.submit}
        </button>
        <button type="button" data-testid="assignee-close" className={SMALL_SECONDARY} onClick={onClose}>
          {R.actions.close}
        </button>
      </div>
    </section>
  );
}

interface RowProps {
  step: RecordStepDto;
  flow: RecordFlowDto;
  position: number;
  /** The signed-in person and the units they belong to: what decides which assignment actions are offered. */
  me: string | null;
  onAssign: (step: RecordStepDto, party: RecordStepPartyDto) => void;
  onTake: (step: RecordStepDto, party: RecordStepPartyDto) => void;
  onUnassign: (step: RecordStepDto, party: RecordStepPartyDto) => void;
  locked: boolean;
  perms: ReturnType<typeof useStepPermissions>;
  onOpen: (type: PanelType, step: RecordStepDto) => void;
  onComplete: (step: RecordStepDto) => void;
  onUnskip: (step: RecordStepDto) => void;
  onBackToRegulatory: (step: RecordStepDto) => void;
}

function StepRow({ step, flow, position, me, onAssign, onTake, onUnassign, locked, perms, onOpen, onComplete, onUnskip, onBackToRegulatory }: RowProps) {
  const key = step.stepKey;
  const worked = step.status === 'OPEN' || step.status === 'REPORTED';
  const badge = stepBadge(step, flow);
  const adjusted = isAdjusted(step);
  const waiting = waitingNote(step);
  const problem = problemText(step.problem);

  const canComplete = perms.canComplete && step.status === 'OPEN' && !step.requiresApproval;
  const canReopen = perms.canReopen && step.status === 'DONE';
  const canSkip = perms.canSkip && (step.status === 'WAITING_ANCHOR' || step.status === 'OPEN');
  const canUnskip = perms.canSkip && step.status === 'SKIPPED';
  // No extension left (or the step allows none): the server would refuse, the button is not offered.
  const canExtend = perms.canExtend && worked && step.dueAt !== null && step.extensionsUsed < step.extensionsAllowed;
  const canAdjust = perms.canAdjustDue && worked && step.dueAt !== null;

  const icon =
    step.status === 'DONE' ? (
      <span className="font-bold text-green-700" title={R.stepStatus.DONE}>
        ✔
      </span>
    ) : step.status === 'SKIPPED' ? (
      <span className="font-bold text-slate-400" title={R.stepStatus.SKIPPED}>
        –
      </span>
    ) : step.status === 'WAITING_ANCHOR' ? (
      <span className="font-bold text-slate-400" title={R.stepStatus.WAITING_ANCHOR}>
        ○
      </span>
    ) : (
      <span className="font-bold text-slate-700" title={R.stepStatus[step.status]}>
        ●
      </span>
    );

  const report = step.latestReport;
  const opinion = step.latestOpinion;

  return (
    <tr data-testid={`step-row-${key}`} data-status={step.status} className={`border-t border-slate-200 align-top ${step.status === 'SKIPPED' ? 'text-slate-500' : ''}`}>
      <td className="px-2.5 py-2">
        <div className="flex items-start gap-2">
          {icon}
          <div className="min-w-0">
            <b>
              {position}. {step.name}
            </b>
            {step.setsRecordDeadline && <span className="ml-1 text-xs text-slate-500">{R.setsRecordDeadline}</span>}
            {step.upstreamReopened && (
              <p data-testid={`step-${key}-upstream`} className="mt-0.5 text-xs text-amber-800">
                {R.upstreamReopened}
              </p>
            )}
            {report && (
              <p data-testid={`step-${key}-latest-report`} className="mt-0.5 line-clamp-2 text-xs text-slate-600">
                {R.latestReport(L.recordTabs.results.reportKinds[report.kind] ?? report.kind, report.summary)}
              </p>
            )}
            {opinion && (
              <p data-testid={`step-${key}-latest-opinion`} className="mt-0.5 text-xs text-slate-600">
                {R.latestOpinion(R.results.opinionKinds[opinion.kind] ?? opinion.kind, R.results.opinionVerdicts[opinion.verdict] ?? opinion.verdict)}
              </p>
            )}
          </div>
        </div>
      </td>
      <td className="px-2.5 py-2" data-testid={`step-${key}-units`}>
        {step.parties.map((p) => {
          // The server decides; the screen only offers what the rule can allow: the permission, heading the unit, or
          // a member taking the work themself (and giving back what they took).
          // Who the person is on the party comes with the flow itself (`viewer`): the list of the office's users is not
          // asked, so an officer who may not read it is still offered "Nhận việc".
          const member = step.viewer?.memberOfPartyIds.includes(p.id) === true;
          const leads = step.viewer?.leaderOfPartyIds.includes(p.id) === true;
          const open = step.status !== 'DONE' && step.status !== 'SKIPPED';
          const names = open && (perms.canAssign || leads);
          const canTake = open && !names && member && me !== null && p.assigneeUserId === null;
          const canUnassign = open && p.assigneeUserId !== null && (names || p.assigneeUserId === me);
          return (
            <div key={p.id} data-testid={`party-${p.id}`} className="mb-1 last:mb-0">
              <div>{partyLine(p)}</div>
              {!p.assigneeUserId && (
                <div data-testid={`party-${p.id}-responsible`} className="text-xs text-slate-500">
                  {p.responsible.length > 0 ? R.assignee.heads(p.responsible.map((r) => r.name).join(', ')) : R.assignee.nobody}
                </div>
              )}
              {(names || canTake || canUnassign) && (
                <div className="flex flex-wrap gap-x-3 text-xs">
                  {names && (
                    <button type="button" data-testid={`party-${p.id}-assign`} className={LINK_BUTTON} disabled={locked} onClick={() => onAssign(step, p)}>
                      {p.assigneeUserId ? R.actions.changeAssignee : R.actions.assign}
                    </button>
                  )}
                  {canTake && (
                    <button type="button" data-testid={`party-${p.id}-take`} className={LINK_BUTTON} disabled={locked} onClick={() => onTake(step, p)}>
                      {R.actions.take}
                    </button>
                  )}
                  {canUnassign && (
                    <button type="button" data-testid={`party-${p.id}-unassign`} className={LINK_BUTTON} disabled={locked} onClick={() => onUnassign(step, p)}>
                      {R.actions.unassign}
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </td>
      <td className="whitespace-nowrap px-2.5 py-2" data-testid={`step-${key}-regulatory`}>
        {step.regulatoryDueAt ? formatVNDate(step.regulatoryDueAt) : L.common.none}
        {step.provisional && (
          <span
            data-testid={`step-${key}-provisional`}
            title={R.provisionalTip}
            className="ml-1.5 cursor-help rounded border border-dashed border-amber-500 bg-amber-50 px-1 text-[10.5px] font-semibold text-amber-800"
          >
            {R.provisional}
          </span>
        )}
        {step.extensionsUsed > 0 && <div className="text-xs text-slate-500">{R.extensionsUsed(step.extensionsUsed, step.extensionsAllowed)}</div>}
      </td>
      <td className="whitespace-nowrap px-2.5 py-2" data-testid={`step-${key}-own`}>
        {worked && adjusted ? (
          <>
            <b>{formatVNDate(step.internalDueAt)}</b> <span title={R.ownTargetAdjusted}>✎</span>
            {canAdjust && (
              <div>
                <button type="button" data-testid={`step-${key}-back-to-regulatory`} className={LINK_BUTTON} disabled={locked} onClick={() => onBackToRegulatory(step)}>
                  {R.actions.backToRegulatory}
                </button>
              </div>
            )}
          </>
        ) : worked && step.dueAt ? (
          <span className="text-slate-500">{R.ownTargetNone}</span>
        ) : (
          <span className="text-slate-400">{L.common.none}</span>
        )}
      </td>
      <td className="px-2.5 py-2">
        <span
          data-testid={`step-${key}-band`}
          data-tone={badge.tone}
          className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${TONE_CLASS[badge.tone]}`}
        >
          <i className="h-1.5 w-1.5 flex-none rounded-full bg-current" />
          {badge.text}
        </span>
        {badge.note && <div className="mt-0.5 text-xs text-slate-600">{badge.note}</div>}
        {waiting && (
          <div data-testid={`step-${key}-waiting`} className="mt-0.5 text-xs text-slate-600">
            {waiting}
          </div>
        )}
        {problem && (
          <div data-testid={`step-${key}-problem`} className="mt-0.5 text-xs text-red-700">
            {problem}
          </div>
        )}
      </td>
      <td className="px-2.5 py-2">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {canComplete && (
            <button type="button" data-testid={`step-${key}-complete`} className={LINK_BUTTON} disabled={locked} onClick={() => onComplete(step)}>
              {R.actions.complete}
            </button>
          )}
          {canReopen && (
            <button type="button" data-testid={`step-${key}-reopen`} className={LINK_BUTTON} disabled={locked} onClick={() => onOpen('reopen', step)}>
              {R.actions.reopen}
            </button>
          )}
          {canAdjust && (
            <button type="button" data-testid={`step-${key}-adjust`} className={LINK_BUTTON} disabled={locked} onClick={() => onOpen('adjust', step)}>
              {R.actions.adjust}
            </button>
          )}
          {canExtend && (
            <button type="button" data-testid={`step-${key}-extend`} className={LINK_BUTTON} disabled={locked} onClick={() => onOpen('extend', step)}>
              {R.actions.extend}
            </button>
          )}
          {canSkip && (
            <button type="button" data-testid={`step-${key}-skip`} className={LINK_BUTTON} disabled={locked} onClick={() => onOpen('skip', step)}>
              {R.actions.skip}
            </button>
          )}
          {canUnskip && (
            <button type="button" data-testid={`step-${key}-unskip`} className={LINK_BUTTON} disabled={locked} onClick={() => onUnskip(step)}>
              {R.actions.unskip}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
