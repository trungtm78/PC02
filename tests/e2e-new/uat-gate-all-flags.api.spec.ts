/**
 * Gate API — kiểm TỪNG cờ có thực sự chặn được, không chỉ có decorator.
 *
 * Vì sao bộ này tồn tại: `feature-gating.spec.ts` (unit) kiểm *manifest ⇔
 * decorator khớp nhau*, tức decorator có được GẮN không. Nó xanh suốt trong khi
 * gate là no-op hoàn toàn — `FeatureFlagGuard` đọc `request.user` mà chạy trước
 * thứ tạo ra nó (ADR-0018). Một cổng kiểm "đã gắn nhãn chưa" không thay được
 * một cổng kiểm "có chặn không".
 *
 * Đây là chốt chặn cho điều kiện merge E4/E5/E6: cả ba đợt đều dựa thẳng vào
 * giả định cờ tắt chặn được request từ APK cũ. Trước ADR-0018 giả định đó sai.
 *
 * Mỗi cờ: tắt → gọi endpoint → phải 404 kèm `FEATURE_DISABLED` → bật lại.
 * Bật lại nằm trong `finally` để một assertion hỏng không bỏ lại môi trường
 * mất chức năng.
 */
import { test, expect, request as pwRequest, APIRequestContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const API = process.env.API_URL || 'http://localhost:3000';

/** Cờ ⇒ một endpoint GET mà cờ đó gác. Chọn route danh sách vì luôn tồn tại. */
const GATED: Array<{ wave: string; flag: string; path: string }> = [
  // E4 — đợt rủi ro thấp
  { wave: 'E4', flag: 'lawyers', path: '/api/v1/lawyers' },
  { wave: 'E4', flag: 'kpi', path: '/api/v1/kpi/summary' },
  { wave: 'E4', flag: 'document-numbers', path: '/api/v1/document-numbers/templates' },
  // E5 — đợt trung bình
  { wave: 'E5', flag: 'subjects', path: '/api/v1/subjects' },
  { wave: 'E5', flag: 'documents', path: '/api/v1/documents' },
  { wave: 'E5', flag: 'guidance', path: '/api/v1/guidance' },
  { wave: 'E5', flag: 'exchanges', path: '/api/v1/exchanges' },
  { wave: 'E5', flag: 'delegations', path: '/api/v1/delegations' },
  { wave: 'E5', flag: 'proposals', path: '/api/v1/proposals' },
  { wave: 'E5', flag: 'conclusions', path: '/api/v1/conclusions' },
  // E6 — đợt rủi ro CAO, chính là ba cái điều kiện merge nói tới
  { wave: 'E6', flag: 'cases', path: '/api/v1/cases' },
  { wave: 'E6', flag: 'incidents', path: '/api/v1/incidents' },
  { wave: 'E6', flag: 'petitions', path: '/api/v1/petitions' },
  { wave: 'E6', flag: 'teams', path: '/api/v1/teams' },
  { wave: 'E6', flag: 'reports', path: '/api/v1/reports/monthly' },
];

function adminToken(): string {
  const p = path.resolve(__dirname, '../../test-results/.auth-token.txt');
  if (!fs.existsSync(p)) {
    throw new Error(
      `Không có token admin tại ${p}. Chạy qua playwright global-setup ` +
        '(UAT_PROD=1 + ADMIN_USERNAME/ADMIN_PASSWORD).',
    );
  }
  return fs.readFileSync(p, 'utf-8').trim();
}

async function api(): Promise<APIRequestContext> {
  return pwRequest.newContext({
    baseURL: API,
    extraHTTPHeaders: { Authorization: `Bearer ${adminToken()}` },
    ignoreHTTPSErrors: true,
  });
}

// Nối tiếp: các test này bật/tắt cờ dùng chung một máy chủ, chạy song song thì
// cờ của test này bị test kia sửa giữa chừng.
test.describe.configure({ mode: 'serial' });

for (const { wave, flag, path: route } of GATED) {
  test(`[${wave}] tắt cờ "${flag}" ⇒ ${route} trả 404 + FEATURE_DISABLED`, async () => {
    const ctx = await api();
    let turnedOff = false;
    try {
      const off = await ctx.patch(`/api/v1/feature-flags/${flag}`, {
        data: { enabled: false },
      });
      expect(off.status(), `không tắt được cờ "${flag}"`).toBeLessThan(300);
      turnedOff = true;

      const res = await ctx.get(route);
      expect(
        res.status(),
        `cờ "${flag}" tắt mà ${route} vẫn trả ${res.status()} — gate không chặn`,
      ).toBe(404);

      const body = JSON.stringify(await res.json());
      expect(
        body,
        'thiếu FEATURE_DISABLED ⇒ mobile hiện lỗi chung thay vì "Tính năng tạm tắt"',
      ).toContain('FEATURE_DISABLED');
    } finally {
      if (turnedOff) {
        await ctx.patch(`/api/v1/feature-flags/${flag}`, {
          data: { enabled: true },
        });
      }
      await ctx.dispose();
    }
  });
}

test('mọi cờ vừa kiểm đều đã được bật lại', async () => {
  // Không có test này thì `finally` ở trên chỉ là ý định tốt: nó có thể im lặng
  // thất bại và để lại một môi trường mất chức năng cho mọi người sau.
  const ctx = await api();
  const still404: string[] = [];
  for (const { flag, path: route } of GATED) {
    const res = await ctx.get(route);
    if (res.status() === 404) still404.push(`${flag} (${route})`);
  }
  expect(still404, 'cờ còn tắt sau khi chạy test').toEqual([]);
  await ctx.dispose();
});
