import { ForbiddenException } from '@nestjs/common';
import { assertParentInScope } from './utils/scope-filter.util';
import type { DataScope } from '../auth/services/unit-scope.service';

/**
 * ND-18. `update` on subjects, lawyers and documents asserted the OLD parent was
 * in the caller's write scope, then validated that the NEW parent *existed* —
 * and stopped there. So an officer in team A could edit a record of their own
 * and hand it to a case belonging to team B: data leaves the scope, no
 * statement refuses it, and nothing on either file says it happened.
 *
 * The three services now assert the new parent as well. This suite pins the
 * primitive they all call, on the shape of scope those services pass it —
 * `assertParentInScope` is where the whole fix lives, and a change there would
 * silently reopen all three at once.
 */

const TEAM_A = 'team-a';
const TEAM_B = 'team-b';

/** An officer who may write only in team A. */
const officer: DataScope = {
  teamIds: [TEAM_A],
  writableTeamIds: [TEAM_A],
  userIds: ['u-1'],
  writableUserIds: ['u-1'],
  canDispatch: false,
} as DataScope;

describe('assertParentInScope — the guard reparenting depends on', () => {
  it('allows a parent inside the write scope', () => {
    expect(() =>
      assertParentInScope({ assignedTeamId: TEAM_A }, officer, 'write'),
    ).not.toThrow();
  });

  it('refuses a parent belonging to another team', () => {
    // The whole of ND-18: this is the call that was missing on the new parent.
    expect(() =>
      assertParentInScope({ assignedTeamId: TEAM_B }, officer, 'write'),
    ).toThrow(ForbiddenException);
  });

  it('refuses a missing parent rather than treating it as unrestricted', () => {
    expect(() => assertParentInScope(null, officer, 'write')).toThrow(
      ForbiddenException,
    );
    expect(() => assertParentInScope(undefined, officer, 'write')).toThrow(
      ForbiddenException,
    );
  });

  it('lets an unrestricted scope through', () => {
    // `null` scope is the admin case — no filtering anywhere else either.
    expect(() =>
      assertParentInScope({ assignedTeamId: TEAM_B }, null, 'write'),
    ).not.toThrow();
  });

  it('does not let read scope stand in for write scope', () => {
    // A dispatcher reads everything and writes only where granted (ADR-0017).
    // If reparenting used the read answer, the dispatcher bypass would hand
    // every case in the unit to any dispatcher with an edit button.
    const dispatcher: DataScope = {
      teamIds: [TEAM_A, TEAM_B],
      writableTeamIds: [TEAM_A],
      userIds: ['u-1'],
      writableUserIds: ['u-1'],
      canDispatch: true,
    } as DataScope;

    expect(() =>
      assertParentInScope({ assignedTeamId: TEAM_B }, dispatcher, 'read'),
    ).not.toThrow();
    expect(() =>
      assertParentInScope({ assignedTeamId: TEAM_B }, dispatcher, 'write'),
    ).toThrow(ForbiddenException);
  });
});
