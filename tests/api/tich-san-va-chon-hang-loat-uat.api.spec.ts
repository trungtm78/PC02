import { test, expect, request as playwrightRequest, type APIRequestContext } from '@playwright/test';

/**
 * UAT trên MÁY THẬT: cờ "tích sẵn khi in" đi trọn đường từ màn quản lý mẫu tới popup In chứng từ.
 *
 * ── Vì sao UAT này phải chạy trên máy thật ──
 *
 * Ca kiểm đơn vị chứng minh từng mảnh đúng. Nó KHÔNG chứng minh cờ đi được từ đầu này sang đầu
 * kia: bộ nạp của popup dùng một danh sách `select` viết tay, và quên khai cột ở đó thì popup
 * không bao giờ thấy cờ — admin bật công tắc mà chẳng có gì đổi, mọi ca kiểm vẫn xanh.
 *
 * Đúng lớp lỗi đã trả giá sáng 28/08/2026: một bản vá qua 3.781 ca kiểm và hai vòng soát độc lập
 * rồi lên máy thật không có tác dụng gì, chỉ vì ba bộ nạp không khai cột.
 *
 * ── Dọn dẹp ──
 *
 * Bài kiểm ĐỔI cấu hình thật của một mẫu, nên nó luôn trả về giá trị ban đầu ở `afterAll`, kể cả
 * khi có ca đỏ. Không dọn là để lại một mẫu bật/tắt sai mà không ai biết vì sao.
 */
const API = process.env.API_BASE ?? 'http://171.244.40.245/api/v1';

let ctx: APIRequestContext;
let token = '';
let mauId = '';
let giaTriBanDau: boolean | undefined;

async function dangNhap(): Promise<string> {
  const res = await ctx.post(`${API}/auth/login`, {
    data: {
      username: process.env.ADMIN_USERNAME ?? '',
      password: process.env.ADMIN_PASSWORD ?? '',
    },
  });
  expect(res.ok(), `đăng nhập thất bại: ${res.status()}`).toBeTruthy();
  const body = await res.json();
  return body?.data?.accessToken ?? body?.accessToken ?? '';
}

const auth = () => ({ Authorization: `Bearer ${token}` });

/**
 * Mẫu như popup In chứng từ nhìn thấy (đường của cán bộ, không phải đường admin).
 *
 * Bóc thân phản hồi ở ĐÚNG MỘT chỗ: máy chủ có thể trả mảng trần hoặc bọc trong `data`. Viết
 * hai kiểu bóc ở hai chỗ là bài kiểm tự báo đỏ giả — chính nó đã dẫm phải lần chạy đầu.
 */
async function mauChoPopup(duong = 'petitions'): Promise<Array<Record<string, unknown>>> {
  const res = await ctx.get(`${API}/${duong}/export-templates`, { headers: auth() });
  expect(res.ok(), `lấy mẫu cho popup (${duong}) thất bại: ${res.status()}`).toBeTruthy();
  const body = await res.json();
  return (body?.data ?? body) as Array<Record<string, unknown>>;
}

const mauTheoPopup = () => mauChoPopup('petitions');

async function datCo(id: string, gt: boolean) {
  const res = await ctx.patch(`${API}/document-templates/${id}`, {
    headers: auth(),
    data: { selectedByDefault: gt },
  });
  expect(res.ok(), `đặt cờ thất bại: ${res.status()} ${await res.text()}`).toBeTruthy();
}

test.beforeAll(async () => {
  ctx = await playwrightRequest.newContext({ ignoreHTTPSErrors: true });
  token = await dangNhap();
  expect(token, 'không lấy được token').toBeTruthy();

  const ds = await mauTheoPopup();
  expect(ds.length, 'máy thật phải có mẫu Đơn thư').toBeGreaterThan(0);
  mauId = String(ds[0]['id']);
  giaTriBanDau = ds[0]['selectedByDefault'] as boolean | undefined;
});

test.afterAll(async () => {
  // Trả cấu hình về đúng như trước khi chạy, kể cả khi có ca đỏ.
  if (mauId && typeof giaTriBanDau === 'boolean') {
    try {
      await datCo(mauId, giaTriBanDau);
    } catch {
      // Đã ghi ở log runner; không nuốt kết quả của bài kiểm.
    }
  }
  await ctx.dispose();
});

test.describe('UAT · cờ tích sẵn khi in', () => {
  /**
   * CỔNG QUAN TRỌNG NHẤT: đường mà popup thật sự dùng phải TRẢ VỀ cờ. Thiếu trường này là toàn
   * bộ tính năng chết im lặng, dù màn admin lưu đúng.
   */
  test('UAT-01 · đường của popup trả về trường `selectedByDefault`', async () => {
    const ds = await mauTheoPopup();
    for (const m of ds) {
      expect(
        typeof m['selectedByDefault'],
        `mẫu ${m['code']} không có cờ — popup sẽ không bao giờ thấy nó`,
      ).toBe('boolean');
    }
  });

  test('UAT-02 · bật cờ ở màn quản lý thì popup thấy đã bật', async () => {
    await datCo(mauId, true);
    const m = (await mauTheoPopup()).find((x) => String(x['id']) === mauId);
    expect(m?.['selectedByDefault']).toBe(true);
  });

  test('UAT-03 · tắt cờ ở màn quản lý thì popup thấy đã tắt', async () => {
    await datCo(mauId, false);
    const m = (await mauTheoPopup()).find((x) => String(x['id']) === mauId);
    expect(m?.['selectedByDefault']).toBe(false);
  });

  /** Đổi cờ không được đụng tới cấu hình khác của mẫu — đây là chỗ dễ nuốt dữ liệu nhất. */
  test('UAT-04 · đổi cờ không làm mất cấu hình khác của mẫu', async () => {
    const truoc = (await mauTheoPopup()).find((x) => String(x['id']) === mauId)!;
    await datCo(mauId, !truoc['selectedByDefault']);
    const sau = (await mauTheoPopup()).find((x) => String(x['id']) === mauId)!;
    for (const khoa of ['code', 'name', 'category', 'needsNumber', 'sortOrder', 'fileSha']) {
      expect(sau[khoa], `trường ${khoa} bị đổi khi chỉ đặt cờ`).toEqual(truoc[khoa]);
    }
  });

  /** Ba màn dùng CHUNG một popup — cờ phải đi qua cả ba đường, không riêng Đơn thư. */
  for (const [duong, nhan] of [
    ['petitions', 'Đơn thư'],
    ['incidents', 'Vụ việc'],
    ['cases', 'Vụ án'],
  ] as const) {
    test(`UAT-05 · ${duong} (${nhan}) cũng trả về cờ`, async () => {
      const ds = await mauChoPopup(duong);
      expect(ds.length, `${duong} phải có mẫu`).toBeGreaterThan(0);
      for (const m of ds) expect(typeof m['selectedByDefault']).toBe('boolean');
    });
  }
});
