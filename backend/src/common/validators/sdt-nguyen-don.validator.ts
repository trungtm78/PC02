import {
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions,
} from 'class-validator';
import { laNguonTrucTiep } from '../utils/nguon-don.util';

/** Định dạng số điện thoại nguyên đơn — giữ nguyên luật cũ, chỉ đổi phần BẮT BUỘC. */
const DINH_DANG = /^[0-9\s+-]*$/;
const DAI_TOI_DA = 20;

interface HoSoCoNguon {
  senderIsAnonymous?: boolean;
  nguonDon?: string | null;
}

/**
 * Số điện thoại nguyên đơn: BẮT BUỘC khi nguồn đơn là nộp trực tiếp, còn lại thì không —
 * nhưng ĐỊNH DẠNG thì áp cho mọi nguồn.
 *
 * Vì sao là một validator riêng chứ không phải `@ValidateIf` + `@IsNotEmpty`:
 * `@ValidateIf` gắn điều kiện cho CẢ Ô, nên khi điều kiện sai thì class-validator bỏ qua
 * TOÀN BỘ validator của ô ấy — kể cả `@Matches`. Đo được: nguồn "Bưu điện" + số "abc" đi lọt
 * thẳng xuống cột. Nới "bắt buộc" không được phép nới luôn "hợp lệ".
 *
 * `laNguonTrucTiep` là hàm THUẦN nên chạy đồng bộ ngay trong validator, và trình duyệt gọi
 * đúng hàm ấy — một luật, một bản cài đặt, hai đầu không lệch nhau.
 */
export function SdtNguyenDonHopLe(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target: object, propertyName: string | symbol) => {
    registerDecorator({
      name: 'sdtNguyenDonHopLe',
      target: target.constructor,
      propertyName: propertyName as string,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          const o = args.object as HoSoCoNguon;
          const chuoi = typeof value === 'string' ? value.trim() : '';

          if (!chuoi) {
            // Rỗng chỉ sai khi người nộp đứng trước mặt (và không phải đơn nặc danh).
            return o.senderIsAnonymous === true || !laNguonTrucTiep(o.nguonDon);
          }
          if (typeof value !== 'string') return false;
          return value.length <= DAI_TOI_DA && DINH_DANG.test(value);
        },
        defaultMessage(args: ValidationArguments) {
          const chuoi = typeof args.value === 'string' ? args.value.trim() : '';
          if (!chuoi) {
            return 'Số điện thoại nguyên đơn là bắt buộc khi nguồn đơn là nộp trực tiếp';
          }
          return 'Số điện thoại không hợp lệ';
        },
      },
    });
  };
}
