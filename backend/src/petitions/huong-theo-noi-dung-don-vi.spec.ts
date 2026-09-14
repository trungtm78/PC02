import { laCauDeXuat, huongTheoNoiDungDonVi } from './huong-xu-ly.rule';

/**
 * Ô "Đơn vị giải quyết" của hệ cũ có HAI kiểu nội dung, và cả hai đều đúng về nghiệp vụ:
 *
 *   • tên đơn vị — "Đội 8", "Công an phường Thới An"   → bản in bọc khuôn câu Giao/Chuyển;
 *   • cả CÂU đề xuất — "Trả đơn, đề nghị bổ sung…"    → bản in in NGUYÊN VĂN.
 *
 * Mẫu hệ cũ `don_thu_mau.docx` có sẵn biến thể 3 cho kiểu thứ hai: `Đề xuất: ${don_vi_giai_quyet}./.`
 * Mọi chuỗi dưới đây chép nguyên văn từ dữ liệu prod đo ngày 13/09/2026 — không tự nghĩ ra.
 */
describe('laCauDeXuat — ô đơn vị đã là cả câu đề xuất', () => {
  it.each([
    'Trả đơn, đề nghị bổ sung tài liệu, chứng cứ',
    'Lưu đơn; Hướng dẫn khởi kiện tại TAND',
    'Lưu đơn (tổ 2 Đội 1)',
    'trả lại đơn',
    'Trả lại đơn, hướng dẫn khởi kiện ra TAND',
    'Hoàn trả Trại tạm giam Chí Hòa',
    'Hướng dẫn khởi kiện tại TAND.',
    'Thông báo trả đơn',
    'Thông báo không thụ lý đơn khiếu nại',
    'Chuyển Đ/c Phú - Phó Trưởng phòng để chỉ đạo Đội 8',
    'chuyển đ/c Phú - Phó trưởng phòng để chỉ đạo',
    'Chuyển hoàn Phòng PC01',
    'Giao Đội 8',
  ])('là câu: %s', (v) => {
    expect(laCauDeXuat(v)).toBe(true);
  });

  it.each([
    'Đội 8',
    'Tổ công tác Số 8',
    'Công an phường Thới An, TP Hồ Chí Minh',
    'PC01 Công an TP. HCM',
    'BCH Đội 4',
    // Người NHẬN, không phải câu — khuôn "Giao … tiếp nhận" vẫn đọc được.
    'Đồng chí Phú - Phó Trưởng Phòng (phụ trách trực tiếp Đội 8) để chỉ đạo giải quyết',
    'Đ/c Trưởng Công an phường Phú Thạnh, TP Hồ Chí Minh',
    'Trưởng Công an quận Tân Phú',
    // Bắt đầu bằng chữ trùng động từ nhưng là tên đơn vị.
    'Trại tạm giam Chí Hoà',
    'Giao thông vận tải',
    '',
    '   ',
  ])('KHÔNG phải câu: %s', (v) => {
    expect(laCauDeXuat(v)).toBe(false);
  });

  it('không phân biệt hoa thường, bỏ khoảng trắng đầu', () => {
    expect(laCauDeXuat('   TRẢ ĐƠN')).toBe(true);
  });

  it('null / undefined không phải câu', () => {
    expect(laCauDeXuat(null)).toBe(false);
    expect(laCauDeXuat(undefined)).toBe(false);
  });
});

describe('huongTheoNoiDungDonVi — chỉ quyết khi câu nói RÕ một hướng', () => {
  it.each([
    'Trả đơn, hướng dẫn khởi kiện tại TAND',
    'Lưu đơn (tổ 2 Đội 1)',
    'Lưu đơn; Hướng dẫn khởi kiện tại TAND',
    'Trả lại đơn, hướng dẫn khởi kiện ra TAND',
    'Hoàn trả Trại tạm giam Bố Lá',
    'Hướng dẫn khởi kiện tại TAND',
    'Thông báo trả đơn',
    'Thông báo không thụ lý đơn khiếu nại',
    // "giao" nằm TRONG một từ khác thì không phải mệnh đề giao đơn.
    'Trả đơn, đề nghị khởi kiện tranh chấp hợp đồng giao dịch dân sự',
  ])('Trả đơn/Lưu đơn: %s', (v) => {
    expect(huongTheoNoiDungDonVi(v)).toBe('TRA_LUU_DON');
  });

  /**
   * Không đoán. Hồ sơ nhiều nội dung ("hướng dẫn phần 1; giao tổ X phần 2") không có MỘT hướng
   * đúng, và "Chuyển Đ/c Phú … để chỉ đạo" là giao nội bộ chứ không phải chuyển ra ngoài —
   * đoán theo chữ đầu là sai. Bản in vẫn đúng vì câu được in nguyên văn.
   */
  it.each([
    'Hướng dẫn khởi kiện đối với ông Khanh; giao Tổ Hình sự khu vực 6 (Quận 7 cũ)',
    // Dạng "nội dung 1 / nội dung 2" đo được ở prod, đặt vế Trả đơn lên đầu để CHỈ luật mệnh đề
    // giao/chuyển chặn được — gỡ luật ấy thì ca này đỏ.
    'Trả đơn (nội dung 1), chuyển Công an quận 1 (nội dung 2)',
    'Lưu đơn và giao Tổ công tác Số 3 xác minh nội dung còn lại',
    'Thông báo đề nghị liên hệ TAND Quận 7 đối với nội dung (1) và chuyển Công an phường Tân Hưng',
    'Chuyển Đ/c Phú - Phó Trưởng phòng để chỉ đạo Đội 8',
    'Chuyển hoàn Phòng PC01',
    'Giao Đội 8',
    'Thông báo liên hệ Cơ quan Thi hành án dân sự; Tổ công tác Số 1',
    'Đội 8',
    '',
  ])('không tự quyết: %s', (v) => {
    expect(huongTheoNoiDungDonVi(v)).toBeUndefined();
  });

  it('null / undefined → không tự quyết', () => {
    expect(huongTheoNoiDungDonVi(null)).toBeUndefined();
    expect(huongTheoNoiDungDonVi(undefined)).toBeUndefined();
  });
});
