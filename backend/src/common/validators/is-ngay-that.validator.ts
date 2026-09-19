import {
  isISO8601,
  registerDecorator,
  type ValidationOptions,
} from 'class-validator';

/**
 * Chuỗi ngày ISO 8601 là ngày CÓ THẬT trên lịch: hình dạng ISO hợp lệ VÀ phần YYYY-MM-DD (nếu có) tồn tại —
 * 31/02, 29/02 năm không nhuận, 31/04 bị từ chối.
 *
 * KHÔNG dùng `isISO8601(v, { strict: true })`: validator.js ghép lại năm bằng `Number` nên mất số 0 đầu và từ chối oan
 * mọi năm < 1000 (0225-05-12 có trên lịch). Hồ sơ di trú có năm 0225 (9 hồ sơ, #24/08) thì sửa ô nào cũng 400.
 */
export function laNgayThat(v: unknown): boolean {
  if (typeof v !== 'string' || !isISO8601(v)) return false;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  if (!m) return true; // dạng ISO khác (tuần, thứ tự ngày, chỉ năm-tháng) — không có ngày-tháng để kiểm
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = new Date(0);
  t.setUTCFullYear(y, mo - 1, d); // setUTCFullYear giữ đúng năm < 100 (Date.UTC thì cộng 1900)
  return (
    t.getUTCFullYear() === y &&
    t.getUTCMonth() === mo - 1 &&
    t.getUTCDate() === d
  );
}

/**
 * Ô ngày: dùng thay `@IsDateString()` / `@IsISO8601()` ở mọi DTO (cổng `__tests__/is-ngay-that.spec.ts` đỏ khi còn
 * dạng trần). Vì sao: `@IsDateString()` chỉ kiểm HÌNH DẠNG, nhận "1985-02-31"; `new Date` rồi Postgres lặng lẽ đổi
 * thành 03/03/1985 — hồ sơ mang một mốc tố tụng không ai nhập (tồn đọng PR #220, sửa 19/09/2026).
 */
export function IsNgayThat(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'isNgayThat',
      target: target.constructor,
      propertyName: propertyName as string,
      options: {
        message: ({ property }) =>
          `${property}: ngày không có thật hoặc sai định dạng ISO 8601 (vd 31/02 không tồn tại)`,
        ...validationOptions,
      },
      validator: { validate: (v: unknown) => laNgayThat(v) },
    });
  };
}
