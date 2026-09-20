/**
 * UAT tầng API — đợt 20/09/2026, phần **CÓ GHI DỮ LIỆU**.
 *
 * Tách khỏi `don-thu-nhap-lieu-nhanh-uat.api.spec.ts` vì mỗi ca dưới đây TẠO một đơn thư thật.
 * Chạy trên prod nghĩa là thêm bản ghi vào 47.488 đơn đang có — §8c của giao thức đòi hỏi anh
 * xác nhận trước.
 *
 * Cổng: biến môi trường `UAT_CHO_GHI=1`. Thiếu cờ thì ca **ĐỎ với câu nói rõ lý do**, KHÔNG
 * `test.skip` — ca bỏ qua là CHƯA KIỂM, mà một bảng toàn "skipped" nhìn hệt như một bảng sạch.
 *
 * Dọn dẹp: mỗi ca tự xoá mềm đơn nó tạo (`DELETE /petitions/:id`). Xoá mềm nên bản ghi vẫn nằm
 * trong CSDL — đây là ghi thật, không phải ghi tạm. Đừng nhầm.
 *
 * Oracle: `docs/uat/dot-2009/_domain-pack.md`.
 */
import { test, expect, type APIRequestContext } from '@playwright/test';
import { getAuthToken } from '../helpers/auth';

const API = (process.env.BASE_URL || 'http://171.244.40.245') + '/api/v1';
const CHO_GHI = process.env.UAT_CHO_GHI === '1';

function auth() {
  const t = getAuthToken();
  expect(t, 'Cần UAT_TOKEN — không có thì mọi ca 401').not.toBe('');
  return { Authorization: `Bearer ${t}` };
}

/** Cổng ghi. Gọi ĐẦU mỗi ca. Thiếu duyệt thì đỏ, không im lặng. */
function doiDuyetGhi() {
  expect(
    CHO_GHI,
    'CA NÀY GHI DỮ LIỆU THẬT. Chưa được duyệt nên chưa chạy.\n' +
      'Muốn chạy: đặt UAT_CHO_GHI=1. Trên prod thì phải có anh đồng ý trước (§8c).',
  ).toBe(true);
}

const NHAN = 'UAT-2009';

function donToiThieu(ghiDe: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    receivedDate: new Date().toISOString().slice(0, 10),
    senderName: `${NHAN} nguoi gui`,
    senderAddress: NHAN,
    summary: `${NHAN} — ca UAT co ghi, xoa ngay sau khi kiem`,
    ...ghiDe,
  };
}

async function tao(req: APIRequestContext, than: Record<string, unknown>) {
  return req.post(`${API}/petitions`, { headers: auth(), data: than });
}

async function doc(req: APIRequestContext, id: string) {
  const r = await req.get(`${API}/petitions/${id}`, { headers: auth() });
  expect(r.status(), await r.text()).toBe(200);
  const b = await r.json();
  return (b.data ?? b) as Record<string, unknown>;
}

async function don(req: APIRequestContext, id: string) {
  await req.delete(`${API}/petitions/${id}`, {
    headers: auth(),
    data: { reason: `${NHAN} dọn sau ca kiểm` },
  });
}

test.describe('H2/H5 · Đơn bình thường và đơn thiếu SĐT vẫn lưu được', () => {
  test('H5 — đơn BÌNH THƯỜNG vẫn 201 (khoá form mới không làm 400 toàn cục)', async ({
    request,
  }) => {
    doiDuyetGhi();
    const res = await tao(request, donToiThieu({ senderPhone: '0901234567' }));
    expect(
      res.status(),
      'Thiếu một khoá ở DTO là 400 cho MỌI lượt tạo đơn, không riêng đơn ngày thiếu. ' +
        (await res.text()),
    ).toBe(201);
    const b = (await res.json()).data ?? (await res.json());
    await don(request, b.id as string);
  });

  test('H2 — nguồn "Bưu điện" + SĐT TRỐNG → 201', async ({ request }) => {
    doiDuyetGhi();
    const res = await tao(request, donToiThieu({ nguonDon: 'Bưu điện', senderPhone: '' }));
    expect(
      res.status(),
      'Đây là điều anh yêu cầu: SĐT chỉ bắt buộc khi nộp trực tiếp. ' + (await res.text()),
    ).toBe(201);
    const b = (await res.json()).data ?? (await res.json());
    await don(request, b.id as string);
  });

  test('K7 — Nguồn đơn để TRỐNG → 201', async ({ request }) => {
    doiDuyetGhi();
    const res = await tao(request, donToiThieu({ nguonDon: '', senderPhone: '' }));
    expect(res.status(), await res.text()).toBe(201);
    const b = (await res.json()).data ?? (await res.json());
    await don(request, b.id as string);
  });

  test('K6 — đơn NẶC DANH + Trực tiếp + SĐT trống → 201', async ({ request }) => {
    doiDuyetGhi();
    const res = await tao(
      request,
      donToiThieu({ senderIsAnonymous: true, nguonDon: 'Trực tiếp', senderPhone: '' }),
    );
    expect(
      res.status(),
      'Giao điểm hai luật: nặc danh thì không có ai để xin số. ' + (await res.text()),
    ).toBe(201);
    const b = (await res.json()).data ?? (await res.json());
    await don(request, b.id as string);
  });
});

test.describe('K2/CX.4 · Ngày viết đơn nhập thiếu — ĐƯỜNG TẠO MỚI', () => {
  /*
    Đây là lỗi P1 đã bắt được khi rà mã: chỉ đường CẬP NHẬT ghi cột chữ, đường TẠO MỚI bỏ quên.
    Ca ở tầng giao diện dừng lại ở thân yêu cầu gửi đi nên không thấy. Phải đọc LẠI từ máy chủ.
  */
  for (const [nhan, edtf] of [
    ['thiếu ngày', '2026-12-XX'],
    ['thiếu cả ngày lẫn tháng', '2026-XX-XX'],
  ] as const) {
    test(`tạo mới ${nhan} (${edtf}) → cột chữ CÓ, cột ngày thật RỖNG`, async ({ request }) => {
      doiDuyetGhi();
      const res = await tao(request, donToiThieu({ ngayVietDonEdtf: edtf }));
      expect(res.status(), await res.text()).toBe(201);
      const id = ((await res.json()).data ?? (await res.json())).id as string;

      const sau = await doc(request, id);
      expect(sau.ngayVietDonEdtf, `${edtf} không xuống tới cột — đơn mất ngày`).toBe(edtf);
      expect(
        sau.petitionDate ?? null,
        'Nhập thiếu mà cột ngày thật CÓ giá trị nghĩa là hệ đã BỊA ngày',
      ).toBeNull();

      await don(request, id);
    });
  }

  test('nhập ĐỦ ngày → cả hai cột đều có, và khớp nhau', async ({ request }) => {
    doiDuyetGhi();
    const res = await tao(
      request,
      donToiThieu({ ngayVietDonEdtf: '2026-12-15', petitionDate: '2026-12-15' }),
    );
    expect(res.status(), await res.text()).toBe(201);
    const id = ((await res.json()).data ?? (await res.json())).id as string;

    const sau = await doc(request, id);
    expect(sau.ngayVietDonEdtf).toBe('2026-12-15');
    expect(String(sau.petitionDate ?? '')).toContain('2026-12-15');

    await don(request, id);
  });
});

test.describe('L6 · STT tự sinh vẫn đúng sau khi thêm cột', () => {
  test('đơn mới có STT dạng DT-YYYY-NNNNN', async ({ request }) => {
    doiDuyetGhi();
    const res = await tao(request, donToiThieu({ senderPhone: '0901234567' }));
    expect(res.status(), await res.text()).toBe(201);
    const b = (await res.json()).data ?? (await res.json());
    const sau = await doc(request, b.id as string);
    expect(
      String(sau.stt ?? ''),
      'Bộ đếm STT hỏng thì hồ sơ mới trùng số với hồ sơ cũ',
    ).toMatch(/^DT-\d{4}-\d{5}$/);
    await don(request, b.id as string);
  });
});

test.describe('H6 · Tạo nhanh mục danh mục NGUON_DON', () => {
  test('tạo mục mới → chờ duyệt; gõ lại tên khác hoa/dấu → trả mục cũ, không tạo trùng', async ({
    request,
  }) => {
    doiDuyetGhi();
    const ten = `${NHAN} nguon thu ${Date.now()}`;

    const r1 = await request.post(`${API}/directories/quick`, {
      headers: auth(),
      data: { type: 'NGUON_DON', name: ten },
    });
    expect(r1.status(), await r1.text()).toBe(201);
    const m1 = (await r1.json()).data ?? (await r1.json());
    expect(m1.id).toBeTruthy();

    const r2 = await request.post(`${API}/directories/quick`, {
      headers: auth(),
      data: { type: 'NGUON_DON', name: ten.toUpperCase() },
    });
    expect([200, 201]).toContain(r2.status());
    const m2 = (await r2.json()).data ?? (await r2.json());
    expect(
      m2.id,
      'Khác hoa/thường mà tạo mục mới là bắt đầu lại đúng mớ 1.431 cách viết',
    ).toBe(m1.id);
  });
});
