/**
 * UAT E2E (Chromium) — Popup Xuất chứng từ Đơn thư + split-button Lưu.
 * Layer 2: verify luồng UI thật (split-button, menu, popup) qua DOM.
 * Data setup (tạo đơn) qua API trong beforeAll; mọi TƯƠNG TÁC test đều qua UI.
 */
import { test, expect, request as pwRequest } from '@playwright/test';

const API = process.env.UAT_BASE_URL || 'http://localhost:3000/api/v1';
const APP = process.env.UAT_APP_URL || 'http://localhost:5173';
const USER = process.env.UAT_USERNAME || 'admin@pc02.local';
const PASS = process.env.UAT_PASSWORD || ''; // BẮT BUỘC set qua env khi chạy (không hardcode mật khẩu)
const DOC7 = ['BIEN_NHAN', 'PHIEU_DE_XUAT', 'PHIEU_CHUYEN_NGUON_TIN', 'PHIEU_CHUYEN_DON', 'THONG_BAO_CHUYEN', 'THONG_BAO_HUONG_DAN', 'THONG_BAO_TRA_LAI'];

let petitionId = '';

test.beforeAll(async () => {
  const req = await pwRequest.newContext();
  const lr = await req.post(`${API}/auth/login`, { data: { username: USER, password: PASS } });
  const token = (await lr.json()).accessToken;
  const auth = { Authorization: `Bearer ${token}` };
  const cr = await req.get(`${API}/crimes?limit=1`, { headers: auth });
  const cb = await cr.json();
  const items = cb.data?.data || cb.data || cb;
  const crimeId = (Array.isArray(items) ? items[0] : items.items[0]).id;
  const pr = await req.post(`${API}/petitions`, {
    headers: auth,
    data: {
      receivedDate: '2026-06-27', senderName: 'UAT E2E', senderPhone: '0900000010',
      senderAddress: '1 UAT', petitionType: 'TO_CAO', crimeChinhId: crimeId, summary: 'UAT E2E',
      detailContent: 'chi tiết', nhanThay: 'a', deXuat: 'b', lyDoChuyen: 'c', canCuPhapLy: 'd',
      huongDanKhoiKien: 'e', lyDoTraDon: 'f',
    },
  });
  petitionId = ((await pr.json()).data || (await pr.json())).id;
  await req.dispose();
});

async function loginUI(page: import('@playwright/test').Page) {
  await page.goto(`${APP}/login`);
  await page.fill('#username', USER);
  await page.fill('#password', PASS);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15000 });
}

test('TC-EXP-M1-split-API: form hiển thị split-button Lưu + caret', async ({ page }) => {
  await loginUI(page);
  await page.goto(`${APP}/petitions/new`);
  await expect(page.getByTestId('btn-save-top-main')).toBeVisible();
  await expect(page.getByTestId('btn-save-top-caret')).toBeVisible();
  await expect(page.getByTestId('btn-save-top-main')).toContainText('Lưu');
});

test('TC-EXP-M1-menu-E2E: caret mở menu "Lưu đơn thư" / "Lưu và xuất file"', async ({ page }) => {
  await loginUI(page);
  await page.goto(`${APP}/petitions/new`);
  await page.getByTestId('btn-save-top-caret').click();
  await expect(page.getByTestId('btn-save-top-item-save')).toBeVisible();
  await expect(page.getByTestId('btn-save-top-item-export')).toBeVisible();
  await expect(page.getByTestId('btn-save-top-item-export')).toContainText('xuất file');
});

test('TC-EXP-M2-popup-E2E: "Lưu và xuất file" → popup 7 mẫu tick sẵn + radio Gộp', async ({ page }) => {
  await loginUI(page);
  await page.goto(`${APP}/petitions/${petitionId}/edit`);
  await expect(page.getByTestId('btn-save-top-caret')).toBeVisible({ timeout: 15000 });
  await page.getByTestId('btn-save-top-caret').click();
  await page.getByTestId('btn-save-top-item-export').click();
  const modal = page.getByTestId('export-documents-modal');
  await expect(modal).toBeVisible({ timeout: 15000 });
  for (const dt of DOC7) {
    await expect(page.getByTestId(`export-doc-checkbox-${dt}`)).toBeChecked();
  }
  await expect(page.getByTestId('export-mode-merged')).toBeChecked();
  await expect(page.getByTestId('export-mode-zip')).not.toBeChecked();
});

test('TC-EXP-M2-toggle-E2E: "Bỏ chọn tất cả" → [Xuất file] disabled', async ({ page }) => {
  await loginUI(page);
  await page.goto(`${APP}/petitions/${petitionId}/edit`);
  await expect(page.getByTestId('btn-save-top-caret')).toBeVisible({ timeout: 15000 });
  await page.getByTestId('btn-save-top-caret').click();
  await page.getByTestId('btn-save-top-item-export').click();
  await expect(page.getByTestId('export-documents-modal')).toBeVisible({ timeout: 15000 });
  await page.getByTestId('btn-toggle-all').click(); // full → bỏ hết
  await expect(page.getByTestId('btn-export-confirm')).toBeDisabled();
});

test('TC-EXP-M2-close-E2E: [Đóng] → đóng popup + về /petitions', async ({ page }) => {
  await loginUI(page);
  await page.goto(`${APP}/petitions/${petitionId}/edit`);
  await expect(page.getByTestId('btn-save-top-caret')).toBeVisible({ timeout: 15000 });
  await page.getByTestId('btn-save-top-caret').click();
  await page.getByTestId('btn-save-top-item-export').click();
  await expect(page.getByTestId('export-documents-modal')).toBeVisible({ timeout: 15000 });
  await page.getByTestId('btn-export-close').click();
  await expect(page.getByTestId('export-documents-modal')).toHaveCount(0);
  await page.waitForURL((u) => u.pathname === '/petitions', { timeout: 10000 });
  expect(new URL(page.url()).pathname).toBe('/petitions');
});
