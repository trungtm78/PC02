'use strict';
/**
 * CHỨNG ÂM — bằng chứng bộ monkey test ĐỎ ĐƯỢC.
 *
 * Một cổng chưa từng đỏ thì chưa ai biết nó có canh được gì. Ở đây dựng một trang mẫu có BA lỗi gieo sẵn, rồi bắt bộ
 * chạy phải báo đúng cả ba; cùng bộ thao tác trên trang SẠCH thì phải 0 phát hiện (bộ chạy không được "ngáo").
 *
 *   1. một nút ném lỗi chưa bắt                       → phải ra `pageerror`
 *   2. dòng bảng chuyển trang cả khi đang bôi chữ     → phải ra `bất biến: url_khong_doi_khi_boi_chu`
 *   3. ô "chỉ xem" thực ra gõ được                    → phải ra `bất biến: o_xem_khong_sua_duoc`
 *
 * Chạy: `node --test __tests__/` trong tools/monkey-test (cần playwright + chromium).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { chay, docCauHinh, laMayLocal } = require('../monkey.cjs');
const { taoPrng, hatCon } = require('../lib/prng.cjs');

const NOI_DUNG =
  '<h1>Chi tiết hồ sơ mẫu dùng cho chứng âm của bộ monkey test — đủ dài để không bị coi là màn hình trắng</h1>';

function trang({ sach }) {
  const boom = sach ? '' : `onclick="setTimeout(function(){ throw new Error('LOI-GIEO-SAN'); }, 0)"`;
  const hang = sach
    ? `onclick="if (String(getSelection()).trim()) return; location.hash = '#mo-' + Math.random();"`
    : `onclick="location.hash = '#mo-' + Math.random();"`;
  const o = sach ? 'readonly' : '';
  return `<!doctype html><html><head><meta charset="utf-8"><title>mau</title></head><body>
<main>${NOI_DUNG}
<button id="boom" ${boom}>Bấm vào đây để thử</button>
<table><tbody>
<tr ${hang}><td style="padding:12px 40px">Nguyễn Văn An là người gửi đơn thứ nhất</td><td style="padding:12px 40px">Trần Thị Bình</td></tr>
<tr ${hang}><td style="padding:12px 40px">Lê Hoàng Cường là người gửi đơn thứ hai</td><td style="padding:12px 40px">Phạm Thị Dung</td></tr>
<tr ${hang}><td style="padding:12px 40px">Công ty TNHH Minh Phát gửi đơn thứ ba</td><td style="padding:12px 40px">Vũ Văn Em</td></tr>
</tbody></table>
<input id="ro" ${o} value="giá trị gốc không được đổi" style="width:300px;height:30px"/>
</main></body></html>`;
}

function dungMayChu(sach) {
  const may = http.createServer((req, res) => {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(trang({ sach }));
  });
  return new Promise((ok) => may.listen(0, '127.0.0.1', () => ok({ may, coSo: `http://127.0.0.1:${may.address().port}` })));
}

function cauHinh(coSo, hat, soBuoc = 45) {
  return {
    coSo,
    hat,
    khungNhin: [{ width: 1000, height: 700 }],
    engines: ['chromium'],
    soBuoc,
    nhipMs: 70,
    hoSo: [
      {
        ten: 'chung-am',
        tuyen: ['/trang'],
        manChiXem: true,
        camGhi: false,
        batBien: ['url_khong_doi_khi_boi_chu', 'o_xem_khong_sua_duoc'],
        _tep: path.resolve(__dirname, 'x'),
      },
    ],
    choGhi: false,
    khongDangNhap: true,
  };
}

const HAT_THU = [11, 12, 13, 14, 15, 16];

test('CHỨNG ÂM: trang có 3 lỗi gieo sẵn → bộ chạy báo ĐỦ cả ba (trong tập hạt giống thử)', async () => {
  const { may, coSo } = await dungMayChu(false);
  try {
    const loai = new Set();
    for (const hat of HAT_THU) {
      const kq = await chay(cauHinh(coSo, hat));
      for (const p of kq.phatHien) loai.add(p.loai);
    }
    assert.ok(loai.has('pageerror'), `phải bắt pageerror; thấy: ${[...loai].join(' | ')}`);
    assert.ok(loai.has('bất biến: url_khong_doi_khi_boi_chu'), `phải bắt URL đổi khi bôi chữ; thấy: ${[...loai].join(' | ')}`);
    assert.ok(loai.has('bất biến: o_xem_khong_sua_duoc'), `phải bắt ô xem gõ được; thấy: ${[...loai].join(' | ')}`);
  } finally {
    may.close();
  }
});

test('ĐỐI CHỨNG: cùng thao tác trên trang SẠCH → 0 phát hiện', async () => {
  const { may, coSo } = await dungMayChu(true);
  try {
    for (const hat of HAT_THU) {
      const kq = await chay(cauHinh(coSo, hat));
      assert.deepEqual(
        kq.phatHien.map((p) => `${p.loai}: ${p.chiTiet}`),
        [],
        `hạt ${hat}: trang sạch không được có phát hiện`,
      );
      assert.ok(kq.soThaoTac > 10, 'phải thật sự thao tác (cổng không rỗng)');
    }
  } finally {
    may.close();
  }
});

test('CÙNG HẠT → CÙNG KẾT QUẢ (chạy lại được đúng một lượt để kiểm bản vá)', async () => {
  const { may, coSo } = await dungMayChu(false);
  try {
    const a = await chay(cauHinh(coSo, 12, 40));
    const b = await chay(cauHinh(coSo, 12, 40));
    // `pageerror` đến BẤT ĐỒNG BỘ nên có thể rơi vào bước kế tiếp giữa hai lần chạy: so tập LOẠI phát hiện, không so số bước.
    const tom = (kq) => [...new Set(kq.phatHien.map((p) => p.loai))].sort();
    assert.deepEqual(tom(a), tom(b));
    assert.ok(tom(a).length > 0, 'phải có phát hiện để so (cổng không rỗng)');
  } finally {
    may.close();
  }
});

test('PRNG: cùng hạt cùng dãy; hạt con theo nhãn khác nhau thì khác nhau nhưng lặp lại được', () => {
  const x = taoPrng(7);
  const y = taoPrng(7);
  assert.deepEqual([x.so(), x.so(), x.nguyen(100)], [y.so(), y.so(), y.nguyen(100)]);
  assert.notEqual(hatCon(1, 'a'), hatCon(1, 'b'));
  assert.equal(hatCon(1, 'a'), hatCon(1, 'a'));
  const r = taoPrng(3);
  for (let i = 0; i < 200; i += 1) {
    const v = r.so();
    assert.ok(v >= 0 && v < 1);
  }
});

test('AN TOÀN: MONKEY_CHO_GHI=1 trỏ vào máy THẬT bị từ chối; vào localhost thì được', () => {
  const goc = { MONKEY_PROFILE: path.resolve(__dirname, '../profiles/xem-don-thu.json'), UAT_PASS: 'x' };
  assert.throws(() => docCauHinh({ ...goc, UAT_BASE: 'http://171.244.40.245', MONKEY_CHO_GHI: '1' }), /từ chối/);
  assert.throws(() => docCauHinh({ ...goc, UAT_BASE: 'https://pc02.example.vn', MONKEY_CHO_GHI: '1' }), /từ chối/);
  // Lừa bằng tên miền chứa "localhost": không phải localhost.
  assert.throws(() => docCauHinh({ ...goc, UAT_BASE: 'http://localhost.evil.com', MONKEY_CHO_GHI: '1' }), /từ chối/);
  assert.doesNotThrow(() => docCauHinh({ ...goc, UAT_BASE: 'http://localhost:5173', MONKEY_CHO_GHI: '1' }));
  assert.doesNotThrow(() => docCauHinh({ ...goc, UAT_BASE: 'http://171.244.40.245' })); // không CHO_GHI: chỉ đọc, được
  assert.equal(laMayLocal('http://127.0.0.1:3000'), true);
  assert.equal(laMayLocal('http://171.244.40.245'), false);
});

test('HỒ SƠ: mọi hồ sơ trong profiles/ nạp được và chỉ dùng bất biến có thật', () => {
  const fs = require('node:fs');
  const dir = path.resolve(__dirname, '../profiles');
  const tep = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
  assert.ok(tep.length >= 8);
  for (const f of tep) {
    assert.doesNotThrow(() =>
      docCauHinh({ MONKEY_PROFILE: path.join(dir, f), UAT_PASS: 'x', UAT_BASE: 'http://localhost:5173' }),
    f);
  }
});

test('HỒ SƠ SAI: bất biến không tồn tại → báo lỗi cấu hình rõ ràng (không lặng lẽ bỏ qua)', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const t = path.join(os.tmpdir(), `hs-sai-${process.pid}.json`);
  fs.writeFileSync(t, JSON.stringify({ ten: 'sai', tuyen: ['/'], batBien: ['khong_ton_tai'] }));
  assert.throws(() => docCauHinh({ MONKEY_PROFILE: t, UAT_PASS: 'x', UAT_BASE: 'http://localhost:5173' }), /không tồn tại/);
  fs.unlinkSync(t);
});

// ───────────────────────── Codex review 08/10/2026 ─────────────────────────

const { maThoat } = require('../monkey.cjs');
const { BAT_BIEN } = require('../lib/bat-bien.cjs');

function layPw() {
  for (const ten of ['playwright', '@playwright/test', 'playwright-core']) {
    try {
      return require(ten);
    } catch {
      /* thử tên kế */
    }
  }
  throw new Error('không nạp được playwright');
}

test('MÃ THOÁT: CHƯA KIỂM không bao giờ là đạt (Codex P1)', () => {
  assert.equal(maThoat({ phatHien: [], chuaKiem: [] }), 0);
  assert.equal(maThoat({ phatHien: [{}], chuaKiem: [] }), 1);
  assert.equal(maThoat({ phatHien: [], chuaKiem: [{}] }), 1, 'chưa kiểm KHÔNG được thoát 0');
  assert.equal(maThoat({ phatHien: [{}], chuaKiem: [{}] }), 1);
});

test('BẤT BIẾN KHÔNG XANH GIẢ: không thấy nút ⋮ nào → CHƯA KIỂM, không phải đạt (Codex P2)', async () => {
  const trangKhongCoNut = {
    evaluate: async () => ({ loi: [], so: 0 }),
    waitForTimeout: async () => {}, waitForSelector: async () => {},
  };
  const r = await BAT_BIEN.mot_nut_menu_moi_dong.kiem({ page: trangKhongCoNut, vp: { width: 390, height: 844 } });
  assert.ok(r && r.khongDoDuoc === true, 'phải là khongDoDuoc');
  // Trên máy tính bất biến không áp dụng: không phải CHƯA KIỂM mà là bỏ qua.
  assert.equal(await BAT_BIEN.mot_nut_menu_moi_dong.kiem({ page: trangKhongCoNut, vp: { width: 1600, height: 1000 } }), null);
  // Có nút và đạt → null; có nút nhưng vi phạm → báo lỗi.
  const dat = { evaluate: async () => ({ loi: [], so: 3 }), waitForTimeout: async () => {}, waitForSelector: async () => {} };
  assert.equal(await BAT_BIEN.mot_nut_menu_moi_dong.kiem({ page: dat, vp: { width: 390 } }), null);
  const sai = { evaluate: async () => ({ loi: ['ô có 5 nút (phải 1)'], so: 3 }), waitForTimeout: async () => {}, waitForSelector: async () => {} };
  const r2 = await BAT_BIEN.mot_nut_menu_moi_dong.kiem({ page: sai, vp: { width: 390 } });
  assert.match(r2.chiTiet, /5 nút/);
});

test('AN TOÀN: cho ghi (local) vẫn CHẶN yêu cầu ghi tới máy KHÁC kể cả khi UAT_BASE là local (Codex P1)', async () => {
  const may = http.createServer((req, res) => {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(`<!doctype html><meta charset="utf-8"><main>${NOI_DUNG}
<button id="ngoai" onclick="fetch('http://may-that.example.test/api/v1/petitions',{method:'POST'}).catch(function(){})">Ghi ra ngoài</button>
<button id="trong" onclick="fetch('/api/v1/petitions',{method:'POST'}).catch(function(){})">Ghi vào máy này</button></main>`);
  });
  await new Promise((ok) => may.listen(0, '127.0.0.1', ok));
  const coSo = `http://127.0.0.1:${may.address().port}`;
  try {
    let ngoai = [];
    let phatHien = [];
    for (const hat of [21, 22, 23]) {
      const cfg = { ...cauHinh(coSo, hat, 30), choGhi: true };
      cfg.hoSo = [{ ten: 'ghi-ngoai', tuyen: ['/trang'], batBien: [], _tep: path.resolve(__dirname, 'x') }];
      const kq = await chay(cfg);
      ngoai = ngoai.concat(kq.ghiRaNgoai);
      phatHien = phatHien.concat(kq.phatHien.map((p) => p.loai));
    }
    assert.ok(ngoai.some((x) => x.includes('may-that.example.test')), `phải chặn ghi ra máy ngoài; thấy: ${JSON.stringify(ngoai)}`);
    assert.ok(phatHien.includes('ghi ra ngoài máy local'), 'phải báo thành phát hiện');
  } finally {
    may.close();
  }
});

test('KHÔNG RÒ TRÌNH DUYỆT: lỗi giữa chừng (tệp đường thiếu) vẫn đóng trình duyệt (Codex P2)', async () => {
  const pw = layPw();
  const daMo = [];
  const goc = pw.chromium.launch.bind(pw.chromium);
  pw.chromium.launch = async (...a) => {
    const b = await goc(...a);
    daMo.push(b);
    return b;
  };
  const { may, coSo } = await dungMayChu(true);
  try {
    const cfg = cauHinh(coSo, 5, 5);
    cfg.hoSo = [{ ten: 'thieu-tep', tepDuong: 'khong-ton-tai-duong.txt', batBien: [], _tep: path.resolve(__dirname, 'x') }];
    await assert.rejects(() => chay(cfg));
    assert.ok(daMo.length >= 1, 'phải đã mở trình duyệt (cổng không rỗng)');
    assert.ok(daMo.every((b) => !b.isConnected()), 'mọi trình duyệt phải đã đóng');
  } finally {
    pw.chromium.launch = goc;
    may.close();
  }
});

test('BẤT BIẾN gio_tiep_nhan_dinh_dang: chữ lọt vào ô / giá trị hỏng không báo lỗi → phát hiện; hợp lệ hoặc có báo lỗi → đạt', async () => {
  const gia = (kq) => ({ evaluate: async () => kq });
  const kiem = (kq) => BAT_BIEN.gio_tiep_nhan_dinh_dang.kiem({ page: gia(kq), hd: { gio: 'x' } });
  // đạt
  for (const giaTri of ['', '08:30', '00:00', '23:59']) {
    assert.equal(await kiem({ co: true, giaTri, baoLoi: false }), null, `"${giaTri}" phải đạt`);
  }
  // đang báo lỗi tại ô thì giá trị không hợp lệ vẫn đạt (người dùng thấy lỗi)
  assert.equal(await kiem({ co: true, giaTri: '24:50', baoLoi: true }), null);
  // GIEO LỖI: giá trị hỏng mà KHÔNG báo lỗi
  const r1 = await kiem({ co: true, giaTri: '24:50', baoLoi: false });
  assert.ok(r1 && /KHÔNG báo lỗi/.test(r1.chiTiet), 'phải bắt giá trị hỏng im lặng');
  // GIEO LỖI: chữ cái lọt vào ô, hoặc dài quá 5 ký tự
  assert.ok(await kiem({ co: true, giaTri: 'ab:30', baoLoi: true }), 'chữ cái lọt vào ô phải bị bắt kể cả khi có báo lỗi');
  assert.ok(await kiem({ co: true, giaTri: '08:300', baoLoi: true }), 'quá 5 ký tự phải bị bắt');
  assert.ok(await kiem({ co: true, giaTri: '0:3:0', baoLoi: true }), 'hai dấu ":" phải bị bắt');
  // Codex 09/10: chuỗi toàn chữ số mà ô đang báo lỗi thì đạt (luật hợp lệ quyết định ở bước sau), không báo lỗi thì bị bắt
  assert.equal(await kiem({ co: true, giaTri: '0830', baoLoi: true }), null);
  assert.ok(await kiem({ co: true, giaTri: '0830', baoLoi: false }), '"0830" còn nguyên mà im lặng phải bị bắt');
  // không thấy ô → CHƯA KIỂM, không phải đạt
  const r2 = await kiem({ co: false, giaTri: '', baoLoi: false });
  assert.ok(r2 && r2.khongDoDuoc === true);
});

test('BẤT BIẾN chep_don_ngay_hom_nay: màn không phải "xem một đơn" thì BỎ QUA (không tính CHƯA KIỂM)', async () => {
  const page = { locator: () => ({ first: () => ({ count: async () => 0 }) }) };
  for (const route of ['/petitions/new', '/petitions/abc/edit', '/petitions', '/cases/abc']) {
    assert.equal(await BAT_BIEN.chep_don_ngay_hom_nay.kiem({ page, route }), null, route);
  }
  // Màn xem một đơn mà không có nút → mới là CHƯA KIỂM
  const r = await BAT_BIEN.chep_don_ngay_hom_nay.kiem({ page, route: '/petitions/abc' });
  assert.ok(r && r.khongDoDuoc === true);
});

test('BẤT BIẾN mot_nut_menu_moi_dong dùng ngưỡng 32px (sau khi anh yêu cầu thu nhỏ nút ⋮)', () => {
  const nguon = require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../lib/bat-bien.cjs'), 'utf-8');
  assert.match(nguon, /rc\.width < 31\.5/);
  assert.match(nguon, /kh\.width > 44/);
  assert.doesNotMatch(nguon, /43\.5/, 'còn ngưỡng 44px cũ');
});

test('SỔ CHƯA KIỂM: một bước không đo được KHÔNG làm cả đường thành CHƯA KIỂM nếu bước khác đã đo', () => {
  const { taoSoChuaKiem } = require('../lib/so-chua-kiem.cjs');
  const so = taoSoChuaKiem();
  // Đường A: bước 1 không đo được (đang chuyển trang), bước 2 đo được → ĐÃ KIỂM.
  so.khongDo('l1', 'bb', '/a', 'chưa có dòng');
  so.daDo('l1', 'bb', '/a');
  // Đường B: không bước nào đo được → CHƯA KIỂM.
  so.khongDo('l1', 'bb', '/b', 'không có nút');
  so.khongDo('l1', 'bb', '/b', 'không có nút (lần 2)');
  // Đường C: đo được ngay từ đầu → không có gì để báo.
  so.daDo('l1', 'bb', '/c');
  const ra = so.chot();
  assert.deepEqual(ra.map((x) => x.duong), ['/b']);
  assert.equal(ra[0].batBien, 'bb');
  assert.equal(ra[0].luot, 'l1');
  assert.match(ra[0].chiTiet, /không có nút/);
});

test('SỔ CHƯA KIỂM: cùng bất biến + đường nhưng KHÁC lượt thì tính riêng', () => {
  const { taoSoChuaKiem } = require('../lib/so-chua-kiem.cjs');
  const so = taoSoChuaKiem();
  so.khongDo('chromium', 'bb', '/a', 'x');
  so.daDo('webkit', 'bb', '/a');
  const ra = so.chot();
  assert.deepEqual(ra.map((x) => x.luot), ['chromium']);
});

test('SỔ CHƯA KIỂM: chốt xong thì sổ trống, chốt hai lần không báo trùng', () => {
  const { taoSoChuaKiem } = require('../lib/so-chua-kiem.cjs');
  const so = taoSoChuaKiem();
  so.khongDo('l', 'bb', '/a', 'x');
  assert.equal(so.chot().length, 1);
  assert.equal(so.chot().length, 0);
});

test('BẤT BIẾN mot_nut_menu_moi_dong: chạy cả lúc VÀO đường (đảm bảo ít nhất một lần đo trước khi thao tác ngẫu nhiên đổi bộ lọc)', () => {
  const { BAT_BIEN } = require('../lib/bat-bien.cjs');
  const khi = [].concat(BAT_BIEN.mot_nut_menu_moi_dong.khiNao);
  assert.ok(khi.includes('buoc'), 'vẫn đo sau mỗi bước');
  assert.ok(khi.includes('dau-duong'), 'phải đo ngay khi vào đường');
});

test('BẤT BIẾN mot_nut_menu_moi_dong ở đầu đường: chờ danh sách tải xong rồi mới đo', async () => {
  const { BAT_BIEN } = require('../lib/bat-bien.cjs');
  let daCho = false;
  const page = {
    waitForSelector: async () => { daCho = true; },
    waitForTimeout: async () => {},
    evaluate: async () => ({ loi: [], so: 3 }),
  };
  const r = await BAT_BIEN.mot_nut_menu_moi_dong.kiem({ page, vp: { width: 390, height: 844 } }); // no `hd` = start of route
  assert.equal(r, null);
  assert.equal(daCho, true, 'đầu đường phải chờ có dòng trước khi đo');
});

test('HÀNH ĐỘNG mo-bang-thao-tac: cú bấm bị chặn (không chạm được nút) KHÔNG được tính là "bấm ⋮ không mở bảng"', async () => {
  const { chonHanhDong, HANH_DONG } = require('../lib/hanh-dong.cjs');
  const hd = (HANH_DONG || []).find((x) => x.ten === 'mo-bang-thao-tac');
  assert.ok(hd, 'thiếu hành động mo-bang-thao-tac (cần export HANH_DONG)');
  const nut = { count: async () => 1, scrollIntoViewIfNeeded: async () => {}, focus: async () => {}, click: async () => { throw new Error('intercepts pointer events'); } };
  const page = {
    getByRole: () => ({ count: async () => 0 }),
    locator: () => ({ first: () => nut }),
    keyboard: { press: async () => {} },
    waitForTimeout: async () => {},
  };
  assert.equal(await hd.chay({ page }), null);
});
