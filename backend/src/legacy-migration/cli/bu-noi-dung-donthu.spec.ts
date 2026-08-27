import { buNoiDung, dangTrong } from './bu-noi-dung-donthu';

/**
 * Bản giả TÔN TRỌNG `where`, con trỏ và câu ghi có điều kiện.
 *
 * Bản giả bỏ qua tham số thì ca kiểm xanh vì lý do sai: nó không phát hiện được `where` thiếu
 * phạm vi, không bao giờ đi qua trang thứ hai, và không phản ánh trạng thái sau khi ghi — tức
 * không chứng minh được điều quan trọng nhất, là chạy hai lần cho kết quả như một.
 */
type Dong = {
  id: string;
  summary: string | null;
  detailContent: string | null;
  legacySourceId: string | null;
};

function khoGia(dong: Dong[]) {
  const findMany = jest.fn(async (a: unknown) => {
    const arg = a as {
      where: { summary?: unknown; legacySourceId?: unknown };
      take: number;
      cursor?: { id: string };
    };
    let ds = dong.filter((d) => d.summary !== null);
    if (arg.where.legacySourceId) ds = ds.filter((d) => d.legacySourceId !== null);
    ds = [...ds].sort((x, y) => (x.id < y.id ? -1 : 1));
    if (arg.cursor) {
      const i = ds.findIndex((d) => d.id === arg.cursor?.id);
      ds = ds.slice(i + 1);
    }
    return ds.slice(0, arg.take).map((d) => ({ ...d }));
  });

  // Áp ĐÚNG điều kiện được truyền vào, không tự cài sẵn. Bản giả tự kiểm hộ thì ca kiểm
  // TOCTOU xanh cả khi câu ghi thật bỏ mất điều kiện — đúng kiểu xanh giả cần tránh.
  const updateMany = jest.fn(async (a: unknown) => {
    const arg = a as {
      where: { id: string; OR?: { detailContent: string | null }[] };
      data: { detailContent: string };
    };
    const d = dong.find((x) => x.id === arg.where.id);
    if (!d) return { count: 0 };
    if (arg.where.OR && !arg.where.OR.some((k) => k.detailContent === d.detailContent)) {
      return { count: 0 };
    }
    d.detailContent = arg.data.detailContent;
    return { count: 1 };
  });

  return { kho: { petition: { findMany, updateMany } } as never, findMany, updateMany, dong };
}

const mot = (): Dong[] => [
  { id: 'a', summary: 'Nội dung cũ', detailContent: null, legacySourceId: 'k' },
];

describe('buNoiDung — điền ô nội dung mà không đè chữ cán bộ đã gõ', () => {
  it('ô trống thì điền từ tóm tắt', async () => {
    const g = khoGia(mot());
    const kq = await buNoiDung(g.kho, false);
    expect(kq.dienVao).toBe(1);
    expect(g.dong[0].detailContent).toBe('Nội dung cũ');
  });

  it('chạy lần thứ hai không đổi gì thêm', async () => {
    const g = khoGia(mot());
    await buNoiDung(g.kho, false);
    const lan2 = await buNoiDung(g.kho, false);
    expect(lan2.dienVao).toBe(0);
    expect(lan2.boQuaViDaCoChu).toBe(1);
  });

  it('ô đã có chữ thì không đụng tới', async () => {
    const g = khoGia([
      { id: 'b', summary: 'Nội dung cũ', detailContent: 'Cán bộ đã sửa', legacySourceId: 'k' },
    ]);
    const kq = await buNoiDung(g.kho, false);
    expect(kq.dienVao).toBe(0);
    expect(kq.boQuaViDaCoChu).toBe(1);
    expect(g.updateMany).not.toHaveBeenCalled();
  });

  it('bỏ qua đơn thư tạo trên hệ mới, chỉ đụng hồ sơ di trú', async () => {
    const g = khoGia([
      { id: 'a', summary: 'của hệ mới', detailContent: null, legacySourceId: null },
      { id: 'b', summary: 'của hệ cũ', detailContent: null, legacySourceId: 'k' },
    ]);
    const kq = await buNoiDung(g.kho, false);
    expect(kq.dienVao).toBe(1);
    expect(g.dong[0].detailContent).toBeNull();
    expect(g.dong[1].detailContent).toBe('của hệ cũ');
  });

  /** Ảnh chụp nói ô trống, nhưng cán bộ gõ vào giữa chừng — câu ghi phải tự bỏ qua. */
  it('không đè chữ cán bộ gõ xen giữa lúc đọc và lúc ghi', async () => {
    const g = khoGia(mot());
    g.findMany.mockImplementationOnce(async () => {
      const anh = [{ ...g.dong[0] }];
      g.dong[0].detailContent = 'cán bộ vừa gõ';
      return anh;
    });
    const kq = await buNoiDung(g.kho, false);
    expect(g.dong[0].detailContent).toBe('cán bộ vừa gõ');
    expect(kq.dienVao).toBe(0);
    expect(kq.boQuaViDaCoChu).toBe(1);
  });

  it('chế độ thử thì đếm nhưng không ghi', async () => {
    const g = khoGia([{ id: 'c', summary: 'x', detailContent: null, legacySourceId: 'k' }]);
    const kq = await buNoiDung(g.kho, true);
    expect(kq.dienVao).toBe(1);
    expect(g.updateMany).not.toHaveBeenCalled();
    expect(g.dong[0].detailContent).toBeNull();
  });

  /** Hơn một trang: bản giả cũ chỉ trả một mẻ nên không bao giờ đi qua đường con trỏ. */
  it('đi hết nhiều trang, không bỏ sót hồ sơ nào', async () => {
    const nhieu: Dong[] = Array.from({ length: 2500 }, (_, i) => ({
      id: String(i).padStart(5, '0'),
      summary: 'nội dung ' + i,
      detailContent: null,
      legacySourceId: 'k' + i,
    }));
    const g = khoGia(nhieu);
    const kq = await buNoiDung(g.kho, false);
    expect(kq.dienVao).toBe(2500);
    expect(g.dong.every((d) => d.detailContent !== null)).toBe(true);
  });

  it.each([
    [null, true],
    [undefined, true],
    ['', true],
    ['   ', true],
    ['a', false],
  ])('dangTrong(%s) = %s', (v, mong) => {
    expect(dangTrong(v as string | null)).toBe(mong);
  });
});
