import { ForbiddenException } from '@nestjs/common';
import {
  buildScopeFilter,
  buildPetitionScopeFilter,
  assertParentInScope,
  assertPetitionParentInScope,
  assertCreatorInScope,
} from './scope-filter.util';

describe('buildScopeFilter', () => {
  it('returns null for null scope (admin passthrough)', () => {
    expect(buildScopeFilter(null)).toBeNull();
  });

  it('returns null for undefined scope (admin passthrough)', () => {
    expect(buildScopeFilter(undefined)).toBeNull();
  });

  it('returns null for dispatcher scope (canDispatch=true) — full read access', () => {
    expect(
      buildScopeFilter({
        userIds: ['u1'],
        teamIds: ['t1'],
        writableTeamIds: ['t1'],
        canDispatch: true,
      }),
    ).toBeNull();
  });

  it('returns deny-all sentinel for empty scope', () => {
    expect(
      buildScopeFilter({ userIds: [], teamIds: [], writableTeamIds: [] }),
    ).toEqual({ id: '__no_access__' });
  });

  it('returns OR with investigatorId when only userIds present', () => {
    const result = buildScopeFilter({
      userIds: ['u1', 'u2'],
      teamIds: [],
      writableTeamIds: [],
    });
    expect(result).toEqual({
      OR: [{ investigatorId: { in: ['u1', 'u2'] } }],
    });
  });

  it('returns OR with assignedTeamId + null when only teamIds present', () => {
    const result = buildScopeFilter({
      userIds: [],
      teamIds: ['t1'],
      writableTeamIds: ['t1'],
    });
    expect(result).toEqual({
      OR: [{ assignedTeamId: { in: ['t1'] } }, { assignedTeamId: null }],
    });
  });

  it('combines userIds and teamIds in OR conditions', () => {
    const result = buildScopeFilter({
      userIds: ['u1'],
      teamIds: ['t1'],
      writableTeamIds: ['t1'],
    });
    expect(result).toEqual({
      OR: [
        { investigatorId: { in: ['u1'] } },
        { assignedTeamId: { in: ['t1'] } },
        { assignedTeamId: null },
      ],
    });
  });
});

describe('buildPetitionScopeFilter', () => {
  it('returns null for null scope', () => {
    expect(buildPetitionScopeFilter(null)).toBeNull();
  });

  it('returns null for dispatcher scope (canDispatch=true)', () => {
    expect(
      buildPetitionScopeFilter({
        userIds: [],
        teamIds: ['t1'],
        writableTeamIds: ['t1'],
        canDispatch: true,
      }),
    ).toBeNull();
  });

  it('returns deny-all sentinel for empty scope', () => {
    expect(
      buildPetitionScopeFilter({
        userIds: [],
        teamIds: [],
        writableTeamIds: [],
      }),
    ).toEqual({ id: '__no_access__' });
  });

  it('uses enteredById (not investigatorId) for ownership', () => {
    const result = buildPetitionScopeFilter({
      userIds: ['u1'],
      teamIds: [],
      writableTeamIds: [],
    });
    expect(result).toEqual({
      OR: [{ enteredById: { in: ['u1'] } }],
    });
    expect(JSON.stringify(result)).not.toContain('investigatorId');
  });

  it('includes assignedTeamId null condition for team scope', () => {
    const result = buildPetitionScopeFilter({
      userIds: [],
      teamIds: ['t1'],
      writableTeamIds: ['t1'],
    });
    expect(result).toEqual({
      OR: [{ assignedTeamId: { in: ['t1'] } }, { assignedTeamId: null }],
    });
  });
});

describe('assertParentInScope', () => {
  it('passes (no-op) when scope is null — admin bypass', () => {
    expect(() =>
      assertParentInScope(
        { assignedTeamId: 'team-X', investigatorId: 'user-X' },
        null,
      ),
    ).not.toThrow();
  });

  it('P0-001: throws ForbiddenException when parent is null — orphan record (bypass fix)', () => {
    expect(() =>
      assertParentInScope(null, {
        userIds: ['u1'],
        teamIds: ['t1'],
        writableTeamIds: ['t1'],
      }),
    ).toThrow(ForbiddenException);
  });

  it('P0-001: throws ForbiddenException when parent is undefined — orphan record (bypass fix)', () => {
    expect(() =>
      assertParentInScope(undefined, {
        userIds: ['u1'],
        teamIds: ['t1'],
        writableTeamIds: ['t1'],
      }),
    ).toThrow(ForbiddenException);
  });

  it('P0-001: admin bypass still works on null parent (no scope provided)', () => {
    // Admin (scope=null) bypasses ALL checks including null parent — preserves orphan recovery flow
    expect(() => assertParentInScope(null, null)).not.toThrow();
    expect(() => assertParentInScope(undefined, undefined)).not.toThrow();
  });

  it('P0-001: canDispatch bypass still works on null parent (dispatcher read-all)', () => {
    const dispatcherScope = {
      userIds: ['d1'],
      teamIds: [],
      writableTeamIds: [],
      canDispatch: true,
    };
    expect(() => assertParentInScope(null, dispatcherScope)).not.toThrow();
  });

  it('passes when investigatorId matches userIds', () => {
    expect(() =>
      assertParentInScope(
        { assignedTeamId: 'other-team', investigatorId: 'u1' },
        { userIds: ['u1'], teamIds: ['t1'], writableTeamIds: ['t1'] },
      ),
    ).not.toThrow();
  });

  it('passes when assignedTeamId matches teamIds', () => {
    expect(() =>
      assertParentInScope(
        { assignedTeamId: 't1', investigatorId: 'other-user' },
        { userIds: ['u1'], teamIds: ['t1'], writableTeamIds: ['t1'] },
      ),
    ).not.toThrow();
  });

  it('passes when record is unassigned (no assignedTeamId) and scope has teams', () => {
    expect(() =>
      assertParentInScope(
        { assignedTeamId: null, investigatorId: 'other-user' },
        { userIds: [], teamIds: ['t1'], writableTeamIds: ['t1'] },
      ),
    ).not.toThrow();
  });

  it('throws ForbiddenException when neither userId nor teamId matches', () => {
    expect(() =>
      assertParentInScope(
        { assignedTeamId: 'team-X', investigatorId: 'user-X' },
        { userIds: ['u1'], teamIds: ['t1'], writableTeamIds: ['t1'] },
      ),
    ).toThrow(ForbiddenException);
  });

  it('passes (no-op) when scope is undefined — admin bypass', () => {
    expect(() =>
      assertParentInScope(
        { assignedTeamId: 'team-X', investigatorId: 'user-X' },
        undefined,
      ),
    ).not.toThrow();
  });

  it('throws ForbiddenException for empty scope (userIds:[], teamIds:[]) — deny-all', () => {
    expect(() =>
      assertParentInScope(
        { assignedTeamId: 'team-X', investigatorId: 'user-X' },
        { userIds: [], teamIds: [], writableTeamIds: [] },
      ),
    ).toThrow(ForbiddenException);
  });

  it('passes when both assignedTeamId and investigatorId are null (unassigned record, non-empty teamScope)', () => {
    expect(() =>
      assertParentInScope(
        { assignedTeamId: null, investigatorId: null },
        { userIds: ['u1'], teamIds: ['t1'], writableTeamIds: ['t1'] },
      ),
    ).not.toThrow();
  });

  it('passes for record outside scope when canDispatch=true — dispatcher read bypass', () => {
    expect(() =>
      assertParentInScope(
        { assignedTeamId: 'other-team', investigatorId: 'other-user' },
        {
          userIds: ['u1'],
          teamIds: ['t1'],
          writableTeamIds: ['t1'],
          canDispatch: true,
        },
      ),
    ).not.toThrow();
  });

  // canDispatch is "read all + assign/reassign any record". It used to
  // short-circuit writes as well, so every dispatcher could create, edit,
  // delete and restore child records under any case in the system — across all
  // 12 scoped resources, with nothing anywhere denying them. Reassignment is
  // unaffected: PATCH /:id/assign and the bulk-assign endpoints carry their own
  // DispatchGuard and never consult a scope.
  it('does NOT let a dispatcher write outside their team', () => {
    expect(() =>
      assertParentInScope(
        { assignedTeamId: 'other-team', investigatorId: 'other-user' },
        {
          userIds: ['u1'],
          teamIds: ['t1'],
          writableTeamIds: ['t1'],
          canDispatch: true,
        },
        'write',
      ),
    ).toThrow(ForbiddenException);
  });

  it('still lets a dispatcher write inside their own writable team', () => {
    expect(() =>
      assertParentInScope(
        { assignedTeamId: 't1', investigatorId: 'other-user' },
        {
          userIds: ['u1'],
          teamIds: ['t1'],
          writableTeamIds: ['t1'],
          canDispatch: true,
        },
        'write',
      ),
    ).not.toThrow();
  });

  it('does NOT let a dispatcher write to an orphan record', () => {
    // Read-all is one thing; a null parent on write means nothing establishes
    // which team the record belongs to, which is the P0-001 deny-by-default case.
    expect(() =>
      assertParentInScope(
        null,
        {
          userIds: ['d1'],
          teamIds: [],
          writableTeamIds: [],
          canDispatch: true,
        },
        'write',
      ),
    ).toThrow(ForbiddenException);
  });

  // ── v0.35a UC4 audit-only: Subject scope cho ward officer ─────────────
  describe('ward officer Subject scope (v0.35a)', () => {
    const wardOfficerScope = {
      userIds: ['cap-u1'],
      teamIds: ['team-ward-bn'],
      writableTeamIds: ['team-ward-bn'],
      isWardOfficer: true,
      wardTeamId: 'team-ward-bn',
    };

    it('BE-SUB1: ward officer passes assertParentInScope khi Case thuộc ward team mình', () => {
      expect(() =>
        assertParentInScope(
          { assignedTeamId: 'team-ward-bn', investigatorId: null },
          wardOfficerScope,
        ),
      ).not.toThrow();
    });

    it('BE-SUB2: ward officer throws Forbidden khi Case của ward team khác', () => {
      expect(() =>
        assertParentInScope(
          { assignedTeamId: 'team-ward-td', investigatorId: null },
          wardOfficerScope,
        ),
      ).toThrow(ForbiddenException);
    });

    it('BE-SUB3: ward officer throws Forbidden khi Case đã escalate sang đội PC02 (FROM_WARD scenario)', () => {
      expect(() =>
        assertParentInScope(
          {
            assignedTeamId: 'team-pc02-doi1',
            investigatorId: 'pc02-detective',
          },
          wardOfficerScope,
        ),
      ).toThrow(ForbiddenException);
    });
  });
});

describe('assertCreatorInScope', () => {
  it('passes (no-op) when scope is null — admin bypass', () => {
    expect(() => assertCreatorInScope('user-X', null)).not.toThrow();
  });

  it('throws ForbiddenException when createdById is null (orphan record denies scoped users)', () => {
    expect(() =>
      assertCreatorInScope(null, {
        userIds: ['u1'],
        teamIds: [],
        writableTeamIds: [],
      }),
    ).toThrow(ForbiddenException);
  });

  it('passes when createdById is in userIds', () => {
    expect(() =>
      assertCreatorInScope('u1', {
        userIds: ['u1', 'u2'],
        teamIds: [],
        writableTeamIds: [],
      }),
    ).not.toThrow();
  });

  it('passes when userIds is empty but teamIds has items (team-leader sees all creator-anchored records)', () => {
    expect(() =>
      assertCreatorInScope('user-X', {
        userIds: [],
        teamIds: ['t1'],
        writableTeamIds: ['t1'],
      }),
    ).not.toThrow();
  });

  it('throws ForbiddenException for deny-all scope (userIds:[], teamIds:[]) even when createdById is set', () => {
    expect(() =>
      assertCreatorInScope('user-X', {
        userIds: [],
        teamIds: [],
        writableTeamIds: [],
      }),
    ).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when createdById not in userIds', () => {
    expect(() =>
      assertCreatorInScope('user-X', {
        userIds: ['u1', 'u2'],
        teamIds: [],
        writableTeamIds: [],
      }),
    ).toThrow(ForbiddenException);
  });

  it('passes (no-op) when scope is undefined — admin bypass', () => {
    expect(() => assertCreatorInScope('user-X', undefined)).not.toThrow();
  });

  it('throws ForbiddenException when createdById is undefined (orphan record denies scoped users)', () => {
    expect(() =>
      assertCreatorInScope(undefined, {
        userIds: ['u1'],
        teamIds: [],
        writableTeamIds: [],
      }),
    ).toThrow(ForbiddenException);
  });

  it('passes for any createdById when canDispatch=true — dispatcher read bypass', () => {
    expect(() =>
      assertCreatorInScope('unrelated-user', {
        userIds: ['u1'],
        teamIds: ['t1'],
        writableTeamIds: ['t1'],
        canDispatch: true,
      }),
    ).not.toThrow();
  });

  it('does NOT let a dispatcher write to another user’s creator-anchored record', () => {
    expect(() =>
      assertCreatorInScope(
        'unrelated-user',
        {
          userIds: ['u1'],
          teamIds: [],
          writableTeamIds: [],
          canDispatch: true,
        },
        'write',
      ),
    ).toThrow(ForbiddenException);
  });
});

describe('assertParentInScope (write operation)', () => {
  const writeScope = {
    userIds: ['u1'],
    teamIds: ['t1', 'read-team'],
    writableTeamIds: ['t1'],
  };

  it('passes when assignedTeamId is in writableTeamIds', () => {
    expect(() =>
      assertParentInScope(
        { assignedTeamId: 't1', investigatorId: 'other' },
        writeScope,
        'write',
      ),
    ).not.toThrow();
  });

  it('throws when assignedTeamId is in teamIds but NOT writableTeamIds (READ-only grant)', () => {
    expect(() =>
      assertParentInScope(
        { assignedTeamId: 'read-team', investigatorId: 'other' },
        writeScope,
        'write',
      ),
    ).toThrow(ForbiddenException);
  });

  it('passes when investigatorId is in userIds (owner can always write)', () => {
    expect(() =>
      assertParentInScope(
        { assignedTeamId: 'read-team', investigatorId: 'u1' },
        writeScope,
        'write',
      ),
    ).not.toThrow();
  });

  it('uses teamIds as fallback when writableTeamIds is absent', () => {
    const scopeNoWritable = {
      userIds: ['u1'],
      teamIds: ['t1'],
      writableTeamIds: ['t1'],
    } as { userIds: string[]; teamIds: string[]; writableTeamIds: string[] };
    expect(() =>
      assertParentInScope(
        { assignedTeamId: 't1', investigatorId: 'other' },
        scopeNoWritable,
        'write',
      ),
    ).not.toThrow();
  });

  it('backward compat: no operation param defaults to read using teamIds', () => {
    expect(() =>
      assertParentInScope(
        { assignedTeamId: 'read-team', investigatorId: 'other' },
        writeScope,
      ),
    ).not.toThrow();
  });
});

describe('assertCreatorInScope (write operation)', () => {
  const writeScope = {
    userIds: ['u1', 'u2'],
    teamIds: ['t1', 'read-team'],
    writableTeamIds: ['t1'],
  };

  it('passes when createdById is in userIds and user has writable teams', () => {
    expect(() => assertCreatorInScope('u1', writeScope, 'write')).not.toThrow();
  });

  it('throws when scope has teamIds but empty writableTeamIds (READ-only team bypass denied for write)', () => {
    const readOnlyScope = {
      userIds: [],
      teamIds: ['read-team'],
      writableTeamIds: [],
    };
    expect(() =>
      assertCreatorInScope('any-user', readOnlyScope, 'write'),
    ).toThrow(ForbiddenException);
  });

  it('passes team bypass when writableTeamIds is non-empty', () => {
    const teamOnlyScope = {
      userIds: [],
      teamIds: ['t1'],
      writableTeamIds: ['t1'],
    };
    expect(() =>
      assertCreatorInScope('any-user', teamOnlyScope, 'write'),
    ).not.toThrow();
  });

  it('backward compat: no operation param defaults to read using teamIds for team bypass', () => {
    const readOnlyScope = {
      userIds: [],
      teamIds: ['read-team'],
      writableTeamIds: [],
    };
    expect(() => assertCreatorInScope('any-user', readOnlyScope)).not.toThrow();
  });
});

// v0.33.0.0 codex Crit 1: ward officer scope strict — exclude intake
describe('buildScopeFilter — ward officer (v0.33.0.0)', () => {
  it('excludes unassigned (intake) records cho ward officer', () => {
    const wardScope = {
      userIds: ['u1'],
      teamIds: ['ward-team-bn'],
      writableTeamIds: ['ward-team-bn'],
      isWardOfficer: true,
      wardTeamId: 'ward-team-bn',
    };
    const filter = buildScopeFilter(wardScope as any);
    const conditions = (filter as any).OR as Array<Record<string, unknown>>;
    const hasNull = conditions.some(
      (c) => 'assignedTeamId' in c && c.assignedTeamId === null,
    );
    expect(hasNull).toBe(false);
  });

  it('PC02 user (not ward officer) vẫn thấy intake (assignedTeamId:null)', () => {
    const pc02Scope = {
      userIds: ['u1'],
      teamIds: ['pc02-team'],
      writableTeamIds: ['pc02-team'],
    };
    const filter = buildScopeFilter(pc02Scope as any);
    const conditions = (filter as any).OR as Array<Record<string, unknown>>;
    const hasNull = conditions.some(
      (c) => 'assignedTeamId' in c && c.assignedTeamId === null,
    );
    expect(hasNull).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// assertPetitionParentInScope — uses enteredById (not investigatorId) cho ownership.
// Plan: ra-so-t-to-n-b-floofy-hinton.md (Cycle 1 — P0 R1 fix).
// ─────────────────────────────────────────────────────────────────────────────
describe('assertPetitionParentInScope', () => {
  const scope = {
    userIds: ['u1'],
    teamIds: ['team-A'],
    writableTeamIds: ['team-A'],
  } as any;

  it('admin passthrough (null scope)', () => {
    expect(() =>
      assertPetitionParentInScope(
        { assignedTeamId: 'team-X', enteredById: 'user-X' },
        null,
      ),
    ).not.toThrow();
  });

  it('dispatcher passthrough (canDispatch=true)', () => {
    expect(() =>
      assertPetitionParentInScope(
        { assignedTeamId: 'team-X', enteredById: 'user-X' },
        {
          userIds: [],
          teamIds: [],
          writableTeamIds: [],
          canDispatch: true,
        } as any,
      ),
    ).not.toThrow();
  });

  it('does NOT let a dispatcher write to another team’s petition', () => {
    expect(() =>
      assertPetitionParentInScope(
        { assignedTeamId: 'team-X', enteredById: 'user-X' },
        {
          userIds: [],
          teamIds: [],
          writableTeamIds: [],
          canDispatch: true,
        } as any,
        'write',
      ),
    ).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException for null parent (orphan deny)', () => {
    expect(() => assertPetitionParentInScope(null, scope)).toThrow(
      ForbiddenException,
    );
  });

  it('throws ForbiddenException for undefined parent', () => {
    expect(() => assertPetitionParentInScope(undefined, scope)).toThrow(
      ForbiddenException,
    );
  });

  it('passes when enteredById matches userIds (creator owns petition)', () => {
    expect(() =>
      assertPetitionParentInScope(
        { assignedTeamId: 'team-other', enteredById: 'u1' },
        scope,
      ),
    ).not.toThrow();
  });

  it('passes when assignedTeamId matches teamIds', () => {
    expect(() =>
      assertPetitionParentInScope(
        { assignedTeamId: 'team-A', enteredById: 'other' },
        scope,
      ),
    ).not.toThrow();
  });

  it('passes for unassigned petition (non-ward officer)', () => {
    expect(() =>
      assertPetitionParentInScope(
        { assignedTeamId: null, enteredById: 'other' },
        scope,
      ),
    ).not.toThrow();
  });

  it('throws for ward officer with unassigned petition', () => {
    const wardScope = { ...scope, isWardOfficer: true };
    expect(() =>
      assertPetitionParentInScope(
        { assignedTeamId: null, enteredById: 'other' },
        wardScope,
      ),
    ).toThrow(ForbiddenException);
  });

  it('throws when neither enteredById nor assignedTeamId match', () => {
    expect(() =>
      assertPetitionParentInScope(
        { assignedTeamId: 'team-other', enteredById: 'other' },
        scope,
      ),
    ).toThrow(ForbiddenException);
  });

  it('write operation uses writableTeamIds (not teamIds)', () => {
    const writeScope = {
      userIds: ['u1'],
      teamIds: ['read-team'],
      writableTeamIds: ['write-team'],
    } as any;
    // Petition assigned to read-team — fail on write (only writable team-write allowed)
    expect(() =>
      assertPetitionParentInScope(
        { assignedTeamId: 'read-team', enteredById: 'other' },
        writeScope,
        'write',
      ),
    ).toThrow(ForbiddenException);
    // Petition assigned to write-team — pass on write
    expect(() =>
      assertPetitionParentInScope(
        { assignedTeamId: 'write-team', enteredById: 'other' },
        writeScope,
        'write',
      ),
    ).not.toThrow();
  });

  it('write operation: creator (enteredById match) passes even on write', () => {
    const writeScope = {
      userIds: ['u1'],
      teamIds: ['read-team'],
      writableTeamIds: [],
    } as any;
    expect(() =>
      assertPetitionParentInScope(
        { assignedTeamId: 'other-team', enteredById: 'u1' },
        writeScope,
        'write',
      ),
    ).not.toThrow();
  });
});
