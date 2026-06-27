import { validateExportDocumentsRequest } from './petition-export-documents.validate';

describe('validateExportDocumentsRequest', () => {
  it('hợp lệ + thiếu mode → mode mặc định "merged"', () => {
    const r = validateExportDocumentsRequest(['PHIEU_DE_XUAT', 'BIEN_NHAN'], undefined);
    expect(r.mode).toBe('merged');
    expect(r.docTypes).toEqual(['PHIEU_DE_XUAT', 'BIEN_NHAN']);
  });

  it('dedupe docType trùng (tránh cấp số 2 lần)', () => {
    const r = validateExportDocumentsRequest(
      ['PHIEU_DE_XUAT', 'PHIEU_DE_XUAT', 'BIEN_NHAN'],
      'zip',
    );
    expect(r.docTypes).toEqual(['PHIEU_DE_XUAT', 'BIEN_NHAN']);
    expect(r.mode).toBe('zip');
  });

  it('rỗng → BadRequest 400', () => {
    expect(() => validateExportDocumentsRequest([], 'merged')).toThrow(
      /docTypes không được trống/,
    );
  });

  it('docType ngoài allowlist → BadRequest 400', () => {
    expect(() =>
      validateExportDocumentsRequest(['HACK_ME'], 'merged'),
    ).toThrow(/không hợp lệ/);
  });

  it('mode lạ → BadRequest 400', () => {
    expect(() =>
      validateExportDocumentsRequest(['BIEN_NHAN'], 'pdf'),
    ).toThrow(/mode không hợp lệ/);
  });
});
