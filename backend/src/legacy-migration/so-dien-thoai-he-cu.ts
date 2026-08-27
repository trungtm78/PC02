/**
 * Đọc ô số điện thoại của hệ cũ.
 *
 * Hệ cũ để cán bộ gõ tự do, nên ô này chứa ba loại thứ khác hẳn nhau — đo trên 46.660 đơn thư
 * ngày 27/08/2026:
 *
 *   - 2.679 số đúng dạng.
 *   - 91 số đúng nhưng có dấu phân cách ("0912 345 678").
 *   - 4.693 hồ sơ mang KÝ HIỆU "không có": `...` (3.110), `0000` (388), `..`, `Không`, `,`, `0`.
 *
 * Nhóm thứ ba không phải số điện thoại sai — nó là cách hệ cũ viết "để trống", cùng một lớp
 * với hai mốc rỗng `"0"`/`"-25200"` của ô ngày và số `0` bịa của ô thiệt hại. Giữ nguyên thì
 * hồ sơ di trú mở ra bị chặn Lưu bởi một ô mà cán bộ không có gì để sửa cho đúng.
 *
 * Nguyên tắc: chỉ kết luận "không có" khi KHÔNG THỂ là số. Chuỗi còn đủ chữ số để là một số
 * điện thoại thì giữ nguyên — thà để cán bộ tự sửa còn hơn xoá mất một số thật.
 */

/** Số hợp lệ của hệ mới: 0 và 9 chữ số nữa. */
const DUNG_DANG = /^0[0-9]{9}$/;

/** Chuỗi chỉ gồm chữ số và dấu phân cách — bỏ dấu đi không mất thông tin nào. */
const CHI_DAU_PHAN_CACH = /^[0-9\s.\-()]+$/;

/** Chữ số ít nhất mà một số điện thoại Việt Nam có thể có (máy bàn rút gọn). */
const IT_NHAT_CHU_SO = 9;

export type KetQuaDoc =
  | { loai: 'giu-nguyen' }
  | { loai: 'chuan-hoa'; giaTri: string }
  | { loai: 'khong-co' }
  | { loai: 'khong-doan-duoc' };

export function docSoDienThoaiHeCu(raw: string | null | undefined): KetQuaDoc {
  const v = (raw ?? '').trim();
  if (v === '') return { loai: 'khong-co' };
  if (DUNG_DANG.test(v)) return { loai: 'giu-nguyen' };

  const chuSo = v.replace(/[^0-9]/g, '');
  // Chỉ chuẩn hoá khi thứ bỏ đi THUẦN DẤU PHÂN CÁCH. "0912345678 (nhà riêng)" cũng ra đúng
  // mười chữ số, nhưng bóc luôn chữ "nhà riêng" là lặng lẽ vứt một mẩu thông tin cán bộ đã gõ.
  if (DUNG_DANG.test(chuSo) && CHI_DAU_PHAN_CACH.test(v)) {
    return { loai: 'chuan-hoa', giaTri: chuSo };
  }

  // Không đủ chữ số, hoặc toàn số 0 → không thể là số điện thoại.
  if (chuSo.length < IT_NHAT_CHU_SO) return { loai: 'khong-co' };
  if (/^0+$/.test(chuSo)) return { loai: 'khong-co' };

  // Đủ chữ số nhưng không khớp dạng: có thể là số nước ngoài, hai số viết liền, hoặc số kèm
  // ghi chú. Không đoán — để cán bộ tự sửa.
  return { loai: 'khong-doan-duoc' };
}
