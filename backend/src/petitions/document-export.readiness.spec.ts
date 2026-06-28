/**
 * Test hàm thuần getMissingFieldsForDocType (nguồn sự thật cho export-readiness + validate khi xuất).
 */
import {
  getMissingFieldsForDocType,
  validateFieldsForDocType,
  PETITION_EXPORT_FIELD_META,
} from './document-export.service';

const full = {
  senderName: 'Nguyễn Văn A',
  detailContent: 'Nội dung đầy đủ',
  nhanThay: 'Nhận thấy X',
  deXuat: 'Đề xuất Y',
  lyDoChuyen: 'Lý do',
  canCuPhapLy: 'Căn cứ',
  huongDanKhoiKien: 'Hướng dẫn',
  lyDoTraDon: 'Lý do trả',
};

describe('getMissingFieldsForDocType', () => {
  it('đủ field → không thiếu cho mọi docType', () => {
    for (const dt of ['PHIEU_DE_XUAT', 'PHIEU_CHUYEN_NGUON_TIN', 'PHIEU_CHUYEN_DON', 'THONG_BAO_CHUYEN', 'THONG_BAO_HUONG_DAN', 'THONG_BAO_TRA_LAI', 'BIEN_NHAN'] as const) {
      expect(getMissingFieldsForDocType(dt, full)).toEqual([]);
    }
  });

  it('PHIEU_DE_XUAT thiếu nhanThay + deXuat → liệt kê 2, kèm label/type/savable', () => {
    const m = getMissingFieldsForDocType('PHIEU_DE_XUAT', { ...full, nhanThay: '', deXuat: '  ' });
    expect(m.map((x) => x.field)).toEqual(['nhanThay', 'deXuat']);
    expect(m[0]).toEqual({ field: 'nhanThay', label: 'Nhận thấy', type: 'textarea', savable: true });
  });

  it('PHIEU_CHUYEN_NGUON_TIN thiếu lyDoChuyen + canCuPhapLy', () => {
    const m = getMissingFieldsForDocType('PHIEU_CHUYEN_NGUON_TIN', { ...full, lyDoChuyen: undefined, canCuPhapLy: '' });
    expect(m.map((x) => x.field).sort()).toEqual(['canCuPhapLy', 'lyDoChuyen']);
  });

  it('THONG_BAO_TRA_LAI thiếu lyDoTraDon', () => {
    expect(getMissingFieldsForDocType('THONG_BAO_TRA_LAI', { ...full, lyDoTraDon: '' }).map((x) => x.field)).toEqual(['lyDoTraDon']);
  });

  it('baseline: thiếu senderName + nội dung (cả detailContent lẫn summary rỗng) cho mọi mẫu', () => {
    const m = getMissingFieldsForDocType('BIEN_NHAN', { senderName: '', detailContent: '', summary: '' });
    expect(m.map((x) => x.field)).toEqual(['senderName', 'detailContent']);
  });

  it('summary có → noiDung KHÔNG thiếu (detailContent rỗng vẫn ok)', () => {
    expect(getMissingFieldsForDocType('BIEN_NHAN', { senderName: 'A', detailContent: '', summary: 'Tóm tắt' })).toEqual([]);
  });

  it('THONG_BAO_CHUYEN + BIEN_NHAN không thêm field riêng (chỉ baseline)', () => {
    expect(getMissingFieldsForDocType('THONG_BAO_CHUYEN', full)).toEqual([]);
    expect(getMissingFieldsForDocType('BIEN_NHAN', full)).toEqual([]);
  });

  it('meta phủ đủ field validate', () => {
    for (const f of ['senderName', 'detailContent', 'nhanThay', 'deXuat', 'lyDoChuyen', 'canCuPhapLy', 'huongDanKhoiKien', 'lyDoTraDon']) {
      expect(PETITION_EXPORT_FIELD_META[f]).toBeTruthy();
    }
  });
});

describe('validateFieldsForDocType (vẫn throw khi thiếu — hành vi cũ)', () => {
  it('thiếu → throw BadRequest nêu field', () => {
    expect(() => validateFieldsForDocType('PHIEU_DE_XUAT', { ...full, nhanThay: '' })).toThrow(/nhanThay/);
  });
  it('đủ → không throw', () => {
    expect(() => validateFieldsForDocType('PHIEU_DE_XUAT', full)).not.toThrow();
  });
});
