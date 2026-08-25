import { hoSoCodeVariants } from './ho-so-code.util';

/**
 * Hệ cũ hiển thị mã hồ sơ dạng `26-11171`, hệ mới lưu `2026-11171`. Cán bộ gõ dạng nào
 * cũng phải ra hồ sơ, và việc đó do MÁY CHỦ quyết — không phụ thuộc trình duyệt liệt kê
 * đúng các dạng. Trình duyệt cũ, gọi API trực tiếp, hay ứng dụng di động đều phải tìm được.
 */
describe('hoSoCodeVariants', () => {
  it('từ dạng ngắn suy ra dạng đầy đủ', () => {
    expect(hoSoCodeVariants('26-11171')).toEqual(['26-11171', '2026-11171']);
    expect(hoSoCodeVariants('19-80')).toEqual(['19-80', '2019-80']);
  });

  it('từ dạng đầy đủ suy ra dạng ngắn', () => {
    expect(hoSoCodeVariants('2026-11171')).toEqual(['2026-11171', '26-11171']);
  });

  it('giữ hậu tố chống trùng mà bản cấp mã sinh ra', () => {
    expect(hoSoCodeVariants('2025-1-2')).toEqual(['2025-1-2', '25-1-2']);
  });

  it('năm hai chữ số quy về 19xx hay 20xx theo mốc 50', () => {
    // Hồ sơ hệ cũ bắt đầu từ 2016; `99-1` là 1999 chứ không phải 2099.
    expect(hoSoCodeVariants('99-1')).toEqual(['99-1', '1999-1']);
  });

  it('năm ngoài khoảng hợp lý KHÔNG sinh biến thể', () => {
    // `3023-5325` là lỗi gõ năm đã biết; suy ra `30-5325` sẽ tìm nhầm hồ sơ khác.
    expect(hoSoCodeVariants('3023-5325')).toEqual(['3023-5325']);
  });

  it('chuỗi không phải mã hồ sơ chỉ trả về chính nó — không bịa biến thể', () => {
    expect(hoSoCodeVariants('Nguyễn Văn A')).toEqual(['Nguyễn Văn A']);
    expect(hoSoCodeVariants('DT-LEGACY-ho_so_doi_1:85704')).toEqual([
      'DT-LEGACY-ho_so_doi_1:85704',
    ]);
    expect(hoSoCodeVariants('VA-2026-09892')).toEqual(['VA-2026-09892']);
  });

  it('rỗng trả mảng rỗng, và bỏ khoảng trắng thừa người dùng gõ', () => {
    expect(hoSoCodeVariants('')).toEqual([]);
    expect(hoSoCodeVariants('   ')).toEqual([]);
    expect(hoSoCodeVariants(null)).toEqual([]);
    expect(hoSoCodeVariants(undefined)).toEqual([]);
    expect(hoSoCodeVariants('  26-11171  ')).toEqual(['26-11171', '2026-11171']);
  });
});
