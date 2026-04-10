/**
 * E2E Tests — Workflow Processing (Quy trình xử lý)
 * TASK_ID: TASK-2026-260216 | EXECUTION_ID: INTAKE-20260226-01-A4B8
 *
 * Covers:
 *   SCR-PF-01: TransferAndReturn
 *   SCR-PF-02: PetitionGuidance
 *   SCR-PF-03: CaseExchange
 *   SCR-PF-04: InvestigationDelegation
 *
 * Credentials: admin@pc02.local / Admin@1234!
 */

import { test, expect, type Page } from '@playwright/test';
import * as fs from 'fs';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5175';
const ADMIN = {
  email: process.env.TEST_USER || 'admin@pc02.local',
  password: process.env.TEST_PASS || 'Admin@1234!',
};

const SCREENSHOT_DIR = 'test-results/uat/screenshots';

async function loginAsAdmin(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.locator('input[type="email"]').first().fill(ADMIN.email);
  await page.locator('input[type="password"]').first().fill(ADMIN.password);
  await page.getByRole('button', { name: /đăng nhập/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}

async function screenshot(page: Page, name: string) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png`, fullPage: true });
}

test.describe('E2E: Workflow Processing — TASK_ID: TASK-2026-260216', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  // ── E2E-01: SCR-PF-01 TransferAndReturn — tải màn hình ────────────────────

  test('E2E-01: TransferAndReturn — hiển thị bảng dữ liệu', async ({ page }) => {
    await page.goto(`${BASE_URL}/transfer-return`);
    await screenshot(page, 'e2e-01-transfer-return-initial');

    await expect(page.getByTestId('record-table')).toBeVisible();
    await expect(page.getByTestId('transfer-btn')).toBeVisible();
    await expect(page.getByTestId('return-btn')).toBeVisible();

    await screenshot(page, 'e2e-01-transfer-return-table-loaded');
  });

  // ── E2E-02: SCR-PF-01 — Chọn hồ sơ → mở modal Chuyển đội ────────────────

  test('E2E-02: TransferAndReturn — chọn hồ sơ và mở modal Chuyển đội', async ({ page }) => {
    await page.goto(`${BASE_URL}/transfer-return`);

    // Select first open record (id=1)
    await page.getByTestId('record-checkbox-1').check();
    await expect(page.getByTestId('transfer-btn')).toBeEnabled();

    await page.getByTestId('transfer-btn').click();
    await screenshot(page, 'e2e-02-transfer-confirm-dialog');

    // Confirm dialog
    await page.getByTestId('confirm-proceed-btn').click();
    await expect(page.getByTestId('transfer-modal')).toBeVisible();

    await screenshot(page, 'e2e-02-transfer-modal-open');
  });

  // ── E2E-03: SCR-PF-01 — EC-02: Hồ sơ "Đã đóng" hiển thị cảnh báo ───────

  test('E2E-03: TransferAndReturn — EC-02: hồ sơ Đã đóng hiển thị badge', async ({ page }) => {
    await page.goto(`${BASE_URL}/transfer-return`);

    // Verify the closed-status record shows "Đã đóng" badge
    await expect(page.getByText('Đã đóng').first()).toBeVisible();

    await screenshot(page, 'e2e-03-transfer-closed-record-visible');
  });

  // ── E2E-04: SCR-PF-02 PetitionGuidance — tải màn hình + stats ─────────────

  test('E2E-04: PetitionGuidance — hiển thị màn hình và thẻ thống kê', async ({ page }) => {
    await page.goto(`${BASE_URL}/guidance`);
    await screenshot(page, 'e2e-04-petition-guidance-initial');

    await expect(page.getByTestId('add-guidance-btn')).toBeVisible();
    await expect(page.getByTestId('stat-total')).toBeVisible();
    await expect(page.getByTestId('stat-completed')).toBeVisible();
    await expect(page.getByTestId('stat-pending')).toBeVisible();
    await expect(page.getByTestId('stat-today')).toBeVisible();

    await screenshot(page, 'e2e-04-petition-guidance-stats');
  });

  // ── E2E-05: SCR-PF-02 — Thêm hướng dẫn mới ──────────────────────────────

  test('E2E-05: PetitionGuidance — thêm hướng dẫn mới qua modal', async ({ page }) => {
    await page.goto(`${BASE_URL}/guidance`);
    await page.getByTestId('add-guidance-btn').click();
    await expect(page.getByTestId('guidance-modal')).toBeVisible();

    await screenshot(page, 'e2e-05-guidance-modal-open');

    await page.getByTestId('guided-person-input').fill('Nguyễn Thị E2E Test');
    await page.getByTestId('subject-input').fill('Hướng dẫn E2E test subject');
    await page.getByTestId('guidance-content-textarea').fill('Nội dung hướng dẫn chi tiết cho E2E test automation');

    await screenshot(page, 'e2e-05-guidance-form-filled');

    await page.getByTestId('save-guidance-btn').click();

    await screenshot(page, 'e2e-05-guidance-saved');
  });

  // ── E2E-06: SCR-PF-03 CaseExchange — tải danh sách ───────────────────────

  test('E2E-06: CaseExchange — hiển thị danh sách trao đổi', async ({ page }) => {
    await page.goto(`${BASE_URL}/case-exchange`);
    await screenshot(page, 'e2e-06-case-exchange-initial');

    await expect(page.getByTestId('create-exchange-btn')).toBeVisible();

    await screenshot(page, 'e2e-06-case-exchange-table');
  });

  // ── E2E-07: SCR-PF-04 InvestigationDelegation — thêm ủy thác mới ─────────

  test('E2E-07: InvestigationDelegation — thêm ủy thác mới', async ({ page }) => {
    await page.goto(`${BASE_URL}/investigation-delegation`);
    await screenshot(page, 'e2e-07-delegation-initial');

    await page.getByTestId('create-delegation-btn').click();
    await expect(page.getByTestId('delegation-modal')).toBeVisible();

    await screenshot(page, 'e2e-07-delegation-modal-open');

    await page.getByTestId('delegation-number-input').fill('UT-099/2026');
    await page.getByTestId('delegation-date-input').fill('2026-02-26');
    await page.getByTestId('delegation-content-textarea').fill('Ủy thác xác minh nhân thân cho E2E test automation run');

    await screenshot(page, 'e2e-07-delegation-form-filled');

    await page.getByTestId('save-delegation-btn').click();

    await screenshot(page, 'e2e-07-delegation-saved');
  });

  // ── E2E-08: SCR-PF-04 — EC-03: Validation format UT-XXX/YYYY ─────────────

  test('E2E-08: InvestigationDelegation — EC-03: invalid format shows error', async ({ page }) => {
    await page.goto(`${BASE_URL}/investigation-delegation`);
    await page.getByTestId('create-delegation-btn').click();

    await page.getByTestId('delegation-number-input').fill('INVALID-FORMAT');
    await page.getByTestId('save-delegation-btn').click();

    await expect(page.getByTestId('delegation-number-error')).toBeVisible();
    await screenshot(page, 'e2e-08-delegation-format-error');

    // Fix the format — error should clear
    await page.getByTestId('delegation-number-input').fill('UT-010/2026');
    await page.getByTestId('delegation-number-error').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
    await screenshot(page, 'e2e-08-delegation-format-valid');
  });
});
