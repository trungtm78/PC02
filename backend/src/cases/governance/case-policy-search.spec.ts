import { compileCasePolicySearch } from './case-policy-search';
describe('CG15 permitted native field search', () => {
  it('keeps Vietnamese broad search while excluding protected columns and mixed aggregate index', () => {
    const where = compileCasePolicySearch(
      { search: 'Đang điều tra' },
      new Set(['moTaChiTiet', 'tomTat', 'tenCungCap']),
    );
    const json = JSON.stringify(where);
    expect(json).toContain('status');
    expect(json).toContain('nameBd');
    expect(json).not.toContain('moTaChiTiet');
    expect(json).not.toContain('tenCungCap');
    expect(json).not.toContain('timKiemBd');
  });
  it('word all is ordinary value; only field component selects wildcard semantics', () => {
    expect(() =>
      compileCasePolicySearch(
        { tk: ['tenVuAn~all'] },
        new Set(['cccdCungCap']),
      ),
    ).not.toThrow();
    expect(
      JSON.stringify(
        compileCasePolicySearch(
          { tk: ['tenVuAn~all'] },
          new Set(['cccdCungCap']),
        ),
      ),
    ).toContain('all');
  });
  it('preserves AND between tags and denies explicit protected field aliases', () => {
    expect(
      compileCasePolicySearch(
        { tk: ['tenVuAn~visible', 'trangThai~DANG_DIEU_TRA'] },
        new Set(['cccdCungCap']),
      ),
    ).toHaveLength(2);
    expect(() =>
      compileCasePolicySearch(
        { tk: ['nguoiGui~secret'] },
        new Set(['tenCungCap']),
      ),
    ).toThrow();
  });
});
