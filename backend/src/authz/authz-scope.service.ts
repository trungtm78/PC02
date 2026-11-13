import { Injectable, OnApplicationBootstrap, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import type { DataScope } from '../auth/services/unit-scope.service';
import { RECORD_SUBJECTS, type PreciseScope, type PreciseScopes, type RecordSubject } from '../common/utils/precise-scope';
import { AuthzService, type AuthzSnapshot } from './authz.service';
import { enforcement, setEnforcement, type Enforcement } from './enforcement';
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
 * The record scope and the permission keys of a person as permissions by team give them. Answers ONLY when the mode
 * of the configuration in memory is ENFORCE; otherwise `undefined`, and the callers keep resolving from the role and
 * the teams as before.
 *
 * Nothing here reads the database: it works on the snapshot `AuthzService` keeps in memory. The mode is the
 * snapshot's own, so a scope is never computed from one moment's mode and another moment's configuration.
 *
 * Reaching records for changing follows the "edit" permission of the subject: deleting, restoring and assigning
 * reach as far as editing does (each can still be switched off on its own by its permission).
 */
@Injectable()
export class AuthzScopeService implements Enforcement, OnApplicationBootstrap, OnModuleDestroy {
  /** What was registered before this one took over; put back when this one's application closes. */
  private previous: Enforcement | null = null;
  private registered = false;

  constructor(private readonly authz: AuthzService) {}

  /**
   * Becomes the enforcement of the process when its APPLICATION starts, not when it is constructed: a module that is
   * merely compiled (a test, a tool) has loaded nothing and must not take over from a running application.
   */
  onApplicationBootstrap(): void {
    this.previous = enforcement();
    setEnforcement(this);
    this.registered = true;
  }

  onModuleDestroy(): void {
    if (!this.registered) return;
    this.registered = false;
    if (enforcement() === this) setEnforcement(this.previous);
    this.previous = null;
  }

  /**
   * The snapshot to answer from, or null when nothing is enforced. When it cannot be told whether anything is
   * enforced, or the configuration is too old to trust, the request is REFUSED: answering "not enforced" would hand
   * back whatever the role holds, exactly when the configuration may have taken it away.
   */
  private enforced(now: Date): AuthzSnapshot | null {
    const state = this.authz.state(now.getTime());
    if (state === 'OFF') return null;
    if (state === 'UNAVAILABLE') throw new ServiceUnavailableException({ code: 'AUTHZ_UNAVAILABLE' });
    return this.authz.cached();
  }

  /** The person's answer; somebody the configuration in memory does not know yet triggers a refresh for next time. */
  private effectiveOf(snapshot: AuthzSnapshot, userId: string, now: Date) {
    if (!snapshot.users.has(userId)) void this.authz.refresh();
    return this.authz.effectiveIn(snapshot, userId, now);
  }

  scopeOf(userId: string, now: Date = new Date()): DataScope | null | undefined {
    const snapshot = this.enforced(now);
    if (!snapshot) return undefined;
    const effective = this.effectiveOf(snapshot, userId, now);
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
      // A summary measured on cases, for nobody to decide by: the record helpers read `precise`.
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

  keysOf(userId: string, now: Date = new Date()): readonly string[] | undefined {
    const snapshot = this.enforced(now);
    if (!snapshot) return undefined;
    return this.effectiveOf(snapshot, userId, now).keys;
  }
}
