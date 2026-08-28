import { test, expect } from '@playwright/test';
import { loginToPage, getAuthToken } from '../helpers/auth';

/**
 * UAT giao diện trên MÁY THẬT: popup In chứng từ nhớ lựa chọn qua hai lần mở.
 *
 * Ca kiểm thành phần chạy trên DOM giả với dữ liệu bịa. Bài này bấm đúng thứ cán bộ bấm, trên
 * dữ liệu thật, và đi trọn vòng: tích → xuất → đóng → mở lại → phải thấy y nguyên.
 *
 * Bài xoá sạch lựa chọn đã ghi ở cuối, kể cả khi có ca đỏ.
 */
const API = process.env.API_BASE ?? 'http://171.244.40.245/api/v1';

test.describe('UAT giao diện · nhớ lựa chọn in chứng từ', () => {
  test.afterEach(async ({ request }) => {
    const token = getAuthToken();
    for (const tt of ['DON_THU', 'VU_VIEC', 'VU_AN']) {
      await request
        .delete(`${API}/user-export-preferences/${tt}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .catch(() => undefined);
    }
  });

  test('tích → xuất → mở lại phải thấy y nguyên tập mẫu và định dạng', async ({ page, request }) => {
    const token = getAuthToken();
    // Dọn trước để bài chạy từ trạng thái "chưa từng đặt".
    await request.delete(`${API}/user-export-preferences/DON_THU`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const res = await request.get(`${API}/petitions?limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok(), `không lấy được đơn thư: ${res.status()}`).toBeTruthy();
    const hoSo = ((await res.json())?.data ?? [])[0];
    expect(hoSo?.id, 'máy thật phải có ít nhất một đơn thư').toBeTruthy();

    await loginToPage(page, `/petitions/${hoSo.id}/edit`);
    await page.getByTestId('btn-print-docs').click();

    const oTich = page.locator('[data-testid^="dyn-export-checkbox-"]');
    await expect(oTich.first()).toBeVisible({ timeout: 30_000 });

    // Tích mẫu ĐẦU TIÊN còn bấm được, và chọn định dạng .zip.
    const oDau = page.locator('[data-testid^="dyn-export-checkbox-"]:not([disabled])').first();
    await expect(oDau).toBeVisible();
    const maMau = (await oDau.getAttribute('data-testid'))!.replace('dyn-export-checkbox-', '');
    if (!(await oDau.isChecked())) await oDau.check();
    await page.getByTestId('dyn-export-mode-zip').check();

    await page.getByTestId('dyn-export-confirm').click();

    // Lựa chọn phải xuống tới máy chủ — đây là chỗ ca kiểm thành phần không với tới.
    await expect
      .poll(
        async () => {
          const r = await request.get(`${API}/user-export-preferences`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const ban = (await r.json())?.data ?? {};
          return ban?.DON_THU?.mode ?? null;
        },
        { timeout: 30_000 },
      )
      .toBe('zip');

    // Mở LẠI popup: phải thấy đúng lựa chọn ấy, không phải tích lại.
    await page.reload();
    await page.getByTestId('btn-print-docs').click();
    await expect(page.getByTestId(`dyn-export-checkbox-${maMau}`)).toBeChecked({ timeout: 30_000 });
    await expect(page.getByTestId('dyn-export-mode-zip')).toBeChecked();
  });

  test('"Dùng lại mặc định" xoá lựa chọn riêng và quay về cờ admin', async ({ page, request }) => {
    const token = getAuthToken();
    const res = await request.get(`${API}/petitions?limit=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const hoSo = ((await res.json())?.data ?? [])[0];

    // Dựng sẵn một lựa chọn riêng khác mặc định.
    await request.put(`${API}/user-export-preferences/DON_THU`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { luaChon: { templateIds: [], mode: 'merged' } },
    });

    await loginToPage(page, `/petitions/${hoSo.id}/edit`);
    await page.getByTestId('btn-print-docs').click();
    await expect(page.getByTestId('dyn-export-mode-merged')).toBeChecked({ timeout: 30_000 });

    await page.getByTestId('dyn-export-reset-pref').click();

    // Về mặc định: định dạng trở lại "tách từng file", và bản ghi riêng biến mất khỏi máy chủ.
    await expect(page.getByTestId('dyn-export-mode-separate')).toBeChecked({ timeout: 15_000 });
    await expect
      .poll(
        async () => {
          const r = await request.get(`${API}/user-export-preferences`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          return ((await r.json())?.data ?? {})?.DON_THU ?? null;
        },
        { timeout: 30_000 },
      )
      .toBeNull();
  });
});
