import { describe, it, expect } from 'vitest';
import { formatHoSoCode, phanSttCu } from '../hoSoCode';

/**
 * Hệ cũ hiển thị mã hồ sơ dạng `26-11171` (năm hai chữ số), hệ mới lưu `2026-11171`.
 * Cùng một con số, khác cách rút gọn. Anh chốt: MÀN HÌNH hiện như hệ cũ, Ô TÌM nhận cả hai
 * dạng, và KHÔNG đụng dữ liệu trong cơ sở dữ liệu.
 *
 * Tệp này chỉ lo phần HIỂN THỊ. Phần tìm kiếm (suy ra dạng còn lại) do MÁY CHỦ làm —
 * ca kiểm ở `backend/src/common/utils/ho-so-code.util.spec.ts`.
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

/**
 * Ghép STT cũ vào ô STT — anh yêu cầu 09/09/2026 để cán bộ tra chiếu lại hệ cũ.
 *
 * Format chép NGUYÊN từ hệ cũ, không tự nghĩ. `_PC02/Modules/doi_1/templates/doi_1_xem.tpl:44`:
 *
 *     {$info.stt} {if $info.stt_cu} <em class="text-danger"> -  (STT cũ: {$info.stt_cu})</em>{/if}
 *
 * Tức `243 - (STT cũ: 208)`, và CHỈ hiện khi có giá trị. Cột "STT cũ" riêng trong danh sách hệ
 * cũ thì đang bị chú thích tắt (`doi_1_list.tpl:203`) — hệ cũ cố ý gộp vào một ô.
 */
describe('phanSttCu', () => {
  it('có STT cũ thì trả đúng chữ của hệ cũ', () => {
    expect(phanSttCu('208')).toBe(' -  (STT cũ: 208)');
  });

  it('không có STT cũ thì trả rỗng — KHÔNG in "(STT cũ: —)"', () => {
    // Một phần ba tới quá nửa hồ sơ không có số cũ; in dấu gạch cho tất cả là làm mọi hàng
    // cao thêm mà không nói gì.
    expect(phanSttCu(null)).toBe('');
    expect(phanSttCu(undefined)).toBe('');
    expect(phanSttCu('')).toBe('');
    expect(phanSttCu('   ')).toBe('');
  });

  it('cắt khoảng trắng thừa quanh giá trị', () => {
    expect(phanSttCu('  208 ')).toBe(' -  (STT cũ: 208)');
  });

  it('giữ nguyên giá trị không phải số — không đoán thay dữ liệu', () => {
    expect(phanSttCu('208/A')).toBe(' -  (STT cũ: 208/A)');
  });
});
