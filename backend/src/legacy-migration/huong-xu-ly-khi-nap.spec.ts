import { ganHuongXuLyKhiTrong } from './legacy-migration.service';

/**
 * Bộ nạp hệ cũ suy hướng xử lý: NỘI DUNG ô đơn vị thắng trạng thái.
 *
 * Hệ cũ không có ô hướng xử lý. Với trả đơn / lưu đơn, cán bộ gõ luôn câu đề xuất vào ô "Đơn vị
 * giải quyết", còn trạng thái vẫn là "mới tiếp nhận". Suy chỉ từ trạng thái ra Giao đơn, và bản
 * in thành "Giao Lưu đơn; Hướng dẫn khởi kiện tại TAND tiếp nhận kiểm tra…" — đo 13/09/2026 có
 * ~1.540 đơn thư như thế.
 */
describe('ganHuongXuLyKhiTrong — trạng thái nói rõ thì theo trạng thái, không thì đọc câu', () => {
  /** Trạng thái là kết quả đợt suy trạng thái ĐÃ DUYỆT — câu chữ không được đè lên. */
  it('trạng thái đã chuyển đơn vị thắng câu "Trả đơn"', () => {
    const data: Record<string, unknown> = { donViGiaiQuyet: 'Trả đơn', status: 'DA_CHUYEN_DON_VI' };
    ganHuongXuLyKhiTrong(data, null);
    expect(data.huongXuLy).toBe('CHUYEN_DON');
  });

  it('hồ sơ 2026-11725: câu Lưu đơn, trạng thái mới tiếp nhận → Trả đơn/Lưu đơn', () => {
    const data: Record<string, unknown> = {
      donViGiaiQuyet: 'Lưu đơn; Hướng dẫn khởi kiện tại TAND',
    };
    ganHuongXuLyKhiTrong(data, null);
    expect(data.huongXuLy).toBe('TRA_LUU_DON');
  });

  it('ô đơn vị là tên đơn vị → vẫn theo trạng thái', () => {
    const data: Record<string, unknown> = { donViGiaiQuyet: 'Tổ công tác Số 8' };
    ganHuongXuLyKhiTrong(data, null);
    expect(data.huongXuLy).toBe('GIAO_DON');
  });

  it('câu không nói rõ hướng → theo trạng thái, không đoán', () => {
    const data: Record<string, unknown> = {
      donViGiaiQuyet: 'Chuyển Đ/c Phú - Phó Trưởng phòng để chỉ đạo Đội 8',
      status: 'DA_CHUYEN_DON_VI',
    };
    ganHuongXuLyKhiTrong(data, null);
    expect(data.huongXuLy).toBe('CHUYEN_DON');
  });

  it('cập nhật mà lần nạp không mang ô đơn vị → đọc ô đơn vị đang có', () => {
    const data: Record<string, unknown> = {};
    ganHuongXuLyKhiTrong(data, {
      huongXuLy: null,
      status: 'MOI_TIEP_NHAN',
      donViGiaiQuyet: 'Trả đơn, đề nghị bổ sung tài liệu, chứng cứ',
    });
    expect(data.huongXuLy).toBe('TRA_LUU_DON');
  });

  it('hồ sơ ĐÃ có hướng → không đụng, kể cả khi ô đơn vị là câu trả đơn', () => {
    const data: Record<string, unknown> = { donViGiaiQuyet: 'Trả đơn' };
    ganHuongXuLyKhiTrong(data, { huongXuLy: 'GIAO_DON', status: 'MOI_TIEP_NHAN' });
    expect('huongXuLy' in data).toBe(false);
  });
});
