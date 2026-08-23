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

  // BUG-011 (QA 2026-08-23): access token THẬT do auth.service phát ra KHÔNG có claim
  // `type` — chỉ refresh và các token chờ mới có. Guard cũ đòi `type === 'access'` nên
  // từ chối mọi token thật: luồng thông báo thời gian thực chưa từng kết nối được, và
  // mỗi lần chuyển trang lại ghi một lỗi 401.
  //
  // Ca kiểm cũ xanh vì nó tự dựng payload có `type:'access'` — một giả định mà token
  // thật không thoả. Ca này dùng ĐÚNG hình dạng payload mà auth.service ký.
  it('BUG-011: chấp nhận access token THẬT (không có claim type)', async () => {
    mockJwt.verify.mockReturnValue({
      sub: 'user-1',
      email: 'a@a.com',
      role: 'ADMIN',
      tokenVersion: 1,
      canDispatch: false,
      // KHÔNG có `type` — đúng như auth.service.ts ký access token
    });
    const ctx = makeCtx();
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it('BUG-011: vẫn từ chối token chờ (2fa_pending) dù không phải refresh', async () => {
    mockJwt.verify.mockReturnValue({
      sub: 'user-1',
      email: 'a@a.com',
      role: 'ADMIN',
      type: '2fa_pending',
      tokenVersion: 1,
    });
    const ctx = makeCtx();
    await expect(guard.canActivate(ctx)).rejects.toThrow();
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
