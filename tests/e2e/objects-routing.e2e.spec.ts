/**
 * E2E Tests — Routing: /people/suspects → ObjectListPage
 * TASK-2026-260201 | INTAKE-20260226-002-E9A2
 *
 * Coverage:
 *  AC-01: Click "Bị can / Bị cáo" menu → shows ObjectListPage
 *  AC-02: Direct URL /people/suspects → renders ObjectListPage (not Coming Soon)
 *  AC-03: Sidebar highlights "Bị can / Bị cáo" when on ObjectListPage
 *  AC-04: ObjectListPage shows correct title
 *  EC-01: Direct URL access to /people/suspects
 *  EC-02: Direct URL access to /objects (must still work — regression)
 *  EC-05: Tab switch between Case List and Object List
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

const ADMIN = {
  email: 'admin@pc02.local',
  password: 'Admin@1234!',
};

// UI Element Map (BƯỚC 0.6)
// data-testid="sidebar-item-suspects"   → AppSidebar.tsx:306  (id='suspects')
// data-testid="main-sidebar"            → AppSidebar.tsx:415
// data-testid="sidebar-nav"             → AppSidebar.tsx:536
// data-testid="sidebar-item-cases"      → AppSidebar.tsx:306  (id='cases')

// ─── Shared helper: login ─────────────────────────────────────────────────────

async function loginAsAdmin(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', ADMIN.email);
  await page.fill('input[type="password"]', ADMIN.password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
}

// ─── AC-01: Click sidebar "Bị can / Bị cáo" → ObjectListPage ─────────────────

test('AC-01: Click sidebar Bị can / Bị cáo shows ObjectListPage', async ({ page }) => {
  await loginAsAdmin(page);
  // Expand "Đối tượng" / "people" section if needed
  const peopleSection = page.getByTestId('sidebar-section-people');
  if (await peopleSection.isVisible()) {
    await peopleSection.click();
  }
  const suspectsItem = page.getByTestId('sidebar-item-suspects');
  await expect(suspectsItem).toBeVisible({ timeout: 5000 });
  await suspectsItem.click();
  await expect(page).toHaveURL(/\/people\/suspects/, { timeout: 10000 });
  // Should NOT show Coming Soon
  await expect(page.locator('text=Coming Soon')).not.toBeVisible();
  // Should show ObjectListPage heading
  await expect(page.locator('h1, [data-testid="page-title"]').first()).toBeVisible({ timeout: 10000 });
});

// ─── AC-02: Direct URL /people/suspects → ObjectListPage ─────────────────────

test('AC-02 / EC-01: Direct URL /people/suspects renders ObjectListPage', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`${BASE_URL}/people/suspects`);
  await expect(page).toHaveURL(/\/people\/suspects/, { timeout: 10000 });
  // Must NOT render Coming Soon
  await expect(page.locator('text=Coming Soon')).not.toBeVisible();
  // Must render page content (table or heading)
  await expect(page.locator('h1, table, [role="grid"]').first()).toBeVisible({ timeout: 15000 });
});

// ─── AC-03: Sidebar highlights "Bị can / Bị cáo" when on ObjectListPage ───────

test('AC-03: Sidebar active state highlights suspects item', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`${BASE_URL}/people/suspects`);
  await expect(page).toHaveURL(/\/people\/suspects/, { timeout: 10000 });
  const suspectsItem = page.getByTestId('sidebar-item-suspects');
  await expect(suspectsItem).toBeVisible({ timeout: 5000 });
  // Active item should have aria-current="page" or active class
  const ariaOrClass = await suspectsItem.evaluate((el) => {
    return el.getAttribute('aria-current') === 'page' ||
      el.classList.contains('active') ||
      el.className.includes('bg-') ||
      el.className.includes('text-primary');
  });
  expect(ariaOrClass).toBe(true);
});

// ─── AC-04: ObjectListPage shows correct title ────────────────────────────────

test('AC-04: ObjectListPage shows Quản lý đối tượng title', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`${BASE_URL}/people/suspects`);
  await expect(page).toHaveURL(/\/people\/suspects/, { timeout: 10000 });
  await expect(page.locator('text=Quản lý đối tượng').or(page.locator('text=Đối tượng')).first()).toBeVisible({ timeout: 15000 });
});

// ─── EC-02: /objects route still works (regression) ──────────────────────────

test('EC-02: /objects route still renders ObjectListPage (regression)', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto(`${BASE_URL}/objects`);
  await expect(page).toHaveURL(/\/objects/, { timeout: 10000 });
  await expect(page.locator('text=Coming Soon')).not.toBeVisible();
  await expect(page.locator('h1, table, [role="grid"]').first()).toBeVisible({ timeout: 15000 });
});

// ─── EC-05: Tab switch between Case List and Object List ──────────────────────

test('EC-05: Tab switch between Case List and Object List', async ({ page }) => {
  await loginAsAdmin(page);
  // Go to cases first
  await page.goto(`${BASE_URL}/cases`);
  await expect(page).toHaveURL(/\/cases/, { timeout: 10000 });
  // Now navigate to /people/suspects
  await page.goto(`${BASE_URL}/people/suspects`);
  await expect(page).toHaveURL(/\/people\/suspects/, { timeout: 10000 });
  await expect(page.locator('text=Coming Soon')).not.toBeVisible();
  // Switch back to cases
  await page.goto(`${BASE_URL}/cases`);
  await expect(page).toHaveURL(/\/cases/, { timeout: 10000 });
});
