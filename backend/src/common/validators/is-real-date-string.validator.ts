import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';

/**
 * BUG-005 (UAT epic hợp nhất field, 2026-08-23).
 *
 * `@IsDateString()` chấp nhận "1985-02-31" vì chuỗi đúng định dạng ISO-8601;
 * JavaScript sau đó tự NẮN sang 1985-03-03. Hồ sơ tố tụng khi ấy mang một ngày
 * do máy suy ra chứ không do ai khai — vi phạm nguyên tắc KHÔNG BỊA GIÁ TRỊ mà
 * kế hoạch đã đặt ra cho đường chuẩn hoá dữ liệu (PLAN-B3), nhưng đường NHẬP LIỆU
 * lại chưa được bảo vệ tương đương.
 *
 * Validator này giữ nguyên mọi thứ `@IsDateString()` cho qua, chỉ TỪ CHỐI thêm
 * các ngày không tồn tại trên lịch (31/02, 31/04, 29/02 năm không nhuận…).
 */
@ValidatorConstraint({ name: 'isRealDateString', async: false })
export class IsRealDateStringConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    // Bỏ trống do @IsOptional đảm nhiệm — không phải việc của validator này.
    if (value === null || value === undefined || value === '') return true;
    if (typeof value !== 'string') return false;

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return false;

    // Đối chiếu phần ngày trong CHUỖI GỐC với ngày sau khi phân tích.
    // Lệch nhau nghĩa là đã có hiện tượng nắn ngày.
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) {
      const [, y, mo, d] = m;
      const year = Number(y);
      const month = Number(mo);
      const day = Number(d);
      if (month < 1 || month > 12 || day < 1 || day > 31) return false;
      const probe = new Date(Date.UTC(year, month - 1, day));
      if (
        probe.getUTCFullYear() !== year ||
        probe.getUTCMonth() + 1 !== month ||
        probe.getUTCDate() !== day
      ) {
        return false;
      }
    }
    return true;
  }

  defaultMessage(args: ValidationArguments): string {
    return `${args.property} không phải ngày có thật trên lịch (giá trị gửi lên: "${String(args.value)}")`;
  }
}

/** Như `@IsDateString()` nhưng từ chối thêm ngày không tồn tại trên lịch. */
export function IsRealDateString(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsRealDateStringConstraint,
    });
  };
}
