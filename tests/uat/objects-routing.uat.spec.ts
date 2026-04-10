/**
 * UAT Tests — Routing: /people/suspects → ObjectListPage
 * TASK-2026-260201 | INTAKE-20260226-002-E9A2
 *
 * Screenshot Spec (MANDATORY):
 *  objects-step01-sidebar-objects.png  → sidebar expanded, Đối tượng menu visible (AC-01, UAT-05)
 *  objects-step02-object-list-page.png → after clicking Bị can / Bị cáo (AC-02, UAT-05)
 *
 * Storage: test-results/uat/screenshots/
 */

import { test, expect, type Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const BASE_URL = 'http://localhost:5173';
// Use process.cwd() (monorepo root) to avoid WSL __dirname path issues
const SCREENSHOT_DIR = path.join(process.cwd(), 'test-results', 'uat', 'screenshots');

const ADMIN = {
  email: 'admin@pc02.local',
  password: 'Admin@1234!',
};

// ─── Ensure screenshot directory exists ───────────────────────────────────────

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
});

// ─── Shared helper: login ─────────────────────────────────────────────────────

async function loginAsAdmin(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', ADMIN.email);
  await page.fill('input[type="password"]', ADMIN.password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
}

// ─── UAT-05: Full navigation flow with screenshots ───────────────────────────

test('UAT-05: Sidebar Bị can / Bị cáo navigates to ObjectListPage with screenshots', async ({ page }) => {
  await loginAsAdmin(page);

  // Navigate to dashboard so sidebar is visible
  await page.goto(`${BASE_URL}/dashboard`);
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

  // Expand "Đối tượng" / "people" section if collapsed
  const peopleSection = page.getByTestId('sidebar-section-people');
    if (await peopleSection.isVisible()) {
      const isExpanded = await peopleSection.getAttribute('aria-expanded');
      if (isExpanded === 'false' || isExpanded === null) {
        await peopleSection.click();
        // Wait for suspects item to appear after section expands
        await page.getByTestId('sidebar-item-suspects').waitFor({ state: 'visible', timeout: 5000 });
      }
    }

  // SCREENSHOT 01: sidebar with Đối tượng expanded
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'objects-step01-sidebar-objects.png'),
    fullPage: false,
  });

  // Click Bị can / Bị cáo
  const suspectsItem = page.getByTestId('sidebar-item-suspects');
  await expect(suspectsItem).toBeVisible({ timeout: 5000 });
  await suspectsItem.click();
  await expect(page).toHaveURL(/\/people\/suspects/, { timeout: 10000 });

  // Wait for ObjectListPage to render
  await expect(page.locator('h1, table, [role="grid"]').first()).toBeVisible({ timeout: 15000 });

  // SCREENSHOT 02: ObjectListPage rendered at /people/suspects
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, 'objects-step02-object-list-page.png'),
    fullPage: true,
  });

  // Verify not Coming Soon
  await expect(page.locator('text=Coming Soon')).not.toBeVisible();

  // Verify title
  await expect(
    page.locator('text=Quản lý đối tượng').or(page.locator('text=Đối tượng')).first()
  ).toBeVisible({ timeout: 10000 });
});

// ─── UAT: Direct URL access ───────────────────────────────────────────────────

test('UAT: Direct /people/suspects URL renders ObjectListPage', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`${BASE_URL}/people/suspects`);
  await expect(page).toHaveURL(/\/people\/suspects/, { timeout: 10000 });
  await expect(page.locator('text=Coming Soon')).not.toBeVisible();
  await expect(page.locator('h1, table, [role="grid"]').first()).toBeVisible({ timeout: 15000 });
});

// ─── UAT: /objects regression ────────────────────────────────────────────────

test('UAT: /objects route still works after fix', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`${BASE_URL}/objects`);
  await expect(page).toHaveURL(/\/objects/, { timeout: 10000 });
  await expect(page.locator('text=Coming Soon')).not.toBeVisible();
  await expect(page.locator('h1, table, [role="grid"]').first()).toBeVisible({ timeout: 15000 });
});
