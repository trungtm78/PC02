jest.mock('otplib', () => ({
  generateSecret: jest.fn().mockReturnValue('JBSWY3DPEHPK3PXP'),
  generate: jest.fn().mockResolvedValue('123456'),
}));

import { ROLE_NAMES } from '../common/constants/role.constants';
import { TestFixturesService } from './test-fixtures.service';

describe('TestFixturesService', () => {
  it('creates E2E users with the OFFICER role provisioned by the canonical seed', async () => {
    let createdRoleId: string | undefined;
    let createdTwoFaSetupRequired: boolean | undefined;
    const prisma = {
      role: {
        findFirst: jest.fn().mockResolvedValue({ id: 'officer-role' }),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockImplementation(
            (args: {
              data: { roleId: string; twoFaSetupRequired: boolean };
            }) => {
              createdRoleId = args.data.roleId;
              createdTwoFaSetupRequired = args.data.twoFaSetupRequired;
              return {
                id: 'user-1',
                email: 'e2e+login@test.pc02.local',
                tokenVersion: 0,
                mustChangePassword: false,
                totpEnabled: false,
              };
            },
          ),
      },
    };
    const service = new TestFixturesService(prisma as never, {} as never);

    await service.seedUser({
      email: 'e2e+login@test.pc02.local',
      password: 'Temporary-Password-123!',
    });

    expect(prisma.role.findFirst).toHaveBeenCalledWith({
      where: { name: ROLE_NAMES.OFFICER },
      select: { id: true },
    });
    expect(createdRoleId).toBe('officer-role');
    expect(createdTwoFaSetupRequired).toBe(false);
  });
});
