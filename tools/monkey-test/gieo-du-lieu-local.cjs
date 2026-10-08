/**
 * Gieo dữ liệu mẫu vào stack LOCAL để monkey test có thứ mà bấm: đơn thư (có tên người gửi TRÙNG nhau để thử gợi ý
 * tên), vụ việc, vụ án.
 *
 * CHỈ CHẠY CHO MÁY LOCAL: từ chối mọi địa chỉ không phải localhost/127.0.0.1 — script này GHI dữ liệu.
 *
 *   UAT_BASE=http://localhost:5173 UAT_USER=admin@pc02.local UAT_PASS=... node gieo-du-lieu-local.cjs
 */
const CO_SO = process.env.UAT_BASE || 'http://localhost:5173';
const TK = process.env.UAT_USER || 'admin@pc02.local';
const MK = process.env.UAT_PASS;
const SO_DON = Number(process.env.GIEO_SO_DON || 40);


function laMayLocal(url) {
  try {
    const h = new URL(url).hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1';
  } catch {
    return false;
  }
}

async function goi(ten, method, duong, token, body) {
  const r = await fetch(`${CO_SO}/api/v1${duong}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  let j;
  try {
    j = JSON.parse(t);
  } catch {
    j = t;
  }
  if (!r.ok) throw new Error(`${ten}: ${method} ${duong} → ${r.status} ${t.slice(0, 200)}`);
  return j;
}

(async () => {
  if (!laMayLocal(CO_SO)) {
    console.error(`TỪ CHỐI: ${CO_SO} không phải máy local — script này GHI dữ liệu.`);
    process.exit(2);
  }
  if (!MK) {
    console.error('Thiếu UAT_PASS');
    process.exit(2);
  }
  const dn = await goi('đăng nhập', 'POST', '/auth/login', null, { username: TK, password: MK });
  const token = dn.accessToken;
  if (!token) throw new Error('Đăng nhập không trả accessToken: ' + JSON.stringify(dn).slice(0, 200));

  // Tên lặp lại nhiều lần để ô gợi ý có "nhiều đơn cùng tên" và tóm tắt dài ngắn khác nhau.
  const TEN = ['Nguyễn Văn An', 'Trần Thị Bình', 'Lê Hoàng Cường', 'Công ty TNHH Minh Phát', 'Phạm Thị Dung'];
  const TOM_TAT = [
    'Tố giác hành vi lừa đảo chiếm đoạt tài sản thông qua mạng xã hội, số tiền khoảng 150 triệu đồng.',
    'Phản ánh tranh chấp đất đai kéo dài giữa hai hộ liền kề, đề nghị xem xét giải quyết theo thẩm quyền. '.repeat(6),
    'Đơn kiến nghị về việc chậm giải quyết hồ sơ.',
  ];
  // Đơn không nặc danh bắt buộc có tội danh chính: lấy một mã có thật trong danh mục.
  const dsTD = await goi('tội danh', 'GET', '/crimes?pc02Only=false&isActive=true&limit=5', token);
  const mang = Array.isArray(dsTD) ? dsTD : (dsTD.data ?? dsTD.items ?? []);
  const crimeChinhId = mang[0]?.id;
  if (!crimeChinhId) throw new Error('Danh mục tội danh trống — chạy db:seed:crimes trước');
  let ok = 0;
  for (let i = 0; i < SO_DON; i += 1) {
    const ngay = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    try {
      await goi('đơn thư', 'POST', '/petitions', token, {
        receivedDate: ngay,
        senderName: TEN[i % TEN.length],
        detailContent: TOM_TAT[i % TOM_TAT.length],
        crimeChinhId,
        unit: 'PC02',
      });
      ok += 1;
    } catch (e) {
      if (i < 2) console.log('  (đơn thư) ' + e.message);
    }
  }
  console.log(`Đã gieo ${ok}/${SO_DON} đơn thư.`);

  // Vụ việc và vụ án: chỉ cần tên (vụ án thêm căn cứ tiếp nhận). Đủ để các danh sách có dòng mà bấm.
  const SO_KHAC = Number(process.env.GIEO_SO_KHAC || 12);
  // Danh sách mặc định lọc theo KỲ (tháng hiện tại) trên ngày đề xuất: bản ghi không có ngày thì không hiện ra.
  const homNay = new Date().toISOString().slice(0, 10);
  let vv = 0;
  let va = 0;
  for (let i = 0; i < SO_KHAC; i += 1) {
    try {
      await goi('vụ việc', 'POST', '/incidents', token, { name: `Vụ việc mẫu ${i + 1} - ${TEN[i % TEN.length]}`, ngayDeXuat: homNay });
      vv += 1;
    } catch (e) {
      if (i < 1) console.log('  (vụ việc) ' + e.message);
    }
    try {
      await goi('vụ án', 'POST', '/cases', token, {
        name: `Vụ án mẫu ${i + 1}`,
        caseProvenance: 'DIRECT_DISCOVERY',
        ngayDeXuat: homNay,
      });
      va += 1;
    } catch (e) {
      if (i < 1) console.log('  (vụ án) ' + e.message);
    }
  }
  console.log(`Đã gieo ${vv}/${SO_KHAC} vụ việc, ${va}/${SO_KHAC} vụ án.`);
  process.exit(ok > 0 ? 0 : 1);
})().catch((e) => {
  console.error('LỖI:', e.message);
  process.exit(2);
});
