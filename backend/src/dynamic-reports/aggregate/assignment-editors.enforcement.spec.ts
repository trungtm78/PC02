import { setEnforcement } from '../../authz/enforcement';
import { findUnqualifiedEditors } from './assignment-editors';

/**
 * Who may be named as an editor of a report: somebody active who can open the module. By their ROLE as long as
 * nothing is enforced (the query is the one it always was); by what they hold once permissions by team are enforced.
 */
describe('findUnqualifiedEditors and permissions by team', () => {
  afterEach(() => setEnforcement(null));
  const tx = (found: string[]) => ({ user: { findMany: jest.fn().mockResolvedValue(found.map((id) => ({ id }))) } });
  const byRole = { role: { permissions: { some: { permission: { action: 'read', subject: 'DynamicReport' } } } } };

  it('not enforced: the role filter, with exactly the query shape it had before', async () => {
    for (const setup of [() => undefined, () => setEnforcement({ scopeOf: () => undefined, keysOf: () => undefined, holdersOf: () => undefined })]) {
      setup();
      const db = tx(['a']);
      expect(await findUnqualifiedEditors(db as never, ['a', 'b', 'a'])).toEqual(['b']);
      expect(db.user.findMany).toHaveBeenCalledWith({ where: { id: { in: ['a', 'b'] }, isActive: true, ...byRole }, select: { id: true } });
    }
  });

  it('enforced: only people who hold the permission are looked for; a role that has it is not enough', async () => {
    const holdersOf = jest.fn().mockReturnValue(['b', 'z']);
    setEnforcement({ scopeOf: () => undefined, keysOf: () => undefined, holdersOf });
    const db = tx(['b']);
    expect(await findUnqualifiedEditors(db as never, ['a', 'b'])).toEqual(['a']);
    expect(holdersOf).toHaveBeenCalledWith('read:DynamicReport');
    // Asked only for the holder, and still required to be active; no role condition.
    expect(db.user.findMany).toHaveBeenCalledWith({ where: { id: { in: ['b'] }, isActive: true }, select: { id: true } });
  });

  it('enforced and nobody holds it: everybody asked about is unqualified', async () => {
    setEnforcement({ scopeOf: () => undefined, keysOf: () => undefined, holdersOf: () => [] });
    expect(await findUnqualifiedEditors(tx([]) as never, ['a', 'b'])).toEqual(['a', 'b']);
  });

  it('nobody asked about: no query at all', async () => {
    const db = tx([]);
    expect(await findUnqualifiedEditors(db as never, [])).toEqual([]);
    expect(db.user.findMany).not.toHaveBeenCalled();
  });
});
