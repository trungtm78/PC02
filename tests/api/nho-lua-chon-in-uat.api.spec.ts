import { test, expect, request as playwrightRequest, type APIRequestContext } from '@playwright/test';

/**
 * UAT trên MÁY THẬT: lựa chọn in chứng từ được nhớ theo từng tài khoản.
 *
 * ── Vì sao phải chạy trên máy thật ──
 *
 * Ca kiểm thành phần chứng minh popup dựng đúng từ dữ liệu bịa. Nó KHÔNG chứng minh lựa chọn đi
 * được xuống CSDL rồi quay lại — bảng mới, endpoint mới, migration mới, và đường lưu chỉ chạy
 * khi bấm Xuất.
 *
 * ── Không để lại dấu vết ──
 *
 * Bài kiểm GHI thật vào bảng cấu hình của tài khoản quản trị, nên nó luôn xoá sạch ở `afterAll`,
 * kể cả khi có ca đỏ.
 */
const API = process.env.API_BASE ?? 'http://171.244.40.245/api/v1';
const DUONG = '/user-export-preferences';

let ctx: APIRequestContext;
let token = '';
let tokenNguoiKhac = '';

async function dangNhap(u?: string, p?: string): Promise<string> {
  const res = await ctx.post(`${API}/auth/login`, {
    data: { username: u ?? '', password: p ?? '' },
  });
  expect(res.ok(), `đăng nhập thất bại: ${res.status()} ${await res.text()}`).toBeTruthy();
  const body = await res.json();
  return body?.data?.accessToken ?? body?.accessToken ?? '';
}

const auth = (t = token) => ({ Authorization: `Bearer ${t}` });

/** Bóc thân phản hồi ở ĐÚNG MỘT chỗ — máy chủ có thể trả trần hoặc bọc trong `data`. */
async function docLuaChon(t = token): Promise<Record<string, { templateIds: string[]; mode: string }>> {
  const res = await ctx.get(`${API}${DUONG}`, { headers: auth(t) });
  expect(res.ok(), `đọc lựa chọn thất bại: ${res.status()}`).toBeTruthy();
  const body = await res.json();
  return (body?.data ?? body) as Record<string, { templateIds: string[]; mode: string }>;
}

async function ghiLuaChon(thucThe: string, luaChon: unknown, t = token) {
  return ctx.put(`${API}${DUONG}/${thucThe}`, { headers: auth(t), data: { luaChon } });
}

async function xoaLuaChon(thucThe: string, t = token) {
  return ctx.delete(`${API}${DUONG}/${thucThe}`, { headers: auth(t) });
}

test.beforeAll(async () => {
  ctx = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
  token = await dangNhap(process.env.ADMIN_USERNAME, process.env.ADMIN_PASSWORD);
  expect(token, 'không lấy được token quản trị').toBeTruthy();
  if (process.env.OFFICER1_USERNAME && process.env.OFFICER1_PASSWORD) {
    tokenNguoiKhac = await dangNhap(process.env.OFFICER1_USERNAME, process.env.OFFICER1_PASSWORD);
  }
});

test.afterAll(async () => {
  for (const tt of ['DON_THU', 'VU_VIEC', 'VU_AN']) {
    try {
      await xoaLuaChon(tt);
      if (tokenNguoiKhac) await xoaLuaChon(tt, tokenNguoiKhac);
    } catch {
      // Đã ghi ở log runner; không nuốt kết quả bài kiểm.
    }
  }
  await ctx.dispose();
});

test.describe('UAT · nhớ lựa chọn in chứng từ', () => {
  test('UAT-01 · chưa lưu gì thì trả bản đồ rỗng, không lỗi', async () => {
    await xoaLuaChon('DON_THU');
    expect((await docLuaChon())['DON_THU']).toBeUndefined();
  });

  test('UAT-02 · ghi rồi đọc lại đúng tập mẫu và định dạng', async () => {
    const res = await ghiLuaChon('DON_THU', { templateIds: ['abc123', 'def456'], mode: 'zip' });
    expect(res.ok(), `ghi thất bại: ${res.status()} ${await res.text()}`).toBeTruthy();
    expect((await docLuaChon())['DON_THU']).toEqual({
      templateIds: ['abc123', 'def456'],
      mode: 'zip',
    });
  });

  test('UAT-03 · ghi lại thì ĐÈ, không cộng dồn', async () => {
    await ghiLuaChon('DON_THU', { templateIds: ['abc123'], mode: 'merged' });
    expect((await docLuaChon())['DON_THU']).toEqual({ templateIds: ['abc123'], mode: 'merged' });
  });

  /** Bỏ tích hết rồi vẫn xuất là lựa chọn CÓ THẬT — phải ghi được, khác hẳn "chưa từng đặt". */
  test('UAT-04 · lưu được lựa chọn KHÔNG mẫu nào', async () => {
    await ghiLuaChon('DON_THU', { templateIds: [], mode: 'separate' });
    expect((await docLuaChon())['DON_THU']).toEqual({ templateIds: [], mode: 'separate' });
  });

  test('UAT-05 · xoá thì bản ghi biến MẤT hẳn, không thành khối rỗng', async () => {
    await ghiLuaChon('DON_THU', { templateIds: ['abc123'], mode: 'zip' });
    const res = await xoaLuaChon('DON_THU');
    expect(res.ok()).toBeTruthy();
    expect((await docLuaChon())['DON_THU']).toBeUndefined();
  });

  test('UAT-06 · payload méo được chuẩn hoá, không làm hỏng bản ghi', async () => {
    await ghiLuaChon('DON_THU', {
      templateIds: ['abc123', '', 5, 'abc123', 'có khoảng trắng'],
      mode: 'bịa-đặt',
    });
    expect((await docLuaChon())['DON_THU']).toEqual({
      templateIds: ['abc123'],
      mode: 'separate',
    });
  });

  test('UAT-07 · loại hồ sơ lạ bị từ chối', async () => {
    const res = await ghiLuaChon('VU_LINH_TINH', { templateIds: [], mode: 'zip' });
    expect(res.status()).toBe(400);
  });

  /** Ba màn dùng chung popup — mỗi loại hồ sơ một bản ghi riêng, không lẫn sang nhau. */
  test('UAT-08 · ba loại hồ sơ tách bạch', async () => {
    await ghiLuaChon('DON_THU', { templateIds: ['dt1'], mode: 'zip' });
    await ghiLuaChon('VU_VIEC', { templateIds: ['vv1'], mode: 'merged' });
    await ghiLuaChon('VU_AN', { templateIds: ['va1'], mode: 'separate' });
    const ban = await docLuaChon();
    expect(ban['DON_THU']).toEqual({ templateIds: ['dt1'], mode: 'zip' });
    expect(ban['VU_VIEC']).toEqual({ templateIds: ['vv1'], mode: 'merged' });
    expect(ban['VU_AN']).toEqual({ templateIds: ['va1'], mode: 'separate' });
  });

  /**
   * CỔNG QUAN TRỌNG NHẤT: lựa chọn là của RIÊNG từng người. Rò sang người khác nghĩa là cán bộ
   * này thấy cấu hình cán bộ kia — và ghi đè được lên nó.
   */
  test('UAT-09 · KHÔNG rò sang tài khoản khác', async () => {
    test.skip(!tokenNguoiKhac, 'thiếu tài khoản thứ hai trong .env.test');
    await ghiLuaChon('DON_THU', { templateIds: ['chi-cua-admin'], mode: 'zip' });
    const cuaNguoiKhac = await docLuaChon(tokenNguoiKhac);
    expect(cuaNguoiKhac['DON_THU']?.templateIds ?? []).not.toContain('chi-cua-admin');
  });

  test('UAT-10 · không có token thì bị từ chối', async () => {
    const res = await ctx.get(`${API}${DUONG}`);
    expect(res.status()).toBe(401);
  });
});
