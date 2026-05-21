import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { LoaiNguonTin, NguonPhatTin } from '@prisma/client';

/**
 * Cascading map: which NguonPhatTin values are valid for each LoaiNguonTin.
 *
 * MUST stay in sync with frontend mirror at
 * `frontend/src/shared/enums/status-labels.ts` → `NGUON_PHAT_TIN_BY_LOAI`.
 * Two-side test coverage (BE validator spec + FE cascading test) catches drift.
 *
 * Source of law: Điều 144 BLTTHS 2015 — chủ thể của tố giác / tin báo / kiến nghị khởi tố.
 */
const NGUON_PHAT_TIN_BY_LOAI: Record<LoaiNguonTin, NguonPhatTin[]> = {
  TO_GIAC: ['CA_NHAN_TO_GIAC'],
  TIN_BAO: ['CO_QUAN_NHA_NUOC', 'TO_CHUC', 'CA_NHAN_BAO_TIN', 'PHUONG_TIEN_TRUYEN_THONG'],
  KIEN_NGHI_KHOI_TO: ['VIEN_KIEM_SAT', 'THANH_TRA', 'KIEM_TOAN', 'TOA_AN', 'CO_QUAN_KHAC'],
};

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
          const allowed = NGUON_PHAT_TIN_BY_LOAI[loaiDonVu as LoaiNguonTin] ?? [];
          return allowed.includes(value as NguonPhatTin);
        },
        defaultMessage(args: ValidationArguments) {
          const sibling = args.object as { loaiDonVu?: LoaiNguonTin | string | null };
          return `nguonPhatTin "${args.value}" không hợp lệ với loaiDonVu "${sibling.loaiDonVu}" (Đ.144 BLTTHS 2015)`;
        },
      },
    });
  };
}
