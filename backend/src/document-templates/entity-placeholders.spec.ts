import { buildEntityPlaceholders } from './entity-placeholders';

describe('buildEntityPlaceholders', () => {
  it('VU_AN: map field Case → placeholder', () => {
    const p = buildEntityPlaceholders(
      'VU_AN',
      { caseCode: 'VA-2026-001', name: 'Vụ X', crime: 'Trộm cắp', status: 'DANG_DIEU_TRA' },
      {},
    );
    expect(p.soVuAn).toBe('VA-2026-001');
    expect(p.tenVuAn).toBe('Vụ X');
    expect(p.toiDanh).toBe('Trộm cắp');
  });

  it('VU_VIEC: map field Incident → placeholder', () => {
    const p = buildEntityPlaceholders(
      'VU_VIEC',
      { code: 'VV-2026-001', name: 'Việc Y', nguonPhatTin: 'Tố giác', description: 'Nội dung' },
      {},
    );
    expect(p.soVuViec).toBe('VV-2026-001');
    expect(p.tenVuViec).toBe('Việc Y');
    expect(p.nguonTin).toBe('Tố giác');
    expect(p.noiDung).toBe('Nội dung');
  });

  it('manualValues bổ sung/ghi đè biến', () => {
    const p = buildEntityPlaceholders('VU_AN', { caseCode: 'C1' }, { ghiChu: 'tay nhập', soVuAn: 'OVERRIDE' });
    expect(p.ghiChu).toBe('tay nhập');
    expect(p.soVuAn).toBe('OVERRIDE');
  });

  it('escape token người dùng ({ } < >) chống injection docxtemplater', () => {
    const p = buildEntityPlaceholders('VU_AN', { name: 'A{x}B' }, {});
    expect(p.tenVuAn).not.toContain('{');
    expect(p.tenVuAn).not.toContain('}');
  });

  it('field thiếu → chuỗi rỗng (không "undefined")', () => {
    const p = buildEntityPlaceholders('VU_AN', { caseCode: 'C1' }, {});
    expect(p.toiDanh).toBe('');
  });
});
