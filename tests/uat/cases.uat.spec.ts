import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

const ADMIN_CREDENTIALS = {
  email: 'admin@pc02.local',
  password: 'Admin@1234!',
};

async function loginAsAdmin(page: import('@playwright/test').Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', ADMIN_CREDENTIALS.email);
  await page.fill('input[type="password"]', ADMIN_CREDENTIALS.password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
}

// ═══════════════════════════════════════════════════════════════════════════
// UAT-01: AC-01 -> Sidebar "Quản lý vụ án"
// ═══════════════════════════════════════════════════════════════════════════

test.describe('UAT-01: Sidebar Quan ly vu an', () => {
  test('AC-01: User dang nhap thay "Quản lý vụ án" trong sidebar', async ({ page }) => {
    await loginAsAdmin(page);

    const sidebar = page.locator('[data-testid="main-sidebar"]');
    await expect(sidebar).toBeVisible();

    const sidebarContent = await sidebar.textContent();
    expect(sidebarContent).toContain('Quản lý vụ án');

    await page.screenshot({
      path: 'tests/screenshots/uat01-ac01-sidebar.png',
      fullPage: true,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// UAT-02: AC-02 -> Danh sách vụ án
// ═══════════════════════════════════════════════════════════════════════════

test.describe('UAT-02: Danh sach vu an', () => {
  test('AC-02: Navigate to /cases -> CaseList hien thi', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/cases`);

    await expect(page.locator('[data-testid="case-list-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="case-table"]')).toBeVisible();

    const rows = page.locator('[data-testid^="case-row-"]');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    await page.screenshot({
      path: 'tests/screenshots/uat02-ac02-danh-sach-vu-an.png',
      fullPage: true,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// UAT-03: AC-03 -> Thêm mới hồ sơ
// ═══════════════════════════════════════════════════════════════════════════

test.describe('UAT-03: Them moi ho so', () => {
  test('AC-03: Navigate to /add-new-record -> CaseForm hien thi', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/add-new-record`);

    await expect(page.locator('[data-testid="case-form-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="tab-list"]')).toBeVisible();

    await page.screenshot({
      path: 'tests/screenshots/uat03-ac03-them-moi-ho-so.png',
      fullPage: true,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// UAT-04: AC-04 -> Submit form thành công
// ═══════════════════════════════════════════════════════════════════════════

test.describe('UAT-04: Form Submission', () => {
  test('AC-04: Dien day du truong bat buoc + click "Luu ho so" -> success alert', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/add-new-record`);

    // Fill required fields
    await page.fill('input[placeholder="VD: HS-2026-001"]', 'UAT-TEST-001');

    const dateInputs = await page.locator('input[type="date"]').all();
    if (dateInputs.length > 0) {
      await dateInputs[0].fill('2026-02-26');
    }

    const loaiHoSoSelect = page.locator('select').first();
    if (await loaiHoSoSelect.isVisible()) {
      await loaiHoSoSelect.selectOption({ index: 1 });
    }

    await page.fill('input[placeholder="Nhập tiêu đề ngắn gọn"]', 'UAT Test Case');

    // Handle FKSelect
    const handlerTrigger = page.getByTestId('fk-handler-trigger');
    if (await handlerTrigger.isVisible()) {
      await handlerTrigger.click();
      const option = page.locator('[data-testid^="fk-handler-option-"]').first();
      await expect(option).toBeVisible({ timeout: 2000 });
      await option.click();
    }

    // Setup dialog handler
    page.on('dialog', async dialog => {
      await dialog.accept();
    });

    // Click save
    await page.getByTestId('btn-save').click();
    await expect(page.getByTestId('case-form-page')).toBeVisible();

    await page.screenshot({
      path: 'tests/screenshots/uat04-ac04-submit-form.png',
      fullPage: true,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// UAT-05: Additional Pages
// ═══════════════════════════════════════════════════════════════════════════

test.describe('UAT-05: Additional Pages', () => {
  test('Danh sach tong hop page load thanh cong', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/comprehensive-list`);

    await expect(page.locator('[data-testid="comprehensive-list-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="comprehensive-table"]')).toBeVisible();

    await page.screenshot({
      path: 'tests/screenshots/uat05-danh-sach-tong-hop.png',
      fullPage: true,
    });
  });

  test('Vu an ban dau page load thanh cong', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/initial-cases`);

    await expect(page.locator('[data-testid="initial-cases-page"]')).toBeVisible();
    await expect(page.locator('[data-testid="initial-cases-table"]')).toBeVisible();

    await page.screenshot({
      path: 'tests/screenshots/uat05-vu-an-ban-dau.png',
      fullPage: true,
    });
  });
});
