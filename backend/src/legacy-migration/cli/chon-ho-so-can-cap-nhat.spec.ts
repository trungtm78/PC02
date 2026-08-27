import { chonHoSoCanCapNhat, khoaCuaTaiLieu } from './chon-ho-so-can-cap-nhat';

/**
 * Bộ chọn này quyết định hồ sơ nào bị GHI ĐÈ bằng dữ liệu hệ cũ, nên nó là chỗ nguy hiểm
 * nhất của cả việc cập nhật: chọn rộng tay một bản là xoá mất thứ cán bộ vừa sửa trên hệ mới.
 */
describe('chonHoSoCanCapNhat — chỉ đụng hồ sơ chưa có hoặc đã sửa ở hệ cũ', () => {
  it('hồ sơ hệ mới chưa có thì phải nạp', () => {
    const kq = chonHoSoCanCapNhat([{ id: 87062, _update_time: 1000 }], new Map());
    expect(kq.chuaCo).toBe(1);
    expect(kq.canCapNhat).toEqual([
      { khoa: 'ho_so_doi_1:87062', sourceId: '87062', lyDo: 'chua-co' },
    ]);
  });

  it('hồ sơ hệ cũ sửa SAU lần di trú thì phải nạp lại', () => {
    const kq = chonHoSoCanCapNhat(
      [{ id: 5, _update_time: 2000 }],
      new Map([['ho_so_doi_1:5', 1000]]),
    );
    expect(kq.daSua).toBe(1);
    expect(kq.canCapNhat[0].lyDo).toBe('da-sua');
  });

  /** Chỗ nguy hiểm nhất: không đụng vào hồ sơ hệ cũ không đổi. */
  it('hồ sơ không đổi thì KHÔNG đụng tới', () => {
    const kq = chonHoSoCanCapNhat(
      [{ id: 5, _update_time: 1000 }],
      new Map([['ho_so_doi_1:5', 1000]]),
    );
    expect(kq.khongDoi).toBe(1);
    expect(kq.canCapNhat).toEqual([]);
  });

  it('hệ cũ sửa TRƯỚC lần di trú cũng không đụng — bản hệ mới mới hơn', () => {
    const kq = chonHoSoCanCapNhat(
      [{ id: 5, _update_time: 500 }],
      new Map([['ho_so_doi_1:5', 1000]]),
    );
    expect(kq.khongDoi).toBe(1);
    expect(kq.canCapNhat).toEqual([]);
  });

  /**
   * Hệ cũ xoá MỀM. Không xoá theo dấu ấy ở hệ mới: hồ sơ đã sang đây có thể đang được xử lý,
   * và xoá dữ liệu vụ án theo một cờ ở hệ khác là việc không hoàn lại được.
   */
  it('hồ sơ hệ cũ đánh dấu đã xoá thì bỏ qua, không nạp và không xoá gì', () => {
    const kq = chonHoSoCanCapNhat([{ id: 9, da_xoa: true, _update_time: 9999 }], new Map());
    expect(kq.boQuaVìĐãXoá).toBe(1);
    expect(kq.canCapNhat).toEqual([]);
  });

  it('tài liệu thiếu `id` thì bỏ qua — không có khoá thì nạp vào là nhân đôi hồ sơ', () => {
    const kq = chonHoSoCanCapNhat(
      [{ id: null }, { id: undefined }, { id: '  ' }],
      new Map(),
    );
    expect(kq.boQuaVìThiếuId).toBe(3);
    expect(kq.canCapNhat).toEqual([]);
  });

  it('thiếu `_update_time` ở hệ cũ thì coi như không mới hơn', () => {
    const kq = chonHoSoCanCapNhat([{ id: 5 }], new Map([['ho_so_doi_1:5', 1000]]));
    expect(kq.khongDoi).toBe(1);
  });

  it('`_update_time` dạng chuỗi vẫn so được', () => {
    const kq = chonHoSoCanCapNhat(
      [{ id: 5, _update_time: '2000' }],
      new Map([['ho_so_doi_1:5', 1000]]),
    );
    expect(kq.daSua).toBe(1);
  });

  it('khoá phải đúng quy ước `<bảng>:<id số>` — sai khoá là nhân đôi toàn bộ hồ sơ', () => {
    expect(khoaCuaTaiLieu('ho_so_doi_1', 87062)).toBe('ho_so_doi_1:87062');
    expect(khoaCuaTaiLieu('ho_so_doi_1', '87062')).toBe('ho_so_doi_1:87062');
  });

  it('đếm đủ mọi nhóm trên một tập trộn lẫn', () => {
    const kq = chonHoSoCanCapNhat(
      [
        { id: 1, _update_time: 100 },
        { id: 2, _update_time: 300 },
        { id: 3, _update_time: 100 },
        { id: 4, da_xoa: true },
        { id: null },
      ],
      new Map([
        ['ho_so_doi_1:2', 200],
        ['ho_so_doi_1:3', 100],
      ]),
    );
    expect({
      chuaCo: kq.chuaCo,
      daSua: kq.daSua,
      khongDoi: kq.khongDoi,
      boQuaVìĐãXoá: kq.boQuaVìĐãXoá,
      boQuaVìThiếuId: kq.boQuaVìThiếuId,
    }).toEqual({ chuaCo: 1, daSua: 1, khongDoi: 1, boQuaVìĐãXoá: 1, boQuaVìThiếuId: 1 });
  });
});
