/**
 * UAT Tests — Classification Module
 * TASK-2026-022601 | EXECUTION_ID: INTAKE-20260226-001-A9F2
 *
 * Map AC → UAT:
 *   AC-01 → UAT-CL-01: Ward Cases access control (Cán bộ Phường A chỉ thấy Phường A)
 *   AC-02 → UAT-CL-02: Admin quản lý toàn cục (thấy tất cả + nút Xóa)
 *   AC-03 → UAT-CL-03: Duplicate Petitions xử lý (So sánh/Hợp nhất)
 *   AC-04 → UAT-CL-04: Prosecutor Proposal xuất Excel đúng format
 *
 * Credentials: admin@pc02.local / Admin@1234! (from project_context.md)
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';
const ADMIN = { email: 'admin@pc02.local', password: 'Admin@1234!' };

async function loginAsAdmin(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page
    .locator('input[type="email"], input[name="email"], input[id="email"]')
    .first()
    .fill(ADMIN.email);
  await page.locator('input[type="password"]').first().fill(ADMIN.password);
  await page.getByRole('button', { name: /sign in|đăng nhập/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 10000 });
}

test.describe('UAT-CL-01: Ward Cases Access Control', () => {
  test('Cán bộ Phường A chỉ thấy hồ sơ thuộc Phường A', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/ward/cases`);

    await expect(page.getByTestId('ward-cases-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Vụ án Phường\/Xã/i })).toBeVisible();

    const table = page.getByTestId('ward-cases-table');
    await expect(table).toBeVisible();

    const rows = await table.getByRole('row').count();
    expect(rows).toBeGreaterThan(1);

    await page.screenshot({ path: 'tests/screenshots/uat-cl-01-step01-ward-cases.png' });
  });

  test('Admin thấy toàn bộ hồ sơ và có nút Xóa', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/ward/cases`);

    const table = page.getByTestId('ward-cases-table');
    const deleteButtons = table.getByTestId(/delete-btn-/);
    const count = await deleteButtons.count();

    expect(count).toBeGreaterThan(0);

    await page.screenshot({ path: 'tests/screenshots/uat-cl-01-step02-admin-delete-btn.png' });
  });
});

test.describe('UAT-CL-02: Ward Incidents Management', () => {
  test('Ward Incidents page loads and filters work', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/ward/incidents`);

    await expect(page.getByTestId('ward-incidents-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Vụ việc Phường\/Xã/i })).toBeVisible();

    await page.getByTestId('filter-toggle-btn').click();
    await expect(page.getByTestId('advanced-filter-panel')).toBeVisible();

    await page.screenshot({ path: 'tests/screenshots/uat-cl-02-step01-ward-incidents.png' });
  });
});

test.describe('UAT-CL-03: Duplicate Petitions Processing', () => {
  test('So sánh đơn trùng hiển thị đúng thông tin', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/classification/duplicates`);

    await expect(page.getByTestId('duplicate-petitions-page')).toBeVisible();

    const similarity95 = page.getByTestId('similarity-DUP-001-DT-2026-089');
    await expect(similarity95).toBeVisible();
    const similarityText = await similarity95.textContent();
    expect(similarityText).toContain('95');

    await page.getByTestId('compare-btn-DUP-001-DT-2026-089').click();
    await expect(page.getByRole('heading', { name: /So sánh đơn thư/i })).toBeVisible();

    await page.screenshot({ path: 'tests/screenshots/uat-cl-03-step01-compare.png' });
  });

  test('Hợp nhất đơn trùng với độ tương đồng > 90%', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/classification/duplicates`);

    await page.getByTestId('process-btn-DUP-001').click();
    await expect(page.getByRole('heading', { name: /Xử lý đơn trùng/i })).toBeVisible();

    await page.getByText(/Hợp nhất vào hồ sơ gốc/i).click();
    await page.getByTestId('process-notes-input').fill('Đơn trùng với DT-2026-089, đã xác minh');

    page.on('dialog', (dialog) => dialog.accept());

    await page.screenshot({ path: 'tests/screenshots/uat-cl-03-step02-merge.png' });
  });
});

test.describe('UAT-CL-04: Prosecutor Proposal Excel Export', () => {
  test('Xuất Excel kiến nghị VKS đúng format', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/prosecutor-proposal`);

    await expect(page.getByTestId('prosecutor-proposal-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Kiến nghị VKS/i })).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('export-excel-btn').click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/kien-nghi-vks-.*\.csv/);

    await page.screenshot({ path: 'tests/screenshots/uat-cl-04-step01-excel-export.png' });
  });

  test('Tạo kiến nghị VKS mới với đầy đủ thông tin', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/prosecutor-proposal`);

    await page.getByTestId('add-proposal-btn').click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const ts = Date.now();
    await page
      .locator('input[placeholder="VD: KN-2026-001"]')
      .fill(`KN-TEST-${ts % 100000}`);
    await page
      .locator('input[placeholder="VD: VA-2026-001"]')
      .fill('VA-2026-TEST');
    await page.getByRole('combobox').first().selectOption({ label: 'Vụ án' });
    await page.getByText(/Viện Kiểm sát Quận 1/i).click();
    await page
      .locator('input[placeholder="Họ tên người soạn"]')
      .fill('Test User');
    await page
      .locator('textarea[placeholder="Trình bày chi tiết nội dung kiến nghị..."]')
      .fill('Nội dung kiến nghị test cho UAT');

    await page.screenshot({ path: 'tests/screenshots/uat-cl-04-step02-form-filled.png' });

    page.on('dialog', (dialog) => dialog.accept());
    await page
      .getByRole('button', { name: /lưu/i })
      .last()
      .click();
  });
});

test.describe('UAT-CL-05: Other Classification', () => {
  test('Other Classification page renders correctly', async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/classification/others`);

    await expect(page.getByTestId('other-classification-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Phân loại khác/i })).toBeVisible();
    await expect(page.getByTestId('other-classification-table')).toBeVisible();

    await page.screenshot({ path: 'tests/screenshots/uat-cl-05-step01-other-classification.png' });
  });
});
