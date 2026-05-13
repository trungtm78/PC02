import { UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { ChangePasswordPendingGuard } from './change-password-pending.guard';

const mockJwt = {
  verify: jest.fn(),
};
const mockPrisma = {
  user: { findUnique: jest.fn() },
};
const mockConfig = {
  get: jest.fn().mockReturnValue('./keys/public.pem'),
};

function makeGuard() {
  // Bypass constructor (which reads public key file).
  const g = Object.create(ChangePasswordPendingGuard.prototype);
  (g as any).jwtService = mockJwt;
  (g as any).prisma = mockPrisma;
  (g as any).publicKey = 'FAKE_PUBLIC_KEY';
  return g as ChangePasswordPendingGuard;
}

function makeCtx(headers: Record<string, string> = {}): ExecutionContext {
  const req: any = { headers };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as any;
}

describe('ChangePasswordPendingGuard', () => {
  let guard: ChangePasswordPendingGuard;

  beforeEach(() => {
    guard = makeGuard();
    jest.clearAllMocks();
  });

  it('rejects when Authorization header is missing', async () => {
    await expect(guard.canActivate(makeCtx())).rejects.toThrow(UnauthorizedException);
  });

  it('rejects when token cannot be verified (bad signature)', async () => {
    mockJwt.verify.mockImplementation(() => {
      throw new Error('bad sig');
    });
    await expect(
      guard.canActivate(makeCtx({ authorization: 'Bearer bad.token.here' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects when payload.type is not change_password_pending', async () => {
    mockJwt.verify.mockReturnValue({
      sub: 'u1',
      type: '2fa_pending',
      jti: 'abc',
      iat: 1,
      exp: 9999,
    });
    await expect(
      guard.canActivate(makeCtx({ authorization: 'Bearer x' })),
    ).rejects.toThrow(/Invalid token type/);
  });

  it('rejects when user not found or inactive', async () => {
    mockJwt.verify.mockReturnValue({
      sub: 'u1',
      type: 'change_password_pending',
      jti: 'abc',
      iat: 1,
      exp: 9999,
    });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(
      guard.canActivate(makeCtx({ authorization: 'Bearer x' })),
    ).rejects.toThrow(/User not found/);
  });

  // H1: state-derived single-use — token is rejected if mustChangePassword
  // is already false (user already completed the change OR was never flagged).
  it('rejects when user.mustChangePassword=false (state-derived single-use)', async () => {
    mockJwt.verify.mockReturnValue({
      sub: 'u1',
      type: 'change_password_pending',
      jti: 'abc',
      iat: 1,
      exp: 9999,
      tokenVersion: 0,
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      isActive: true,
      mustChangePassword: false,
      tokenVersion: 0,
    });
    await expect(
      guard.canActivate(makeCtx({ authorization: 'Bearer x' })),
    ).rejects.toThrow(/no longer required|already completed/i);
  });

  it('accepts when payload type is correct AND mustChangePassword=true', async () => {
    mockJwt.verify.mockReturnValue({
      sub: 'u1',
      type: 'change_password_pending',
      jti: 'abc',
      iat: 1,
      exp: 9999,
      tokenVersion: 0,
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      isActive: true,
      mustChangePassword: true,
      tokenVersion: 0,
    });
    const ctx = makeCtx({ authorization: 'Bearer good.token' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);

    // req.user must be set so UserThrottlerGuard tracks per-user, not per-IP
    const req = ctx.switchToHttp().getRequest() as any;
    expect(req.user).toEqual(expect.objectContaining({ id: 'u1' }));
  });

  // Codex review round 2 #A: req.user must carry the PAYLOAD's tokenVersion
  // (not the freshly-loaded user's tokenVersion). The service uses this value
  // in the optimistic-lock WHERE clause so a concurrent admin re-reset that
  // bumps tokenVersion between guard and service rejects the older token.
  it('exposes payload.tokenVersion on req.user for the service to use in the optimistic lock', async () => {
    mockJwt.verify.mockReturnValue({
      sub: 'u1',
      type: 'change_password_pending',
      jti: 'abc',
      iat: 1,
      exp: 9999,
      tokenVersion: 7,
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      isActive: true,
      mustChangePassword: true,
      tokenVersion: 7,
    });
    const ctx = makeCtx({ authorization: 'Bearer t' });
    await guard.canActivate(ctx);
    const req = ctx.switchToHttp().getRequest() as any;
    expect(req.user.tokenVersion).toBe(7);
  });

  // Codex challenge #2 fix: token must bind to user.tokenVersion at issue time.
  // After admin re-resets the user (issuing T2 with tokenVersion+1), the
  // earlier T1 (with stale tokenVersion) must be rejected — otherwise it can
  // complete the forced change, clear the flag, and silently invalidate T2.
  it('rejects when payload.tokenVersion is stale (admin re-reset issued newer token)', async () => {
    mockJwt.verify.mockReturnValue({
      sub: 'u1',
      type: 'change_password_pending',
      jti: 'abc',
      iat: 1,
      exp: 9999,
      tokenVersion: 3, // T1 issued when user was at version 3
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      isActive: true,
      mustChangePassword: true,
      tokenVersion: 4, // admin re-reset bumped to 4 → T2 was issued with v=4
    });
    await expect(
      guard.canActivate(makeCtx({ authorization: 'Bearer x' })),
    ).rejects.toThrow(/superseded|invalidated|newer token/i);
  });

  it('treats a payload missing tokenVersion (legacy/buggy issuer) as 0 and rejects when user.tokenVersion > 0', async () => {
    mockJwt.verify.mockReturnValue({
      sub: 'u1',
      type: 'change_password_pending',
      jti: 'abc',
      iat: 1,
      exp: 9999,
      // no tokenVersion field
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      isActive: true,
      mustChangePassword: true,
      tokenVersion: 1,
    });
    await expect(
      guard.canActivate(makeCtx({ authorization: 'Bearer x' })),
    ).rejects.toThrow(/superseded|invalidated|newer token/i);
  });
});
