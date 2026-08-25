/**
 * UAT v0.73.0.0 — ba trang danh sách theo bố cục hệ cũ.
 *
 * ⚠️ Kết quả mong đợi lấy từ KẾ HOẠCH ĐÃ DUYỆT và các quyết định anh chốt qua
 * AskUserQuestion, KHÔNG lấy từ mã nguồn. Mã chỉ dùng để tìm điểm neo (endpoint, tên
 * trường). Mã làm khác oracle ⇒ mã sai.
 *
 * Oracle (spec `~/.claude/plans/gleaming-pondering-thacker.md`):
 *   AC-1  Danh sách trả về Tóm tắt nội dung — cột hệ cũ có mà hệ mới thiếu
 *   AC-2  Trả về Nguồn đơn, Kết quả xử lý, Người nhập
 *   AC-3  Lọc theo mã hồ sơ nhận CẢ HAI dạng (`26-…` và `2026-…`) ra cùng hồ sơ
 *   AC-4  Lọc theo STT cũ
 *   AC-5  Lọc theo Cán bộ nhập
 *   AC-6  Lọc rỗng KHÔNG được thu hẹp kết quả
 *   AC-7  Dropdown Cán bộ nhập lấy được danh sách với quyền OFFICER (không chỉ ADMIN)
 *
 * Chạy trên BẢN CHẠY THẬT với dữ liệu thật. Toàn bộ CHỈ ĐỌC — không tạo/sửa/xoá hồ sơ nào.
 */
import { test, expect, type APIRequestContext } from '@playwright/test';

const API = process.env.API_BASE ?? 'https://new.pc02hcm.com/api/v1';
const USER = process.env.ADMIN_USERNAME ?? 'admin@pc02.local';
const PASS = process.env.ADMIN_PASSWORD ?? '';

let token = '';

test.beforeAll(async ({ playwright }) => {
  const ctx = await playwright.request.newContext();
  const res = await ctx.post(`${API}/auth/login`, { data: { username: USER, password: PASS } });
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

interface Hang {
  id: string;
  [k: string]: unknown;
}

function rows(body: unknown): Hang[] {
  const b = body as { data?: unknown };
  return Array.isArray(b?.data) ? (b.data as Hang[]) : [];
}

function tong(body: unknown): number {
  return (body as { total?: number })?.total ?? 0;
}

/** Ba màn hình dùng chung một khuôn kiểm — khai một chỗ để không sót màn nào. */
const MAN_HINH = [
  { ten: 'Đơn thư', path: '/petitions', cotMa: 'stt', cotTomTat: 'summary', canBo: 'enteredById' },
  { ten: 'Vụ việc', path: '/incidents', cotMa: 'code', cotTomTat: 'description', canBo: 'canBoNhapId' },
  { ten: 'Vụ án', path: '/cases', cotMa: 'caseCode', cotTomTat: 'moTaChiTiet', canBo: 'createdById' },
] as const;

test.describe('U-01/13/17 — danh sách trả về cột hệ cũ', () => {
  for (const m of MAN_HINH) {
    test(`${m.ten}: trả về Tóm tắt nội dung (AC-1)`, async ({ request }) => {
      const r = await list(request, m.path, { limit: 20 });
      expect(r.status).toBe(200);
      const ds = rows(r.body);
      expect(ds.length, 'phải có hồ sơ để kiểm').toBeGreaterThan(0);

      // Cột phủ 98–99,99% trên dữ liệu thật; thiếu nó thì cán bộ phải mở từng hồ sơ.
      const coTomTat = ds.filter((x) => {
        const v = x[m.cotTomTat];
        return typeof v === 'string' && v.trim() !== '';
      });
      expect(
        coTomTat.length,
        `${m.ten}: trong 20 hồ sơ đầu phải có ít nhất một hồ sơ mang "${m.cotTomTat}"`,
      ).toBeGreaterThan(0);
    });
  }

  test('Đơn thư: trả về Nguồn đơn và Người nhập (AC-2)', async ({ request }) => {
    const r = await list(request, '/petitions', { limit: 20 });
    const ds = rows(r.body);
    expect(ds.some((x) => typeof x.nguonDon === 'string' && x.nguonDon !== '')).toBe(true);
    expect(ds.some((x) => x.enteredBy != null)).toBe(true);
  });
});

test.describe('U-05/15/19 — lọc theo mã hồ sơ nhận cả hai dạng', () => {
  for (const m of MAN_HINH) {
    test(`${m.ten}: gõ dạng ngắn và dạng đầy đủ ra CÙNG hồ sơ (AC-3)`, async ({ request }) => {
      // Lấy một mã thật từ chính danh sách thay vì bịa — dữ liệu thay đổi theo ngày.
      const dau = await list(request, m.path, { limit: 50 });
      const maDayDu = rows(dau.body)
        .map((x) => x[m.cotMa])
        .find((v): v is string => typeof v === 'string' && /^\d{4}-\d+$/.test(v));

      test.skip(!maDayDu, `${m.ten}: không tìm thấy mã dạng năm-stt trong 50 hồ sơ đầu`);
      const maNgan = `${maDayDu!.slice(2)}`;

      const theoDayDu = await list(request, m.path, { stt: maDayDu!, limit: 5 });
      const theoNgan = await list(request, m.path, { stt: maNgan, limit: 5 });

      expect(theoDayDu.status).toBe(200);
      expect(theoNgan.status).toBe(200);
      expect(tong(theoDayDu.body), `${m.ten}: lọc dạng đầy đủ phải ra hồ sơ`).toBeGreaterThan(0);
      expect(
        tong(theoNgan.body),
        `${m.ten}: gõ "${maNgan}" (dạng hệ cũ hiển thị) phải ra cùng số hồ sơ`,
      ).toBe(tong(theoDayDu.body));

      const idDayDu = rows(theoDayDu.body).map((x) => x.id).sort();
      const idNgan = rows(theoNgan.body).map((x) => x.id).sort();
      expect(idNgan).toEqual(idDayDu);
    });

    test(`${m.ten}: mã không tồn tại ra 0 hồ sơ, không phải toàn bộ danh sách`, async ({
      request,
    }) => {
      // Nếu lọc dùng `contains` thay vì khớp chính xác, chuỗi này sẽ quét trúng hàng nghìn mã.
      const r = await list(request, m.path, { stt: '2099-999999', limit: 5 });
      expect(r.status).toBe(200);
      expect(tong(r.body)).toBe(0);
    });
  }
});

test.describe('U-06/10/22 — các ô lọc còn lại', () => {
  for (const m of MAN_HINH) {
    test(`${m.ten}: ô lọc RỖNG không được thu hẹp kết quả (AC-6)`, async ({ request }) => {
      // Bẫy kinh điển: chuỗi rỗng lọt vào mệnh đề where và lọc ra 0 hồ sơ.
      const khong = await list(request, m.path, { limit: 1 });
      const rong = await list(request, m.path, { stt: '', sttCu: '', limit: 1 });
      expect(rong.status).toBe(200);
      expect(tong(rong.body)).toBe(tong(khong.body));
    });

    test(`${m.ten}: lọc STT cũ chạy và không lỗi (AC-4)`, async ({ request }) => {
      const r = await list(request, m.path, { sttCu: '1', limit: 5 });
      expect(r.status, `${m.ten}: lọc sttCu không được trả lỗi`).toBe(200);
      expect(tong(r.body)).toBeLessThanOrEqual(tong((await list(request, m.path, { limit: 1 })).body));
    });

    test(`${m.ten}: lọc Cán bộ nhập chạy và không lỗi (AC-5)`, async ({ request }) => {
      const r = await list(request, m.path, { [m.canBo]: 'khong-co-that', limit: 5 });
      expect(r.status, `${m.ten}: lọc ${m.canBo} không được trả lỗi`).toBe(200);
      expect(tong(r.body), 'id không tồn tại thì ra 0 hồ sơ').toBe(0);
    });
  }
});

test.describe('U-07 — nguồn dữ liệu cho ô Cán bộ nhập', () => {
  test('lấy được danh sách cán bộ (AC-7)', async ({ request }) => {
    // Endpoint tên `/admin/users` nhưng quyền thật là `read:User` và OFFICER cũng có.
    // Nếu ca này đỏ thì ô lọc sẽ rỗng với đúng những người cần nó nhất.
    const r = await list(request, '/admin/users', { limit: 5 });
    expect(r.status).toBe(200);
    expect(rows(r.body).length).toBeGreaterThan(0);
  });
});

test.describe('U-12/16/20 — KHÔNG mất năng lực sẵn có', () => {
  for (const m of MAN_HINH) {
    test(`${m.ten}: sắp xếp theo cột vẫn chạy`, async ({ request }) => {
      const r = await list(request, m.path, { sortOrder: 'asc', limit: 5 });
      expect(r.status, `${m.ten}: thêm cột mới không được làm hỏng sắp xếp`).toBe(200);
      expect(rows(r.body).length).toBeGreaterThan(0);
    });

    test(`${m.ten}: thống kê cho thẻ/chip vẫn chạy`, async ({ request }) => {
      const r = await list(request, `${m.path}/stats`);
      expect(r.status, `${m.ten}: thẻ thống kê phải còn`).toBe(200);
      expect((r.body as { total?: number })?.total).toBeGreaterThan(0);
    });
  }
});
