import { describe, it, expect } from 'vitest';
import { mergeCaseApiToFormData } from '../mergeCaseApiToFormData';
import { INITIAL_FORM_DATA } from '../types';

const baseApi = { name: 'Test', caseProvenance: 'DIRECT_DISCOVERY' };

describe('mergeCaseApiToFormData — Tab 2-9 restore from metadata', () => {
  it('Tab 2: restores incidentCode and incidentDate from metadata', () => {
    const result = mergeCaseApiToFormData(
      { ...baseApi, metadata: { incidentCode: 'VV-001', incidentDate: '2026-05-24' } },
      INITIAL_FORM_DATA,
    );
    expect(result.incidentCode).toBe('VV-001');
    expect(result.incidentDate).toBe('2026-05-24');
  });

  it('Tab 2: falls back to prev when metadata absent', () => {
    const prev = { ...INITIAL_FORM_DATA, incidentCode: 'OLD-CODE' };
    const result = mergeCaseApiToFormData({ ...baseApi, metadata: {} }, prev);
    expect(result.incidentCode).toBe('OLD-CODE');
  });

  it('Tab 3: restores criminalCode and verdict from metadata', () => {
    const result = mergeCaseApiToFormData(
      { ...baseApi, metadata: { criminalCode: 'HS-001', verdict: 'Có tội' } },
      INITIAL_FORM_DATA,
    );
    expect(result.criminalCode).toBe('HS-001');
    expect(result.verdict).toBe('Có tội');
  });

  it('Tab 5: restores tdcIncidentCode from metadata', () => {
    const result = mergeCaseApiToFormData(
      { ...baseApi, metadata: { tdcIncidentCode: 'TDC-001', tdcSource: 'Nguồn A' } },
      INITIAL_FORM_DATA,
    );
    expect(result.tdcIncidentCode).toBe('TDC-001');
    expect(result.tdcSource).toBe('Nguồn A');
  });

  it('Tab 6: restores tdcCaseCode and tdcCaseType from metadata', () => {
    const result = mergeCaseApiToFormData(
      { ...baseApi, metadata: { tdcCaseCode: 'VA-TDC-001', tdcCaseType: 'Hình sự' } },
      INITIAL_FORM_DATA,
    );
    expect(result.tdcCaseCode).toBe('VA-TDC-001');
    expect(result.tdcCaseType).toBe('Hình sự');
  });

  it('Tab 9: restores stat fields from metadata', () => {
    const result = mergeCaseApiToFormData(
      { ...baseApi, metadata: { stat_primaryCrime: 'Cướp', stat_victimCount: '2' } },
      INITIAL_FORM_DATA,
    );
    expect(result.stat_primaryCrime).toBe('Cướp');
    expect(result.stat_victimCount).toBe('2');
  });

  it('Tab 9: falls back to prev when stat field absent from metadata', () => {
    const prev = { ...INITIAL_FORM_DATA, stat_primaryCrime: 'OLD-CRIME', stat_victimCount: '5' };
    const result = mergeCaseApiToFormData({ ...baseApi, metadata: {} }, prev);
    expect(result.stat_primaryCrime).toBe('OLD-CRIME');
    expect(result.stat_victimCount).toBe('5');
  });

  it('stat_damageAmount: coerces number from API to string (backend may store as number)', () => {
    const result = mergeCaseApiToFormData(
      { ...baseApi, metadata: { stat_damageAmount: 2000000 as unknown as string } },
      INITIAL_FORM_DATA,
    );
    expect(result.stat_damageAmount).toBe('2000000');
  });
});

describe('mergeCaseApiToFormData — UTDT fields (caseProvenance=UY_THAC_DIEU_TRA)', () => {
  it('hydrates utdt_donViGiao from apiData top-level field', () => {
    const result = mergeCaseApiToFormData(
      { ...baseApi, caseProvenance: 'UY_THAC_DIEU_TRA', donViGiao: 'C06' },
      INITIAL_FORM_DATA,
    );
    expect(result.utdt_donViGiao).toBe('C06');
  });

  it('hydrates utdt_ngayTiepNhan as date-only string from ISO datetime', () => {
    const result = mergeCaseApiToFormData(
      { ...baseApi, caseProvenance: 'UY_THAC_DIEU_TRA', ngayTiepNhan: '2026-05-01T00:00:00.000Z' },
      INITIAL_FORM_DATA,
    );
    expect(result.utdt_ngayTiepNhan).toMatch(/^2026-05-0[12]$/); // toDateInput may adjust for timezone
  });

  it('hydrates utdt_nghiVanDoiTuong from metadata', () => {
    const result = mergeCaseApiToFormData(
      { ...baseApi, caseProvenance: 'UY_THAC_DIEU_TRA', metadata: { nghiVanDoiTuong: 'Đối tượng A' } },
      INITIAL_FORM_DATA,
    );
    expect(result.utdt_nghiVanDoiTuong).toBe('Đối tượng A');
  });

  it('falls back to prev utdt fields when API returns null', () => {
    const prev = { ...INITIAL_FORM_DATA, utdt_donViGiao: 'C12', utdt_loaiUyThac: 'DIEU_TRA_HINH_SU' };
    const result = mergeCaseApiToFormData(
      { ...baseApi, caseProvenance: 'UY_THAC_DIEU_TRA', donViGiao: null, loaiUyThac: null },
      prev,
    );
    expect(result.utdt_donViGiao).toBe('C12');
    expect(result.utdt_loaiUyThac).toBe('DIEU_TRA_HINH_SU');
  });
});

describe('mergeCaseApiToFormData — PR-M2 ghiChuKhac/toiDanhKhacIds + 3 cờ xét-xử', () => {
  it('hydrates ghiChuKhac + toiDanhKhacIds từ top-level apiData', () => {
    const result = mergeCaseApiToFormData(
      { ...baseApi, ghiChuKhac: 'Ghi chú cũ', toiDanhKhacIds: ['D173', 'D174'] },
      INITIAL_FORM_DATA,
    );
    expect(result.ghiChuKhac).toBe('Ghi chú cũ');
    expect(result.toiDanhKhacIds).toEqual(['D173', 'D174']);
  });

  it('toiDanhKhacIds vắng → fallback prev (không vỡ thành chuỗi)', () => {
    const prev = { ...INITIAL_FORM_DATA, toiDanhKhacIds: ['X1'] };
    const result = mergeCaseApiToFormData({ ...baseApi }, prev);
    expect(result.toiDanhKhacIds).toEqual(['X1']);
  });

  it('3 cờ xét-xử từ statistic → boolean (không phải chuỗi "true")', () => {
    const result = mergeCaseApiToFormData(
      { ...baseApi, statistic: { ghiAmGhiHinhDaDuocXetXu: true, coSuDungKQGhiAmTrongXetXu: false, khongGAGHNhungToaYeuCau: true } },
      INITIAL_FORM_DATA,
    );
    expect(result.statistic.ghiAmGhiHinhDaDuocXetXu).toBe(true);
    expect(result.statistic.coSuDungKQGhiAmTrongXetXu).toBe(false);
    expect(result.statistic.khongGAGHNhungToaYeuCau).toBe(true);
  });
});

describe('mergeCaseApiToFormData — FP Case số QĐ giai đoạn', () => {
  it('hydrates soQuyetDinhKhoiTo from top-level apiData', () => {
    const result = mergeCaseApiToFormData(
      { ...baseApi, soQuyetDinhKhoiTo: 'QD-KT-001' },
      INITIAL_FORM_DATA,
    );
    expect(result.soQuyetDinhKhoiTo).toBe('QD-KT-001');
  });

  it('hydrates soQDNhapVuAn and ngayNhapVuAn from top-level apiData', () => {
    const result = mergeCaseApiToFormData(
      { ...baseApi, soQDNhapVuAn: 'QD-NHAP-01', ngayNhapVuAn: '2026-02-10T00:00:00.000Z' },
      INITIAL_FORM_DATA,
    );
    expect(result.soQDNhapVuAn).toBe('QD-NHAP-01');
    expect(result.ngayNhapVuAn).toMatch(/^2026-02-1[01]$/);
  });

  it('hydrates soQDTachVuAn and ngayTachVuAn', () => {
    const result = mergeCaseApiToFormData(
      { ...baseApi, soQDTachVuAn: 'QD-TACH-01', ngayTachVuAn: '2026-03-15T00:00:00.000Z' },
      INITIAL_FORM_DATA,
    );
    expect(result.soQDTachVuAn).toBe('QD-TACH-01');
    expect(result.ngayTachVuAn).toMatch(/^2026-03-1[45]$/);
  });

  it('hydrates soQDDinhChiVuAn and ngayDinhChiVuAn', () => {
    const result = mergeCaseApiToFormData(
      { ...baseApi, soQDDinhChiVuAn: 'QD-DC-01', ngayDinhChiVuAn: '2026-04-20T00:00:00.000Z' },
      INITIAL_FORM_DATA,
    );
    expect(result.soQDDinhChiVuAn).toBe('QD-DC-01');
    expect(result.ngayDinhChiVuAn).toMatch(/^2026-04-2[01]$/);
  });

  it('hydrates soBanAnCoHieuLuc and ngayBanAnCoHieuLuc', () => {
    const result = mergeCaseApiToFormData(
      { ...baseApi, soBanAnCoHieuLuc: 'BA-001/2026', ngayBanAnCoHieuLuc: '2026-05-01T00:00:00.000Z' },
      INITIAL_FORM_DATA,
    );
    expect(result.soBanAnCoHieuLuc).toBe('BA-001/2026');
    expect(result.ngayBanAnCoHieuLuc).toMatch(/^2026-05-0[12]$/);
  });

  it('hydrates canCuTamDinhChiVuAn and canCuPhucHoiVuAn', () => {
    const result = mergeCaseApiToFormData(
      { ...baseApi, canCuTamDinhChiVuAn: 'Căn cứ TĐC', canCuPhucHoiVuAn: 'Căn cứ phục hồi' },
      INITIAL_FORM_DATA,
    );
    expect(result.canCuTamDinhChiVuAn).toBe('Căn cứ TĐC');
    expect(result.canCuPhucHoiVuAn).toBe('Căn cứ phục hồi');
  });

  it('PR-3: hydrates 8 field tab "Vụ án TĐC"', () => {
    const result = mergeCaseApiToFormData(
      {
        ...baseApi,
        soQuyetDinhTamDinhChi: 'QĐ-TĐC-01',
        ngayTamDinhChi: '2026-06-20T00:00:00.000Z',
        lyDoTamDinhChiVuAn: ['CHUA_CO_KET_QUA_GIAM_DINH', 'BAT_KHA_KHANG'],
        ngayHetThoiHieu: '2027-06-20T00:00:00.000Z',
        soQuyetDinhPhucHoi: 'QĐ-PH-02',
        ngayPhucHoi: '2026-06-25T00:00:00.000Z',
        tdcKhacPhucLyDoBienPhap: 'Lý do/biện pháp',
        tdcKhacPhucBienBan: 'BB-03',
      },
      INITIAL_FORM_DATA,
    );
    expect(result.soQuyetDinhTamDinhChi).toBe('QĐ-TĐC-01');
    expect(result.ngayTamDinhChi).toBe('2026-06-20');
    expect(result.lyDoTamDinhChiVuAn).toEqual(['CHUA_CO_KET_QUA_GIAM_DINH', 'BAT_KHA_KHANG']);
    expect(result.ngayHetThoiHieu).toBe('2027-06-20');
    expect(result.soQuyetDinhPhucHoi).toBe('QĐ-PH-02');
    expect(result.ngayPhucHoi).toBe('2026-06-25');
    expect(result.tdcKhacPhucLyDoBienPhap).toBe('Lý do/biện pháp');
    expect(result.tdcKhacPhucBienBan).toBe('BB-03');
  });

  it('falls back to prev when FP fields null from API', () => {
    const prev = { ...INITIAL_FORM_DATA, soQuyetDinhKhoiTo: 'QD-OLD', ghiChuNhapHoSo: 'Ghi chú cũ' };
    const result = mergeCaseApiToFormData(
      { ...baseApi, soQuyetDinhKhoiTo: null, ghiChuNhapHoSo: null },
      prev,
    );
    expect(result.soQuyetDinhKhoiTo).toBe('QD-OLD');
    expect(result.ghiChuNhapHoSo).toBe('Ghi chú cũ');
  });
});
