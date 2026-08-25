import { describe, it, expect } from 'vitest';
import { formatHoSoCode, hoSoCodeVariants } from '../hoSoCode';

/**
 * Hệ cũ hiển thị mã hồ sơ dạng `26-11171` (năm hai chữ số), hệ mới lưu `2026-11171`.
 * Cùng một con số, khác cách rút gọn. Anh chốt: MÀN HÌNH hiện như hệ cũ, Ô TÌM nhận cả hai
 * dạng, và KHÔNG đụng dữ liệu trong cơ sở dữ liệu.
 */
describe('formatHoSoCode', () => {
  it('rút năm bốn chữ số thành hai — đúng như hệ cũ', () => {
    expect(formatHoSoCode('2026-11171')).toBe('26-11171');
    expect(formatHoSoCode('2019-80')).toBe('19-80');
  });

  it('giữ nguyên hậu tố chống trùng', () => {
    // Bản cấp mã thêm `-2`, `-3`… khi trùng; rút gọn không được nuốt mất hậu tố.
    expect(formatHoSoCode('2025-1-2')).toBe('25-1-2');
  });

  it('KHÔNG đụng mã chưa đúng dạng — trả nguyên văn thay vì cắt bừa', () => {
    // Cắt bừa những chuỗi này sẽ tạo ra mã sai mà nhìn vẫn "hợp lệ".
    expect(formatHoSoCode('DT-LEGACY-ho_so_doi_1:85704')).toBe('DT-LEGACY-ho_so_doi_1:85704');
    expect(formatHoSoCode('VA-2026-09892')).toBe('VA-2026-09892');
    expect(formatHoSoCode('26-11171')).toBe('26-11171');
    expect(formatHoSoCode('')).toBe('');
    expect(formatHoSoCode(null)).toBe('');
    expect(formatHoSoCode(undefined)).toBe('');
  });

  it('không rút năm ngoài khoảng hợp lý — 1899/2201 không phải năm hồ sơ', () => {
    expect(formatHoSoCode('1899-5')).toBe('1899-5');
    expect(formatHoSoCode('3023-5325')).toBe('3023-5325');
  });
});

describe('hoSoCodeVariants', () => {
  it('từ dạng ngắn suy ra dạng đầy đủ để tìm trong cơ sở dữ liệu', () => {
    expect(hoSoCodeVariants('26-11171')).toEqual(['26-11171', '2026-11171']);
    expect(hoSoCodeVariants('19-80')).toEqual(['19-80', '2019-80']);
  });

  it('từ dạng đầy đủ suy ra dạng ngắn', () => {
    expect(hoSoCodeVariants('2026-11171')).toEqual(['2026-11171', '26-11171']);
  });

  it('năm hai chữ số quy về 19xx hay 20xx theo mốc hợp lý', () => {
    // Hồ sơ hệ cũ bắt đầu từ 2016; `99-1` là 1999 chứ không phải 2099.
    expect(hoSoCodeVariants('99-1')).toEqual(['99-1', '1999-1']);
  });

  it('chuỗi không phải mã hồ sơ chỉ trả về chính nó — không bịa thêm biến thể', () => {
    expect(hoSoCodeVariants('Nguyễn Văn A')).toEqual(['Nguyễn Văn A']);
    expect(hoSoCodeVariants('')).toEqual([]);
  });

  it('bỏ khoảng trắng thừa người dùng gõ vào', () => {
    expect(hoSoCodeVariants('  26-11171  ')).toEqual(['26-11171', '2026-11171']);
  });
});
