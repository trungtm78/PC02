import { describe, it, expect } from 'vitest';
import { TINH_TRANG_OPTIONS, optionsGiuGiaTriLa } from '../tinhTrangOptions';

// Cổng chống lệch bảng mã giao diện ↔ máy chủ nằm ở phía máy chủ
// (`backend/src/legacy-migration/ma-o-chon-he-cu.spec.ts`): chỉ ở đó mới đọc được cả hai tệp —
// Vite chặn nhập ngoài thư mục gốc, và tsconfig giao diện không có kiểu của Node.
/**
 * Ô "Tình trạng hồ sơ" ở hệ cũ là `<select>`; ta chép sang thành ô gõ tự do nên nó hiện mã
 * thô `-1` (anh phát hiện ở vụ án 2026-11139, 28/08/2026). Đổi sang ô chọn là phần còn lại
 * của bản vá: không đổi thì cán bộ lại gõ chữ tự do và cột lại lẫn số với chữ.
 */
describe('Danh sách lựa chọn Tình trạng hồ sơ', () => {
  it('mỗi thực thể có danh sách riêng và không rỗng', () => {
    for (const k of ['DON_THU', 'VU_VIEC', 'VU_AN'] as const) {
      expect(TINH_TRANG_OPTIONS[k].length).toBeGreaterThan(0);
    }
  });

  /** Mã trùng số nhưng khác nghĩa — dùng nhầm bảng là hiện sai trạng thái của hồ sơ. */
  it('cùng mã `0` mang nghĩa khác nhau giữa vụ án và vụ việc', () => {
    const vuAn = TINH_TRANG_OPTIONS.VU_AN.find((o) => o.value === '0');
    const vuViec = TINH_TRANG_OPTIONS.VU_VIEC.find((o) => o.value === '0');
    expect(vuAn?.label).toBe('Vụ án đang điều tra');
    expect(vuViec?.label).toBe('Vụ việc đang xác minh');
  });

  /** `-1` là mã canh "chưa chọn" — nó phải là Ô TRỐNG, không phải một lựa chọn bấm được. */
  it('KHÔNG có lựa chọn `-1` trong danh sách', () => {
    for (const k of ['DON_THU', 'VU_VIEC', 'VU_AN'] as const) {
      expect(TINH_TRANG_OPTIONS[k].some((o) => o.value === '-1')).toBe(false);
    }
  });

  /** `-2` ngược lại LÀ lựa chọn thật, phải bấm chọn được. */
  it('có lựa chọn `-2` "Chưa rõ"', () => {
    expect(TINH_TRANG_OPTIONS.VU_AN.find((o) => o.value === '-2')?.label).toBe('Chưa rõ');
  });

});

/**
 * 118 vụ việc mang chữ thật ("Tạm đình chỉ theo Điều 134") KHÔNG nằm trong 15 lựa chọn. Ô
 * chọn thường sẽ hiện trống cho những hồ sơ ấy, và lần lưu kế tiếp là mất hẳn chữ — cán bộ
 * không hề biết mình vừa xoá gì. Đây là bẫy đã ghi ở `reference_o_rong_phai_gui_null`.
 */
describe('Giữ giá trị ngoài danh sách', () => {
  const DS = [
    { value: '0', label: 'Vụ việc đang xác minh' },
    { value: '3', label: 'Vụ việc Tạm đình chỉ' },
  ];

  it('giá trị lạ được chèn thành một lựa chọn để không mất khi lưu', () => {
    const ra = optionsGiuGiaTriLa(DS, 'Tạm đình chỉ theo Điều 134');
    expect(ra.some((o) => o.value === 'Tạm đình chỉ theo Điều 134')).toBe(true);
    expect(ra).toHaveLength(3);
  });

  it('giá trị đã có trong danh sách thì không nhân đôi', () => {
    expect(optionsGiuGiaTriLa(DS, '0')).toHaveLength(2);
  });

  it('rỗng thì giữ nguyên danh sách', () => {
    expect(optionsGiuGiaTriLa(DS, '')).toHaveLength(2);
    expect(optionsGiuGiaTriLa(DS, null)).toHaveLength(2);
  });

  /** Nhãn của giá trị lạ là chính nó — bịa nhãn khác là che mất thứ đang nằm trong cơ sở dữ liệu. */
  it('nhãn của giá trị lạ chính là giá trị ấy', () => {
    const ra = optionsGiuGiaTriLa(DS, '99');
    expect(ra.find((o) => o.value === '99')?.label).toBe('99');
  });

  it('không sửa mảng gốc', () => {
    optionsGiuGiaTriLa(DS, 'la');
    expect(DS).toHaveLength(2);
  });
});
