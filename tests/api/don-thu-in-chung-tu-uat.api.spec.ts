/**
 * UAT nhóm F — IN CHỨNG TỪ, đợt 20/09/2026.
 *
 * Đây là chỗ hỏng ĐẮT NHẤT của cả đợt: bản in là văn bản GỬI RA NGOÀI NGÀNH. In trống thì
 * người nhận thấy thiếu; in SAI ngày thì không ai kiểm lại. Cả hai đều im lặng với cán bộ vừa
 * bấm In.
 *
 * Ba đường phải đỡ, và chúng KHÁC NHAU về nguyên nhân:
 *  1. Hồ sơ hệ mới nhập ĐỦ   → `petitionDate` có, cột chữ có.
 *  2. Hồ sơ hệ mới nhập THIẾU → `petitionDate` NULL theo đúng thiết kế; đọc thẳng cột là in trống.
 *  3. Hồ sơ DI TRÚ → `ngay_viet_don` là CHỮ TỰ DO ("tháng 5/2026"); chuẩn hoá là mất thông tin.
 *
 * Ca này GHI dữ liệu (tạo đơn thử) nên đặt sau cổng `UAT_CHO_GHI=1`.
 * Oracle: `docs/uat/dot-2009/_domain-pack.md` mục R5-PRINT / R5-LEGACY / R5-NOFAKE.
 */
import { test, expect, type APIRequestContext } from '@playwright/test';
import { getAuthToken } from '../helpers/auth';

const API = (process.env.BASE_URL || 'http://171.244.40.245') + '/api/v1';
const CHO_GHI = process.env.UAT_CHO_GHI === '1';
const NHAN = 'UAT-2009-IN';

/** Mẫu dùng để đo. Chọn mẫu hệ cũ vì chính nó in ô `ngay_viet_don`. */
const MAU_DO = process.env.UAT_MAU_IN || 'PHIEU_CHUYEN_DON';

function auth() {
  const t = getAuthToken();
  expect(t, 'Cần UAT_TOKEN — không có thì mọi ca 401').not.toBe('');
  return { Authorization: `Bearer ${t}` };
}

function doiDuyetGhi() {
  expect(
    CHO_GHI,
    'CA NÀY GHI DỮ LIỆU THẬT. Đặt UAT_CHO_GHI=1; trên prod phải có anh đồng ý trước (§8c).',
  ).toBe(true);
}

let maToiDanh: string | null = null;
async function layMaToiDanh(req: APIRequestContext): Promise<string> {
  if (maToiDanh) return maToiDanh;
  const r = await req.get(`${API}/crimes?limit=1`, { headers: auth() });
  const ds = ((await r.json()).data ?? []) as Array<{ id: string }>;
  expect(ds.length, 'danh mục tội danh rỗng — không dựng được đơn thử').toBeGreaterThan(0);
  maToiDanh = ds[0].id;
  return maToiDanh;
}

async function taoDon(req: APIRequestContext, them: Record<string, unknown>) {
  const r = await req.post(`${API}/petitions`, {
    headers: auth(),
    data: {
      receivedDate: new Date().toISOString().slice(0, 10),
      senderName: `${NHAN} nguoi gui`,
      senderAddress: NHAN,
      summary: `${NHAN} — kiem ban in`,
      crimeChinhId: await layMaToiDanh(req),
      ...them,
    },
  });
  expect(r.status(), await r.text()).toBe(201);
  const b = await r.json();
  return ((b.data ?? b) as { id: string }).id;
}

async function don(req: APIRequestContext, id: string) {
  await req.delete(`${API}/petitions/${id}`, {
    headers: auth(),
    data: { reason: `${NHAN} dọn sau ca kiểm` },
  });
}

/**
 * Lấy `word/document.xml` khỏi một tệp .docx.
 *
 * Tự đọc ĐỊNH DẠNG ZIP bằng `zlib` của Node thay vì kéo thêm thư viện: `pizzip` chỉ nằm trong
 * `backend/node_modules` nên không giải được từ gốc kho, và thêm một phụ thuộc chỉ để đọc một
 * mục trong zip là sai bậc thang.
 *
 * Quét các LOCAL FILE HEADER (`PK`) và dừng ở mục cần — docx chỉ dùng hai cách nén:
 * 0 (để nguyên) và 8 (deflate).
 */
function docXmlTuDocx(buf: Buffer): string {
  const CAN = 'word/document.xml';
  for (let i = 0; i + 30 < buf.length; i += 1) {
    if (buf.readUInt32LE(i) !== 0x04034b50) continue;
    const cachNen = buf.readUInt16LE(i + 8);
    const coNen = buf.readUInt32LE(i + 18);
    const daiTen = buf.readUInt16LE(i + 26);
    const daiThem = buf.readUInt16LE(i + 28);
    const ten = buf.toString('utf8', i + 30, i + 30 + daiTen);
    if (ten !== CAN) continue;

    const dau = i + 30 + daiTen + daiThem;
    const than = buf.subarray(dau, dau + coNen);
    if (cachNen === 0) return than.toString('utf8');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const zlib = require('node:zlib') as typeof import('node:zlib');
    return zlib.inflateRawSync(than).toString('utf8');
  }
  throw new Error(`Không tìm thấy ${CAN} trong tệp .docx — lượt in trả về thứ khác`);
}

/**
 * CHỮ THẬT trong tệp Word mà lượt In sinh ra.
 *
 * Đi đúng đường cán bộ bấm: `POST /petitions/:id/export-documents` trả .docx, rồi mở
 * `word/document.xml` lấy phần chữ. Đây là bằng chứng về BẢN IN — thứ gửi ra ngoài ngành —
 * chứ không phải về một hàm nào đó ở giữa.
 */
async function chuTrongBanIn(
  req: APIRequestContext,
  id: string,
  maMau: string,
): Promise<string> {
  const rMau = await req.get(`${API}/petitions/export-templates`, { headers: auth() });
  expect(rMau.status(), await rMau.text()).toBe(200);
  const thanMau = await rMau.json();
  const dsMau = (thanMau.data ?? thanMau.items ?? thanMau) as Array<{
    id: string;
    code: string;
  }>;
  const mau = (Array.isArray(dsMau) ? dsMau : []).find((x) => x.code === maMau);
  expect(mau, `không có mẫu ${maMau} trên bản đang chạy`).toBeTruthy();

  const r = await req.post(`${API}/petitions/${id}/export-documents`, {
    headers: auth(),
    data: { templateIds: [mau!.id], mode: 'merged' },
  });
  // Máy chủ trả 201 cho lượt sinh tài liệu (đo trên bản chạy), nhận cả 200 phòng đổi về sau.
  // KHÔNG đổ thân phản hồi vào câu báo lỗi: thân là tệp .docx nhị phân, in ra làm hỏng bảng kết quả.
  expect([200, 201], `lượt in trả ${r.status()}`).toContain(r.status());

  const xml = docXmlTuDocx(await r.body());
  expect(xml.length, 'tệp Word rỗng — lượt in hỏng').toBeGreaterThan(0);

  // Bỏ thẻ, giữ chữ. `</w:p>` thành xuống dòng để hai ô cạnh nhau không dính làm một.
  return xml
    .replace(/<\/w:p>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/ /g, ' ');
}

test.describe('F · Bản in "Ngày viết đơn"', () => {
  test('F1 — đơn nhập ĐỦ ngày: bản in có ngày đúng', async ({ request }) => {
    doiDuyetGhi();
    const id = await taoDon(request, {
      petitionDate: '2026-12-15',
      ngayVietDonEdtf: '2026-12-15',
    });
    const chu = await chuTrongBanIn(request, id, MAU_DO);
    expect(chu, 'bản in không có ngày đã nhập').toContain('15/12/2026');
    await don(request, id);
  });

  test('F2 — đơn nhập THIẾU: bản in có `__/12/2026`, KHÔNG trống', async ({ request }) => {
    doiDuyetGhi();
    const id = await taoDon(request, { ngayVietDonEdtf: '2026-12-XX' });
    const chu = await chuTrongBanIn(request, id, MAU_DO);
    expect(
      chu,
      'in trống nghĩa là thông tin cán bộ đã nhập BIẾN MẤT trên văn bản gửi đi',
    ).toContain('__/12/2026');
    await don(request, id);
  });

  test('F4 — bản in KHÔNG ra ngày BỊA (mồng 1)', async ({ request }) => {
    doiDuyetGhi();
    const id = await taoDon(request, { ngayVietDonEdtf: '2026-XX-XX' });
    const chu = await chuTrongBanIn(request, id, MAU_DO);
    expect(chu).toContain('__/__/2026');
    expect(
      chu,
      'bịa ngày 01 là dựng ra một sự kiện chưa từng xảy ra, trên văn bản tố tụng',
    ).not.toContain('01/01/2026');
    await don(request, id);
  });

  test('F1b — đơn KHÔNG nhập ngày: bản in vẫn dựng được, không in rác', async ({ request }) => {
    doiDuyetGhi();
    const id = await taoDon(request, {});
    const chu = await chuTrongBanIn(request, id, MAU_DO);
    expect(chu).not.toContain('__/__/');
    expect(chu).not.toContain('undefined');
    expect(chu).not.toContain('null');
    await don(request, id);
  });
});

test.describe('F3 · Hồ sơ DI TRÚ — chữ tự do phải in NGUYÊN VĂN', () => {
  /*
    Đo bản sao prod 20/09: 46.580 hồ sơ có `legacyRaw.ngay_viet_don`, trong đó **4.435 hồ sơ là
    CHỮ TỰ DO** — "không ghi ngày, tháng, năm", "28/12/2023, 19/12/2023, 20/12/2023 (03 đơn)…".

    Chuẩn hoá chúng là in ra TRỐNG: mất hẳn thông tin trên văn bản gửi đi, và mất im lặng — cán
    bộ bấm In, tệp tải về trông bình thường, chỉ thiếu một dòng. Nên dữ liệu thô hệ cũ THẮNG.

    Ca này CHỈ ĐỌC, không tạo hồ sơ nào.
  */
  test('bản in chứa ĐÚNG chữ tự do của hệ cũ, không bị chuẩn hoá thành rỗng', async ({
    request,
  }) => {
    const r = await request.get(`${API}/petitions?limit=100`, { headers: auth() });
    expect(r.status(), await r.text()).toBe(200);
    const ds = ((await r.json()).data ?? []) as Array<{ id: string }>;
    expect(ds.length, 'danh sách rỗng thì không dò được hồ sơ di trú').toBeGreaterThan(0);

    let daSoi = 0;
    let daGap = false;
    for (const p of ds) {
      const chiTiet = await request.get(`${API}/petitions/${p.id}`, { headers: auth() });
      if (chiTiet.status() !== 200) continue;
      const b = await chiTiet.json();
      const tho = ((b.data ?? b).legacyRaw ?? {})['ngay_viet_don'];
      daSoi += 1;
      if (typeof tho !== 'string' || !tho.trim()) continue;
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(tho.trim())) continue;

      const chu = await chuTrongBanIn(request, p.id, MAU_DO);
      expect(
        chu,
        `hồ sơ ${p.id} có chữ tự do "${tho}" nhưng bản in không chứa nó — thông tin đã mất`,
      ).toContain(tho.trim().slice(0, 20));
      daGap = true;
      break;
    }

    expect(daSoi, 'không đọc được hồ sơ nào').toBeGreaterThan(0);
    // Không gặp ca chữ tự do trong 100 hồ sơ đầu là CHƯA KIỂM, không phải đạt.
    expect(
      daGap,
      'không gặp hồ sơ di trú nào có chữ tự do trong 100 hồ sơ đầu — mệnh đề CHƯA có bằng chứng',
    ).toBe(true);
  });
});
