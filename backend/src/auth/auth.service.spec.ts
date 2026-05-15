import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');
const bcryptCompare = bcrypt.compare as jest.Mock;
const bcryptHash = bcrypt.hash as jest.Mock;

const HASHED = '$2b$12$hashedpassword';

const mockTx = {
  user: {
    update: jest.fn(),
    // Codex #3: optimistic lock uses updateMany; default returns count=1 (success).
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
  },
};
const mockPrisma = {
  user: { findUnique: jest.fn(), update: jest.fn() },
  $transaction: jest.fn((cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)),
};
const mockAudit = { log: jest.fn() };
const mockOtpCodeService = { generate: jest.fn(), verify: jest.fn() };
const mockEmailService = { sendPasswordResetEmail: jest.fn() };
const mockSettingsService = { getValue: jest.fn() };
const mockJwtService = { signAsync: jest.fn() };
const mockConfigService = {
  get: jest.fn((_key: string, def?: unknown) => def ?? '15m'),
};

function makeService(): AuthService {
  const svc = Object.create(AuthService.prototype);
  (svc as any).prisma = mockPrisma;
  (svc as any).auditService = mockAudit;
  (svc as any).otpCodeService = mockOtpCodeService;
  (svc as any).emailService = mockEmailService;
  (svc as any).settingsService = mockSettingsService;
  (svc as any).jwtService = mockJwtService;
  (svc as any).configService = mockConfigService;
  (svc as any).privateKey = 'TEST_PRIVATE_KEY';
  (svc as any).logger = { error: jest.fn() };
  return svc as AuthService;
}

const META = { ipAddress: '127.0.0.1', userAgent: 'jest' };

describe('AuthService.login (mustChangePassword pending branch — C2)', () => {
  let service: AuthService;
  const baseUser = {
    id: 'u1',
    email: 'cb@pc02.local',
    isActive: true,
    passwordHash: HASHED,
    role: { name: 'OFFICER' },
    tokenVersion: 0,
    canDispatch: false,
    mustChangePassword: false,
  };

  beforeEach(() => {
    service = makeService();
    jest.clearAllMocks();
    bcryptHash.mockResolvedValue(HASHED);
    mockSettingsService.getValue.mockResolvedValue('false'); // 2FA disabled by default
    mockJwtService.signAsync.mockResolvedValue('SIGNED_JWT_TOKEN');
  });

  it('returns pending changePasswordToken when user.mustChangePassword=true (no 2FA)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...baseUser,
      mustChangePassword: true,
    });
    bcryptCompare.mockResolvedValue(true); // password correct

    const result = await service.login(
      { username: 'cb@pc02.local', password: 'Temp@1234' } as any,
      META,
    );

    expect(result).toEqual(
      expect.objectContaining({
        pending: true,
        reason: 'MUST_CHANGE_PASSWORD',
        changePasswordToken: expect.any(String),
      }),
    );
    // Should NOT have issued real tokens
    expect((result as any).accessToken).toBeUndefined();
    expect((result as any).refreshToken).toBeUndefined();
  });

  it('issues normal TokenPair when mustChangePassword=false (regression)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...baseUser,
      mustChangePassword: false,
    });
    bcryptCompare.mockResolvedValue(true);
    mockJwtService.signAsync
      .mockResolvedValueOnce('access_token_x')
      .mockResolvedValueOnce('refresh_token_y');
    mockPrisma.user.update.mockResolvedValue({});

    const result = await service.login(
      { username: 'cb@pc02.local', password: 'Good@1234' } as any,
      META,
    );

    expect((result as any).accessToken).toBeDefined();
    expect((result as any).refreshToken).toBeDefined();
    expect((result as any).pending).toBeUndefined();
  });

  // F3 audit: every blocked login emits USER_LOGIN_BLOCKED_PENDING_PASSWORD_CHANGE
  it('audits USER_LOGIN_BLOCKED_PENDING_PASSWORD_CHANGE on each pending response', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...baseUser,
      mustChangePassword: true,
    });
    bcryptCompare.mockResolvedValue(true);

    await service.login(
      { username: 'cb@pc02.local', password: 'Temp@1234' } as any,
      META,
    );

    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        action: 'USER_LOGIN_BLOCKED_PENDING_PASSWORD_CHANGE',
      }),
    );
  });

  // C2 critical: 2FA branch must NOT short-circuit the mustChangePassword check
  // when 2FA is enabled. Login still returns twoFaToken first; the mustChangePassword
  // re-check happens AFTER 2FA verify (covered in TwoFaService.verify spec).
  // Sprint 2 / S2.4: this test assumes user.totpEnabled=true (already set up 2FA);
  // otherwise login() returns setup-pending (TWO_FA_SETUP_REQUIRED) first.
  it('still returns twoFaToken pending when 2FA is enabled, even with mustChangePassword=true', async () => {
    mockSettingsService.getValue.mockResolvedValue('true'); // 2FA enabled
    mockPrisma.user.findUnique.mockResolvedValue({
      ...baseUser,
      mustChangePassword: true,
      totpEnabled: true, // user đã setup 2FA, không phải initial-setup flow
    });
    bcryptCompare.mockResolvedValue(true);

    const result = await service.login(
      { username: 'cb@pc02.local', password: 'Temp@1234' } as any,
      META,
    );

    // 2FA pending takes precedence — the second check happens post-OTP
    expect((result as any).pending).toBe(true);
    expect((result as any).twoFaToken).toBeDefined();
    expect((result as any).changePasswordToken).toBeUndefined();
  });
});

describe('AuthService.firstLoginChangePassword (D1 / new endpoint)', () => {
  let service: AuthService;
  const baseUser = {
    id: 'u1',
    email: 'cb@pc02.local',
    isActive: true,
    passwordHash: HASHED,
    mustChangePassword: true,
    role: { name: 'OFFICER' },
    tokenVersion: 0,
    canDispatch: false,
  };

  beforeEach(() => {
    service = makeService();
    jest.clearAllMocks();
    bcryptHash.mockResolvedValue(HASHED + '_NEW');
    mockJwtService.signAsync.mockResolvedValue('NEW_TOKEN');
  });

  it('throws when user not found or inactive', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(
      (service as any).firstLoginChangePassword('u1', 0, { newPassword: 'New@2026A' }, META),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('throws BadRequestException when mustChangePassword is already false', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...baseUser,
      mustChangePassword: false,
    });
    await expect(
      (service as any).firstLoginChangePassword('u1', 0, { newPassword: 'New@2026A' }, META),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects when newPassword is the same as the current temp password', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(baseUser);
    bcryptCompare.mockResolvedValue(true); // newPassword matches current hash
    await expect(
      (service as any).firstLoginChangePassword('u1', 0, { newPassword: 'TempThatWas@123' }, META),
    ).rejects.toThrow(BadRequestException);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('on success: updates hash, clears mustChangePassword, increments tokenVersion, returns TokenPair', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(baseUser);
    bcryptCompare.mockResolvedValue(false); // new pw is different from current
    mockTx.user.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.user.update.mockResolvedValue({});

    const result = await (service as any).firstLoginChangePassword(
      'u1',
      0,
      { newPassword: 'New@2026A' },
      META,
    );

    expect(mockTx.user.updateMany).toHaveBeenCalledWith({
      where: { id: 'u1', tokenVersion: 0 },
      data: expect.objectContaining({
        passwordHash: HASHED + '_NEW',
        mustChangePassword: false,
        passwordChangedAt: expect.any(Date),
        tokenVersion: { increment: 1 },
        refreshTokenHash: null,
      }),
    });
    expect((result as any).accessToken).toBeDefined();
    expect((result as any).refreshToken).toBeDefined();
  });

  // Codex challenge #3 + review round 2 #A: optimistic-lock WHERE uses the
  // tokenVersion FROM THE JWT PAYLOAD (passed in as expectedTokenVersion),
  // not the freshly-loaded user.tokenVersion. This closes the race where
  // admin re-resets between guard and service.
  it('uses updateMany with WHERE tokenVersion=payload (not fresh DB value) — Codex #3 + #A', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...baseUser,
      tokenVersion: 9, // DB is at 9 (admin re-reset bumped it)
    });
    bcryptCompare.mockResolvedValue(false);
    mockTx.user.updateMany = jest.fn().mockResolvedValue({ count: 0 });
    // expectedTokenVersion=7 (from the user's stale T1 payload) must propagate
    // into the WHERE so the update matches 0 rows and throws.
    await expect(
      (service as any).firstLoginChangePassword(
        'u1',
        7,
        { newPassword: 'New@2026A' },
        META,
      ),
    ).rejects.toThrow(/yêu cầu khác|reset lại|concurrent|superseded|already/i);
    expect(mockTx.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1', tokenVersion: 7 },
        data: expect.objectContaining({ tokenVersion: { increment: 1 } }),
      }),
    );
  });

  it('throws ConflictException when updateMany matches 0 rows (concurrent change won)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...baseUser,
      tokenVersion: 7,
    });
    bcryptCompare.mockResolvedValue(false);
    mockTx.user.updateMany = jest.fn().mockResolvedValue({ count: 0 });

    await expect(
      (service as any).firstLoginChangePassword(
        'u1',
        0,
        { newPassword: 'New@2026A' },
        META,
      ),
    ).rejects.toThrow(/yêu cầu khác|reset lại|concurrent|superseded|already/i);
  });

  // Codex challenge #1: refreshTokenHash MUST be stored after issuing the new
  // refresh token. Otherwise the user appears logged in but refresh fails after
  // ~15 min (access token expiry), forcing immediate re-login and ruining
  // first-impression UX.
  it('stores the new refreshTokenHash after issuing the TokenPair', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(baseUser);
    bcryptCompare.mockResolvedValue(false);
    mockTx.user.updateMany.mockResolvedValue({ count: 1 });
    mockJwtService.signAsync
      .mockResolvedValueOnce('access_x')
      .mockResolvedValueOnce('refresh_y');
    mockPrisma.user.update.mockResolvedValue({});

    await (service as any).firstLoginChangePassword(
      'u1',
      0,
      { newPassword: 'New@2026A' },
      META,
    );

    // After the transactional update, a separate prisma.user.update must run
    // to persist the new refresh token hash (rotation pattern from login()).
    const calls = mockPrisma.user.update.mock.calls;
    const refreshUpdate = calls.find(
      (c: any[]) =>
        c[0]?.where?.id === 'u1' &&
        c[0]?.data?.refreshTokenHash &&
        typeof c[0].data.refreshTokenHash === 'string',
    );
    expect(refreshUpdate).toBeDefined();
  });

  // Codex review round 2 #C: when forced-change completes the user IS
  // logged in (TokenPair issued, lastLoginAt set). Audit queries on
  // USER_LOGIN must see this event too so compliance can count first-login
  // completions as completed sessions.
  it('emits USER_LOGIN audit (transactional) after a successful forced change (Codex #C)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(baseUser);
    bcryptCompare.mockResolvedValue(false);
    mockTx.user.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.user.update.mockResolvedValue({});

    await (service as any).firstLoginChangePassword(
      'u1',
      0,
      { newPassword: 'New@2026A' },
      META,
    );

    // Both events must fire — FIRST_LOGIN_PASSWORD_CHANGED for the action,
    // USER_LOGIN for the resulting session.
    const actions = mockAudit.log.mock.calls.map((c: any[]) => c[0].action);
    expect(actions).toContain('FIRST_LOGIN_PASSWORD_CHANGED');
    expect(actions).toContain('USER_LOGIN');
    // USER_LOGIN metadata flags the path so it's distinguishable.
    const userLoginCall = mockAudit.log.mock.calls.find(
      (c: any[]) => c[0].action === 'USER_LOGIN',
    );
    expect(userLoginCall[0].metadata).toEqual(
      expect.objectContaining({ viaForcedChange: true }),
    );
  });

  // F3: explicit FIRST_LOGIN_PASSWORD_CHANGED audit, transactional with the update
  it('audits FIRST_LOGIN_PASSWORD_CHANGED inside the same transaction as the update', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(baseUser);
    bcryptCompare.mockResolvedValue(false);
    mockTx.user.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.user.update.mockResolvedValue({});

    await (service as any).firstLoginChangePassword(
      'u1',
      0,
      { newPassword: 'New@2026A' },
      META,
    );

    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        action: 'FIRST_LOGIN_PASSWORD_CHANGED',
      }),
      mockTx,
    );
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe('AuthService.refreshToken (Codex challenge #4 — tokenVersion enforcement)', () => {
  let service: AuthService;
  const baseUser = {
    id: 'u1',
    email: 'cb@pc02.local',
    isActive: true,
    refreshTokenHash: 'old_refresh_hash',
    role: { name: 'OFFICER' },
    tokenVersion: 5, // current DB value
    canDispatch: false,
  };

  beforeEach(() => {
    service = makeService();
    jest.clearAllMocks();
    bcryptHash.mockResolvedValue(HASHED);
    bcryptCompare.mockResolvedValue(true);
    mockPrisma.user.update.mockResolvedValue({});
    mockJwtService.signAsync
      .mockResolvedValueOnce('new_access')
      .mockResolvedValueOnce('new_refresh');
    // Mock JwtService.verify (synchronous in NestJS).
    (mockJwtService as any).verify = jest.fn();
  });

  // Codex #4 finding: previously refreshToken() never compared payload.tokenVersion
  // to user.tokenVersion. After the deploy migration bumps every user's
  // tokenVersion, a still-valid refresh token issued before the bump must be
  // rejected — otherwise the migration's "force re-login" intent is bypassed.
  it('rejects a refresh token whose payload.tokenVersion is less than user.tokenVersion (post-migration / post-reset)', async () => {
    (mockJwtService as any).verify.mockReturnValue({
      sub: 'u1',
      type: 'refresh',
      tokenVersion: 4, // stale — was issued before tokenVersion bumped to 5
    });
    mockPrisma.user.findUnique.mockResolvedValue(baseUser);

    await expect(
      service.refreshToken('any.refresh.token', META),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('accepts a refresh token whose payload.tokenVersion matches user.tokenVersion', async () => {
    (mockJwtService as any).verify.mockReturnValue({
      sub: 'u1',
      type: 'refresh',
      tokenVersion: 5, // matches
    });
    mockPrisma.user.findUnique.mockResolvedValue(baseUser);

    const result = await service.refreshToken('any.refresh.token', META);
    expect((result as any).accessToken).toBeDefined();
  });

  it('treats a refresh token without tokenVersion (legacy pre-feature) as version 0 and rejects when DB > 0', async () => {
    (mockJwtService as any).verify.mockReturnValue({
      sub: 'u1',
      type: 'refresh',
      // no tokenVersion field — legacy token
    });
    mockPrisma.user.findUnique.mockResolvedValue(baseUser); // tokenVersion: 5

    await expect(
      service.refreshToken('legacy.token', META),
    ).rejects.toThrow(UnauthorizedException);
  });
});

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

// ───────────────────────────────────────────────────────────────────────────
// Sprint 1 — S1.2: Account Lockout
//
// Behaviour spec: after MAX_FAILED_LOGIN_ATTEMPTS (5) consecutive failures,
// the account is locked for LOCKOUT_DURATION_MS (15 phút). Locked users
// cannot login even with correct password; bcrypt.compare must NOT be
// called for locked accounts. Success login resets counter to 0.
// ───────────────────────────────────────────────────────────────────────────

describe('AuthService.login (account lockout — Sprint 1 S1.2)', () => {
  let service: AuthService;
  const NOW = new Date('2026-05-15T10:00:00.000Z');
  const baseUser = {
    id: 'u1',
    email: 'cb@pc02.local',
    isActive: true,
    passwordHash: HASHED,
    role: { name: 'OFFICER' },
    tokenVersion: 0,
    canDispatch: false,
    mustChangePassword: false,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastFailedLoginAt: null,
  };

  beforeEach(() => {
    service = makeService();
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    mockSettingsService.getValue.mockResolvedValue('false'); // 2FA off
    mockJwtService.signAsync.mockResolvedValue('SIGNED');
    bcryptHash.mockResolvedValue(HASHED);
    mockPrisma.user.update.mockResolvedValue({});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('increments failedLoginAttempts on wrong password', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...baseUser });
    bcryptCompare.mockResolvedValue(false);

    await expect(
      service.login({ username: 'cb@pc02.local', password: 'wrong' } as any, META),
    ).rejects.toThrow(UnauthorizedException);

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({
          failedLoginAttempts: 1,
          lastFailedLoginAt: NOW,
        }),
      }),
    );
  });

  it('locks account after 5 consecutive failures (sets lockedUntil = now + 15min)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...baseUser,
      failedLoginAttempts: 4,
    });
    bcryptCompare.mockResolvedValue(false);

    await expect(
      service.login({ username: 'cb@pc02.local', password: 'wrong' } as any, META),
    ).rejects.toThrow(UnauthorizedException);

    const expectedLockUntil = new Date(NOW.getTime() + 15 * 60 * 1000);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({
          failedLoginAttempts: 5,
          lockedUntil: expectedLockUntil,
          lastFailedLoginAt: NOW,
        }),
      }),
    );
  });

  it('audits USER_LOGIN_LOCKED when lockout triggers', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...baseUser,
      failedLoginAttempts: 4,
    });
    bcryptCompare.mockResolvedValue(false);

    await expect(
      service.login({ username: 'cb@pc02.local', password: 'wrong' } as any, META),
    ).rejects.toThrow();

    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USER_LOGIN_LOCKED',
        userId: 'u1',
      }),
    );
  });

  it('rejects login when account is currently locked (skips bcrypt.compare)', async () => {
    const futureLock = new Date(NOW.getTime() + 5 * 60 * 1000); // 5 phút tới
    mockPrisma.user.findUnique.mockResolvedValue({
      ...baseUser,
      failedLoginAttempts: 5,
      lockedUntil: futureLock,
    });

    await expect(
      service.login({ username: 'cb@pc02.local', password: 'correct' } as any, META),
    ).rejects.toThrow(/khoá|locked/i);

    expect(bcryptCompare).not.toHaveBeenCalled();
  });

  it('allows login after lockedUntil expires and resets counter on success', async () => {
    const expiredLock = new Date(NOW.getTime() - 1000); // 1 giây trước
    mockPrisma.user.findUnique.mockResolvedValue({
      ...baseUser,
      failedLoginAttempts: 5,
      lockedUntil: expiredLock,
    });
    bcryptCompare.mockResolvedValue(true);
    mockJwtService.signAsync
      .mockResolvedValueOnce('access_token')
      .mockResolvedValueOnce('refresh_token');

    const result = await service.login(
      { username: 'cb@pc02.local', password: 'correct' } as any,
      META,
    );

    expect((result as any).accessToken).toBeDefined();
    // Login success must reset lockout state
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastFailedLoginAt: null,
        }),
      }),
    );
  });

  it('resets failedLoginAttempts to 0 on successful login (even when no prior lock)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...baseUser,
      failedLoginAttempts: 3,
    });
    bcryptCompare.mockResolvedValue(true);
    mockJwtService.signAsync
      .mockResolvedValueOnce('access_token')
      .mockResolvedValueOnce('refresh_token');

    await service.login(
      { username: 'cb@pc02.local', password: 'correct' } as any,
      META,
    );

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          failedLoginAttempts: 0,
          lockedUntil: null,
          lastFailedLoginAt: null,
        }),
      }),
    );
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Sprint 2 — S2.4: 2FA Setup Mandate
//
// Khi TWO_FA_ENABLED=true mà user chưa totpEnabled (hoặc user.twoFaSetupRequired=true),
// login() return `{ pending: true, twoFaSetupToken, reason: 'TWO_FA_SETUP_REQUIRED' }`.
// Frontend redirect /auth/2fa-setup. User scan QR + verify first OTP → real TokenPair.
// ───────────────────────────────────────────────────────────────────────────

// ───────────────────────────────────────────────────────────────────────────
// Sprint 2 — S2.3: Backend Logout Endpoint
// ───────────────────────────────────────────────────────────────────────────

describe('AuthService.logout (Sprint 2 S2.3)', () => {
  let service: AuthService;

  beforeEach(() => {
    service = makeService();
    jest.clearAllMocks();
    mockPrisma.user.update.mockResolvedValue({});
  });

  it('clears refreshTokenHash → refresh token cũ không dùng được', async () => {
    await service.logout('u1', META);

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { refreshTokenHash: null },
    });
  });

  it('audits USER_LOGOUT with ip + user agent', async () => {
    await service.logout('u1', META);

    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        action: 'USER_LOGOUT',
        ipAddress: META.ipAddress,
        userAgent: META.userAgent,
      }),
    );
  });

  it('returns { success: true }', async () => {
    const result = await service.logout('u1', META);
    expect(result).toEqual({ success: true });
  });
});

describe('AuthService.login (2FA setup mandate — Sprint 2 S2.4)', () => {
  let service: AuthService;
  const baseUser = {
    id: 'u1',
    email: 'cb@pc02.local',
    isActive: true,
    passwordHash: HASHED,
    role: { name: 'OFFICER' },
    tokenVersion: 0,
    canDispatch: false,
    mustChangePassword: false,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastFailedLoginAt: null,
    totpEnabled: false,
    twoFaSetupRequired: false,
  };

  beforeEach(() => {
    service = makeService();
    jest.clearAllMocks();
    bcryptHash.mockResolvedValue(HASHED);
    mockJwtService.signAsync.mockResolvedValue('SETUP_TOKEN');
    mockPrisma.user.update.mockResolvedValue({});
  });

  it('returns setup-pending token when TWO_FA_ENABLED=true and user has not enabled totp', async () => {
    mockSettingsService.getValue.mockResolvedValue('true');
    mockPrisma.user.findUnique.mockResolvedValue({
      ...baseUser,
      totpEnabled: false,
    });
    bcryptCompare.mockResolvedValue(true);

    const result = await service.login(
      { username: 'cb@pc02.local', password: 'correct' } as any,
      META,
    );

    expect(result).toMatchObject({
      pending: true,
      reason: 'TWO_FA_SETUP_REQUIRED',
      twoFaSetupToken: expect.any(String),
    });
    expect((result as any).twoFaToken).toBeUndefined();
    expect((result as any).accessToken).toBeUndefined();
  });

  it('returns setup-pending when user.twoFaSetupRequired=true even if TWO_FA_ENABLED=false', async () => {
    mockSettingsService.getValue.mockResolvedValue('false');
    mockPrisma.user.findUnique.mockResolvedValue({
      ...baseUser,
      twoFaSetupRequired: true,
      totpEnabled: false,
    });
    bcryptCompare.mockResolvedValue(true);

    const result = await service.login(
      { username: 'cb@pc02.local', password: 'correct' } as any,
      META,
    );

    expect(result).toMatchObject({
      pending: true,
      reason: 'TWO_FA_SETUP_REQUIRED',
    });
  });

  it('falls back to normal 2FA verify flow when user.totpEnabled=true', async () => {
    mockSettingsService.getValue.mockResolvedValue('true');
    mockPrisma.user.findUnique.mockResolvedValue({
      ...baseUser,
      totpEnabled: true,
    });
    bcryptCompare.mockResolvedValue(true);

    const result = await service.login(
      { username: 'cb@pc02.local', password: 'correct' } as any,
      META,
    );

    expect((result as any).twoFaToken).toBeDefined();
    expect((result as any).reason).toBeUndefined();
  });

  it('audits USER_2FA_SETUP_REQUIRED when setup-pending fires', async () => {
    mockSettingsService.getValue.mockResolvedValue('true');
    mockPrisma.user.findUnique.mockResolvedValue({
      ...baseUser,
      totpEnabled: false,
    });
    bcryptCompare.mockResolvedValue(true);

    await service.login(
      { username: 'cb@pc02.local', password: 'correct' } as any,
      META,
    );

    expect(mockAudit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        action: 'USER_2FA_SETUP_REQUIRED',
      }),
    );
  });
});
