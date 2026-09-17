import { docThe, dungDieuKienTimKiem } from './dieu-kien';
import { KHAI_TIM_KIEM_VU_AN } from './khai/vu-an.khai';

/**
 * Giá trị bỏ dấu xong thành chuỗi RỖNG (vd chỉ gồm dấu tổ hợp U+0301 — dán lệch từ bộ gõ). Bản đầu trả
 * `[]`: điều kiện biến mất và danh sách trả MỌI dòng mà trông như đã lọc — trái chính nguyên tắc của
 * `docThe` ("bỏ qua là trả dữ liệu chưa lọc mà trông như đã lọc"). Nay so nguyên chữ trên CỘT GỐC:
 * không khớp-tất-cả trên cột bóng, cũng không âm thầm bỏ lọc.
 *
 * (Ký tự như `#` KHÔNG thuộc loại này — bỏ dấu giữ nguyên nên vẫn tìm trên cột bóng.)
 */
const K = KHAI_TIM_KIEM_VU_AN;
const DAU = String.fromCharCode(0x301);
const dk = (tk: string[], luiCotGoc: boolean) =>
  dungDieuKienTimKiem(docThe(tk, K), K, { luiCotGoc });

describe('tìm kiếm — giá trị bỏ dấu xong rỗng KHÔNG được bỏ lọc', () => {
  it.each([
    ['chu', `nguoiGui~${DAU}`],
    ['tất cả các cột', `*~${DAU}`],
    ['nguoi', `nguoiNhap~${DAU}`],
    ['doi-tuong', `doiTuongBiCan~${DAU}`],
  ])('%s: vẫn có điều kiện, so nguyên chữ trên cột gốc', (_kieu, the) => {
    for (const luiCotGoc of [true, false]) {
      const ra = dk([the], luiCotGoc);
      expect(ra).toHaveLength(1);
      const json = JSON.stringify(ra);
      expect(json).toContain(`"contains":"${DAU}","mode":"insensitive"`);
      // Không so trên cột bóng: mẫu rỗng ở đó khớp mọi dòng.
      expect(json).not.toMatch(/Bd":\{"contains"/);
    }
  });

  // 17/09/2026: mẫu không còn khoảng trắng đầu (chuỗi 1–2 ký tự nay khớp CHUỖI CON, không chỉ đầu từ).
  it('`#` vẫn tìm trên cột bóng (bỏ dấu giữ nguyên ký tự)', () => {
    expect(JSON.stringify(dk(['nguoiGui~#'], false))).toContain(
      '"tenCungCapBd":{"contains":"#"}',
    );
  });
});
