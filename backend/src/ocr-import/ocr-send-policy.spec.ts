import { OcrSendPolicy } from './ocr-send-policy';

const codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return null;
  } catch (error) {
    return (
      (error as { getResponse?: () => { code?: string } }).getResponse?.()
        .code ?? 'unknown'
    );
  }
};

function setup(options: {
  granted?: Array<[string, string]>;
  destinations?: { cloud: boolean; internal: boolean };
  user?: { roleId: string; isActive: boolean } | null;
}) {
  const granted = options.granted ?? [];
  const prisma = {
    rolePermission: {
      count: jest.fn(
        ({
          where,
        }: {
          where: { permission: { action: string; subject: string } };
        }) =>
          Promise.resolve(
            granted.some(
              ([a, s]) =>
                a === where.permission.action && s === where.permission.subject,
            )
              ? 1
              : 0,
          ),
      ),
    },
    user: {
      findUnique: jest.fn(() =>
        Promise.resolve(
          options.user === undefined
            ? { roleId: 'role-1', isActive: true }
            : options.user,
        ),
      ),
    },
  };
  const providers = {
    activeDestinations: jest.fn(() =>
      Promise.resolve(options.destinations ?? { cloud: false, internal: true }),
    ),
  };
  return {
    policy: new OcrSendPolicy(prisma as never, providers as never),
    prisma,
  };
}

describe('OcrSendPolicy', () => {
  it('reports that no provider is usable', async () => {
    const { policy } = setup({
      destinations: { cloud: false, internal: false },
    });
    expect(await codeOf(policy.assertForRole('role-1'))).toBe(
      'LLM_NO_PROVIDER',
    );
  });

  it('needs the send permission of every kind of provider the content may go to', async () => {
    const both = setup({
      destinations: { cloud: true, internal: true },
      granted: [['sendCloud', 'OcrImport']],
    });
    expect(await codeOf(both.policy.assertForRole('role-1'))).toBe(
      'OCR_FORBIDDEN',
    );

    const allowed = setup({
      destinations: { cloud: true, internal: true },
      granted: [
        ['sendCloud', 'OcrImport'],
        ['sendInternal', 'OcrImport'],
      ],
    });
    await expect(
      allowed.policy.assertForRole('role-1'),
    ).resolves.toBeUndefined();
  });

  it('judges a user by the role they hold now, so revoking the permission stops a queued job', async () => {
    const { policy, prisma } = setup({
      destinations: { cloud: true, internal: false },
      granted: [],
    });
    expect(await codeOf(policy.assertForUser('u1'))).toBe('OCR_FORBIDDEN');
    expect(prisma.user.findUnique).toHaveBeenCalled();
  });

  it('refuses a user who no longer exists or has been deactivated', async () => {
    const gone = setup({
      user: null,
      granted: [['sendInternal', 'OcrImport']],
    });
    expect(await codeOf(gone.policy.assertForUser('u1'))).toBe('OCR_FORBIDDEN');
    const off = setup({
      user: { roleId: 'r', isActive: false },
      granted: [['sendInternal', 'OcrImport']],
    });
    expect(await codeOf(off.policy.assertForUser('u1'))).toBe('OCR_FORBIDDEN');
  });
});
