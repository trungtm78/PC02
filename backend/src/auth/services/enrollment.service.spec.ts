import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { EnrollmentService } from './enrollment.service';

jest.mock('bcrypt');
const bcryptHash = bcrypt.hash as jest.Mock;
const bcryptCompare = bcrypt.compare as jest.Mock;

const ENROLLMENT_TTL_MS = 72 * 60 * 60 * 1000;

const mockTx = {
  user: { update: jest.fn() },
  enrollmentTokenAudit: { updateMany: jest.fn() },
};
const mockPrisma = {
  user: { findUnique: jest.fn(), update: jest.fn() },
  enrollmentTokenAudit: { create: jest.fn() },
  $transaction: jest.fn((cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)),
};
const mockAudit = { log: jest.fn() };
const mockConfig = {
  get: jest.fn((key: string, def?: unknown) => {
    if (key === 'APP_BASE_URL') return 'http://prod.test';
    return def;
  }),
};
const mockAuthService = {
  generateTokens: jest.fn().mockResolvedValue({
    accessToken: 'access',
    refreshToken: 'refresh',
    expiresIn: '15m',
  }),
};

function makeService(): EnrollmentService {
  const svc = Object.create(EnrollmentService.prototype);
  (svc as any).prisma = mockPrisma;
  (svc as any).audit = mockAudit;
  (svc as any).config = mockConfig;
  (svc as any).authService = mockAuthService;
  return svc as EnrollmentService;
}

const META = { ipAddress: '10.0.0.5', userAgent: 'jest' };
const NOW = new Date('2026-05-16T12:00:00.000Z');

describe('EnrollmentService.generateEnrollmentLink', () => {
  let service: EnrollmentService;

  beforeEach(() => {
    service = makeService();
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    bcryptHash.mockResolvedValue('$2b$12$hashed');
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.enrollmentTokenAudit.create.mockResolvedValue({});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns URL chứa uid + token query params', async () => {
    const result = await service.generateEnrollmentLink('u1', 'admin1');
    expect(result.url).toMatch(/^http:\/\/prod\.test\/auth\/enroll\?token=[A-Za-z0-9_-]+&uid=u1$/);
  });

  it('expiresAt = now + 72h', async () => {
    const result = await service.generateEnrollmentLink('u1', 'admin1');
    expect(result.expiresAt).toEqual(new Date(NOW.getTime() + ENROLLMENT_TTL_MS));
  });

  it('persists hash + expiry trên user record', async () => {
    await service.generateEnrollmentLink('u1', 'admin1');
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({
          enrollmentTokenHash: '$2b$12$hashed',
          enrollmentExpiresAt: new Date(NOW.getTime() + ENROLLMENT_TTL_MS),
        }),
      }),
    );
  });

  it('creates EnrollmentTokenAudit row với generator + channel hint', async () => {
    await service.generateEnrollmentLink('u1', 'admin1', 'zalo_personal');
    expect(mockPrisma.enrollmentTokenAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'u1',
          generatedBy: 'admin1',
          expiresAt: new Date(NOW.getTime() + ENROLLMENT_TTL_MS),
          channelHint: 'zalo_personal',
        }),
      }),
    );
  });

  it('audits ENROLLMENT_TOKEN_GENERATED action', async () => {
    await service.generateEnrollmentLink('u1', 'admin1');
    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin1',
        action: 'ENROLLMENT_TOKEN_GENERATED',
        subjectId: 'u1',
      }),
    );
  });

  it('hash bcrypt cost 4 trong test env (getBcryptCost)', async () => {
    await service.generateEnrollmentLink('u1', 'admin1');
    expect(bcryptHash).toHaveBeenCalledWith(expect.any(String), 4);
  });
});

describe('EnrollmentService.consumeEnrollmentToken', () => {
  let service: EnrollmentService;
  const baseUser = {
    id: 'u1',
    email: 'cb@pc02.local',
    isActive: true,
    role: { name: 'OFFICER' },
    enrollmentTokenHash: '$2b$12$validhash',
    enrollmentExpiresAt: new Date(NOW.getTime() + 60 * 60 * 1000), // +1h
    tokenVersion: 0,
  };

  beforeEach(() => {
    service = makeService();
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    bcryptHash.mockResolvedValue('$2b$12$newpasswordhash');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('rejects when user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(
      service.consumeEnrollmentToken('u1', 'token', 'NewPass1!', META),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects when user inactive', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...baseUser, isActive: false });
    await expect(
      service.consumeEnrollmentToken('u1', 'token', 'NewPass1!', META),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects when enrollmentTokenHash null (already consumed or never generated)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...baseUser,
      enrollmentTokenHash: null,
    });
    await expect(
      service.consumeEnrollmentToken('u1', 'token', 'NewPass1!', META),
    ).rejects.toThrow(/đã được sử dụng|không tồn tại/i);
  });

  it('rejects when token expired', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...baseUser,
      enrollmentExpiresAt: new Date(NOW.getTime() - 1000), // 1s ago
    });
    bcryptCompare.mockResolvedValue(true);
    await expect(
      service.consumeEnrollmentToken('u1', 'token', 'NewPass1!', META),
    ).rejects.toThrow(/hết hạn/i);
  });

  it('rejects when bcrypt token mismatch', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(baseUser);
    bcryptCompare.mockResolvedValue(false);
    await expect(
      service.consumeEnrollmentToken('u1', 'wrong-token', 'NewPass1!', META),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects weak password', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(baseUser);
    bcryptCompare.mockResolvedValue(true);
    await expect(
      service.consumeEnrollmentToken('u1', 'token', 'short', META),
    ).rejects.toThrow(BadRequestException);
  });

  it('on success: clears token, sets new password hash, bumps tokenVersion, marks audit consumed', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(baseUser);
    bcryptCompare.mockResolvedValue(true);

    await service.consumeEnrollmentToken('u1', 'valid-token', 'StrongPass1!', META);

    expect(mockTx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({
          passwordHash: '$2b$12$newpasswordhash',
          enrollmentTokenHash: null,
          enrollmentExpiresAt: null,
          mustChangePassword: false,
          failedLoginAttempts: 0,
          lockedUntil: null,
          tokenVersion: { increment: 1 },
        }),
      }),
    );
    expect(mockTx.enrollmentTokenAudit.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1', consumedAt: null },
        data: expect.objectContaining({
          consumedAt: NOW,
          consumedIp: META.ipAddress,
          consumedUa: META.userAgent,
        }),
      }),
    );
  });

  it('audits ENROLLMENT_COMPLETED on success', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(baseUser);
    bcryptCompare.mockResolvedValue(true);

    await service.consumeEnrollmentToken('u1', 'valid-token', 'StrongPass1!', META);

    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        action: 'ENROLLMENT_COMPLETED',
      }),
    );
  });

  it('issues TokenPair on success', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(baseUser);
    bcryptCompare.mockResolvedValue(true);

    const result = await service.consumeEnrollmentToken(
      'u1',
      'valid-token',
      'StrongPass1!',
      META,
    );

    expect(result).toEqual({
      accessToken: 'access',
      refreshToken: 'refresh',
      expiresIn: '15m',
    });
  });
});
