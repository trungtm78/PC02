import { BadRequestException, ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { TOKEN_TYPE } from '../../common/constants/token-types.constants';

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
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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

  // C2 critical: 2FA verify must re-check mustChangePassword AFTER OTP success.
  // Otherwise a user with both 2FA enabled AND mustChangePassword=true will
  // bypass the forced password change (login returns twoFaToken first,
  // then 2FA verify hands out real tokens with no second gate).
  it('returns changePasswordToken pending instead of TokenPair when mustChangePassword=true (post-OTP)', async () => {
    const { svc, jwtService } = makeService({
      totpEnabled: true,
      mustChangePassword: true,
    });
    jwtService.signAsync.mockResolvedValue('CHANGE_PW_TOKEN');

    const result = await svc.verify('user-1', { code: '123456', method: 'totp' }, meta);

    expect(result).toEqual(
      expect.objectContaining({
        pending: true,
        reason: 'MUST_CHANGE_PASSWORD',
        changePasswordToken: 'CHANGE_PW_TOKEN',
      }),
    );
    expect((result as any).accessToken).toBeUndefined();
  });

  it('audits USER_LOGIN_BLOCKED_PENDING_PASSWORD_CHANGE when blocking post-OTP', async () => {
    const { svc, audit } = makeService({
      totpEnabled: true,
      mustChangePassword: true,
    });
    await svc.verify('user-1', { code: '123456', method: 'totp' }, meta);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'USER_LOGIN_BLOCKED_PENDING_PASSWORD_CHANGE',
      }),
    );
    // USER_LOGIN should NOT have fired (pending response, not full login)
    const allCalls = audit.log.mock.calls.map((c: any[]) => c[0].action);
    expect(allCalls).not.toContain('USER_LOGIN');
  });

  // Codex challenge #7: when blocked on mustChangePassword, lastLoginAt
  // must NOT be updated. The user has not actually logged in — they still
  // have to complete the forced-change page first. firstLoginChangePassword
  // sets lastLoginAt at THAT point.
  it('does NOT update lastLoginAt when mustChangePassword=true (Codex #7)', async () => {
    const { svc, prisma } = makeService({
      totpEnabled: true,
      mustChangePassword: true,
    });
    await svc.verify('user-1', { code: '123456', method: 'totp' }, meta);
    // The single update we expect is the twoFaUsedAt single-use marker —
    // it must NOT carry lastLoginAt for the blocked path.
    const updateCalls = prisma.user.update.mock.calls;
    for (const call of updateCalls) {
      expect(call[0].data.lastLoginAt).toBeUndefined();
    }
  });

  // Audit hygiene: USER_2FA_VERIFIED must indicate when login is still
  // pending the forced-change so compliance can distinguish "fully logged
  // in" from "passed 2FA but blocked on change-pw".
  it('USER_2FA_VERIFIED metadata flags blockedPendingChange=true on the blocked path', async () => {
    const { svc, audit } = makeService({
      totpEnabled: true,
      mustChangePassword: true,
    });
    await svc.verify('user-1', { code: '123456', method: 'totp' }, meta);
    const verifiedCall = audit.log.mock.calls.find(
      (c: any[]) => c[0].action === 'USER_2FA_VERIFIED',
    );
    expect(verifiedCall).toBeDefined();
    expect(verifiedCall[0].metadata).toEqual(
      expect.objectContaining({ blockedPendingChange: true }),
    );
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
    const code = 'abc123def456';
    const hash = bcrypt.hashSync(code, 4); // cost 4 for test speed; prod uses 12
    const { svc, prisma } = makeService({ backupCodes: [hash], backupCodeSalts: [''] });
    const result = await svc.verify('user-1', { code, method: 'backup' }, meta);
    expect(result).toHaveProperty('accessToken');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ backupCodes: [], backupCodeSalts: [] }) }),
    );
  });

  it('backup method: wrong code → throws 401, logs USER_2FA_FAILED', async () => {
    const hash = bcrypt.hashSync('rightcode', 4);
    const { svc, audit } = makeService({ backupCodes: [hash], backupCodeSalts: [''] });
    await expect(svc.verify('user-1', { code: 'wrongcode', method: 'backup' }, meta)).rejects.toThrow(UnauthorizedException);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'USER_2FA_FAILED' }));
  });

  it('backup method: mixed array (legacy sha256 + bcrypt) → only bcrypt entry can match', async () => {
    // Simulates the transient state where pre-migration sha256 entries coexist
    // with newly issued bcrypt codes (e.g., admin manually re-seeded one entry).
    const code = 'realcode1234';
    const bcryptHash = bcrypt.hashSync(code, 4);
    const legacyHash = 'a'.repeat(64); // 64-char hex, no $2 prefix
    const { svc } = makeService({
      backupCodes: [legacyHash, bcryptHash],
      backupCodeSalts: ['', ''],
    });
    const result = await svc.verify('user-1', { code, method: 'backup' }, meta);
    expect(result).toHaveProperty('accessToken');
  });

  it('backup method: all-legacy array (mid-migration / post-invalidation) → always 401', async () => {
    // Post-deploy-pre-migration state, or post-migration if someone re-introduces
    // sha256 entries by hand. Legacy entries must never match bcrypt.compare.
    const { svc, audit } = makeService({
      backupCodes: ['b'.repeat(64), 'c'.repeat(64), 'd'.repeat(64)],
      backupCodeSalts: ['', '', ''],
    });
    await expect(
      svc.verify('user-1', { code: 'whateverlegacycode', method: 'backup' }, meta),
    ).rejects.toThrow(UnauthorizedException);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'USER_2FA_FAILED' }));
  });

  it('backup method: empty array → returns 401 without bcrypt comparisons', async () => {
    const { svc, audit } = makeService({ backupCodes: [], backupCodeSalts: [] });
    await expect(
      svc.verify('user-1', { code: 'anycode', method: 'backup' }, meta),
    ).rejects.toThrow(UnauthorizedException);
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

  it('P3-002: resets TOTP fields when user totpEnabled=false (idempotent, no code needed)', async () => {
    const { svc, prisma } = makeService();
    // Simulate user that already has 2FA disabled — disable should be no-op without code
    prisma.user.findUnique.mockResolvedValue({ totpEnabled: false, totpSecret: null, lastTotpCode: null });
    await svc.disableTotp('user-1');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ totpEnabled: false, totpSecret: null }),
      }),
    );
  });

  it('P3-002: rejects disable when totpEnabled=true and currentTotpCode missing', async () => {
    const { svc, prisma } = makeService();
    prisma.user.findUnique.mockResolvedValue({
      totpEnabled: true,
      totpSecret: 'encrypted-secret',
      lastTotpCode: null,
    });
    await expect(svc.disableTotp('user-1')).rejects.toThrow('Vui lòng nhập mã TOTP hiện tại');
  });
});

// ── Đối xứng cổng chặn đổi mật khẩu giữa hai đường hoàn tất đăng nhập ────────
//
// `verify()` đã có cổng C2 (kiểm mustChangePassword SAU khi OTP đúng). Đường
// song song `completeInitialSetup()` — dùng cho tài khoản MỚI phải thiết lập 2FA
// lần đầu — lại thiếu cổng đó. Tài khoản do quản trị tạo mang ĐỒNG THỜI
// mustChangePassword=true và twoFaSetupRequired=true, nên đúng đường đó bị hở:
// thiết lập 2FA xong là có phiên đầy đủ, mật khẩu tạm (đang là SỐ ĐIỆN THOẠI)
// không bao giờ bị bắt đổi.
describe('TwoFaService.completeInitialSetup() — cổng đổi mật khẩu', () => {
  const meta = { ipAddress: '127.0.0.1', userAgent: 'test' };

  it('mustChangePassword=false → trả cặp token thật, hoàn tất đăng nhập', async () => {
    const { svc } = makeService({
      totpEnabled: false,
      totpSetupPending: true,
      totpSetupPendingAt: new Date(),
      mustChangePassword: false,
    });
    const result = await svc.completeInitialSetup('user-1', '123456', meta);
    expect(result).toHaveProperty('accessToken');
  });

  it('mustChangePassword=true → KHÔNG trả cặp token, trả token đổi mật khẩu', async () => {
    const { svc, jwtService } = makeService({
      totpEnabled: false,
      totpSetupPending: true,
      totpSetupPendingAt: new Date(),
      mustChangePassword: true,
    });
    jwtService.signAsync.mockResolvedValue('CHANGE_PW_TOKEN');

    const result = await svc.completeInitialSetup('user-1', '123456', meta);

    expect(result).toEqual(
      expect.objectContaining({
        pending: true,
        changePasswordToken: 'CHANGE_PW_TOKEN',
        reason: 'MUST_CHANGE_PASSWORD',
      }),
    );
    expect(result).not.toHaveProperty('accessToken');
  });

  it('vẫn xoá cờ twoFaSetupRequired kể cả khi còn phải đổi mật khẩu', async () => {
    const { svc, prisma } = makeService({
      totpEnabled: false,
      totpSetupPending: true,
      totpSetupPendingAt: new Date(),
      mustChangePassword: true,
    });
    await svc.completeInitialSetup('user-1', '123456', meta);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ twoFaSetupRequired: false }),
      }),
    );
  });

  // Ca kiểm CHẾT CÙNG cổng chặn. Ba ca trên vẫn xanh nếu vô hiệu hoá cổng
  // (`if (user.mustChangePassword && false)`) — đã đo. Ca này thì không: nó
  // khẳng định KHÔNG có token truy cập nào được ký, tức cổng thật sự chặn chứ
  // không chỉ "có trả về thứ gì đó".
  it('KHÔNG ký bất kỳ token truy cập nào khi còn phải đổi mật khẩu', async () => {
    const { svc, jwtService } = makeService({
      totpEnabled: false,
      totpSetupPending: true,
      totpSetupPendingAt: new Date(),
      mustChangePassword: true,
    });
    await svc.completeInitialSetup('user-1', '123456', meta);
    const signedTypes = jwtService.signAsync.mock.calls.map(
      (c: unknown[]) => (c[0] as { type?: string }).type,
    );
    // Đúng MỘT chữ ký, và là token chờ đổi mật khẩu — không access, không refresh.
    expect(signedTypes).toEqual([TOKEN_TYPE.CHANGE_PASSWORD_PENDING]);
  });

  it('mã TOTP sai → ném lỗi, KHÔNG xoá cờ, KHÔNG ký token nào', async () => {
    const { svc, prisma, jwtService } = makeService({
      totpEnabled: false,
      totpSetupPending: true,
      totpSetupPendingAt: new Date(),
    });
    // Mã sai: chặn ở verifySetup, mọi bước sau KHÔNG được chạy.
    require('otplib').verify.mockResolvedValueOnce({ valid: false });

    await expect(svc.completeInitialSetup('user-1', '000000', meta)).rejects.toThrow();

    expect(prisma.user.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ twoFaSetupRequired: false }),
      }),
    );
    expect(jwtService.signAsync).not.toHaveBeenCalled();
  });
});

// ── Đường thiết lập lần đầu phải LẶP LẠI ĐƯỢC ────────────────────────────────
//
// setupTotp() ném 409 "đang chờ xác nhận" nếu totpSetupPending còn dưới 24 giờ.
// Ở đường TỰ PHỤC VỤ điều đó hợp lý — người dùng đã đăng nhập, quay lại trang
// cài đặt lúc nào cũng được. Ở đường THIẾT LẬP LẦN ĐẦU thì không: người dùng
// CHƯA vào được hệ thống, thiết lập 2FA là cửa duy nhất. Một lần tải lại trang
// (hoặc mở tab thứ hai, hoặc token 15 phút hết hạn rồi đăng nhập lại) sẽ khoá
// tài khoản 24 giờ và không còn đường nào đi tiếp — đúng loại bế tắc mà bản vá
// này sinh ra để xoá, chỉ dời sang màn kế tiếp.
describe('TwoFaService.initialSetup() — phải lặp lại được', () => {
  it('đang chờ xác nhận mà gọi lại → cấp mã QR MỚI, KHÔNG ném 409', async () => {
    const { svc } = makeService({
      totpEnabled: false,
      totpSetupPending: true,
      totpSetupPendingAt: new Date(), // vừa mới, còn xa mốc 24 giờ
    });
    const result = await svc.initialSetup('user-1');
    expect(result).toHaveProperty('qrCodeDataUrl');
    expect(result.backupCodes.length).toBeGreaterThan(0);
  });

  it('dọn trạng thái chờ trước khi cấp lại', async () => {
    const { svc, prisma } = makeService({
      totpEnabled: false,
      totpSetupPending: true,
      totpSetupPendingAt: new Date(),
    });
    await svc.initialSetup('user-1');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ totpSetupPending: false, totpSecret: null }),
      }),
    );
  });

  it('đường TỰ PHỤC VỤ vẫn giữ cổng 409 — chỉ đường lần đầu mới được cấp lại', async () => {
    const { svc } = makeService({
      totpEnabled: false,
      totpSetupPending: true,
      totpSetupPendingAt: new Date(),
    });
    await expect(svc.setupTotp('user-1')).rejects.toThrow('Setup đang chờ xác nhận');
  });

  it('2FA đã bật thì vẫn từ chối — không cho cấp lại đè lên bí mật đang dùng', async () => {
    const { svc } = makeService({ totpEnabled: true });
    await expect(svc.initialSetup('user-1')).rejects.toThrow('2FA đã được kích hoạt');
  });
});

// ── Sổ đăng nhập của đường thiết lập lần đầu ─────────────────────────────────
//
// verify() ghi USER_LOGIN và đặt lastLoginAt khi đăng nhập hoàn tất.
// completeInitialSetup() thì không — nên phiên tạo qua đường này vô hình với
// mọi truy vấn tuân thủ. Đáng nói: chính lastLoginAt là bằng chứng dùng để đo
// ra lỗi 238 tài khoản (0 tài khoản nào có lastLoginAt). Thiếu nó ở đây thì
// phép đo ấy mù đúng vào đường vừa được sửa.
describe('TwoFaService.completeInitialSetup() — sổ đăng nhập', () => {
  const meta = { ipAddress: '127.0.0.1', userAgent: 'test' };

  it('đăng nhập hoàn tất → ghi USER_LOGIN và đặt lastLoginAt', async () => {
    const { svc, audit, prisma } = makeService({
      totpEnabled: false,
      totpSetupPending: true,
      totpSetupPendingAt: new Date(),
      mustChangePassword: false,
    });
    await svc.completeInitialSetup('user-1', '123456', meta);
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'USER_LOGIN' }));
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastLoginAt: expect.any(Date) }),
      }),
    );
  });

  it('tài khoản bị khoá giữa chừng → từ chối, không phát hành token', async () => {
    const { svc } = makeService({
      totpEnabled: false,
      totpSetupPending: true,
      totpSetupPendingAt: new Date(),
      isActive: false,
    });
    await expect(svc.completeInitialSetup('user-1', '123456', meta)).rejects.toThrow();
  });
});
