/**
 * PR2 E2E: popup "In chứng từ" Vụ án — mẫu thiếu biến required → auto bỏ check + "Thiếu" →
 * nhập bổ sung (manualValues) → mẫu mở lại → tick → xuất file. ĐỒNG BỘ với Đơn thư (PR1).
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

test('Vụ án: mẫu thiếu biến required → bổ sung trong popup → mở lại → xuất', async ({ page, request }) => {
  const tok = await token(request);
  const cs = await (await request.get(`${API}/cases?limit=1`, { headers: { Authorization: `Bearer ${tok}` } })).json();
  const caseId = (cs.data?.data || cs.data || [])[0].id;
  const tl = await (await request.get(`${API}/cases/export-templates`, { headers: { Authorization: `Bearer ${tok}` } })).json();
  const tpls: Array<{ id: string; code: string }> = tl.data || tl;
  const qd = tpls.find((t) => t.code === 'QD_KHOI_TO_VU_AN')!;

  await new LoginPage(page).login(ADMIN_U, ADMIN_P);
  await page.goto(`/cases/${caseId}/edit`);
  await page.getByTestId('btn-print-docs').click();
  await expect(page.getByTestId('dynamic-export-modal')).toBeVisible({ timeout: 20_000 });

  const cb = page.getByTestId(`dyn-export-checkbox-${qd.id}`);
  await expect(cb).toBeDisabled(); // thiếu toiDanh/noiXayRa → khoá
  await expect(page.getByTestId(`dyn-export-missing-${qd.id}`)).toContainText('Thiếu');

  // Nhập 2 biến thiếu của QD_KHOI_TO_VU_AN (manualValues — dynamic không có "Lưu bổ sung")
  await page.getByTestId('dyn-export-fill-toiDanh').fill('Trộm cắp tài sản');
  await page.getByTestId('dyn-export-fill-noiXayRa').fill('Quận 1');

  // Mẫu mở lại → tick → xuất
  await expect(cb).toBeEnabled({ timeout: 10_000 });
  await cb.check();
  const dl = page.waitForEvent('download', { timeout: 25_000 });
  await page.getByTestId('dyn-export-confirm').click();
  expect((await dl).suggestedFilename()).toMatch(/\.(docx|zip)$/i);
});
