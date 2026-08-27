import { donSoDienThoai } from './don-so-dien-thoai-donthu';

type Dong = { id: string; senderPhone: string | null; legacySourceId: string | null };

/** Bản giả áp ĐÚNG điều kiện được truyền vào — không tự kiểm hộ. */
function khoGia(dong: Dong[]) {
  const findMany = jest.fn(async (a: unknown) => {
    const arg = a as {
      where: { legacySourceId?: unknown; senderPhone?: unknown };
      take: number;
      cursor?: { id: string };
    };
    let ds = dong.filter((d) => d.senderPhone !== null);
    if (arg.where.legacySourceId) ds = ds.filter((d) => d.legacySourceId !== null);
    ds = [...ds].sort((x, y) => (x.id < y.id ? -1 : 1));
    if (arg.cursor) ds = ds.slice(ds.findIndex((d) => d.id === arg.cursor?.id) + 1);
    return ds.slice(0, arg.take).map((d) => ({ ...d }));
  });

  const updateMany = jest.fn(async (a: unknown) => {
    const arg = a as {
      where: { id: string; senderPhone?: string | null };
      data: { senderPhone: string | null };
    };
    const d = dong.find((x) => x.id === arg.where.id);
    if (!d) return { count: 0 };
    if ('senderPhone' in arg.where && arg.where.senderPhone !== d.senderPhone) return { count: 0 };
    d.senderPhone = arg.data.senderPhone;
    return { count: 1 };
  });

  return { kho: { petition: { findMany, updateMany } } as never, findMany, updateMany, dong };
}

describe('donSoDienThoai — xoá ký hiệu "không có", giữ mọi thứ còn có thể là số', () => {
  it('ký hiệu "không có" thì xoá về trống', async () => {
    const g = khoGia([{ id: 'a', senderPhone: '...', legacySourceId: 'k' }]);
    const kq = await donSoDienThoai(g.kho, false);
    expect(kq.xoaVeTrong).toBe(1);
    expect(g.dong[0].senderPhone).toBeNull();
  });

  it('số đúng nhưng có dấu phân cách thì bỏ dấu', async () => {
    const g = khoGia([{ id: 'a', senderPhone: '0912 345 678', legacySourceId: 'k' }]);
    const kq = await donSoDienThoai(g.kho, false);
    expect(kq.chuanHoa).toBe(1);
    expect(g.dong[0].senderPhone).toBe('0912345678');
  });

  it('số đã đúng dạng thì không đụng tới', async () => {
    const g = khoGia([{ id: 'a', senderPhone: '0912345678', legacySourceId: 'k' }]);
    await donSoDienThoai(g.kho, false);
    expect(g.updateMany).not.toHaveBeenCalled();
  });

  /** Thà để cán bộ tự sửa còn hơn xoá mất một số thật. */
  it('đủ chữ số nhưng dạng lạ thì giữ nguyên và đếm riêng', async () => {
    const g = khoGia([{ id: 'a', senderPhone: '+84912345678', legacySourceId: 'k' }]);
    const kq = await donSoDienThoai(g.kho, false);
    expect(kq.giuLaiVìKhongDoanDuoc).toBe(1);
    expect(g.dong[0].senderPhone).toBe('+84912345678');
    expect(g.updateMany).not.toHaveBeenCalled();
  });

  it('không đụng đơn thư tạo trên hệ mới', async () => {
    const g = khoGia([{ id: 'a', senderPhone: '...', legacySourceId: null }]);
    const kq = await donSoDienThoai(g.kho, false);
    expect(kq.xoaVeTrong).toBe(0);
    expect(g.dong[0].senderPhone).toBe('...');
  });

  it('không đè lên số cán bộ gõ xen giữa lúc đọc và lúc ghi', async () => {
    const g = khoGia([{ id: 'a', senderPhone: '...', legacySourceId: 'k' }]);
    g.findMany.mockImplementationOnce(async () => {
      const anh = [{ ...g.dong[0] }];
      g.dong[0].senderPhone = '0912345678';
      return anh;
    });
    const kq = await donSoDienThoai(g.kho, false);
    expect(g.dong[0].senderPhone).toBe('0912345678');
    expect(kq.boQuaViCanBoSuaXen).toBe(1);
    expect(kq.xoaVeTrong).toBe(0);
  });

  it('chế độ thử thì đếm nhưng không ghi', async () => {
    const g = khoGia([{ id: 'a', senderPhone: '0000', legacySourceId: 'k' }]);
    const kq = await donSoDienThoai(g.kho, true);
    expect(kq.xoaVeTrong).toBe(1);
    expect(g.updateMany).not.toHaveBeenCalled();
    expect(g.dong[0].senderPhone).toBe('0000');
  });

  it('chạy lần thứ hai không đổi gì thêm', async () => {
    const g = khoGia([{ id: 'a', senderPhone: '...', legacySourceId: 'k' }]);
    await donSoDienThoai(g.kho, false);
    const lan2 = await donSoDienThoai(g.kho, false);
    expect(lan2.xoaVeTrong).toBe(0);
    expect(lan2.chuanHoa).toBe(0);
  });

  it('đi hết nhiều trang, không bỏ sót hồ sơ nào', async () => {
    const nhieu: Dong[] = Array.from({ length: 2500 }, (_, i) => ({
      id: String(i).padStart(5, '0'),
      senderPhone: '...',
      legacySourceId: 'k' + i,
    }));
    const g = khoGia(nhieu);
    const kq = await donSoDienThoai(g.kho, false);
    expect(kq.xoaVeTrong).toBe(2500);
    expect(g.dong.every((d) => d.senderPhone === null)).toBe(true);
  });
});
