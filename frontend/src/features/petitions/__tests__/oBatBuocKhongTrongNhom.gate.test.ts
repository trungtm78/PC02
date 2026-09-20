import { describe, expect, it } from 'vitest';
import { PETITION_LEGACY_LAYOUT } from '../legacy-form-binding';
import { NHOM_O_DON_THU } from '../nhom-o.def';

/**
 * CỔNG: không ô BẮT BUỘC nào được nằm trong một nhóm gập.
 *
 * Đây là lớp lỗi PR #248 nhìn từ phía cấu trúc: ô bắt buộc nằm trong khối đóng sẵn → cán bộ điền
 * xong tab, bấm Lưu, nhận thông báo cho một ô KHÔNG nhìn thấy, và không có cách nào biết phải mở
 * cái gì ra.
 *
 * Vì sao cần cổng THUẦN CẤU TRÚC chứ không chỉ cổng dựng form:
 *
 * Cổng dựng form (`pages/petitions/__tests__/oBatBuocKhongBiGiau.gate.test.tsx`) chỉ chứng minh
 * được điều gì đó khi nhóm CÓ THỂ sinh lỗi. Sau khi "Số điện thoại nguyên đơn" ra khỏi nhóm
 * (20/09/2026, yêu cầu của anh), nhóm "Thông tin định danh nguyên đơn" còn bốn ô mà `validate.ts`
 * KHÔNG có luật nào nhắm tới — nên trên form thật nhóm ấy không bao giờ đỏ, và mọi mệnh đề dựa
 * vào trạng thái lỗi đều thành xanh rỗng: đúng mà chẳng khẳng định gì.
 *
 * Cổng này thì khác. Nó đọc thẳng đặc tả và bảng khai nhóm, nên:
 *  · đỏ NGAY nếu ai đưa một ô `required` vào nhóm — kể cả ô thêm về sau;
 *  · đỏ NGAY nếu ai đánh dấu `required` cho một ô đang nằm trong nhóm;
 *  · không phụ thuộc việc `validate.ts` có luật cho ô ấy hay không.
 *
 * Hành vi "tự bung khi có lỗi" vẫn được phủ, ở tầng thành phần:
 * `components/legacy-form/__tests__/nhomOGap.test.tsx` — nơi dựng được một ô lỗi tuỳ ý.
 */
describe('CỔNG: ô bắt buộc không nằm trong nhóm gập', () => {
  /** Mọi ô `required` của đặc tả Đơn thư, theo tab. */
  const oBatBuoc = new Map<string, Set<string>>();
  for (const [tab, items] of Object.entries(PETITION_LEGACY_LAYOUT)) {
    const bb = new Set(
      (items ?? []).filter((it) => it.required === true).map((it) => it.field as string),
    );
    if (bb.size > 0) oBatBuoc.set(tab, bb);
  }

  it('đặc tả CÓ ô bắt buộc để kiểm — cổng chạy trên tập rỗng là cổng vô nghĩa', () => {
    const tong = [...oBatBuoc.values()].reduce((s, x) => s + x.size, 0);
    expect(tong, 'không ô nào required — cổng này không khẳng định được gì').toBeGreaterThan(0);
  });

  it('KHÔNG nhóm nào chứa ô bắt buộc', () => {
    const pham: string[] = [];
    for (const nhom of NHOM_O_DON_THU) {
      // Nhóm không khai `tab` thì áp cho mọi tab — soi hết cho chắc.
      const tabs = nhom.tab ? [nhom.tab as string] : [...oBatBuoc.keys()];
      for (const tab of tabs) {
        for (const o of nhom.o) {
          if (oBatBuoc.get(tab)?.has(o)) {
            pham.push(`nhóm "${nhom.khoa}" (tab ${tab}) chứa ô BẮT BUỘC "${o}"`);
          }
        }
      }
    }
    expect(
      pham,
      'ô bắt buộc nằm trong nhóm gập thì cán bộ bị chặn Lưu bởi một ô không nhìn thấy (PR #248)',
    ).toEqual([]);
  });
});
