import { buNoiDung, dangTrong } from './bu-noi-dung-donthu';

const gia = (rows: unknown[]) => {
  const update = jest.fn().mockResolvedValue({});
  let lan = 0;
  const findMany = jest.fn().mockImplementation(() => Promise.resolve(lan++ === 0 ? rows : []));
  return { petition: { findMany, update } } as never;
};

describe('buNoiDung — điền ô nội dung mà không đè chữ cán bộ đã gõ', () => {
  it('ô trống thì điền từ tóm tắt', async () => {
    const p = gia([{ id: 'a', summary: 'Nội dung cũ', detailContent: null }]);
    const kq = await buNoiDung(p, false);
    expect(kq.dienVao).toBe(1);
    expect((p as never as { petition: { update: jest.Mock } }).petition.update).toHaveBeenCalledWith(
      { where: { id: 'a' }, data: { detailContent: 'Nội dung cũ' } },
    );
  });

  /** Cán bộ đã sửa nội dung thì bản cũ KHÔNG được đè lên — đó là mất chữ vừa gõ. */
  it('ô đã có chữ thì không đụng tới', async () => {
    const p = gia([{ id: 'b', summary: 'Nội dung cũ', detailContent: 'Cán bộ đã sửa' }]);
    const kq = await buNoiDung(p, false);
    expect(kq.dienVao).toBe(0);
    expect(kq.boQuaViDaCoChu).toBe(1);
    expect((p as never as { petition: { update: jest.Mock } }).petition.update).not.toHaveBeenCalled();
  });

  it('chế độ thử thì đếm nhưng không ghi', async () => {
    const p = gia([{ id: 'c', summary: 'x', detailContent: null }]);
    const kq = await buNoiDung(p, true);
    expect(kq.dienVao).toBe(1);
    expect((p as never as { petition: { update: jest.Mock } }).petition.update).not.toHaveBeenCalled();
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
