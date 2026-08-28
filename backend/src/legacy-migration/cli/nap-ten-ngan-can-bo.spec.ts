import { lenKeHoach, hoTenDayDu, type CanBoHeCu, type CanBoHeMoi } from './nap-ten-ngan-can-bo';

const u = (id: string, lastName: string, firstName: string, shortName: string | null = null): CanBoHeMoi => ({
  id,
  lastName,
  firstName,
  shortName,
});

/**
 * Nạp chữ viết tắt cán bộ từ hệ cũ.
 *
 * Rủi ro lớn nhất KHÔNG phải là bỏ sót một người — mà là GÁN NHẦM: chữ viết tắt in ở dòng "Lưu:"
 * cuối văn bản đã ký, nên gán nhầm là ghi tên người khác vào hồ sơ chính thức. Phần lớn ca kiểm
 * dưới đây canh đúng chuyện ấy.
 */
describe('Nạp chữ viết tắt cán bộ', () => {
  it('ghép họ tên đúng thứ tự hệ cũ lưu', () => {
    expect(hoTenDayDu(u('1', 'Phạm Trường', 'Thanh'))).toBe('Phạm Trường Thanh');
  });

  it('gán đúng chuỗi cán bộ tự đặt, kể cả khi nó không theo quy tắc nào', () => {
    const kh = lenKeHoach([{ ten: 'Bùi Thanh Trà', ten_ngan: 'Trà' }], [u('1', 'Bùi Thanh', 'Trà')]);
    expect(kh.ghi).toEqual([{ id: '1', hoTen: 'Bùi Thanh Trà', tu: null, sang: 'Trà' }]);
  });

  /**
   * Chuỗi RỖNG là một lựa chọn có chủ ý — 16 cán bộ để trống và hệ cũ in ra trống. Bỏ qua nó
   * là để bộ in rơi về nhánh dự phòng và tự thêm chữ vào văn bản mà hệ cũ không có.
   */
  it('chuỗi rỗng vẫn được ghi, không bị coi là "chưa đặt"', () => {
    const kh = lenKeHoach([{ ten: 'Mai Vũ Hoàng', ten_ngan: '' }], [u('1', 'Mai Vũ', 'Hoàng')]);
    expect(kh.ghi).toEqual([{ id: '1', hoTen: 'Mai Vũ Hoàng', tu: null, sang: '' }]);
  });

  /**
   * Cán bộ KHÔNG có cột ấy ở hệ cũ thì để NULL, chứ không ghi chuỗi rỗng: hai giá trị dẫn tới
   * hai nhánh in khác nhau (`?? $nguoi_nhan` in họ tên đầy đủ, còn rỗng in trống).
   */
  it.each([[undefined], [null]])('không có cột (%p) thì KHÔNG ghi gì', (tn) => {
    const kh = lenKeHoach(
      [{ ten: 'Trần Hoàng Duy', ten_ngan: tn as never }],
      [u('1', 'Trần Hoàng', 'Duy')],
    );
    expect(kh.ghi).toEqual([]);
  });

  /**
   * ĐIỀU QUAN TRỌNG NHẤT. Hai tài khoản cùng họ tên thì không có cách nào biết chuỗi ấy của ai.
   * Gán bừa là in tên người khác lên văn bản đã ký — bỏ qua và BÁO RA mới đúng.
   */
  it('trùng họ tên thì BỎ QUA cả cụm và báo ra, không gán bừa', () => {
    const kh = lenKeHoach(
      [{ ten: 'Nguyễn Văn A', ten_ngan: 'V.A' }],
      [u('1', 'Nguyễn Văn', 'A'), u('2', 'Nguyễn Văn', 'A')],
    );
    expect(kh.ghi).toEqual([]);
    expect(kh.boQuaTrungTen).toEqual(['Nguyễn Văn A']);
  });

  it('cán bộ hệ cũ không có tài khoản hệ mới thì báo ra, không ném', () => {
    const kh = lenKeHoach([{ ten: 'Người Đã Nghỉ', ten_ngan: 'N.Nghỉ' }], [u('1', 'Bùi Thanh', 'Trà')]);
    expect(kh.ghi).toEqual([]);
    expect(kh.khongTimThay).toEqual(['Người Đã Nghỉ']);
  });

  /** Chạy lại lần hai không được ghi lại — nếu không, mỗi lần chạy là một lượt ghi CSDL vô ích. */
  it('chạy lại không ghi lại thứ đã đúng', () => {
    const kh = lenKeHoach(
      [{ ten: 'Bùi Thanh Trà', ten_ngan: 'Trà' }],
      [u('1', 'Bùi Thanh', 'Trà', 'Trà')],
    );
    expect(kh.ghi).toEqual([]);
    expect(kh.daDung).toBe(1);
  });

  it('sửa được chuỗi đã có nếu hệ cũ đổi', () => {
    const kh = lenKeHoach(
      [{ ten: 'Bùi Thanh Trà', ten_ngan: 'B.Trà' }],
      [u('1', 'Bùi Thanh', 'Trà', 'Trà')],
    );
    expect(kh.ghi).toEqual([{ id: '1', hoTen: 'Bùi Thanh Trà', tu: 'Trà', sang: 'B.Trà' }]);
  });

  it('tài khoản chưa có họ tên không làm hỏng bảng tra', () => {
    const kh = lenKeHoach(
      [{ ten: 'Bùi Thanh Trà', ten_ngan: 'Trà' }],
      [{ id: '9', firstName: null, lastName: null, shortName: null }, u('1', 'Bùi Thanh', 'Trà')],
    );
    expect(kh.ghi).toHaveLength(1);
  });

  it('bản ghi hệ cũ không có họ tên thì bỏ qua', () => {
    const kh = lenKeHoach([{ ten: '  ', ten_ngan: 'X' } as CanBoHeCu], [u('1', 'Bùi Thanh', 'Trà')]);
    expect(kh.ghi).toEqual([]);
    expect(kh.khongTimThay).toEqual([]);
  });
});
