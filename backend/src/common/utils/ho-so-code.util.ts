/**
 * ho-so-code.util.ts — mã hồ sơ tồn tại ở HAI dạng, tìm kiếm phải nhận cả hai.
 *
 * Hệ cũ hiển thị `26-11171`, hệ mới lưu `2026-11171`. Cùng một con số. Cán bộ đọc quen dạng
 * ngắn nên sẽ gõ dạng ngắn vào ô tìm, trong khi cơ sở dữ liệu chứa dạng đầy đủ.
 *
 * VÌ SAO ĐẶT Ở MÁY CHỦ chứ không ở trình duyệt: tìm kiếm đúng không được phụ thuộc việc
 * trình duyệt liệt kê đủ các dạng. Ứng dụng di động, lệnh gọi API trực tiếp, hay một bản
 * giao diện cũ chưa cập nhật đều phải tìm ra hồ sơ.
 *
 * Nguyên tắc: chỉ sinh biến thể cho thứ CHẮC CHẮN là mã `năm-stt`. Chuỗi khác trả về chính
 * nó — sinh biến thể bừa sẽ tìm nhầm sang hồ sơ khác.
 */

/** Năm hồ sơ hợp lý. Ngoài khoảng này gần như chắc chắn là lỗi gõ (đã gặp năm 3023). */
const NAM_MIN = 1900;
const NAM_MAX = 2100;

/** `2026-11171`, `2025-1-2` — năm bốn chữ số, số thứ tự, hậu tố chống trùng tuỳ chọn. */
const DANG_DAY_DU = /^(\d{4})-(\d+(?:-\d+)*)$/;
/** `26-11171` — năm hai chữ số. */
const DANG_NGAN = /^(\d{2})-(\d+(?:-\d+)*)$/;

/** Năm hai chữ số → bốn chữ số. Hồ sơ hệ cũ bắt đầu từ 2016 nên `99` là 1999. */
function moRongNam(hai: string): number {
  const n = Number(hai);
  return n < 50 ? 2000 + n : 1900 + n;
}

/**
 * Các dạng cần thử khi tìm theo mã hồ sơ.
 *
 * Trả về mảng bắt đầu bằng đúng chuỗi người dùng gõ, kèm dạng còn lại nếu suy ra được.
 * Mảng rỗng khi đầu vào rỗng — nơi gọi hiểu là "không lọc theo mã".
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
