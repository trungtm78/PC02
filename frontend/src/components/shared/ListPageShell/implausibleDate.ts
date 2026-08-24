/**
 * Khoảng năm coi là hợp lý cho một mốc thời gian nghiệp vụ.
 *
 * PHẢI KHỚP với biểu thức của cột sinh `petitions.sortReceivedDate`
 * (migration 20260824120000). Lệch nhau thì hồ sơ bị đẩy xuống cuối danh sách mà KHÔNG
 * được đánh dấu, và cán bộ không hiểu vì sao nó nằm dưới cùng — tệ hơn cả không làm gì.
 * Có ca kiểm ở backend chốt hai bên dùng cùng cặp mốc này.
 */
export const PLAUSIBLE_MIN_YEAR = 1900;
export const PLAUSIBLE_MAX_YEAR = 2100;

/**
 * Ngày có thật trên lịch nhưng phi lý với hồ sơ tố tụng — vd năm 3023, 2925, 0225.
 * Đợt di trú để lọt 9 hồ sơ như vậy; bộ kiểm `IsRealDateString` chặn được ngày không
 * tồn tại (31/02) nhưng không chặn ngày có thật mà vô lý.
 */
export function isImplausibleDate(value?: string | null): boolean {
  if (!value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  // getUTCFullYear, KHÔNG phải getFullYear: cột sinh ở CSDL so sánh
  // `timestamp without time zone` với mốc 1900/2100, còn trình duyệt ở Việt Nam là
  // UTC+7. Dùng giờ địa phương thì một hồ sơ lưu 2099-12-31T18:00 sẽ hợp lệ với CSDL
  // (sắp bình thường) nhưng bị trình duyệt đọc thành năm 2100 và gắn cờ cảnh báo —
  // đúng kiểu lệch mà chú thích trên cảnh báo phải tránh.
  const y = d.getUTCFullYear();
  return y < PLAUSIBLE_MIN_YEAR || y >= PLAUSIBLE_MAX_YEAR;
}
