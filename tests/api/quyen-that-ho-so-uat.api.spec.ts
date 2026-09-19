import { test, expect } from '@playwright/test';
import { getAuthToken, getTokenTheoTaiKhoan } from '../helpers/auth';

/**
 * UAT tầng API — hồ sơ /auth/me mang QUYỀN THẬT của vai trò (19/09/2026, tồn đọng PR #217). Giao diện ẩn/hiện nút theo
 * danh sách này; trước đó giao diện giả định mọi người có mọi quyền.
 *
 * Oracle (bảng phân quyền đã seed, không từ mã): OFFICER đọc/ghi hồ sơ nghiệp vụ nhưng KHÔNG quản trị người dùng
 * (không có delete:User); ADMIN có quyền quản trị người dùng. Định dạng 'action:subject' như máy chủ so khớp.
 *
 * CHỈ ĐỌC — chạy được trên prod:
 *   UAT_PROD=1 BASE_URL=<gốc> npx playwright test --project=api tests/api/quyen-that-ho-so-uat.api.spec.ts
 */
const API = `${process.env.BASE_URL ?? 'http://localhost:5173'}/api/v1`;

test('Q-1 Cán bộ: hồ sơ có quyền thật — đọc/ghi hồ sơ nghiệp vụ, KHÔNG quản trị người dùng', async ({ request }) => {
  const token = getTokenTheoTaiKhoan('officer1');
  expect(token, 'global-setup phải đăng nhập được officer1').toBeTruthy();
  const r = await request.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  expect(r.status()).toBe(200);
  const hoSo = await r.json();
  const quyen = (hoSo.permissions ?? hoSo.data?.permissions) as string[] | undefined;
  expect(Array.isArray(quyen), 'hồ sơ phải có mảng permissions').toBe(true);
  expect(quyen).toContain('read:Case');
  expect(quyen).not.toContain('delete:User');
  for (const q of quyen ?? []) expect(q).toMatch(/^[a-z_]+:[A-Za-z]+$/);
});

test('Q-2 Quản trị: hồ sơ có quyền quản trị người dùng', async ({ request }) => {
  const r = await request.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${getAuthToken()}` } });
  expect(r.status()).toBe(200);
  const hoSo = await r.json();
  const quyen = (hoSo.permissions ?? hoSo.data?.permissions) as string[] | undefined;
  expect(quyen).toContain('delete:User');
  expect(quyen).toContain('read:Case');
});
