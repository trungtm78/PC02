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
    const kh = lenKeHoach([{ id: 1, ten: 'Bùi Thanh Trà', ten_ngan: 'Trà' }], [u('1', 'Bùi Thanh', 'Trà')]);
    expect(kh.ghi).toEqual([{ id: '1', hoTen: 'Bùi Thanh Trà', tu: null, sang: 'Trà' }]);
  });

  /**
   * Chuỗi RỖNG là một lựa chọn có chủ ý — 16 cán bộ để trống và hệ cũ in ra trống. Bỏ qua nó
   * là để bộ in rơi về nhánh dự phòng và tự thêm chữ vào văn bản mà hệ cũ không có.
   */
  it('chuỗi rỗng vẫn được ghi, không bị coi là "chưa đặt"', () => {
    const kh = lenKeHoach([{ id: 2, ten: 'Mai Vũ Hoàng', ten_ngan: '' }], [u('1', 'Mai Vũ', 'Hoàng')]);
    expect(kh.ghi).toEqual([{ id: '1', hoTen: 'Mai Vũ Hoàng', tu: null, sang: '' }]);
  });

  /**
   * Cán bộ KHÔNG có cột ấy ở hệ cũ thì để NULL, chứ không ghi chuỗi rỗng: hai giá trị dẫn tới
   * hai nhánh in khác nhau (`?? $nguoi_nhan` in họ tên đầy đủ, còn rỗng in trống).
   */
  it.each([[undefined], [null]])('không có cột (%p) thì KHÔNG ghi gì', (tn) => {
    const kh = lenKeHoach(
      [{ id: 3, ten: 'Trần Hoàng Duy', ten_ngan: tn as never }],
      [u('1', 'Trần Hoàng', 'Duy')],
    );
    expect(kh.ghi).toEqual([]);
  });

  /**
   * ĐIỀU QUAN TRỌNG NHẤT. Hai tài khoản cùng họ tên thì họ tên không còn đủ để nhận ra ai.
   * Gán bừa là in tên người khác lên văn bản đã ký.
   */
  it('trùng họ tên mà không có dấu vết thì BỎ QUA cả cụm và báo ra', () => {
    const kh = lenKeHoach(
      [{ id: 7, ten: 'Nguyễn Văn A', ten_ngan: 'V.A' }],
      [u('1', 'Nguyễn Văn', 'A'), u('2', 'Nguyễn Văn', 'A')],
    );
    expect(kh.ghi).toEqual([]);
    expect(kh.boQuaTrungTen).toEqual(['Nguyễn Văn A']);
  });

  /**
   * Nhưng bỏ qua là mất mát THẬT, không phải an toàn: 11 cán bộ trùng tên trên máy thật ứng với
   * **18.617 hồ sơ (33,7%)** — lớn hơn cả vấn đề đang sửa (đo 28/08/2026).
   *
   * Có một cách nhận ra chính xác mà không cần đoán: hồ sơ di trú giữ `nguoi_them` của hệ cũ,
   * và bộ di trú đã gắn chúng cho đúng tài khoản hệ mới. Dấu vết ấy là bằng chứng trực tiếp,
   * mạnh hơn họ tên — nên nó đứng TRƯỚC, và họ tên chỉ là đường lùi.
   */
  it('trùng họ tên nhưng có dấu vết hồ sơ thì gán ĐÚNG người', () => {
    const kh = lenKeHoach(
      [{ id: 7, ten: 'Nguyễn Văn A', ten_ngan: 'V.A' }],
      [u('1', 'Nguyễn Văn', 'A'), u('2', 'Nguyễn Văn', 'A')],
      new Map([[7, '2']]),
    );
    expect(kh.ghi).toEqual([{ id: '2', hoTen: 'Nguyễn Văn A', tu: null, sang: 'V.A' }]);
    expect(kh.boQuaTrungTen).toEqual([]);
  });

  /** Dấu vết thắng cả họ tên: cán bộ đổi tên trên hệ mới thì vẫn nhận ra qua hồ sơ đã gắn. */
  it('dấu vết hồ sơ thắng phép ghép theo họ tên', () => {
    const kh = lenKeHoach(
      [{ id: 7, ten: 'Tên Cũ Kỹ', ten_ngan: 'C.Kỹ' }],
      [u('9', 'Tên Mới', 'Toanh')],
      new Map([[7, '9']]),
    );
    expect(kh.ghi).toEqual([{ id: '9', hoTen: 'Tên Cũ Kỹ', tu: null, sang: 'C.Kỹ' }]);
  });

  /** Dấu vết trỏ tới tài khoản không còn tồn tại → không ném, báo ra như trường hợp khác. */
  it('dấu vết trỏ tới tài khoản đã xoá thì báo ra, không ném', () => {
    const kh = lenKeHoach(
      [{ id: 7, ten: 'Người Lạ', ten_ngan: 'N.Lạ' }],
      [u('1', 'Bùi Thanh', 'Trà')],
      new Map([[7, 'khong-ton-tai']]),
    );
    expect(kh.ghi).toEqual([]);
    expect(kh.khongTimThay).toEqual(['Người Lạ']);
  });

  it('cán bộ hệ cũ không có tài khoản hệ mới thì báo ra, không ném', () => {
    const kh = lenKeHoach([{ id: 4, ten: 'Người Đã Nghỉ', ten_ngan: 'N.Nghỉ' }], [u('1', 'Bùi Thanh', 'Trà')]);
    expect(kh.ghi).toEqual([]);
    expect(kh.khongTimThay).toEqual(['Người Đã Nghỉ']);
  });

  /** Chạy lại lần hai không được ghi lại — nếu không, mỗi lần chạy là một lượt ghi CSDL vô ích. */
  it('chạy lại không ghi lại thứ đã đúng', () => {
    const kh = lenKeHoach(
      [{ id: 1, ten: 'Bùi Thanh Trà', ten_ngan: 'Trà' }],
      [u('1', 'Bùi Thanh', 'Trà', 'Trà')],
    );
    expect(kh.ghi).toEqual([]);
    expect(kh.daDung).toBe(1);
  });

  it('sửa được chuỗi đã có nếu hệ cũ đổi', () => {
    const kh = lenKeHoach(
      [{ id: 5, ten: 'Bùi Thanh Trà', ten_ngan: 'B.Trà' }],
      [u('1', 'Bùi Thanh', 'Trà', 'Trà')],
    );
    expect(kh.ghi).toEqual([{ id: '1', hoTen: 'Bùi Thanh Trà', tu: 'Trà', sang: 'B.Trà' }]);
  });

  it('tài khoản chưa có họ tên không làm hỏng bảng tra', () => {
    const kh = lenKeHoach(
      [{ id: 1, ten: 'Bùi Thanh Trà', ten_ngan: 'Trà' }],
      [{ id: '9', firstName: null, lastName: null, shortName: null }, u('1', 'Bùi Thanh', 'Trà')],
    );
    expect(kh.ghi).toHaveLength(1);
  });

  it('bản ghi hệ cũ không có họ tên thì bỏ qua', () => {
    const kh = lenKeHoach([{ id: 6, ten: '  ', ten_ngan: 'X' } as CanBoHeCu], [u('1', 'Bùi Thanh', 'Trà')]);
    expect(kh.ghi).toEqual([]);
    expect(kh.khongTimThay).toEqual([]);
  });
});
