import { test, expect, type Page } from '@playwright/test';
import { getAuthToken } from '../helpers/auth';

/**
 * UAT GIAO DIỆN — ma trận phân quyền vai trò (19/09/2026). Chrome thật, backend + CSDL thật.
 *
 * Oracle (yêu cầu, không phải mã): quản trị viên mở "Vai trò & Phân quyền", chọn một vai trò → thấy ĐÚNG các quyền
 * vai trò đang giữ (không phải lưới trống); mọi nhóm quyền của hệ thống đều hiện; chưa sửa thì không lưu được; sửa
 * thì hộp xác nhận nói rõ ảnh hưởng. Trước bản vá: lưới luôn TRỐNG (điểm cuối đọc quyền không tồn tại) và "Lưu" xoá
 * sạch quyền vai trò.
 *
 * CHỈ ĐỌC — không bấm "Xác nhận" lưu, nên chạy được trên prod:
 *   UAT_PROD=1 BASE_URL=<gốc giao diện> npx playwright test --project=e2e-chromium tests/e2e/phan-quyen-uat.e2e.spec.ts
 */
const GOC = process.env.BASE_URL ?? 'http://localhost:5173';
const API = `${GOC}/api/v1`;

test.use({ viewport: { width: 1366, height: 800 }, serviceWorkers: 'block' });

async function moMaTran(page: Page, tenVaiTro: RegExp) {
  const token = getAuthToken();
  expect(token, 'global-setup phải đăng nhập được').toBeTruthy();
  await page.addInitScript((t: string) => sessionStorage.setItem('accessToken', t), token);
  await page.goto('/nguoi-dung');
  await page.getByRole('tab', { name: /Vai trò & Phân quyền/ }).click();
  await page.getByRole('button', { name: tenVaiTro }).first().click();
}

async function quyenCua(page: Page, tenVaiTro: string) {
  const h = { Authorization: `Bearer ${getAuthToken()}` };
  const vaiTro = (await (await page.request.get(`${API}/admin/roles`, { headers: h })).json()) as {
    data?: Array<{ id: string; name: string }>;
  } & Array<{ id: string; name: string }>;
  const ds = Array.isArray(vaiTro) ? vaiTro : (vaiTro.data ?? []);
  const vt = ds.find((r) => r.name === tenVaiTro)!;
  const r = await page.request.get(`${API}/admin/roles/${vt.id}/permissions`, { headers: h });
  expect(r.status(), 'điểm cuối đọc quyền phải tồn tại').toBe(200);
  const j = (await r.json()) as { data?: unknown[] } | unknown[];
  return (Array.isArray(j) ? j : (j.data ?? [])) as Array<{ action: string; subject: string }>;
}

test.describe('Ma trận phân quyền vai trò', () => {
  test('P1 chọn "Cán bộ" → số ô đang tích = đúng số quyền vai trò giữ (không phải lưới trống)', async ({ page }) => {
    const quyen = await quyenCua(page, 'OFFICER');
    expect(quyen.length).toBeGreaterThan(0);
    await moMaTran(page, /Cán bộ/);
    const oTich = page.locator('table input[type="checkbox"]:checked');
    await expect(oTich).toHaveCount(quyen.length, { timeout: 20_000 });
  });

  test('P2 lưới có ĐỦ nhóm quyền của hệ thống (không chỉ 8 nhóm cũ): có Luật sư, Mở khoá sửa hồ sơ', async ({ page }) => {
    await moMaTran(page, /Cán bộ/);
    const bang = page.locator('table');
    await expect(bang.getByRole('cell', { name: 'Luật sư', exact: true })).toBeVisible({ timeout: 20_000 });
    await expect(bang.getByRole('cell', { name: 'Mở khoá sửa hồ sơ', exact: true })).toBeVisible();
  });

  test('P3 chưa sửa → "Lưu thay đổi" khoá; tích 1 ô → mở, hộp xác nhận nêu số người và số quyền; Huỷ không lưu', async ({ page }) => {
    const truoc = await quyenCua(page, 'OFFICER');
    await moMaTran(page, /Cán bộ/);
    const luu = page.getByRole('button', { name: /Lưu thay đổi/ });
    await expect(page.locator('table input[type="checkbox"]').first()).toBeVisible({ timeout: 20_000 });
    await expect(luu).toBeDisabled();

    const oTrong = page.locator('table input[type="checkbox"]:not(:checked)').first();
    await oTrong.check();
    await expect(luu).toBeEnabled();
    await luu.click();
    const hop = page.getByRole('dialog');
    await expect(hop).toContainText(/người dùng/);
    await expect(hop).toContainText('Thêm 1 quyền');
    await expect(hop).toContainText('Bỏ 0 quyền');
    await hop.getByRole('button', { name: 'Hủy' }).click();
    await expect(hop).toBeHidden();

    // Không có gì bị ghi.
    expect(await quyenCua(page, 'OFFICER')).toEqual(truoc);
  });
});
