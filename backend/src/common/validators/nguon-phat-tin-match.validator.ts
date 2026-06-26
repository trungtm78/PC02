import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { LoaiNguonTin } from '@prisma/client';
import { CATALOG_REGISTRY } from '../../catalog/catalog.registry';

/**
 * Cascading map: which NguonPhatTin values are valid for each LoaiNguonTin.
 *
 * NGUỒN DUY NHẤT là Catalog Registry `NGUON_PHAT_TIN.cascade.map` (Đ.144 BLTTHS 2015 —
 * chủ thể của tố giác / tin báo / kiến nghị khởi tố). FE đọc CÙNG map qua catalog.generated
 * (getNguonPhatTinOptions) → không còn 2 mirror tự đồng bộ (trước đây dễ drift).
 */
function allowedNguonPhatTin(loaiDonVu: string): string[] {
  const e = CATALOG_REGISTRY['NGUON_PHAT_TIN'];
  const map = e && 'cascade' in e ? e.cascade?.map : undefined;
  return map?.[loaiDonVu] ?? [];
}

/**
 * Validates that `nguonPhatTin` (the decorated property) belongs to the cascading
 * group of `loaiDonVu` (sibling property on the same DTO).
 *
 * Skip rules:
 *   - nguonPhatTin undefined/null/"" → pass (field is optional)
 *   - loaiDonVu undefined → pass (UI cascading guards client-side; allow stale UpdateDto)
 *
 * Rejects: (loaiDonVu = TIN_BAO, nguonPhatTin = VIEN_KIEM_SAT) and similar mismatches.
 */
export function IsNguonPhatTinMatchLoaiDonVu(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isNguonPhatTinMatchLoaiDonVu',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (value === undefined || value === null || value === '') return true;
          const sibling = args.object as { loaiDonVu?: LoaiNguonTin | string | null };
          const loaiDonVu = sibling.loaiDonVu;
          if (!loaiDonVu) return true;
          return allowedNguonPhatTin(String(loaiDonVu)).includes(String(value));
        },
        defaultMessage(args: ValidationArguments) {
          const sibling = args.object as { loaiDonVu?: LoaiNguonTin | string | null };
          return `nguonPhatTin "${args.value}" không hợp lệ với loaiDonVu "${sibling.loaiDonVu}" (Đ.144 BLTTHS 2015)`;
        },
      },
    });
  };
}
