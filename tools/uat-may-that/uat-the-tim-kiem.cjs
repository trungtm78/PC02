/**
 * UAT trên MÁY THẬT — ô tìm dạng thẻ (M6). Những mệnh đề có chủ ngữ là CÁN BỘ.
 *
 * Ca kiểm đơn vị chốt điều kiện Prisma và hình dạng thẻ. Nhưng "cán bộ gõ không dấu thì ra hồ sơ có
 * dấu" là mệnh đề về SẢN PHẨM — bằng chứng phải đi qua giao diện thật.
 *
 * CHỈ ĐỌC: bộ này không bấm nút ghi nào. Để chắc, mọi lời gọi ghi (POST/PUT/PATCH/DELETE) bị CHẶN ở
 * tầng mạng — trừ `/auth/login` để đăng nhập được.
 *
 * Chạy:
 *   cd tools/guide-recorder   # nơi có playwright
 *   UAT_PASS='<mật khẩu>' node ../uat-may-that/uat-the-tim-kiem.cjs
 *
 * Thoát 0 khi mọi mệnh đề đạt, 1 khi có mệnh đề trượt, 2 khi BỘ CHẠY hỏng — ba trạng thái khác nhau,
 * vì "bộ chạy hỏng" không phải "sản phẩm hỏng".
 */
const { chromium } = require('playwright');

const CO_SO = process.env.UAT_BASE || 'http://171.244.40.245';
const TK = process.env.UAT_USER || 'admin@pc02.local';
const MK = process.env.UAT_PASS;
/** Chữ KHÔNG DẤU để gõ, và chữ CÓ DẤU phải xuất hiện trong kết quả. */
const CHU_KHONG_DAU = process.env.UAT_CHU_KHONG_DAU || 'nguyen';
const CHU_CO_DAU = process.env.UAT_CHU_CO_DAU || 'Nguyễn';

const ketQua = [];
function ghi(ma, menhDe, dat, chuThich) {
  ketQua.push({ ma, menhDe, dat });
  console.log(
    `${dat ? 'PASS' : 'FAIL'}  ${ma}  ${menhDe}${chuThich ? ' — ' + chuThich : ''}`,
  );
}

/** Ô thẻ là combobox có nhãn "Tìm kiếm trong danh sách" (OTimKiemThe). */
const O_THE = { role: 'combobox', name: 'Tìm kiếm trong danh sách' };

async function moVaGoThe(page, duong, chu) {
  await page.goto(`${CO_SO}${duong}`, { waitUntil: 'domcontentloaded' });
  const o = page.getByRole(O_THE.role, { name: O_THE.name });
  await o.waitFor({ timeout: 60000 });
  await o.fill(chu);
  await o.press('Enter');
  await page.waitForTimeout(3000);
  return o;
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });

  // Chặn GHI ở tầng mạng — bộ UAT chạy trên dữ liệu thật của đơn vị.
  await ctx.route('**/api/**', (route) => {
    const m = route.request().method();
    const ghiDuLieu = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(m);
    const dangNhap = route.request().url().includes('/auth/login');
    if (ghiDuLieu && !dangNhap) return route.abort();
    return route.continue();
  });

  const page = await ctx.newPage();

  try {
    // Ô đăng nhập có `id` nhưng KHÔNG có nhãn liên kết — dò theo nhãn là trượt, và khi ấy mọi mệnh
    // đề sau đều đỏ GIẢ.
    await page.goto(`${CO_SO}/login`, { waitUntil: 'domcontentloaded' });
    await page.locator('#username').fill(TK);
    await page.locator('#password').fill(MK);
    await page.getByRole('button', { name: /đăng nhập/i }).click();
    await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 60000 });

    // M6-9: gõ KHÔNG DẤU ra hồ sơ CÓ DẤU (máy chủ bỏ dấu, không phải trình duyệt lọc).
    await moVaGoThe(page, '/petitions', CHU_KHONG_DAU);
    const coDauHienRa = await page
      .getByRole('table')
      .getByText(new RegExp(CHU_CO_DAU, 'i'))
      .first()
      .isVisible()
      .catch(() => false);
    ghi('M6-9', `Gõ "${CHU_KHONG_DAU}" ra hồ sơ "${CHU_CO_DAU}"`, coDauHienRa);

    // M6-11: thẻ nằm trên ĐỊA CHỈ TRANG — dán đường dẫn là ra đúng bộ lọc ấy.
    const urlSauKhiGo = page.url();
    const theTrenUrl = /petitions_tk=/.test(urlSauKhiGo);
    ghi('M6-11', 'Thẻ nằm trên địa chỉ trang (petitions_tk)', theTrenUrl, urlSauKhiGo);

    // M6-10: chọn ĐÚNG CỘT — thẻ `nguoiGui` chỉ lọc cột người gửi.
    await page.goto(
      `${CO_SO}/petitions?petitions_tk=${encodeURIComponent(`nguoiGui~${CHU_KHONG_DAU}`)}`,
      { waitUntil: 'domcontentloaded' },
    );
    await page.getByRole('table').first().waitFor({ timeout: 60000 });
    await page.waitForTimeout(3000);
    const locTheoCot = await page
      .getByRole('table')
      .getByText(new RegExp(CHU_CO_DAU, 'i'))
      .first()
      .isVisible()
      .catch(() => false);
    ghi('M6-10', 'Thẻ theo cột Người gửi lọc đúng cột ấy', locTheoCot);

    // M6-12: thẻ Trạng thái trên cột Boolean — lỗi 500 (Prisma BoolFilter không có `in`) đã sửa.
    for (const [ma, duong] of [
      ['Người dùng', `/users?users_tk=${encodeURIComponent('trangThai~active')}`],
      ['Danh mục', `/directories?directories_tk=${encodeURIComponent('trangThai~active')}`],
    ]) {
      await page.goto(`${CO_SO}${duong}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(3000);
      const coLoi = await page
        .getByText(/chưa hỏi được máy chủ|500|đã xảy ra lỗi/i)
        .first()
        .isVisible()
        .catch(() => false);
      ghi('M6-12', `Thẻ Trạng thái ở màn ${ma} không lỗi`, !coLoi);
    }

    // M6-13: Nhật ký — gõ không dấu ra ĐÚNG tên người thực hiện (trước đây trình duyệt lọc lại theo
    // chữ CÓ DẤU nên tên người không bao giờ ra).
    await moVaGoThe(page, '/activity-log', CHU_KHONG_DAU);
    const raTenNguoi = await page
      .getByRole('table')
      .getByText(new RegExp(CHU_CO_DAU, 'i'))
      .first()
      .isVisible()
      .catch(() => false);
    ghi('M6-13', 'Nhật ký: gõ không dấu ra tên người thực hiện', raTenNguoi);

    // M6-14 + M6-15: ô tìm TOÀN CỤC trên thanh đầu trang.
    await page.goto(`${CO_SO}/`, { waitUntil: 'domcontentloaded' });
    const oToanCuc = page.getByTestId('global-search-input');
    await oToanCuc.waitFor({ timeout: 60000 });
    await oToanCuc.fill(CHU_KHONG_DAU);
    await page.getByTestId('search-dropdown').waitFor({ timeout: 60000 });
    await page.waitForTimeout(2000);

    const nutXemTatCa = page.getByRole('button', { name: /Xem tất cả/ }).first();
    let xemTatCaLoc = false;
    if (await nutXemTatCa.isVisible().catch(() => false)) {
      await nutXemTatCa.click();
      await page.waitForTimeout(3000);
      xemTatCaLoc = /_tk=/.test(page.url());
    }
    ghi('M6-14', '"Xem tất cả" mở danh sách ĐÃ lọc (khoá _tk)', xemTatCaLoc, page.url());

    await page.goto(`${CO_SO}/`, { waitUntil: 'domcontentloaded' });
    await oToanCuc.fill(CHU_KHONG_DAU);
    await page.getByTestId('search-dropdown').waitFor({ timeout: 60000 });
    await page.waitForTimeout(2000);
    let moDungCho = false;
    const dong = page.getByTestId('search-result-item').first();
    if (await dong.isVisible().catch(() => false)) {
      await dong.click();
      await page.waitForTimeout(3000);
      // Vụ án/Đơn thư mở HỒ SƠ; Đối tượng mở danh sách đúng loại kèm thẻ hoTen.
      moDungCho = /\/(cases|petitions|vu-viec)\/[^/]+|(objects|people\/victims|people\/witnesses)\?.*_tk=/.test(
        page.url(),
      );
    }
    ghi('M6-15', 'Bấm một kết quả mở đúng hồ sơ / đúng danh sách', moDungCho, page.url());

    // M6-17: bộ gõ tiếng Việt — Enter lúc ĐANG GHÉP CHỮ không được mở kết quả.
    await page.goto(`${CO_SO}/`, { waitUntil: 'domcontentloaded' });
    await oToanCuc.fill('nguye');
    await page.getByTestId('search-dropdown').waitFor({ timeout: 60000 });
    const truocKhiGhep = page.url();
    await oToanCuc.evaluate((el) => {
      el.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
      el.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, bubbles: true }),
      );
    });
    await page.waitForTimeout(2000);
    ghi('M6-17', 'Enter lúc bộ gõ đang ghép chữ KHÔNG điều hướng', page.url() === truocKhiGhep);
  } finally {
    await browser.close();
  }

  const truot = ketQua.filter((k) => !k.dat);
  console.log(`\n${ketQua.length - truot.length}/${ketQua.length} mệnh đề đạt`);
  process.exit(truot.length ? 1 : 0);
})().catch((e) => {
  console.error('LỖI BỘ CHẠY:', e.message);
  process.exit(2);
});
