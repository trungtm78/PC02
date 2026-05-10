import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');
const bcryptCompare = bcrypt.compare as jest.Mock;
const bcryptHash = bcrypt.hash as jest.Mock;

const HASHED = '$2b$12$hashedpassword';

const mockTx = {
  user: { update: jest.fn() },
};
const mockPrisma = {
  user: { findUnique: jest.fn(), update: jest.fn() },
  $transaction: jest.fn((cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)),
};
const mockAudit = { log: jest.fn() };
const mockOtpCodeService = { generate: jest.fn(), verify: jest.fn() };
const mockEmailService = { sendPasswordResetEmail: jest.fn() };

function makeService(): AuthService {
  const svc = Object.create(AuthService.prototype);
  (svc as any).prisma = mockPrisma;
  (svc as any).auditService = mockAudit;
  (svc as any).otpCodeService = mockOtpCodeService;
  (svc as any).emailService = mockEmailService;
  (svc as any).logger = { error: jest.fn() };
  return svc as AuthService;
}

const META = { ipAddress: '127.0.0.1', userAgent: 'jest' };

describe('AuthService.changePassword', () => {
  let service: AuthService;

  beforeEach(() => {
    service = makeService();
    jest.clearAllMocks();
    bcryptHash.mockResolvedValue(HASHED);
  });

  it('returns success and clears refreshTokenHash on correct password', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isActive: true, passwordHash: HASHED });
    bcryptCompare
      .mockResolvedValueOnce(true)  // currentPassword check
      .mockResolvedValueOnce(false); // same-as-old check (newPassword !== currentPassword hash)
    mockTx.user.update.mockResolvedValue({});
    mockAudit.log.mockResolvedValue(undefined);

    const result = await service.changePassword('u1', { currentPassword: 'Old@1234', newPassword: 'New@5678A' }, META);

    expect(result.success).toBe(true);
    expect(mockTx.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { passwordHash: HASHED, refreshTokenHash: null, tokenVersion: { increment: 1 } },
    });
    expect(mockAudit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'PASSWORD_CHANGED' }), mockTx);
  });

  it('wraps DB update and audit log in a transaction', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isActive: true, passwordHash: HASHED });
    bcryptCompare.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    mockTx.user.update.mockResolvedValue({});
    mockAudit.log.mockResolvedValue(undefined);

    await service.changePassword('u1', { currentPassword: 'Old@1234', newPassword: 'New@5678A' }, META);

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockTx.user.update).toHaveBeenCalled();
    expect(mockAudit.log).toHaveBeenCalled();
  });

  it('throws UnauthorizedException when current password is wrong', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isActive: true, passwordHash: HASHED });
    bcryptCompare.mockResolvedValue(false);

    await expect(
      service.changePassword('u1', { currentPassword: 'Wrong@1', newPassword: 'New@5678A' }, META),
    ).rejects.toThrow(UnauthorizedException);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.changePassword('ghost', { currentPassword: 'Any@1234', newPassword: 'New@5678A' }, META),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when user is inactive', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isActive: false, passwordHash: HASHED });

    await expect(
      service.changePassword('u1', { currentPassword: 'Any@1234', newPassword: 'New@5678A' }, META),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws BadRequestException when user has no local password (OAuth/SSO account)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isActive: true, passwordHash: null });

    await expect(
      service.changePassword('u1', { currentPassword: 'Any@1234', newPassword: 'New@5678A' }, META),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when newPassword is same as currentPassword (bcrypt compare)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isActive: true, passwordHash: HASHED });
    bcryptCompare
      .mockResolvedValueOnce(true)  // currentPassword check passes
      .mockResolvedValueOnce(true); // same-as-old check: new == old hash

    await expect(
      service.changePassword('u1', { currentPassword: 'Same@1234', newPassword: 'Same@1234' }, META),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('always includes refreshTokenHash: null in the DB update', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u2', isActive: true, passwordHash: HASHED });
    bcryptCompare.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    mockTx.user.update.mockResolvedValue({});
    mockAudit.log.mockResolvedValue(undefined);

    await service.changePassword('u2', { currentPassword: 'Old@1234', newPassword: 'Diff@9999' }, META);

    const updateCall = mockTx.user.update.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(updateCall.data).toHaveProperty('refreshTokenHash', null);
  });
});

describe('forgotPassword + resetPassword', () => {
  let service: AuthService;

  beforeEach(() => {
    service = makeService();
    jest.clearAllMocks();
    bcryptHash.mockResolvedValue(HASHED);
  });

  // Test 1: forgotPassword with non-existent email does NOT throw
  it('forgotPassword with unknown email should NOT throw (silent)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(service.forgotPassword('unknown@email.com')).resolves.toBeUndefined();
    expect(mockOtpCodeService.generate).not.toHaveBeenCalled();
    expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  // Test 2: resetPassword with expired/wrong OTP returns BadRequestException
  it('resetPassword with wrong OTP should throw BadRequestException', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isActive: true, passwordHash: HASHED });
    mockOtpCodeService.verify.mockResolvedValue(false);

    await expect(
      service.resetPassword('user@example.com', '000000', 'NewPass@1'),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  // Test 3: resetPassword increments tokenVersion
  it('resetPassword should increment tokenVersion', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isActive: true, passwordHash: HASHED });
    mockOtpCodeService.verify.mockResolvedValue(true);
    mockPrisma.user.update.mockResolvedValue({});
    mockAudit.log.mockResolvedValue(undefined);

    await service.resetPassword('user@example.com', '123456', 'NewPass@1');

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tokenVersion: { increment: 1 } }),
      }),
    );
  });

  // Test 4: resetPassword clears refreshTokenHash
  it('resetPassword should clear refreshTokenHash', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', isActive: true, passwordHash: HASHED });
    mockOtpCodeService.verify.mockResolvedValue(true);
    mockPrisma.user.update.mockResolvedValue({});
    mockAudit.log.mockResolvedValue(undefined);

    await service.resetPassword('user@example.com', '123456', 'NewPass@1');

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ refreshTokenHash: null }),
      }),
    );
  });

  // Test 5: resetPassword returns SAME BadRequestException for email-not-found as for wrong OTP (no enum)
  it('resetPassword with unknown email should throw same BadRequestException as wrong OTP', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.resetPassword('ghost@example.com', '123456', 'NewPass@1'),
    ).rejects.toThrow(new BadRequestException('Mã xác nhận không hợp lệ hoặc đã hết hạn'));
  });
});

describe('AuthService.getProfile', () => {
  let service: AuthService;

  beforeEach(() => {
    service = makeService();
    jest.clearAllMocks();
  });

  function userFixture(opts: {
    teams?: Array<{ teamId: string; teamName: string; isLeader: boolean; joinedAt?: Date }>;
    isActive?: boolean;
  } = {}) {
    return {
      id: 'u1',
      email: 'a@b.com',
      username: 'a',
      firstName: 'A',
      lastName: 'B',
      isActive: opts.isActive !== false,
      canDispatch: false,
      role: { name: 'OFFICER' },
      userTeams: (opts.teams ?? []).map((t) => ({
        teamId: t.teamId,
        isLeader: t.isLeader,
        joinedAt: t.joinedAt ?? new Date('2024-01-01'),
        team: { id: t.teamId, name: t.teamName },
      })),
    };
  }

  it('returns leader team as primaryTeam when user has a leader role', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      userFixture({
        teams: [
          { teamId: 't1', teamName: 'Đội 1', isLeader: false, joinedAt: new Date('2024-01-01') },
          { teamId: 't2', teamName: 'Đội 2', isLeader: true, joinedAt: new Date('2024-06-01') },
        ],
      }),
    );

    const profile = await service.getProfile('u1');

    expect(profile.primaryTeam).toEqual({ teamId: 't2', teamName: 'Đội 2' });
    expect(profile.teams).toHaveLength(2);
  });

  it('falls back to oldest-joined team when no leader exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      userFixture({
        teams: [
          { teamId: 't1', teamName: 'Đội 1', isLeader: false, joinedAt: new Date('2024-01-01') },
          { teamId: 't2', teamName: 'Đội 2', isLeader: false, joinedAt: new Date('2024-06-01') },
        ],
      }),
    );

    const profile = await service.getProfile('u1');

    expect(profile.primaryTeam).toEqual({ teamId: 't1', teamName: 'Đội 1' });
  });

  it('returns primaryTeam=null when user has no team', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(userFixture({ teams: [] }));

    const profile = await service.getProfile('u1');

    expect(profile.primaryTeam).toBeNull();
    expect(profile.teams).toEqual([]);
  });

  it('handles single team membership', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      userFixture({
        teams: [{ teamId: 't1', teamName: 'Đội 1', isLeader: false }],
      }),
    );

    const profile = await service.getProfile('u1');

    expect(profile.primaryTeam).toEqual({ teamId: 't1', teamName: 'Đội 1' });
    expect(profile.teams).toEqual([{ teamId: 't1', teamName: 'Đội 1', isLeader: false }]);
  });

  it('throws UnauthorizedException when user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    await expect(service.getProfile('ghost')).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when user is inactive', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(userFixture({ isActive: false }));

    await expect(service.getProfile('u1')).rejects.toThrow(UnauthorizedException);
  });

  it('returns role name and canDispatch flag', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...userFixture({ teams: [] }),
      canDispatch: true,
      role: { name: 'COMMANDER' },
    });

    const profile = await service.getProfile('u1');

    expect(profile.role).toBe('COMMANDER');
    expect(profile.canDispatch).toBe(true);
  });
});
