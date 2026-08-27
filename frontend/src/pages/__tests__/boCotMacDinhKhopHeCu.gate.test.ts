import { describe, it, expect } from 'vitest';
import nguonDonThu from '@/pages/petitions/PetitionListPageShell.tsx?raw';
import nguonVuViec from '@/pages/incidents/IncidentListPageShell.tsx?raw';
import nguonVuAn from '@/pages/cases/CaseListPageShell.tsx?raw';

/**
 * CỔNG: bộ cột HIỆN MẶC ĐỊNH của ba danh sách đúng bằng bộ cột hệ cũ đang hiện.
 *
 * Cán bộ mở màn hình ra là thấy ngay bộ cột họ quen — không phải vào menu bật từng cột. Cột
 * hệ mới thêm vẫn giữ, nhưng để trạng thái CHƯA TÍCH.
 *
 * Bộ cột dưới đây đọc thẳng từ mã nguồn màn hình hệ cũ ngày 27/08/2026 (`/doi-1`, `/VuViec`,
 * `/VuAn`), lấy phần khai `columns.push({ field, title })` và BỎ những dòng đã bị chú thích —
 * hệ cũ tắt cột bằng cách chú thích dòng khai chứ không xoá.
 *
 * Ba khác biệt tìm ra hôm ấy, ghi lại để không ai "sửa nhầm cho khớp":
 *
 *   • Vụ việc hệ cũ KHÔNG có cột "Nguồn đơn/Đơn vị giao" (chỉ Đơn thư có) — hệ mới đang hiện
 *     mặc định, nay chuyển sang chưa tích.
 *   • Vụ việc hệ cũ CÓ cột "Đối tượng bị can", nhưng bản gốc di trú không có một bản ghi nào
 *     (`bi_can_info` rỗng ở cả 5.000 hồ sơ mẫu) và hệ mới cũng không có quan hệ ấy cho vụ
 *     việc. Dựng một cột rỗng là bịa, nên KHÔNG dựng.
 *   • Vụ án hệ cũ CÓ cột "Đơn vị" (`don_vi_ten`), nhưng hệ cũ suy tên ấy lúc chạy từ
 *     `don_vi_id` — bản gốc không lưu, và mã đơn vị ánh xạ ra nhiều tên khác nhau nên không
 *     suy ngược được. Cũng KHÔNG dựng.
 */

/**
 * Cột hệ cũ ĐANG HIỆN ở ba màn của menu "Phân loại đơn, vụ việc, vụ án", đọc thẳng từ mã
 * nguồn ngày 27/08/2026: `/doi-1/don-thu`, `/doi-1/vu-viec-da-phan-loai`,
 * `/doi-1/vu-an-da-phan-loai`. Cả ba màn khai CÙNG một bộ cột.
 *
 * Hệ cũ tắt cột bằng cách chú thích dòng khai chứ không xoá — ba cột đang tắt ở cả ba màn là
 * "Đối tượng bị can" (`bi_can_info`), "Đơn vị" (`don_vi_ten`) và "STT cũ" (`stt_cu`).
 */
const COT_HE_CU: readonly string[] = [
  'STT',
  'Ngày đề xuất',
  'Nguồn đơn/Đơn vị giao',
  'Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại',
  'Tóm tắt nội dung',
  'Đơn vị giải quyết',
  'Kết quả xử lý, giải quyết khác',
  'Người nhập',
];

/**
 * Cột hệ mới được phép hiện thêm, kèm lý do.
 *
 * Khai tường minh: im lặng cho qua là cách một cột lạ trôi vào bộ mặc định, và cán bộ mở màn
 * hình ra thấy khác thứ họ quen.
 */
const HIEN_THEM_CO_LY_DO: Readonly<Record<string, string>> = {
  'Thao tác': 'nút bấm, hệ cũ cũng có, chỉ khác chỗ đứng',
  'Trạng thái': 'trạng thái hệ mới — thứ hệ cũ không quản được',
  'Vụ án|Đối tượng bị can':
    'màn `/VuAn` của hệ cũ có cột này và anh chốt 26/08/2026 lấy /VuAn làm chuẩn; ' +
    'màn `/doi-1/vu-an-da-phan-loai` thì tắt. Giữ cả hai vì cả hai đều có dữ liệu thật.',
};

/** Cột hệ mới hiện mặc định (`optional: 'show'`, hoặc không khai `optional`). */
function cotHienMacDinh(nguon: string): string[] {
  const ra: string[] = [];
  const re = /header: '([^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(nguon))) {
    const mo = nguon.lastIndexOf('{', m.index);
    let i = mo + 1;
    let sau = 1;
    while (i < nguon.length && sau > 0) {
      if (nguon[i] === '{') sau++;
      else if (nguon[i] === '}') sau--;
      i++;
    }
    const khoi = nguon.slice(mo, i);
    if (/optional:\s*'hide'/.test(khoi)) continue;
    ra.push(m[1]);
  }
  return ra;
}

const BANG = [
  ['Đơn thư', nguonDonThu],
  ['Vụ việc', nguonVuViec],
  ['Vụ án', nguonVuAn],
] as const;

describe.each(BANG)('GATE %s — bộ cột mặc định khớp hệ cũ', (ten, nguon) => {
  const hien = cotHienMacDinh(nguon);

  it('đọc được bộ cột, không rơi về rỗng', () => {
    expect(hien.length).toBeGreaterThan(6);
  });

  it('không thiếu cột nào của hệ cũ', () => {
    expect(COT_HE_CU.filter((c) => !hien.includes(c))).toEqual([]);
  });

  /** Cột hệ mới thêm vẫn giữ, nhưng phải để CHƯA TÍCH — trừ "Thao tác" và "Trạng thái". */
  it('không hiện thừa cột mà hệ cũ không có', () => {
    const thua = hien.filter(
      (c) => !COT_HE_CU.includes(c) && !(c in HIEN_THEM_CO_LY_DO) && !(`${ten}|${c}` in HIEN_THEM_CO_LY_DO),
    );
    expect(thua).toEqual([]);
  });
});
