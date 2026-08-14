/**
 * UAT Đợt 3 (hạ tầng cờ) + phần Đợt 5 — chạy tự động ở mức API.
 *
 * Ba khẳng định dưới đây là loại hỏng **im lặng**: không có ngoại lệ nào được
 * ném, không có dòng log nào đỏ, chỉ có một sidebar trống hoặc một API biến mất
 * không lý do. Đúng loại mà test đơn vị không thấy vì từng mảnh đều chạy đúng —
 * chỉ chỗ nối là sai.
 *
 * Test tự dọn: cờ nào bị tắt để kiểm thì bật lại trong `finally`, kể cả khi
 * assertion giữa chừng ném. Bỏ sót bước đó thì một lần chạy test làm hỏng môi
 * trường cho mọi lần sau.
 */
import { test, expect, request as pwRequest } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const API = process.env.API_URL || 'http://localhost:3000';

function adminToken(): string {
  const p = path.resolve(__dirname, '../../test-results/.auth-token.txt');
  if (!fs.existsSync(p)) {
    throw new Error(
      `Không có token admin tại ${p}. Chạy qua playwright global-setup ` +
        '(UAT_PROD=1 + ADMIN_USERNAME/ADMIN_PASSWORD) chứ đừng gọi thẳng file này.',
    );
  }
  return fs.readFileSync(p, 'utf-8').trim();
}

async function api() {
  return pwRequest.newContext({
    baseURL: API,
    extraHTTPHeaders: { Authorization: `Bearer ${adminToken()}` },
    ignoreHTTPSErrors: true,
  });
}

test.describe('Đợt 3 — hạ tầng cờ tính năng', () => {
  test('GET /feature-flags trả đủ cờ, không rỗng', async () => {
    // Hồi quy đã từng xảy ra: endpoint này 403 với người không phải ADMIN ⇒
    // sidebar TRỐNG cho mọi user. Không lỗi nào hiện lên màn hình.
    const ctx = await api();
    const res = await ctx.get('/api/v1/feature-flags');
    expect(res.status()).toBe(200);

    const body = (await res.json()) as { data?: unknown[] } | unknown[];
    const flags = Array.isArray(body) ? body : (body.data ?? []);
    expect(Array.isArray(flags)).toBe(true);
    expect(flags.length, 'danh sách cờ rỗng ⇒ sidebar trống').toBeGreaterThan(
      20,
    );
    await ctx.dispose();
  });

  test('không tắt được cờ lõi: PATCH /feature-flags/auth → 400', async () => {
    // `CORE_FEATURE_KEYS` không được phép tắt. Tắt `auth` nghĩa là tự khoá mình
    // ra khỏi hệ thống, và không có đường vào để bật lại.
    const ctx = await api();
    const res = await ctx.patch('/api/v1/feature-flags/auth', {
      data: { enabled: false },
    });
    expect(
      res.status(),
      'cờ lõi phải bị từ chối ở tầng API, không chỉ ẩn nút trên UI',
    ).toBe(400);
    await ctx.dispose();
  });
});

test.describe('Đợt 5 — gate API trả đúng hình dạng lỗi', () => {
  // ĐÃ SỬA (ADR-0018). Trước đây test này đỏ 8/8 lần: `FeatureFlagGuard` đọc
  // `request.user` mà nó chạy TRƯỚC `JwtAuthGuard` cấp controller nên giá trị đó
  // luôn `undefined` ⇒ cờ tắt không chặn được gì. Nay guard tự xác thực token.
  //
  // Sửa xong lỗi thứ nhất mới lộ ra lỗi thứ hai: filter ngoại lệ ghi đè `code`
  // bằng `NOT_FOUND` và nuốt mất `FEATURE_DISABLED` — mã mà web và mobile đều
  // rẽ nhánh theo. Cả hai đã sửa; khẳng định `FEATURE_DISABLED` bên dưới chính
  // là chốt cho lỗi thứ hai.
  test('tắt cờ lawyers → GET /lawyers trả 404 KÈM error FEATURE_DISABLED', async () => {
    // 404 trần và 404-vì-tắt-cờ trông giống hệt nhau với người dùng, nhưng
    // khác nhau hoàn toàn với app mobile: một cái là "không có dữ liệu", cái
    // kia phải hiện màn "Tính năng tạm tắt". APK đã cài không có đường cứu nếu
    // hình dạng lỗi này sai.
    const ctx = await api();
    let turnedOff = false;
    try {
      const off = await ctx.patch('/api/v1/feature-flags/lawyers', {
        data: { enabled: false },
      });
      expect(off.status(), 'phải tắt được cờ không-lõi').toBeLessThan(300);
      turnedOff = true;

      // Cờ được cache trong tiến trình với TTL `FEATURE_FLAG_CACHE_TTL_MS`
      // (mặc định 30s), và PATCH KHÔNG xoá cache. Đó là chủ ý: cache nằm trong
      // từng tiến trình, nên nhiều instance hội tụ bằng TTL chứ không bằng một
      // lệnh xoá chỉ tới được một instance. Hệ quả vận hành phải biết: **tắt
      // một cờ mất tới 30 giây mới có hiệu lực**, không phải tức thì.
      //
      // Lần viết đầu tôi khẳng định 404 ngay sau PATCH và test đỏ; tôi suýt ghi
      // đó là lỗi gate. Chờ đúng cửa sổ TTL mới là phép kiểm trung thực.
      let res = await ctx.get('/api/v1/lawyers');
      const deadline = Date.now() + 40_000;
      while (res.status() !== 404 && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 2_000));
        res = await ctx.get('/api/v1/lawyers');
      }
      expect(res.status(), 'cờ tắt phải có hiệu lực trong cửa sổ TTL').toBe(404);

      const body = (await res.json()) as Record<string, unknown>;
      const flat = JSON.stringify(body);
      expect(
        flat,
        'thiếu mã FEATURE_DISABLED ⇒ mobile hiện "Lỗi: DioException"',
      ).toContain('FEATURE_DISABLED');
    } finally {
      // Bật lại DÙ assertion trên có ném hay không — nếu không, mọi lần chạy
      // sau (và mọi người dùng môi trường này) mất chức năng luật sư.
      if (turnedOff) {
        await ctx.patch('/api/v1/feature-flags/lawyers', {
          data: { enabled: true },
        });
      }
      await ctx.dispose();
    }
  });

  test('bật lại rồi thì /lawyers hết 404 — chứng minh bước dọn có tác dụng', async () => {
    // Không có test này thì `finally` ở trên chỉ là ý định tốt: nó có thể im
    // lặng thất bại và không ai biết cho tới lần chạy sau.
    const ctx = await api();
    // Cũng phải chờ TTL như chiều tắt — cùng một cơ chế cache.
    let res = await ctx.get('/api/v1/lawyers');
    const deadline = Date.now() + 40_000;
    while (res.status() === 404 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 2_000));
      res = await ctx.get('/api/v1/lawyers');
    }
    expect(res.status(), 'cờ lawyers phải đã được bật lại').not.toBe(404);
    await ctx.dispose();
  });
});
