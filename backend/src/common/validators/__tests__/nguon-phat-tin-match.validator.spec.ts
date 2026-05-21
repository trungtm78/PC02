/**
 * Unit test for @IsNguonPhatTinMatchLoaiDonVu() custom validator.
 *
 * Defense in depth (v0.31.0.0 Issue 1A): BE rejects mismatched
 * (loaiDonVu, nguonPhatTin) pairs even when UI cascading is bypassed
 * (direct API call via curl/Postman).
 */
import 'reflect-metadata';
import { validate } from 'class-validator';
import { IsNguonPhatTinMatchLoaiDonVu } from '../nguon-phat-tin-match.validator';

class Dto {
  loaiDonVu?: string;

  @IsNguonPhatTinMatchLoaiDonVu()
  nguonPhatTin?: string;

  constructor(loaiDonVu: string | undefined, nguonPhatTin: string | undefined) {
    this.loaiDonVu = loaiDonVu;
    this.nguonPhatTin = nguonPhatTin;
  }
}

describe('IsNguonPhatTinMatchLoaiDonVu', () => {
  describe('happy paths (matching)', () => {
    it('accepts TO_GIAC + CA_NHAN_TO_GIAC (Đ.144 K1)', async () => {
      const errors = await validate(new Dto('TO_GIAC', 'CA_NHAN_TO_GIAC'));
      expect(errors).toHaveLength(0);
    });

    it('accepts TIN_BAO + TO_CHUC (Đ.144 K2)', async () => {
      const errors = await validate(new Dto('TIN_BAO', 'TO_CHUC'));
      expect(errors).toHaveLength(0);
    });

    it('accepts TIN_BAO + PHUONG_TIEN_TRUYEN_THONG (Đ.144 K2)', async () => {
      const errors = await validate(new Dto('TIN_BAO', 'PHUONG_TIEN_TRUYEN_THONG'));
      expect(errors).toHaveLength(0);
    });

    it('accepts KIEN_NGHI_KHOI_TO + VIEN_KIEM_SAT (Đ.144 K3)', async () => {
      const errors = await validate(new Dto('KIEN_NGHI_KHOI_TO', 'VIEN_KIEM_SAT'));
      expect(errors).toHaveLength(0);
    });
  });

  describe('mismatch paths (rejected)', () => {
    it('rejects TIN_BAO + VIEN_KIEM_SAT (KIEN_NGHI group leaked into TIN_BAO)', async () => {
      const errors = await validate(new Dto('TIN_BAO', 'VIEN_KIEM_SAT'));
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('nguonPhatTin');
      expect(errors[0].constraints?.isNguonPhatTinMatchLoaiDonVu).toMatch(/không hợp lệ/);
    });

    it('rejects TO_GIAC + CO_QUAN_NHA_NUOC (TIN_BAO group leaked into TO_GIAC)', async () => {
      const errors = await validate(new Dto('TO_GIAC', 'CO_QUAN_NHA_NUOC'));
      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('nguonPhatTin');
    });

    it('rejects KIEN_NGHI_KHOI_TO + TO_CHUC (TIN_BAO group leaked into KIEN_NGHI)', async () => {
      const errors = await validate(new Dto('KIEN_NGHI_KHOI_TO', 'TO_CHUC'));
      expect(errors).toHaveLength(1);
    });
  });

  describe('skip paths (no validation)', () => {
    it('accepts when nguonPhatTin is undefined', async () => {
      const errors = await validate(new Dto('TIN_BAO', undefined));
      expect(errors).toHaveLength(0);
    });

    it('accepts when nguonPhatTin is empty string', async () => {
      const errors = await validate(new Dto('TIN_BAO', ''));
      expect(errors).toHaveLength(0);
    });

    it('accepts when loaiDonVu is undefined (UI cascading guards client-side)', async () => {
      const errors = await validate(new Dto(undefined, 'TO_CHUC'));
      expect(errors).toHaveLength(0);
    });
  });
});
