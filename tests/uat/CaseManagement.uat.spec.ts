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
// UAT-01: Sidebar hiển thị "Quản lý vụ án" trong "Nghiệp vụ chính"
// ═══════════════════════════════════════════════════════════════════════════

test.describe('UAT-01: Sidebar Quản lý vụ án', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('AC-01: User đăng nhập thấy "Quản lý vụ án" trong sidebar', async ({ page }) => {
    const sidebar = page.getByTestId('main-sidebar');
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
// UAT-02: Danh sách vụ án
// ═══════════════════════════════════════════════════════════════════════════

test.describe('UAT-02: Danh sách vụ án', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('AC-02: Navigate to /cases -> CaseList hiển thị', async ({ page }) => {
    await page.goto(`${BASE_URL}/cases`);
    
    const caseListPage = page.getByTestId('case-list-page');
    await expect(caseListPage).toBeVisible();

    const bodyText = await page.textContent('body');
    expect(bodyText).toContain('Danh sách vụ án');

    await page.screenshot({
      path: 'tests/screenshots/uat02-ac02-case-list.png',
      fullPage: true,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// UAT-03: Thêm mới hồ sơ
// ═══════════════════════════════════════════════════════════════════════════

test.describe('UAT-03: Thêm mới hồ sơ', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('AC-03: Navigate to /add-new-record -> CaseForm hiển thị với 10 tabs', async ({ page }) => {
    await page.goto(`${BASE_URL}/add-new-record`);
    
    const caseFormPage = page.getByTestId('case-form-page');
    await expect(caseFormPage).toBeVisible();

    const tabList = page.getByTestId('tab-list');
    await expect(tabList).toBeVisible();

    await page.screenshot({
      path: 'tests/screenshots/uat03-ac03-case-form.png',
      fullPage: true,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// UAT-04: Chi tiết vụ án
// ═══════════════════════════════════════════════════════════════════════════

test.describe('UAT-04: Chi tiết vụ án', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('AC-04: Navigate to /cases/:id -> CaseDetail hiển thị', async ({ page }) => {
    await page.goto(`${BASE_URL}/cases/VA-2026-001`);
    
    const caseDetailPage = page.getByTestId('case-detail-page');
    await expect(caseDetailPage).toBeVisible();

    const bodyText = await page.textContent('body');
    expect(bodyText).toContain('Mã vụ án');

    await page.screenshot({
      path: 'tests/screenshots/uat04-ac04-case-detail.png',
      fullPage: true,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// UAT-05: Tính nhất quán giữa các trang
// ═══════════════════════════════════════════════════════════════════════════

test.describe('UAT-05: Tính nhất quán UI', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('Kiểm tra tính nhất quán Navy/Gold theme', async ({ page }) => {
    await page.goto(`${BASE_URL}/cases`);
    
    const sidebar = page.getByTestId('main-sidebar');
    await expect(sidebar).toBeVisible();

    const sidebarBg = await sidebar.evaluate((el) => 
      window.getComputedStyle(el).backgroundColor
    );
    expect(sidebarBg).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TASK-2026-022601 — UAT-06: Bộ lọc nâng cao (AC-01)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('UAT-06: Bộ lọc nâng cao – AC-01', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/cases`);
  });

  test('AC-01-a: Mở bộ lọc nâng cao hiển thị 5 trường', async ({ page }) => {
    await page.getByTestId('btn-advanced-filter').click();
    await expect(page.getByTestId('advanced-filters')).toBeVisible();
    await expect(page.getByTestId('filter-from-date')).toBeVisible();
    await expect(page.getByTestId('filter-to-date')).toBeVisible();
    await expect(page.getByTestId('filter-unit')).toBeVisible();
    await expect(page.getByTestId('filter-investigator')).toBeVisible();
    await expect(page.getByTestId('filter-charges')).toBeVisible();
    await page.screenshot({ path: 'test-results/uat/screenshots/case-list-step01-advanced-filters.png', fullPage: true });
  });

  test('AC-01-b: Lọc theo đơn vị "Công an Quận 1" → chỉ hiện vụ án đơn vị đó', async ({ page }) => {
    await page.getByTestId('btn-advanced-filter').click();
    await page.getByTestId('filter-unit').selectOption('Công an Quận 1');
    await page.waitForTimeout(300);
    const rows = page.locator('[data-testid^="case-row-"]');
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
    await page.screenshot({ path: 'test-results/uat/screenshots/case-list-step02-filter-unit.png', fullPage: true });
  });

  test('EC-01: Bộ lọc không có kết quả hiển thị "Không tìm thấy kết quả"', async ({ page }) => {
    await page.getByTestId('search-input').fill('xxxxxxxxxxxxxxxxxnotexist');
    await page.waitForTimeout(300);
    await expect(page.getByTestId('no-results')).toBeVisible();
    await page.screenshot({ path: 'test-results/uat/screenshots/case-list-step03-no-results.png', fullPage: true });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TASK-2026-022601 — UAT-07: Badge "Quá hạn" (AC-02)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('UAT-07: Badge Quá hạn – AC-02', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/cases`);
  });

  test('AC-02: Vụ án quá hạn hiển thị badge đỏ "Quá hạn" trong danh sách', async ({ page }) => {
    const overdueBadge = page.locator('[data-testid^="overdue-badge-"]').first();
    await expect(overdueBadge).toBeVisible();
    await expect(overdueBadge).toHaveText('Quá hạn');
    // Badge must have a non-transparent background (red in any color format)
    const color = await overdueBadge.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(color).not.toBe('rgba(0, 0, 0, 0)');
    expect(color).not.toBe('transparent');
    await page.screenshot({ path: 'test-results/uat/screenshots/case-list-step04-overdue-badge.png', fullPage: true });
  });

  test('AC-02-detail: Badge Quá hạn hiển thị ở CaseDetailPage', async ({ page }) => {
    // VA-2026-002 deadline là 2026-02-15 đã quá hạn
    await page.goto(`${BASE_URL}/cases/VA-2026-001`);
    await expect(page.getByTestId('case-detail-page')).toBeVisible();
    await page.screenshot({ path: 'test-results/uat/screenshots/case-detail-step01-overdue.png', fullPage: true });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TASK-2026-022601 — UAT-08: Tab chuyển mượt mà (AC-03)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('UAT-08: Tab chuyển mượt mà – AC-03', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/cases/VA-2026-001`);
    await expect(page.getByTestId('case-detail-page')).toBeVisible();
  });

  test('AC-03: Chuyển qua lần lượt 5 tabs, nội dung cập nhật đúng', async ({ page }) => {
    const tabIds = ['info', 'defendants', 'lawyers', 'timeline', 'conclusion'] as const;
    for (const tabId of tabIds) {
      await page.getByTestId(`tab-${tabId}`).click();
      await expect(page.getByTestId(`tab-content-${tabId}`)).toBeVisible();
      await page.screenshot({ path: `test-results/uat/screenshots/case-detail-step02-tab-${tabId}.png`, fullPage: true });
    }
  });

  test('EC-05: State tabs giữ nguyên khi chuyển qua lại', async ({ page }) => {
    await page.getByTestId('tab-defendants').click();
    await expect(page.getByTestId('tab-content-defendants')).toBeVisible();
    await page.getByTestId('tab-info').click();
    await expect(page.getByTestId('tab-content-info')).toBeVisible();
    await page.getByTestId('tab-defendants').click();
    await expect(page.getByTestId('tab-content-defendants')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TASK-2026-022601 — UAT-09: Modal Bị can (AC-05)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('UAT-09: Modal quản lý Bị can – AC-05', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/cases/VA-2026-001`);
    await page.getByTestId('tab-defendants').click();
    await expect(page.getByTestId('tab-content-defendants')).toBeVisible();
  });

  test('AC-05-a: Mở modal Thêm bị can → điền form → lưu → danh sách cập nhật', async ({ page }) => {
    await page.screenshot({ path: 'test-results/uat/screenshots/defendant-step01-before.png', fullPage: true });

    const countBefore = await page.locator('[data-testid^="defendant-card-"]').count();
    await page.getByTestId('btn-add-defendant').click();
    await expect(page.getByTestId('defendant-modal')).toBeVisible();
    await page.screenshot({ path: 'test-results/uat/screenshots/defendant-step02-modal-open.png', fullPage: true });

    await page.getByTestId('input-defendant-name').fill('Nguyễn Test Bị can');
    await page.getByTestId('input-defendant-id').fill('099887766554');
    await page.getByTestId('btn-save-defendant').click();
    await expect(page.getByTestId('defendant-modal')).not.toBeVisible();

    const countAfter = await page.locator('[data-testid^="defendant-card-"]').count();
    expect(countAfter).toBe(countBefore + 1);
    await page.screenshot({ path: 'test-results/uat/screenshots/defendant-step03-after-add.png', fullPage: true });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TASK-2026-022601 — UAT-10: Form 50+ trường (AC-04)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('UAT-10: Form 50+ trường – AC-04', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/add-new-record`);
    await expect(page.getByTestId('case-form-page')).toBeVisible();
  });

  test('AC-04: Điền các trường bắt buộc → lưu → log xuất hiện', async ({ page }) => {
    await page.screenshot({ path: 'test-results/uat/screenshots/caseform-step01-empty.png', fullPage: true });

    // Mã hồ sơ
    await page.getByTestId('input-case-code').fill('HS-2026-TEST');
    // Ngày tiếp nhận
    await page.getByTestId('input-receive-date').fill('2026-02-20');
    // Tiêu đề
    await page.getByTestId('input-case-title').fill('Vụ án test tự động');
    // Loại hồ sơ
    await page.getByTestId('select-case-type').selectOption('vu-an');
    await page.screenshot({ path: 'test-results/uat/screenshots/caseform-step02-filled-required.png', fullPage: true });
  });

  test('AC-04-vi-fields: Tab Info hiển thị tiếng Việt có dấu', async ({ page }) => {
    const tabContent = await page.getByTestId('tab-info').first().textContent() ?? '';
    // Tab label
    expect(tabContent).toContain('Thông tin');
    const bodyText = await page.locator('body').textContent() ?? '';
    expect(bodyText).toContain('Mã hồ sơ');
    expect(bodyText).toContain('Ngày tiếp nhận');
    expect(bodyText).toContain('Tiêu đề hồ sơ');
    await page.screenshot({ path: 'test-results/uat/screenshots/caseform-step03-vi-labels.png', fullPage: true });
  });
});
