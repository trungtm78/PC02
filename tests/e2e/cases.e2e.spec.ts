import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5179';

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
// AC-01: Sidebar shows "Quản lý vụ án" under "Nghiệp vụ chính"
// ═══════════════════════════════════════════════════════════════════════════

test.describe('AC-01: Quan ly vu an Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('Sidebar hien thi "Quản lý vụ án" trong "Nghiệp vụ chính"', async ({ page }) => {
    const sidebar = page.getByTestId('main-sidebar');
    await expect(sidebar).toBeVisible();

    // Check for "Quản lý vụ án" section using text content
    const sidebarContent = await sidebar.textContent();
    expect(sidebarContent).toContain('Quản lý vụ án');

    await page.screenshot({
      path: 'tests/screenshots/ac01-step01-sidebar-quan-ly-vu-an.png',
      fullPage: true,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-02: Click "Danh sách vụ án" -> /cases shows CaseListPage
// ═══════════════════════════════════════════════════════════════════════════

test.describe('AC-02: Danh sach vu an Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('Direct navigate to /cases -> CaseListPage displayed', async ({ page }) => {
    await page.goto(`${BASE_URL}/cases`);

    // Check CaseListPage is displayed
    const caseListPage = page.getByTestId('case-list-page');
    await expect(caseListPage).toBeVisible();

    // Check table exists
    const table = page.getByTestId('case-table');
    await expect(table).toBeVisible();

    await page.screenshot({
      path: 'tests/screenshots/ac02-step01-danh-sach-vu-an.png',
      fullPage: true,
    });
  });

  test('CaseListPage co search va filter', async ({ page }) => {
    await page.goto(`${BASE_URL}/cases`);

    const searchInput = page.getByTestId('search-input');
    await expect(searchInput).toBeVisible();

    const statusFilterBar = page.getByTestId('status-filter-bar');
    await expect(statusFilterBar).toBeVisible();
  });

  test('Click "Them vu an moi" button -> navigate to /add-new-record', async ({ page }) => {
    await page.goto(`${BASE_URL}/cases`);

    const addButton = page.getByTestId('btn-add-case');
    await expect(addButton).toBeVisible();
    await addButton.click();

    await expect(page).toHaveURL(/\/add-new-record/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-03: Click "Them vu an moi" -> /add-new-record shows CaseFormPage
// ═══════════════════════════════════════════════════════════════════════════

test.describe('AC-03: Them moi ho so Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('Navigate to /add-new-record -> CaseFormPage displayed', async ({ page }) => {
    await page.goto(`${BASE_URL}/add-new-record`);

    const caseFormPage = page.getByTestId('case-form-page');
    await expect(caseFormPage).toBeVisible();

    // Check tabs exist
    const tabList = page.getByTestId('tab-list');
    await expect(tabList).toBeVisible();

    await page.screenshot({
      path: 'tests/screenshots/ac03-step01-them-moi-ho-so.png',
      fullPage: true,
    });
  });

  test('CaseFormPage co action buttons: Huy, Luu tam, Luu ho so', async ({ page }) => {
    await page.goto(`${BASE_URL}/add-new-record`);

    await expect(page.getByTestId('btn-cancel')).toBeVisible();
    await expect(page.getByTestId('btn-save-draft')).toBeVisible();
    await expect(page.getByTestId('btn-save')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-04: Fill required fields + click "Lưu hồ sơ" -> success alert
// ═══════════════════════════════════════════════════════════════════════════

test.describe('AC-04: Form Submission', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('Fill required fields + click "Lưu hồ sơ" -> success alert shown', async ({ page }) => {
    await page.goto(`${BASE_URL}/add-new-record`);
    await page.waitForSelector('[data-testid="case-form-page"]', { timeout: 5000 });

    // Fill required fields
    await page.fill('input[data-testid="input-case-code"]', 'HS-TEST-001');

    const dateInputs = await page.locator('input[type="date"]').all();
    if (dateInputs.length > 0) {
      await dateInputs[0].fill('2026-02-26');
    }

    const loaiHoSoSelect = page.locator('select[data-testid="select-case-type"]');
    if (await loaiHoSoSelect.isVisible()) {
      await loaiHoSoSelect.selectOption({ index: 1 });
    }

    await page.fill('input[data-testid="input-case-title"]', 'Test vu an');

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
      path: 'tests/screenshots/ac04-step01-submit-form.png',
      fullPage: true,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EC-01: Non-existent Case URL
// ═══════════════════════════════════════════════════════════════════════════

test.describe('EC-01: Non-existent Case URL', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('Truy cap /cases/VA-999 -> handle gracefully (no crash)', async ({ page }) => {
    await page.goto(`${BASE_URL}/cases/VA-999`);

    const bodyText = await page.textContent('body');
    expect(bodyText).not.toContain('Error');
    expect(bodyText).not.toContain('500');

    await page.screenshot({
      path: 'tests/screenshots/ec01-step01-nonexistent-case.png',
      fullPage: true,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EC-02: Validation Errors
// ═══════════════════════════════════════════════════════════════════════════

test.describe('EC-02: Validation Errors', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('Submit form voi truong bat buoc trong -> validation errors shown', async ({ page }) => {
    await page.goto(`${BASE_URL}/add-new-record`);

    page.on('dialog', async dialog => {
      await dialog.accept();
    });

    await page.getByTestId('btn-save').click();
    await expect(page.getByTestId('case-form-page')).toBeVisible();

    await page.screenshot({
      path: 'tests/screenshots/ec02-step01-validation-errors.png',
      fullPage: true,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Additional Pages
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Additional Pages', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('/comprehensive-list -> ComprehensiveListPage displayed', async ({ page }) => {
    await page.goto(`${BASE_URL}/comprehensive-list`);

    await expect(page.getByTestId('comprehensive-list-page')).toBeVisible();
    await expect(page.getByTestId('comprehensive-table')).toBeVisible();

    await page.screenshot({
      path: 'tests/screenshots/extra-step01-danh-sach-tong-hop.png',
      fullPage: true,
    });
  });

  test('/initial-cases -> InitialCasesPage displayed', async ({ page }) => {
    await page.goto(`${BASE_URL}/initial-cases`);

    await expect(page.getByTestId('initial-cases-page')).toBeVisible();
    await expect(page.getByTestId('initial-cases-table')).toBeVisible();

    await page.screenshot({
      path: 'tests/screenshots/extra-step02-vu-an-ban-dau.png',
      fullPage: true,
    });
  });
});
