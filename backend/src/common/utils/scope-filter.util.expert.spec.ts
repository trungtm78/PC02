/**
 * EXPERT TEST — tầng chuyên gia cho scope-filter.util (DataScope enforcement, security-critical).
 * Phương pháp: property-based (fast-check) + security archetype (kẻ tấn công) + metamorphic.
 * Bất biến LÕI (lớp 3 — cô lập/no-mix): bản ghi NGOÀI phạm vi LUÔN bị từ chối; admin/dispatch bypass;
 * empty scope = no-access; ward officer không thấy intake; write dùng writableTeamIds.
 */
import fc from 'fast-check';
import {
  buildScopeFilter,
  buildPetitionScopeFilter,
  assertParentInScope,
  assertPetitionParentInScope,
  assertCreatorInScope,
} from './scope-filter.util';
import type { DataScope } from '../../auth/services/unit-scope.service';

// Pool id trong-scope (u*/t*) và NGOÀI-scope (X*/TX*) — disjoint để dựng case tấn công sạch.
const inUser = fc.constantFrom('u1', 'u2', 'u3');
const inTeam = fc.constantFrom('t1', 't2', 't3');

const scopeArb = (
  over: Partial<Record<keyof DataScope, fc.Arbitrary<unknown>>> = {},
): fc.Arbitrary<DataScope> =>
  fc.record({
    userIds: over.userIds ?? fc.uniqueArray(inUser, { maxLength: 3 }),
    teamIds: over.teamIds ?? fc.uniqueArray(inTeam, { maxLength: 3 }),
    writableTeamIds:
      over.writableTeamIds ?? fc.uniqueArray(inTeam, { maxLength: 3 }),
    canDispatch: over.canDispatch ?? fc.constant(false),
    isWardOfficer: over.isWardOfficer ?? fc.boolean(),
  }) as unknown as fc.Arbitrary<DataScope>;

// Scope KHÔNG rỗng (có ít nhất 1 user hoặc team) + không dispatch — scope "thường".
const nonEmptyScopeArb = scopeArb({
  userIds: fc.uniqueArray(inUser, { minLength: 1, maxLength: 3 }),
  teamIds: fc.uniqueArray(inTeam, { minLength: 1, maxLength: 3 }),
});

describe('EXPERT property — admin/dispatch bypass (SEC-PB-01..02)', () => {
  it('SEC-PB-01: scope null/undefined (admin) → filter null, assert* không throw', () => {
    for (const sc of [null, undefined]) {
      expect(buildScopeFilter(sc)).toBeNull();
      expect(buildPetitionScopeFilter(sc)).toBeNull();
      expect(() => assertParentInScope(null, sc)).not.toThrow();
      expect(() => assertCreatorInScope(null, sc)).not.toThrow();
    }
  });

  it('SEC-PB-02: canDispatch=true → filter null, assert* không throw (kể cả parent ngoài scope)', () => {
    fc.assert(
      fc.property(scopeArb({ canDispatch: fc.constant(true) }), (scope) => {
        expect(buildScopeFilter(scope)).toBeNull();
        expect(buildPetitionScopeFilter(scope)).toBeNull();
        expect(() =>
          assertParentInScope(
            { investigatorId: 'X9', assignedTeamId: 'TX9' },
            scope,
          ),
        ).not.toThrow();
        expect(() => assertCreatorInScope('X9', scope)).not.toThrow();
      }),
      { numRuns: 200 },
    );
  });
});

describe('EXPERT property — empty scope = no access (SEC-PB-03)', () => {
  it('SEC-PB-03: userIds=[] & teamIds=[] & !dispatch → filter là điều kiện bất khả ({id sentinel})', () => {
    const empty = {
      userIds: [],
      teamIds: [],
      writableTeamIds: [],
      canDispatch: false,
    } as unknown as DataScope;
    const f = buildScopeFilter(empty);
    expect(f).not.toBeNull();
    expect(Object.keys(f!)).toContain('id'); // sentinel impossible filter, KHÔNG phải OR rỗng
    expect((f as any).OR).toBeUndefined();
    const pf = buildPetitionScopeFilter(empty);
    expect(Object.keys(pf!)).toContain('id');
  });
});

describe('EXPERT SECURITY (kẻ tấn công) — isolation no cross-scope leak (SEC-PB-04..06)', () => {
  // Parent NGOÀI scope: investigatorId ∉ userIds, assignedTeamId ∉ teamIds (và KHÔNG null → không dính intake bypass)
  it('SEC-PB-04: parent assigned team NGOÀI scope + owner ngoài scope → LUÔN throw 403', () => {
    fc.assert(
      fc.property(
        nonEmptyScopeArb,
        fc.constantFrom('read', 'write'),
        (scope, op) => {
          const parent = { investigatorId: 'X_OUT', assignedTeamId: 'TX_OUT' };
          expect(() => assertParentInScope(parent, scope, op)).toThrow();
          expect(() =>
            assertPetitionParentInScope(
              { enteredById: 'X_OUT', assignedTeamId: 'TX_OUT' },
              scope,
              op,
            ),
          ).toThrow();
        },
      ),
      { numRuns: 300 },
    );
  });

  it('SEC-PB-05: owner match (investigatorId ∈ userIds) → KHÔNG throw', () => {
    fc.assert(
      fc.property(
        scopeArb({
          userIds: fc.uniqueArray(inUser, { minLength: 1, maxLength: 3 }),
        }),
        inUser,
        (scope, uid) => {
          fc.pre(scope.userIds.includes(uid));
          expect(() =>
            assertParentInScope(
              { investigatorId: uid, assignedTeamId: 'TX_OUT' },
              scope,
            ),
          ).not.toThrow();
        },
      ),
      { numRuns: 300 },
    );
  });

  it('SEC-PB-06: team match (assignedTeamId ∈ teamIds) → read KHÔNG throw', () => {
    fc.assert(
      fc.property(
        scopeArb({
          teamIds: fc.uniqueArray(inTeam, { minLength: 1, maxLength: 3 }),
        }),
        inTeam,
        (scope, tid) => {
          fc.pre(scope.teamIds.includes(tid));
          expect(() =>
            assertParentInScope(
              { investigatorId: 'X_OUT', assignedTeamId: tid },
              scope,
              'read',
            ),
          ).not.toThrow();
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe('EXPERT SECURITY — null parent deny + ward officer intake (SEC-PB-07..09)', () => {
  it('SEC-PB-07: parent null/undefined + scope thường → throw (P0-001 chống orphan leak)', () => {
    fc.assert(
      fc.property(nonEmptyScopeArb, (scope) => {
        expect(() => assertParentInScope(null, scope)).toThrow();
        expect(() => assertParentInScope(undefined, scope)).toThrow();
        expect(() => assertPetitionParentInScope(null, scope)).toThrow();
      }),
      { numRuns: 200 },
    );
  });

  it('SEC-PB-08: ward officer + parent unassigned (assignedTeamId null) → throw (không thấy intake)', () => {
    fc.assert(
      fc.property(
        scopeArb({
          teamIds: fc.uniqueArray(inTeam, { minLength: 1, maxLength: 3 }),
          isWardOfficer: fc.constant(true),
        }),
        (scope) => {
          expect(() =>
            assertParentInScope(
              { investigatorId: 'X_OUT', assignedTeamId: null },
              scope,
            ),
          ).toThrow();
        },
      ),
      { numRuns: 200 },
    );
  });

  it('SEC-PB-09: non-ward + parent unassigned + có teamIds → KHÔNG throw (được claim intake)', () => {
    fc.assert(
      fc.property(
        scopeArb({
          teamIds: fc.uniqueArray(inTeam, { minLength: 1, maxLength: 3 }),
          isWardOfficer: fc.constant(false),
        }),
        (scope) => {
          expect(() =>
            assertParentInScope(
              { investigatorId: 'X_OUT', assignedTeamId: null },
              scope,
              'read',
            ),
          ).not.toThrow();
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('EXPERT SECURITY — gap intake: scope KHÔNG team + parent unassigned (mutation-killer L119/152)', () => {
  it('SEC-PB-10b: scope có user nhưng teamIds=[] + parent unassigned ngoài scope → THROW (không có team thì không claim intake)', () => {
    const scope = {
      userIds: ['u1'],
      teamIds: [],
      writableTeamIds: [],
      canDispatch: false,
      isWardOfficer: false,
    } as unknown as DataScope;
    expect(() =>
      assertParentInScope(
        { investigatorId: 'X_OUT', assignedTeamId: null },
        scope,
      ),
    ).toThrow();
    expect(() =>
      assertPetitionParentInScope(
        { enteredById: 'X_OUT', assignedTeamId: null },
        scope,
      ),
    ).toThrow();
  });
});

describe('EXPERT SECURITY — write dùng writableTeamIds (SEC-PB-10)', () => {
  it('SEC-PB-10: team chỉ read (∈ teamIds, ∉ writableTeamIds) → read pass, write throw', () => {
    // t2 readable nhưng KHÔNG writable.
    const scope = {
      userIds: [],
      teamIds: ['t1', 't2'],
      writableTeamIds: ['t1'],
      canDispatch: false,
      isWardOfficer: false,
    } as unknown as DataScope;
    const parent = { investigatorId: 'X_OUT', assignedTeamId: 't2' };
    expect(() => assertParentInScope(parent, scope, 'read')).not.toThrow();
    expect(() => assertParentInScope(parent, scope, 'write')).toThrow();
  });
});

describe('EXPERT SECURITY — assertCreatorInScope (SEC-PB-11)', () => {
  it('deny-all scope (userIds=[] & teamIds=[]) → luôn throw', () => {
    const denyAll = {
      userIds: [],
      teamIds: [],
      writableTeamIds: [],
      canDispatch: false,
    } as unknown as DataScope;
    expect(() => assertCreatorInScope('anyone', denyAll)).toThrow();
  });
  it('createdById null → throw', () => {
    expect(() => assertCreatorInScope(null, nonEmptyScopeFixed)).toThrow();
  });
  it('createdById ∈ userIds → không throw; ∉ userIds → throw', () => {
    fc.assert(
      fc.property(fc.constantFrom('u1', 'u2', 'X_OUT'), (cid) => {
        const scope = {
          userIds: ['u1', 'u2'],
          teamIds: [],
          writableTeamIds: [],
          canDispatch: false,
        } as unknown as DataScope;
        if (cid === 'X_OUT')
          expect(() => assertCreatorInScope(cid, scope)).toThrow();
        else expect(() => assertCreatorInScope(cid, scope)).not.toThrow();
      }),
      { numRuns: 50 },
    );
  });
  it('team-only scope (userIds=[], teamIds=[...]) → cho phép (team leader thấy creator-anchored)', () => {
    const teamOnly = {
      userIds: [],
      teamIds: ['t1'],
      writableTeamIds: ['t1'],
      canDispatch: false,
    } as unknown as DataScope;
    expect(() => assertCreatorInScope('whoever', teamOnly)).not.toThrow();
  });
});

const nonEmptyScopeFixed = {
  userIds: ['u1'],
  teamIds: ['t1'],
  writableTeamIds: ['t1'],
  canDispatch: false,
  isWardOfficer: false,
} as unknown as DataScope;

describe('EXPERT property — cấu trúc filter + metamorphic + idempotent (SEC-PB-12..14)', () => {
  it('SEC-PB-12: userIds có phần tử → OR chứa {investigatorId:{in:userIds}}', () => {
    fc.assert(
      fc.property(
        scopeArb({
          userIds: fc.uniqueArray(inUser, { minLength: 1, maxLength: 3 }),
          teamIds: fc.constant([]),
        }),
        (scope) => {
          const f = buildScopeFilter(scope) as any;
          expect(f.OR).toEqual(
            expect.arrayContaining([{ investigatorId: { in: scope.userIds } }]),
          );
        },
      ),
      { numRuns: 200 },
    );
  });

  it('SEC-PB-13 metamorphic: petition filter == case filter nhưng investigatorId↔enteredById', () => {
    fc.assert(
      fc.property(nonEmptyScopeArb, (scope) => {
        const caseF = JSON.stringify(buildScopeFilter(scope));
        const petF = JSON.stringify(buildPetitionScopeFilter(scope));
        expect(petF).toBe(caseF.split('investigatorId').join('enteredById'));
      }),
      { numRuns: 200 },
    );
  });

  it('SEC-PB-14 idempotent: buildScopeFilter thuần — cùng input cùng output', () => {
    fc.assert(
      fc.property(scopeArb(), (scope) => {
        expect(JSON.stringify(buildScopeFilter(scope))).toBe(
          JSON.stringify(buildScopeFilter(scope)),
        );
      }),
      { numRuns: 200 },
    );
  });
});
