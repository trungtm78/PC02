import { test, expect } from '@playwright/test';
import { getAuthToken } from '../helpers/auth';

/**
 * UAT tầng API — ô ngày chỉ nhận ngày CÓ THẬT (tồn đọng PR #220, 19/09/2026).
 *
 * Oracle (lịch dương, không từ mã): 31/02, 29/02 năm không nhuận, 31/04 không tồn tại → máy chủ từ chối 400 và nói
 * rõ; 29/02/2024 (năm nhuận) và ngày thường → nhận. Trước bản vá, máy chủ nhận "2026-02-31" rồi ngầm đổi thành 03/03.
 *
 * CHỈ ĐỌC (bộ lọc danh sách) — chạy được trên prod:
 *   UAT_PROD=1 BASE_URL=<gốc> npx playwright test --project=api tests/api/ngay-co-that-uat.api.spec.ts
 */
const API = `${process.env.BASE_URL ?? 'http://localhost:5173'}/api/v1`;
const hdr = () => ({ Authorization: `Bearer ${getAuthToken()}` });

const MAN = [
  ['Đơn thư', '/petitions', 'fromDate'],
  ['Vụ việc', '/incidents', 'fromDateRange'],
  ['Vụ án', '/cases', 'ngayTiepNhanFrom'],
] as const;

for (const [ten, url, truong] of MAN) {
  test(`N-${ten}: bộ lọc ngày từ chối ngày không có thật, nhận ngày có thật`, async ({ request }) => {
    for (const sai of ['2026-02-31', '2025-02-29', '2026-04-31']) {
      const r = await request.get(`${API}${url}?limit=1&${truong}=${sai}`, { headers: hdr() });
      expect(r.status(), `${ten} ${truong}=${sai}`).toBe(400);
      expect(JSON.stringify(await r.json())).toMatch(/không có thật|định dạng/);
    }
    for (const dung of ['2024-02-29', '2026-09-19']) {
      const r = await request.get(`${API}${url}?limit=1&${truong}=${dung}`, { headers: hdr() });
      expect(r.status(), `${ten} ${truong}=${dung}`).toBe(200);
    }
  });
}
