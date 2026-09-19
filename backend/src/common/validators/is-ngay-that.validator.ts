import { IsDateString, type ValidationOptions } from 'class-validator';

/**
 * Ô ngày: chuỗi ISO 8601 VÀ là ngày CÓ THẬT — dùng thay `@IsDateString()` ở mọi DTO (cổng
 * `__tests__/is-ngay-that.spec.ts` đỏ khi còn `@IsDateString` trần).
 *
 * Vì sao: `@IsDateString()` mặc định chỉ kiểm HÌNH DẠNG, nhận cả "1985-02-31" / "2023-02-29"; `new Date` rồi Postgres
 * lặng lẽ đổi thành 03/03/1985, hồ sơ mang một mốc tố tụng không ai nhập (tồn đọng PR #220, sửa 19/09/2026).
 * `strict: true` của validator.js kiểm ngày tồn tại (kể cả năm nhuận).
 */
export function IsNgayThat(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return IsDateString(
    { strict: true },
    {
      message: ({ property }) =>
        `${property}: ngày không có thật hoặc sai định dạng (cần YYYY-MM-DD, ví dụ 31/02 không tồn tại)`,
      ...validationOptions,
    },
  );
}
