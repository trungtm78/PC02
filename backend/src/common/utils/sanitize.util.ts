/**
 * Bóc thẻ HTML khỏi chuỗi người dùng nhập.
 *
 * `null` và `undefined` mang HAI ý nghĩa khác hẳn nhau ở lớp DTO, không được gộp làm một:
 *   - `undefined` = lời gọi KHÔNG NHẮC TỚI ô này → lớp dịch vụ giữ nguyên giá trị cũ.
 *   - `null`      = cán bộ đã XOÁ TRẮNG ô này → lớp dịch vụ phải ghi NULL.
 *
 * Trước 26/08/2026 hàm này trả `undefined` cho cả hai. Vì lớp dịch vụ chỉ ghi những khoá
 * `!== undefined`, thao tác xoá bị nuốt ngay tại cổng vào: giao diện gửi đúng, máy chủ trả
 * thành công, mà cột vẫn giữ giá trị cũ. 30 trường của DTO Đơn thư đi qua đây.
 */
export function stripHtmlTags(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return value as any;
  // Strip entire <script> and <style> blocks (including their content) first,
  // then remove remaining HTML tags.
  return value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}
