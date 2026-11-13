import { recordInScope } from '../common/utils/scope-filter.util';
import type { RecordSubject } from '../common/utils/precise-scope';
import { enforcement } from './enforcement';

/**
 * Of these people, those who may be TOLD about a record (a deadline notice names the record and who it is about).
 *
 * Nothing enforced: everybody given, exactly as before; recipients were chosen by team membership and grants.
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
  if (!current) return [...userIds];
  return userIds.filter((userId) => {
    try {
      const held = current.keysOrNone(userId);
      if (!held) return true;
      if (!held.includes(`read:${subject}`)) return false;
      return recordInScope(record, current.scopeOf(userId), 'read', subject);
    } catch {
      return false;
    }
  });
}
