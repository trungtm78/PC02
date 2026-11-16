import { recordInScope } from '../common/utils/scope-filter.util';
import type { RecordSubject } from '../common/utils/precise-scope';
import { enforcement, holdsPermission } from './enforcement';

/**
 * The subjects whose notices had a rule before permissions by team: when nothing is enforced their recipients are
 * kept as given. Any other subject (a ward unit's request) has no earlier rule to keep, and the lists a role gives
 * cannot tell one ward from another: when nothing is enforced, nobody is told about it. Under that mode only an
 * administrator holds anything about such records, so nothing anybody needs is lost.
 */
const TOLD_AS_BEFORE: ReadonlySet<RecordSubject> = new Set<RecordSubject>(['Case', 'Incident', 'Petition']);

/**
 * Of these people, those who may be TOLD about a record (a deadline notice names the record and who it is about).
 *
 * Nothing enforced: everybody given, exactly as before, for petitions, incidents and cases (recipients were chosen by
 * team membership and grants); nobody for any other subject (`TOLD_AS_BEFORE`).
 * Permissions by team enforced: only those who may open the record themselves. A member whose team lets them see
 * only their own records must not learn of a colleague's through a notification.
 *
 * When it cannot be told whether anything is enforced (the configuration is unavailable) nobody is told: a notice
 * not sent now is sent by the next run; a notice sent to the wrong person cannot be taken back.
 */
export function readersOf(
  userIds: readonly string[],
  subject: RecordSubject,
  record: { assignedTeamId?: string | null; ownerId?: string | null },
): string[] {
  const current = enforcement();
  if (!current) return TOLD_AS_BEFORE.has(subject) ? [...userIds] : [];
  return userIds.filter((userId) => {
    try {
      const held = current.keysOrNone(userId);
      if (!held) return TOLD_AS_BEFORE.has(subject);
      if (!held.includes(`read:${subject}`)) return false;
      return recordInScope(record, current.scopeOf(userId), 'read', subject);
    } catch {
      return false;
    }
  });
}

/**
 * Whether a person may be told that a record of this kind concerns them (it was assigned to them). Enforced: only
 * when they hold the permission to read that kind of record at all; a notice naming a petition must not reach
 * somebody whose teams let them read no petition. Nothing enforced: as before for petitions, incidents and cases,
 * nobody for any other subject. It cannot be told: nobody.
 */
export function mayBeToldAbout(userId: string, subject: RecordSubject): boolean {
  try {
    return holdsPermission(userId, `read:${subject}`, () => TOLD_AS_BEFORE.has(subject));
  } catch {
    return false;
  }
}
