/**
 * Block 2 "Thẩm định của PC02". A reviewer of a waiting request writes the numbered requirements, the return reason
 * (catalogue + words), and either returns it or approves it (assigned investigator defaulting to the proposed one,
 * follow-up officer defaulting to the reviewer, follow-up team to the reviewer's team). The reverse actions (revoke a
 * return, cancel an approval) ask for a reason. Everybody else, the ward unit included, reads the decision in force.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, FIELD_ERROR_TEXT, LABEL_BASE, SELECT_BASE, TEXTAREA_BASE } from '@/constants/styles';
import { useOfficerOptions } from '@/hooks/useOfficerOptions';
import { wardAssignments as L } from '@/locales/wardAssignments.vi';
import { wardAssignmentsApi } from '../api';
import { decisionInForce, investigatorLabel } from '../formModel';
import { blankLines, trimLines } from '../requirements';
import type { WardAssignmentDetail, WardInvestigator } from '../types';
import { usePc02Teams, useReturnReasons } from '../useWardChoices';
import { ReasonDialog } from './ReasonDialog';
import { RequirementsEditor } from './RequirementsEditor';

const R = L.review;

export type RunAction = (fn: () => Promise<unknown>, done?: string) => Promise<boolean>;

export interface ReviewBlockProps {
  detail: WardAssignmentDetail;
  investigators: readonly WardInvestigator[];
  /** The reviewer's own PC02 team, the default follow-up team. */
  defaultFollowUpTeamId?: string | null;
  run: RunAction;
  busy: boolean;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className={LABEL_BASE}>{label}</span>
      {children}
    </div>
  );
}

export function ReviewBlock({ detail, investigators, defaultFollowUpTeamId, run, busy }: ReviewBlockProps) {
  const can = detail.can;
  const deciding = detail.status === 'SUBMITTED' && !!(can.returnIt || can.approve);
  const reviewer = deciding || !!can.review;

  const ordered = useMemo(() => [...detail.rounds].sort((a, b) => a.sequence - b.sequence), [detail.rounds]);
  const lastRound = ordered.at(-1) ?? null;
  const inForce = lastRound ? decisionInForce(lastRound.decisions) : null;
  // The requirements PC02 gave last time, offered to copy into this review.
  const previousRequirements = useMemo(() => {
    for (const r of [...ordered].reverse()) {
      if (r === lastRound && deciding) continue;
      const d = decisionInForce(r.decisions);
      if (d?.requirements?.length) return d.requirements;
    }
    return null;
  }, [ordered, lastRound, deciding]);

  const [requirements, setRequirements] = useState<string[]>([]);
  const [reasonCode, setReasonCode] = useState('');
  const [reasonText, setReasonText] = useState('');
  const [assignedId, setAssignedId] = useState(detail.proposedInvestigatorId ?? '');
  const [followUpUserId, setFollowUpUserId] = useState(detail.viewerId ?? '');
  const [followUpTeamId, setFollowUpTeamId] = useState(defaultFollowUpTeamId ?? '');
  const [pc02Note, setPc02Note] = useState(detail.pc02Note ?? '');
  const [problem, setProblem] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'revokeReturn' | 'cancelApproval' | null>(null);

  const reasons = useReturnReasons(deciding);
  // Also for the ward unit reading an approval: the names of who follows it. A refused look-up leaves them blank.
  const showsFollowUp = reviewer || inForce?.kind === 'APPROVE';
  const teams = usePc02Teams(showsFollowUp);
  const officers = useOfficerOptions(showsFollowUp);
  const pc02Officers = (officers.data ?? []).filter((o) => !o.teams.some((t) => t.laDiaBan));
  const active = investigators.filter((i) => i.isActive || i.id === assignedId);
  const stamp = detail.updatedAt;

  const blanks = blankLines(requirements);
  const checkRequirements = () => {
    if (blanks.length > 0) {
      setProblem(L.errors.WARD_REQUIREMENT_EMPTY);
      return false;
    }
    return true;
  };

  const onReturn = () => {
    if (!checkRequirements()) return;
    if (!reasonCode && !reasonText.trim()) {
      setProblem(L.errors.WARD_RETURN_REASON_REQUIRED);
      return;
    }
    setProblem(null);
    void run(
      () => wardAssignmentsApi.returnIt(detail.id, { reasonCode: reasonCode || null, reasonText: reasonText.trim() || null, requirements: trimLines(requirements) }, stamp),
      R.returned,
    );
  };

  const onApprove = () => {
    if (!checkRequirements()) return;
    if (!assignedId) {
      setProblem(L.errors.WARD_ASSIGNMENT_INVESTIGATOR_UNKNOWN);
      return;
    }
    if (!followUpTeamId) {
      setProblem(L.errors.WARD_FOLLOW_UP_TEAM_REQUIRED);
      return;
    }
    setProblem(null);
    void run(
      () =>
        wardAssignmentsApi.approve(
          detail.id,
          {
            assignedInvestigatorId: assignedId,
            followUpUserId: followUpUserId || null,
            followUpTeamId: followUpTeamId || null,
            requirements: trimLines(requirements),
            pc02Note: pc02Note.trim() || null,
          },
          stamp,
        ),
      R.approved,
    );
  };

  const teamName = (id: string | null) => (id ? teams.data.find((t) => t.id === id)?.name ?? '' : '');
  const officerName = (id: string | null) => (id ? (officers.data ?? []).find((o) => o.value === id)?.label ?? '' : '');

  return (
    <section data-testid="ward-block-review" aria-labelledby="ward-block-review-title" className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 id="ward-block-review-title" className="mb-1 text-base font-semibold text-slate-800">
        {L.form.block2}
      </h2>
      {!reviewer && <p className="mb-3 text-xs text-slate-500">{L.form.readOnlyForUnit}</p>}

      {deciding ? (
        <div className="space-y-4">
          <Field label={`${R.requirements} — ${R.requirementsHint}`}>
            <RequirementsEditor lines={requirements} onChange={setRequirements} previous={previousRequirements} />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={R.returnReason}>
              <select data-testid="ward-return-reason" className={SELECT_BASE} value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
                <option value="">{R.returnReasonPick}</option>
                {(reasons.data ?? []).map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={`${R.returnReasonText} — ${R.returnReasonHint}`}>
              <textarea data-testid="ward-return-reason-text" rows={2} className={TEXTAREA_BASE} value={reasonText} onChange={(e) => setReasonText(e.target.value)} />
            </Field>
            <Field label={R.assignedInvestigator}>
              <select data-testid="ward-assigned-investigator" className={SELECT_BASE} value={assignedId} onChange={(e) => setAssignedId(e.target.value)}>
                <option value="">{L.form.fields.investigatorPick}</option>
                {active.map((i) => (
                  <option key={i.id} value={i.id}>
                    {investigatorLabel(i)}
                    {i.id === detail.proposedInvestigatorId ? ` ${R.proposedMark}` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={R.followUpUser}>
              <select data-testid="ward-follow-up-user" className={SELECT_BASE} value={followUpUserId} onChange={(e) => setFollowUpUserId(e.target.value)}>
                <option value="">{R.followUpUserPick}</option>
                {/* The reviewer stays choosable even before the officer list loads. */}
                {followUpUserId && !pc02Officers.some((o) => o.value === followUpUserId) && <option value={followUpUserId}>{officerName(followUpUserId) || followUpUserId}</option>}
                {pc02Officers.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={R.followUpTeam}>
              <select data-testid="ward-follow-up-team" className={SELECT_BASE} value={followUpTeamId} onChange={(e) => setFollowUpTeamId(e.target.value)}>
                <option value="">{R.followUpTeamPick}</option>
                {teams.data.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={R.pc02Note}>
              <textarea data-testid="ward-pc02-note" rows={2} className={TEXTAREA_BASE} value={pc02Note} onChange={(e) => setPc02Note(e.target.value)} />
            </Field>
          </div>
          {problem && (
            <p role="alert" data-testid="ward-review-problem" className={FIELD_ERROR_TEXT}>
              {problem}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            {can.returnIt && (
              <button type="button" data-testid="ward-return" className={BTN_SECONDARY} disabled={busy} onClick={onReturn}>
                {R.actions.returnIt}
              </button>
            )}
            {can.approve && (
              <button type="button" data-testid="ward-approve" className={BTN_PRIMARY} disabled={busy} onClick={onApprove}>
                {R.actions.approve}
              </button>
            )}
          </div>
        </div>
      ) : inForce ? (
        <dl data-testid="ward-decision-in-force" className="grid gap-x-6 gap-y-3 text-sm md:grid-cols-2">
          <div>
            <dt className="text-slate-500">{R.decisionInForce}</dt>
            <dd className={`font-semibold ${inForce.kind === 'APPROVE' ? 'text-green-700' : 'text-amber-700'}`}>{L.rounds.decision[inForce.kind]}</dd>
          </div>
          {inForce.kind === 'RETURN' && (
            <div>
              <dt className="text-slate-500">{R.returnReason}</dt>
              <dd>{[(reasons.data ?? []).find((r) => r.code === inForce.reasonCode)?.name ?? inForce.reasonCode, inForce.reasonText].filter(Boolean).join(' · ')}</dd>
            </div>
          )}
          {inForce.kind === 'APPROVE' && (
            <>
              <div>
                <dt className="text-slate-500">{R.assignedInvestigator}</dt>
                <dd>{investigatorLabel(detail.assignedInvestigator)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">{R.followUpUser}</dt>
                <dd>{officerName(detail.followUpUserId)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">{R.followUpTeam}</dt>
                <dd>{teamName(detail.followUpTeamId)}</dd>
              </div>
            </>
          )}
          <div className="md:col-span-2">
            <dt className="text-slate-500">{R.requirements}</dt>
            <dd>
              <RequirementsEditor lines={inForce.requirements ?? []} readOnly testId="ward-requirements-in-force" />
            </dd>
          </div>
          {detail.pc02Note && (
            <div className="md:col-span-2">
              <dt className="text-slate-500">{R.pc02Note}</dt>
              <dd className="whitespace-pre-wrap">{detail.pc02Note}</dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="text-sm text-slate-500">{L.form.notYet}</p>
      )}

      {(can.revokeReturn || can.cancelApproval) && (
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {can.revokeReturn && (
            <button type="button" data-testid="ward-revoke-return" className={BTN_SECONDARY} disabled={busy} onClick={() => setDialog('revokeReturn')}>
              {R.actions.revokeReturn}
            </button>
          )}
          {can.cancelApproval && (
            <button type="button" data-testid="ward-cancel-approval" className={BTN_DANGER} disabled={busy} onClick={() => setDialog('cancelApproval')}>
              {R.actions.cancelApproval}
            </button>
          )}
        </div>
      )}

      <ReasonDialog
        open={dialog === 'revokeReturn'}
        title={R.dialogs.revokeReturn}
        testId="ward-dialog-revoke-return"
        busy={busy}
        onClose={() => setDialog(null)}
        onConfirm={(reason) => void run(() => wardAssignmentsApi.revokeReturn(detail.id, reason, stamp)).then((ok) => ok && setDialog(null))}
      />
      <ReasonDialog
        open={dialog === 'cancelApproval'}
        title={R.dialogs.cancelApproval}
        testId="ward-dialog-cancel-approval"
        busy={busy}
        onClose={() => setDialog(null)}
        onConfirm={(reason) => void run(() => wardAssignmentsApi.cancelApproval(detail.id, reason, stamp)).then((ok) => ok && setDialog(null))}
      />
    </section>
  );
}
