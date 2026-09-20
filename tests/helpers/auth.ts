/**
 * Auth helpers cho E2E tests.
 * App dùng sessionStorage.getItem('accessToken') — frontend/src/lib/api.ts:16
 * Playwright storageState không support sessionStorage → dùng addInitScript/evaluate.
 */
import { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/** Đọc token từ file hoặc env (global-setup đã login) */
export function getAuthToken(): string {
  // Ưu tiên env (set bởi global-setup)
  if (process.env.UAT_TOKEN) return process.env.UAT_TOKEN;
  // Fallback: đọc từ file
  const tokenFile = path.resolve(__dirname, '../../test-results/.auth-token.txt');
  try {
    const t = fs.readFileSync(tokenFile, 'utf-8').trim();
    if (t) return t;
  } catch (_e) {}
  return '';
}

/**
 * Token của MỘT tài khoản thử (officer1, officer2, admin2…) do global-setup đăng nhập sẵn một lần. Ca kiểm dùng hàm này,
 * KHÔNG tự gọi /auth/login: đăng nhập bị giới hạn tần suất, mỗi ca tự đăng nhập là tới ca thứ vài đã nhận 429 và đỏ oan
 * (19/09/2026). Không có token → trả rỗng, ca gọi phải khẳng định có token thay vì bỏ qua lặng lẽ.
 */
export function getTokenTheoTaiKhoan(khoa: string): string {
  const tep = path.resolve(__dirname, `../../test-results/.auth-token-${khoa}.txt`);
  try {
    return fs.readFileSync(tep, 'utf-8').trim();
  } catch (_e) {
    return '';
  }
}

/** Inject token vào sessionStorage + navigate về page */
export async function loginToPage(page: Page, targetPath: string = '/'): Promise<void> {
  const token = getAuthToken();
  if (!token) {
    console.warn('[auth] Không có token — E2E sẽ redirect về /login');
    await page.goto(targetPath, { waitUntil: 'domcontentloaded' });
    return;
  }

  // Trước khi navigate: inject script sẽ chạy ngay khi DOMContentLoaded
  await page.addInitScript((t: string) => {
    try {
      sessionStorage.setItem('accessToken', t);
      localStorage.setItem('refreshToken', t); // backup
    } catch (_e) {}
  }, token);

  /*
    KHÔNG dùng `networkidle`: ứng dụng giữ một kết nối SSE cho Trung tâm thông báo (v0.45) nên
    mạng KHÔNG BAO GIỜ lắng — mỗi lượt gọi ăn trọn 30 giây rồi ném `Test timeout exceeded`, và
    ca kiểm đỏ vì hạ tầng chứ không vì mệnh đề nào sai. Đo 20/09/2026: một bộ 17 ca mất 8,4 phút
    và 14 ca đỏ, tất cả cùng một câu lỗi.

    `domcontentloaded` là mốc đúng: phần chờ thứ gì đã sẵn sàng thuộc về từng ca kiểm, qua
    `expect(...).toBeVisible()` — nó tự thử lại và nêu đích danh thứ không thấy.
  */
  await page.goto(targetPath, { waitUntil: 'domcontentloaded' });

  // Nếu vẫn bị redirect về /login, thử inject lại và reload
  if (page.url().includes('/login')) {
    await page.evaluate((t: string) => {
      sessionStorage.setItem('accessToken', t);
      localStorage.setItem('refreshToken', t);
    }, token);
    await page.goto(targetPath, { waitUntil: 'domcontentloaded' });
  }
}
