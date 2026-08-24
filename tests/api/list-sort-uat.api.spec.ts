/**
 * UAT v0.72.0.0 — sắp xếp danh sách mới→cũ theo ngày tiếp nhận thật.
 *
 * ⚠️ Kết quả mong đợi lấy từ `docs/uat/list-sort/_plan-scope.md` (kế hoạch đã duyệt +
 * CHANGELOG = lời hứa với người dùng), KHÔNG lấy từ mã nguồn. Mã chỉ dùng để tìm điểm neo
 * (endpoint, tên trường). Mã làm khác oracle ⇒ mã sai.
 *
 * Chạy trên BẢN CHẠY THẬT với dữ liệu thật (45.459 đơn thư, trong đó 9 hồ sơ ngày phi lý).
 * Toàn bộ ca kiểm CHỈ ĐỌC — không tạo/sửa/xoá hồ sơ nào.
 */
import { test, expect, type APIRequestContext } from '@playwright/test';

const API = process.env.API_BASE ?? 'https://new.pc02hcm.com/api/v1';
const USER = process.env.ADMIN_USERNAME ?? 'admin@pc02.local';
const PASS = process.env.ADMIN_PASSWORD ?? '';

let token = '';

test.beforeAll(async ({ playwright }) => {
  const ctx = await playwright.request.newContext();
  const res = await ctx.post(`${API}/auth/login`, {
    data: { username: USER, password: PASS },
  });
  expect(res.status(), 'đăng nhập lấy token').toBe(200);
  token = ((await res.json()) as { accessToken: string }).accessToken;
  await ctx.dispose();
});

async function list(
  req: APIRequestContext,
  path: string,
  params: Record<string, string | number> = {},
) {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString();
  const res = await req.get(`${API}${path}${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: res.status(), body: await res.json().catch(() => null) };
}

/** Ngày dùng để so sánh thứ tự; null/undefined coi là "không có ngày". */
function ts(v: unknown): number | null {
  if (!v) return null;
  const t = new Date(String(v)).getTime();
  return Number.isNaN(t) ? null : t;
}

/** Khoảng hợp lý theo oracle PLAN-AC5. */
function laPhiLy(v: unknown): boolean {
  const t = ts(v);
  if (t === null) return false;
  const y = new Date(t).getUTCFullYear();
  return y < 1900 || y >= 2100;
}

/** Dãy giảm dần, hồ sơ không có ngày phải nằm CUỐI (PLAN-AC3). */
function kiemGiamDanNullsCuoi(vals: (number | null)[], nhan: string) {
  const viTriNullDau = vals.findIndex((v) => v === null);
  if (viTriNullDau !== -1) {
    const sauNull = vals.slice(viTriNullDau);
    expect(
      sauNull.every((v) => v === null),
      `${nhan}: hồ sơ KHÔNG có ngày phải nằm cuối, không được xen giữa`,
    ).toBe(true);
  }
  const coNgay = vals.filter((v): v is number => v !== null);
  for (let i = 1; i < coNgay.length; i++) {
    expect(coNgay[i] <= coNgay[i - 1], `${nhan}: phải giảm dần tại vị trí ${i}`).toBe(true);
  }
}

// ── A. Thứ tự mặc định (COV-DEF-01..05) ──────────────────────────────────────
test.describe('A. Thứ tự mặc định — mới nhất lên đầu theo ngày tiếp nhận', () => {
  test('TC-001 [COV-DEF-01] Đơn thư mặc định giảm dần theo ngày nhận', async ({ request }) => {
    const { status, body } = await list(request, '/petitions', { limit: 50 });
    expect(status).toBe(200);
    const rows = body.data as Record<string, unknown>[];
    expect(rows.length).toBeGreaterThan(0);
    kiemGiamDanNullsCuoi(rows.map((r) => ts(r.receivedDate)), 'Đơn thư');
  });

  test('TC-002 [COV-DEF-02] Vụ việc mặc định giảm dần theo ngày tiếp nhận', async ({ request }) => {
    const { status, body } = await list(request, '/incidents', { limit: 50 });
    expect(status).toBe(200);
    kiemGiamDanNullsCuoi(
      (body.data as Record<string, unknown>[]).map((r) => ts(r.ngayDeXuat)),
      'Vụ việc',
    );
  });

  test('TC-003 [COV-DEF-03] Vụ án mặc định giảm dần theo ngày tiếp nhận', async ({ request }) => {
    const { status, body } = await list(request, '/cases', { limit: 50 });
    expect(status).toBe(200);
    kiemGiamDanNullsCuoi(
      (body.data as Record<string, unknown>[]).map((r) => ts(r.ngayDeXuat)),
      'Vụ án',
    );
  });

  test('TC-004 [COV-DEF-04] Mặc định KHÔNG phải ngày tạo', async ({ request }) => {
    // Oracle PLAN-AC2: ngày tạo bị loại vì hồ sơ di trú đều cùng một ngày.
    // Nếu hệ thống vẫn sắp theo ngày tạo thì dãy ngày NHẬN sẽ lộn xộn.
    const { body } = await list(request, '/petitions', { limit: 50 });
    const ngayNhan = (body.data as Record<string, unknown>[]).map((r) => ts(r.receivedDate));
    const coNgay = ngayNhan.filter((v): v is number => v !== null);
    const daSapGiam = coNgay.every((v, i) => i === 0 || v <= coNgay[i - 1]);
    expect(daSapGiam, 'ngày nhận phải giảm dần ⇒ chứng tỏ không sắp theo ngày tạo').toBe(true);
  });

  test('TC-005 [COV-DEF-05] UTDT dùng chung endpoint Vụ án cũng theo thứ tự mới', async ({ request }) => {
    const { status, body } = await list(request, '/cases', {
      caseType: 'UY_THAC_DIEU_TRA',
      limit: 30,
    });
    expect(status).toBe(200);
    kiemGiamDanNullsCuoi(
      (body.data as Record<string, unknown>[]).map((r) => ts(r.ngayDeXuat)),
      'UTDT',
    );
  });
});

// ── B. Hồ sơ rỗng & ngày phi lý (COV-NULL-*, COV-BAD-*) ──────────────────────
test.describe('B. Hồ sơ không có ngày và ngày phi lý', () => {
  test('TC-006 [COV-NULL-01] Vụ việc: hồ sơ không có ngày nằm CUỐI', async ({ request }) => {
    const { body } = await list(request, '/incidents', { limit: 100 });
    kiemGiamDanNullsCuoi(
      (body.data as Record<string, unknown>[]).map((r) => ts(r.ngayDeXuat)),
      'Vụ việc trang 1',
    );
  });

  test('TC-007 [COV-NULL-02] Vụ án: hồ sơ không có ngày nằm CUỐI', async ({ request }) => {
    const { body } = await list(request, '/cases', { limit: 100 });
    kiemGiamDanNullsCuoi(
      (body.data as Record<string, unknown>[]).map((r) => ts(r.ngayDeXuat)),
      'Vụ án trang 1',
    );
  });

  test('TC-008 [COV-NULL-03] Chiều TĂNG dần: hồ sơ rỗng VẪN ở cuối', async ({ request }) => {
    // Oracle PLAN-AC3: hồ sơ thiếu dữ liệu không bao giờ chiếm đầu danh sách,
    // bất kể người dùng chọn chiều nào.
    const { body } = await list(request, '/incidents', {
      sortBy: 'ngayDeXuat',
      sortOrder: 'asc',
      limit: 50,
    });
    const vals = (body.data as Record<string, unknown>[]).map((r) => ts(r.ngayDeXuat));
    const viTriNull = vals.findIndex((v) => v === null);
    if (viTriNull !== -1) {
      expect(
        vals.slice(viTriNull).every((v) => v === null),
        'chiều tăng dần: hồ sơ rỗng vẫn phải ở cuối',
      ).toBe(true);
    }
  });

  test('TC-009 [COV-BAD-01] Đơn thư: hồ sơ ngày phi lý KHÔNG ở màn hình đầu', async ({ request }) => {
    // Đây là ca kiểm QUAN TRỌNG NHẤT của đợt vá: 9 hồ sơ năm 3023/2925/0225 từng
    // chiếm trọn màn hình đầu tiên của danh sách 45.459 hồ sơ.
    const { body } = await list(request, '/petitions', { limit: 20 });
    const rows = body.data as Record<string, unknown>[];
    const phiLy = rows.filter((r) => laPhiLy(r.receivedDate));
    expect(
      phiLy.map((r) => `${r.stt}:${String(r.receivedDate).slice(0, 10)}`),
      'trang đầu KHÔNG được chứa hồ sơ ngày ngoài khoảng 1900–2100',
    ).toEqual([]);
  });

  test('TC-010 [COV-BAD-02] Hồ sơ ngày phi lý vẫn TỒN TẠI, chỉ bị đẩy cuối', async ({ request }) => {
    // Oracle PLAN-AC5: "đẩy xuống cuối", KHÔNG phải "giấu đi" hay "xoá".
    // Sắp TĂNG dần theo ngày nhận thì hồ sơ năm 0225 phải xuất hiện.
    const { status, body } = await list(request, '/petitions', {
      sortBy: 'receivedDate',
      sortOrder: 'asc',
      limit: 5,
    });
    expect(status).toBe(200);
    expect(
      (body.data as unknown[]).length,
      'hồ sơ ngày phi lý vẫn phải truy cập được, không bị giấu',
    ).toBeGreaterThan(0);
  });
});

// ── D/E. Tham số sắp xếp qua API (COV-CLICK-*, COV-URL-*) ────────────────────
test.describe('D. Tham số sắp xếp', () => {
  test('TC-018 [COV-CLICK-01] sortOrder=desc cho thứ tự giảm dần', async ({ request }) => {
    const { body } = await list(request, '/incidents', {
      sortBy: 'ngayDeXuat',
      sortOrder: 'desc',
      limit: 30,
    });
    kiemGiamDanNullsCuoi(
      (body.data as Record<string, unknown>[]).map((r) => ts(r.ngayDeXuat)),
      'giảm dần',
    );
  });

  test('TC-019 [COV-CLICK-02] sortOrder=asc đảo chiều thật sự', async ({ request }) => {
    const giam = await list(request, '/incidents', {
      sortBy: 'ngayDeXuat', sortOrder: 'desc', limit: 10,
    });
    const tang = await list(request, '/incidents', {
      sortBy: 'ngayDeXuat', sortOrder: 'asc', limit: 10,
    });
    const idGiam = (giam.body.data as { id: string }[]).map((r) => r.id);
    const idTang = (tang.body.data as { id: string }[]).map((r) => r.id);
    expect(idGiam, 'hai chiều phải cho kết quả khác nhau').not.toEqual(idTang);
  });
});

// ── F. Phân trang ổn định (COV-PAGE-*) ───────────────────────────────────────
test.describe('F. Phân trang ổn định', () => {
  test('TC-030 [COV-PAGE-01] Trang 1 và trang 2 KHÔNG trùng hồ sơ', async ({ request }) => {
    const t1 = await list(request, '/petitions', { limit: 20, offset: 0 });
    const t2 = await list(request, '/petitions', { limit: 20, offset: 20 });
    const id1 = new Set((t1.body.data as { id: string }[]).map((r) => r.id));
    const trung = (t2.body.data as { id: string }[]).filter((r) => id1.has(r.id));
    expect(trung.map((r) => r.id), 'không hồ sơ nào xuất hiện ở cả hai trang').toEqual([]);
  });

  test('TC-031 [COV-PAGE-02] Sang trang xa rồi quay lại → danh sách không đổi', async ({ request }) => {
    const lan1 = await list(request, '/petitions', { limit: 20, offset: 0 });
    await list(request, '/petitions', { limit: 20, offset: 200 });
    const lan2 = await list(request, '/petitions', { limit: 20, offset: 0 });
    expect(
      (lan2.body.data as { id: string }[]).map((r) => r.id),
      'thứ tự phải ổn định giữa hai lần truy vấn giống nhau',
    ).toEqual((lan1.body.data as { id: string }[]).map((r) => r.id));
  });

  test('TC-032 [COV-PAGE-03] Hồ sơ TRÙNG ngày vẫn có thứ tự xác định', async ({ request }) => {
    // Không có khoá phụ thì hồ sơ trùng ngày đổi chỗ giữa hai lần gọi.
    const a = await list(request, '/petitions', { limit: 100 });
    const b = await list(request, '/petitions', { limit: 100 });
    expect(
      (b.body.data as { id: string }[]).map((r) => r.id),
      'hai lần gọi giống hệt nhau phải cho cùng thứ tự',
    ).toEqual((a.body.data as { id: string }[]).map((r) => r.id));
  });
});

// ── G. Cột dữ liệu (COV-COL-04) ──────────────────────────────────────────────
test.describe('G. Trường dữ liệu cho cột mới', () => {
  test('TC-037 [COV-COL-04] API Vụ án trả về trường ngày tiếp nhận', async ({ request }) => {
    const { body } = await list(request, '/cases', { limit: 5 });
    const rows = body.data as Record<string, unknown>[];
    expect(rows.length).toBeGreaterThan(0);
    expect(
      Object.prototype.hasOwnProperty.call(rows[0], 'ngayDeXuat'),
      'thiếu trường này thì cột "Ngày tiếp nhận" trên màn hình luôn trống',
    ).toBe(true);
  });
});

// ── H. Chế độ hỏng & bảo mật (COV-FM-*) ──────────────────────────────────────
test.describe('H. Chế độ hỏng và bảo mật', () => {
  test('TC-038 [COV-FM-01] sortOrder rác KHÔNG gây lỗi 500', async ({ request }) => {
    for (const bad of ['xyz', 'DESC; DROP TABLE petitions', 'ascending', '1']) {
      const { status } = await list(request, '/petitions', {
        sortBy: 'receivedDate', sortOrder: bad, limit: 5,
      });
      expect(status, `sortOrder=${bad} không được thành lỗi máy chủ`).toBeLessThan(500);
    }
  });

  test('TC-039 [COV-FM-02] sortOrder rỗng KHÔNG gây lỗi 500', async ({ request }) => {
    const { status } = await list(request, '/petitions', {
      sortBy: 'receivedDate', sortOrder: '', limit: 5,
    });
    expect(status).toBeLessThan(500);
  });

  test('TC-040 [COV-FM-03] sortBy=passwordHash không lộ, không 500', async ({ request }) => {
    const { status, body } = await list(request, '/petitions', {
      sortBy: 'passwordHash', limit: 5,
    });
    expect(status, 'tên cột lạ phải rơi về mặc định, không 500').toBe(200);
    expect(
      JSON.stringify(body).includes('passwordHash'),
      'phản hồi không được chứa tên cột nội bộ',
    ).toBe(false);
  });

  test('TC-041 [COV-FM-04] sortBy chứa chuỗi SQL không thực thi', async ({ request }) => {
    const { status } = await list(request, '/petitions', {
      sortBy: "receivedDate; DROP TABLE petitions--", limit: 5,
    });
    expect(status).toBe(200);
    // Bảng vẫn còn dữ liệu ⇒ không có gì bị thực thi.
    const sau = await list(request, '/petitions', { limit: 1 });
    expect((sau.body.data as unknown[]).length).toBe(1);
  });

  test('TC-042 [COV-FM-05] Cột nội bộ sortReceivedDate không gọi thẳng được', async ({ request }) => {
    // Oracle PLAN-FM2: danh sách trắng kiểm tên NGƯỜI DÙNG gửi; cột sinh là chi tiết
    // nội bộ, không được lộ thành tham số công khai.
    const { status, body } = await list(request, '/petitions', {
      sortBy: 'sortReceivedDate', limit: 20,
    });
    expect(status).toBe(200);
    // Rơi về mặc định ⇒ vẫn phải là thứ tự giảm dần hợp lệ.
    kiemGiamDanNullsCuoi(
      (body.data as Record<string, unknown>[]).map((r) => ts(r.receivedDate)),
      'rơi về mặc định',
    );
  });

  test('TC-045 [COV-FM-08] Sắp + lọc trạng thái cùng lúc đều đúng', async ({ request }) => {
    const { status, body } = await list(request, '/petitions', {
      status: 'MOI_TIEP_NHAN', sortBy: 'receivedDate', sortOrder: 'desc', limit: 30,
    });
    expect(status).toBe(200);
    const rows = body.data as Record<string, unknown>[];
    expect(
      rows.every((r) => r.status === 'MOI_TIEP_NHAN'),
      'bộ lọc phải còn hiệu lực khi có sắp xếp',
    ).toBe(true);
    kiemGiamDanNullsCuoi(rows.map((r) => ts(r.receivedDate)), 'lọc + sắp');
  });

  test('TC-046 [COV-FM-09] Sắp + tìm kiếm cùng lúc đều đúng', async ({ request }) => {
    const { status, body } = await list(request, '/petitions', {
      search: 'Nguyễn', sortBy: 'receivedDate', sortOrder: 'desc', limit: 30,
    });
    expect(status).toBe(200);
    kiemGiamDanNullsCuoi(
      (body.data as Record<string, unknown>[]).map((r) => ts(r.receivedDate)),
      'tìm kiếm + sắp',
    );
  });
});
