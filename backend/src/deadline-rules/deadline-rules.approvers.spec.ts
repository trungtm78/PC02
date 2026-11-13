import { DeadlineRulesService } from './deadline-rules.service';
import { ROLE_NAMES } from '../common/constants/role.constants';
import { setEnforcement } from '../authz/enforcement';

/** Who is told that a deadline rule awaits approval. */
describe('DeadlineRulesService: the people notified as approvers', () => {
  afterEach(() => setEnforcement(null));

  function build() {
    const findMany = jest.fn().mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]);
    const service = new DeadlineRulesService({ user: { findMany } } as never, {} as never, {} as never);
    const approvers = (): Promise<string[]> =>
      (service as unknown as { findActiveApproverIds(): Promise<string[]> }).findActiveApproverIds();
    return { findMany, approvers };
  }
  const BY_ROLE = {
    where: { isActive: true, role: { name: { in: [ROLE_NAMES.DEADLINE_APPROVER, ROLE_NAMES.ADMIN] } } },
    select: { id: true },
  };
  const enforce = (holdersOf: (permission: string) => readonly string[] | undefined): void =>
    setEnforcement({
      scopeOf: () => undefined,
      keysOf: () => undefined,
      unconditionalKeysOf: () => undefined,
      keysOrNone: () => undefined,
      holdersOf,
    });

  it('not enforced: the active people of the two roles that carry the approval, with the query used before', async () => {
    const { findMany, approvers } = build();
    await expect(approvers()).resolves.toEqual(['u1', 'u2']);
    expect(findMany).toHaveBeenCalledWith(BY_ROLE);
  });

  it('an enforcement that answers nothing changes nothing', async () => {
    enforce(() => undefined);
    const { findMany, approvers } = build();
    await approvers();
    expect(findMany).toHaveBeenCalledWith(BY_ROLE);
  });

  it('enforced: the active people who hold the approval under permissions by team, whatever their role', async () => {
    const holdersOf = jest.fn().mockReturnValue(['u7', 'u9']);
    enforce(holdersOf);
    const { findMany, approvers } = build();
    await approvers();
    expect(holdersOf).toHaveBeenCalledWith('approve:DeadlineRuleVersion');
    expect(findMany).toHaveBeenCalledWith({ where: { isActive: true, id: { in: ['u7', 'u9'] } }, select: { id: true } });
  });

  it('enforced and nobody holds it: nobody is notified', async () => {
    enforce(() => []);
    const { findMany, approvers } = build();
    await approvers();
    expect(findMany).toHaveBeenCalledWith({ where: { isActive: true, id: { in: [] } }, select: { id: true } });
  });
});
