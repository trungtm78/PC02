import { legacyFormParityData, O_HE_CU_TREN_FORM } from './legacy-form-parity.mapper';

describe('legacyFormParityData — ô hệ cũ trên form → cột Vụ án', () => {
  it('bỏ qua ô lời gọi không nhắc tới, không ghi đè bằng null', () => {
    expect(legacyFormParityData({})).toEqual({});
  });

  it('chuyển ngày dạng chuỗi thành Date', () => {
    const data = legacyFormParityData({ ngayXayRa: '2026-08-01T00:00:00.000Z' });
    expect(data.ngayXayRa).toBeInstanceOf(Date);
    expect((data.ngayXayRa as Date).toISOString()).toBe('2026-08-01T00:00:00.000Z');
  });

  it('ngày rỗng nghĩa là người dùng xoá trắng ô — ghi null, không bỏ qua', () => {
    expect(legacyFormParityData({ ngayXayRa: '' })).toEqual({ ngayXayRa: null });
  });

  it('mảng rỗng nghĩa là bỏ chọn hết — cột String[] không nhận null', () => {
    expect(legacyFormParityData({ lyDoKhongKhoiTo: [] })).toEqual({ lyDoKhongKhoiTo: [] });
    expect(legacyFormParityData({ lyDoKhongKhoiTo: null })).toEqual({ lyDoKhongKhoiTo: [] });
  });

  it('giữ nguyên mảng lý do đã chọn', () => {
    expect(legacyFormParityData({ lyDoTamDinhChiNguonTin: ['chua_co_giam_dinh'] })).toEqual({
      lyDoTamDinhChiNguonTin: ['chua_co_giam_dinh'],
    });
  });

  it('giữ đúng-sai, kể cả false', () => {
    expect(legacyFormParityData({ vuViecTamDungTruoc2015: false })).toEqual({
      vuViecTamDungTruoc2015: false,
    });
  });

  /**
   * Ca kiểm này là lưới an toàn cho lần sau: thêm ô mới vào đặc tả bố cục mà quên khai ở
   * đây thì cán bộ nhập được trên màn hình nhưng lưu xong mất trắng — kiểu hỏng im lặng
   * khó lần ra nhất.
   */
  // 30 kể từ 27/08/2026: thêm `sttCu` — form Vụ án vẫn gửi ô ấy lên mà không nơi nào ghi nó
  // xuống cột, nên cán bộ gõ vào, bấm Lưu, mở lại thì trống. Cổng đối chiếu DTO bắt được khi
  // được mở rộng cho cả ba thực thể.
  it('phụ trách đủ 30 ô hệ cũ, không sót', () => {
    expect(O_HE_CU_TREN_FORM).toHaveLength(30);
    const day: Record<string, unknown> = {};
    for (const k of O_HE_CU_TREN_FORM) day[k] = k.startsWith('ngay') ? '2026-08-01' : 'x';
    expect(Object.keys(legacyFormParityData(day)).sort()).toEqual([...O_HE_CU_TREN_FORM].sort());
  });
});
