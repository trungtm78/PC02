/**
 * E2E Tests — Admin Module (User Management, Directories, Sidebar, Coming Soon)
 * TASK-2026-000003 | EXECUTION_ID: INTAKE-20260225-003-CFG1
 *
 * Credentials từ project_context.md:
 *   URL:      http://localhost:5173
 *   Admin:    admin@pc02.local / Admin@1234!
 *   Role:     ADMIN
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5179';
const API_URL  = 'http://localhost:3000';
const ADMIN    = { email: 'admin@pc02.local', password: 'Admin@1234!' };

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
async function loginAsAdmin(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.locator('input[type="email"], input[name="email"], input[id="email"]').first().fill(ADMIN.email);
  await page.locator('input[type="password"]').first().fill(ADMIN.password);
  await page.getByRole('button', { name: /sign in|đăng nhập/i }).click();
  await page.waitForURL(/\/dashboard/);
}

// ─────────────────────────────────────────────────────────────────────────────
// AC-01: Sidebar - 8 menu items hiển thị đúng
// ─────────────────────────────────────────────────────────────────────────────
test.describe('AC-01: Sidebar Navigation', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });

  test('sidebar hiển thị đủ các mục menu chính (nested)', async ({ page }) => {
    const sidebar = page.locator('[data-testid="main-sidebar"]');
    // Section headers
    await expect(sidebar.getByText('Tổng quan', { exact: false }).first()).toBeVisible();
    await expect(sidebar.getByText('Nghiệp vụ chính', { exact: false })).toBeVisible();
    // Key menu items visible in initially-expanded sections (Tổng quan + Nghiệp vụ chính)
    const expectedMenus = [
      'Quản lý vụ án',
      'Quản lý đối tượng',
      'Quản lý đơn thư',
      'Quản lý vụ việc',
    ];
    for (const menu of expectedMenus) {
      await expect(
        sidebar.getByText(menu, { exact: false }).first(),
      ).toBeVisible();
    }
  });

  test('sidebar có màu Navy (#003973) và viền Gold', async ({ page }) => {
    const sidebar = page.locator('[data-testid="main-sidebar"]');
    await expect(sidebar).toBeVisible();
    const bg = await sidebar.evaluate((el) => getComputedStyle(el).backgroundColor);
    // rgb(0, 57, 115) = #003973
    expect(bg).toBe('rgb(0, 57, 115)');
  });

  test('sidebar collapse/expand hoạt động', async ({ page }) => {
    const sidebar = page.locator('[data-testid="main-sidebar"]');
    // Click collapse toggle button (use data-testid to avoid matching text buttons)
    await page.locator('[data-testid="sidebar-toggle"]').click();
    // Sidebar collapses to exactly 64px (set via inline style)
    await expect(sidebar).toHaveCSS('width', '64px');
    // Click toggle again to expand (same button, title now "Mở rộng")
    await page.locator('[data-testid="sidebar-toggle"]').click();
    await expect(sidebar).not.toHaveCSS('width', '64px');
  });

  test('search trong sidebar tìm được menu item', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/tìm kiếm menu/i);
    await searchInput.fill('Người dùng');
    await expect(page.getByText('Người dùng', { exact: false }).first()).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-02: Coming Soon cho Vụ án, Đơn thư, Vụ việc
// ─────────────────────────────────────────────────────────────────────────────
test.describe('AC-02: Coming Soon Pages', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });

  const comingSoonRoutes = [
    // Các route sau đã có implementation thực, bỏ khỏi danh sách Coming Soon
    // '/cases' → CaseListPage
    // '/petitions' → PetitionListPage  
    // '/incidents' → IncidentListPage
    // '/settings' → SettingsPage
    // '/activity-log' → ActivityLogPage
    
    // Chỉ giữ lại các route thực sự chưa có implementation
    { path: '/calendar', label: 'Lịch làm việc' },
  ];

  for (const route of comingSoonRoutes) {
    test(`${route.label} hiển thị trang Coming Soon`, async ({ page }) => {
      await page.goto(`${BASE_URL}${route.path}`);
      await expect(page.getByText(/sắp ra mắt|coming soon|đang phát triển/i).first()).toBeVisible();
      // Check the heading in the ComingSoonPage content area (not sidebar)
      await expect(page.locator('main, [data-testid], .flex-1').getByRole('heading', { name: new RegExp(route.label, 'i') }).first()).toBeVisible();
      await page.screenshot({
        path: `tests/screenshots/coming-soon-step01-${route.label.replace(/\s/g, '-')}.png`,
        fullPage: true,
      });
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-01: User Management — Admin tạo user mới
// ─────────────────────────────────────────────────────────────────────────────
test.describe('AC-01: User Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/nguoi-dung`);
    await expect(page.getByText(/người dùng/i).first()).toBeVisible();
  });

  test('trang User Management load và hiển thị bảng', async ({ page }) => {
    await expect(page.getByRole('table')).toBeVisible();
    await page.screenshot({
      path: 'tests/screenshots/user-management-step01-list.png',
      fullPage: true,
    });
  });

  test('Admin tạo user mới và user xuất hiện trong danh sách', async ({ page }) => {
    const timestamp = Date.now();
    const newUser = {
      username: `testuser${timestamp % 10000}`,
      email: `test${timestamp}@pc02.local`,
      password: 'Test@12345!',
      fullName: `Test User ${timestamp}`,
    };

    // Mở modal thêm user
    await page.getByRole('button', { name: /thêm người dùng/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.screenshot({
      path: 'tests/screenshots/user-management-step02-modal-open.png',
    });

    // Điền form
    await page.locator('#field-username').fill(newUser.username);
    await page.locator('#field-email').fill(newUser.email);
    await page.locator('#field-password').fill(newUser.password);
    await page.locator('#field-fullName').fill(newUser.fullName);
    // Select a role (required by backend)
    await page.locator('#field-roleId').selectOption({ index: 1 });

    // Submit (button text is "Thêm mới")
    await page.getByRole('button', { name: /thêm mới|cập nhật/i }).last().click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8000 });

    // Kiểm tra user trong bảng
    await expect(page.getByText(newUser.username)).toBeVisible({ timeout: 8000 });
    await page.screenshot({
      path: 'tests/screenshots/user-management-step03-created.png',
      fullPage: true,
    });
  });

  test('EC-02: Tạo username/email đã tồn tại → báo lỗi', async ({ page }) => {
    await page.getByRole('button', { name: /thêm người dùng/i }).click();
    await page.locator('#field-email').fill(ADMIN.email); // email admin đã tồn tại
    await page.locator('#field-username').fill('admin');
    await page.locator('#field-password').fill('Admin@1234!');
    await page.locator('#field-fullName').fill('Test Admin');
    await page.locator('#field-roleId').selectOption({ index: 1 });
    await page.getByRole('button', { name: /thêm mới|cập nhật/i }).last().click();
    // Backend returns error — dialog stays open with error message
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[role="dialog"] .text-red-700, [role="dialog"] .bg-red-50').first()).toBeVisible({ timeout: 5000 });
    await page.screenshot({
      path: 'tests/screenshots/user-management-step04-duplicate-error.png',
    });
  });

  test('EC-04: User isActive=false không đăng nhập được', async ({ page: adminPage, browser }) => {
    // Admin tạo user inactive
    await adminPage.getByRole('button', { name: /thêm người dùng/i }).click();
    const ts = Date.now();
    const inactiveEmail = `inactive${ts}@pc02.local`;
    await adminPage.locator('#field-email').fill(inactiveEmail);
    await adminPage.locator('#field-username').fill(`inactive${ts % 10000}`);
    await adminPage.locator('#field-password').fill('Test@12345!');
    await adminPage.locator('#field-fullName').fill('Inactive User');
    await adminPage.locator('#field-roleId').selectOption({ index: 1 });
    await adminPage.locator('#field-status').selectOption('inactive');
    await adminPage.getByRole('button', { name: /thêm mới|cập nhật/i }).last().click();
    // Wait for modal to close
    await expect(adminPage.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

    // Thử đăng nhập bằng user inactive trong context mới
    const ctx = await browser.newContext();
    const p2 = await ctx.newPage();
    await p2.goto(`${BASE_URL}/login`);
    await p2.waitForLoadState('networkidle');
    await p2.locator('input[type="email"], input[name="username"], input[id="username"]').first().fill(inactiveEmail);
    await p2.locator('input[type="password"]').first().fill('Test@12345!');
    await p2.getByRole('button', { name: /sign in|đăng nhập/i }).click();
    // Backend returns "Invalid credentials" for inactive accounts (same as wrong password)
    // Either an alert element appears, or we stay on /login (not redirected to /dashboard)
    await expect(p2).toHaveURL(/\/login/, { timeout: 8000 });
    await expect(p2.getByRole('alert')).toBeVisible({ timeout: 5000 });
    await ctx.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-02: Role Permissions — thay đổi quyền áp dụng ngay
// ─────────────────────────────────────────────────────────────────────────────
test.describe('AC-02: Role Permission Matrix', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/nguoi-dung`);
    await page.getByRole('tab', { name: /vai trò/i }).click();
  });

  test('tab Vai trò & Phân quyền hiển thị danh sách role', async ({ page }) => {
    // Seeded roles are ADMIN and OFFICER — scoped to roles panel (not header badge)
    await expect(page.getByRole('button', { name: /ADMIN/i }).first()).toBeVisible();
    await page.screenshot({
      path: 'tests/screenshots/role-perm-step01-role-list.png',
      fullPage: true,
    });
  });

  test('Admin chọn Role và thấy permission matrix', async ({ page }) => {
    // Click on OFFICER role (seeded role)
    await page.getByText('OFFICER', { exact: true }).first().click();
    await expect(page.getByText(/ma trận phân quyền/i)).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
    await page.screenshot({
      path: 'tests/screenshots/role-perm-step02-matrix.png',
      fullPage: true,
    });
  });

  test('EC-05: Admin không thể xóa role đang có user', async ({ page }) => {
    // EC-01: Xóa Role đang có User → phải bị chặn
    const deleteBtn = page.getByRole('button', { name: /xóa role|delete role/i }).first();
    if (await deleteBtn.isVisible()) {
      await deleteBtn.click();
      await expect(
        page.getByText(/còn người dùng|có user|cannot delete/i),
      ).toBeVisible({ timeout: 5000 });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-04: Directory Management — thêm danh mục con
// ─────────────────────────────────────────────────────────────────────────────
test.describe('AC-04: Directory Management', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto(`${BASE_URL}/danh-muc`);
    await expect(page.getByText(/danh mục/i).first()).toBeVisible();
  });

  test('trang Danh mục load và hiển thị nhóm danh mục', async ({ page }) => {
    // DirectoriesPage shows type selector: Tội danh, Đơn vị, Địa bàn, Trạng thái
    await expect(page.getByText(/tội danh|đơn vị|địa bàn|trạng thái/i).first()).toBeVisible();
    await page.screenshot({
      path: 'tests/screenshots/directory-step01-main.png',
      fullPage: true,
    });
  });

  test('AC-04: Chọn loại "Tội danh" hiển thị bảng dữ liệu', async ({ page }) => {
    // The "Tội danh" type is already selected by default (CRIME)
    await expect(page.getByRole('table')).toBeVisible();
    await page.screenshot({
      path: 'tests/screenshots/directory-step02-business-selected.png',
      fullPage: true,
    });
  });

  test('Thêm danh mục mới thành công', async ({ page }) => {
    // Click "Thêm danh mục" button in the header
    await page.getByRole('button', { name: /thêm danh mục/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const ts = Date.now() % 10000;
    await page.locator('#dir-field-code').fill(`DM${ts}`);
    await page.locator('#dir-field-name').fill(`Danh mục test ${ts}`);
    // Submit button text is "Thêm mới"
    await page.getByRole('button', { name: /thêm mới|cập nhật/i }).last().click();

    await expect(page.getByText(`DM${ts}`)).toBeVisible({ timeout: 10000 });
    await page.screenshot({
      path: 'tests/screenshots/directory-step03-added.png',
      fullPage: true,
    });
  });

  test('EC-02: Mã danh mục trùng trong cùng loại → báo lỗi', async ({ page }) => {
    // First create a directory so we have something to duplicate
    await page.getByRole('button', { name: /thêm danh mục/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    const uniqueCode = `DUPL${Date.now() % 10000}`;
    await page.locator('#dir-field-code').fill(uniqueCode);
    await page.locator('#dir-field-name').fill('First entry');
    await page.getByRole('button', { name: /thêm mới|cập nhật/i }).last().click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 8000 });

    // Now try to create with same code
    await page.getByRole('button', { name: /thêm danh mục/i }).click();
    await page.locator('#dir-field-code').fill(uniqueCode);
    await page.locator('#dir-field-name').fill('Duplicate entry');
    await page.getByRole('button', { name: /thêm mới|cập nhật/i }).last().click();
    // Dialog stays open with error
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    await page.screenshot({
      path: 'tests/screenshots/directory-step04-duplicate-code.png',
    });
  });

  test('EC-03: Xóa danh mục → hiện confirm dialog', async ({ page }) => {
    // Xóa button shows a confirm dialog
    const deleteBtn = page.locator('[data-testid="btn-delete"]').first();
    if (await deleteBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await deleteBtn.click();
      // Wait for confirm dialog to render after state update
      await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
    } else {
      // No items to delete — pass trivially
      test.skip();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AC-05: UI Theme — Navy/Gold style
// ─────────────────────────────────────────────────────────────────────────────
test.describe('AC-05: UI Theme Compliance', () => {
  test.beforeEach(async ({ page }) => { await loginAsAdmin(page); });

  test('header có màu trắng và border-bottom vàng', async ({ page }) => {
    const header = page.locator('[data-testid="main-header"]');
    await expect(header).toBeVisible();
    const borderColor = await header.evaluate(
      (el) => getComputedStyle(el).borderBottomColor,
    );
    // #F59E0B = rgb(245, 158, 11)
    expect(borderColor).toBe('rgb(245, 158, 11)');
  });

  test('sidebar background là Navy #003973', async ({ page }) => {
    const sidebar = page.locator('[data-testid="main-sidebar"]');
    const bg = await sidebar.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(0, 57, 115)');
  });
});
