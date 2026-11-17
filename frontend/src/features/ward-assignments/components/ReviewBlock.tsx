/**
 * Block 2 "Thẩm định của PC02". A reviewer of a waiting request writes the numbered requirements, the return reason
 * (catalogue + words), and either returns it or approves it (assigned investigator defaulting to the proposed one,
 * follow-up officer defaulting to the reviewer, follow-up team to the reviewer's team). The reverse actions (revoke a
 * return, cancel an approval) ask for a reason. Everybody else, the ward unit included, reads the decision in force.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/shared/Modal';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, FIELD_ERROR_TEXT, INPUT_BASE, LABEL_BASE, TEXTAREA_BASE } from '@/constants/styles';
import { FKSelect } from '@/components/FKSelect';
import { wardAssignments as L } from '@/locales/wardAssignments.vi';
import { wardAssignmentsApi, WARD_QUERY_KEYS } from '../api';
import { explainWardError } from '../errors';
import { InvestigatorQuickDialog } from './InvestigatorQuickDialog';
import { decisionInForce, investigatorLabel } from '../formModel';
import { blankLines, trimLines } from '../requirements';
import type { WardAssignmentDetail, WardInvestigator } from '../types';
import { useFollowUpChoices, useReturnReasons } from '../useWardChoices';
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
  /** PC02 has just returned or approved: the page offers the request slip of that decision. */
  onDecided?: () => void;
  /** Told whether PC02 has typed something not yet sent (requirements, a reason, a note): leaving asks first. */
  onDirtyChange?: (dirty: boolean) => void;
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

export function ReviewBlock({ detail, investigators, defaultFollowUpTeamId, run, busy, onDecided, onDirtyChange }: ReviewBlockProps) {
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
  // What PC02 TYPED and would lose (the choices that default from the request are not typing).
  const typed = requirements.some((r) => r.trim() !== '') || reasonText.trim() !== '' || pc02Note !== (detail.pc02Note ?? '');
  useEffect(() => {
    onDirtyChange?.(typed);
    return () => onDirtyChange?.(false);
    // The parent's function is a new one on every render of the parent: only the answer is followed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed]);
  const [dialog, setDialog] = useState<'revokeReturn' | 'cancelApproval' | null>(null);
  const qc = useQueryClient();
  // The two small dialogs of "Tạo mới": a reason for the catalogue, an investigator for the unit's directory.
  const [newReason, setNewReason] = useState<{ name: string; busy: boolean; error: string | null } | null>(null);
  const [newInvestigator, setNewInvestigator] = useState<string | null>(null);
  const createReason = async () => {
    if (!newReason || newReason.busy) return;
    setNewReason({ ...newReason, busy: true, error: null });
    try {
      const made = await wardAssignmentsApi.addReturnReason(newReason.name.trim());
      await qc.invalidateQueries({ queryKey: WARD_QUERY_KEYS.returnReasons });
      setReasonCode(made.code);
      setNewReason(null);
    } catch (err) {
      setNewReason({ ...newReason, busy: false, error: explainWardError(err).message });
    }
  };

  // The ward unit reading a return sees the reason's name, not its code.
  const reasons = useReturnReasons(deciding || inForce?.kind === 'RETURN');
  // Only the reviewer deciding picks who follows; everybody else reads the names carried by the request.
  const choices = useFollowUpChoices(deciding && !!can.approve);
  const pc02Officers = (choices.data?.people ?? []).map((p) => ({ value: p.id, label: p.name }));
  const teamsOfChoice = choices.data?.teams ?? [];
  // The units the chosen follower belongs to: the follow-up unit is one of them (the server checks the same).
  const unitsOfFollower = (userId: string) => choices.data?.people.find((p) => p.id === userId)?.unitIds ?? null;
  const teamsForFollower = (() => {
    const own = unitsOfFollower(followUpUserId);
    return own ? teamsOfChoice.filter((t) => own.includes(t.id)) : teamsOfChoice;
  })();
  // An administrator holds no PC02 unit (and anybody else outside PC02): the reviewer as default follower only
  // stands when the list of PC02 people has them; otherwise the follower is chosen, and the unit follows from it.
  useEffect(() => {
    if (!choices.data) return;
    if (followUpUserId && !choices.data.people.some((p) => p.id === followUpUserId)) {
      setFollowUpUserId('');
      setFollowUpTeamId('');
    }
  }, [choices.data, followUpUserId]);
  const pickFollower = (userId: string) => {
    setFollowUpUserId(userId);
    const own = unitsOfFollower(userId);
    if (!own) return;
    // Their only unit, or the one already chosen when it is theirs; otherwise to be chosen.
    setFollowUpTeamId((current) => (own.includes(current) ? current : own.length === 1 ? own[0] : ''));
  };
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
    ).then((ok) => ok && onDecided?.());
  };

  const onApprove = () => {
    if (!checkRequirements()) return;
    if (!assignedId) {
      setProblem(L.errors.WARD_ASSIGNMENT_INVESTIGATOR_UNKNOWN);
      return;
    }
    if (!followUpUserId) {
      setProblem(L.errors.WARD_FOLLOW_UP_USER_REQUIRED);
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
    ).then((ok) => ok && onDecided?.());
  };

  const followerName = () => {
    const u = detail.followUpUser;
    return u ? [u.lastName, u.firstName].filter(Boolean).join(' ').trim() || u.username : '';
  };

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
            {/* Type to find; a reason the catalogue does not have: Enter (or "Tạo mới") opens the small dialog with the
                words typed, and the reason created is chosen. */}
            <FKSelect
              label={R.returnReason}
              testId="ward-return-reason"
              value={reasonCode}
              options={(reasons.data ?? []).map((r) => ({ value: r.code, label: r.name }))}
              loading={reasons.isLoading}
              placeholder={R.returnReasonPick}
              searchPlaceholder={R.returnReasonSearch}
              onChange={setReasonCode}
              canCreate
              onCreateNew={(typedName) => setNewReason({ name: typedName ?? '', busy: false, error: null })}
            />
            <Field label={`${R.returnReasonText} — ${R.returnReasonHint}`}>
              <textarea data-testid="ward-return-reason-text" rows={2} className={TEXTAREA_BASE} value={reasonText} onChange={(e) => setReasonText(e.target.value)} />
            </Field>
            {/* The three choices of an approval are type-to-find fields, as every choice of a person or a unit on these
                screens: the lists are long (every PC02 officer), and a plain list has to be scrolled through. */}
            <FKSelect
              label={R.assignedInvestigator}
              testId="ward-assigned-investigator"
              value={assignedId}
              options={active.map((i) => ({ value: i.id, label: `${investigatorLabel(i)}${i.id === detail.proposedInvestigatorId ? ` ${R.proposedMark}` : ''}` }))}
              placeholder={R.assignedInvestigatorPick}
              searchPlaceholder={L.form.fields.investigatorSearch}
              onChange={setAssignedId}
              // PC02 may assign somebody the unit did not propose: added to the unit's directory from here.
              canCreate
              onCreateNew={(typedName) => setNewInvestigator(typedName ?? '')}
            />
            <FKSelect
              label={R.followUpUser}
              testId="ward-follow-up-user"
              value={followUpUserId}
              options={pc02Officers}
              loading={choices.isLoading}
              placeholder={R.followUpUserPick}
              searchPlaceholder={R.followUpUserSearch}
              // Cleared: the unit that followed from the person goes with them.
              onChange={(v) => (v ? pickFollower(v) : (setFollowUpUserId(''), setFollowUpTeamId('')))}
            />
            <FKSelect
              label={R.followUpTeam}
              testId="ward-follow-up-team"
              value={followUpTeamId}
              options={teamsForFollower.map((t) => ({ value: t.id, label: t.name }))}
              loading={choices.isLoading}
              placeholder={R.followUpTeamPick}
              searchPlaceholder={R.followUpTeamSearch}
              onChange={setFollowUpTeamId}
            />
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
                <dd data-testid="ward-follow-up-user-name">{followerName()}</dd>
              </div>
              <div>
                <dt className="text-slate-500">{R.followUpTeam}</dt>
                <dd data-testid="ward-follow-up-team-name">{detail.followUpTeam?.name ?? ''}</dd>
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

      {newReason && (
        <Modal
          open
          onClose={() => setNewReason(null)}
          title={R.newReason.title}
          maxWidth="max-w-lg"
          footer={
            <div className="flex justify-end gap-2">
              <button type="button" data-testid="ward-new-reason-cancel" className={BTN_SECONDARY} onClick={() => setNewReason(null)}>
                {R.newReason.cancel}
              </button>
              <button type="button" data-testid="ward-new-reason-save" className={BTN_PRIMARY} disabled={newReason.busy || newReason.name.trim().length < 3} onClick={() => void createReason()}>
                {newReason.busy ? R.newReason.creating : R.newReason.create}
              </button>
            </div>
          }
        >
          <div data-testid="ward-new-reason" className="space-y-2">
            <label className="block">
              <span className={LABEL_BASE}>{R.newReason.name}</span>
              <input
                data-testid="ward-new-reason-name"
                className={INPUT_BASE}
                autoFocus
                maxLength={150}
                value={newReason.name}
                onChange={(e) => setNewReason({ ...newReason, name: e.target.value, error: null })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void createReason();
                  }
                }}
              />
            </label>
            <p className="text-xs text-slate-500">{R.newReason.hint}</p>
            {newReason.error && (
              <p role="alert" data-testid="ward-new-reason-error" className={FIELD_ERROR_TEXT}>
                {newReason.error}
              </p>
            )}
          </div>
        </Modal>
      )}
      {newInvestigator !== null && (
        <InvestigatorQuickDialog
          teamId={detail.assignedTeamId}
          suggestedName={newInvestigator}
          known={investigators}
          onClose={() => setNewInvestigator(null)}
          // Created (or the one already listed, resumed): assigned, when in use.
          onSaved={(inv) => setAssignedId(inv.isActive ? inv.id : '')}
        />
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
