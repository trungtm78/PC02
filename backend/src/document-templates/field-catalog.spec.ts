import {
  resolveField,
  assertFieldInCatalog,
  listCatalog,
  catalogKeys,
  FIELD_CATALOG,
} from './field-catalog';
import { BadRequestException } from '@nestjs/common';

describe('field-catalog', () => {
  describe('resolveField — VU_AN (giữ hành vi caseMap cũ)', () => {
    it('soVuAn ← caseCode', () => {
      expect(resolveField('VU_AN', 'soVuAn', { caseCode: 'VA-01' })).toBe('VA-01');
    });
    it('dieuTraVien ← investigator, ghép HỌ TRƯỚC TÊN SAU', () => {
      // Dữ liệu mẫu cũ đặt "Nguyễn" (một HỌ) vào `firstName` và mong đợi "Nguyễn An" — nó mã
      // hoá đúng cái quy ước sai đã sinh ra lỗi anh báo 25/08/2026. Nay dùng dữ liệu đúng
      // như cơ sở dữ liệu thật lưu: `lastName` = họ và tên đệm, `firstName` = tên gọi.
      expect(
        resolveField('VU_AN', 'dieuTraVien', {
          investigator: { firstName: 'An', lastName: 'Nguyễn Văn' },
        }),
      ).toBe('Nguyễn Văn An');
    });
    it('donVi ← unitRef.name', () => {
      expect(resolveField('VU_AN', 'donVi', { unitRef: { name: 'PC02' } })).toBe('PC02');
    });
  });

  describe('resolveField — VU_VIEC (giữ hành vi incidentMap cũ)', () => {
    it('soVuViec ← code', () => {
      expect(resolveField('VU_VIEC', 'soVuViec', { code: 'VV-09' })).toBe('VV-09');
    });
    it('nguonTin ← nhãn tiếng Việt của enum NguonPhatTin', () => {
      expect(resolveField('VU_VIEC', 'nguonTin', { nguonPhatTin: 'CA_NHAN_TO_GIAC' })).toBe(
        'Cá nhân tố giác',
      );
    });
  });

  describe('resolveField — DON_THU', () => {
    it('ghiTen ← senderName', () => {
      expect(resolveField('DON_THU', 'ghiTen', { senderName: 'Trần Bình' })).toBe('Trần Bình');
    });
    it('noiDung computed = detailContent || summary', () => {
      expect(resolveField('DON_THU', 'noiDung', { detailContent: '', summary: 'tóm tắt' })).toBe(
        'tóm tắt',
      );
      expect(resolveField('DON_THU', 'noiDung', { detailContent: 'chi tiết' })).toBe('chi tiết');
    });
    it('baoCaoBGD computed Có/Không', () => {
      expect(resolveField('DON_THU', 'baoCaoBGD', { baoCaoBanGiamDoc: true })).toBe('Có');
      expect(resolveField('DON_THU', 'baoCaoBGD', { baoCaoBanGiamDoc: false })).toBe('Không');
    });
  });

  it('field không tồn tại → chuỗi rỗng', () => {
    expect(resolveField('VU_AN', 'khongCo', {})).toBe('');
  });

  describe('assertFieldInCatalog (whitelist — bảo mật)', () => {
    it('field hợp lệ → không throw', () => {
      expect(() => assertFieldInCatalog('DON_THU', 'ghiTen')).not.toThrow();
    });
    it('field ngoài catalog → BadRequestException', () => {
      expect(() => assertFieldInCatalog('DON_THU', '__proto__')).toThrow(BadRequestException);
      expect(() => assertFieldInCatalog('VU_AN', 'hack')).toThrow(BadRequestException);
    });
  });

  it('listCatalog trả {key,label,group} — KHÔNG kèm resolve', () => {
    const list = listCatalog('VU_AN');
    expect(list.length).toBeGreaterThan(0);
    for (const item of list) {
      expect(item).toEqual({
        key: expect.any(String),
        label: expect.any(String),
        group: expect.any(String),
      });
    }
  });

  it('catalogKeys gồm soVanBan (số cấp khi in)', () => {
    expect(catalogKeys('VU_AN')).toContain('soVanBan');
    expect(catalogKeys('DON_THU')).toContain('soVanBan');
  });

  it('FIELD_CATALOG có đủ 3 entityType', () => {
    expect(Object.keys(FIELD_CATALOG).sort()).toEqual(['DON_THU', 'VU_AN', 'VU_VIEC']);
  });
});
