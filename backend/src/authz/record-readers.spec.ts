import { ServiceUnavailableException } from '@nestjs/common';
import type { DataScope } from '../auth/services/unit-scope.service';
import type { PreciseScope } from '../common/utils/precise-scope';
import { setEnforcement, type Enforcement } from './enforcement';
import { readersOf } from './record-readers';

const NONE: PreciseScope = { all: false, own: false, exactTeamIds: [], tree: null };
/** A scope that reaches petitions as given, and nothing else. */
const scopeFor = (userId: string, petitions: PreciseScope): DataScope =>
  ({
    teamIds: [],
    userIds: [userId],
    writableTeamIds: [],
    writableUserIds: [userId],
    precise: {
      userId,
      subjects: { Case: { read: NONE, write: NONE }, Incident: { read: NONE, write: NONE }, Petition: { read: petitions, write: NONE } },
    },
  }) as unknown as DataScope;

function enforce(people: Record<string, { keys: string[]; scope: DataScope | null }>, failing: string[] = []): void {
  const of = (userId: string) => {
    if (failing.includes(userId)) throw new ServiceUnavailableException({ code: 'AUTHZ_UNAVAILABLE' });
    return people[userId];
  };
  setEnforcement({
    scopeOf: (userId) => of(userId)?.scope,
    keysOf: (userId) => of(userId)?.keys,
    unconditionalKeysOf: (userId) => of(userId)?.keys,
    keysOrNone: (userId) => of(userId)?.keys ?? [],
    holdersOf: () => [],
  } satisfies Enforcement);
}

// A petition of team T, entered by `author`.
const RECORD = { assignedTeamId: 'T', ownerId: 'author' };

describe('readersOf: who may be told about a record', () => {
  afterEach(() => setEnforcement(null));

  it('nothing registered, or registered and not enforcing: everybody given, in the order given', () => {
    expect(readersOf(['a', 'b', 'c'], 'Petition', RECORD)).toEqual(['a', 'b', 'c']);
    setEnforcement({ scopeOf: () => undefined, keysOf: () => undefined, unconditionalKeysOf: () => undefined, keysOrNone: () => undefined, holdersOf: () => undefined });
    expect(readersOf(['a', 'b', 'c'], 'Petition', RECORD)).toEqual(['a', 'b', 'c']);
  });

  it('enforced: only those who may open that record themselves', () => {
    enforce({
      // Sees their own petitions only: this one is theirs.
      author: { keys: ['read:Petition'], scope: scopeFor('author', { ...NONE, own: true }) },
      // Sees their own petitions only: this one is a colleague's.
      colleague: { keys: ['read:Petition'], scope: scopeFor('colleague', { ...NONE, own: true }) },
      // Sees exactly team T.
      lead: { keys: ['read:Petition'], scope: scopeFor('lead', { ...NONE, exactTeamIds: ['T'] }) },
      // Sees exactly another team.
      elsewhere: { keys: ['read:Petition'], scope: scopeFor('elsewhere', { ...NONE, exactTeamIds: ['U'] }) },
      // Reaches team T on paper but does not hold the permission to read petitions at all.
      muted: { keys: ['read:Case'], scope: scopeFor('muted', { ...NONE, exactTeamIds: ['T'] }) },
      // An administrator: unrestricted.
      admin: { keys: ['read:Petition'], scope: null },
    });
    expect(readersOf(['author', 'colleague', 'lead', 'elsewhere', 'muted', 'admin', 'stranger'], 'Petition', RECORD)).toEqual(['author', 'lead', 'admin']);
  });

  it('the subject decides: reaching petitions says nothing about a case', () => {
    enforce({ lead: { keys: ['read:Petition', 'read:Case'], scope: scopeFor('lead', { ...NONE, exactTeamIds: ['T'] }) } });
    expect(readersOf(['lead'], 'Petition', RECORD)).toEqual(['lead']);
    expect(readersOf(['lead'], 'Case', RECORD)).toEqual([]);
  });

  it('when it cannot be told whether anything is enforced, nobody is told (the next run tells them)', () => {
    enforce({ lead: { keys: ['read:Petition'], scope: scopeFor('lead', { ...NONE, exactTeamIds: ['T'] }) } }, ['lead']);
    expect(readersOf(['lead'], 'Petition', RECORD)).toEqual([]);
  });
});
