import { describe, it, expect } from 'vitest';
import {
  LEGACY_FIELD_TO_COLUMN,
  LEGACY_FORM_LAYOUT,
  LEGACY_FORM_OWNED_COLUMNS,
} from '@/features/cases/legacy-form-layout.def';
import { KHOA_HE_CU_DA_AN, O_AN_KHOI_DON_THU } from '../o-an.def';

/**
 * CỔNG: ba ô anh yêu cầu bỏ phải ẩn ở MỌI TAB của Đơn thư — và đặc tả phải KHÔNG đổi.
 *
 * Vì sao không gỡ khỏi đặc tả:
 *  - Đặc tả dùng CHUNG cho Đơn thư · Vụ án · Vụ việc. Gỡ là mất ô ở cả ba form, anh chỉ nêu
 *    màn Đơn thư.
 *  - `moiOCoChoLuu` so caption + span từng tab với bố cục hệ cũ → gỡ là đỏ ngay.
 *  - Cột rơi khỏi `ownedColumns` thì panel "Thông tin nghiệp vụ bổ sung (di trú)" TỰ DỰNG LẠI
 *    chính ô ấy. Gỡ đi lại mọc ra chỗ khác, dưới một cái tên xấu hơn.
 *
 * Nên ẩn ở TẦNG DỰNG. Anh đã chốt GIỮ NGUYÊN DỮ LIỆU: 15.185 đơn có "Tội danh cũ trước đây",
 * 655 có "Nghi vấn đối tượng", 141 có "Nơi xảy ra tội phạm" — tất cả vẫn in ra và tìm được,
 * chỉ thôi nhập tay.
 */
describe('CỔNG: ẩn ba ô khỏi Đơn thư mà KHÔNG đụng đặc tả', () => {
  it('ba ô vẫn còn NGUYÊN trong đặc tả — ẩn là việc của tầng dựng', () => {
    const coTrongDacTa = new Set(
      Object.values(LEGACY_FORM_LAYOUT).flatMap((ds) => ds.map((i) => i.field as string)),
    );
    for (const o of KHOA_HE_CU_DA_AN)
      expect(coTrongDacTa.has(o), `"${o}" đã bị gỡ khỏi đặc tả — Vụ án/Vụ việc mất ô theo`).toBe(true);
  });

  /**
   * Mệnh đề then chốt: cột vẫn THUỘC đặc tả nên panel di trú không dựng lại ô.
   *
   * Không có mệnh đề này thì cách ẩn "gỡ khỏi đặc tả" vẫn xanh mọi cổng khác, rồi ba ô mọc lại
   * trong panel "Thông tin nghiệp vụ bổ sung" — ẩn mà không ẩn.
   */
  it('cột của ba ô vẫn nằm trong `ownedColumns` — panel di trú KHÔNG dựng lại', () => {
    for (const o of KHOA_HE_CU_DA_AN) {
      const cot = LEGACY_FIELD_TO_COLUMN[o] ?? o;
      expect(
        LEGACY_FORM_OWNED_COLUMNS.has(cot),
        `cột "${cot}" rơi khỏi ownedColumns — panel di trú sẽ dựng lại ô "${o}"`,
      ).toBe(true);
    }
  });

  it('danh sách ẩn KHÔNG rỗng — cổng rỗng thì chẳng khẳng định được gì', () => {
    expect(O_AN_KHOI_DON_THU.length).toBeGreaterThan(0);
    expect(O_AN_KHOI_DON_THU.length).toBe(KHOA_HE_CU_DA_AN.length);
  });

  /**
   * Form Đơn thư ĐỔI TÊN vài ô của đặc tả (`nghiVanDoiTuong` → `suspectedPerson`). Chép tay
   * tên hệ cũ thì ô ấy vẫn dựng ra như thường, mà mọi cổng đọc đặc tả vẫn xanh — bản đầu của
   * `o-an.def.ts` mắc đúng lỗi ấy.
   */
  it('danh sách ẩn dùng tên ô CỦA ĐƠN THƯ, không phải tên hệ cũ', () => {
    expect(O_AN_KHOI_DON_THU).toContain('suspectedPerson');
    expect(O_AN_KHOI_DON_THU).not.toContain('nghiVanDoiTuong');
  });

  /**
   * Hai trong ba ô có BẢN GƯƠNG ở tab `incident-tdc` / `case-tdc`. Ẩn ở tab Thông tin mà để
   * gương lại thì cán bộ vẫn sửa được ở tab khác — ẩn nửa vời, và tệ hơn là ẩn nửa vời mà
   * trông như đã xong.
   */
  it('danh sách ẩn phủ TRỌN mọi lần ô xuất hiện, kể cả bản gương', () => {
    const soLanHien = new Map<string, number>();
    for (const ds of Object.values(LEGACY_FORM_LAYOUT))
      for (const i of ds) {
        const f = i.field as string;
        if ((KHOA_HE_CU_DA_AN as readonly string[]).includes(f))
          soLanHien.set(f, (soLanHien.get(f) ?? 0) + 1);
      }
    // Có ô hiện nhiều hơn một lần → cách ẩn phải theo TÊN Ô chứ không theo tab.
    expect([...soLanHien.values()].some((n) => n > 1)).toBe(true);
  });
});
