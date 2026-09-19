import { test, expect, type APIRequestContext } from '@playwright/test';
import { getAuthToken } from '../helpers/auth';

/**
 * UAT tầng API — cán bộ KHÔNG gắn được bản ghi con vào vụ án ngoài phạm vi của mình (tồn đọng PR #217/#220, sửa
 * 19/09/2026). Chủ ngữ là máy chủ (điểm cuối POST), nên bằng chứng HTTP là đúng tầng.
 *
 * Oracle (từ luật phân quyền, không từ mã): hồ sơ mà cán bộ KHÔNG ĐƯỢC XEM (GET chi tiết → 403) thì cán bộ cũng
 * không được thêm kết luận / ủy thác vào nó → 403, và số bản ghi không đổi.
 *
 * AN TOÀN KHI CHẠY TRÊN PROD, kể cả trên bản CŨ chưa vá: mỗi yêu cầu mang một khoá ngoại không tồn tại
 * (`approvedById` / `assignedToId`). Bản cũ bỏ qua phạm vi rồi vấp khoá ngoại → 400 và KHÔNG ghi (ủy thác chạy trong
 * giao dịch, có sẵn số nên không xin số tự động). Bản mới chặn phạm vi TRƯỚC → 403. Nhờ vậy cùng một ca phân biệt
 * được hai bản mà không bao giờ ghi dữ liệu thật. Ca đếm trước/sau khẳng định lại điều đó.
 *
 * Luật sư / Đối tượng: `officer1` không có quyền ghi Lawyer/Subject, nên cổng quyền đã chặn 403 ở CẢ hai bản — ca
 * HTTP ở đó không phân biệt được gì; hai module ấy được kiểm ở `tao-con-kiem-pham-vi-cha.spec.ts`.
 *
 *   UAT_PROD=1 UAT_OFFICER_PASS=<mật khẩu officer1> BASE_URL=<gốc> npx playwright test --project=api \
 *     tests/api/tao-con-pham-vi-uat.api.spec.ts
 */
const API = `${process.env.BASE_URL ?? 'http://localhost:5173'}/api/v1`;
const OFFICER = process.env.UAT_OFFICER_USER ?? 'officer1@pc02.local';
const KHOA_KHONG_TON_TAI = 'uat-khong-ton-tai-khoa-ngoai';

const admin = () => ({ Authorization: `Bearer ${getAuthToken()}` });

async function dangNhapCanBo(request: APIRequestContext): Promise<Record<string, string>> {
  const matKhau = process.env.UAT_OFFICER_PASS;
  expect(matKhau, 'thiếu UAT_OFFICER_PASS — ca này không được bỏ qua lặng lẽ').toBeTruthy();
  const r = await request.post(`${API}/auth/login`, { data: { username: OFFICER, password: matKhau } });
  expect(r.status(), 'cán bộ đăng nhập được').toBeLessThan(300);
  const b = await r.json();
  const token = b.accessToken ?? b.data?.accessToken;
  expect(token, 'có accessToken').toBeTruthy();
  return { Authorization: `Bearer ${token}` };
}

/** Vụ án mà cán bộ KHÔNG được xem — đo bằng chính điểm cuối chi tiết, không suy từ dữ liệu tổ. */
async function vuAnNgoaiPhamVi(request: APIRequestContext, canBo: Record<string, string>): Promise<string> {
  const r = await request.get(`${API}/cases?limit=50`, { headers: admin() });
  expect(r.status()).toBe(200);
  const ds = ((await r.json()).data ?? []) as Array<{ id: string }>;
  for (const c of ds) {
    const xem = await request.get(`${API}/cases/${c.id}`, { headers: canBo });
    if (xem.status() === 403) return c.id;
  }
  throw new Error('không tìm được vụ án ngoài phạm vi của cán bộ trong 50 vụ án đầu');
}

async function tong(request: APIRequestContext, url: string): Promise<number> {
  const r = await request.get(url, { headers: admin() });
  expect(r.status(), url).toBe(200);
  return (await r.json()).total as number;
}

test('P-1 Kết luận: không thêm được vào vụ án ngoài phạm vi (403, không ghi)', async ({ request }) => {
  const canBo = await dangNhapCanBo(request);
  const caseId = await vuAnNgoaiPhamVi(request, canBo);
  const truoc = await tong(request, `${API}/conclusions?caseId=${caseId}`);

  const r = await request.post(`${API}/conclusions`, {
    headers: canBo,
    data: { caseId, type: 'UAT', content: 'UAT phạm vi — không được ghi', approvedById: KHOA_KHONG_TON_TAI },
  });
  expect(r.status(), await r.text()).toBe(403);
  expect(await tong(request, `${API}/conclusions?caseId=${caseId}`)).toBe(truoc);
});

test('P-2 Ủy thác: không gắn được vụ án ngoài phạm vi (403, không ghi)', async ({ request }) => {
  const canBo = await dangNhapCanBo(request);
  const caseId = await vuAnNgoaiPhamVi(request, canBo);
  const truoc = await tong(request, `${API}/delegations?limit=1`);

  const r = await request.post(`${API}/delegations`, {
    headers: canBo,
    data: {
      relatedCaseId: caseId,
      delegationNumber: 'UAT-PHAM-VI-KHONG-GHI',
      receivingUnit: 'UAT',
      content: 'UAT phạm vi — không được ghi',
      assignedToId: KHOA_KHONG_TON_TAI,
    },
  });
  expect(r.status(), await r.text()).toBe(403);
  expect(await tong(request, `${API}/delegations?limit=1`)).toBe(truoc);
});
