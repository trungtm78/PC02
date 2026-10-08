/**
 * MONKEY TEST TỔNG — chạy MỘT LẦN khi xong toàn bộ task (anh chốt 08/10/2026).
 *
 * Mỗi hồ sơ trong `profiles/` × mỗi hạt giống × mỗi engine: một lượt `chay()`. Mặc định 3 hạt cố định (101,102,103) cộng
 * một hạt NGẪU NHIÊN (in ra để lặp lại được). Kết quả gộp vào một tệp JSON; thoát 1 nếu có BẤT KỲ chỗ đáng ngờ, 2 nếu
 * bộ chạy hỏng.
 *
 *   UAT_BASE=http://localhost:5173 UAT_PASS=... MONKEY_CHO_GHI=1 node chay-tong.cjs
 *
 * Biến: MONKEY_SEEDS ("101,102,103,random"), MONKEY_ENGINES ("chromium,webkit"), MONKEY_VIEWPORTS ("1600x1000"),
 * MONKEY_STEPS (25), MONKEY_PROFILE (mặc định mọi tệp trong profiles/), MONKEY_OUT (tệp kết quả tổng), MONKEY_ANH.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { chay, docCauHinh, dangNhapApi, maThoat } = require('./monkey.cjs');

async function main() {
  const env = { ...process.env };
  if (!env.MONKEY_PROFILE) {
    const dir = path.resolve(__dirname, 'profiles');
    env.MONKEY_PROFILE = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => path.join(dir, f)).join(',');
  }
  env.MONKEY_ENGINES = env.MONKEY_ENGINES || 'chromium,webkit';
  const goc = docCauHinh(env);
  const hat = String(env.MONKEY_SEEDS || '101,102,103,random').split(',').map((s) => s.trim()).filter(Boolean)
    .map((s) => (s === 'random' ? Math.floor(Math.random() * 2 ** 31) : Number(s)));
  if (hat.some((h) => !Number.isFinite(h))) throw new Error('MONKEY_SEEDS không hợp lệ');

  // Một lần đăng nhập API cho cả lượt tổng: tránh giới hạn tần suất đăng nhập và cho mọi lượt cùng token + refresh token.
  if (!goc.token && !goc.khongDangNhap) {
    const t = await dangNhapApi(goc);
    goc.token = t.accessToken;
    process.env.UAT_REFRESH = t.refreshToken;
  }

  const tong = {
    ngay: new Date().toISOString(),
    coSo: goc.coSo,
    choGhi: goc.choGhi,
    hat,
    engines: goc.engines,
    khungNhin: goc.khungNhin.map((v) => `${v.width}x${v.height}`),
    soBuoc: goc.soBuoc,
    luot: [],
    soMan: 0,
    soThaoTac: 0,
    phatHien: [],
    chuaKiem: [],
    daKiem: {},
    http429: 0,
    ghiRaNgoai: [],
  };
  for (const hs of goc.hoSo) {
    for (const h of hat) {
      const kq = await chay({ ...goc, hoSo: [hs], hat: h });
      tong.luot.push({ hoSo: hs.ten, hat: h, soMan: kq.soMan, soThaoTac: kq.soThaoTac, phatHien: kq.phatHien.length, chuaKiem: kq.chuaKiem.length });
      tong.soMan += kq.soMan;
      tong.soThaoTac += kq.soThaoTac;
      tong.http429 += kq.http429;
      tong.ghiRaNgoai.push(...kq.ghiRaNgoai);
      tong.phatHien.push(...kq.phatHien);
      tong.chuaKiem.push(...kq.chuaKiem);
      for (const [k, v] of Object.entries(kq.daKiem)) tong.daKiem[k] = (tong.daKiem[k] || 0) + v;
      fs.mkdirSync(path.dirname(goc.ra), { recursive: true });
      fs.writeFileSync(goc.ra, JSON.stringify(tong, null, 1), 'utf8'); // ghi dần: bộ chạy chết giữa chừng vẫn còn kết quả
    }
  }
  console.log(`\n=== TỔNG: ${tong.luot.length} lượt · ${tong.soMan} màn · ${tong.soThaoTac} thao tác · ${tong.phatHien.length} chỗ đáng ngờ · ${tong.chuaKiem.length} CHƯA KIỂM ===`);
  console.log('Số lần mỗi bất biến ĐÃ kiểm:', JSON.stringify(tong.daKiem), '· 429 (giới hạn tần suất, không tính lỗi):', tong.http429);
  for (const l of tong.luot) console.log(`  ${l.hoSo} seed=${l.hat}: ${l.soMan} màn, ${l.soThaoTac} thao tác, ${l.phatHien} đáng ngờ, ${l.chuaKiem} chưa kiểm`);
  if (tong.chuaKiem.length) console.log('CHƯA KIỂM — KHÔNG phải đạt (thoát 1):', tong.chuaKiem.length, 'mục');
  process.exit(maThoat(tong));
}

main().catch((e) => {
  console.error('LỖI BỘ CHẠY:', e.message);
  process.exit(2);
});
