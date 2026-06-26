import { CATALOG_LEGAL, CATALOG_DYNAMIC_KEYS, CATALOG_META } from '../catalog.generated';

describe('catalog.generated', () => {
  it('LY_DO_KHONG_KHOI_TO có 7 option {code,label}', () => {
    expect(CATALOG_LEGAL.LY_DO_KHONG_KHOI_TO).toHaveLength(7);
    expect(CATALOG_LEGAL.LY_DO_KHONG_KHOI_TO[0]).toEqual({
      code: 'KHONG_CO_SU_VIEC',
      label: 'Không có sự việc phạm tội',
    });
  });

  it('DOCUMENT_TYPE nằm trong CATALOG_DYNAMIC_KEYS, không ở legal', () => {
    expect(CATALOG_DYNAMIC_KEYS).toContain('DOCUMENT_TYPE');
    expect(CATALOG_LEGAL).not.toHaveProperty('DOCUMENT_TYPE');
  });

  it('CATALOG_META gồm multi cho LY_DO_KHONG_KHOI_TO', () => {
    expect(CATALOG_META.LY_DO_KHONG_KHOI_TO.multi).toBe(true);
    expect(CATALOG_META.LY_DO_KHONG_KHOI_TO.kind).toBe('legal');
  });
});
