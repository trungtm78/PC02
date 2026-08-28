import { test, expect } from '@playwright/test';
import { loginToPage, getAuthToken } from '../helpers/auth';

/**
 * UAT giao diện trên MÁY THẬT: công tắc ở màn Quản lý mẫu chứng từ, và hai nút chọn hàng loạt ở
 * popup In chứng từ.
 *
 * Ca kiểm thành phần chạy trên DOM giả với dữ liệu bịa. Bài này bấm đúng thứ cán bộ bấm, trên
 * dữ liệu thật — bài học 26/08/2026: ca kiểm xanh ba vòng vẫn sót bốn lỗi chặn.
 *
 * Bài KHÔNG để lại thay đổi: cờ nào bật lên đều được tắt lại ở cuối.
 */
const API = process.env.API_BASE ?? 'http://171.244.40.245/api/v1';

test.describe('UAT giao diện · tích sẵn & chọn hàng loạt', () => {
  test('công tắc "Tích sẵn khi in" bật/tắt được ngay trên danh sách mẫu', async ({ page, request }) => {
    await loginToPage(page, '/settings/document-templates');

    const congTac = page.locator('[data-testid^="btn-tich-san-"]').first();
    await expect(congTac, 'màn Quản lý mẫu chứng từ phải có công tắc').toBeVisible({ timeout: 20_000 });

    const truoc = await congTac.getAttribute('aria-checked');
    await congTac.click();
    await expect(congTac).toHaveAttribute('aria-checked', truoc === 'true' ? 'false' : 'true', {
      timeout: 10_000,
    });

    // Tải lại trang: giá trị phải CÒN, tức là đã ghi xuống CSDL chứ không chỉ đổi trên màn hình.
    await page.reload();
    const congTacSau = page.locator('[data-testid^="btn-tich-san-"]').first();
    await expect(congTacSau).toHaveAttribute('aria-checked', truoc === 'true' ? 'false' : 'true', {
      timeout: 20_000,
    });

    // Trả về như cũ.
    await congTacSau.click();
    await expect(congTacSau).toHaveAttribute('aria-checked', truoc ?? 'false', { timeout: 10_000 });
  });

  test('popup In chứng từ: mở ra không tích sẵn, Chọn tất cả / Bỏ chọn tất cả chạy đúng', async ({
    page,
    request,
  }) => {
    const token = getAuthToken();
    const res = await request.get(`${API}/petitions?limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok(), `không lấy được đơn thư: ${res.status()}`).toBeTruthy();
    const body = await res.json();
    const hoSo = (body?.data?.items ?? body?.data ?? body?.items ?? [])[0];
    expect(hoSo?.id, 'máy thật phải có ít nhất một đơn thư').toBeTruthy();

    await loginToPage(page, `/petitions/${hoSo.id}/edit`);
    await page.getByTestId('btn-print-docs').click();

    const oTich = page.locator('[data-testid^="dyn-export-checkbox-"]');
    await expect(oTich.first()).toBeVisible({ timeout: 30_000 });
    const tong = await oTich.count();
    expect(tong, 'popup phải liệt kê mẫu').toBeGreaterThan(0);

    // Mọi mẫu đang TẮT cờ (mặc định sau khi lên máy thật) → mở ra không ô nào tích.
    expect(await page.locator('[data-testid^="dyn-export-checkbox-"]:checked').count()).toBe(0);
    await expect(page.getByTestId('dyn-export-confirm')).toBeDisabled();

    await page.getByTestId('dyn-export-select-all').click();
    const daTich = await page.locator('[data-testid^="dyn-export-checkbox-"]:checked').count();
    expect(daTich, 'Chọn tất cả phải tích được ít nhất một mẫu').toBeGreaterThan(0);
    // Không mẫu nào bị khoá mà lại được tích.
    expect(
      await page.locator('[data-testid^="dyn-export-checkbox-"]:checked:disabled').count(),
      'mẫu thiếu thông tin không được tích',
    ).toBe(0);
    await expect(page.getByTestId('dyn-export-confirm')).toBeEnabled();

    await page.getByTestId('dyn-export-clear-all').click();
    await expect
      .poll(() => page.locator('[data-testid^="dyn-export-checkbox-"]:checked').count())
      .toBe(0);
    await expect(page.getByTestId('dyn-export-confirm')).toBeDisabled();
  });
});
