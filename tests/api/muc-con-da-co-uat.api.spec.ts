import { test, expect, type APIRequestContext } from '@playwright/test';
import { getAuthToken } from '../helpers/auth';

/**
 * UAT tầng API — hai điểm cuối CHỈ ĐỌC mà form sửa vụ án dùng để hiện mục con ĐÃ CÓ (PR #430, 19/09/2026):
 * GET /cases/:id/subjects và GET /cases/:id/evidences.
 *
 * Oracle (luật phân quyền, không từ mã): ai được xem vụ án thì đọc được mục con của nó; ai KHÔNG được xem chi tiết
 * vụ án (GET /cases/:id → 403) thì cũng không đọc được mục con → 403. Danh sách đối tượng phải ĐỦ — khớp số đối
 * tượng của vụ án theo GET /subjects?caseId (lấy `total`), không cắt ở 100.
 *
 * CHỈ ĐỌC — chạy được trên prod:
 *   UAT_PROD=1 UAT_OFFICER_PASS=<mật khẩu officer1> BASE_URL=<gốc> npx playwright test --project=api \
 *     tests/api/muc-con-da-co-uat.api.spec.ts
 */
const API = `${process.env.BASE_URL ?? 'http://localhost:5173'}/api/v1`;
const OFFICER = process.env.UAT_OFFICER_USER ?? 'officer1@pc02.local';
const admin = () => ({ Authorization: `Bearer ${getAuthToken()}` });

async function dangNhapCanBo(request: APIRequestContext): Promise<Record<string, string>> {
  const matKhau = process.env.UAT_OFFICER_PASS;
  expect(matKhau, 'thiếu UAT_OFFICER_PASS — ca này không được bỏ qua lặng lẽ').toBeTruthy();
  const r = await request.post(`${API}/auth/login`, { data: { username: OFFICER, password: matKhau } });
  expect(r.status()).toBeLessThan(300);
  const b = await r.json();
  return { Authorization: `Bearer ${b.accessToken ?? b.data?.accessToken}` };
}

test('M-1 Quản trị đọc được đủ đối tượng + vật chứng của vụ án', async ({ request }) => {
  const ds = await request.get(`${API}/cases?limit=50`, { headers: admin() });
  expect(ds.status()).toBe(200);
  let daKiem = 0;
  for (const c of ((await ds.json()).data ?? []) as Array<{ id: string }>) {
    const tong = await request.get(`${API}/subjects?caseId=${c.id}&limit=1`, { headers: admin() });
    const soDoiTuong = (await tong.json()).total as number;
    if (!soDoiTuong) continue;
    const r = await request.get(`${API}/cases/${c.id}/subjects`, { headers: admin() });
    expect(r.status()).toBe(200);
    expect(((await r.json()).data as unknown[]).length, `vụ án ${c.id}`).toBe(soDoiTuong);
    const vc = await request.get(`${API}/cases/${c.id}/evidences`, { headers: admin() });
    expect(vc.status()).toBe(200);
    expect(Array.isArray((await vc.json()).data)).toBe(true);
    if (++daKiem >= 3) break;
  }
  expect(daKiem, 'phải có vụ án có đối tượng để đo').toBeGreaterThan(0);
});

test('M-2 Cán bộ KHÔNG đọc được mục con của vụ án ngoài phạm vi (403)', async ({ request }) => {
  const canBo = await dangNhapCanBo(request);
  const ds = await request.get(`${API}/cases?limit=50`, { headers: admin() });
  let caseId: string | undefined;
  for (const c of ((await ds.json()).data ?? []) as Array<{ id: string }>) {
    if ((await request.get(`${API}/cases/${c.id}`, { headers: canBo })).status() === 403) {
      caseId = c.id;
      break;
    }
  }
  expect(caseId, 'cần một vụ án ngoài phạm vi của cán bộ').toBeTruthy();
  expect((await request.get(`${API}/cases/${caseId}/subjects`, { headers: canBo })).status()).toBe(403);
  expect((await request.get(`${API}/cases/${caseId}/evidences`, { headers: canBo })).status()).toBe(403);
});
