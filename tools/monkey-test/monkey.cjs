/**
 * MONKEY TEST — đi lung tung khắp hệ thống, tìm chỗ vỡ. Bản nâng cấp 08/10/2026.
 *
 * Khác bản cũ (chỉ bấm nút, `Math.random`, một khung nhìn, luôn thoát 0):
 *  - HẠT GIỐNG (`MONKEY_SEED`, mulberry32): in ra log, chạy lại đúng một lượt để kiểm bản vá;
 *  - nhiều KHUNG NHÌN và ENGINE (`MONKEY_VIEWPORTS`, `MONKEY_ENGINES`: chromium, webkit);
 *  - thao tác có trọng số: bấm, bấm đúp, Ctrl+bấm, nút giữa, kéo bôi chữ, phím, gõ chuỗi lạ, dán, lùi/tiến, xoay màn hình;
 *  - HỒ SƠ (`MONKEY_PROFILE`): khai đường đi + bất biến riêng từng tính năng (xem `profiles/`);
 *  - thoát 0 sạch · 1 có chỗ đáng ngờ · 2 bộ chạy hỏng — ba trạng thái khác nhau, vì "bộ chạy hỏng" không phải "sản phẩm hỏng".
 *
 * ── GHI hay CHỈ ĐỌC ──
 * Mặc định mọi lời gọi GHI (POST/PUT/PATCH/DELETE, trừ đăng nhập) bị CHẶN ở tầng mạng: máy thật có ~55.000 hồ sơ thật.
 * `MONKEY_CHO_GHI=1` chỉ có tác dụng khi `UAT_BASE` là localhost/127.0.0.1 — trỏ vào máy thật thì từ chối và thoát 2.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { taoPrng, hatCon } = require('./lib/prng.cjs');
const { chonHanhDong } = require('./lib/hanh-dong.cjs');
const { BAT_BIEN, chupGiaTriOnhap } = require('./lib/bat-bien.cjs');
const { taoSoChuaKiem } = require('./lib/so-chua-kiem.cjs');

const LOI_CONSOLE_BO_QUA = /Failed to fetch|net::ERR_FAILED|aborted|ERR_ABORTED|Load failed|due to access control checks|Failed to load resource/i;
// Lỗi do chính thao tác của bộ chạy làm trang đang chuyển đi giữa chừng — không phải lỗi sản phẩm.
/** WebKit's wording for a fetch/XHR cancelled while the page navigates away (surfaces as a `pageerror`, unlike Chromium). */
const NHIEU_HUY_YEU_CAU = /due to access control checks|^Load failed$|AxiosError: Network Error/i;
/**
 * Is `url` a page of the app under test? A history step back from the first entry lands on `about:blank` (or a browser error
 * page): zero characters there say nothing about the app, and the route is pulled back right after.
 */
function laTrangUngDung(url, coSo) {
  try {
    return !!url && new URL(url).origin === new URL(coSo).origin;
  } catch {
    return false;
  }
}
function laNhieuHuyYeuCau(msg) {
  return NHIEU_HUY_YEU_CAU.test(String(msg || '').trim());
}
const LOI_CHUYEN_TRANG =/Execution context was destroyed|Target (page|closed)|Navigation|frame was detached|Protocol error/i;
const MAN_LOI = /something went wrong|đã xảy ra lỗi|unexpected error/i;

function laMayLocal(url) {
  try {
    const h = new URL(url).hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '[::1]';
  } catch {
    return false;
  }
}

function docKhungNhin(chuoi) {
  return String(chuoi || '1600x1000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = /^(\d+)x(\d+)$/.exec(s);
      if (!m) throw new Error(`MONKEY_VIEWPORTS không hợp lệ: "${s}" (dạng 390x844)`);
      return { width: Number(m[1]), height: Number(m[2]) };
    });
}

function docHoSo(tep) {
  const duong = path.isAbsolute(tep) ? tep : path.resolve(process.cwd(), tep);
  const hs = JSON.parse(fs.readFileSync(duong, 'utf8'));
  for (const b of hs.batBien || []) {
    if (!BAT_BIEN[b]) throw new Error(`Hồ sơ ${hs.ten || tep}: bất biến "${b}" không tồn tại. Có: ${Object.keys(BAT_BIEN).join(', ')}`);
  }
  return { ...hs, _tep: duong };
}

function docCauHinh(env) {
  const co_so = env.UAT_BASE || 'http://171.244.40.245';
  const choGhi = env.MONKEY_CHO_GHI === '1';
  const cfg = {
    coSo: co_so,
    taiKhoan: env.UAT_USER || 'admin@pc02.local',
    matKhau: env.UAT_PASS,
    token: env.UAT_TOKEN,
    hat: env.MONKEY_SEED !== undefined && env.MONKEY_SEED !== '' ? Number(env.MONKEY_SEED) : Math.floor(Math.random() * 2 ** 31),
    khungNhin: docKhungNhin(env.MONKEY_VIEWPORTS),
    engines: String(env.MONKEY_ENGINES || 'chromium').split(',').map((s) => s.trim()).filter(Boolean),
    soBuoc: Number(env.MONKEY_STEPS || 25),
    // Nhịp chờ sau mỗi thao tác (ms): đủ để trang phản ứng. Ca chứng âm hạ xuống cho nhanh.
    nhipMs: Number(env.MONKEY_NHIP_MS || 260),
    hoSo: String(env.MONKEY_PROFILE || '').split(',').map((s) => s.trim()).filter(Boolean).map(docHoSo),
    tepDuong: env.MONKEY_ROUTES,
    ra: env.MONKEY_OUT || path.resolve(process.cwd(), 'monkey-ket-qua.json'),
    thuMucAnh: env.MONKEY_ANH,
    choGhi,
    khongDangNhap: env.MONKEY_KHONG_DANG_NHAP === '1',
  };
  if (!Number.isFinite(cfg.hat)) throw new Error('MONKEY_SEED phải là số');
  if (choGhi && !laMayLocal(co_so)) {
    throw new Error(`MONKEY_CHO_GHI=1 bị từ chối: ${co_so} không phải localhost/127.0.0.1 — máy thật không bao giờ được ghi.`);
  }
  if (!cfg.khongDangNhap && !cfg.token && !cfg.matKhau) throw new Error('Thiếu UAT_PASS hoặc UAT_TOKEN');
  if (!cfg.hoSo.length && !cfg.tepDuong) throw new Error('Cần MONKEY_PROFILE=<hồ sơ.json,...> hoặc MONKEY_ROUTES=<tệp đường>');
  // Cách dùng cũ: chỉ MONKEY_ROUTES → một hồ sơ tổng quát không có bất biến riêng (chỉ bất biến chung).
  if (!cfg.hoSo.length) cfg.hoSo = [{ ten: 'mac-dinh', tepDuong: cfg.tepDuong, batBien: [], _tep: path.resolve(process.cwd(), 'x') }];
  return cfg;
}

function layPlaywright() {
  for (const ten of ['playwright', '@playwright/test', 'playwright-core']) {
    try {
      return require(ten);
    } catch {
      /* thử tên kế */
    }
  }
  throw new Error('Không nạp được playwright. Cài trong tools/monkey-test (npm ci) hoặc đặt NODE_PATH tới thư mục có playwright.');
}

async function dangNhap(page, cfg) {
  if (cfg.khongDangNhap) return null;
  if (cfg.token) {
    await page.addInitScript(
      ([t, r]) => {
        try {
          sessionStorage.setItem('accessToken', t);
          localStorage.setItem('refreshToken', r);
        } catch (e) {
          /* trang chưa có storage */
        }
      },
      [cfg.token, process.env.UAT_REFRESH || cfg.token],
    );
    return cfg.token;
  }
  await page.goto(`${cfg.coSo}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('#username').fill(cfg.taiKhoan);
  await page.locator('#password').fill(cfg.matKhau);
  await page.getByRole('button', { name: /đăng nhập/i }).click();
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 60000 });
  return page.evaluate(() => sessionStorage.getItem('accessToken'));
}

/** Thay {DON_THU}... bằng một mã thật lấy từ API (đọc). Không lấy được → null: đường ấy bị bỏ và ghi CHƯA KIỂM. */
async function giaiDuong(duong, cfg, token, boNho) {
  const m = /\{([A-Z_]+)\}/.exec(duong);
  if (!m) return duong;
  const nhan = m[1];
  const DUONG_API = { DON_THU: '/petitions?limit=1', VU_VIEC: '/incidents?limit=1', VU_AN: '/cases?limit=1' };
  const api = DUONG_API[nhan];
  if (!api) return null;
  if (!boNho.has(nhan)) {
    let id = null;
    try {
      const r = await fetch(`${cfg.coSo}/api/v1${api}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const j = await r.json();
      const ds = Array.isArray(j) ? j : j.data || j.items || [];
      id = ds[0]?.id || null;
    } catch {
      id = null;
    }
    boNho.set(nhan, id);
  }
  const id = boNho.get(nhan);
  return id ? duong.replace(m[0], id) : null;
}

/** Đăng nhập bằng API (một lần cho cả lượt tổng): trả {accessToken, refreshToken}. */
async function dangNhapApi(cfg) {
  const r = await fetch(`${cfg.coSo}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: cfg.taiKhoan, password: cfg.matKhau }),
  });
  const j = await r.json();
  if (!r.ok || !j.accessToken) throw new Error(`Đăng nhập API hỏng (${r.status}): ${JSON.stringify(j).slice(0, 160)}`);
  return { accessToken: j.accessToken, refreshToken: j.refreshToken || j.accessToken };
}

/**
 * Chữ hiển thị của trang. Đọc giữa lúc đang chuyển trang cho ra chuỗi rỗng và báo "màn trắng" oan: chờ `load`, đọc;
 * nếu ngắn thì chờ thêm rồi đọc LẠI — chỉ ngắn ở cả hai lần mới là màn trắng thật.
 */
async function docChuOnDinh(page) {
  const doc = async () => (await page.locator('body').innerText({ timeout: 4000 }).catch(() => '')).trim();
  await page.waitForLoadState('domcontentloaded', { timeout: 8000 }).catch(() => {});
  let chu = await doc();
  if (chu.length < 60) {
    await page.waitForTimeout(900);
    chu = await doc();
  }
  return chu;
}

async function chonVungKhoi(page) {
  return page.evaluate(chupGiaTriOnhap).catch(() => null);
}

/** Chạy MỘT hồ sơ ở MỘT (engine, khung nhìn). */
async function chayMotHoSo(args) {
  const { pw, engine } = args;
  let browser;
  try {
    browser = await pw[engine].launch();
  } catch (e) {
    throw new Error(`Không khởi động được ${engine}: ${e.message}`);
  }
  // Mọi đường thoát (kể cả ném lỗi giữa chừng: tệp đường thiếu, đăng nhập hỏng…) đều phải đóng trình duyệt.
  try {
    await chayTrongTrinhDuyet({ ...args, browser });
  } finally {
    await browser.close().catch(() => {});
  }
}

const PHUONG_THUC_GHI = ['POST', 'PUT', 'PATCH', 'DELETE'];

async function chayTrongTrinhDuyet({ browser, engine, vp, hoSo, cfg, kq, token, boNho }) {
  const nhanLuot = `${engine}@${vp.width}x${vp.height}/${hoSo.ten}`;
  const ctx = await browser.newContext({ viewport: vp, serviceWorkers: 'block' });
  const thuGhi = [];
  const mayGoc = new URL(cfg.coSo).host;
  // Chặn ở MỌI địa chỉ (không chỉ /api/ của máy gốc): trang cấu hình sai hay gọi tuyệt đối sang máy khác vẫn không ghi được.
  await ctx.route('**/*', (route) => {
    const r = route.request();
    if (!PHUONG_THUC_GHI.includes(r.method())) return route.continue();
    let url;
    try {
      url = new URL(r.url());
    } catch {
      return route.abort();
    }
    // Đăng nhập/làm mới token trên CHÍNH máy gốc là thứ duy nhất được ghi khi ở chế độ chỉ đọc.
    const dangNhapRefresh = url.host === mayGoc && (url.pathname.includes('/auth/login') || url.pathname.includes('/auth/refresh'));
    if (dangNhapRefresh) return route.continue();
    // ĐẾM mọi lời gọi ghi dù có cho qua hay không: nếu chỉ đếm khi chặn thì ở chế độ cho ghi (local) bất biến "màn
    // chỉ xem không được ghi" mù hoàn toàn — nó không bao giờ có thể đỏ.
    thuGhi.push(`${r.method()} ${url.pathname}`);
    if (!cfg.choGhi) return route.abort();
    // Cho ghi chỉ khi ĐÍCH CỦA TỪNG YÊU CẦU cũng là máy local — kiểm host của `UAT_BASE` lúc đọc cấu hình là chưa đủ.
    if (!laMayLocal(r.url())) {
      kq.ghiRaNgoai.push(`${r.method()} ${url.origin}${url.pathname}`);
      phatHien('ghi ra ngoài máy local', `đã chặn ${r.method()} ${url.origin}${url.pathname} (MONKEY_CHO_GHI chỉ cho ghi vào localhost)`);
      return route.abort();
    }
    return route.continue();
  });

  const page = await ctx.newPage();
  const tt = { tabMoi: [], dauVao: null };
  let duongHienTai = '/';
  let buoc = 0;
  const phatHien = (loai, chiTiet, extra = {}) => {
    const p = { luot: nhanLuot, hat: cfg.hat, loai, duong: duongHienTai, buoc, chiTiet: String(chiTiet).slice(0, 300), ...extra };
    // Cùng loại + cùng chi tiết + cùng đường trong một lượt: gộp, đếm số lần (một lỗi lặp 30 lần là MỘT lỗi).
    const trung = kq.phatHien.find((x) => x.luot === p.luot && x.loai === p.loai && x.duong === p.duong && x.chiTiet === p.chiTiet);
    if (trung) {
      trung.soLan = (trung.soLan || 1) + 1;
      return trung;
    }
    kq.phatHien.push(p);
    console.log(`  ! [${nhanLuot}] ${loai} @ ${duongHienTai} (bước ${buoc}): ${p.chiTiet.slice(0, 160)}`);
    return p;
  };
  const chupAnh = async (p) => {
    if (!cfg.thuMucAnh) return;
    try {
      fs.mkdirSync(cfg.thuMucAnh, { recursive: true });
      const tep = path.join(cfg.thuMucAnh, `${cfg.hat}-${nhanLuot.replace(/[^a-z0-9]+/gi, '_')}-${kq.phatHien.length}.png`);
      await page.screenshot({ path: tep });
      p.anh = tep;
    } catch {
      /* ảnh chỉ để đối chiếu, không được làm hỏng lượt chạy */
    }
  };
  const bao = async (loai, chiTiet, extra) => chupAnh(phatHien(loai, chiTiet, extra));

  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    if (LOI_CONSOLE_BO_QUA.test(t)) return;
    if (laNhieuHuyYeuCau(t)) {
      kq.boQuaNhieuHuy = (kq.boQuaNhieuHuy || 0) + 1;
      return;
    }
    phatHien('console', t);
  });
  page.on('pageerror', (e) => {
    // WebKit reports a request cancelled by navigation as an uncaught rejection of the dying page. Counted (never silent) so the
    // summary shows how many were set aside; any other page error is a finding.
    if (laNhieuHuyYeuCau(e.message)) {
      kq.boQuaNhieuHuy = (kq.boQuaNhieuHuy || 0) + 1;
      return;
    }
    phatHien('pageerror', e.message);
  });
  page.on('response', (r) => {
    if (!r.url().includes('/api/')) return;
    const st = r.status();
    const dich = `${r.request().method()} ${new URL(r.url()).pathname}`;
    if (st >= 500) phatHien('http5xx', `${st} ${dich}`);
    else if (st === 429) kq.http429 += 1; // giới hạn tần suất do bộ chạy bấm dồn — đếm để lộ, không tính là lỗi sản phẩm
    else if (st === 400) {
      // API đúng khi từ chối chuỗi rác mà CHÍNH bộ chạy vừa gõ. 400 ở lúc KHÔNG vừa gõ mới là lỗi (đã từng: isActive=true → 400).
      const vuaGo = Date.now() - (tt.luc_go || 0) < 4000;
      if (!vuaGo) phatHien('http400', `${st} ${dich}${new URL(r.url()).search.slice(0, 80)}`);
    }
  });
  ctx.on('page', (p) => {
    if (p !== page) tt.tabMoi.push(p);
  });

  try {
    await dangNhap(page, cfg);
  } catch (e) {
    throw new Error(`Đăng nhập hỏng (${nhanLuot}): ${e.message}`);
  }

  const batBienHoSo = (hoSo.batBien || []).map((ten) => ({ ten, ...BAT_BIEN[ten] }));
  const soChuaKiem = taoSoChuaKiem();
  const chotChuaKiem = () => {
    for (const c of soChuaKiem.chot()) {
      kq.chuaKiem.push(c);
      console.log(`  ? CHƯA KIỂM [${c.luot}] ${c.batBien} @ ${c.duong}: ${c.chiTiet}`);
    }
  };
  const ktra = async (khiNao, boiCanh) => {
    for (const b of batBienHoSo.filter((x) => [].concat(x.khiNao).includes(khiNao))) {
      // Đếm số lần bất biến THỰC SỰ được kiểm: "0 phát hiện" chỉ có nghĩa khi con số này lớn hơn 0.
      kq.daKiem[b.ten] = (kq.daKiem[b.ten] || 0) + 1;
      let r;
      try {
        r = await b.kiem(boiCanh);
      } catch (e) {
        r = { khongDoDuoc: true, chiTiet: `bất biến lỗi: ${e.message}` };
      }
      if (r && r.khongDoDuoc) {
        // Not conclusive yet: only a route where NO step measured becomes CHƯA KIỂM (see lib/so-chua-kiem.cjs).
        soChuaKiem.khongDo(nhanLuot, b.ten, duongHienTai, r.chiTiet);
        continue;
      }
      soChuaKiem.daDo(nhanLuot, b.ten, duongHienTai);
      if (r) await bao(`bất biến: ${b.ten}`, r.chiTiet);
    }
  };

  const duongs = [];
  let tuyen = hoSo.tuyen || [];
  if (hoSo.tepDuong) {
    const tep = path.isAbsolute(hoSo.tepDuong) ? hoSo.tepDuong : path.resolve(path.dirname(hoSo._tep), hoSo.tepDuong);
    tuyen = fs
      .readFileSync(tep, 'utf8')
      .split(/[^a-zA-Z0-9/_:{}-]+/)
      .map((d) => d.trim())
      .filter(Boolean);
  }
  for (const d of tuyen) {
    const thuc = await giaiDuong(d, cfg, token, boNho);
    if (thuc) duongs.push(thuc);
    else kq.chuaKiem.push({ luot: nhanLuot, batBien: '(đường)', duong: d, chiTiet: 'không giải được mã thật cho đường này (CSDL chưa có bản ghi?)' });
  }

  for (const [i, d] of duongs.entries()) {
    duongHienTai = d;
    buoc = 0;
    tt.tabMoi = [];
    const rng = taoPrng(hatCon(cfg.hat, `${nhanLuot}|${i}|${d}`));
    try {
      await page.goto(`${cfg.coSo}${d}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(1800);
    } catch (e) {
      await bao('không mở được', e.message);
      continue;
    }
    const chu0 = await docChuOnDinh(page);
    if (chu0.length < 60) await bao('màn hình trắng', `chỉ ${chu0.length} ký tự`);
    if (MAN_LOI.test(chu0)) await bao('màn lỗi', chu0.slice(0, 120));
    kq.soMan += 1;

    tt.dauVao = hoSo.manChiXem ? await chonVungKhoi(page) : null;
    await ktra('dau-duong', { page, route: d, vp, tt, cfg });

    for (let b = 0; b < cfg.soBuoc; b += 1) {
      buoc = b + 1;
      tt.tabMoi = [];
      const hanhDong = chonHanhDong(rng, { vp, route: d, hoSo });
      let hd = null;
      if (['go', 'dan', 'go-ten-nguoi-gui', 'go-gio-tiep-nhan'].includes(hanhDong.ten)) tt.luc_go = Date.now();
      try {
        hd = await hanhDong.chay({ page, ctx, rng, cfg, vp, tt, route: d });
      } catch (e) {
        if (!LOI_CHUYEN_TRANG.test(String(e.message))) await bao('vỡ khi thao tác', `${hanhDong.ten}: ${e.message}`);
      }
      kq.soThaoTac += 1;
      if (['go', 'dan', 'go-ten-nguoi-gui', 'go-gio-tiep-nhan'].includes(hanhDong.ten)) tt.luc_go = Date.now();
      if (!hd) continue;
      await page.waitForTimeout(cfg.nhipMs ?? 260);

      // Ctrl/giữa trên dòng có thể mở tab mới. Kiểm (rồi luôn đóng) để không dồn tab.
      if (hd.moTabMoi) await page.waitForTimeout(Math.max(cfg.nhipMs ?? 260, 300));
      await ktra('buoc', { page, route: d, vp, tt, hd, cfg });
      if (hd.ten === 'boi-chu') await ktra('boi-chu', { page, route: d, vp, tt, hd, cfg });
      if (hd.moTabMoi && tt.tabMoi.length) await ktra('tab-moi', { page, route: d, vp, tt, hd, cfg });
      if (hd.ten === 'mo-bang-thao-tac') await ktra('mo-bang', { page, route: d, vp, tt, hd, cfg });
      if (hd.ten === 'go-ten-nguoi-gui') await ktra('go-ten', { page, route: d, vp, tt, hd, cfg });
      if (hd.ten === 'go-gio-tiep-nhan') await ktra('go-gio', { page, route: d, vp, tt, hd, cfg });
      for (const p of tt.tabMoi) await p.close().catch(() => {});
      tt.tabMoi = [];

      const chu = await docChuOnDinh(page);
      if (chu.length < 60 && laTrangUngDung(page.url(), cfg.coSo)) await bao('màn hình trắng sau thao tác', `${hanhDong.ten}: chỉ ${chu.length} ký tự`, { hanhDong: hd, url: page.url() });
      if (MAN_LOI.test(chu)) await bao('màn lỗi sau thao tác', `${hanhDong.ten}: ${chu.slice(0, 120)}`, { hanhDong: hd });

      // Thao tác lùi/tiến hoặc bấm có thể đưa sang màn khác: kéo lại đúng đường để mỗi lượt đo đúng chỗ hồ sơ khai.
      const duongNay = (() => {
        try {
          return new URL(page.url()).pathname;
        } catch {
          return '';
        }
      })();
      const duongGoc = d.split('?')[0];
      if (duongNay !== duongGoc) {
        await page.goto(`${cfg.coSo}${d}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
        await page.waitForTimeout(900);
        tt.dauVao = hoSo.manChiXem ? await chonVungKhoi(page) : null;
      }
    }
    await ktra('cuoi-duong', { page, route: d, vp, tt, cfg });
    chotChuaKiem();
  }
  chotChuaKiem(); // routes left early (navigation failure) still report what they never measured

  if (hoSo.camGhi && thuGhi.length) {
    await bao('thử ghi ở chế độ chỉ đọc', `${thuGhi.length} lời gọi ghi (${cfg.choGhi ? 'đã cho qua' : 'đã chặn'}): ${[...new Set(thuGhi)].slice(0, 4).join(', ')}`);
  }
  kq.thuGhiBiChan += thuGhi.length;
}

/** Chạy toàn bộ cấu hình. Trả kết quả; KHÔNG gọi process.exit (để ca kiểm chứng âm gọi được). */
async function chay(cfg) {
  const pw = layPlaywright();
  const kq = {
    hat: cfg.hat,
    coSo: cfg.coSo,
    choGhi: cfg.choGhi,
    engines: cfg.engines,
    khungNhin: cfg.khungNhin,
    hoSo: cfg.hoSo.map((h) => h.ten),
    soBuoc: cfg.soBuoc,
    soMan: 0,
    soThaoTac: 0,
    thuGhiBiChan: 0,
    phatHien: [],
    chuaKiem: [],
    daKiem: {},
    http429: 0,
    boQuaNhieuHuy: 0,
    ghiRaNgoai: [],
  };
  console.log(`monkey: seed=${cfg.hat} engines=${cfg.engines.join(',')} khungNhin=${cfg.khungNhin.map((v) => `${v.width}x${v.height}`).join(',')} hoSo=${kq.hoSo.join(',')} choGhi=${cfg.choGhi}`);
  const boNho = new Map();
  let token = cfg.token || null;
  if (!token && !cfg.khongDangNhap) {
    // Một lần đăng nhập ngắn chỉ để lấy token cho việc giải {DON_THU}...; mỗi lượt vẫn tự đăng nhập trong ngữ cảnh riêng.
    const b = await pw.chromium.launch();
    try {
      const c = await b.newContext();
      const p = await c.newPage();
      token = await dangNhap(p, cfg);
    } finally {
      await b.close();
    }
  }
  for (const engine of cfg.engines) {
    for (const hoSo of cfg.hoSo) {
      // Hồ sơ khai khung nhìn riêng (vd điện thoại) thì chạy ĐÚNG các khung ấy; không thì dùng MONKEY_VIEWPORTS.
      const khung = hoSo.khungNhin ? docKhungNhin(hoSo.khungNhin.join(',')) : cfg.khungNhin;
      for (const vp of khung) {
        await chayMotHoSo({ pw, engine, vp, hoSo, cfg, kq, token, boNho });
      }
    }
  }
  return kq;
}

async function main() {
  let cfg;
  try {
    cfg = docCauHinh(process.env);
  } catch (e) {
    console.error('LỖI CẤU HÌNH:', e.message);
    process.exit(2);
  }
  let kq;
  try {
    kq = await chay(cfg);
  } catch (e) {
    console.error('LỖI BỘ CHẠY:', e.message);
    process.exit(2);
  }
  fs.mkdirSync(path.dirname(cfg.ra), { recursive: true });
  fs.writeFileSync(cfg.ra, JSON.stringify(kq, null, 1), 'utf8');
  console.log(
    `\nĐã đi ${kq.soMan} màn · ${kq.soThaoTac} thao tác · ${kq.phatHien.length} chỗ đáng ngờ · ${kq.chuaKiem.length} mục CHƯA KIỂM · ${kq.thuGhiBiChan} lời gọi ghi bị chặn`,
  );
  if (kq.chuaKiem.length) console.log('CHƯA KIỂM — KHÔNG phải đạt (thoát 1):', kq.chuaKiem.map((c) => `${c.batBien}@${c.duong}`).join(', '));
  if (kq.phatHien.length) console.log(`Chạy lại đúng lượt này: MONKEY_SEED=${cfg.hat} (kèm cùng MONKEY_PROFILE/VIEWPORTS/ENGINES/STEPS)`);
  process.exit(maThoat(kq));
}

/**
 * Mã thoát theo kết quả: 1 nếu có chỗ đáng ngờ HOẶC có mục CHƯA KIỂM; 0 chỉ khi sạch và không còn mục nào chưa đo được.
 * (Codex bắt 08/10/2026: đường `{DON_THU}` không có bản ghi → bất biến không chạy → bản cũ vẫn thoát 0 "sạch".)
 */
function maThoat(kq) {
  return kq.phatHien.length > 0 || kq.chuaKiem.length > 0 ? 1 : 0;
}

module.exports = { chay, docCauHinh, docHoSo, laMayLocal, dangNhapApi, maThoat, laNhieuHuyYeuCau, laTrangUngDung };

if (require.main === module) void main();
