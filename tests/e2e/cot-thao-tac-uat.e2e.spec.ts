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

/**
 * ĐIỆN THOẠI (≤767px) — 08/10/2026: cột Thao tác chỉ còn MỘT nút ⋮ cỡ 32px, mọi thao tác nằm trong bảng trượt từ đáy.
 * Đo ở 390×844 (iPhone 14) và 360×640 (Android nhỏ), trên Chromium thật (project e2e-chromium) và WebKit nếu có.
 */
for (const [rong, cao] of [
  [390, 844],
  [360, 640],
] as const) {
  test.describe(`điện thoại ${rong}×${cao}`, () => {
    test.use({ viewport: { width: rong, height: cao } });

    for (const [ten, url] of [
      ['Đơn thư', '/petitions'],
      ['Vụ việc', '/incidents'],
      ['Vụ án', '/cases'],
      ['Tổng hợp', '/comprehensive-list'],
    ] as const) {
      test(`T-${ten}: mỗi dòng đúng 1 nút ⋮ ≥32px, trang không tràn ngang`, async ({ page }) => {
        await moDanhSach(page, url);
        const ket = await page.evaluate(() => {
          const loi: string[] = [];
          let soO = 0;
          for (const tr of [...document.querySelectorAll('tbody tr')].slice(0, 20)) {
            const nutMenu = tr.querySelector<HTMLElement>('[data-testid^="btn-action-menu-"]');
            if (!nutMenu) continue;
            soO++;
            const o = nutMenu.closest('td')!;
            const nut = [...o.querySelectorAll('button')];
            if (nut.length !== 1) loi.push(`ô có ${nut.length} nút (phải đúng 1)`);
            const r = nutMenu.getBoundingClientRect();
            if (r.width < 31.5 || r.height < 31.5) loi.push(`nút ⋮ ${Math.round(r.width)}×${Math.round(r.height)} (<32px)`);
            const khung = o.getBoundingClientRect();
            if (r.left < khung.left - 0.5 || r.right > khung.right + 0.5) loi.push('nút ⋮ tràn khỏi ô');
            // Anh yêu cầu 08/10/2026: cột Thao tác trên điện thoại chỉ rộng bằng dấu ⋮, nhường chỗ cho dữ liệu.
            if (khung.width > 44) loi.push(`ô Thao tác rộng ${Math.round(khung.width)}px (>44px)`);
          }
          // Tiêu đề: không còn chữ "Thao tác" nhìn thấy, ô tiêu đề cũng hẹp.
          const th = [...document.querySelectorAll('thead th')].find((t) => (t.textContent ?? '').trim() === 'Thao tác');
          if (!th) loi.push('không thấy ô tiêu đề Thao tác');
          else {
            if (th.getBoundingClientRect().width > 44) loi.push(`ô tiêu đề Thao tác rộng ${Math.round(th.getBoundingClientRect().width)}px (>44px)`);
            const chu = th.querySelector('[class~="max-md:sr-only"]');
            const rc = chu?.getBoundingClientRect();
            if (!chu || (rc && (rc.width > 1.5 || rc.height > 1.5))) loi.push('chữ tiêu đề "Thao tác" vẫn hiện trên điện thoại');
          }
          const tran = document.documentElement.scrollWidth - document.documentElement.clientWidth;
          return { soO, loi, tran };
        });
        expect(ket.soO, 'phải có ô Thao tác để đo').toBeGreaterThan(0);
        expect(ket.loi).toEqual([]);
        expect(ket.tran, 'trang cuộn ngang ngoài ý muốn (px)').toBeLessThanOrEqual(0);
      });
    }

    test('Đơn thư: bấm ⋮ → bảng đáy nằm trọn khung nhìn; Esc đóng; tiêu điểm trả về nút ⋮; cuộn nền mở khoá', async ({ page }) => {
      await moDanhSach(page, '/petitions');
      const nut = page.locator('tbody tr [data-testid^="btn-action-menu-"]').first();
      await nut.focus();
      await nut.click();
      const bang = page.getByRole('dialog');
      await expect(bang).toBeVisible();
      const hop = await bang.boundingBox();
      expect(hop, 'bảng phải có toạ độ').not.toBeNull();
      expect(hop!.x).toBeGreaterThanOrEqual(0);
      expect(hop!.x + hop!.width).toBeLessThanOrEqual(rong + 0.5);
      expect(hop!.y + hop!.height).toBeLessThanOrEqual(cao + 0.5);
      expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
      expect(await bang.getByRole('button').count()).toBeGreaterThanOrEqual(3);
      await page.keyboard.press('Escape');
      await expect(bang).toBeHidden();
      await expect(nut).toBeFocused();
      expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
    });

    test('Đơn thư: bấm nền mờ đóng bảng, không mở hồ sơ', async ({ page }) => {
      await moDanhSach(page, '/petitions');
      const truoc = page.url();
      await page.locator('tbody tr [data-testid^="btn-action-menu-"]').first().click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.getByTestId('bang-thao-tac-duoi-nen').click({ position: { x: 5, y: 5 } });
      await expect(page.getByRole('dialog')).toBeHidden();
      expect(page.url()).toBe(truoc);
    });
  });
}
