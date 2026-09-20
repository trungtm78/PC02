import { describe, expect, it } from 'vitest';
import { giuCanBoDaChon, nhanCanBo, NHAN_NGUNG_HOAT_DONG } from '../canBoDaChon';
import type { OfficerOption } from '@/hooks/useOfficerOptions';

/**
 * Ô chọn cán bộ chỉ nạp người ĐANG HOẠT ĐỘNG. Mở một đơn cũ mà người được giao đã nghỉ hoặc
 * bị khoá thì `<select>` không có mục nào khớp `value` → ô hiện TRẮNG, không phải "Chưa phân
 * công". Cán bộ nhìn thấy ô trống sẽ chọn người khác, tức PHÂN CÔNG LẠI mà không ai định thế.
 *
 * Giữ lại người đã chọn thành một mục riêng, ghi rõ là đã ngừng hoạt động.
 */
const DS: OfficerOption[] = [
  { value: 'u1', label: 'Nguyễn Văn A', teams: [] },
  { value: 'u2', label: 'Trần Thị B', teams: [] },
];

describe('giuCanBoDaChon', () => {
  it('chưa chọn ai thì giữ nguyên danh sách', () => {
    expect(giuCanBoDaChon(DS, '', null)).toBe(DS);
  });

  it('người đã chọn còn trong danh sách thì giữ nguyên, không nhân đôi', () => {
    expect(giuCanBoDaChon(DS, 'u1', { id: 'u1', lastName: 'Nguyễn', firstName: 'Văn A' })).toBe(DS);
  });

  it('người đã chọn KHÔNG còn trong danh sách thì thêm lại, ghi rõ đã ngừng hoạt động', () => {
    const ra = giuCanBoDaChon(DS, 'u9', { id: 'u9', lastName: 'Lê', firstName: 'Văn C' });
    expect(ra).toHaveLength(3);
    expect(ra[0].value).toBe('u9');
    expect(ra[0].label).toContain('Lê Văn C');
    expect(ra[0].label).toContain(NHAN_NGUNG_HOAT_DONG);
  });

  it('không biết tên thì vẫn giữ mục, lùi về tên đăng nhập', () => {
    const ra = giuCanBoDaChon(DS, 'u9', { id: 'u9', username: 'levanc' });
    expect(ra[0].label).toContain('levanc');
  });

  it('không có cả hồ sơ lẫn tên thì VẪN giữ mục — mất mục là mất phân công', () => {
    const ra = giuCanBoDaChon(DS, 'u9', null);
    expect(ra).toHaveLength(3);
    expect(ra[0].value).toBe('u9');
    expect(ra[0].label).toContain(NHAN_NGUNG_HOAT_DONG);
  });

  it('mục thêm lại luôn có `teams: []` để tầng dựng nhóm không nổ', () => {
    expect(giuCanBoDaChon(DS, 'u9', null)[0].teams).toEqual([]);
  });
});

/**
 * Bảng phân công hiện tên người ĐÃ được giao (từ máy chủ), còn ô chọn hiện tên từ danh sách
 * cán bộ. Hai nguồn, hai cách dựng nhãn → cùng một người hiện hai kiểu trong CÙNG một khung:
 * ô chọn ghi "Bùi Thanh Trà (mrtea)", dòng bên trên ghi "Bùi Thanh Trà". Đúng lúc cần phân
 * biệt hai người trùng tên thì phần phân biệt biến mất.
 */
describe('nhanCanBo', () => {
  it('ưu tiên nhãn của danh sách cán bộ — giữ phần phân biệt trùng tên', () => {
    const ds: OfficerOption[] = [{ value: 'u1', label: 'Bùi Thanh Trà (mrtea)', teams: [] }];
    expect(nhanCanBo(ds, 'u1', { id: 'u1', lastName: 'Bùi Thanh', firstName: 'Trà' })).toBe(
      'Bùi Thanh Trà (mrtea)',
    );
  });

  it('không có trong danh sách thì lùi về hồ sơ máy chủ', () => {
    expect(nhanCanBo(DS, 'u9', { id: 'u9', lastName: 'Lê', firstName: 'Văn C' })).toBe('Lê Văn C');
  });

  it('không có cả hai thì lùi về tên đăng nhập, rồi tới id — không bao giờ trả rỗng', () => {
    expect(nhanCanBo(DS, 'u9', { id: 'u9', username: 'levanc' })).toBe('levanc');
    expect(nhanCanBo(DS, 'u9', null)).toBe('u9');
  });
});
