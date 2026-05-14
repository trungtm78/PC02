/**
 * Playwright capture script for PC02 User Guide screenshots.
 *
 * Usage:
 *   cd frontend
 *   node ../docs/user-guide/_capture.js
 *
 * Outputs PNGs to docs/user-guide/screenshots/.
 * Login uses production admin credentials (passed via env var or hardcoded
 * fallback — DO NOT commit credentials).
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE = process.env.PC02_BASE || 'http://171.244.40.245';
const EMAIL = process.env.PC02_ADMIN_EMAIL || 'admin@pc02.local';
const PASSWORD = process.env.PC02_ADMIN_PASSWORD;
if (!PASSWORD) {
  console.error('ERROR: set PC02_ADMIN_PASSWORD env var before running.');
  process.exit(1);
}

const OUT = path.resolve(__dirname, 'screenshots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// Route catalog — all menu routes + login.
// `audience`: 'user' | 'admin' — used by HTML generator to split sections.
const ROUTES = [
  // ── Auth / public ──────────────────────────────────────────
  { id: 'login', path: '/login', label: 'Đăng nhập', audience: 'user', module: 'auth', skipAuth: true },

  // ── Phần 1: End user (cán bộ điều tra) ────────────────────
  { id: 'dashboard', path: '/dashboard', label: 'Tổng quan (Dashboard)', audience: 'user', module: 'core' },
  { id: 'kpi', path: '/kpi', label: 'Chỉ tiêu KPI', audience: 'user', module: 'core' },
  { id: 'calendar', path: '/calendar', label: 'Lịch công tác', audience: 'user', module: 'core' },

  // Cases (Vụ án)
  { id: 'cases-list', path: '/cases', label: 'Danh sách vụ án', audience: 'user', module: 'cases' },
  { id: 'cases-new', path: '/add-new-record', label: 'Thêm mới hồ sơ vụ án', audience: 'user', module: 'cases' },
  { id: 'cases-comprehensive', path: '/comprehensive-list', label: 'Danh sách tổng hợp', audience: 'user', module: 'cases' },
  { id: 'cases-initial', path: '/initial-cases', label: 'Hồ sơ tiếp nhận', audience: 'user', module: 'cases' },

  // Incidents (Vụ việc)
  { id: 'incidents-list', path: '/vu-viec', label: 'Danh sách vụ việc', audience: 'user', module: 'incidents' },
  { id: 'incidents-new', path: '/vu-viec/new', label: 'Thêm vụ việc mới', audience: 'user', module: 'incidents' },

  // Petitions (Đơn thư)
  { id: 'petitions-list', path: '/petitions', label: 'Danh sách đơn thư', audience: 'user', module: 'petitions' },
  { id: 'petitions-new', path: '/petitions/new', label: 'Tiếp nhận đơn mới', audience: 'user', module: 'petitions' },

  // Subjects (Đối tượng)
  { id: 'subjects-objects', path: '/objects', label: 'Danh sách đối tượng', audience: 'user', module: 'subjects' },
  { id: 'subjects-suspects', path: '/people/suspects', label: 'Nghi phạm', audience: 'user', module: 'subjects' },
  { id: 'subjects-victims', path: '/people/victims', label: 'Bị hại', audience: 'user', module: 'subjects' },
  { id: 'subjects-witnesses', path: '/people/witnesses', label: 'Nhân chứng', audience: 'user', module: 'subjects' },

  // Lawyers
  { id: 'lawyers', path: '/lawyers', label: 'Luật sư', audience: 'user', module: 'lawyers' },

  // Workflow
  { id: 'workflow-transfer', path: '/transfer-return', label: 'Luân chuyển / Trả lại', audience: 'user', module: 'workflow' },
  { id: 'workflow-guidance', path: '/guidance', label: 'Hướng dẫn nghiệp vụ', audience: 'user', module: 'workflow' },
  { id: 'workflow-exchange', path: '/case-exchange', label: 'Trao đổi vụ án', audience: 'user', module: 'workflow' },
  { id: 'workflow-delegation', path: '/investigation-delegation', label: 'Ủy quyền điều tra', audience: 'user', module: 'workflow' },

  // Classification
  { id: 'class-ward-cases', path: '/ward/cases', label: 'Vụ án theo phường/xã', audience: 'user', module: 'classification' },
  { id: 'class-ward-incidents', path: '/ward/incidents', label: 'Vụ việc theo phường/xã', audience: 'user', module: 'classification' },
  { id: 'class-prosecutor', path: '/prosecutor-proposal', label: 'Đề xuất VKS', audience: 'user', module: 'classification' },
  { id: 'class-duplicates', path: '/classification/duplicates', label: 'Đơn trùng lặp', audience: 'user', module: 'classification' },
  { id: 'class-others', path: '/classification/others', label: 'Phân loại khác', audience: 'user', module: 'classification' },

  // Reports
  { id: 'reports-export', path: '/export-reports', label: 'Xuất hồ sơ đơn thư', audience: 'user', module: 'reports' },
  { id: 'reports-monthly', path: '/reports/monthly', label: 'Báo cáo tháng', audience: 'user', module: 'reports' },
  { id: 'reports-quarterly', path: '/reports/quarterly', label: 'Báo cáo quý', audience: 'user', module: 'reports' },
  { id: 'reports-district', path: '/statistics/district', label: 'Thống kê phường/xã', audience: 'user', module: 'reports' },
  { id: 'reports-overdue', path: '/settings/overdue-records', label: 'Hồ sơ quá hạn', audience: 'user', module: 'reports' },
  { id: 'reports-activity', path: '/activity-log', label: 'Nhật ký hoạt động', audience: 'user', module: 'reports' },
  { id: 'reports-tdac', path: '/reports/tdac', label: 'Báo cáo TĐC', audience: 'user', module: 'reports' },
  { id: 'reports-stat48', path: '/reports/stat48', label: 'Thống kê 48 trường', audience: 'user', module: 'reports' },
  { id: 'reports-phu-luc', path: '/reports/phu-luc-1-6', label: 'Phụ lục 1-6 BCA', audience: 'user', module: 'reports' },

  // Documents & directories
  { id: 'documents', path: '/documents', label: 'Tài liệu hồ sơ', audience: 'user', module: 'system' },
  { id: 'directory', path: '/danh-muc', label: 'Danh mục tra cứu', audience: 'user', module: 'system' },
  { id: 'master-class', path: '/phan-loai', label: 'Lớp phân loại', audience: 'user', module: 'system' },
  { id: 'settings', path: '/settings', label: 'Cấu hình hệ thống', audience: 'user', module: 'system' },

  // ── Phần 2: Admin ─────────────────────────────────────────
  { id: 'admin-users', path: '/nguoi-dung', label: 'Quản lý người dùng', audience: 'admin', module: 'admin' },
  { id: 'admin-teams', path: '/to-nhom', label: 'Tổ/Đội công tác', audience: 'admin', module: 'admin' },
  { id: 'admin-deadline', path: '/admin/deadline-rules', label: 'Quy tắc thời hạn', audience: 'admin', module: 'admin' },
  { id: 'admin-settings', path: '/admin/settings', label: 'Cấu hình admin', audience: 'admin', module: 'admin' },
];

async function login(page) {
  console.log('  → Logging in via UI...');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
  // Find email input + password input. Try common selectors.
  const emailInput = await page.$('input[type="email"], input[name="email"], input[name="username"]');
  const passwordInput = await page.$('input[type="password"]');
  if (!emailInput || !passwordInput) {
    throw new Error('Login form inputs not found');
  }
  await emailInput.fill(EMAIL);
  await passwordInput.fill(PASSWORD);
  // Submit
  const submit = await page.$('button[type="submit"]');
  if (submit) {
    await submit.click();
  } else {
    await passwordInput.press('Enter');
  }
  // Wait for redirect away from /login
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 });
  console.log('  ✓ Logged in, redirected to', page.url());
}

async function capture(page, route) {
  const file = path.join(OUT, `${route.id}.png`);
  try {
    console.log(`[${route.id}] ${route.path}`);
    await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle', timeout: 30000 });
    // Give SPA time to render lists, modals, etc.
    await page.waitForTimeout(1500);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`  ✓ saved ${path.basename(file)}`);
    return { ok: true, file };
  } catch (e) {
    console.error(`  ✗ ${route.id}: ${e.message}`);
    return { ok: false, error: e.message };
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'vi-VN',
  });
  const page = await ctx.newPage();

  const results = [];
  for (const route of ROUTES) {
    if (route.skipAuth) {
      const r = await capture(page, route);
      results.push({ ...route, ...r });
      continue;
    }
    if (results.findIndex((r) => r.id === 'login') >= 0 && results.length === 1) {
      // Login once after the public /login screenshot
      await login(page);
    }
    const r = await capture(page, route);
    results.push({ ...route, ...r });
  }

  await browser.close();

  const ok = results.filter((r) => r.ok).length;
  const fail = results.filter((r) => !r.ok);
  console.log(`\nDone: ${ok}/${results.length} ok, ${fail.length} failed`);
  if (fail.length) {
    console.log('Failed:', fail.map((f) => `${f.id} (${f.error})`).join(', '));
  }

  // Write manifest for HTML generator
  fs.writeFileSync(
    path.join(OUT, '_manifest.json'),
    JSON.stringify(results, null, 2),
    'utf8',
  );
})();
