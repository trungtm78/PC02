import { test, expect, type APIRequestContext } from '@playwright/test';
import { getAuthToken, getTokenTheoTaiKhoan } from '../helpers/auth';

/**
 * UAT tầng API — soát IDOR 19/09/2026: lịch sử trạng thái vụ án + báo cáo TĐC theo phạm vi tổ.
 *
 * Oracle (luật phân quyền, không từ mã):
 *  - Không được xem vụ án (GET /cases/:id → 403) thì không được xem lịch sử trạng thái của nó → 403; mã không tồn
 *    tại → 404 (không trả danh sách rỗng cho phép dò mã).
 *  - Báo cáo TĐC chứa số liệu theo tổ: cán bộ chỉ xem được tổ của mình. `officer1` không thuộc tổ nào → 403 kèm
 *    lý do; quản trị vẫn xem toàn đơn vị. Danh sách bản nháp của cán bộ không có tổ chỉ gồm bản do chính họ tạo.
 *
 * CHỈ ĐỌC — chạy được trên prod:
 *   UAT_PROD=1 BASE_URL=<gốc> npx playwright test --project=api \
 *     tests/api/pham-vi-tdac-lich-su-uat.api.spec.ts
 */
const API = `${process.env.BASE_URL ?? 'http://localhost:5173'}/api/v1`;
/** officer1 do global-setup đăng nhập sẵn — KHÔNG tự đăng nhập (giới hạn tần suất → 429 đỏ oan). */
function canBo(): { h: Record<string, string>; id: string } {
  const token = getTokenTheoTaiKhoan('officer1');
  expect(token, 'global-setup phải đăng nhập được officer1').toBeTruthy();
  const id = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub as string;
  return { h: { Authorization: `Bearer ${token}` }, id };
}
const admin = () => ({ Authorization: `Bearer ${getAuthToken()}` });
const KY = 'fromDate=2026-01-01&toDate=2026-06-30';


test('L-1 Lịch sử trạng thái vụ án ngoài phạm vi → 403; mã không tồn tại → 404', async ({ request }) => {
  const { h } = canBo();
  const ds = await request.get(`${API}/cases?limit=50`, { headers: admin() });
  let caseId: string | undefined;
  for (const c of ((await ds.json()).data ?? []) as Array<{ id: string }>) {
    if ((await request.get(`${API}/cases/${c.id}`, { headers: h })).status() === 403) {
      caseId = c.id;
      break;
    }
  }
  expect(caseId, 'cần một vụ án ngoài phạm vi của cán bộ').toBeTruthy();
  expect((await request.get(`${API}/cases/${caseId}/status-history`, { headers: h })).status()).toBe(403);
  expect((await request.get(`${API}/cases/khong-ton-tai-uat/status-history`, { headers: h })).status()).toBe(404);
  // Quản trị vẫn đọc được.
  expect((await request.get(`${API}/cases/${caseId}/status-history`, { headers: admin() })).status()).toBe(200);
});

test('T-1 Báo cáo TĐC: cán bộ không thuộc tổ nào → 403 có lý do; quản trị xem được', async ({ request }) => {
  const { h } = canBo();
  for (const loai of ['vu-an', 'vu-viec']) {
    const r = await request.get(`${API}/reports/tdac/${loai}?${KY}`, { headers: h });
    expect(r.status(), `${loai} (cán bộ)`).toBe(403);
    expect(JSON.stringify(await r.json())).toContain('chưa thuộc tổ nào');
    expect((await request.get(`${API}/reports/tdac/${loai}?${KY}`, { headers: admin() })).status(), `${loai} (quản trị)`).toBe(200);
  }
});

test('T-2 Danh sách bản nháp TĐC của cán bộ không có tổ chỉ gồm bản do chính họ tạo', async ({ request }) => {
  const { h, id } = canBo();
  const r = await request.get(`${API}/reports/tdac/drafts`, { headers: h });
  expect(r.status()).toBe(200);
  const ds = (await r.json()) as Array<{ createdById: string }>;
  expect(ds.filter((d) => d.createdById !== id)).toEqual([]);
});
