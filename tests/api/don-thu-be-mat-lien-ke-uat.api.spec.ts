/**
 * UAT nhóm K/L còn lại — bề mặt LIỀN KỀ, đợt 20/09/2026.
 *
 * Đợt này thêm một cột vào `petitions`, đổi kiểu ô `nguonDon`, và đổi nguồn cán bộ của ba form.
 * Những chức năng dưới đây KHÔNG nằm trong yêu cầu nhưng ĐỌC đúng những thứ ấy — hỏng ở đây là
 * hỏng im lặng, vì không ai nghĩ tới chúng khi rà mã.
 *
 * Oracle: `docs/uat/dot-2009/_domain-pack.md`.
 */
import { test, expect, type APIRequestContext } from '@playwright/test';
import { getAuthToken } from '../helpers/auth';

const API = (process.env.BASE_URL || 'http://171.244.40.245') + '/api/v1';
const CHO_GHI = process.env.UAT_CHO_GHI === '1';
const NHAN = 'UAT-2009-LK';

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
  expect(ds.length, 'danh mục tội danh rỗng').toBeGreaterThan(0);
  maToiDanh = ds[0].id;
  return maToiDanh;
}

async function taoDon(req: APIRequestContext, them: Record<string, unknown> = {}) {
  const r = await req.post(`${API}/petitions`, {
    headers: auth(),
    data: {
      receivedDate: new Date().toISOString().slice(0, 10),
      senderName: `${NHAN} nguoi gui`,
      senderAddress: NHAN,
      summary: `${NHAN} kiem be mat lien ke`,
      crimeChinhId: await layMaToiDanh(req),
      ...them,
    },
  });
  expect(r.status(), await r.text()).toBe(201);
  return ((await r.json()).data as { id: string }).id;
}

async function don(req: APIRequestContext, id: string) {
  await req.delete(`${API}/petitions/${id}`, {
    headers: auth(),
    data: { reason: `${NHAN} dọn sau ca kiểm` },
  });
}

test.describe('K3 · Cán bộ đề xuất của hồ sơ CŨ không bị ghi đè', () => {
  test('sửa một ô khác thì người đề xuất cũ giữ nguyên', async ({ request }) => {
    doiDuyetGhi();
    /*
      Yêu cầu 4 là "tạo mới thì mặc định người đăng nhập". Cái dễ hỏng kèm theo là lượt SỬA:
      nếu mặc định cũng áp lúc sửa thì mở một hồ sơ của đồng nghiệp rồi bấm Lưu là phân công
      lại ngầm — tên người khác in lên Phiếu đề xuất mà không ai bấm gì.
    */
    const r = await request.get(`${API}/admin/users?limit=5&status=active`, { headers: auth() });
    const nguoi = ((await r.json()).data ?? []) as Array<{ id: string }>;
    expect(nguoi.length, 'không có cán bộ nào').toBeGreaterThan(1);
    const nguoiKhac = nguoi[nguoi.length - 1].id;

    const id = await taoDon(request, { canBoDeXuatId: nguoiKhac });
    const up = await request.put(`${API}/petitions/${id}`, {
      headers: auth(),
      data: { notes: `${NHAN} sua o khac ${Date.now()}` },
    });
    expect([200, 201]).toContain(up.status());

    const sau = await request.get(`${API}/petitions/${id}`, { headers: auth() });
    const d = (await sau.json()).data ?? {};
    expect(
      d.canBoDeXuatId,
      'lưu một ô khác mà người đề xuất đổi là PHÂN CÔNG LẠI NGẦM',
    ).toBe(nguoiKhac);

    await don(request, id);
  });
});

test.describe('K8 · Hai phía một quy ước — ghi rồi đọc lại phải khớp', () => {
  for (const edtf of ['2026-12-XX', '2026-XX-XX', '2026-12-15'] as const) {
    test(`ghi ${edtf} rồi đọc lại ra đúng ${edtf}`, async ({ request }) => {
      doiDuyetGhi();
      const id = await taoDon(request, { ngayVietDonEdtf: edtf });
      const r = await request.get(`${API}/petitions/${id}`, { headers: auth() });
      expect((await r.json()).data.ngayVietDonEdtf).toBe(edtf);
      await don(request, id);
    });
  }

  test('xoá trắng ngày thì CẢ HAI cột về rỗng, không sót một cột', async ({ request }) => {
    doiDuyetGhi();
    const id = await taoDon(request, {
      petitionDate: '2026-12-15',
      ngayVietDonEdtf: '2026-12-15',
    });
    const up = await request.put(`${API}/petitions/${id}`, {
      headers: auth(),
      data: { petitionDate: null, ngayVietDonEdtf: null },
    });
    expect([200, 201]).toContain(up.status());

    const r = await request.get(`${API}/petitions/${id}`, { headers: auth() });
    const d = (await r.json()).data ?? {};
    expect(d.petitionDate ?? null).toBeNull();
    expect(
      d.ngayVietDonEdtf ?? null,
      'xoá một cột mà cột kia còn giá trị là hai cột đã trôi khỏi nhau',
    ).toBeNull();
    await don(request, id);
  });
});

test.describe('L3 · Xuất Excel Đơn thư không vỡ vì cột mới', () => {
  test('xuất danh sách trả về tệp, không 500', async ({ request }) => {
    const r = await request.get(`${API}/petitions/export?limit=20`, { headers: auth() });
    expect(
      [200, 201, 400].includes(r.status()),
      `xuất danh sách trả ${r.status()} — 5xx nghĩa là cột mới làm vỡ đường xuất`,
    ).toBe(true);
    if (r.status() === 400) {
      // 400 vì tham số, chấp nhận; 5xx thì không.
      const t = (await r.text()).toLowerCase();
      expect(t).not.toContain('internal server error');
    }
  });
});

test.describe('L5 · Chuyển Đơn thư thành Vụ án mang theo dữ liệu', () => {
  test('đơn có Nguồn đơn và ngày thiếu vẫn chuyển được, không mất dữ liệu', async ({
    request,
  }) => {
    doiDuyetGhi();
    const id = await taoDon(request, {
      nguonDon: 'Bưu điện',
      ngayVietDonEdtf: '2026-12-XX',
    });

    const r = await request.post(`${API}/petitions/${id}/convert-to-case`, {
      headers: auth(),
      data: {},
    });
    /*
      Chuyển đổi có thể bị chặn vì luật nghiệp vụ (thiếu ô bắt buộc của vụ án) — đó là 400 hợp
      lệ. Cái KHÔNG được phép là 5xx: nghĩa là cột mới làm vỡ đường chuyển đổi.
    */
    expect(
      r.status() < 500,
      `chuyển đổi trả ${r.status()} — 5xx nghĩa là cột mới làm vỡ đường này`,
    ).toBe(true);

    // Dù chuyển được hay không, đơn gốc KHÔNG được mất ngày.
    const sau = await request.get(`${API}/petitions/${id}`, { headers: auth() });
    if (sau.status() === 200) {
      const d = (await sau.json()).data ?? {};
      expect(d.ngayVietDonEdtf ?? '').toBe('2026-12-XX');
    }
    await don(request, id);
  });
});

test.describe('L7 · Mục danh mục tạo nhanh ở trạng thái CHỜ DUYỆT', () => {
  test('mục mới mang cờ chờ duyệt, không nhận thẳng vào danh mục sạch', async ({ request }) => {
    doiDuyetGhi();
    const ten = `${NHAN} nguon cho duyet ${Date.now()}`;
    const r = await request.post(`${API}/directories/quick`, {
      headers: auth(),
      data: { type: 'NGUON_DON', name: ten },
    });
    expect(r.status(), await r.text()).toBe(201);
    // Hình phản hồi của điểm cuối này trả mục ở CẤP TRÊN CÙNG, không bọc trong `.data` —
    // đỡ cả hai để ca kiểm không đỏ vì hình bọc thay vì vì mệnh đề.
    const b = await r.json();
    const d = (b.data ?? b) as Record<string, unknown>;
    expect(
      ((d.metadata ?? {}) as Record<string, unknown>).choDuyet,
      'nhận thẳng mục cán bộ vừa gõ là đổ rác vào ô chọn của mọi người',
    ).toBe(true);
  });

  test('mục tên "Trực tiếp" TỰ mang cờ laTrucTiep, không ai phải nhớ gắn', async ({
    request,
  }) => {
    const r = await request.get(`${API}/directories?type=NGUON_DON&limit=100`, {
      headers: auth(),
    });
    expect(r.status(), await r.text()).toBe(200);
    const ds = ((await r.json()).data ?? []) as Array<{
      name: string;
      metadata?: Record<string, unknown>;
    }>;
    const tt = ds.find((x) => x.name.trim().toLowerCase() === 'trực tiếp');
    expect(tt, 'chưa có mục "Trực tiếp" trong danh mục — mệnh đề CHƯA kiểm được').toBeTruthy();
    expect(
      (tt!.metadata ?? {}).laTrucTiep,
      'thiếu cờ thì nhóm định danh không bao giờ tự bung',
    ).toBe(true);
  });
});

test.describe('K5 · Quyền — OFFICER dùng được ô chọn và danh mục', () => {
  test('điểm cuối danh mục và danh sách cán bộ đòi đăng nhập', async ({ request }) => {
    // Không token → 401. Rò danh sách 245 cán bộ ra ngoài là lỗi bảo mật.
    const a = await request.get(`${API}/admin/users?limit=1`);
    expect([401, 403]).toContain(a.status());
    const b = await request.get(`${API}/directories?type=NGUON_DON&limit=1`);
    expect([401, 403]).toContain(b.status());
  });
});
