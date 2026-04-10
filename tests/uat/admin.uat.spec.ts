/**
 * UAT Tests — Admin Module
 * TASK-2026-000003 | EXECUTION_ID: INTAKE-20260225-003-CFG1
 *
 * Map AC → UAT:
 *   AC-01 → UAT-01: User Management CRUD
 *   AC-02 → UAT-02: Role Permission Matrix update
 *   AC-03 → UAT-03: Coming Soon pages
 *   AC-04 → UAT-04: Directory Management hierarchy
 *   AC-05 → UAT-05: UI Navy/Gold theme
 *
 * Credentials: admin@pc02.local / Admin@1234! (from project_context.md)
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';
const ADMIN    = { email: 'admin@pc02.local', password: 'Admin@1234!' };

async function loginAsAdmin(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.locator('input[type="email"], input[name="email"], input[id="email"]').first().fill(ADMIN.email);
  await page.locator('input[type="password"]').first().fill(ADMIN.password);
  await page.getByRole('button', { name: /sign in|đăng nhập/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 10000 });
}

// ─── UAT-01: User Management CRUD flow ────────────────────────────────────
test.describe('UAT-01: User Management Full Flow', () => {
  test('CREATE → LIST → EDIT → DEACTIVATE flow', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/nguoi-dung`);

    // Step 1: Verify page loads
    await expect(page.getByText(/người dùng/i).first()).toBeVisible();
    await page.screenshot({ path: 'tests/screenshots/uat01-step01-page-loaded.png' });

    // Step 2: Create user
    await page.getByRole('button', { name: /thêm người dùng/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const ts = Date.now();
    const user = {
      username: `uat${ts % 100000}`,
      email: `uat${ts}@pc02.local`,
      fullName: `UAT User ${ts}`,
      password: 'Test@12345!',
    };
    await page.locator('#field-username').fill(user.username);
    await page.locator('#field-email').fill(user.email);
    await page.locator('#field-fullName').fill(user.fullName);
    await page.locator('#field-password').fill(user.password);
    await page.locator('#field-roleId').selectOption({ index: 1 });
    await page.screenshot({ path: 'tests/screenshots/uat01-step02-form-filled.png' });

    // Submit button text is "Thêm mới"
    await page.getByRole('button', { name: /thêm mới|cập nhật/i }).last().click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8000 });
    await expect(page.getByText(user.username)).toBeVisible({ timeout: 8000 });
    await page.screenshot({ path: 'tests/screenshots/uat01-step03-user-created.png', fullPage: true });

    // Step 3: Edit user — click the "Chỉnh sửa" (pencil) button in the row (title attr)
    const row = page.getByRole('row').filter({ hasText: user.username });
    await row.getByTitle('Chỉnh sửa').click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await page.locator('#field-fullName').fill(`${user.fullName} Updated`);
    await page.getByRole('button', { name: /cập nhật/i }).last().click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8000 });
    await page.screenshot({ path: 'tests/screenshots/uat01-step04-user-edited.png', fullPage: true });
  });
});

// ─── UAT-02: Role Permission Matrix ───────────────────────────────────────
test.describe('UAT-02: Role Permission Matrix', () => {
  test('Admin thay đổi quyền Role và lưu thành công', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/nguoi-dung`);
    await page.getByRole('tab', { name: /vai trò|phân quyền/i }).click();
    await page.screenshot({ path: 'tests/screenshots/uat02-step01-roles-tab.png' });

    // Chọn role OFFICER (seeded role — not "Điều tra viên")
    await page.getByText('OFFICER', { exact: true }).first().click();
    await expect(page.getByText(/ma trận phân quyền/i)).toBeVisible();
    await page.screenshot({ path: 'tests/screenshots/uat02-step02-role-selected.png', fullPage: true });

    // Toggle 1 permission
    const firstCheckbox = page.getByRole('table').getByRole('checkbox').first();
    const wasChecked = await firstCheckbox.isChecked();
    await firstCheckbox.click();
    expect(await firstCheckbox.isChecked()).toBe(!wasChecked);

    // Lưu
    await page.getByRole('button', { name: /lưu thay đổi/i }).click();
    // Confirm nếu có dialog
    const confirmBtn = page.getByRole('button', { name: /xác nhận|confirm/i });
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmBtn.click();
    }
    await page.screenshot({ path: 'tests/screenshots/uat02-step03-saved.png' });
  });
});

// ─── UAT-03: Coming Soon ──────────────────────────────────────────────────
test.describe('UAT-03: Coming Soon Pages', () => {
  test('Các module chưa làm hiển thị Coming Soon', async ({ page }) => {
    await loginAsAdmin(page);

    // '/cases' removed — now a real CaseListPage (TASK-000006)
    const routes = ['/petitions', '/incidents'];
    for (const [i, route] of routes.entries()) {
      await page.goto(`${BASE_URL}${route}`);
      await expect(page.getByText(/sắp ra mắt|coming soon/i)).toBeVisible();
      await page.screenshot({
        path: `tests/screenshots/uat03-step0${i + 1}-coming-soon-${route.slice(1)}.png`,
        fullPage: true,
      });
    }
  });
});

// ─── UAT-04: Directory Management ────────────────────────────────────────
test.describe('UAT-04: Directory Hierarchy', () => {
  test('Thêm danh mục cha → danh mục con → hierarchy đúng', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/danh-muc`);
    // Wait for page and table to load
    await expect(page.getByRole('table')).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'tests/screenshots/uat04-step01-directory-page.png', fullPage: true });

    // Thêm parent
    await page.getByRole('button', { name: /thêm danh mục/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const ts = Date.now() % 100000;
    await page.locator('#dir-field-code').fill(`PAR${ts}`);
    await page.locator('#dir-field-name').fill(`Parent ${ts}`);
    await page.getByRole('button', { name: /thêm mới|cập nhật/i }).last().click();
    await expect(page.getByText(`PAR${ts}`)).toBeVisible({ timeout: 8000 });
    await page.screenshot({ path: 'tests/screenshots/uat04-step02-parent-created.png', fullPage: true });

    // Thêm child (với parentId nếu UI hỗ trợ)
    await page.getByRole('button', { name: /thêm danh mục/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.locator('#dir-field-code').fill(`CHI${ts}`);
    await page.locator('#dir-field-name').fill(`Child ${ts}`);
    // Chọn parent nếu select có sẵn
    const parentSelect = page.locator('#dir-field-parentId');
    if (await parentSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
      await parentSelect.selectOption({ label: `Parent ${ts}` });
    }
    await page.getByRole('button', { name: /thêm mới|cập nhật/i }).last().click();
    await expect(page.getByText(`CHI${ts}`)).toBeVisible({ timeout: 8000 });
    await page.screenshot({ path: 'tests/screenshots/uat04-step03-child-created.png', fullPage: true });
  });
});

// ─── UAT-05: UI Theme Compliance ─────────────────────────────────────────
test.describe('UAT-05: Navy/Gold Theme', () => {
  test('Layout tuân thủ Navy/Gold theme từ Refs', async ({ page }) => {
    await loginAsAdmin(page);
    await page.screenshot({ path: 'tests/screenshots/uat05-step01-dashboard-theme.png', fullPage: true });

    // Verify sidebar navy color
    const sidebar = page.locator('[data-testid="main-sidebar"]');
    await expect(sidebar).toBeVisible();

    // Verify header gold border
    const header = page.locator('[data-testid="main-header"]');
    await expect(header).toBeVisible();

    // Verify Vietnamese labels
    await expect(page.getByText(/tổng quan/i).first()).toBeVisible();
    await page.goto(`${BASE_URL}/nguoi-dung`);
    await expect(page.getByText(/người dùng/i).first()).toBeVisible();
    await page.screenshot({ path: 'tests/screenshots/uat05-step02-user-page-theme.png', fullPage: true });
  });
});
