import { enforcement, holdsPermission, setEnforcement, userHoldingPermission, type Enforcement } from './enforcement';

const fake = (keys: readonly string[] | undefined, holders: readonly string[] | undefined = undefined): Enforcement => ({
  scopeOf: () => undefined,
  keysOf: () => keys,
  holdersOf: () => holders,
});

describe('the questions services ask about permissions', () => {
  afterEach(() => setEnforcement(null));

  describe('holdsPermission: one person', () => {
    it('nothing registered, or not enforced: the caller\'s own role check decides, sync or async, and is the answer', async () => {
      const fromRole = jest.fn().mockReturnValue(true);
      expect(holdsPermission('u1', 'read:Case', fromRole)).toBe(true);
      setEnforcement(fake(undefined));
      expect(holdsPermission('u1', 'read:Case', () => false)).toBe(false);
      await expect(holdsPermission('u1', 'read:Case', async () => true)).resolves.toBe(true);
      expect(fromRole).toHaveBeenCalledTimes(1);
    });

    it('enforced: what the person holds decides and the role is not even asked', () => {
      const fromRole = jest.fn().mockReturnValue(true);
      setEnforcement(fake(['read:Case']));
      expect(holdsPermission('u1', 'read:Case', fromRole)).toBe(true);
      expect(holdsPermission('u1', 'edit:Case', fromRole)).toBe(false);
      // Holding nothing is an answer too.
      setEnforcement(fake([]));
      expect(holdsPermission('u1', 'read:Case', fromRole)).toBe(false);
      expect(fromRole).not.toHaveBeenCalled();
    });
  });

  describe('userHoldingPermission: a filter over many people', () => {
    it('nothing registered, or not enforced: people whose role has it, as such filters were written before', () => {
      const byRole = { role: { permissions: { some: { permission: { action: 'read', subject: 'DynamicReport' } } } } };
      expect(userHoldingPermission('read', 'DynamicReport')).toEqual(byRole);
      setEnforcement(fake(undefined));
      expect(userHoldingPermission('read', 'DynamicReport')).toEqual(byRole);
    });

    it('enforced: exactly the people who hold it, by id; nobody holding it matches nobody', () => {
      const holdersOf = jest.fn().mockReturnValue(['u1', 'u2']);
      setEnforcement({ ...fake([]), holdersOf });
      expect(userHoldingPermission('read', 'DynamicReport')).toEqual({ id: { in: ['u1', 'u2'] } });
      expect(holdersOf).toHaveBeenCalledWith('read:DynamicReport');
      setEnforcement(fake([], []));
      expect(userHoldingPermission('read', 'DynamicReport')).toEqual({ id: { in: [] } });
    });
  });

  it('the registry hands back what was set', () => {
    const e = fake([]);
    setEnforcement(e);
    expect(enforcement()).toBe(e);
  });
});
