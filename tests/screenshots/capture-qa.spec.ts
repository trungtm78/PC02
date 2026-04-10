/**
 * QA Screenshot Capture — TASK-2026-000004
 * Captures required screenshots per qa-plan.md §4
 */
import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';
const ADMIN = { email: 'admin@pc02.local', password: 'Admin@1234!' };

async function loginAsAdmin(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.locator('input[type="email"], input[name="email"], input[id="email"]').first().fill(ADMIN.email);
  await page.locator('input[type="password"]').first().fill(ADMIN.password);
  await page.getByRole('button', { name: /sign in|đăng nhập/i }).click();
  await page.waitForURL(/\/dashboard/);
}

test('QA-SS-01: login-step01-visual.png', async ({ page }) => {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  await page.screenshot({
    path: 'tests/screenshots/login-step01-visual.png',
    fullPage: true,
  });
});

test('QA-SS-02: sidebar-step01-expanded.png', async ({ page }) => {
  await loginAsAdmin(page);
  // Expand all sections to show nested menu structure
  const sidebar = page.locator('[data-testid="main-sidebar"]');
  await expect(sidebar).toBeVisible();

  // Click "Mở rộng" button to expand all sections
  await page.locator('[data-testid="main-sidebar"]').getByText('Mở rộng', { exact: false }).click();
  // Wait for last section to be visible (confirms all sections expanded)
  await expect(sidebar.getByText('Cài đặt hệ thống', { exact: false })).toBeVisible();

  await page.screenshot({
    path: 'tests/screenshots/sidebar-step01-expanded.png',
    fullPage: true,
  });
});

test('QA-SS-03: sidebar-step02-compact.png', async ({ page }) => {
  await loginAsAdmin(page);
  const sidebar = page.locator('[data-testid="main-sidebar"]');
  await expect(sidebar).toBeVisible();

  // Collapse sidebar using toggle button
  await page.locator('[data-testid="sidebar-toggle"]').click();
  await expect(sidebar).toHaveCSS('width', '64px');

  await page.screenshot({
    path: 'tests/screenshots/sidebar-step02-compact.png',
    fullPage: true,
  });
});
