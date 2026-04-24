import { OtpCodeService } from './otp-code.service';

function makeRecord(overrides: Partial<{
  id: string; userId: string; codeHash: string; salt: string;
  expiresAt: Date; usedAt: Date | null; createdAt: Date;
}> = {}) {
  const salt = 'aabbccddeeff00112233445566778899';
  const code = '123456';
  const crypto = require('crypto');
  const codeHash = crypto.createHash('sha256').update(salt + code).digest('hex');
  return {
    id: 'otp-1',
    userId: 'user-1',
    codeHash,
    salt,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    usedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

function makePrisma(findFirstResult: any = null) {
  return {
    otpCode: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue(findFirstResult),
      update: jest.fn().mockResolvedValue({}),
    },
  } as any;
}

describe('OtpCodeService', () => {
  it('generate() returns 6-digit string', async () => {
    const prisma = makePrisma();
    const svc = new OtpCodeService(prisma);
    const code = await svc.generate('user-1');
    expect(code).toMatch(/^\d{6}$/);
  });

  it('generate() invalidates prior codes before creating new one', async () => {
    const prisma = makePrisma();
    const svc = new OtpCodeService(prisma);
    await svc.generate('user-1');
    expect(prisma.otpCode.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
  });

  it('verify() returns true for correct code within 10min', async () => {
    const record = makeRecord();
    const prisma = makePrisma(record);
    const svc = new OtpCodeService(prisma);
    const result = await svc.verify('user-1', '123456');
    expect(result).toBe(true);
    expect(prisma.otpCode.update).toHaveBeenCalledWith({
      where: { id: 'otp-1' },
      data: { usedAt: expect.any(Date) },
    });
  });

  it('verify() returns false for wrong code', async () => {
    const record = makeRecord();
    const prisma = makePrisma(record);
    const svc = new OtpCodeService(prisma);
    const result = await svc.verify('user-1', '000000');
    expect(result).toBe(false);
    expect(prisma.otpCode.update).not.toHaveBeenCalled();
  });

  it('verify() returns false when no active record (expired or used)', async () => {
    const prisma = makePrisma(null); // findFirst returns null
    const svc = new OtpCodeService(prisma);
    const result = await svc.verify('user-1', '123456');
    expect(result).toBe(false);
  });
});
