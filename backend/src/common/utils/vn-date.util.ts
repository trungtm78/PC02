/**
 * vn-date.util.ts — BUG-009 (UAT epic hợp nhất field, 2026-08-23).
 *
 * PLAN-B1 quy ước: các cột NGÀY của hồ sơ là **date-only, lưu 00:00 giờ Việt Nam**
 * để tránh lệch một ngày.
 *
 * Ứng dụng gửi dạng `YYYY-MM-DD` nên `new Date(...)` cho kết quả đúng. Nhưng khi một
 * hệ tích hợp gửi mốc thời gian đầy đủ kèm lệch giờ — `2026-01-01T00:00:00+07:00` —
 * thì `new Date(...)` giữ mốc UTC (2025-12-31T17:00Z) và cột `timestamp without time
 * zone` lưu thành **31/12/2025**: sai ngày lịch, sai mốc tố tụng.
 *
 * Hàm này lấy NGÀY LỊCH theo giờ Việt Nam của giá trị đầu vào rồi trả về đúng 00:00
 * của ngày đó, để cột luôn giữ đúng ngày người dùng định nói.
 */
const VN_OFFSET_MINUTES = 7 * 60;

/**
 * Chuẩn hoá giá trị ngày về 00:00 của ngày lịch theo giờ Việt Nam.
 * Trả `null` khi đầu vào rỗng; trả `null` khi không phân tích được (không bịa giá trị).
 */
export function toVnDateOnly(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;

  // Chuỗi chỉ có ngày: đã là ngày lịch, không cần đổi múi giờ.
  if (typeof value === 'string') {
    const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnly) {
      const [, y, m, d] = dateOnly;
      return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
    }
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  // Dịch mốc sang giờ Việt Nam rồi lấy phần ngày.
  const vn = new Date(parsed.getTime() + VN_OFFSET_MINUTES * 60_000);
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()));
}
