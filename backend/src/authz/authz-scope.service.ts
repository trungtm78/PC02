import { Injectable } from '@nestjs/common';
import type { DataScope } from '../auth/services/unit-scope.service';
import { RECORD_SUBJECTS, type PreciseScope, type PreciseScopes, type RecordSubject } from '../common/utils/precise-scope';
import { AuthzService } from './authz.service';
import { recordScope } from './engine/scope';
import type { RecordScope } from './engine/types';

/** The permission that decides how far a person SEES records of a subject, and the one for CHANGING them. */
const READ = (subject: RecordSubject) => `read:${subject}`;
const WRITE = (subject: RecordSubject) => `edit:${subject}`;

const toPrecise = (scope: RecordScope): PreciseScope =>
  scope.all
    ? { all: true, own: false, exactTeamIds: [], tree: null }
    : { all: false, own: scope.own, exactTeamIds: [...scope.exactTeamIds], tree: scope.tree ? { ...scope.tree } : null };

const teamsOf = (scope: PreciseScope): string[] => [...new Set([...scope.exactTeamIds, ...(scope.tree?.teamIds ?? [])])];

/**
 * The record scope of a person as permissions by team give it. Answers ONLY when the mode is ENFORCE; in any other
 * mode it answers `undefined` and the callers keep resolving the scope from the role and the teams as before.
 *
 * Reaching records for changing follows the "edit" permission of the subject: deleting, restoring and assigning
 * reach as far as editing does (each can still be switched off on its own by its permission).
 */
@Injectable()
export class AuthzScopeService {
  constructor(private readonly authz: AuthzService) {}

  /**
   * `undefined`: not enforced, resolve as before. `null`: unrestricted (ADMIN). Otherwise the scope, with its
   * precise part; the four lists hold a summary measured on cases, for nobody to decide by (the record helpers
   * read `precise`).
   */
  async forUser(userId: string, now: Date = new Date()): Promise<DataScope | null | undefined> {
    const snapshot = await this.authz.snapshot();
    if (snapshot.mode !== 'ENFORCE') return undefined;
    const effective = this.authz.effectiveIn(snapshot, userId, now);
    if (effective.admin) return null;

    const subjects = {} as PreciseScopes['subjects'];
    for (const subject of RECORD_SUBJECTS) {
      subjects[subject] = {
        read: toPrecise(recordScope(snapshot.org, effective, READ(subject), 'read')),
        write: toPrecise(recordScope(snapshot.org, effective, WRITE(subject), 'write')),
      };
    }
    const cases = subjects.Case;
    return {
      teamIds: teamsOf(cases.read),
      userIds: [...new Set([userId, ...(cases.read.tree?.userIds ?? [])])],
      writableTeamIds: teamsOf(cases.write),
      writableUserIds: [...new Set([userId, ...(cases.write.tree?.userIds ?? [])])],
      canDispatch: effective.canDispatch,
      isWardOfficer: effective.wardTeamId !== null,
      wardTeamId: effective.wardTeamId,
      precise: { userId, subjects },
    };
  }

  /**
   * The permissions the person holds, as `action:subject`, when enforced; `undefined` otherwise (the caller reads
   * the role as before).
   */
  async keysFor(userId: string, now: Date = new Date()): Promise<readonly string[] | undefined> {
    const snapshot = await this.authz.snapshot();
    if (snapshot.mode !== 'ENFORCE') return undefined;
    return this.authz.effectiveIn(snapshot, userId, now).keys;
  }
}
