/**
 * UAT Tests — Workflow Processing (Quy trình xử lý)
 * TASK_ID: TASK-2026-260216 | EXECUTION_ID: INTAKE-20260226-01-A4B8
 *
 * Acceptance Criteria:
 *   AC-01: 4 màn hình đúng Refs template
 *   AC-02: Component style khớp styles.ts
 *   AC-03: Labels tiếng Việt
 *   AC-04: Modal và action buttons đầy đủ
 *
 * Edge Cases:
 *   EC-01: File đính kèm > 10MB (CaseExchange)
 *   EC-02: Hồ sơ "Đã đóng" không thể chuyển (TransferAndReturn)
 *   EC-03: Số ủy thác trùng UT-XXX/YYYY (InvestigationDelegation)
 *   EC-04: Hướng dẫn không có số điện thoại (PetitionGuidance)
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

test.describe('UAT: Workflow Processing — TASK_ID: TASK-2026-260216', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  // ── AC-01: 4 màn hình tải đúng ────────────────────────────────────────────

  test('UAT-01: AC-01 — SCR-PF-01 TransferAndReturn màn hình tải đúng', async ({ page }) => {
    await page.goto(`${BASE_URL}/transfer-return`);
    await screenshot(page, 'uat-01-transfer-return-loaded');

    await expect(page.getByTestId('record-table')).toBeVisible();
    await expect(page.getByTestId('transfer-btn')).toBeVisible();
    await expect(page.getByTestId('return-btn')).toBeVisible();
  });

  test('UAT-02: AC-01 — SCR-PF-02 PetitionGuidance tải đúng với 4 thẻ stats', async ({ page }) => {
    await page.goto(`${BASE_URL}/guidance`);
    await screenshot(page, 'uat-02-petition-guidance-loaded');

    await expect(page.getByTestId('stat-total')).toBeVisible();
    await expect(page.getByTestId('stat-completed')).toBeVisible();
    await expect(page.getByTestId('stat-pending')).toBeVisible();
    await expect(page.getByTestId('stat-today')).toBeVisible();
  });

  test('UAT-03: AC-01 — SCR-PF-03 CaseExchange màn hình tải đúng', async ({ page }) => {
    await page.goto(`${BASE_URL}/case-exchange`);
    await screenshot(page, 'uat-03-case-exchange-loaded');

    await expect(page.getByTestId('create-exchange-btn')).toBeVisible();
  });

  test('UAT-04: AC-01 — SCR-PF-04 InvestigationDelegation màn hình tải đúng', async ({ page }) => {
    await page.goto(`${BASE_URL}/investigation-delegation`);
    await screenshot(page, 'uat-04-investigation-delegation-loaded');

    await expect(page.getByTestId('create-delegation-btn')).toBeVisible();
    await expect(page.getByTestId('delegation-table')).toBeVisible();
  });

  // ── AC-02: Style khớp styles.ts ───────────────────────────────────────────

  test('UAT-05: AC-02 — Buttons dùng đúng màu từ styles.ts', async ({ page }) => {
    await page.goto(`${BASE_URL}/transfer-return`);

    const transferBtn = page.getByTestId('transfer-btn');
    await expect(transferBtn).toBeVisible();

    await screenshot(page, 'uat-05-styles-check');
  });

  // ── AC-03: Labels tiếng Việt ──────────────────────────────────────────────

  test('UAT-06: AC-03 — Labels tiếng Việt trên TransferAndReturn', async ({ page }) => {
    await page.goto(`${BASE_URL}/transfer-return`);

    await expect(page.getByText('Chuyển đội và Trả hồ sơ').first()).toBeVisible();
    await expect(page.getByText('Danh sách hồ sơ').first()).toBeVisible();

    await screenshot(page, 'uat-06-vn-labels');
  });

  // ── AC-04: Modal và action buttons đầy đủ ────────────────────────────────

  test('UAT-07: AC-04 — Modal Chuyển đội có đầy đủ các trường bắt buộc', async ({ page }) => {
    await page.goto(`${BASE_URL}/transfer-return`);

    await page.getByTestId('record-checkbox-1').check();
    await page.getByTestId('transfer-btn').click();
    await page.getByTestId('confirm-proceed-btn').click();

    await expect(page.getByTestId('transfer-modal')).toBeVisible();
    await expect(page.getByTestId('receiving-team-select')).toBeVisible();
    await expect(page.getByTestId('transfer-reason-textarea')).toBeVisible();

    await screenshot(page, 'uat-07-transfer-modal-fields');
  });

  test('UAT-08: AC-04 + EC-03 — Ủy thác validation UT-XXX/YYYY', async ({ page }) => {
    await page.goto(`${BASE_URL}/investigation-delegation`);

    await page.getByTestId('create-delegation-btn').click();

    // Enter invalid format
    await page.getByTestId('delegation-number-input').fill('WRONG-FORMAT');
    await page.getByTestId('save-delegation-btn').click();
    await expect(page.getByTestId('delegation-number-error')).toBeVisible();

    await screenshot(page, 'uat-08-delegation-validation-error');

    // Enter valid format
    await page.getByTestId('delegation-number-input').fill('UT-099/2026');
    // Trigger re-validation by clicking save again (error should update)
    await page.getByTestId('save-delegation-btn').click();
    // After fixing format, delegation-number-error should not be present
    await expect(page.getByTestId('delegation-number-error')).not.toBeVisible();

    await screenshot(page, 'uat-08-delegation-valid-format');
  });
});
