/**
 * UAT Tests — ObjectListPage Dynamic Stats & Sidebar
 * TASK_ID: TASK-2026-261225 | EXECUTION_ID: EX-261225-B4A2
 *
 * UAT Scenarios (from UAT_Plan.md):
 *   UAT-01: Suspect stats — Tổng số, Tạm giam, Truy nã, Điều tra
 *   UAT-02: Victim stats  — Tổng số, Đã bồi thường, Đang xử lý, Tổng thiệt hại
 *   UAT-03: Witness stats — Tổng số, Đã khai báo, Chờ khai báo, Từ chối
 *   UAT-04: Sidebar relocation — "Quản lý Luật sư" under "Quản lý đối tượng"
 *   UAT-05: Add button label matches subject type
 */

import { test, expect, type Page } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5175';
const TEST_EMAIL = process.env.TEST_EMAIL_DTV ?? 'dtv@pc02.catp.gov.vn';
const TEST_PASS  = process.env.TEST_PASS_DTV  ?? 'DieuTra@PC02#2026';

// ─── Login helper (sessionStorage injection — bypasses backend dependency) ────
// The authStore.isAuthenticated() checks sessionStorage.getItem('accessToken').
// We inject a valid-format token to bypass the ProtectedRoute guard
// without needing a live backend connection for UI-only tests.

const MOCK_JWT = [
  'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9',
  Buffer.from(JSON.stringify({ sub: 'test-001', email: TEST_EMAIL, role: 'OFFICER', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + 3600 })).toString('base64').replace(/=/g, ''),
  'mock-signature',
].join('.');

async function loginAndGoto(page: Page, routePath: string) {
  // First visit to establish page context
  await page.goto(`${BASE_URL}/login`);
  // Inject mock access token to bypass ProtectedRoute
  await page.evaluate((token) => {
    sessionStorage.setItem('accessToken', token);
  }, MOCK_JWT);
  // Navigate directly to target route
  await page.goto(`${BASE_URL}${routePath}`);
}

// ─── UAT-01: Suspect Stats ────────────────────────────────────────────────────

test.describe('UAT-01: Stats thẻ Bị can', () => {
  test('UAT-01: Verify stats show Tổng số, Tạm giam, Truy nã, Điều tra', async ({ page }) => {
    await loginAndGoto(page, '/people/suspects');
    await expect(page.getByTestId('page-title')).toBeVisible({ timeout: 10000 });

    // ① Initial state screenshot
    await page.screenshot({
      path: 'tests/screenshots/obj-mgmt-uat01-step01-suspects-initial.png',
      fullPage: true,
    });

    // Verify 4 stat cards exist
    const statCards = page.locator('[data-testid^="stat-card"]');
    await expect(statCards).toHaveCount(4);

    // Verify "Tổng số" card (always stat-card-total)
    await expect(page.getByTestId('stat-card-total')).toBeVisible();

    // Verify "Tạm giam" card
    const detainedCard = page.getByTestId('stat-card-detained');
    await expect(detainedCard).toBeVisible();
    const detainedText = await detainedCard.textContent();
    expect(detainedText).toContain('Tạm giam');

    // Verify "Truy nã" card
    const wantedCard = page.getByTestId('stat-card-wanted');
    await expect(wantedCard).toBeVisible();
    const wantedText = await wantedCard.textContent();
    expect(wantedText).toContain('Truy nã');

    // Verify "Đang điều tra" card
    const investigatingCard = page.getByTestId('stat-card-investigating');
    await expect(investigatingCard).toBeVisible();
    const investigatingText = await investigatingCard.textContent();
    expect(investigatingText).toContain('Điều tra');

    // ③ Stats verified screenshot
    await page.screenshot({
      path: 'tests/screenshots/obj-mgmt-uat01-step02-suspects-stats-verified.png',
      fullPage: true,
    });
  });
});

// ─── UAT-02: Victim Stats ──────────────────────────────────────────────────────

test.describe('UAT-02: Stats thẻ Bị hại', () => {
  test('UAT-02: Verify stats show Tổng số, Đã bồi thường, Đang xử lý, Tổng thiệt hại', async ({ page }) => {
    await loginAndGoto(page, '/people/victims');
    await expect(page.getByTestId('page-title')).toBeVisible({ timeout: 10000 });

    // ① Initial state screenshot
    await page.screenshot({
      path: 'tests/screenshots/obj-mgmt-uat02-step01-victims-initial.png',
      fullPage: true,
    });

    // Verify 4 stat cards
    const statCards = page.locator('[data-testid^="stat-card"]');
    await expect(statCards).toHaveCount(4);

    // Verify "Tổng số"
    await expect(page.getByTestId('stat-card-total')).toBeVisible();

    // Verify "Đã bồi thường"
    const compensatedCard = page.getByTestId('stat-card-compensated');
    await expect(compensatedCard).toBeVisible();
    const compensatedText = await compensatedCard.textContent();
    expect(compensatedText).toContain('Bồi thường');

    // Verify "Đang xử lý"
    const processingCard = page.getByTestId('stat-card-processing');
    await expect(processingCard).toBeVisible();
    const processingText = await processingCard.textContent();
    expect(processingText).toContain('Xử lý');

    // Verify "Tổng thiệt hại"
    const damageCard = page.getByTestId('stat-card-damage');
    await expect(damageCard).toBeVisible();
    const damageText = await damageCard.textContent();
    expect(damageText).toContain('Thiệt hại');

    // ③ Stats verified screenshot
    await page.screenshot({
      path: 'tests/screenshots/obj-mgmt-uat02-step02-victims-stats-verified.png',
      fullPage: true,
    });
  });
});

// ─── UAT-03: Witness Stats ────────────────────────────────────────────────────

test.describe('UAT-03: Stats thẻ Nhân chứng', () => {
  test('UAT-03: Verify stats show Tổng số, Đã khai báo, Chờ khai báo, Từ chối', async ({ page }) => {
    await loginAndGoto(page, '/people/witnesses');
    await expect(page.getByTestId('page-title')).toBeVisible({ timeout: 10000 });

    // ① Initial state screenshot
    await page.screenshot({
      path: 'tests/screenshots/obj-mgmt-uat03-step01-witnesses-initial.png',
      fullPage: true,
    });

    // Verify 4 stat cards
    const statCards = page.locator('[data-testid^="stat-card"]');
    await expect(statCards).toHaveCount(4);

    // Verify "Tổng số"
    await expect(page.getByTestId('stat-card-total')).toBeVisible();

    // Verify "Đã khai báo"
    const declaredCard = page.getByTestId('stat-card-declared');
    await expect(declaredCard).toBeVisible();
    const declaredText = await declaredCard.textContent();
    expect(declaredText).toContain('Khai báo');

    // Verify "Chờ khai báo"
    const pendingCard = page.getByTestId('stat-card-pending');
    await expect(pendingCard).toBeVisible();
    const pendingText = await pendingCard.textContent();
    expect(pendingText).toContain('Chờ');

    // Verify "Từ chối"
    const refusedCard = page.getByTestId('stat-card-refused');
    await expect(refusedCard).toBeVisible();
    const refusedText = await refusedCard.textContent();
    expect(refusedText).toContain('Từ chối');

    // ③ Stats verified screenshot
    await page.screenshot({
      path: 'tests/screenshots/obj-mgmt-uat03-step02-witnesses-stats-verified.png',
      fullPage: true,
    });
  });
});

// ─── UAT-04: Sidebar Relocation ───────────────────────────────────────────────

test.describe('UAT-04: Sidebar — Quản lý Luật sư di chuyển', () => {
  test('UAT-04: "Quản lý Luật sư" visible under "Quản lý đối tượng"', async ({ page }) => {
    await loginAndGoto(page, '/people/suspects');

    // ① Initial sidebar screenshot
    await page.screenshot({
      path: 'tests/screenshots/obj-mgmt-uat04-step01-sidebar-initial.png',
      fullPage: false,
    });

    const sidebar = page.getByTestId('main-sidebar');
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // The "people" submenu is auto-expanded on load.
    // Only click to expand if the lawyers item is not already visible.
    const lawyerItem = page.getByTestId('sidebar-item-lawyers');
    const isLawyerVisible = await lawyerItem.isVisible();
    if (!isLawyerVisible) {
      const peopleMenu = page.getByTestId('sidebar-item-people');
      await expect(peopleMenu).toBeVisible();
      await peopleMenu.click();
    }

    // ② Action screenshot (expanded)
    await page.screenshot({
      path: 'tests/screenshots/obj-mgmt-uat04-step02-sidebar-people-expanded.png',
      fullPage: false,
    });

    // Verify lawyers appears under people
    await expect(lawyerItem).toBeVisible({ timeout: 5000 });

    // ③ Success state screenshot
    await page.screenshot({
      path: 'tests/screenshots/obj-mgmt-uat04-step03-sidebar-lawyer-visible.png',
      fullPage: false,
    });
  });
});

// ─── UAT-05: Add Button Dynamic Label ─────────────────────────────────────────

test.describe('UAT-05: Nút "Thêm" có label động theo subjectType', () => {
  test('UAT-05a: Suspect → "Thêm bị can"', async ({ page }) => {
    await loginAndGoto(page, '/people/suspects');
    await expect(page.getByTestId('btn-add-subject')).toBeVisible({ timeout: 10000 });
    const btnText = await page.getByTestId('btn-add-subject').textContent();
    expect(btnText).toContain('Thêm bị can');

    await page.screenshot({
      path: 'tests/screenshots/obj-mgmt-uat05-step01-suspect-btn.png',
      fullPage: false,
    });
  });

  test('UAT-05b (AC-04): Victim → "Thêm bị hại" opens correct modal', async ({ page }) => {
    await loginAndGoto(page, '/people/victims');
    await expect(page.getByTestId('btn-add-subject')).toBeVisible({ timeout: 10000 });

    // ① Initial state
    await page.screenshot({
      path: 'tests/screenshots/obj-mgmt-uat05-step02-victim-btn-initial.png',
      fullPage: false,
    });

    const btnText = await page.getByTestId('btn-add-subject').textContent();
    expect(btnText).toContain('Thêm bị hại');

    // ② Click button
    await page.getByTestId('btn-add-subject').click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });

    // ③ Success state (modal opened)
    await page.screenshot({
      path: 'tests/screenshots/obj-mgmt-uat05-step03-victim-modal-opened.png',
      fullPage: true,
    });
  });

  test('UAT-05c: Witness → "Thêm nhân chứng"', async ({ page }) => {
    await loginAndGoto(page, '/people/witnesses');
    await expect(page.getByTestId('btn-add-subject')).toBeVisible({ timeout: 10000 });
    const btnText = await page.getByTestId('btn-add-subject').textContent();
    expect(btnText).toContain('Thêm nhân chứng');

    await page.screenshot({
      path: 'tests/screenshots/obj-mgmt-uat05-step04-witness-btn.png',
      fullPage: false,
    });
  });
});
