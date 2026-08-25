/**
 * hoSoCode.ts — hiển thị mã hồ sơ theo kiểu hệ cũ, và tìm được cả hai dạng.
 *
 * Hệ cũ hiện `26-11171`; hệ mới lưu `2026-11171`. Cùng một con số, khác cách rút gọn năm.
 * Cán bộ đọc quen dạng ngắn, nên MÀN HÌNH hiện dạng ngắn — nhưng dữ liệu trong cơ sở dữ
 * liệu KHÔNG đổi, và ô tìm phải nhận cả hai để người gõ dạng nào cũng ra.
 *
 * Nguyên tắc: chỉ rút gọn thứ CHẮC CHẮN là mã `năm-stt`. Mọi chuỗi khác trả nguyên văn —
 * cắt bừa sẽ tạo ra mã sai mà nhìn vẫn "hợp lệ", loại lỗi khó phát hiện nhất.
 */

/** Năm hồ sơ hợp lý. Ngoài khoảng này gần như chắc chắn là lỗi gõ, đừng rút gọn. */
const NAM_MIN = 1900;
const NAM_MAX = 2100;

/** `2026-11171`, `2025-1-2` — năm bốn chữ số, số thứ tự, hậu tố chống trùng tuỳ chọn. */
const DANG_DAY_DU = /^(\d{4})-(\d+(?:-\d+)*)$/;
/** `26-11171` — năm hai chữ số. */
const DANG_NGAN = /^(\d{2})-(\d+(?:-\d+)*)$/;

/**
 * Năm hai chữ số → bốn chữ số. Hồ sơ hệ cũ bắt đầu từ 2016, nên `99` là 1999 chứ không
 * phải 2099; lấy mốc 50 cho tự nhiên.
 */
function moRongNam(hai: string): number {
  const n = Number(hai);
  return n < 50 ? 2000 + n : 1900 + n;
}

/** Mã để HIỂN THỊ: `2026-11171` → `26-11171`. Chuỗi lạ trả nguyên văn. */
export function formatHoSoCode(ma: string | null | undefined): string {
  if (!ma) return '';
  const m = DANG_DAY_DU.exec(ma.trim());
  if (!m) return ma;
  const nam = Number(m[1]);
  if (nam < NAM_MIN || nam > NAM_MAX) return ma;
  return `${String(nam).slice(2)}-${m[2]}`;
}

/**
 * Các dạng cần thử khi TÌM. Người dùng gõ dạng nào cũng phải ra hồ sơ, vì màn hình hiện
 * dạng ngắn còn cơ sở dữ liệu lưu dạng đầy đủ.
 *
 * Trả về mảng bắt đầu bằng chính chuỗi người dùng gõ; chuỗi không phải mã hồ sơ chỉ trả
 * về chính nó, không bịa thêm biến thể.
 */
export function hoSoCodeVariants(nhapVao: string | null | undefined): string[] {
  const s = (nhapVao ?? '').trim();
  if (!s) return [];

  const day = DANG_DAY_DU.exec(s);
  if (day) {
    const nam = Number(day[1]);
    if (nam < NAM_MIN || nam > NAM_MAX) return [s];
    return [s, `${String(nam).slice(2)}-${day[2]}`];
  }

  const ngan = DANG_NGAN.exec(s);
  if (ngan) return [s, `${moRongNam(ngan[1])}-${ngan[2]}`];

  return [s];
}
