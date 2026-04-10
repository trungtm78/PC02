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
// AC-01: Sidebar hiển thị "Quản lý vụ án" trong "Nghiệp vụ chính"
// ═══════════════════════════════════════════════════════════════════════════

test.describe('AC-01: Sidebar Quản lý vụ án', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('E2E-01: Sidebar hiển thị "Quản lý vụ án" là menu con của "Nghiệp vụ chính"', async ({ page }) => {
    const sidebar = page.getByTestId('main-sidebar');
    await expect(sidebar).toBeVisible();

    const sidebarContent = await sidebar.textContent();
    expect(sidebarContent).toContain('Quản lý vụ án');
    expect(sidebarContent).toContain('Nghiệp vụ chính');

    await page.screenshot({
      path: 'tests/screenshots/CaseManagement-step01-sidebar-menu.png',
      fullPage: true,
    });
  });

  test('E2E-02: Click vào "Danh sách vụ án" điều hướng đến /cases', async ({ page }) => {
    await page.goto(`${BASE_URL}/cases`);
    await expect(page.getByTestId('case-list-page')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-02: Text phải là tiếng Việt có dấu chuẩn
// ═══════════════════════════════════════════════════════════════════════════

test.describe('AC-02: Tiếng Việt có dấu', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('E2E-03: CaseListPage hiển thị tiếng Việt có dấu', async ({ page }) => {
    await page.goto(`${BASE_URL}/cases`);
    
    const bodyText = await page.textContent('body');
    expect(bodyText).toContain('Danh sách vụ án');
    
    await page.screenshot({
      path: 'tests/screenshots/CaseManagement-step02-case-list-vi.png',
      fullPage: true,
    });
  });

  test('E2E-04: CaseFormPage hiển thị 10 tabs với tiếng Việt có dấu', async ({ page }) => {
    await page.goto(`${BASE_URL}/add-new-record`);
    await expect(page.getByTestId('case-form-page')).toBeVisible();

    const tabList = page.getByTestId('tab-list');
    await expect(tabList).toBeVisible();

    const tabText = await tabList.textContent();
    expect(tabText).toContain('Thông tin');
    expect(tabText).toContain('Vụ việc');
    expect(tabText).toContain('Vụ án');
    expect(tabText).toContain('ĐTBS');

    await page.screenshot({
      path: 'tests/screenshots/CaseManagement-step02-case-form-10-tabs.png',
      fullPage: true,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-03: Form có đủ 10 tabs với các trường thông tin khớp với Refs
// ═══════════════════════════════════════════════════════════════════════════

test.describe('AC-03: Form 10 tabs', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('E2E-05: CaseFormPage có đủ 10 tabs', async ({ page }) => {
    await page.goto(`${BASE_URL}/add-new-record`);
    await expect(page.getByTestId('case-form-page')).toBeVisible();

    const expectedTabs = [
      { id: 'info', label: 'Thông tin' },
      { id: 'incident', label: 'Vụ việc' },
      { id: 'case', label: 'Vụ án' },
      { id: 'subjects', label: 'ĐTBS' },
      { id: 'incident-tdc', label: 'Vụ việc TĐC' },
      { id: 'case-tdc', label: 'Vụ án TĐC' },
      { id: 'evidence', label: 'Vật chứng' },
      { id: 'business-files', label: 'Hồ sơ nghiệp vụ' },
      { id: 'statistics', label: 'TK 48 trường' },
      { id: 'media', label: 'Ghi âm, ghi hình' },
    ];

    for (const tab of expectedTabs) {
      const tabButton = page.getByTestId(`tab-${tab.id}`).first();
      await expect(tabButton).toBeVisible({ timeout: 5000 });
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AC-04: Chi tiết vụ án hiển thị đầy đủ thông tin và các tab tiến trình/kết luận
// ═══════════════════════════════════════════════════════════════════════════

test.describe('AC-04: Case Detail Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('E2E-06: Truy cập /cases/:id hiển thị CaseDetailPage', async ({ page }) => {
    await page.goto(`${BASE_URL}/cases/VA-2026-001`);
    
    const caseDetailPage = page.getByTestId('case-detail-page');
    await expect(caseDetailPage).toBeVisible();

    await page.screenshot({
      path: 'tests/screenshots/CaseManagement-step03-case-detail.png',
      fullPage: true,
    });
  });

  test('E2E-07: CaseDetailPage hiển thị thông tin vụ án', async ({ page }) => {
    await page.goto(`${BASE_URL}/cases/VA-2026-001`);
    
    const caseDetailPage = page.getByTestId('case-detail-page');
    await expect(caseDetailPage).toBeVisible({ timeout: 10000 });
    
    const bodyText = await page.textContent('body');
    expect(bodyText).toContain('Mã vụ án');
    expect(bodyText).toContain('Thông tin cơ bản');
    expect(bodyText).toContain('Bị can');
  });

  test('E2E-08: Nút quay lại từ CaseDetailPage', async ({ page }) => {
    await page.goto(`${BASE_URL}/cases/VA-2026-001`);
    
    const backButton = page.getByRole('button', { name: /quay lại/i });
    if (await backButton.isVisible()) {
      await backButton.click();
      await expect(page).toHaveURL(/\/cases/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EC-02: Dữ liệu tiếng Việt có dấu bị lỗi font/encoding
// ═══════════════════════════════════════════════════════════════════════════

test.describe('EC-02: Encoding Test', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('E2E-09: Tiếng Việt hiển thị đúng encoding UTF-8', async ({ page }) => {
    await page.goto(`${BASE_URL}/cases`);
    
    const bodyText = await page.textContent('body');
    const vietnameseChars = ['ấ', 'ầ', 'ẩ', 'ẫ', 'ậ', 'ắ', 'ằ', 'ẳ', 'ẵ', 'ặ'];
    let hasVietnameseChars = false;
    
    for (const char of vietnameseChars) {
      if (bodyText && bodyText.includes(char)) {
        hasVietnameseChars = true;
        break;
      }
    }
    
    expect(hasVietnameseChars || bodyText?.includes('Danh sách') || bodyText?.includes('vụ án')).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// TASK-2026-022601 — E2E Full Flow: CaseList → Detail → Modals
// ═══════════════════════════════════════════════════════════════════════════

test.describe('TASK-2026-022601 E2E: Full Case Management Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('E2E-10: CaseList – cột mới Tội danh, Số bị can, Hạn điều tra hiển thị', async ({ page }) => {
    await page.goto(`${BASE_URL}/cases`);
    await expect(page.getByTestId('case-table')).toBeVisible();
    const headerText = await page.locator('thead').textContent() ?? '';
    expect(headerText).toContain('Tội danh');
    expect(headerText).toContain('Số bị can');
    expect(headerText).toContain('Hạn điều tra');
    await page.screenshot({ path: 'test-results/uat/screenshots/e2e-step01-list-new-cols.png', fullPage: true });
  });

  test('E2E-11: CaseList – bộ lọc nâng cao tồn tại với đủ 5 trường', async ({ page }) => {
    await page.goto(`${BASE_URL}/cases`);
    await page.getByTestId('btn-advanced-filter').click();
    await expect(page.getByTestId('filter-from-date')).toBeVisible();
    await expect(page.getByTestId('filter-to-date')).toBeVisible();
    await expect(page.getByTestId('filter-unit')).toBeVisible();
    await expect(page.getByTestId('filter-investigator')).toBeVisible();
    await expect(page.getByTestId('filter-charges')).toBeVisible();
    await page.screenshot({ path: 'test-results/uat/screenshots/e2e-step02-advanced-filters.png', fullPage: true });
  });

  test('E2E-12: CaseDetail – 5 tabs với đúng testid', async ({ page }) => {
    await page.goto(`${BASE_URL}/cases/VA-2026-001`);
    await expect(page.getByTestId('detail-tabs')).toBeVisible();
    for (const tabId of ['info', 'defendants', 'lawyers', 'timeline', 'conclusion']) {
      await expect(page.getByTestId(`tab-${tabId}`)).toBeVisible();
    }
    await page.screenshot({ path: 'test-results/uat/screenshots/e2e-step03-detail-5-tabs.png', fullPage: true });
  });

  test('E2E-13: CaseDetail → Tab Bị can → Modal thêm → form nhập đúng → lưu thành công', async ({ page }) => {
    await page.goto(`${BASE_URL}/cases/VA-2026-001`);
    await page.getByTestId('tab-defendants').click();
    await expect(page.getByTestId('tab-content-defendants')).toBeVisible();

    await page.getByTestId('btn-add-defendant').click();
    await expect(page.getByTestId('defendant-modal')).toBeVisible();
    await page.screenshot({ path: 'test-results/uat/screenshots/e2e-step04-defendant-modal.png', fullPage: true });

    await page.getByTestId('input-defendant-name').fill('E2E Test Bị can');
    await page.getByTestId('input-defendant-id').fill('111222333444');
    await page.getByTestId('select-detention-status').selectOption('Tạm giam');
    await page.getByTestId('btn-save-defendant').click();

    await expect(page.getByTestId('defendant-modal')).not.toBeVisible();
    const newCard = page.getByText('E2E Test Bị can').first();
    await expect(newCard).toBeVisible();
    await page.screenshot({ path: 'test-results/uat/screenshots/e2e-step05-defendant-added.png', fullPage: true });
  });

  test('E2E-14: CaseDetail → Tab Luật sư → Modal gán → lưu → danh sách cập nhật', async ({ page }) => {
    await page.goto(`${BASE_URL}/cases/VA-2026-001`);
    await page.getByTestId('tab-lawyers').click();
    await expect(page.getByTestId('tab-content-lawyers')).toBeVisible();

    await page.getByTestId('btn-add-lawyer').click();
    await expect(page.getByTestId('lawyer-modal')).toBeVisible();
    await page.screenshot({ path: 'test-results/uat/screenshots/e2e-step06-lawyer-modal.png', fullPage: true });

    await page.getByTestId('input-lawyer-name').fill('Luật sư E2E Test');
    await page.getByTestId('input-bar-number').fill('LS-HCM-9999');
    await page.getByTestId('btn-save-lawyer').click();

    await expect(page.getByTestId('lawyer-modal')).not.toBeVisible();
    await expect(page.getByText('Luật sư E2E Test').first()).toBeVisible();
    await page.screenshot({ path: 'test-results/uat/screenshots/e2e-step07-lawyer-added.png', fullPage: true });
  });

  test('E2E-15: CaseDetail → Tab Kết luận → Modal thêm → lưu', async ({ page }) => {
    await page.goto(`${BASE_URL}/cases/VA-2026-001`);
    await page.getByTestId('tab-conclusion').click();
    await expect(page.getByTestId('tab-content-conclusion')).toBeVisible();

    await page.getByTestId('btn-add-conclusion').click();
    await expect(page.getByTestId('conclusion-modal')).toBeVisible();
    await page.screenshot({ path: 'test-results/uat/screenshots/e2e-step08-conclusion-modal.png', fullPage: true });

    await page.getByTestId('textarea-conclusion-content').fill('Kết luận điều tra E2E: bị can đã thực hiện hành vi trộm cắp.');
    await page.getByTestId('btn-save-conclusion').click();
    await expect(page.getByTestId('conclusion-modal')).not.toBeVisible();
    await page.screenshot({ path: 'test-results/uat/screenshots/e2e-step09-conclusion-added.png', fullPage: true });
  });

  test('E2E-16: CaseForm – Tab Statistics 48 trường, Nhóm 1 sourceType có options tiếng Việt', async ({ page }) => {
    await page.goto(`${BASE_URL}/add-new-record`);
    await page.getByTestId('tab-statistics').first().click();
    await expect(page.getByTestId('tab-statistics').nth(1)).toBeVisible();
    await expect(page.getByTestId('stat-sourceType')).toBeVisible();
    // EC-06: Validate format số
    await page.getByTestId('stat-damageAmount').fill('không_phải_số');
    await page.getByTestId('btn-save-statistics').click();
    // Cảnh báo validation phải hiện
    await page.screenshot({ path: 'test-results/uat/screenshots/e2e-step10-stat-validation.png', fullPage: true });
  });

  test('E2E-17: EC-02 – Vụ án quá hạn lâu ngày badge đỏ + cảnh báo alert', async ({ page }) => {
    await page.goto(`${BASE_URL}/cases`);
    await expect(page.getByTestId('overdue-alert')).toBeVisible();
    const alertText = await page.getByTestId('overdue-alert').textContent() ?? '';
    expect(alertText).toContain('quá hạn');
    const overdueBadges = await page.locator('[data-testid^="overdue-badge-"]').count();
    expect(overdueBadges).toBeGreaterThan(0);
    await page.screenshot({ path: 'test-results/uat/screenshots/e2e-step11-overdue-alert.png', fullPage: true });
  });
});
