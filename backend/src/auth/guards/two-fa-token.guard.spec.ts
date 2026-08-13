import { UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { TwoFaTokenGuard } from './two-fa-token.guard';

const mockJwt = { verify: jest.fn() };
const mockPrisma = { user: { findUnique: jest.fn() } };

// ConfigService thật trỏ vào khoá công khai CÓ TRONG REPO, để constructor
// chạy nguyên vẹn thay vì bị `Object.create` nhảy qua. Giá trị khoá không ảnh
// hưởng gì ở đây (jwtService là mock), nhưng đi qua constructor thì việc đổi
// tên field hay thêm dependency mới lập tức làm spec không biên dịch — đúng
// chỗ mà `(g as any).publicKey = 'FAKE_KEY'` bịt mất.
const realKeyConfig = { get: (_k: string, d?: string) => d ?? './keys/public.pem' };

function makeGuard() {
  return new TwoFaTokenGuard(
    mockJwt as never,
    realKeyConfig as never,
    mockPrisma as never,
  );
}

function makeCtx(headers: Record<string, string> = {}): ExecutionContext {
  const req: any = { headers };
  return { switchToHttp: () => ({ getRequest: () => req }) } as any;
}

describe('TwoFaTokenGuard', () => {
  let guard: TwoFaTokenGuard;

  beforeEach(() => {
    guard = makeGuard();
    jest.clearAllMocks();
  });

  it('rejects missing Authorization header', async () => {
    await expect(guard.canActivate(makeCtx())).rejects.toThrow(/twoFaToken required/);
  });

  it('rejects token with wrong type', async () => {
    mockJwt.verify.mockReturnValue({
      sub: 'u1',
      type: 'change_password_pending',
      jti: 'abc',
      iat: 1,
      exp: 9999,
    });
    await expect(
      guard.canActivate(makeCtx({ authorization: 'Bearer x' })),
    ).rejects.toThrow(/Invalid token type/);
  });

  // Codex review round 2 #B: twoFaToken MUST bind to user.tokenVersion at
  // issue time. Otherwise an admin password reset (which bumps tokenVersion)
  // does not invalidate an in-flight twoFaToken, and the user/attacker can
  // complete 2FA with old credentials and slip through to the forced-change
  // flow without ever knowing the admin's new temp password.
  it('rejects twoFaToken whose tokenVersion is stale (admin reset bumped it)', async () => {
    mockJwt.verify.mockReturnValue({
      sub: 'u1',
      type: '2fa_pending',
      jti: 'abc',
      iat: 1,
      exp: 9999,
      tokenVersion: 3,
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      isActive: true,
      twoFaUsedAt: null,
      tokenVersion: 4, // bumped after token was issued
    });
    await expect(
      guard.canActivate(makeCtx({ authorization: 'Bearer x' })),
    ).rejects.toThrow(/invalidated|superseded|reset/i);
  });

  it('accepts twoFaToken whose tokenVersion matches', async () => {
    mockJwt.verify.mockReturnValue({
      sub: 'u1',
      type: '2fa_pending',
      jti: 'abc',
      iat: 1,
      exp: 9999,
      tokenVersion: 4,
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      isActive: true,
      twoFaUsedAt: null,
      tokenVersion: 4,
    });
    await expect(
      guard.canActivate(makeCtx({ authorization: 'Bearer x' })),
    ).resolves.toBe(true);
  });

  it('rejects legacy twoFaToken without tokenVersion when user.tokenVersion > 0', async () => {
    mockJwt.verify.mockReturnValue({
      sub: 'u1',
      type: '2fa_pending',
      jti: 'abc',
      iat: 1,
      exp: 9999,
      // no tokenVersion field
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      isActive: true,
      twoFaUsedAt: null,
      tokenVersion: 1,
    });
    await expect(
      guard.canActivate(makeCtx({ authorization: 'Bearer x' })),
    ).rejects.toThrow(/invalidated|superseded|reset/i);
  });
});
