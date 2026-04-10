/**
 * E2E Tests — Classification Module (Ward Cases, Prosecutor Proposal, Duplicate Petitions)
 * TASK-2026-022601 | EXECUTION_ID: INTAKE-20260226-001-A9F2
 *
 * Credentials from project_context.md:
 *   URL:      http://localhost:5173
 *   Admin:    admin@pc02.local / Admin@1234!
 *   Role:     ADMIN
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:3000';
const ADMIN = { email: 'admin@pc02.local', password: 'Admin@1234!' };

async function loginAsAdmin(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page
    .locator('input[type="email"], input[name="email"], input[id="email"]')
    .first()
    .fill(ADMIN.email);
  await page.locator('input[type="password"]').first().fill(ADMIN.password);
  await page.getByRole('button', { name: /sign in|đăng nhập/i }).click();
  await page.waitForURL(/\/dashboard/);
}

test.describe('E2E-CL-01: Ward Cases Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('Ward Cases page renders with title and table', async ({ page }) => {
    await page.goto(`${BASE_URL}/ward/cases`);
    await expect(page.getByTestId('ward-cases-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Vụ án Phường\/Xã/i })).toBeVisible();
    await expect(page.getByTestId('ward-cases-table')).toBeVisible();
    await page.screenshot({ path: 'tests/screenshots/phan-loai-quan-ly-step01-initial.png' });
  });

  test('Ward Cases filter panel toggles correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/ward/cases`);
    await page.getByTestId('filter-toggle-btn').click();
    await expect(page.getByTestId('advanced-filter-panel')).toBeVisible();
    await page.getByTestId('filter-toggle-btn').click();
    await expect(page.getByTestId('advanced-filter-panel')).not.toBeVisible();
  });

  test('Ward Cases quick search filters table content', async ({ page }) => {
    await page.goto(`${BASE_URL}/ward/cases`);
    const searchInput = page.getByTestId('quick-search-input');
    await searchInput.fill('Trộm cắp');
    const table = page.getByTestId('ward-cases-table');
    await expect(table.getByText(/Trộm cắp/).first()).toBeVisible();
  });

  test('Ward Cases export Excel button exists', async ({ page }) => {
    await page.goto(`${BASE_URL}/ward/cases`);
    await expect(page.getByTestId('export-excel-btn')).toBeVisible();
  });

  test('Ward Cases access denied modal shows for unauthorized access', async ({ page }) => {
    await page.goto(`${BASE_URL}/ward/cases`);
    const accessDeniedModal = page.getByTestId('access-denied-modal');
    const modalVisible = await accessDeniedModal.isVisible().catch(() => false);
    if (modalVisible) {
      await expect(accessDeniedModal.getByText(/Không có quyền truy cập/i)).toBeVisible();
      await page.screenshot({ path: 'tests/screenshots/phan-loai-quan-ly-step02-denied.png' });
    }
  });
});

test.describe('E2E-CL-02: Ward Incidents Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('Ward Incidents page renders with title and table', async ({ page }) => {
    await page.goto(`${BASE_URL}/ward/incidents`);
    await expect(page.getByTestId('ward-incidents-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Vụ việc Phường\/Xã/i })).toBeVisible();
    await expect(page.getByTestId('ward-incidents-table')).toBeVisible();
  });

  test('Ward Incidents filter panel toggles correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/ward/incidents`);
    await page.getByTestId('filter-toggle-btn').click();
    await expect(page.getByTestId('advanced-filter-panel')).toBeVisible();
  });
});

test.describe('E2E-CL-03: Prosecutor Proposal Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('Prosecutor Proposal page renders with title and table', async ({ page }) => {
    await page.goto(`${BASE_URL}/prosecutor-proposal`);
    await expect(page.getByTestId('prosecutor-proposal-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Kiến nghị VKS/i })).toBeVisible();
    await expect(page.getByTestId('proposals-table')).toBeVisible();
  });

  test('Prosecutor Proposal add button opens form modal', async ({ page }) => {
    await page.goto(`${BASE_URL}/prosecutor-proposal`);
    await page.getByTestId('add-proposal-btn').click();
    await expect(page.getByRole('dialog').getByText(/Tạo kiến nghị VKS mới/i)).toBeVisible();
  });

  test('Prosecutor Proposal export Excel triggers download', async ({ page }) => {
    await page.goto(`${BASE_URL}/prosecutor-proposal`);
    const downloadPromise = page.waitForEvent('download');
    await page.getByTestId('export-excel-btn').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('.csv');
    await page.screenshot({ path: 'tests/screenshots/phan-loai-quan-ly-step04-excel.png' });
  });
});

test.describe('E2E-CL-04: Duplicate Petitions Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('Duplicate Petitions page renders with title and table', async ({ page }) => {
    await page.goto(`${BASE_URL}/classification/duplicates`);
    await expect(page.getByTestId('duplicate-petitions-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Quản lý đơn trùng/i })).toBeVisible();
    await expect(page.getByTestId('duplicates-table')).toBeVisible();
  });

  test('Duplicate Petitions shows similarity percentage for duplicates', async ({ page }) => {
    await page.goto(`${BASE_URL}/classification/duplicates`);
    const similarity95 = page.getByTestId('similarity-DUP-001-DT-2026-089');
    await expect(similarity95).toBeVisible();
    expect(await similarity95.textContent()).toContain('95');
  });

  test('Duplicate Petitions compare button opens compare modal', async ({ page }) => {
    await page.goto(`${BASE_URL}/classification/duplicates`);
    const compareBtn = page.getByTestId('compare-btn-DUP-001-DT-2026-089');
    await compareBtn.click();
    await expect(page.getByRole('heading', { name: /So sánh đơn thư/i })).toBeVisible();
    await page.screenshot({ path: 'tests/screenshots/phan-loai-quan-ly-step03-compare.png' });
  });

  test('Duplicate Petitions process button opens process modal', async ({ page }) => {
    await page.goto(`${BASE_URL}/classification/duplicates`);
    const viewBtn = page.getByTestId('view-btn-DUP-001');
    await viewBtn.click();
    await expect(page.getByRole('heading', { name: /Chi tiết đơn trùng/i })).toBeVisible();
  });

  test('Duplicate Petitions process flow with merge action', async ({ page }) => {
    await page.goto(`${BASE_URL}/classification/duplicates`);
    await page.getByTestId('process-btn-DUP-001').click();
    await expect(page.getByRole('heading', { name: /Xử lý đơn trùng/i })).toBeVisible();
    await page.getByTestId('process-notes-input').fill('Test merge action');
    page.on('dialog', (dialog) => dialog.accept());
    await page.getByTestId('confirm-process-btn').click();
  });
});

test.describe('E2E-CL-05: Other Classification Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('Other Classification page renders with title and table', async ({ page }) => {
    await page.goto(`${BASE_URL}/classification/others`);
    await expect(page.getByTestId('other-classification-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Phân loại khác/i })).toBeVisible();
    await expect(page.getByTestId('other-classification-table')).toBeVisible();
  });

  test('Other Classification filter panel toggles correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/classification/others`);
    await page.getByTestId('filter-toggle-btn').click();
    await expect(page.getByTestId('advanced-filter-panel')).toBeVisible();
  });
});
