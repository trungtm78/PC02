import { CATALOG_REGISTRY, getCatalogEntry } from './catalog.registry';

describe('CATALOG_REGISTRY', () => {
  it('LY_DO_KHONG_KHOI_TO: legal, multi, 7 giá trị', () => {
    const e = getCatalogEntry('LY_DO_KHONG_KHOI_TO');
    expect(e.kind).toBe('legal');
    expect(e.multi).toBe(true);
    expect(e.kind === 'legal' && e.values).toHaveLength(7);
  });

  it('LY_DO_KHONG_KHOI_TO: label đúng pháp lý Đ.157 (đại xá khoản 1e, có chú thích khoản)', () => {
    const e = getCatalogEntry('LY_DO_KHONG_KHOI_TO');
    if (e.kind !== 'legal') throw new Error('phải là legal');
    const byCode = Object.fromEntries(e.values.map((v) => [v.code, v.label]));
    // Khoản 1e BLTTHS Đ.157 là "đại xá", KHÔNG phải "xóa án tích" (tên enum đặt sai trước đây).
    expect(byCode['TOI_PHAM_DA_DUOC_XOA_AN_TICH']).toBe('Tội phạm đã được đại xá (khoản 1e)');
    // Mỗi nhãn có chú thích khoản để hiển thị đúng căn cứ pháp lý.
    expect(byCode['KHONG_CO_SU_VIEC']).toContain('khoản 1a');
    e.values.forEach((v) => expect(v.label).toMatch(/khoản 1[a-gđ]/));
  });

  it('LY_DO_TAM_DINH_CHI_VU_VIEC: legal, multi, 6 giá trị (Đ.148)', () => {
    const e = getCatalogEntry('LY_DO_TAM_DINH_CHI_VU_VIEC');
    expect(e.kind).toBe('legal');
    expect(e.multi).toBe(true);
    expect(e.kind === 'legal' && e.values).toHaveLength(6);
    expect(e.kind === 'legal' && e.values.map((v) => v.code)).toContain('BAT_KHA_KHANG');
  });

  it('LY_DO_TAM_DINH_CHI_VU_AN: legal, multi, 8 giá trị (Đ.229)', () => {
    const e = getCatalogEntry('LY_DO_TAM_DINH_CHI_VU_AN');
    expect(e.kind).toBe('legal');
    expect(e.multi).toBe(true);
    expect(e.kind === 'legal' && e.values).toHaveLength(8);
    expect(e.kind === 'legal' && e.values.map((v) => v.code)).toContain('CHUA_XAC_DINH_BI_CAN');
  });

  it('LOAI_NGUON_TIN: legal, single, 3 giá trị (Đ.144)', () => {
    const e = getCatalogEntry('LOAI_NGUON_TIN');
    expect(e.kind).toBe('legal');
    expect(e.multi).toBe(false);
    expect(e.kind === 'legal' && e.values).toHaveLength(3);
  });

  it('NGUON_PHAT_TIN: legal cascade theo LOAI_NGUON_TIN (Đ.144) — 10 giá trị, map đủ 3 nhóm', () => {
    const e = getCatalogEntry('NGUON_PHAT_TIN');
    expect(e.kind).toBe('legal');
    expect(e.kind === 'legal' && e.values).toHaveLength(10);
    expect(e.cascade?.parentKey).toBe('LOAI_NGUON_TIN');
    expect(e.cascade?.map.TO_GIAC).toEqual(['CA_NHAN_TO_GIAC']);
    expect(e.cascade?.map.TIN_BAO).toHaveLength(4);
    expect(e.cascade?.map.KIEN_NGHI_KHOI_TO).toHaveLength(5);
    // mọi code trong cascade map phải thuộc values (không trỏ code lạ)
    const codes = new Set(e.kind === 'legal' ? e.values.map((v) => v.code) : []);
    Object.values(e.cascade?.map ?? {}).flat().forEach((c) => expect(codes.has(c)).toBe(true));
  });

  it('PHUONG_THUC_TIEP_NHAN: legal, single, 5 giá trị (TT28 Đ.6)', () => {
    const e = getCatalogEntry('PHUONG_THUC_TIEP_NHAN');
    expect(e.kind).toBe('legal');
    expect(e.multi).toBe(false);
    expect(e.kind === 'legal' && e.values).toHaveLength(5);
  });

  it('DOCUMENT_TYPE: dynamic, source directory', () => {
    expect(getCatalogEntry('DOCUMENT_TYPE')).toMatchObject({ kind: 'dynamic', source: 'directory:DOCUMENT_TYPE' });
  });

  it('getCatalogEntry throw khi key không tồn tại', () => {
    expect(() => getCatalogEntry('KHONG_CO')).toThrow();
  });

  it('mọi entry có key trùng object key + code không rỗng (legal)', () => {
    for (const [k, e] of Object.entries(CATALOG_REGISTRY)) {
      expect(e.key).toBe(k);
      if (e.kind === 'legal') {
        expect(e.values.length).toBeGreaterThan(0);
        e.values.forEach((v) => expect(v.code).toBeTruthy());
      }
    }
  });
});
