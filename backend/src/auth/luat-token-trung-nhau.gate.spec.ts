import { UnauthorizedException } from '@nestjs/common';

import { TOKEN_TYPE } from '../common/constants/token-types.constants';
import { SseJwtGuard } from './guards/sse-jwt.guard';
import { JwtStrategy } from './strategies/jwt.strategy';

/**
 * CỔNG: hai nơi đọc CÙNG một hợp đồng token phải nhận CÙNG một bộ hình dạng.
 *
 * `jwt.strategy.ts` canh mọi API thường; `sse-jwt.guard.ts` canh riêng dòng thông báo trực
 * tuyến. Hai bộ luật viết tay ở hai chỗ, và chúng đã TRÔI khỏi nhau: cổng SSE đòi
 * `type === 'access'` trong khi token thật KHÔNG mang trường `type` nào — nên dòng thông báo
 * chưa từng chạy trên máy thật, và không có gì báo.
 *
 * Ca kiểm của cổng SSE vẫn xanh suốt vì nó tự dựng payload CÓ `type: 'access'`, một hình dạng
 * chưa từng tồn tại. Cổng này so HAI bộ luật với nhau nên không dựa vào giả định của bên nào.
 */
describe('luật token của SSE và của API thường phải TRÙNG nhau', () => {
  const NGUOI = { id: 'u1', isActive: true, tokenVersion: 1, role: { name: 'ADMIN' } };

  const HINH_DANG: [string, Record<string, unknown>, boolean][] = [
    ['token truy cập thật (không có `type`)', { sub: 'u1', tokenVersion: 1 }, true],
    ['token khai rõ `access`', { sub: 'u1', tokenVersion: 1, type: TOKEN_TYPE.ACCESS }, true],
    ['token làm mới', { sub: 'u1', tokenVersion: 1, type: TOKEN_TYPE.REFRESH }, false],
    ['token chờ 2FA', { sub: 'u1', tokenVersion: 1, type: '2fa_pending' }, false],
    ['token đổi mật khẩu', { sub: 'u1', tokenVersion: 1, type: 'change_password_pending' }, false],
    ['token sai phiên bản', { sub: 'u1', tokenVersion: 99 }, false],
  ];

  function dungCong(payload: Record<string, unknown>) {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(NGUOI) } };
    const guard = new SseJwtGuard(
      { verify: jest.fn().mockReturnValue(payload) } as never,
      { get: jest.fn().mockReturnValue('./keys/public.pem') } as never,
      prisma as never,
    );
    return guard.canActivate({
      switchToHttp: () => ({ getRequest: () => ({ query: { token: 'x' } }) }),
    } as never);
  }

  function dungChienLuoc(payload: Record<string, unknown>) {
    const prisma = { user: { findUnique: jest.fn().mockResolvedValue(NGUOI) } };
    const st = new JwtStrategy(
      { get: jest.fn().mockReturnValue('./keys/public.pem') } as never,
      prisma as never,
    );
    return st.validate(payload as never);
  }

  it.each(HINH_DANG)('%s → cả hai cùng %s', async (_ten, payload, nhan) => {
    const cong = await dungCong(payload).then(
      () => true,
      (e: unknown) => {
        expect(e).toBeInstanceOf(UnauthorizedException);
        return false;
      },
    );
    const chienLuoc = await dungChienLuoc(payload).then(
      () => true,
      (e: unknown) => {
        expect(e).toBeInstanceOf(UnauthorizedException);
        return false;
      },
    );

    expect({ cong, chienLuoc }).toEqual({ cong: nhan, chienLuoc: nhan });
  });
});
