/**
 * Block 3 "Sau duyệt và kết quả" (PC02 writes it; the ward unit reads it): the day the unit received the file back,
 * the result deadline (shown; changed only by "Gia hạn" with a reason, kept in a history), the result in words, the
 * completion day with "on time / late N days", and "Mở lại" (with a reason) to undo a completion.
 */
import { useState } from 'react';
import { ResultFiles } from './ResultFiles';
import { BTN_PRIMARY, BTN_SECONDARY, INPUT_BASE, LABEL_BASE, TEXTAREA_BASE } from '@/constants/styles';
import { formatVNDateTime } from '@/lib/dates';
import { hoTen } from '@/lib/hoTen';
import { wardAssignments as L } from '@/locales/wardAssignments.vi';
import { wardAssignmentsApi } from '../api';
import { dayOf, decisionInForce, formatDay, vnDayOf } from '../formModel';
import type { WardAssignmentDetail } from '../types';
import { ReasonDialog } from './ReasonDialog';
import type { RunAction } from './ReviewBlock';

const F = L.followUp;
const DATE_INPUT = `${INPUT_BASE} max-w-[12rem]`;

export interface FollowUpBlockProps {
  detail: WardAssignmentDetail;
  run: RunAction;
  busy: boolean;
}

export function FollowUpBlock({ detail, run, busy }: FollowUpBlockProps) {
  const can = detail.can;
  const approved = detail.status === 'APPROVED';
  const approval = [...detail.rounds].sort((a, b) => b.sequence - a.sequence).map((r) => decisionInForce(r.decisions)).find((d) => d?.kind === 'APPROVE');
  const [receivedOn, setReceivedOn] = useState(dayOf(detail.receivedOn) || (approval ? vnDayOf(approval.decidedAt) : ''));
  const [resultText, setResultText] = useState(detail.resultText ?? '');
  const [completedOn, setCompletedOn] = useState(dayOf(detail.completedOn));
  const [newDueOn, setNewDueOn] = useState('');
  const [dialog, setDialog] = useState<'extend' | 'reopen' | null>(null);
  const stamp = detail.updatedAt;
  const editable = approved && !!can.followUp;
  const completed = !!detail.completedOn;
  // Unsaved result fields: every other action of the block starts it again from the server (new stamp), which would
  // throw them away. Those actions wait until the fields are saved.
  const dirty = editable && (receivedOn !== (dayOf(detail.receivedOn) || (approval ? vnDayOf(approval.decidedAt) : '')) || resultText !== (detail.resultText ?? ''));
  const held = busy || dirty;
  const changes = [...(detail.deadlineChanges ?? [])].sort((a, b) => b.changedAt.localeCompare(a.changedAt));

  return (
    <section data-testid="ward-block-follow-up" aria-labelledby="ward-block-follow-up-title" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 id="ward-block-follow-up-title" className="mb-1 text-base font-semibold text-slate-800">
        {L.form.block3}
      </h2>
      {!approved ? (
        <p className="text-sm text-slate-500">{F.onlyApproved}</p>
      ) : (
        <div className="space-y-4">
          {!editable && <p className="text-xs text-slate-500">{L.form.readOnlyForUnit}</p>}
          <div className="grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className={LABEL_BASE}>{F.receivedOn}</span>
              <input type="date" data-testid="ward-received-on" className={DATE_INPUT} readOnly={!editable || completed} value={receivedOn} onChange={(e) => setReceivedOn(e.target.value)} />
              <span className="mt-1 block text-xs text-slate-500">{F.receivedOnHint}</span>
            </label>
            <div>
              <span className={LABEL_BASE}>{F.resultDueOn}</span>
              <p data-testid="ward-result-due-on" className="py-2.5 text-sm font-medium tabular-nums text-slate-800">
                {formatDay(detail.resultDueOn) || L.form.notYet}
              </p>
              <span className="block text-xs text-slate-500">{F.resultDueOnHint}</span>
              {can.extend && (
                <button type="button" data-testid="ward-extend" className={`${BTN_SECONDARY} mt-2 text-sm`} disabled={held} onClick={() => setDialog('extend')}>
                  {F.extend}
                </button>
              )}
            </div>
            <div>
              <span className={LABEL_BASE}>{F.completedOn}</span>
              {completed ? (
                <p data-testid="ward-completed-on" className="py-2.5 text-sm tabular-nums">
                  {formatDay(detail.completedOn)}
                  {detail.timeliness && (
                    <span data-testid="ward-timeliness" className={`ml-2 rounded px-1.5 py-0.5 text-xs font-semibold ${detail.timeliness.onTime ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {detail.timeliness.onTime ? F.onTime : F.late(detail.timeliness.lateDays)}
                    </span>
                  )}
                </p>
              ) : (
                <div className="flex items-center gap-2">
                  <input type="date" data-testid="ward-completed-on-input" className={DATE_INPUT} readOnly={!can.complete} value={completedOn} onChange={(e) => setCompletedOn(e.target.value)} />
                  {can.complete && (
                    <button
                      type="button"
                      data-testid="ward-complete"
                      className={BTN_SECONDARY}
                      disabled={held || !completedOn}
                      onClick={() => void run(() => wardAssignmentsApi.complete(detail.id, completedOn, stamp))}
                    >
                      {F.complete}
                    </button>
                  )}
                </div>
              )}
              {completed && can.reopen && (
                <button type="button" data-testid="ward-reopen" className={`${BTN_SECONDARY} mt-2 text-sm`} disabled={held} onClick={() => setDialog('reopen')}>
                  {F.reopen}
                </button>
              )}
            </div>
          </div>
          <label className="block">
            <span className={LABEL_BASE}>{F.resultText}</span>
            <textarea data-testid="ward-result-text" rows={3} className={TEXTAREA_BASE} readOnly={!editable} value={resultText} onChange={(e) => setResultText(e.target.value)} />
          </label>
          <ResultFiles assignmentId={detail.id} canWrite={!!(detail.can.followUp || detail.can.reopen)} />
          {dirty && (
            <p data-testid="ward-follow-up-save-first" className="text-xs text-amber-700">
              {F.saveFirst}
            </p>
          )}
          {editable && (
            <div className="flex justify-end">
              <button
                type="button"
                data-testid="ward-follow-up-save"
                className={BTN_PRIMARY}
                disabled={busy}
                onClick={() => void run(() => wardAssignmentsApi.followUp(detail.id, { receivedOn: receivedOn || null, resultText: resultText.trim() || null }, stamp), L.form.saved)}
              >
                {F.save}
              </button>
            </div>
          )}
          {changes.length > 0 && (
            <div data-testid="ward-deadline-history">
              <h3 className="mb-1 text-sm font-semibold text-slate-700">{F.history}</h3>
              <ul className="space-y-1 text-sm">
                {changes.map((c) => (
                  <li key={c.id}>
                    <span className="tabular-nums">{F.historyLine(formatDay(c.oldDueOn) || L.rounds.empty, formatDay(c.newDueOn))}</span>
                    <span className="text-slate-500"> · {c.reason} · {formatVNDateTime(c.changedAt)}{c.changedBy ? ` · ${hoTen(c.changedBy)}` : ''}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <ReasonDialog
        open={dialog === 'extend'}
        title={F.extendTitle}
        reasonLabel={F.extendReason}
        testId="ward-dialog-extend"
        busy={busy}
        ready={!!newDueOn}
        onClose={() => {
          setNewDueOn('');
          setDialog(null);
        }}
        onConfirm={(reason) =>
          void run(() => wardAssignmentsApi.extendDeadline(detail.id, newDueOn, reason, stamp)).then((ok) => {
            if (ok) {
              setNewDueOn('');
              setDialog(null);
            }
          })
        }
      >
        <label className="block">
          <span className={LABEL_BASE}>{F.newDueOn}</span>
          <input type="date" data-testid="ward-dialog-extend-date" className={DATE_INPUT} value={newDueOn} onChange={(e) => setNewDueOn(e.target.value)} />
        </label>
      </ReasonDialog>
      <ReasonDialog
        open={dialog === 'reopen'}
        title={L.review.dialogs.reopen}
        testId="ward-dialog-reopen"
        busy={busy}
        onClose={() => setDialog(null)}
        onConfirm={(reason) => void run(() => wardAssignmentsApi.reopen(detail.id, reason, stamp)).then((ok) => ok && setDialog(null))}
      />
    </section>
  );
}
