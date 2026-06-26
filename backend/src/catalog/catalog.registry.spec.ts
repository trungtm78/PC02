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
