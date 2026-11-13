import { ForbiddenException } from '@nestjs/common';
import { EditWindowService } from './edit-window.service';
import { ROLE_NAMES } from '../common/constants/role.constants';
import { setEnforcement, type Enforcement } from '../authz/enforcement';
import type { AuthUser } from '../auth/interfaces/auth-user.interface';

const REVIEW = 'review_reset_request:EditWindowResetRequest';

const enforce = (keys: readonly string[] | undefined): void =>
  setEnforcement({
    scopeOf: () => undefined,
    keysOf: () => keys,
    unconditionalKeysOf: () => keys,
    keysOrNone: () => keys,
    holdersOf: () => undefined,
  } satisfies Enforcement);

const user = (role: string): AuthUser => ({ id: 'me', email: 'me@x', role, roleId: 'r' });

/** Two pending requests: one about a case of team LED (which the reviewer leads), one about a case of team OTHER. */
function build() {
  const requests = [
    { id: 'q-led', subjectType: 'Case', subjectId: 'case-led', status: 'PENDING', requestedById: 'a' },
    { id: 'q-other', subjectType: 'Case', subjectId: 'case-other', status: 'PENDING', requestedById: 'b' },
  ];
  const tx = { editWindowResetRequest: { update: jest.fn().mockResolvedValue({}) } };
  const prisma = {
    userTeam: { findMany: jest.fn().mockResolvedValue([{ teamId: 'LED' }]) },
    editWindowResetRequest: {
      findMany: jest.fn((args: { where: { id?: { in: string[] } } }) => {
        const ids = args.where.id?.in;
        return Promise.resolve(ids ? requests.filter((r) => ids.includes(r.id)) : requests);
      }),
      findFirst: jest.fn((args: { where: { id: string } }) =>
        Promise.resolve(requests.find((r) => r.id === args.where.id) ?? null),
      ),
      count: jest.fn().mockResolvedValue(requests.length),
    },
    case: {
      findUnique: jest.fn((args: { where: { id: string } }) =>
        Promise.resolve({ assignedTeamId: args.where.id === 'case-led' ? 'LED-CHILD' : 'OTHER' }),
      ),
    },
    $transaction: jest.fn(async (fn: (client: typeof tx) => Promise<void>) => fn(tx)),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const teams = { getDescendantIds: jest.fn().mockResolvedValue(['LED-CHILD']) };
  const service = new EditWindowService(prisma as never, audit as never, {} as never, teams as never);
  return { service, prisma, tx, audit };
}

describe('EditWindowService: who reviews reset requests', () => {
  afterEach(() => setEnforcement(null));

  describe('not enforced: the role decides, exactly as before', () => {
    // Also when an enforcement is registered but answers nothing (mode OFF / SHADOW).
    const modes: [string, () => void][] = [
      ['nothing registered', () => undefined],
      ['registered, not enforcing', () => enforce(undefined)],
    ];

    it.each(modes)('%s: an officer is refused, whatever else is true', async (_name, setup) => {
      setup();
      const { service } = build();
      await expect(service.bulkApprove(['q-led'], undefined, user(ROLE_NAMES.OFFICER))).rejects.toThrow(ForbiddenException);
      await expect(service.reject('q-led', 'no', user(ROLE_NAMES.OFFICER))).rejects.toThrow(ForbiddenException);
    });

    it.each(modes)('%s: a head of unit approves within the units they lead and sees only those', async (_name, setup) => {
      setup();
      const { service, tx } = build();
      await expect(service.bulkApprove(['q-led'], undefined, user(ROLE_NAMES.HEAD_UNIT))).resolves.toMatchObject({ count: 1 });
      expect(tx.editWindowResetRequest.update).toHaveBeenCalledTimes(1);
      await expect(service.bulkApprove(['q-other'], undefined, user(ROLE_NAMES.HEAD_UNIT))).rejects.toThrow(ForbiddenException);
      const listed = await service.list({}, user(ROLE_NAMES.HEAD_UNIT));
      expect((listed as { data: { id: string }[] }).data.map((r) => r.id)).toEqual(['q-led']);
    });

    it.each(modes)('%s: the administrator reviews everything and no team is looked up', async (_name, setup) => {
      setup();
      const { service, prisma } = build();
      await expect(service.bulkApprove(['q-led', 'q-other'], undefined, user(ROLE_NAMES.ADMIN))).resolves.toMatchObject({ count: 2 });
      const listed = await service.list({}, user(ROLE_NAMES.ADMIN));
      expect((listed as { data: unknown[] }).data).toHaveLength(2);
      expect(prisma.userTeam.findMany).not.toHaveBeenCalled();
    });
  });

  describe('permissions by team enforced: the permission decides, not the name of the role', () => {
    it('an officer given the review permission by a team reviews the units they lead, and only those', async () => {
      enforce([REVIEW]);
      const { service, tx } = build();
      await expect(service.bulkApprove(['q-led'], undefined, user(ROLE_NAMES.OFFICER))).resolves.toMatchObject({ count: 1 });
      expect(tx.editWindowResetRequest.update).toHaveBeenCalledTimes(1);
      await expect(service.bulkApprove(['q-other'], undefined, user(ROLE_NAMES.OFFICER))).rejects.toThrow(ForbiddenException);
      const listed = await service.list({}, user(ROLE_NAMES.OFFICER));
      expect((listed as { data: { id: string }[] }).data.map((r) => r.id)).toEqual(['q-led']);
      await expect(service.list({ countOnly: true }, user(ROLE_NAMES.OFFICER))).resolves.toEqual({ success: true, count: 1 });
    });

    it('such an officer rejects a request about their units, not one about another unit', async () => {
      enforce([REVIEW]);
      const { service, tx } = build();
      await expect(service.reject('q-other', 'no', user(ROLE_NAMES.OFFICER))).rejects.toThrow(ForbiddenException);
      expect(tx.editWindowResetRequest.update).not.toHaveBeenCalled();
      await expect(service.reject('q-led', 'no', user(ROLE_NAMES.OFFICER))).resolves.toMatchObject({ success: true });
    });

    it('a holder who leads no team reviews nothing', async () => {
      enforce([REVIEW]);
      const { service, prisma } = build();
      prisma.userTeam.findMany.mockResolvedValue([]);
      await expect(service.bulkApprove(['q-led'], undefined, user(ROLE_NAMES.OFFICER))).rejects.toThrow(ForbiddenException);
      await expect(service.reject('q-led', 'no', user(ROLE_NAMES.OFFICER))).rejects.toThrow(ForbiddenException);
      await expect(service.list({ countOnly: true }, user(ROLE_NAMES.OFFICER))).resolves.toEqual({ success: true, count: 0 });
    });

    it('a permission withdrawn while the operation runs does not lift the bound of the own units', async () => {
      // The configuration is refreshed in the background: the first question says "holds it", every later one "does not".
      const { service, prisma, tx } = build();
      const withdrawAfterFirstAnswer = () => {
        let asked = 0;
        const keys = () => (asked++ === 0 ? [REVIEW] : []);
        setEnforcement({ scopeOf: () => undefined, keysOf: keys, unconditionalKeysOf: keys, keysOrNone: keys, holdersOf: () => undefined });
      };
      withdrawAfterFirstAnswer();
      await expect(service.bulkApprove(['q-other'], undefined, user(ROLE_NAMES.OFFICER))).rejects.toThrow(ForbiddenException);
      withdrawAfterFirstAnswer();
      await expect(service.reject('q-other', 'no', user(ROLE_NAMES.OFFICER))).rejects.toThrow(ForbiddenException);
      expect(tx.editWindowResetRequest.update).not.toHaveBeenCalled();
      expect(prisma.userTeam.findMany).toHaveBeenCalledTimes(2);
    });

    it('a head of unit whose teams do not give the permission is refused', async () => {
      enforce(['read:Case']);
      const { service, tx } = build();
      await expect(service.bulkApprove(['q-led'], undefined, user(ROLE_NAMES.HEAD_UNIT))).rejects.toThrow(ForbiddenException);
      await expect(service.reject('q-led', 'no', user(ROLE_NAMES.HEAD_UNIT))).rejects.toThrow(ForbiddenException);
      expect(tx.editWindowResetRequest.update).not.toHaveBeenCalled();
    });

    it('the administrator still reviews everything', async () => {
      enforce([]);
      const { service } = build();
      await expect(service.bulkApprove(['q-led', 'q-other'], undefined, user(ROLE_NAMES.ADMIN))).resolves.toMatchObject({ count: 2 });
    });
  });

  describe('rejecting is bound like approving', () => {
    it('a reviewer of their own units rejects a request about their units, not one about another unit', async () => {
      const { service, tx } = build();
      await expect(service.reject('q-other', 'no', user(ROLE_NAMES.HEAD_UNIT))).rejects.toThrow(ForbiddenException);
      expect(tx.editWindowResetRequest.update).not.toHaveBeenCalled();
      await expect(service.reject('q-led', 'no', user(ROLE_NAMES.HEAD_UNIT))).resolves.toMatchObject({ success: true });
      expect(tx.editWindowResetRequest.update).toHaveBeenCalledTimes(1);
    });

    it('the administrator rejects any request', async () => {
      const { service } = build();
      await expect(service.reject('q-other', 'no', user(ROLE_NAMES.ADMIN))).resolves.toMatchObject({ success: true });
    });
  });
});
