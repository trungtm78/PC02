import { describe, expect, it } from 'vitest';
import { kiemNhomLienNhau } from '@/components/legacy-form/kiemNhomLienNhau';
import { NHOM_O_DON_THU } from '../nhom-o.def';
import { PETITION_LEGACY_LAYOUT } from '../legacy-form-binding';

/**
 * CỔNG: bảng khai nhóm của Đơn thư phải hợp lệ với BỐ CỤC THẬT.
 *
 * Hai kiểu hỏng im lặng mà cổng này chặn:
 *  1. Gõ nhầm tên ô → nhóm rỗng lặng lẽ, ô vẫn hiện ngoài nhóm và không ai biết sai.
 *  2. Gom một tập ô RỜI → ô xen giữa buộc phải dời chỗ, và thẻ nhóm chiếm trọn bề ngang làm
 *     lệch cột của mọi ô phía sau. Cổng `moiOCoChoLuu` không bắt được: nó so mảng nhãn/span
 *     của ĐẶC TẢ, không soi DOM đã dựng.
 */
describe('Nhóm ô Đơn thư khớp bố cục thật', () => {
  it('có khai nhóm, và mỗi nhóm nói rõ thuộc tab nào', () => {
    // Không khai tab thì nhóm âm thầm không áp ở đâu cả, mà cổng vẫn xanh.
    expect(NHOM_O_DON_THU.length).toBeGreaterThan(0);
    for (const n of NHOM_O_DON_THU) {
      expect(n.tab, `nhóm "${n.khoa}" thiếu khai tab`).toBeTruthy();
      expect(Object.keys(PETITION_LEGACY_LAYOUT)).toContain(n.tab);
    }
  });

  it('mọi nhóm đều hợp lệ trên tab của nó', () => {
    const loi = Object.entries(PETITION_LEGACY_LAYOUT).flatMap(([tab, items]) => {
      const cuaTab = NHOM_O_DON_THU.filter((n) => n.tab === tab);
      return cuaTab.length ? kiemNhomLienNhau(items, cuaTab) : [];
    });
    expect(loi).toEqual([]);
  });
});
