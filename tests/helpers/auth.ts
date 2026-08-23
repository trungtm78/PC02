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

/** Inject token vào sessionStorage + navigate về page */
export async function loginToPage(page: Page, targetPath: string = '/'): Promise<void> {
  const token = getAuthToken();
  if (!token) {
    console.warn('[auth] Không có token — E2E sẽ redirect về /login');
    await page.goto(targetPath);
    return;
  }

  // Trước khi navigate: inject script sẽ chạy ngay khi DOMContentLoaded
  await page.addInitScript((t: string) => {
    try {
      sessionStorage.setItem('accessToken', t);
      localStorage.setItem('refreshToken', t); // backup
    } catch (_e) {}
  }, token);

  await page.goto(targetPath);
  await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});

  // Nếu vẫn bị redirect về /login, thử inject lại và reload
  if (page.url().includes('/login')) {
    await page.evaluate((t: string) => {
      sessionStorage.setItem('accessToken', t);
      localStorage.setItem('refreshToken', t);
    }, token);
    await page.goto(targetPath);
    await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
  }
}
