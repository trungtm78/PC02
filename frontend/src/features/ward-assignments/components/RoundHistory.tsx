/**
 * "Lịch sử trình và thẩm định": each round (Lần N) with who submitted it and when, whether it was withdrawn, and the
 * decisions of PC02 on it (kind, reason, requirements, who, when, slip number; a revoked one stays, marked). Each round
 * after the first can show what changed against the round PC02 last saw (`baselineRoundOf` + `diffSnapshots`).
 */
import { useState } from 'react';
import { formatVNDateTime } from '@/lib/dates';
import { hoTen } from '@/lib/hoTen';
import { wardAssignments as L } from '@/locales/wardAssignments.vi';
import { formatDay } from '../formModel';
import { baselineRoundOf, diffSnapshots, type SnapshotField } from '../roundDiff';
import type { PersonRef, WardDecision, WardRound, WardSubject } from '../types';

const R = L.rounds;
const F = L.form.fields;

const FIELD_LABEL: Record<SnapshotField, string> = {
  caseType: F.caseType,
  kind: F.kind,
  previousAssignmentId: F.previous,
  reassignReason: F.reassignReason,
  crimeId: F.crime,
  crimeOther: F.crimeOther,
  summary: F.summary,
  content: F.content,
  discoveredOn: F.discoveredOn,
  place: F.place,
  subjectsUnknown: F.subjectsUnknown,
  subjects: F.subjects,
  proposedInvestigatorId: F.proposedInvestigator,
  entryOfficerName: F.entryOfficerName,
  entryOfficerPhone: F.entryOfficerPhone,
  unitNote: F.unitNote,
};

/** Words a stored value for a field; return null to fall back to the default wording. */
export type DescribeValue = (field: SnapshotField, value: unknown) => string | null;

function defaultWording(field: SnapshotField, value: unknown): string {
  if (value === null || value === undefined) return R.empty;
  if (field === 'caseType') return L.caseType[value as 'INCIDENT' | 'CASE'] ?? String(value);
  if (field === 'kind') return L.kind[value as 'NEW' | 'REASSIGN'] ?? String(value);
  if (field === 'discoveredOn') return formatDay(String(value)) || String(value);
  if (typeof value === 'boolean') return value ? R.yes : R.no;
  if (field === 'subjects') {
    const list = value as WardSubject[];
    if (list.length === 0) return R.empty;
    return list.map((s) => [s.fullName, s.birthYear, s.idNumber].filter((p) => p !== null && p !== undefined && p !== '').join(', ')).join('; ');
  }
  return String(value);
}

const who = (p: PersonRef | null | undefined): string => (p ? hoTen(p) : '');

function DecisionItem({ decision }: { decision: WardDecision }) {
  const revoked = !!decision.revokedAt;
  const requirements = decision.requirements ?? [];
  const reason = [decision.reasonCode, decision.reasonText].filter(Boolean).join(' · ');
  return (
    <div data-testid={`ward-decision-${decision.id}`} className={`mt-2 rounded border px-3 py-2 text-sm ${revoked ? 'border-slate-200 bg-slate-50 text-slate-500' : 'border-slate-200 bg-white'}`}>
      <div className="flex flex-wrap items-center gap-x-2">
        <span className={`font-semibold ${decision.kind === 'APPROVE' ? 'text-green-700' : 'text-amber-700'}`}>{R.decision[decision.kind]}</span>
        <span className="tabular-nums">{formatVNDateTime(decision.decidedAt)}</span>
        {who(decision.decidedBy) && <span>· {who(decision.decidedBy)}</span>}
        {decision.slipNumber && <span>· {R.slip(decision.slipNumber)}</span>}
        {revoked && <span className="rounded bg-slate-200 px-1.5 text-xs font-semibold text-slate-700">{R.revoked}</span>}
      </div>
      {reason && (
        <p className="mt-1">
          <span className="text-slate-500">{R.reason}: </span>
          {reason}
        </p>
      )}
      {requirements.length > 0 && (
        <div className="mt-1">
          <span className="text-slate-500">{R.requirements}:</span>
          <ol className="list-decimal pl-6">
            {requirements.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ol>
        </div>
      )}
      {revoked && decision.revokeReason && (
        <p className="mt-1">
          <span className="text-slate-500">{R.revoked}: </span>
          {decision.revokeReason}
        </p>
      )}
      {/* Mount point of lane C's `RequestSlipButton` for this decision (issue / reprint / reissue the request slip). */}
      <section data-slot="ward-request-slip" data-decision-id={decision.id} />
    </div>
  );
}

function RoundItem({ round, rounds, describe }: { round: WardRound; rounds: readonly WardRound[]; describe?: DescribeValue }) {
  const [open, setOpen] = useState(false);
  const baseline = baselineRoundOf(rounds, round);
  const changes = baseline ? diffSnapshots(baseline.snapshot, round.snapshot) : [];
  const word = (field: SnapshotField, v: unknown) => (v === null || v === undefined ? R.empty : describe?.(field, v) ?? defaultWording(field, v));
  const resubmission = round.submissionNo > 1;
  return (
    <li data-testid={`ward-round-${round.id}`} className="border-l-2 border-slate-200 pl-4">
      <div className="flex flex-wrap items-center gap-x-2 text-sm">
        <span className="font-semibold text-slate-800">{R.round(round.submissionNo)}</span>
        <span>· {resubmission ? R.resubmitted : R.submitted}</span>
        <span className="tabular-nums">{formatVNDateTime(round.submittedAt)}</span>
        {who(round.submittedBy) && <span>· {who(round.submittedBy)}</span>}
        {round.status === 'PENDING' && <span className="rounded bg-blue-50 px-1.5 text-xs font-semibold text-blue-700">{R.pending}</span>}
        {round.status === 'WITHDRAWN' && <span className="rounded bg-slate-100 px-1.5 text-xs font-semibold text-slate-600">{R.withdrawn}</span>}
        {baseline && (
          <button
            type="button"
            data-testid={`ward-round-compare-${round.id}`}
            aria-expanded={open}
            className="text-xs text-blue-700 hover:underline"
            onClick={() => setOpen((v) => !v)}
          >
            {R.compare} ({R.changedCount(changes.length)})
          </button>
        )}
      </div>
      {open && baseline && (
        <div data-testid={`ward-round-diff-${round.id}`} className="mt-2 rounded border border-slate-200 bg-slate-50 p-2 text-sm">
          {changes.length === 0 ? (
            <p>{R.noChange}</p>
          ) : (
            <>
              <p className="mb-1 font-medium">{R.changedCount(changes.length)}</p>
              <table className="w-full table-fixed text-left">
                <thead>
                  <tr className="text-xs text-slate-500">
                    <th className="w-40 py-1">&nbsp;</th>
                    <th className="py-1">{R.before}</th>
                    <th className="py-1">{R.after}</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map((c) => (
                    <tr key={c.field} className="align-top">
                      <td className="py-1 pr-2 font-medium text-slate-700">{FIELD_LABEL[c.field]}</td>
                      <td className="whitespace-pre-wrap py-1 pr-2 text-slate-500 line-through decoration-slate-300">{word(c.field, c.before)}</td>
                      <td className="whitespace-pre-wrap py-1 text-slate-900">{word(c.field, c.after)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}
      {round.decisions.map((d) => (
        <DecisionItem key={d.id} decision={d} />
      ))}
    </li>
  );
}

export function RoundHistory({ rounds, describe }: { rounds: readonly WardRound[]; describe?: DescribeValue }) {
  const ordered = [...rounds].sort((a, b) => b.sequence - a.sequence);
  return (
    <section data-testid="ward-round-history" aria-labelledby="ward-round-history-title" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 id="ward-round-history-title" className="mb-3 text-base font-semibold text-slate-800">
        {R.title}
      </h2>
      {ordered.length === 0 ? (
        <p className="text-sm text-slate-500">{R.none}</p>
      ) : (
        <ol className="space-y-4">
          {ordered.map((r) => (
            <RoundItem key={r.id} round={r} rounds={rounds} describe={describe} />
          ))}
        </ol>
      )}
    </section>
  );
}
