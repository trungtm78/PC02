/**
 * Chốt chặn lỗi "đăng nhập im lặng" (phát hiện 2026-08-24 trên production).
 *
 * Máy chủ trả `{pending:true, twoFaSetupToken, reason:'TWO_FA_SETUP_REQUIRED'}` khi
 * tài khoản mới phải thiết lập 2FA lần đầu. LoginPage cũ chỉ nhận hai nhánh
 * MUST_CHANGE_PASSWORD và twoFaToken → rơi qua cả hai, hàm kết thúc im lặng,
 * HTTP 200 nên cũng không có thông báo lỗi. Người dùng bấm Đăng nhập và
 * KHÔNG CÓ GÌ XẢY RA. Đo trên production: 238/256 tài khoản mang cờ này,
 * KHÔNG MỘT AI từng đăng nhập được.
 *
 * Bài kiểm này tách phần quyết định điều hướng ra khỏi component để kiểm được
 * trực tiếp, và quan trọng nhất: khẳng định KHÔNG có đầu vào nào rơi vào im lặng.
 */
import { describe, it, expect } from 'vitest';
import { resolveLoginRoute, type LoginResponseLike } from '../loginPendingRouting';

describe('resolveLoginRoute', () => {
  it('đăng nhập thành công → vào dashboard kèm cặp token', () => {
    const r = resolveLoginRoute({
      accessToken: 'a',
      refreshToken: 'r',
      expiresIn: '15m',
    });
    expect(r).toEqual({
      kind: 'authenticated',
      accessToken: 'a',
      refreshToken: 'r',
    });
  });

  it('bắt đổi mật khẩu lần đầu → trang đổi mật khẩu', () => {
    const r = resolveLoginRoute({
      pending: true,
      changePasswordToken: 'cpt',
      reason: 'MUST_CHANGE_PASSWORD',
    });
    expect(r).toEqual({
      kind: 'navigate',
      path: '/auth/first-login-change-password',
      state: { changePasswordToken: 'cpt' },
    });
  });

  it('cần nhập mã 2 lớp → trang xác thực', () => {
    const r = resolveLoginRoute({ pending: true, twoFaToken: 'tft' });
    expect(r).toEqual({
      kind: 'navigate',
      path: '/auth/2fa',
      state: { twoFaToken: 'tft' },
    });
  });

  // ── Nhánh từng bị bỏ sót, gây lỗi production ──────────────────────────────
  it('BẮT BUỘC THIẾT LẬP 2 LỚP → trang thiết lập (nhánh từng bị bỏ sót)', () => {
    const r = resolveLoginRoute({
      pending: true,
      twoFaSetupToken: 'st',
      reason: 'TWO_FA_SETUP_REQUIRED',
    });
    expect(r).toEqual({
      kind: 'navigate',
      path: '/auth/2fa-setup',
      state: { twoFaSetupToken: 'st' },
    });
  });

  it('nhận diện theo TRƯỜNG token, không phụ thuộc reason có mặt hay không', () => {
    // Phòng khi máy chủ đổi/bỏ `reason` — trường token mới là bằng chứng thật.
    const r = resolveLoginRoute({ pending: true, twoFaSetupToken: 'st' });
    expect(r).toMatchObject({ kind: 'navigate', path: '/auth/2fa-setup' });
  });

  // ── Chốt chặn lớp lỗi, không chỉ ca lỗi ───────────────────────────────────
  it('hình dạng pending LẠ → báo lỗi rõ ràng, TUYỆT ĐỐI không im lặng', () => {
    const r = resolveLoginRoute({
      pending: true,
      somethingBrandNewToken: 'x',
    } as unknown as LoginResponseLike);
    expect(r.kind).toBe('error');
    if (r.kind === 'error') {
      expect(r.message).toMatch(/không hỗ trợ|cập nhật/i);
    }
  });

  it('phản hồi rỗng/không hiểu được → báo lỗi, không im lặng', () => {
    for (const bad of [{}, null, undefined]) {
      const r = resolveLoginRoute(bad as unknown as LoginResponseLike);
      expect(r.kind).toBe('error');
    }
  });

  it('không đầu vào nào cho ra kết quả rỗng — bất biến chống lỗi im lặng', () => {
    const inputs: unknown[] = [
      { accessToken: 'a', refreshToken: 'r', expiresIn: '1m' },
      { pending: true, changePasswordToken: 'c', reason: 'MUST_CHANGE_PASSWORD' },
      { pending: true, twoFaToken: 't' },
      { pending: true, twoFaSetupToken: 's', reason: 'TWO_FA_SETUP_REQUIRED' },
      { pending: true },
      {},
      null,
      undefined,
      'chuỗi lạ',
      42,
    ];
    for (const input of inputs) {
      const r = resolveLoginRoute(input as LoginResponseLike);
      expect(r, `đầu vào ${JSON.stringify(input)} rơi vào im lặng`).toBeTruthy();
      expect(['authenticated', 'navigate', 'error']).toContain(r.kind);
    }
  });
});
