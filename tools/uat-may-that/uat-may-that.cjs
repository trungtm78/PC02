/**
 * UAT trên MÁY THẬT — những mệnh đề có chủ ngữ là CÁN BỘ.
 *
 * Ca kiểm đơn vị chốt registry, chuỗi hiển thị, phép so. Nhưng "cán bộ bấm được nút In rồi tải
 * được tệp" là mệnh đề về SẢN PHẨM, nên bằng chứng phải đi qua giao diện.
 *
 * Chạy: UAT_PASS=... node uat-may-that.cjs
 */
const { chromium } = require('playwright');

const CO_SO = process.env.UAT_BASE || 'http://171.244.40.245';
const TK = process.env.UAT_USER || 'admin@pc02.local';
const MK = process.env.UAT_PASS;
const MA_CO_STT_CU = process.env.UAT_MA_CO_STT_CU || '2017-259';
const MA_TRA_HO_SO = process.env.UAT_MA_TRA_HO_SO || '2017-18';

const ketQua = [];
function ghi(ma, menhDe, dat, chuThich) {
  ketQua.push({ ma, menhDe, dat });
  console.log(`${dat ? 'PASS' : 'FAIL'}  ${ma}  ${menhDe}${chuThich ? ' — ' + chuThich : ''}`);
}

(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage();

  try {
    // Ô đăng nhập có `id` nhưng KHÔNG có nhãn liên kết — dò theo nhãn là trượt, và khi ấy mọi
    // mệnh đề sau đều đỏ GIẢ.
    await page.goto(`${CO_SO}/login`, { waitUntil: 'domcontentloaded' });
    await page.locator('#username').fill(TK);
    await page.locator('#password').fill(MK);
    await page.getByRole('button', { name: /đăng nhập/i }).click();
    await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 60000 });

    // Khoá tìm kiếm CÓ TIỀN TỐ (`incidents_q`). Dùng `q` trần thì trang bỏ qua và hiện danh
    // sách mặc định — toàn bản nhập thử, không bản nào có STT cũ.
    await page.goto(`${CO_SO}/incidents?incidents_q=${encodeURIComponent(MA_CO_STT_CU)}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.getByRole('table').first().waitFor({ timeout: 60000 });
    await page.waitForTimeout(3000);
    ghi(
      'M2-5',
      'Danh sách Vụ việc hiện STT cũ trong cột STT',
      await page.getByText(/\(STT cũ:/).first().isVisible().catch(() => false),
    );

    // testid dựng theo TỪNG DÒNG (`btn-print-<id>`) — khớp chính xác là trượt.
    const nutIn = page.locator('[data-testid^="btn-print-"]').first();
    const coNut = await nutIn.isVisible().catch(() => false);
    ghi('M1-4a', 'Cột Thao tác có nút In trên từng dòng', coNut);

    let moDuoc = false;
    if (coNut) {
      await nutIn.click();
      moDuoc = await page
        .getByRole('dialog')
        .filter({ hasText: /in chứng từ|xuất chứng từ|chọn mẫu/i })
        .first()
        .isVisible({ timeout: 30000 })
        .catch(() => false);
    }
    ghi('M1-4', 'Bấm nút In mở đúng màn in chứng từ', moDuoc);

    let taiDuoc = false;
    let tenTep = '';
    if (moDuoc) {
      const o = page.getByRole('dialog').locator('input[type="checkbox"]');
      const soO = await o.count();
      for (let i = 0; i < soO; i += 1) {
        if (!(await o.nth(i).isChecked())) {
          await o.nth(i).check();
          break;
        }
      }
      const cho = page.waitForEvent('download', { timeout: 90000 }).catch(() => null);
      await page.getByRole('dialog').getByRole('button', { name: /xuất|tải|in/i }).last().click();
      const tep = await cho;
      taiDuoc = !!tep;
      tenTep = tep ? await tep.suggestedFilename() : '';
    }
    ghi('M1-5', 'Chọn mẫu rồi tải được tệp Word', taiDuoc, tenTep);

    // Màn CHI TIẾT Vụ việc không có nút In (nút ấy ở màn sửa và ở danh sách) — tìm ở đó là đỏ giả.
    await page.goto(`${CO_SO}/incidents?incidents_q=${encodeURIComponent(MA_TRA_HO_SO)}`, {
      waitUntil: 'domcontentloaded',
    });
    await page.getByRole('table').first().waitFor({ timeout: 60000 });
    await page.waitForTimeout(3000);
    let thayMau = false;
    const nut2 = page.locator('[data-testid^="btn-print-"]').first();
    if (await nut2.isVisible({ timeout: 30000 }).catch(() => false)) {
      await nut2.click();
      await page.waitForTimeout(3000);
      const ds = await page.getByRole('dialog').getByText(/mẫu hệ cũ/i).allTextContents();
      thayMau = ds.some((t) => /trả hồ sơ/i.test(t));
    }
    ghi('M3-12', 'Vụ việc di trú từ hồ sơ Trả hồ sơ thấy mẫu ấy trong popup', thayMau);
  } finally {
    await browser.close();
  }

  const truot = ketQua.filter((k) => !k.dat);
  console.log(`
${ketQua.length - truot.length}/${ketQua.length} mệnh đề đạt`);
  process.exit(truot.length ? 1 : 0);
})().catch((e) => {
  console.error('LỖI BỘ CHẠY:', e.message);
  process.exit(2);
});
