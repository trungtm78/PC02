import { khoaNguonDon, laNguonTrucTiep } from './nguon-don.util';

/**
 * "Nguồn đơn/Đơn vị giao" là ô chữ tự do trên hệ cũ. Đo trên bản chạy thật 20/09/2026:
 * 47.456/47.488 đơn có giá trị, **1.431 cách viết**, gộp theo khoá đơn vị còn 972 nhóm.
 * Nhiều nhất: Bưu điện 14.758 · Trực tiếp 10.656 · "trực tiếp" 956 · PC01 CA TP.HCM ~6.700.
 * 2.162 dòng ở dạng NFD — trông giống hệt dòng NFC nhưng khác byte.
 */
describe('khoaNguonDon — khoá gộp', () => {
  it('gộp hoa/thường và khoảng trắng thừa', () => {
    expect(khoaNguonDon('Trực tiếp')).toBe(khoaNguonDon('trực tiếp'));
    expect(khoaNguonDon('  Bưu   điện ')).toBe(khoaNguonDon('Bưu điện'));
  });

  it('gộp chữ dựng sẵn (NFC) với chữ gõ tổ hợp (NFD) — 2.162 dòng prod ở dạng NFD', () => {
    expect(khoaNguonDon('Trực tiếp'.normalize('NFD'))).toBe(
      khoaNguonDon('Trực tiếp'.normalize('NFC')),
    );
  });

  it('gộp biến thể dấu câu và viết tắt đơn vị', () => {
    expect(khoaNguonDon('PC01 CA TP.HCM')).toBe(
      khoaNguonDon('PC01 CA TP. Hồ Chí Minh'),
    );
  });

  it('rỗng/null ra chuỗi rỗng, không nổ', () => {
    expect(khoaNguonDon(null)).toBe('');
    expect(khoaNguonDon(undefined)).toBe('');
    expect(khoaNguonDon('   ')).toBe('');
  });
});

/**
 * Cờ "Trực tiếp" quyết định nhóm thông tin định danh nguyên đơn có bung ra hay không, và
 * quyết định SĐT nguyên đơn có bắt buộc hay không.
 *
 * Suy từ TÊN đã chuẩn hoá, KHÔNG đọc cơ sở dữ liệu: hàm thuần chạy y hệt ở máy chủ lẫn trình
 * duyệt, và mục danh mục do cán bộ tạo nhanh tự mang cờ — không ai quên gắn được.
 */
describe('laNguonTrucTiep', () => {
  it.each([
    'Trực tiếp',
    'trực tiếp',
    'TRỰC TIẾP',
    '  Trực tiếp  ',
    'Trực tiếp'.normalize('NFD'),
    'Nộp trực tiếp',
    'Nộp trực tiếp tại trụ sở',
    'Công dân trực tiếp đến',
  ])('nhận "%s" là trực tiếp', (ten) => {
    expect(laNguonTrucTiep(ten)).toBe(true);
  });

  it.each([
    'Bưu điện',
    'PC01 Công an TP.HCM',
    'Trại tạm giam Chí Hòa',
    'Công an phường Bàn Cờ',
    '',
    null,
    undefined,
  ])('KHÔNG nhận "%s" là trực tiếp', (ten) => {
    expect(laNguonTrucTiep(ten as string)).toBe(false);
  });

  it('không cắt vào giữa chữ — "gián tiếp" không phải "trực tiếp"', () => {
    expect(laNguonTrucTiep('Gián tiếp qua bưu điện')).toBe(false);
  });
});
