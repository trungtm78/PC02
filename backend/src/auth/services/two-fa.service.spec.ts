import { BadRequestException, ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';

jest.mock('otplib', () => ({
  generateSecret: jest.fn().mockReturnValue('JBSWY3DPEHPK3PXP'),
  generateURI: jest.fn().mockReturnValue('otpauth://totp/PC02:user@test.com?secret=JBSWY3DPEHPK3PXP&issuer=PC02'),
  verify: jest.fn().mockResolvedValue({ valid: true }),
  generate: jest.fn().mockResolvedValue('123456'),
}));
jest.mock('qrcode', () => ({ toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,fake') }));

// Minimal mock builder for TwoFaService
function makeUser(overrides: Record<string, any> = {}) {
  return {
    id: 'user-1',
    email: 'user@test.com',
    isActive: true,
    totpEnabled: true,
    totpSetupPending: false,
    totpSetupPendingAt: null,
    totpSecret: 'encrypted:secret:here',
    lastTotpCode: null,
    backupCodes: [],
    backupCodeSalts: [],
    role: { name: 'INVESTIGATOR' },
    tokenVersion: 0,
    refreshTokenHash: null,
    ...overrides,
  };
}

function makeService(userOverride: Record<string, any> = {}, extraMocks: Record<string, any> = {}) {
  const user = makeUser(userOverride);

  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(user),
      update: jest.fn().mockResolvedValue(user),
    },
    $executeRaw: jest.fn().mockResolvedValue(1),
  } as any;

  const encryption = {
    encrypt: jest.fn().mockReturnValue('enc:val:tag'),
    decrypt: jest.fn().mockReturnValue('JBSWY3DPEHPK3PXP'),
  } as any;

  const otpCode = {
    generate: jest.fn().mockResolvedValue('123456'),
    verify: jest.fn().mockResolvedValue(true),
  } as any;

  const emailSvc = {
    sendTwoFaOtp: jest.fn().mockResolvedValue(undefined),
  } as any;

  const audit = { log: jest.fn().mockResolvedValue(undefined) } as any;

  const settings = {
    getValue: jest.fn().mockResolvedValue('false'),
  } as any;

  const jwtService = {
    signAsync: jest.fn().mockResolvedValue('token.jwt.here'),
  } as any;

  const config = {
    get: jest.fn((key: string, fallback?: any) => {
      if (key === 'JWT_PRIVATE_KEY_PATH') return './keys/private.pem';
      if (key === 'JWT_ACCESS_TOKEN_EXPIRES_IN') return '15m';
      if (key === 'JWT_REFRESH_TOKEN_EXPIRES_IN') return '7d';
      return fallback;
    }),
  } as any;

  // Patch fs.readFileSync so we don't need actual key files in tests
  jest.spyOn(require('fs'), 'readFileSync').mockReturnValue('FAKE_PRIVATE_KEY');

  const { TwoFaService } = require('./two-fa.service');
  const svc = new TwoFaService(prisma, jwtService, config, audit, encryption, otpCode, emailSvc, settings);

  return { svc, prisma, encryption, otpCode, emailSvc, audit, settings, jwtService, ...extraMocks };
}

describe('TwoFaService.verify()', () => {
  const meta = { ipAddress: '127.0.0.1', userAgent: 'test' };

  it('totp method: valid code → returns TokenPair and logs USER_2FA_VERIFIED + USER_LOGIN', async () => {
    const { svc, audit } = makeService({ totpEnabled: true });
    const result = await svc.verify('user-1', { code: '123456', method: 'totp' }, meta);
    expect(result).toHaveProperty('accessToken');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'USER_2FA_VERIFIED' }));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'USER_LOGIN' }));
  });

  it('totp method: replayed code (0 rows updated) → throws ForbiddenException', async () => {
    const { svc, prisma } = makeService({ totpEnabled: true });
    prisma.$executeRaw.mockResolvedValue(0);
    await expect(svc.verify('user-1', { code: '123456', method: 'totp' }, meta)).rejects.toThrow(ForbiddenException);
  });

  it('email_otp method: valid OTP → returns TokenPair', async () => {
    const { svc } = makeService({ totpEnabled: false });
    const result = await svc.verify('user-1', { code: '654321', method: 'email_otp' }, meta);
    expect(result).toHaveProperty('accessToken');
  });

  it('email_otp method: wrong OTP → throws 401, logs USER_2FA_FAILED', async () => {
    const { svc, otpCode, audit } = makeService({ totpEnabled: false });
    otpCode.verify.mockResolvedValue(false);
    await expect(svc.verify('user-1', { code: '000000', method: 'email_otp' }, meta)).rejects.toThrow(UnauthorizedException);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'USER_2FA_FAILED' }));
  });

  it('backup method: correct backup code → removes from arrays, returns TokenPair', async () => {
    const salt = 'aabb' + '0'.repeat(28);
    const code = 'abc123def456';
    const hash = crypto.createHash('sha256').update(salt + code).digest('hex');
    const { svc, prisma } = makeService({ backupCodes: [hash], backupCodeSalts: [salt] });
    const result = await svc.verify('user-1', { code, method: 'backup' }, meta);
    expect(result).toHaveProperty('accessToken');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ backupCodes: [], backupCodeSalts: [] }) }),
    );
  });

  it('backup method: wrong code → throws 401, logs USER_2FA_FAILED', async () => {
    const salt = 'aabb' + '0'.repeat(28);
    const hash = crypto.createHash('sha256').update(salt + 'rightcode').digest('hex');
    const { svc, audit } = makeService({ backupCodes: [hash], backupCodeSalts: [salt] });
    await expect(svc.verify('user-1', { code: 'wrongcode', method: 'backup' }, meta)).rejects.toThrow(UnauthorizedException);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'USER_2FA_FAILED' }));
  });
});

describe('TwoFaService.setupTotp()', () => {
  it('throws ConflictException when totpEnabled=true', async () => {
    const { svc } = makeService({ totpEnabled: true });
    await expect(svc.setupTotp('user-1')).rejects.toThrow(ConflictException);
  });

  it('throws ConflictException when pending setup < 24h', async () => {
    const { svc } = makeService({
      totpEnabled: false,
      totpSetupPending: true,
      totpSetupPendingAt: new Date(), // just now
    });
    await expect(svc.setupTotp('user-1')).rejects.toThrow(ConflictException);
  });

  it('resets expired pending setup (> 24h) and allows re-setup', async () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const { svc, prisma } = makeService({
      totpEnabled: false,
      totpSetupPending: true,
      totpSetupPendingAt: old,
    });
    // After reset, findUnique returns fresh user without pending
    prisma.user.findUnique
      .mockResolvedValueOnce(makeUser({ totpEnabled: false, totpSetupPending: true, totpSetupPendingAt: old }))
      .mockResolvedValue(makeUser({ totpEnabled: false, totpSetupPending: false }));

    // Mock QRCode and authenticator
    jest.spyOn(require('qrcode'), 'toDataURL').mockResolvedValue('data:image/png;base64,fake');
    const result = await svc.setupTotp('user-1');
    expect(result).toHaveProperty('qrCodeDataUrl');
    expect(result.backupCodes).toHaveLength(10);
  });
});

describe('TwoFaService.adminResetTwoFa()', () => {
  it('resets all 2FA fields and logs ADMIN_2FA_RESET', async () => {
    const { svc, prisma, audit } = makeService();
    await svc.adminResetTwoFa('user-1', 'admin-1');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totpEnabled: false,
          totpSecret: null,
          backupCodes: [],
        }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'ADMIN_2FA_RESET', subjectId: 'user-1', userId: 'admin-1' }),
    );
  });

  it('throws BadRequestException when user not found', async () => {
    const { svc, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(svc.adminResetTwoFa('nonexistent', 'admin-1')).rejects.toThrow(BadRequestException);
  });
});

describe('TwoFaService.disableTotp()', () => {
  it('throws BadRequestException when TWO_FA_ENABLED=true', async () => {
    const { svc, settings } = makeService();
    settings.getValue.mockResolvedValue('true');
    await expect(svc.disableTotp('user-1')).rejects.toThrow(BadRequestException);
  });

  it('resets TOTP fields when TWO_FA_ENABLED=false', async () => {
    const { svc, prisma } = makeService();
    await svc.disableTotp('user-1');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ totpEnabled: false, totpSecret: null }),
      }),
    );
  });
});
