/**
 * The words and colours of one step of a record, decided from what the server computed (`band`, `remainingDays`,
 * `status`, `suspended`). The browser never works out a deadline or a colour: it only chooses the sentence.
 */
import { formatVNDate } from '@/lib/dates';
import { errorText, processingFlow as L } from '@/locales/processingFlow.vi';
import { TONE_CLASS, bandText, bandTone, type Tone } from '../bandPresenter';
import type { RecordFlowDto, RecordStepDto, RecordStepPartyDto, SpeakingKind } from './types';

/** The colours live in the one band presenter; the tabs import them from here as before. */
export { TONE_CLASS };
export type { Tone };

const R = L.recordTabs;

export interface StepBadge {
  tone: Tone;
  text: string;
  /** A second, quieter line under the badge. */
  note: string | null;
}

/** A step being worked: the colour the server computed, with the days left. While the record is suspended: no colour. */
export function stepBadge(step: RecordStepDto, flow: Pick<RecordFlowDto, 'suspended' | 'pausedSince'>): StepBadge {
  switch (step.status) {
    case 'DONE':
      return {
        tone: step.completion === 'DONE_LATE' ? 'yellow' : 'done',
        text: `${R.doneOn(formatVNDate(step.doneAt))}${step.completion === 'DONE_LATE' ? ` · ${R.doneLate}` : ''}`,
        note: null,
      };
    case 'SKIPPED':
      return { tone: 'neutral', text: R.skippedOn(formatVNDate(step.skippedAt)), note: null };
    case 'WAITING_ANCHOR':
      return { tone: 'neutral', text: R.stepStatus.WAITING_ANCHOR, note: null };
    default:
      break;
  }
  const waitsForLeader = step.status === 'REPORTED' ? R.stepStatus.REPORTED : null;
  if (flow.suspended || flow.pausedSince) {
    return { tone: 'blue', text: R.suspended, note: waitsForLeader };
  }
  const text = step.dueAt === null && step.band === 'NONE' ? R.noDeadline : bandText(step.band, step.remainingDays);
  return { tone: bandTone(step.band), text, note: waitsForLeader };
}

/** Why a waiting step waits, in words: for the date of acceptance, or for the step before. */
export function waitingNote(step: RecordStepDto): string | null {
  if (step.status !== 'WAITING_ANCHOR') return null;
  if (step.anchor === 'PREVIOUS_STEP_DONE') return R.waitingForPrevious;
  return R.waitingFor(L.anchors[step.anchor] ?? step.anchor);
}

/** The unit and its role, then the person if one is named. */
export function partyLine(party: RecordStepPartyDto, personName: (userId: string) => string | null): string {
  const unit = party.teamName ?? (party.partyKind === 'RECORD_TEAM' ? L.recordTeam : L.common.none);
  const person = party.assigneeUserId ? (party.assigneeName ?? personName(party.assigneeUserId) ?? null) : null;
  return R.unitAndPerson(unit, L.roles[party.role] ?? party.role, person);
}

export const problemText = (code: string | null): string | null => (code ? R.problem(errorText(code)) : null);

const ms = (iso: string | null): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
};

/** The unit's own target is set, and earlier than the regulatory deadline. */
export function isAdjusted(step: RecordStepDto): boolean {
  const own = ms(step.internalDueAt);
  const law = ms(step.regulatoryDueAt);
  return own !== null && law !== null && own < law;
}

/** The step that sets the deadline of the record, with the deadline the law gives it. */
export function recordDeadlineStep(flow: RecordFlowDto): RecordStepDto | null {
  return flow.steps.find((s) => s.setsRecordDeadline) ?? null;
}

/** When a step last had anything happen to it: the sort key of "newest activity first". */
export function lastActivity(step: RecordStepDto): number {
  const times = [step.latestReport?.at, step.latestOpinion?.at, step.doneAt, step.skippedAt, step.startAt].map((t) => ms(t ?? null));
  return Math.max(-Infinity, ...times.filter((t): t is number => t !== null));
}

export function proposalLabel(recordKind: string, proposalKind: string | null | undefined): string | null {
  if (!proposalKind) return null;
  return R.proposalKinds[recordKind]?.[proposalKind] ?? L.common.none;
}

/** The roles a person could speak in on a step, from the roles the step's units hold (SUPERVISOR speaks for the unit that works it). */
export function speakingKinds(step: Pick<RecordStepDto, 'parties'>): SpeakingKind[] {
  const roles = step.parties.map((p) => p.role);
  const kinds: SpeakingKind[] = [];
  if (roles.includes('MAIN')) kinds.push('SUPERVISOR');
  if (roles.includes('COORDINATE')) kinds.push('COORDINATE');
  if (roles.includes('CHECK')) kinds.push('CHECK');
  return kinds;
}
