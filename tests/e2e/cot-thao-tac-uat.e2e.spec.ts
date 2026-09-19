import { test, expect, type Page } from '@playwright/test';
import { getAuthToken } from '../helpers/auth';

/**
 * UAT GIAO DIỆN — cột Thao tác (anh báo 19/09/2026 kèm ảnh: "dấu 3 chấm đứng bị dính chữ").
 *
 * Oracle (điều người dùng thấy): MỌI nút của cột Thao tác (các nút nhanh + nút ⋮ "Thao tác khác") nằm TRỌN trong ô
 * của nó — không nút nào tràn sang đè chữ cột bên cạnh, không nút nào bị cắt mất. Đo bằng toạ độ trên Chrome thật,
 * không suy từ mã.
 *
 * Đo prod trước bản vá: 3 màn × 20/20 dòng — 5 nút trong ô 144px (9rem), nút ⋮ vượt 32px đè lên cột STT.
 *
 * CHỈ ĐỌC — chạy được trên prod:
 *   UAT_PROD=1 BASE_URL=<gốc giao diện> npx playwright test --project=e2e-chromium tests/e2e/cot-thao-tac-uat.e2e.spec.ts
 */
test.use({ viewport: { width: 1366, height: 800 }, serviceWorkers: 'block' });

async function moDanhSach(page: Page, url: string) {
  const token = getAuthToken();
  expect(token, 'global-setup phải đăng nhập được').toBeTruthy();
  await page.addInitScript((t: string) => sessionStorage.setItem('accessToken', t), token);
  await page.goto(url);
  await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
}

for (const [ten, url] of [
  ['Đơn thư', '/petitions'],
  ['Vụ việc', '/incidents'],
  ['Vụ án', '/cases'],
  ['Tổng hợp', '/comprehensive-list'],
] as const) {
  test(`T-${ten}: nút cột Thao tác nằm trọn trong ô, không đè cột bên, không bị cắt`, async ({ page }) => {
    await moDanhSach(page, url);
    const ket = await page.evaluate(() => {
      const loi: string[] = [];
      let soO = 0;
      for (const tr of [...document.querySelectorAll('tbody tr')].slice(0, 20)) {
        const o = [...tr.querySelectorAll('td')].find((td) => td.querySelector('[aria-label="Thao tác khác"]'));
        if (!o) continue;
        soO++;
        const khung = o.getBoundingClientRect();
        for (const nut of o.querySelectorAll('button')) {
          const r = nut.getBoundingClientRect();
          if (r.left < khung.left - 0.5 || r.right > khung.right + 0.5) {
            loi.push(`${nut.getAttribute('aria-label') ?? nut.title}: vượt ${Math.round(r.right - khung.right)}px`);
          }
        }
      }
      return { soO, loi };
    });
    expect(ket.soO, 'phải có ô Thao tác để đo').toBeGreaterThan(0);
    expect(ket.loi, 'nút tràn khỏi ô Thao tác').toEqual([]);
  });
}
