import { khoaLoaiThongTin, nhomHanTheoTen, vietHoaChuDau } from './khoa-loai-thong-tin.util';

/**
 * Khoá gộp của ô "Loại thông tin".
 *
 * Hệ cũ không có danh mục — cán bộ gõ tay, nên cùng một loại có nhiều cách viết. Mọi chuỗi dưới đây
 * chép NGUYÊN VĂN từ bản sao dữ liệu thật (pc02_that, 27/08/2026: 735 giá trị khác nhau).
 */
describe('khoaLoaiThongTin — cùng nghĩa ra cùng khoá', () => {
  it.each([
    ['Tố giác', 'tố giác'],
    ['Tố giác', 'Tố giác (02 đơn)'],
    ['Tố giác', '  Tố giác  '],
    ['Tố giác', 'Tố giác '],
    ['Đề nghị', 'Đề nghị (02 đơn)'],
    ['Khiếu nại (Quyết định tố tụng)', 'Khiếu nại (QĐ tố tụng)'],
    ['Khiếu nại (Quyết định tố tụng)', 'khiếu nại (quyết định tố tụng)'],
    ['Khiếu nại (Hành vi tố tụng)', 'Khiếu nại (HV tố tụng)'],
    ['Khiếu nại (Hành vi tố tụng)', 'khiếu nại (hành vi tố tụng)'],
    ['Lưu đơn', 'Lưu đơn.'],
    // Chuỗi dựng sẵn và chuỗi tổ hợp (NFD) là một chữ.
    ['Tố giác', 'Tố giác'],
  ])('"%s" ≡ "%s"', (a, b) => {
    expect(khoaLoaiThongTin(a)).toBe(khoaLoaiThongTin(b));
  });

  it.each([
    ['Tố giác', 'Tố cáo'],
    ['Tố giác', 'Rút tố giác'],
    ['Khiếu nại (Quyết định tố tụng)', 'Khiếu nại (Hành vi tố tụng)'],
    ['Tố giác', 'Tố giác, Đề nghị'],
    ['Xin bảo lãnh', 'Bảo lãnh'],
  ])('"%s" KHÔNG gộp với "%s"', (a, b) => {
    expect(khoaLoaiThongTin(a)).not.toBe(khoaLoaiThongTin(b));
  });

  it('chuỗi rỗng / chỉ khoảng trắng / null → khoá rỗng', () => {
    expect(khoaLoaiThongTin('')).toBe('');
    expect(khoaLoaiThongTin('   ')).toBe('');
    expect(khoaLoaiThongTin(null)).toBe('');
    expect(khoaLoaiThongTin(undefined)).toBe('');
  });

  it('hậu tố đếm đơn chỉ bỏ khi đứng CUỐI và đúng dạng số', () => {
    expect(khoaLoaiThongTin('Tố giác (nhiều đơn)')).not.toBe(khoaLoaiThongTin('Tố giác'));
  });
});

/**
 * Nhóm hạn gán sẵn theo tên — quyết định số ngày tự tính hạn (petitions.service.ts khối tính hạn):
 * Tố cáo 30 · Khiếu nại 30 · Kiến nghị 15 · còn lại Phản ánh 15 (đúng hành vi khi không chọn loại).
 */
describe('nhomHanTheoTen', () => {
  it.each([
    ['Tố cáo', 'TO_CAO'],
    ['Tố cáo cán bộ', 'TO_CAO'],
    ['Khiếu nại', 'KHIEU_NAI'],
    ['Khiếu nại (QĐ tố tụng)', 'KHIEU_NAI'],
    ['Kiến nghị', 'KIEN_NGHI'],
    ['Kiến nghị khởi tố', 'KIEN_NGHI'],
    ['Phản ánh', 'PHAN_ANH'],
    ['Tố giác', 'PHAN_ANH'],
    ['Đề nghị', 'PHAN_ANH'],
    ['Rút khiếu nại', 'PHAN_ANH'],
    ['Rút tố cáo', 'PHAN_ANH'],
    ['', 'PHAN_ANH'],
  ])('"%s" → %s', (ten, nhom) => {
    expect(nhomHanTheoTen(ten)).toBe(nhom);
  });
});

describe('vietHoaChuDau — tên hiển thị của mục danh mục', () => {
  it('viết hoa chữ đầu, giữ nguyên phần còn lại, bỏ khoảng trắng thừa', () => {
    expect(vietHoaChuDau('  tố giác  ')).toBe('Tố giác');
    expect(vietHoaChuDau('khiếu nại (Quyết định tố tụng)')).toBe('Khiếu nại (Quyết định tố tụng)');
    expect(vietHoaChuDau('đề nghị')).toBe('Đề nghị');
    expect(vietHoaChuDau('')).toBe('');
  });
});
