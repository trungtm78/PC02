/**
 * The book of ONE step: the reports its units wrote, the opinions around them, and the forms to add to it. A report
 * that was withdrawn or replaced stays in the book, greyed and marked, without buttons; a report somebody answered
 * can no longer be corrected or taken back.
 */
import { useState } from 'react';
import { formatVNDate, formatVNDateTime } from '@/lib/dates';
import { processingFlow as L } from '@/locales/processingFlow.vi';
import { processingRecordApi } from './api';
import { draftKeys, hasDraft } from './draftStore';
import { DecisionForm, OpinionForm } from './OpinionForms';
import { proposalLabel, speakingKinds } from './present';
import { ReportAttachments } from './ReportAttachments';
import { ReportForm } from './ReportForm';
import { LINK_BUTTON } from './styles';
import type { OpinionDto, RecordKind, RecordStepDto, ReportDto } from './types';
import { useStepResults } from './useStepResults';
import type { RecordWrite } from './useRecordWrite';
import type { StepPermissions } from '../usePermissions';

const O = L.recordTabs.results;
const D = L.recordTabs.done;

interface Props {
  kind: RecordKind;
  recordId: string;
  step: RecordStepDto;
  revision: number;
  write: RecordWrite;
  perms: StepPermissions;
  userId: string | null;
}

const when = (iso: string): string => formatVNDateTime(iso);

export function ReportField({ label, text }: { label: string; text: string | null | undefined }) {
  if (!text) return null;
  return (
    <p className="whitespace-pre-wrap text-sm text-slate-800">
      <span className="font-medium text-slate-600">{label}: </span>
      {text}
    </p>
  );
}

/** The proposal, the grounds and the documents of a report, read-only. Shared with the "Kết luận chung" block. */
export function ReportBody({ report, recordKind }: { report: ReportDto; recordKind: string }) {
  const proposal = proposalLabel(recordKind, report.proposalKind);
  const documents = report.documents ?? [];
  return (
    <>
      <ReportField label={O.doneWork} text={report.doneWork} />
      <ReportField label={O.findings} text={report.findings} />
      <ReportField label={O.difficulties} text={report.difficulties} />
      {proposal && <ReportField label={O.proposal} text={proposal} />}
      <ReportField label={O.proposalContent} text={report.proposalContent} />
      <ReportField label={O.proposalBasis} text={report.proposalBasis} />
      {documents.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={O.documents}>
          {documents.map((d, i) => (
            <li key={i} className="rounded border border-slate-300 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">
              {O.documentLine(d.type ?? '', d.number ?? '', d.date ? formatVNDate(d.date) : '')}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function StepBook({ kind, recordId, step, revision, write, perms, userId }: Props) {
  const results = useStepResults(kind, recordId, step.stepKey, true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const key = step.stepKey;
  const base = { expectedRevision: revision };

  if (results.isLoading) {
    return (
      <p data-testid={`book-${key}-loading`} role="status" className="text-sm text-slate-500">
        {O.loadingBook}
      </p>
    );
  }
  if (results.isError || !results.data) {
    return (
      <p data-testid={`book-${key}-error`} role="alert" className="text-sm text-red-700">
        {O.loadFailed}{' '}
        <button type="button" className={LINK_BUTTON} onClick={() => void results.refetch()}>
          {L.common.retry}
        </button>
      </p>
    );
  }

  const reports = [...results.data.reports].reverse();
  const opinions = [...results.data.opinions].reverse();
  const worked = step.status === 'OPEN';
  const drafts = draftKeys(kind, recordId, key);
  // While the screen is locked by a conflict, a form with typed text stays in view even if the refresh no longer offers it.
  const keepIfDraft = (draftKey: string) => write.conflict && hasDraft(draftKey);
  // The permission says the person may use the route; `viewer` says the server will not refuse THEM on this step (their
  // unit has a part in it). An answer without `viewer` (an older server) leaves the permission alone to decide.
  const viewer = step.viewer;
  const roleReports = viewer?.canReport ?? true;
  const canWriteReport = (perms.canReport && roleReports && worked) || keepIfDraft(drafts.report);
  const kinds = speakingKinds(step).filter((k) => !viewer || viewer.opinionKinds.includes(k));
  const canDecide = perms.canApprove && (viewer?.canApprove ?? true);
  const canOpine = (perms.canOpine && kinds.length > 0 && step.status !== 'WAITING_ANCHOR' && step.status !== 'SKIPPED') || keepIfDraft(drafts.opinion);

  const standing = (r: ReportDto) => !r.withdrawnAt && !r.supersededAt && !r.answered && r.authorId === userId && perms.canReport && roleReports;
  const canEdit = (r: ReportDto) => standing(r) && step.status === 'OPEN';
  const canWithdraw = (r: ReportDto) => standing(r) && (step.status === 'OPEN' || (step.status === 'REPORTED' && r.kind === 'RESULT'));

  const withdrawReport = (r: ReportDto) =>
    void write.run(
      JSON.stringify(['withdraw-report', key, r.id]),
      (idem) => processingRecordApi.withdrawReport(kind, recordId, key, r.id, { ...base, idempotencyKey: idem }),
      D.reportWithdrawn,
    );
  const withdrawOpinion = (o: OpinionDto) =>
    void write.run(
      JSON.stringify(['withdraw-opinion', key, o.id]),
      (idem) => processingRecordApi.withdrawOpinion(kind, recordId, key, o.id, { ...base, idempotencyKey: idem }),
      D.opinionWithdrawn,
    );

  return (
    <div className="flex flex-col gap-4" data-testid={`book-${key}`}>
      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold text-slate-800">{O.reportsTitle}</h4>
        {reports.length === 0 && <p className="text-sm text-slate-500">{O.noReports}</p>}
        {reports.map((r) => {
          const dead = !!r.withdrawnAt || !!r.supersededAt;
          if (editingId === r.id) {
            return (
              <ReportForm
                key={r.id}
                recordKind={kind}
                requiresApproval={step.requiresApproval}
                editing={r}
                draftKey={drafts.editReport(r.id)}
                locked={write.locked}
                onCancel={() => setEditingId(null)}
                onSubmit={async (_kind, fields) => {
                  const ok = await write.run(
                    JSON.stringify(['edit-report', key, r.id, fields]),
                    (idem) => processingRecordApi.editReport(kind, recordId, key, r.id, { ...base, idempotencyKey: idem, ...fields }),
                    D.reportEdited,
                  );
                  if (ok) setEditingId(null);
                  return ok;
                }}
              />
            );
          }
          return (
            <article
              key={r.id}
              data-testid={`report-${r.id}`}
              data-dead={dead ? 'true' : 'false'}
              className={`flex flex-col gap-1 border-t border-slate-200 pt-2 first:border-t-0 first:pt-0 ${dead ? 'opacity-60' : ''}`}
            >
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>
                  {when(r.createdAt)} · {r.authorName ?? O.unknownAuthor} · {O.reportKinds[r.kind] ?? r.kind}
                </span>
                {r.withdrawnAt && (
                  <span data-testid={`report-${r.id}-withdrawn`} className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 font-semibold">
                    {O.withdrawn}
                  </span>
                )}
                {r.supersededAt && !r.withdrawnAt && (
                  <span data-testid={`report-${r.id}-superseded`} className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 font-semibold">
                    {O.superseded}
                  </span>
                )}
                {r.answered && !dead && (
                  <span data-testid={`report-${r.id}-answered`} className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 font-semibold text-blue-800">
                    {O.answered}
                  </span>
                )}
              </div>
              <ReportBody report={r} recordKind={kind} />
              <ReportAttachments kind={kind} recordId={recordId} stepKey={key} report={r} canManage={canEdit(r)} locked={write.locked} />
              {(canEdit(r) || canWithdraw(r)) && (
                <div className="flex gap-3">
                  {canEdit(r) && (
                    <button type="button" data-testid={`report-${r.id}-edit`} className={LINK_BUTTON} disabled={write.locked} onClick={() => setEditingId(r.id)}>
                      {O.edit}
                    </button>
                  )}
                  {canWithdraw(r) && (
                    <button type="button" data-testid={`report-${r.id}-withdraw`} className={LINK_BUTTON} disabled={write.locked} onClick={() => withdrawReport(r)}>
                      {O.withdraw}
                    </button>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>

      {canWriteReport && (
        <ReportForm
          recordKind={kind}
          requiresApproval={step.requiresApproval}
          editing={null}
          draftKey={drafts.report}
          locked={write.locked}
          onSubmit={(reportKind, fields) =>
            write.run(
              JSON.stringify(['report', key, reportKind, fields]),
              (idem) => processingRecordApi.submitReport(kind, recordId, key, { ...base, idempotencyKey: idem, kind: reportKind, ...fields }),
              D.reportSent,
            )
          }
        />
      )}

      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold text-slate-800">{O.opinionsTitle}</h4>
        {opinions.length === 0 && <p className="text-sm text-slate-500">{O.noOpinions}</p>}
        {opinions.map((o) => (
          <article
            key={o.id}
            data-testid={`opinion-${o.id}`}
            data-dead={o.withdrawnAt ? 'true' : 'false'}
            className={`flex flex-col gap-1 border-t border-slate-200 pt-2 first:border-t-0 first:pt-0 ${o.withdrawnAt ? 'opacity-60' : ''}`}
          >
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>
                {when(o.createdAt)} · {o.authorName ?? O.unknownAuthor} · {O.opinionKinds[o.kind] ?? o.kind}
              </span>
              <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">{O.opinionVerdicts[o.verdict] ?? o.verdict}</span>
              {o.reportRevision !== null && <span>{O.aboutReport(o.reportRevision)}</span>}
              {o.withdrawnAt && (
                <span data-testid={`opinion-${o.id}-withdrawn`} className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 font-semibold">
                  {O.withdrawn}
                </span>
              )}
            </div>
            {o.content && <p className="whitespace-pre-wrap text-sm text-slate-800">{o.content}</p>}
            {!o.withdrawnAt && o.kind !== 'APPROVAL' && perms.canOpine && o.authorId === userId && (!viewer || viewer.opinionKinds.some((k) => k === o.kind)) && (
              <div>
                <button type="button" data-testid={`opinion-${o.id}-withdraw`} className={LINK_BUTTON} disabled={write.locked} onClick={() => withdrawOpinion(o)}>
                  {O.withdraw}
                </button>
              </div>
            )}
          </article>
        ))}
        {canOpine && (
          <OpinionForm
            kinds={kinds}
            draftKey={drafts.opinion}
            locked={write.locked}
            onSubmit={(body) =>
              write.run(
                JSON.stringify(['opinion', key, body]),
                (idem) => processingRecordApi.addOpinion(kind, recordId, key, { ...base, idempotencyKey: idem, ...body }),
                D.opinionGiven,
              )
            }
          />
        )}
      </div>

      {((canDecide && step.status === 'REPORTED') || keepIfDraft(drafts.decision)) && (
        <DecisionForm
          draftKey={drafts.decision}
          locked={write.locked}
          onSubmit={(body) =>
            write.run(
              JSON.stringify(['decision', key, body]),
              (idem) => processingRecordApi.decide(kind, recordId, key, { ...base, idempotencyKey: idem, ...body }),
              D.decided,
            )
          }
        />
      )}
    </div>
  );
}
