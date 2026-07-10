/**
 * Lấy JWT qua API và inject vào sessionStorage để bỏ qua bước đăng nhập
 * (dùng cho các clip KHÔNG phải clip "Đăng nhập").
 * App đọc token từ sessionStorage.accessToken — frontend/src/lib/api.ts.
 */
import { APP, ACCOUNTS } from '../guide.config.mjs';

const cache = new Map();

/** Đăng nhập API, trả accessToken. */
export async function getToken(role = 'admin') {
  if (cache.has(role)) return cache.get(role);
  const acc = ACCOUNTS[role] || ACCOUNTS.admin;
  const resp = await fetch(`${APP.apiURL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: acc.username, password: acc.password }),
  });
  if (!resp.ok) throw new Error(`[auth] Login ${acc.username} thất bại: HTTP ${resp.status}`);
  const body = await resp.json();
  const d = body.data || body;
  const token = d.accessToken || d.access_token || d.token || '';
  if (!token) throw new Error('[auth] Không tìm thấy accessToken trong response');
  cache.set(role, token);
  return token;
}

/** Inject token vào page trước khi điều hướng tới màn hình cần quay. */
export async function injectAuth(page, role = 'admin') {
  const token = await getToken(role);
  await page.addInitScript((t) => {
    try {
      sessionStorage.setItem('accessToken', t);
      localStorage.setItem('refreshToken', t);
    } catch (_e) {}
  }, token);
  return token;
}
