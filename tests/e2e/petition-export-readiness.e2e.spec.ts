/**
 * PR1 E2E: popup "In chứng từ" Đơn thư — mẫu thiếu thông tin → auto bỏ check + "Thiếu: …" →
 * nhập bổ sung NGAY trong popup → Lưu bổ sung → mẫu mở lại → xuất file.
 */
import { test, expect, APIRequestContext } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

const ADMIN_U = process.env.ADMIN_USERNAME || 'admin@pc02.local';
const ADMIN_P = process.env.ADMIN_PASSWORD || '68@Love2love68';
const API = process.env.UAT_API_URL || 'http://localhost:3000/api/v1';

async function token(req: APIRequestContext) {
  const b = await (await req.post(`${API}/auth/login`, { data: { username: ADMIN_U, password: ADMIN_P } })).json();
  return (b.data || b).accessToken;
}

test('Đơn thư: mẫu thiếu → bổ sung trong popup → mở lại → xuất', async ({ page, request }) => {
  const tok = await token(request);
  // Đơn nặc danh → thiếu Tên người gửi (baseline) + Nhận thấy/Đề xuất (PHIEU_DE_XUAT).
  const cr = await request.post(`${API}/petitions`, {
    headers: { Authorization: `Bearer ${tok}` },
    data: { petitionType: 'TO_CAO', summary: 'E2E readiness', detailContent: 'E2E readiness nội dung', receivedDate: new Date().toISOString().slice(0, 10), senderIsAnonymous: true },
  });
  const id = (await cr.json()).data.id;

  await new LoginPage(page).login(ADMIN_U, ADMIN_P);
  await page.goto(`/petitions/${id}/edit`);
  await page.getByTestId('btn-print-docs').click();
  await expect(page.getByTestId('export-documents-modal')).toBeVisible();

  // PHIEU_DE_XUAT thiếu → disabled + có dòng "Thiếu"
  const pdx = page.getByTestId('export-doc-checkbox-PHIEU_DE_XUAT');
  await expect(pdx).toBeDisabled();
  await expect(page.getByTestId('export-doc-missing-PHIEU_DE_XUAT')).toContainText('Thiếu');

  // Bổ sung union field: Tên người gửi + Nhận thấy + Đề xuất
  await page.getByTestId('export-doc-fill-senderName').fill('Nguyễn Văn Test');
  await page.getByTestId('export-doc-fill-nhanThay').fill('Nhận thấy E2E');
  await page.getByTestId('export-doc-fill-deXuat').fill('Đề xuất E2E');
  await page.getByTestId('export-doc-save-fill').click();

  // Sau lưu → re-fetch → PHIEU_DE_XUAT mở lại + tick
  await expect(pdx).toBeEnabled({ timeout: 15_000 });
  await expect(pdx).toBeChecked();

  // Xuất → trình duyệt tải file
  const dl = page.waitForEvent('download', { timeout: 20_000 });
  await page.getByTestId('btn-export-confirm').click();
  expect((await dl).suggestedFilename()).toMatch(/\.(docx|zip)$/i);
});
