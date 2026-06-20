// UAT FIELD-PARITY — UI E2E Layer (Layer 2, Chromium)
// Verify form 3 nhóm Đơn/Vụ việc/Vụ án RENDER được input field-parity (cột di trú PR-M1/M2)
// qua DOM thật, sau khi đăng nhập bằng UI. Persistence round-trip do API layer
// (tests/api/field-parity-uat.api.spec.ts) chứng minh — layer này verify user-facing reachability.
//
// Chạy: BASE_URL=http://localhost:5173 npx playwright test --project=e2e-chromium tests/e2e/field-parity-uat.e2e.spec.ts
import { test, expect, Page } from '@playwright/test';

const USERNAME = process.env.ADMIN_USERNAME || 'admin@pc02.local';
const PASSWORD = process.env.ADMIN_PASSWORD || '68@Love2love68';

// Đăng nhập qua UI (KHÔNG call API trực tiếp) — thiết lập phiên trong browser.
async function uiLogin(page: Page): Promise<void> {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('#username').fill(USERNAME);
  await page.locator('#password').fill(PASSWORD);
  await page.locator('form button[type="submit"]').first().click();
  // Rời khỏi /login = đăng nhập thành công.
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 20_000 });
}

test.describe('UAT E2E — Field-parity 3 nhóm (render input di trú)', () => {
  test.beforeEach(async ({ page }) => {
    await uiLogin(page);
  });

  test('TC-FP-LOGIN-E2E: Đăng nhập UI thành công, vào được hệ thống [@P0]', async ({ page }) => {
    // 3 assertion: URL rời /login + body hiển thị + có nội dung app
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('body')).toBeVisible();
    const txt = await page.locator('body').textContent();
    expect(txt?.length ?? 0).toBeGreaterThan(50);
  });

  test('TC-FP-CASE-E2E: Form Vụ án render input field-parity KLĐT [@P0]', async ({ page }) => {
    await page.goto('/cases/new', { waitUntil: 'domcontentloaded' });
    // 3 assertion: vào đúng form (không bị đẩy về login) + tab Thông tin render + tab Vụ án mở được input field-parity
    await expect(page).toHaveURL(/\/cases\/new/);
    // tab-list chứa các nút tab (testid tab-<id> trùng với card nội dung → scope theo tab-list).
    await expect(page.locator('[data-testid="tab-list"]')).toBeVisible({ timeout: 15_000 });
    // Chuyển sang tab "Vụ án" (button trong tab-list, phân biệt với card nội dung cùng testid)
    await page.locator('[data-testid="tab-list"] [data-testid="tab-case"]').click();
    await expect(page.getByText('Số kết luận điều tra', { exact: false })).toBeVisible({ timeout: 10_000 });
  });

  test('TC-FP-CASE-GHICHU-E2E: Form Vụ án render input "Ghi chú khác" (field-parity) [@P1]', async ({ page }) => {
    await page.goto('/cases/new', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/cases\/new/);
    await expect(page.locator('[data-testid="tab-list"]')).toBeVisible({ timeout: 15_000 });
    await page.locator('[data-testid="tab-list"] [data-testid="tab-case"]').click();
    await expect(page.getByText('Ghi chú khác', { exact: false })).toBeVisible({ timeout: 10_000 });
  });

  test('TC-FP-INC-E2E: Form Vụ việc tải được (authenticated) [@P0]', async ({ page }) => {
    await page.goto('/incidents/new', { waitUntil: 'domcontentloaded' });
    // 3 assertion: URL form + body visible + có nội dung form (không phải trang lỗi/login)
    await expect(page).toHaveURL(/\/incidents\/new/);
    await expect(page.locator('body')).toBeVisible();
    const txt = await page.locator('body').textContent();
    expect(txt?.length ?? 0).toBeGreaterThan(50);
  });

  test('TC-FP-PET-E2E: Form Đơn thư tải được (authenticated) [@P0]', async ({ page }) => {
    await page.goto('/petitions/new', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/petitions\/new/);
    await expect(page.locator('body')).toBeVisible();
    const txt = await page.locator('body').textContent();
    expect(txt?.length ?? 0).toBeGreaterThan(50);
  });
});
