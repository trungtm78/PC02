import { caseCivilDay } from '../cases/governance/case-civil-day';
import { WARD_ERROR } from './ward-assignment.codes';
import { WardRuleError } from './ward-assignment.rules';

/**
 * The rules of PC02's review of a ward unit's request, as pure functions. The owner's decisions (16/11/2026): PC02
 * returns a submission with its requirements, or approves it and names the investigator who acts and the PC02 unit
 * that follows; PC02 then records when the unit received the file back, the deadline for the result (received + 2
 * months unless changed), the result and the day it was completed. Every decision has its way back.
 */

const DAY_MS = 86_400_000;

/** The calendar day in Viet Nam of an instant, as the date column stores it (00:00 UTC of that day). */
export function vnDay(clock: Date): Date {
  return new Date(caseCivilDay(clock));
}

/**
 * A calendar day plus whole months, the day clamped to the end of the month it lands in: 31/12 + 2 months = 28/02
 * (29/02 in a leap year); 30/11 + 2 months = 30/01. Days are dates (00:00 UTC), never instants.
 */
export function addMonths(day: Date, months: number): Date {
  const y = day.getUTCFullYear();
  const m = day.getUTCMonth() + months;
  const lastOfTarget = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(day.getUTCDate(), lastOfTarget)));
}

/** "Ngày cần báo kết quả giải quyết": two months from the day the unit received the file back. */
export const RESULT_MONTHS = 2;
export function resultDueFrom(receivedOn: Date): Date {
  return addMonths(receivedOn, RESULT_MONTHS);
}

/** How a completion stands against its deadline: on time, or late by whole days. */
export function timeliness(completedOn: Date, dueOn: Date): { onTime: boolean; lateDays: number } {
  const lateDays = Math.max(0, Math.round((completedOn.getTime() - dueOn.getTime()) / DAY_MS));
  return { onTime: lateDays === 0, lateDays };
}

export const REQUIREMENTS_MAX = 50;
export const REQUIREMENT_LENGTH_MAX = 2000;

/**
 * The numbered requirements of a request slip ("Yêu cầu"), in order, trimmed. A blank line is refused rather than
 * dropped (the numbering of the slip must be the one the reviewer saw), so is a list longer than 50 or a line longer
 * than 2 000 characters.
 */
export function normaliseRequirements(lines: readonly string[]): string[] {
  if (lines.length > REQUIREMENTS_MAX) throw new WardRuleError(WARD_ERROR.REQUIREMENTS_TOO_MANY, { max: REQUIREMENTS_MAX });
  return lines.map((line, index) => {
    const text = (line ?? '').trim();
    if (!text) throw new WardRuleError(WARD_ERROR.REQUIREMENT_EMPTY, { position: index + 1 });
    if (text.length > REQUIREMENT_LENGTH_MAX) throw new WardRuleError(WARD_ERROR.REQUIREMENT_TOO_LONG, { position: index + 1, max: REQUIREMENT_LENGTH_MAX });
    return text;
  });
}

/** A decision as far as "which one is in force" is concerned. */
export interface DecisionLike {
  id: string;
  kind: 'RETURN' | 'APPROVE';
  decidedAt: Date;
  revokedAt: Date | null;
}

/** The decision of a round in force: the latest not revoked, or none. */
export function decisionInForce<T extends DecisionLike>(decisions: readonly T[]): T | null {
  return decisions.filter((d) => d.revokedAt === null).reduce<T | null>((latest, d) => (!latest || d.decidedAt > latest.decidedAt ? d : latest), null);
}

/**
 * A return can be taken back ("Thu hồi trả về") only while the ward unit has done nothing with the request since:
 * once it has corrected it, taking the return back would put PC02's decision over the unit's work.
 */
export function returnRevocable(record: { status: string; updatedAt: Date }, decision: DecisionLike | null): boolean {
  return record.status === 'RETURNED' && decision?.kind === 'RETURN' && record.updatedAt.getTime() <= decision.decidedAt.getTime();
}
