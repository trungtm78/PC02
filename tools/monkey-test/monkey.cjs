/**
 * MONKEY TEST — đi lung tung khắp hệ thống, tìm màn hình vỡ.
 *
 * ── Giới hạn CỐ Ý: CHỈ ĐỌC ──
 *
 * Chạy trên máy thật, nơi có ~55.000 hồ sơ án thật. Bấm bừa vào nút Lưu / Xoá / Chuyển trạng
 * thái là sửa dữ liệu vụ án có thật. Nên mọi lời gọi GHI bị CHẶN ở tầng mạng (trừ đăng nhập) —
 * lưới an toàn không dựa vào việc đoán đúng nhãn nút — và nút có chữ nguy hiểm thì bỏ qua.
 *
 * Thứ đi tìm: màn hình trắng, lỗi console, chữ "Đã xảy ra lỗi", không mở được trang.
 *
 * Chạy: UAT_PASS=... MONKEY_ROUTES=duong.txt node monkey.cjs
 */
const fs = require('fs');
const { chromium } = require('playwright');

const CO_SO = process.env.UAT_BASE || 'http://171.244.40.245';
const TK = process.env.UAT_USER || 'admin@pc02.local';
const MK = process.env.UAT_PASS;
const SO_VONG = Number(process.env.MONKEY_ROUNDS || 40);

const CAM = /xo[áa]|lưu|ghi|duyệt|chuyển|khởi tố|đình chỉ|hủy|huỷ|gửi|đăng xuất|thoát|xác nhận|tạo mới|thêm mới|nhập|import|khôi phục/i;

const loi = [];
function ghiLoi(loai, noi2, chiTiet) {
  loi.push({ loai, noi: noi2, chiTiet: String(chiTiet).slice(0, 200) });
  console.log(`  ! ${loai} @ ${noi2}: ${String(chiTiet).slice(0, 140)}`);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });

  await ctx.route('**/api/**', (route) => {
    const r = route.request();
    const ghi = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(r.method());
    const dangNhap = r.url().includes('/auth/login') || r.url().includes('/auth/refresh');
    if (ghi && !dangNhap) return route.abort();
    return route.continue();
  });

  const page = await ctx.newPage();
  let duong = '/login';
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (/Failed to fetch|net::ERR_FAILED|aborted/i.test(t)) return;
    ghiLoi('console', duong, t);
  });
  page.on('pageerror', (e) => ghiLoi('pageerror', duong, e.message));

  await page.goto(`${CO_SO}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('#username').fill(TK);
  await page.locator('#password').fill(MK);
  await page.getByRole('button', { name: /đăng nhập/i }).click();
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 60000 });

  const duongDan = fs
    .readFileSync(process.env.MONKEY_ROUTES || 'C:/PC02/duong.txt', 'utf8')
    .split(/[^a-zA-Z0-9/_:-]+/)
    .map((d) => d.trim())
    .filter(Boolean);
  console.log(`${duongDan.length} đường sẽ đi qua`);

  const daTham = [];
  for (const d of duongDan) {
    duong = d;
    try {
      await page.goto(`${CO_SO}${d}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2500);
      const chu = (await page.locator('body').innerText()).trim();
      if (chu.length < 60) ghiLoi('màn hình trắng', d, `chỉ ${chu.length} ký tự`);
      if (/something went wrong|đã xảy ra lỗi|unexpected error/i.test(chu)) {
        ghiLoi('màn lỗi', d, chu.slice(0, 120));
      }
      daTham.push(d);
    } catch (e) {
      ghiLoi('không mở được', d, e.message);
    }
  }

  for (let v = 0; v < SO_VONG; v += 1) {
    const d = daTham[Math.floor(Math.random() * daTham.length)];
    if (!d) break;
    duong = d;
    try {
      await page.goto(`${CO_SO}${d}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(1200);
      const nut = await page.locator('button:visible, [role="tab"]:visible').all();
      const duocBam = [];
      for (const n of nut) {
        const t = ((await n.textContent()) || '') + ' ' + ((await n.getAttribute('aria-label')) || '');
        if (!CAM.test(t)) duocBam.push(n);
      }
      if (!duocBam.length) continue;
      await duocBam[Math.floor(Math.random() * duocBam.length)].click({ timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(1200);
      const chu = (await page.locator('body').innerText()).trim();
      if (chu.length < 60) ghiLoi('màn hình trắng sau khi bấm', d, `chỉ ${chu.length} ký tự`);
      await page.keyboard.press('Escape').catch(() => {});
    } catch (e) {
      ghiLoi('vỡ khi bấm', d, e.message);
    }
  }

  await browser.close();
  console.log(`
Đã đi ${daTham.length} màn · ${SO_VONG} lượt bấm · ${loi.length} chỗ đáng ngờ`);
  fs.writeFileSync(
    process.env.MONKEY_OUT || 'C:/PC02/docs/monkey-ket-qua.json',
    JSON.stringify({ soMan: daTham.length, soVong: SO_VONG, loi }, null, 1),
    'utf8',
  );
  process.exit(0);
})().catch((e) => {
  console.error('LỖI BỘ CHẠY:', e.message);
  process.exit(2);
});
