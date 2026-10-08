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
  assert.ok(tep.length >= 7);
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
