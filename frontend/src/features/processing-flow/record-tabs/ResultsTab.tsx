/**
 * "Kết quả xử lý": what the units reported and decided, step by step, newest activity first. The conclusion of the
 * record (the newest result of the step that sets the record's deadline) is shown at the top once that step is done;
 * the record's own result fields stay on the existing tabs.
 */
import { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { BTN_SECONDARY } from '@/constants/styles';
import { formatVNDate } from '@/lib/dates';
import { processingFlow as L } from '@/locales/processingFlow.vi';
import { lastActivity, proposalLabel, recordDeadlineStep, TONE_CLASS, type Tone } from './present';
import { RecordNotices } from './RecordNotices';
import { ReportField, StepBook } from './StepBook';
import type { RecordFlowDto, RecordKind, RecordStepDto } from './types';
import { useCurrentUserId } from './useCurrentUserId';
import { stepHasDraft } from './draftStore';
import { useRecordFlow } from './useRecordFlow';
import { useRecordWrite } from './useRecordWrite';
import { useStepResults } from './useStepResults';
import { useStepPermissions } from '../usePermissions';

const R = L.recordTabs;

const STATUS_TONE: Record<RecordStepDto['status'], Tone> = { WAITING_ANCHOR: 'neutral', OPEN: 'blue', REPORTED: 'yellow', DONE: 'done', SKIPPED: 'neutral' };

interface Props {
  kind: RecordKind;
  recordId: string;
}

export function ResultsTab({ kind, recordId }: Props) {
  const handle = useRecordFlow(kind, recordId);
  if (handle.state === 'loading') {
    return (
      <p data-testid="results-loading" role="status" className="py-6 text-sm text-slate-500">
        {L.common.loading}
      </p>
    );
  }
  if (handle.state === 'off') {
    return (
      <p data-testid="results-off" className="rounded border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">
        {R.off}
      </p>
    );
  }
  if (handle.state === 'error') {
    return (
      <div data-testid="results-load-error" role="alert" className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
        <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-600" aria-hidden="true" />
        <p className="flex-1 text-sm text-red-700">{handle.errorMessage}</p>
        <button type="button" className={BTN_SECONDARY} onClick={() => void handle.refetch()}>
          {L.common.retry}
        </button>
      </div>
    );
  }
  if (!handle.flow) {
    return (
      <div data-testid="results-no-flow" className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
        <h2 className="text-base font-semibold text-slate-800">{R.noFlow.title}</h2>
        <p className="mx-auto mt-1 max-w-xl text-sm text-slate-600">{R.noFlow.body}</p>
      </div>
    );
  }
  return <ResultsBody kind={kind} recordId={recordId} flow={handle.flow} handle={handle} />;
}

/** Newest activity first; steps with nothing yet last, in the order of the flow. */
function byActivity(steps: readonly RecordStepDto[]): RecordStepDto[] {
  return [...steps].sort((a, b) => {
    const x = lastActivity(a);
    const y = lastActivity(b);
    const d = x === y ? 0 : y > x ? 1 : -1;
    return d !== 0 ? d : steps.indexOf(a) - steps.indexOf(b);
  });
}

function ResultsBody({ kind, recordId, flow, handle }: Props & { flow: RecordFlowDto; handle: ReturnType<typeof useRecordFlow> }) {
  const perms = useStepPermissions();
  const write = useRecordWrite(kind, recordId, handle);
  const userId = useCurrentUserId();
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  return (
    <div data-testid="results-tab" className="flex flex-col gap-3">
      <div className="sticky top-0 z-10 flex flex-col gap-2 empty:hidden">
        <RecordNotices
          testPrefix="results"
          message={write.message}
          error={write.error}
          conflict={write.conflict}
          refreshing={handle.refreshing}
          refreshFailed={handle.refreshFailed}
          onTakeNewer={() => write.takeNewer()}
        />
      </div>

      <Conclusion kind={kind} recordId={recordId} flow={flow} />

      {flow.steps.length === 0 && <p className="text-sm text-slate-500">{R.results.noSteps}</p>}

      {byActivity(flow.steps).map((step) => {
        const position = flow.steps.indexOf(step) + 1;
        const hasBook = step.status !== 'WAITING_ANCHOR' && step.status !== 'SKIPPED';
        // A step whose forms hold typed text stays open while the screen waits for the person to take the newer data.
        const open = toggled[step.stepKey] ?? (step.status === 'OPEN' || step.status === 'REPORTED' || (write.conflict && stepHasDraft(kind, recordId, step.stepKey)));
        const mains = step.parties.filter((p) => p.role === 'MAIN').map((p) => p.teamName ?? L.recordTeam);
        return (
          <section key={step.stepKey} data-testid={`results-step-${step.stepKey}`} className="rounded-lg border border-slate-200 bg-white">
            <button
              type="button"
              data-testid={`results-step-${step.stepKey}-toggle`}
              aria-expanded={open}
              className="flex w-full flex-wrap items-center gap-2 px-3.5 py-2.5 text-left"
              onClick={() => setToggled((prev) => ({ ...prev, [step.stepKey]: !open }))}
            >
              {open ? <ChevronDown className="h-4 w-4 text-slate-500" aria-hidden="true" /> : <ChevronRight className="h-4 w-4 text-slate-500" aria-hidden="true" />}
              <b className="text-sm text-slate-900">{R.results.step(position, step.name)}</b>
              <span data-testid={`results-step-${step.stepKey}-status`} className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${TONE_CLASS[STATUS_TONE[step.status]]}`}>
                {R.stepStatus[step.status]}
              </span>
              {mains.length > 0 && <span className="text-xs font-normal text-slate-500">{mains.join(', ')}</span>}
              {step.dueAt && step.status !== 'DONE' && step.status !== 'SKIPPED' && (
                <span className="text-xs font-normal text-slate-500">{R.results.dueShort(formatVNDate(step.dueAt))}</span>
              )}
            </button>
            {open && (
              <div className="border-t border-slate-200 px-3.5 py-3" data-testid={`results-step-${step.stepKey}-body`}>
                {step.status === 'WAITING_ANCHOR' && <p className="text-sm text-slate-600">{R.results.notYet}</p>}
                {step.status === 'SKIPPED' && <p className="text-sm text-slate-600">{R.results.skippedNote}</p>}
                {hasBook && <StepBook kind={kind} recordId={recordId} step={step} revision={flow.revision} write={write} perms={perms} userId={userId} />}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** The conclusion of the record: the newest RESULT report of the step that sets the record's deadline, once that step is DONE. */
function Conclusion({ kind, recordId, flow }: { kind: RecordKind; recordId: string; flow: RecordFlowDto }) {
  const step = recordDeadlineStep(flow);
  const done = step?.status === 'DONE';
  const results = useStepResults(kind, recordId, step?.stepKey ?? '', done);
  if (!step || !done) return null;

  const standing = (results.data?.reports ?? []).filter((r) => r.kind === 'RESULT' && !r.withdrawnAt);
  const newest = standing.length > 0 ? standing[standing.length - 1] : null;
  const position = flow.steps.indexOf(step) + 1;

  return (
    <section data-testid="results-conclusion" className="flex flex-col gap-1.5 rounded-lg border border-slate-200 bg-white p-3.5">
      <div className="flex flex-wrap items-baseline gap-2">
        <h3 className="text-sm font-semibold text-slate-900">{R.results.conclusion.title}</h3>
        <span className="text-xs text-slate-500">{R.results.conclusion.fromStep(position, step.name)}</span>
      </div>
      {results.isLoading ? (
        <p className="text-sm text-slate-500">{L.common.loading}</p>
      ) : newest ? (
        <>
          <ReportField label={R.results.doneWork} text={newest.doneWork} />
          <ReportField label={R.results.conclusion.proposal} text={proposalLabel(kind, newest.proposalKind)} />
          <ReportField label={R.results.proposalContent} text={newest.proposalContent} />
        </>
      ) : (
        <p data-testid="results-conclusion-none" className="text-sm text-slate-500">
          {R.results.conclusion.none}
        </p>
      )}
    </section>
  );
}
