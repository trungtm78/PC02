import { test, expect } from '@playwright/test';
import { getAuthToken } from '../helpers/auth';

/**
 * UAT tầng API — thứ tự mặc định của ba danh sách hồ sơ (anh yêu cầu 19/09/2026: "ngày đề xuất phải được order
 * by theo giảm dần").
 *
 * Oracle (từ yêu cầu, không từ mã): mở danh sách KHÔNG chọn sắp xếp thì
 *   1. Ngày đề xuất KHÔNG tăng từ trên xuống, qua cả ranh giới trang 1 → trang 2;
 *   2. Hồ sơ không có ngày đề xuất nằm SAU mọi hồ sơ có ngày;
 *   3. Cùng một ngày thì số hồ sơ (năm, số) KHÔNG tăng — đọc như sổ, số mới trước.
 *
 * Đo prod trước bản vá (mặc định còn là STT): Đơn thư và Vụ việc mỗi màn 2 chỗ ngày tăng trong 20 dòng đầu.
 *
 * CHỈ ĐỌC — chạy được trên prod:
 *   UAT_PROD=1 BASE_URL=<gốc giao diện> npx playwright test --project=api tests/api/sap-ngay-de-xuat-uat.api.spec.ts
 */
const API = `${process.env.BASE_URL ?? 'http://localhost:5173'}/api/v1`;
const hdr = () => ({ Authorization: `Bearer ${getAuthToken()}` });
const CO_TRANG = 100;

interface Dong {
  id: string;
  ngayDeXuat?: string | null;
  [k: string]: unknown;
}

/**
 * "2026-11948" → [2026, 11948]. Mã khác dạng (quá 5 chữ số, năm ngoài 1900–2100, có khoảng trắng) là mã méo:
 * cán bộ không đọc nó như một số hồ sơ, nên không kết luận thứ tự trên nó → null.
 */
function soHoSo(ma: unknown): [number, number] | null {
  const m = /^(\d{4})-(\d{1,5})$/.exec(String(ma ?? ''));
  if (!m || Number(m[1]) < 1900 || Number(m[1]) > 2100) return null;
  return [Number(m[1]), Number(m[2])];
}

for (const { ten, url, ma } of [
  { ten: 'Đơn thư', url: '/petitions', ma: 'stt' },
  { ten: 'Vụ việc', url: '/incidents', ma: 'code' },
  { ten: 'Vụ án', url: '/cases', ma: 'caseCode' },
] as const) {
  test(`S-${ten}: mặc định Ngày đề xuất giảm dần, rỗng cuối, cùng ngày số giảm dần`, async ({ request }) => {
    const dong: Dong[] = [];
    for (const offset of [0, CO_TRANG]) {
      const r = await request.get(`${API}${url}?limit=${CO_TRANG}&offset=${offset}`, { headers: hdr() });
      expect(r.status(), `${url} offset=${offset}`).toBe(200);
      const b = await r.json();
      const ds: Dong[] = Array.isArray(b) ? b : (b.data ?? b.items ?? []);
      dong.push(...ds);
    }
    expect(dong.length, 'phải có dữ liệu để đo').toBeGreaterThan(1);
    expect(new Set(dong.map((d) => d.id)).size, 'hai trang không được lặp hồ sơ').toBe(dong.length);

    const loi: string[] = [];
    let daGapRong = false;
    for (let i = 1; i < dong.length; i++) {
      const [a, b] = [dong[i - 1], dong[i]];
      const [na, nb] = [a.ngayDeXuat ?? null, b.ngayDeXuat ?? null];
      if (na === null) daGapRong = true;
      if (daGapRong && nb !== null) loi.push(`#${i}: hồ sơ có ngày ${String(b[ma])} đứng sau hồ sơ rỗng`);
      if (na === null || nb === null) continue;
      const [ta, tb] = [Date.parse(na), Date.parse(nb)];
      if (tb > ta) loi.push(`#${i}: ${String(a[ma])} (${na}) → ${String(b[ma])} (${nb}) ngày TĂNG`);
      if (tb === ta) {
        const [sa, sb] = [soHoSo(a[ma]), soHoSo(b[ma])];
        // Mã méo đứng SAU mã thật trong cùng ngày (không có số thì chìm cuối nhóm).
        if (!sa && sb) loi.push(`#${i}: cùng ngày ${na}, mã méo ${String(a[ma])} đứng trước ${String(b[ma])}`);
        if (sa && sb && (sb[0] > sa[0] || (sb[0] === sa[0] && sb[1] > sa[1]))) {
          loi.push(`#${i}: cùng ngày ${na}, số ${String(a[ma])} → ${String(b[ma])} TĂNG`);
        }
      }
    }
    expect(loi, `${ten}: vi phạm thứ tự (${dong.length} dòng)`).toEqual([]);
  });
}
