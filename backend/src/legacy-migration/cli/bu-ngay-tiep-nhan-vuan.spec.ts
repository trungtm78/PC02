import { buNgayTiepNhan, ngayTiepNhanTuBanGoc } from './bu-ngay-tiep-nhan-vuan';
import { parseLegacyDate } from '../legacy-mapper';

type Dong = {
  id: string;
  legacyRaw: Record<string, unknown> | null;
  legacySourceId: string | null;
  receiveDate: Date | null;
};

/** Bản giả áp ĐÚNG điều kiện được truyền vào — không tự kiểm hộ. */
function khoGia(dong: Dong[]) {
  const findMany = jest.fn(async (a: unknown) => {
    const arg = a as {
      where: { receiveDate?: unknown; legacySourceId?: unknown };
      take: number;
      cursor?: { id: string };
    };
    let ds = [...dong];
    if ('receiveDate' in arg.where) ds = ds.filter((d) => d.receiveDate === null);
    if (arg.where.legacySourceId) ds = ds.filter((d) => d.legacySourceId !== null);
    ds.sort((x, y) => (x.id < y.id ? -1 : 1));
    if (arg.cursor) ds = ds.slice(ds.findIndex((d) => d.id === arg.cursor?.id) + 1);
    return ds.slice(0, arg.take).map((d) => ({ ...d }));
  });

  const updateMany = jest.fn(async (a: unknown) => {
    const arg = a as { where: { id: string; receiveDate?: null }; data: { receiveDate: Date } };
    const d = dong.find((x) => x.id === arg.where.id);
    if (!d) return { count: 0 };
    if ('receiveDate' in arg.where && d.receiveDate !== null) return { count: 0 };
    d.receiveDate = arg.data.receiveDate;
    return { count: 1 };
  });

  return {
    kho: { case: { findMany, updateMany }, incident: { findMany: jest.fn(async () => []) }, petition: { findMany: jest.fn(async () => []) } } as never,
    findMany,
    updateMany,
    dong,
  };
}

const moc = (raw: Record<string, unknown> | null, id = 'a'): Dong => ({
  id,
  legacyRaw: raw,
  legacySourceId: 'k-' + id,
  receiveDate: null,
});

/**
 * Cột `Case.receiveDate` có từ lâu nhưng bộ di trú CHƯA BAO GIỜ ghi. Đo trên máy chạy
 * 27/08/2026: cả 3.359/3.359 vụ án di trú đều trống, nên KHÔNG vụ án cũ nào mở ra sửa và lưu
 * lại được — form chặn bằng "Vui lòng chọn ngày tiếp nhận", một ô cán bộ không có gì để điền.
 */
describe('ngayTiepNhanTuBanGoc — biên bản tiếp nhận trước, ngày đề xuất là đường lùi', () => {
  it('có biên bản tiếp nhận thì lấy biên bản', () => {
    const kq = ngayTiepNhanTuBanGoc({
      ngay_tiep_nhan_nguon_tin: '15/03/2019',
      ngay_de_xuat: '20/03/2019',
    });
    expect(kq).toEqual(parseLegacyDate('15/03/2019'));
  });

  it('không có biên bản thì lùi về ngày đề xuất', () => {
    expect(ngayTiepNhanTuBanGoc({ ngay_de_xuat: '20/03/2019' })).toEqual(
      parseLegacyDate('20/03/2019'),
    );
  });

  /** Hai mốc rỗng của hệ cũ vẫn là rỗng — không được biến thành 1970. */
  it.each([['0'], ['-25200'], ['']])('mốc rỗng "%s" không thành ngày', (v) => {
    expect(ngayTiepNhanTuBanGoc({ ngay_tiep_nhan_nguon_tin: v, ngay_de_xuat: v })).toBeUndefined();
  });

  it('không có bản gốc thì không bịa ngày', () => {
    expect(ngayTiepNhanTuBanGoc(null)).toBeUndefined();
    expect(ngayTiepNhanTuBanGoc({})).toBeUndefined();
  });
});

describe('buNgayTiepNhan — chỉ điền ô đang trống', () => {
  it('điền được từ ngày đề xuất', async () => {
    const g = khoGia([moc({ ngay_de_xuat: '20/03/2019' })]);
    const kq = await buNgayTiepNhan(g.kho, false);
    expect(kq.dienVao).toBe(1);
    expect(g.dong[0].receiveDate).toEqual(parseLegacyDate('20/03/2019'));
  });

  it('không đoán được thì đếm riêng, không ghi bừa', async () => {
    const g = khoGia([moc({})]);
    const kq = await buNgayTiepNhan(g.kho, false);
    expect(kq.khongDoanDuoc).toBe(1);
    expect(g.updateMany).not.toHaveBeenCalled();
  });

  it('chạy lần thứ hai không đổi gì thêm', async () => {
    const g = khoGia([moc({ ngay_de_xuat: '20/03/2019' })]);
    await buNgayTiepNhan(g.kho, false);
    expect((await buNgayTiepNhan(g.kho, false)).dienVao).toBe(0);
  });

  it('chế độ thử thì đếm nhưng không ghi', async () => {
    const g = khoGia([moc({ ngay_de_xuat: '20/03/2019' })]);
    expect((await buNgayTiepNhan(g.kho, true)).dienVao).toBe(1);
    expect(g.updateMany).not.toHaveBeenCalled();
    expect(g.dong[0].receiveDate).toBeNull();
  });

  /** Ảnh chụp nói ô trống, nhưng cán bộ điền vào giữa chừng — câu ghi phải tự bỏ qua. */
  it('không đè ngày cán bộ điền xen giữa lúc đọc và lúc ghi', async () => {
    const g = khoGia([moc({ ngay_de_xuat: '20/03/2019' })]);
    // `banGocTuAnhEm` hỏi bảng này TRƯỚC vòng chính, nên bản giả một-lần sẽ bị nó nuốt. Nhắm
    // đúng lời gọi có `legacyRaw` trong `select` — đó mới là vòng đọc hồ sơ để ghi.
    const that = g.findMany.getMockImplementation()!;
    g.findMany.mockImplementation(async (a: unknown) => {
      const arg = a as { select?: Record<string, boolean> };
      const ds = await that(a);
      if (arg.select?.legacyRaw) g.dong[0].receiveDate = new Date('2020-01-01');
      return ds;
    });
    const kq = await buNgayTiepNhan(g.kho, false);
    expect(kq.boQuaViSuaXen).toBe(1);
    expect(g.dong[0].receiveDate).toEqual(new Date('2020-01-01'));
  });

  it('đi hết nhiều trang, không bỏ sót hồ sơ nào', async () => {
    const nhieu = Array.from({ length: 2500 }, (_, i) =>
      moc({ ngay_de_xuat: '20/03/2019' }, String(i).padStart(5, '0')),
    );
    const g = khoGia(nhieu);
    expect((await buNgayTiepNhan(g.kho, false)).dienVao).toBe(2500);
    expect(g.dong.every((d) => d.receiveDate !== null)).toBe(true);
  });
});
