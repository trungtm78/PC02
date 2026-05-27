import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SseJwtGuard } from './sse-jwt.guard';

// Minimal mock — we don't use ConfigService.get's actual value because
// readFileSync is also mocked below.
jest.mock('fs', () => ({
  readFileSync: jest.fn().mockReturnValue('FAKE_PEM'),
}));
jest.mock('path', () => ({
  resolve: jest.fn((...args: string[]) => args.join('/')),
}));

const mockJwt = { verify: jest.fn() };
const mockConfig = { get: jest.fn().mockReturnValue('./keys/public.pem') };
const mockPrisma = { user: { findUnique: jest.fn() } };

function makeCtx(query: Record<string, string> = { token: 'valid-token' }): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ query, user: undefined } as any),
    }),
  } as unknown as ExecutionContext;
}

describe('SseJwtGuard (C4 fix)', () => {
  let guard: SseJwtGuard;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default: valid access token + active user with matching tokenVersion
    mockJwt.verify.mockReturnValue({
      sub: 'user-1',
      email: 'a@a.com',
      role: 'INVESTIGATOR',
      type: 'access',
      tokenVersion: 1,
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      isActive: true,
      tokenVersion: 1,
    });

    guard = new SseJwtGuard(
      mockJwt as unknown as JwtService,
      mockConfig as unknown as ConfigService,
      mockPrisma as any,
    );
  });

  it('allows access when token is valid access token with matching tokenVersion', async () => {
    const ctx = makeCtx();
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('rejects refresh tokens (should only accept access tokens)', async () => {
    mockJwt.verify.mockReturnValue({
      sub: 'user-1',
      type: 'refresh',
      tokenVersion: 1,
    });

    const ctx = makeCtx();
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects 2FA-pending tokens', async () => {
    mockJwt.verify.mockReturnValue({
      sub: 'user-1',
      type: '2fa_pending',
      tokenVersion: 1,
    });

    const ctx = makeCtx();
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects tokens for inactive users', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      isActive: false,
      tokenVersion: 1,
    });

    const ctx = makeCtx();
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects tokens when user not found', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const ctx = makeCtx();
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects tokens with wrong tokenVersion (password changed)', async () => {
    mockJwt.verify.mockReturnValue({
      sub: 'user-1',
      type: 'access',
      tokenVersion: 0, // old token, user now has tokenVersion=1
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      isActive: true,
      tokenVersion: 1,
    });

    const ctx = makeCtx();
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects missing token in query', async () => {
    const ctx = makeCtx({});
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});
