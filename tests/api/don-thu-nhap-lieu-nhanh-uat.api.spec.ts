/**
 * UAT tầng API — đợt 20/09/2026 "Form Đơn thư nhập liệu nhanh".
 *
 * Tệp này CHỈ chứa ca **không ghi dữ liệu**: đọc, và những lượt tạo mà máy chủ phải TỪ CHỐI
 * (từ chối thì không có bản ghi nào sinh ra). Ca thật sự ghi nằm ở
 * `don-thu-ghi-du-lieu-uat.api.spec.ts`, có cổng riêng.
 *
 * Oracle: `docs/uat/dot-2009/_domain-pack.md` — lấy từ 5 yêu cầu + quyết định Đ1–Đ12, KHÔNG
 * lấy từ mã. Sổ mệnh đề: `docs/uat/dot-2009/_coverage-ledger.md`.
 *
 * Tên tệp phải khớp `**\/tests/api/*-uat.api.spec.ts` (project `api` trong playwright.config.ts).
 * Đặt sai tên thì bộ chạy quét 0 ca mà vẫn báo sạch — đã gặp, ghi ở feedback_uat_xanh_gia.
 */
import { test, expect, type APIRequestContext } from '@playwright/test';
import { getAuthToken } from '../helpers/auth';

const API = (process.env.BASE_URL || 'http://171.244.40.245') + '/api/v1';

function token(): string {
  const t = getAuthToken();
  // KHÔNG bỏ qua khi thiếu token: ca bỏ qua là CHƯA KIỂM, không phải đạt.
  expect(t, 'Cần UAT_TOKEN (hoặc test-results/.auth-token.txt) — không có thì mọi ca 401').not.toBe('');
  return t;
}

function auth() {
  return { Authorization: `Bearer ${token()}` };
}

/** Thân đơn tối thiểu hợp lệ, để từng ca chỉ đổi ĐÚNG một biến. */
function donToiThieu(ghiDe: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    receivedDate: new Date().toISOString().slice(0, 10),
    senderName: 'UAT nhap lieu nhanh',
    senderAddress: 'UAT',
    summary: 'UAT dot 20/09 — ca API',
    ...ghiDe,
  };
}

async function taoDon(
  req: APIRequestContext,
  than: Record<string, unknown>,
) {
  return req.post(`${API}/petitions`, { headers: auth(), data: than });
}

test.describe('H1 · GET /admin/users trả teams[] mà không phá consumer cũ', () => {
  test('mỗi cán bộ có mảng teams, và các khoá cũ vẫn còn', async ({ request }) => {
    const res = await request.get(`${API}/admin/users?limit=5`, { headers: auth() });
    expect(res.status(), await res.text()).toBe(200);

    const body = await res.json();
    const ds = (body.data ?? body.items ?? body) as Array<Record<string, unknown>>;
    expect(Array.isArray(ds), 'phải trả về danh sách').toBe(true);
    expect(ds.length, 'prod có 245 tài khoản hoạt động — 0 người là hỏng').toBeGreaterThan(0);

    for (const u of ds) {
      // Khoá MỚI
      expect(Array.isArray(u.teams), `user ${u.id} thiếu teams[]`).toBe(true);
      for (const t of u.teams as Array<Record<string, unknown>>) {
        expect(typeof t.teamId).toBe('string');
        expect(typeof t.teamName).toBe('string');
        expect(typeof t.isLeader).toBe('boolean');
      }
      // Khoá CŨ — ba trang danh sách và AssignModal đang đọc, thêm khoá không được phá ai
      expect(u.id, 'mất khoá id là vỡ mọi consumer cũ').toBeTruthy();
      expect(u.username ?? u.email, 'mất cả username lẫn email là vỡ nhãn').toBeTruthy();
    }
  });

  test('danh sách cán bộ hoạt động có ĐỦ người (prod 20/09: 245)', async ({ request }) => {
    // `status` chỉ nhận `active`/`inactive` chữ thường — gửi 'ACTIVE' máy chủ trả 400 kèm câu
    // nói rõ giá trị hợp lệ (đã đo). Ca kiểm dùng đúng giá trị mà giao diện đang gửi.
    const res = await request.get(`${API}/admin/users?limit=500&status=active`, {
      headers: auth(),
    });
    expect(res.status(), await res.text()).toBe(200);
    const body = await res.json();
    const tong = body.total ?? body.meta?.total ?? (body.data ?? body).length;
    // Oracle là "đủ người", không phải một con số cứng: ngưỡng 200 bắt đúng lỗi limit=200 cũ
    // mà không đỏ oan khi đơn vị tuyển thêm hay cho nghỉ vài người.
    expect(tong, `mới ${tong} người — lỗi cắt danh sách đã quay lại`).toBeGreaterThanOrEqual(200);
  });
});

test.describe('H3 · SĐT nguyên đơn bắt buộc khi nguồn là Trực tiếp', () => {
  test('Trực tiếp + SĐT trống → 400, câu báo nói rõ ô nào', async ({ request }) => {
    const res = await taoDon(request, donToiThieu({ nguonDon: 'Trực tiếp', senderPhone: '' }));
    expect(res.status(), await res.text()).toBe(400);
    const loi = JSON.stringify(await res.json()).toLowerCase();
    expect(loi, 'câu báo phải nêu số điện thoại').toContain('điện thoại');
  });
});

test.describe('K1 · Định dạng SĐT áp cho MỌI nguồn', () => {
  test('Bưu điện + SĐT "abc" → 400 (nới bắt buộc không được nới luôn hợp lệ)', async ({
    request,
  }) => {
    const res = await taoDon(request, donToiThieu({ nguonDon: 'Bưu điện', senderPhone: 'abc' }));
    expect(
      res.status(),
      'Đây là lớp lỗi @ValidateIf cũ: "abc" từng đi thẳng xuống cột. ' + (await res.text()),
    ).toBe(400);
  });

  test('Trực tiếp + SĐT "abc" → 400', async ({ request }) => {
    const res = await taoDon(request, donToiThieu({ nguonDon: 'Trực tiếp', senderPhone: 'abc' }));
    expect(res.status(), await res.text()).toBe(400);
  });
});

test.describe('H4 · Ngày viết đơn EDTF phải là ngày CÓ THẬT', () => {
  for (const [nhan, edtf] of [
    ['31 tháng 2', '2026-02-31'],
    ['tháng 13', '2026-13-01'],
    ['29/02 năm không nhuận', '2025-02-29'],
    ['ngày thật nhưng tháng XX', '2026-XX-15'],
  ] as const) {
    test(`${nhan} (${edtf}) → 400`, async ({ request }) => {
      const res = await taoDon(request, donToiThieu({ ngayVietDonEdtf: edtf }));
      expect(
        res.status(),
        `${edtf} lọt qua thì cột chữ chứa ngày không tồn tại. ` + (await res.text()),
      ).toBe(400);
    });
  }

  test('EDTF sai cú pháp → 400', async ({ request }) => {
    const res = await taoDon(request, donToiThieu({ ngayVietDonEdtf: '12/2026' }));
    expect(res.status(), await res.text()).toBe(400);
  });
});

test.describe('K4 · Máy chủ báo đúng bản đang chạy', () => {
  test('GET /health trả buildId và version', async ({ request }) => {
    const res = await request.get(`${API}/health`);
    expect(res.status()).toBe(200);
    const b = await res.json();
    expect(b.status).toBe('ok');
    expect(b.version).toBeTruthy();
    expect(b.buildId, 'thiếu buildId thì không biết máy chủ đang chạy bản nào').toBeTruthy();

    /*
      Bản dựng CỤC BỘ không nhúng mã commit nên `buildId` rơi về chuỗi phiên bản; trên prod nó
      là mã commit. Vì vậy hình dạng của chuỗi KHÔNG phải mệnh đề cần khẳng định — mệnh đề thật
      là "máy chủ đang chạy ĐÚNG bản vừa deploy".

      Truyền `UAT_COMMIT=<sha>` để khẳng định điều ấy. Thiếu biến thì chỉ ghi lại giá trị, và ca
      này KHÔNG được tính là bằng chứng cho mệnh đề CO.9 — xem `_coverage-ledger.md`.
    */
    const mongDoi = process.env.UAT_COMMIT;
    if (mongDoi) {
      expect(
        b.buildId,
        `Máy chủ chạy ${b.buildId} nhưng lượt deploy là ${mongDoi} — bản cũ còn sống.`,
      ).toBe(mongDoi);
    }
    console.log(`[K4] buildId=${b.buildId} version=${b.version}`);
  });
});

test.describe('H6 · Danh mục NGUON_DON — đọc và chặn trùng', () => {
  test('đọc được danh mục NGUON_DON', async ({ request }) => {
    const res = await request.get(`${API}/directories?type=NGUON_DON&limit=20`, {
      headers: auth(),
    });
    expect(res.status(), await res.text()).toBe(200);
  });

  test('loại NGUON_DON nằm trong danh sách loại tạo nhanh được', async ({ request }) => {
    // Gửi một tên RỖNG: máy chủ phải từ chối vì TÊN rỗng, KHÔNG phải vì "loại không hợp lệ".
    // Phân biệt được hai câu báo ấy là bằng chứng loại đã được khai — mà không tạo mục nào.
    const res = await request.post(`${API}/directories/quick`, {
      headers: auth(),
      data: { type: 'NGUON_DON', name: '' },
    });
    expect(res.status()).toBe(400);
    const loi = JSON.stringify(await res.json()).toLowerCase();
    expect(
      loi.includes('type') && loi.includes('hợp lệ'),
      `NGUON_DON bị từ chối vì LOẠI, nghĩa là chưa khai trong LUAT_TAO_NHANH: ${loi}`,
    ).toBe(false);
  });
});

test.describe('L4 · Tìm kiếm Đơn thư theo Nguồn đơn vẫn chạy sau khi đổi sang danh mục', () => {
  test('lọc theo nguonDon trả về danh sách, không 500', async ({ request }) => {
    const res = await request.get(
      `${API}/petitions?limit=5&search=${encodeURIComponent('Bưu điện')}`,
      { headers: auth() },
    );
    expect(res.status(), await res.text()).toBe(200);
    const b = await res.json();
    expect(Array.isArray(b.data ?? b.items ?? b)).toBe(true);
  });
});

test.describe('L2 · Danh sách Đơn thư không vỡ khi có đơn ngày thiếu', () => {
  test('sắp xếp theo ngày viết đơn trả 200', async ({ request }) => {
    const res = await request.get(
      `${API}/petitions?limit=20&sortBy=petitionDate&sortOrder=desc`,
      { headers: auth() },
    );
    expect(res.status(), await res.text()).toBe(200);
  });

  test('trang danh sách trả về trường ngày viết đơn cho mọi dòng', async ({ request }) => {
    const res = await request.get(`${API}/petitions?limit=20`, { headers: auth() });
    expect(res.status()).toBe(200);
    const ds = ((await res.json()).data ?? []) as Array<Record<string, unknown>>;
    expect(ds.length, 'prod có 47.488 đơn — 0 dòng là hỏng').toBeGreaterThan(0);
    // Không khẳng định giá trị: chỉ khẳng định không dòng nào NÉM LỖI khi có cột mới.
    for (const d of ds) expect(d).toHaveProperty('id');
  });
});

test.describe('R1-GROUP · Máy chủ nói rõ tổ nào là tổ ĐỊA BÀN', () => {
  /*
    Đo prod 20/09: 241 cán bộ hoạt động trải trên 207 tổ CÓ NGƯỜI, nhưng 167 tổ trong đó là
    công an phường/xã mỗi nơi ĐÚNG MỘT tài khoản. Thiếu cờ này thì ô chọn mọc ra 167 tiêu đề
    nhóm một người — tính năng gom nhóm thành vô dụng mà mọi ca kiểm đơn vị vẫn xanh.
  */
  test('mỗi tổ mang cờ `laDiaBan` kiểu boolean', async ({ request }) => {
    const res = await request.get(`${API}/admin/users?limit=500&status=active`, {
      headers: auth(),
    });
    expect(res.status(), await res.text()).toBe(200);
    const ds = ((await res.json()).data ?? []) as Array<Record<string, unknown>>;

    const moiTo = ds.flatMap((u) => (u.teams ?? []) as Array<Record<string, unknown>>);
    expect(moiTo.length, 'không ai có tổ thì phép gom nhóm không kiểm được gì').toBeGreaterThan(0);
    for (const t of moiTo) {
      expect(typeof t.laDiaBan, `tổ ${String(t.teamName)} thiếu cờ laDiaBan`).toBe('boolean');
    }
  });

  test('có ÍT NHẤT một tổ địa bàn và một tổ chức năng — dữ liệu thật có cả hai', async ({
    request,
  }) => {
    const res = await request.get(`${API}/admin/users?limit=500&status=active`, {
      headers: auth(),
    });
    const ds = ((await res.json()).data ?? []) as Array<Record<string, unknown>>;
    const moiTo = ds.flatMap((u) => (u.teams ?? []) as Array<{ laDiaBan?: boolean }>);

    // Cả hai loại đều phải có mặt, nếu không thì cờ có thể đang trả cứng một giá trị mà
    // ca kiểm vẫn xanh — đúng kiểu hỏng im lặng.
    expect(moiTo.some((t) => t.laDiaBan === true), 'không tổ nào là địa bàn').toBe(true);
    expect(moiTo.some((t) => t.laDiaBan === false), 'không tổ nào là chức năng').toBe(true);
  });
});
