import { UnauthorizedException, ExecutionContext } from '@nestjs/common';
import { TwoFaSetupTokenGuard } from './two-fa-setup-token.guard';
import { TOKEN_TYPE } from '../../common/constants/token-types.constants';

/**
 * Cổng gác cho token thiết lập 2 lớp lần đầu.
 *
 * VÌ SAO GIỜ MỚI CÓ CA KIỂM: hai endpoint sau cổng này (`/initial-setup` và
 * `/initial-setup/verify`) trước đây KHÔNG có gì gọi tới — giao diện chưa từng
 * được xây. Bản vá 2026-08-24 làm chúng chạy thật lần đầu, nên cổng này trở
 * thành thứ duy nhất đứng giữa một token mang trên tay và việc bật TOTP rồi
 * phát hành cặp token đăng nhập.
 *
 * NGUYÊN TẮC DỰNG DỮ LIỆU: payload phải dựng theo ĐÚNG hình dạng mà
 * `auth.service.ts` ký thật, không tự bịa. Dự án từng trả giá đúng chỗ này —
 * ca kiểm của guard SSE tự dựng payload có `type:'access'`, một claim mà access
 * token thật KHÔNG BAO GIỜ mang, nên ca kiểm xanh suốt trong khi tính năng hỏng
 * từ v0.45. Hai hằng dưới đây chép nguyên hình dạng từ `auth.service.ts`.
 */

/** Hình dạng auth.service.ts ký cho token thiết lập (auth.service.ts:182-190). */
const REAL_SETUP_PAYLOAD = {
  sub: 'u1',
  type: TOKEN_TYPE.TWO_FA_SETUP_PENDING,
  jti: 'jti-1',
  tokenVersion: 0,
};

/**
 * Hình dạng access token THẬT (auth.service.ts): `{sub,email,role,tokenVersion,
 * canDispatch}` — KHÔNG có claim `type`. Đây chính là chi tiết đã hạ gục guard
 * SSE, nên phải có ca kiểm riêng.
 */
const REAL_ACCESS_PAYLOAD = {
  sub: 'u1',
  email: 'a@b.c',
  role: 'OFFICER',
  tokenVersion: 0,
  canDispatch: false,
};

const mockJwt = { verify: jest.fn() };
const mockPrisma = { user: { findUnique: jest.fn() } };

function makeGuard(): TwoFaSetupTokenGuard {
  const g = Object.create(TwoFaSetupTokenGuard.prototype);
  (g as any).jwtService = mockJwt;
  (g as any).prisma = mockPrisma;
  (g as any).publicKey = 'FAKE_KEY';
  return g as TwoFaSetupTokenGuard;
}

function makeCtx(headers: Record<string, string> = {}): { ctx: ExecutionContext; req: any } {
  const req: any = { headers };
  return {
    ctx: { switchToHttp: () => ({ getRequest: () => req }) } as any,
    req,
  };
}

const ACTIVE_USER = { id: 'u1', isActive: true, tokenVersion: 0 };

describe('TwoFaSetupTokenGuard', () => {
  let guard: TwoFaSetupTokenGuard;

  beforeEach(() => {
    guard = makeGuard();
    jest.clearAllMocks();
  });

  it('cho qua token thiết lập ĐÚNG HÌNH DẠNG auth.service ký, và gắn userId vào request', async () => {
    mockJwt.verify.mockReturnValue({ ...REAL_SETUP_PAYLOAD });
    mockPrisma.user.findUnique.mockResolvedValue(ACTIVE_USER);

    const { ctx, req } = makeCtx({ authorization: 'Bearer real' });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.twoFaSetupUserId).toBe('u1');
    expect(req.user).toEqual({ id: 'u1' });
  });

  it('từ chối khi thiếu tiêu đề Authorization', async () => {
    await expect(guard.canActivate(makeCtx().ctx)).rejects.toThrow(/twoFaSetupToken required/);
  });

  it('từ chối khi chữ ký không hợp lệ hoặc token hết hạn', async () => {
    mockJwt.verify.mockImplementation(() => {
      throw new Error('jwt expired');
    });
    await expect(
      guard.canActivate(makeCtx({ authorization: 'Bearer x' }).ctx),
    ).rejects.toThrow(/Invalid or expired twoFaSetupToken/);
  });

  // Ca kiểm QUAN TRỌNG NHẤT: access token thật không mang claim `type`.
  it('từ chối ACCESS TOKEN THẬT (không có claim type) — không được nhận nhầm', async () => {
    mockJwt.verify.mockReturnValue({ ...REAL_ACCESS_PAYLOAD });
    await expect(
      guard.canActivate(makeCtx({ authorization: 'Bearer access' }).ctx),
    ).rejects.toThrow(/Invalid token type/);
    // Chặn ngay ở kiểm kiểu, không đi tới tầng dữ liệu.
    expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('từ chối token 2 lớp thường (2fa_pending) — khác loại, khác quyền', async () => {
    mockJwt.verify.mockReturnValue({
      ...REAL_SETUP_PAYLOAD,
      type: TOKEN_TYPE.TWO_FA_PENDING,
    });
    await expect(
      guard.canActivate(makeCtx({ authorization: 'Bearer x' }).ctx),
    ).rejects.toThrow(/Invalid token type/);
  });

  it('từ chối token chờ đổi mật khẩu — không được dùng chéo cổng', async () => {
    mockJwt.verify.mockReturnValue({
      ...REAL_SETUP_PAYLOAD,
      type: TOKEN_TYPE.CHANGE_PASSWORD_PENDING,
    });
    await expect(
      guard.canActivate(makeCtx({ authorization: 'Bearer x' }).ctx),
    ).rejects.toThrow(/Invalid token type/);
  });

  it('từ chối token thiếu claim jti', async () => {
    const { jti, ...noJti } = REAL_SETUP_PAYLOAD;
    mockJwt.verify.mockReturnValue(noJti);
    await expect(
      guard.canActivate(makeCtx({ authorization: 'Bearer x' }).ctx),
    ).rejects.toThrow(/Missing jti claim/);
  });

  it('từ chối khi tài khoản đã bị vô hiệu hoá', async () => {
    mockJwt.verify.mockReturnValue({ ...REAL_SETUP_PAYLOAD });
    mockPrisma.user.findUnique.mockResolvedValue({ ...ACTIVE_USER, isActive: false });
    await expect(
      guard.canActivate(makeCtx({ authorization: 'Bearer x' }).ctx),
    ).rejects.toThrow(/User not found or inactive/);
  });

  it('từ chối khi tài khoản không còn tồn tại', async () => {
    mockJwt.verify.mockReturnValue({ ...REAL_SETUP_PAYLOAD });
    mockPrisma.user.findUnique.mockResolvedValue(null);
    await expect(
      guard.canActivate(makeCtx({ authorization: 'Bearer x' }).ctx),
    ).rejects.toThrow(/User not found or inactive/);
  });

  // Quản trị đặt lại mật khẩu sẽ tăng tokenVersion. Token thiết lập đang bay
  // phải chết theo, nếu không người cầm mật khẩu cũ vẫn đi tiếp được.
  it('từ chối token có tokenVersion cũ (quản trị vừa đặt lại mật khẩu)', async () => {
    mockJwt.verify.mockReturnValue({ ...REAL_SETUP_PAYLOAD, tokenVersion: 0 });
    mockPrisma.user.findUnique.mockResolvedValue({ ...ACTIVE_USER, tokenVersion: 1 });
    await expect(
      guard.canActivate(makeCtx({ authorization: 'Bearer x' }).ctx),
    ).rejects.toThrow(/invalidated by admin reset/);
  });

  it('token thiếu hẳn tokenVersion không được coi là khớp phiên bản khác 0', async () => {
    const { tokenVersion, ...noVersion } = REAL_SETUP_PAYLOAD;
    mockJwt.verify.mockReturnValue(noVersion);
    mockPrisma.user.findUnique.mockResolvedValue({ ...ACTIVE_USER, tokenVersion: 2 });
    await expect(
      guard.canActivate(makeCtx({ authorization: 'Bearer x' }).ctx),
    ).rejects.toThrow(/invalidated by admin reset/);
  });

  it('mọi lối từ chối đều là UnauthorizedException, không rò lỗi nội bộ', async () => {
    mockJwt.verify.mockReturnValue({ ...REAL_ACCESS_PAYLOAD });
    await expect(
      guard.canActivate(makeCtx({ authorization: 'Bearer x' }).ctx),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
