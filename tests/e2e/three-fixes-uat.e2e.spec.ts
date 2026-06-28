/**
 * E2E TRÌNH DUYỆT THẬT (chromium) — phủ 3 thay đổi vừa ship, đúng phần "bấm nút" mà unit/component
 * test (mock) không chạm tới:
 *  - PR1: sửa đơn thư → Lưu → KHÔNG lỗi "người dùng khác đã thay đổi" (409).
 *  - PR2: tạo MỚI đơn thư + đính file (stage) → Lưu → upload thành công (form điều hướng về danh sách).
 *  - PR3: vụ án → "In chứng từ" → modal liệt kê ≥5 mẫu → Xuất file → trình duyệt tải file về.
 *
 * Chạy: node node_modules/playwright/cli.js test tests/e2e/three-fixes-uat.e2e.spec.ts --project=e2e-chromium
 * (webServer tự khởi động backend :3000 + frontend :5179).
 */
import { test, expect, APIRequestContext } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

const ADMIN_U = process.env.ADMIN_USERNAME || 'admin@pc02.local';
const ADMIN_P = process.env.ADMIN_PASSWORD || '68@Love2love68';
const API = process.env.UAT_API_URL || 'http://localhost:3000/api/v1';

// PNG 1x1 THẬT (magic-byte hợp lệ → qua validate file của BE).
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

async function apiToken(request: APIRequestContext): Promise<string> {
  const r = await request.post(`${API}/auth/login`, { data: { username: ADMIN_U, password: ADMIN_P } });
  const b = await r.json();
  return (b.data || b).accessToken;
}
async function firstId(request: APIRequestContext, tok: string, path: string): Promise<string> {
  const r = await request.get(`${API}/${path}?limit=1`, { headers: { Authorization: `Bearer ${tok}` } });
  const b = await r.json();
  return (b.data?.data || b.data || [])[0].id;
}

test.describe('E2E browser thật — 3 fix', () => {
  test.beforeEach(async ({ page }) => {
    await new LoginPage(page).login(ADMIN_U, ADMIN_P);
  });

  test('PR2 — tạo mới đơn thư + đính file → lưu thành công (stage-then-upload)', async ({ page }) => {
    await page.goto('/petitions/new');
    await page.getByTestId('field-senderIsAnonymous').check();
    await page.getByTestId('field-petitionType').selectOption('TO_CAO');
    await page.getByTestId('field-summary').fill('UAT E2E — tóm tắt');
    await page.getByTestId('field-detailContent').fill('UAT E2E — nội dung chi tiết');

    // đính file vào khu vực stage (create mode)
    await page.getByTestId('stage-file-input').setInputFiles({ name: 'uat-bang-chung.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByTestId('stage-queued-list')).toContainText('uat-bang-chung.png');

    // Lưu — onSave CHỈ điều hướng về danh sách khi upload file đã stage THÀNH CÔNG (uploadFailed=0).
    await page.getByTestId('btn-save-top-main').click();
    await expect(page).toHaveURL(/\/petitions(\?|$|\/)/, { timeout: 20_000 });
    // không có thông báo lỗi upload
    await expect(page.getByText(/file tải lên lỗi/i)).toHaveCount(0);
  });

  test('PR1 — sửa đơn thư + lưu → KHÔNG lỗi 409 "người dùng khác đã thay đổi"', async ({ page, request }) => {
    const tok = await apiToken(request);
    const id = await firstId(request, tok, 'petitions');
    await page.goto(`/petitions/${id}/edit`);
    await page.getByTestId('field-summary').fill('UAT E2E sửa ' + Date.now());
    await page.getByTestId('btn-save-top-main').click();
    await expect(page).toHaveURL(/\/petitions(\?|$|\/)/, { timeout: 20_000 });
    await expect(page.getByText(/đã được chỉnh sửa bởi người dùng khác/i)).toHaveCount(0);
  });

  test('PR3 — vụ án → In chứng từ → ≥5 mẫu → xuất file tải về', async ({ page, request }) => {
    const tok = await apiToken(request);
    const id = await firstId(request, tok, 'cases');
    await page.goto(`/cases/${id}/edit`);

    await page.getByTestId('btn-print-docs').click();
    await expect(page.getByTestId('dynamic-export-modal')).toBeVisible({ timeout: 20_000 });
    const checkboxes = page.locator('[data-testid^="dyn-export-checkbox-"]');
    await expect(checkboxes.first()).toBeVisible({ timeout: 10_000 });
    expect(await checkboxes.count()).toBeGreaterThanOrEqual(5);

    // Xuất file → trình duyệt phát sự kiện download
    const downloadPromise = page.waitForEvent('download', { timeout: 25_000 });
    await page.getByTestId('dyn-export-confirm').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.(docx|zip)$/i);
  });
});
