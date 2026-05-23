import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

/**
 * Smoke test verify connectivity + credential trước khi chạy full UAT 781 TC.
 * Chạy với: UAT_PROD=1 npx playwright test tests/e2e/_uat_smoke_login.spec.ts
 */
test.describe('UAT Smoke - Verify prod connectivity', () => {
  test('SMOKE-01: ADMIN đăng nhập prod thành công', async ({ page }) => {
    const username = process.env.ADMIN_USERNAME!;
    const password = process.env.ADMIN_PASSWORD!;
    expect(username, 'ADMIN_USERNAME phải có trong .env.test').toBeTruthy();
    expect(password, 'ADMIN_PASSWORD phải có trong .env.test').toBeTruthy();

    const login = new LoginPage(page);
    await login.login(username, password);

    // Verify redirect tới trang được phép sau login
    const url = page.url();
    console.log(`[SMOKE-01] Sau login URL = ${url}`);
    expect(url).toMatch(/\/(dashboard|cases|home|tong-hop)?(\?|$)/);
  });

  test('SMOKE-02: OFFICER đăng nhập prod thành công', async ({ page }) => {
    const username = process.env.OFFICER1_USERNAME!;
    const password = process.env.OFFICER1_PASSWORD!;
    const login = new LoginPage(page);
    await login.login(username, password);
    console.log(`[SMOKE-02] OFFICER login OK, URL = ${page.url()}`);
  });

  test('SMOKE-03: Sai mật khẩu → toast lỗi, không redirect', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    const userInput = page
      .locator('input[type="email"], input[name="username"], input[name="email"], input[type="text"]')
      .first();
    await userInput.fill(process.env.ADMIN_USERNAME!);
    await page.fill('input[type="password"]', 'sai-mat-khau-12345');
    await page.click('button[type="submit"]');
    // Chờ 3s xem có redirect không
    await page.waitForTimeout(3000);
    const finalUrl = page.url();
    console.log(`[SMOKE-03] Sai password, URL = ${finalUrl}`);
    expect(finalUrl).toContain('/login');
  });
});
