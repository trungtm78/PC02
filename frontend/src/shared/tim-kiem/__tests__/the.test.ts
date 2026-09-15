import { describe, it, expect } from 'vitest';
import {
  KHOA_TAT_CA,
  SO_GIA_TRI_TOI_DA,
  boGiaTri,
  boThe,
  demGiaTri,
  docTheTuThamSo,
  ghiTheRaUrl,
  khoaHopLe,
  laGiaTriNgay,
  themGiaTri,
  type The,
} from '../the';

const KHAI = [
  { key: 'nguoiGui', nhan: 'Người gửi', kieu: 'chu' },
  { key: 'ngayDeXuat', nhan: 'Ngày đề xuất', kieu: 'ngay' },
] as const;

describe('thẻ tìm kiếm — đọc/ghi URL', () => {
  it('cùng khoá gộp MỘT thẻ, giữ thứ tự xuất hiện đầu tiên', () => {
    const the = docTheTuThamSo(
      new URLSearchParams('p_tk=nguoiGui~An&p_tk=*~abc&p_tk=nguoiGui~Binh'),
      'p',
    );
    expect(the).toEqual([
      { khoa: 'nguoiGui', giaTri: ['An', 'Binh'] },
      { khoa: '*', giaTri: ['abc'] },
    ]);
  });

  it('dấu ~ trong GIÁ TRỊ được giữ nguyên — chỉ tách ở dấu đầu tiên', () => {
    expect(docTheTuThamSo(new URLSearchParams('p_tk=*~a~b'), 'p')).toEqual([
      { khoa: '*', giaTri: ['a~b'] },
    ]);
  });

  it('bỏ mục rỗng, mục thiếu dấu ~, giá trị trùng', () => {
    const the = docTheTuThamSo(
      new URLSearchParams('p_tk=&p_tk=abc&p_tk=nguoiGui~&p_tk=nguoiGui~ An &p_tk=nguoiGui~An'),
      'p',
    );
    expect(the).toEqual([{ khoa: 'nguoiGui', giaTri: ['An'] }]);
  });

  it('khứ hồi đọc → ghi → đọc giữ nguyên', () => {
    const the: The[] = [
      { khoa: 'nguoiGui', giaTri: ['An', 'Bình'] },
      { khoa: KHOA_TAT_CA, giaTri: ['50% ~ x'] },
    ];
    const sp = new URLSearchParams();
    for (const v of ghiTheRaUrl(the)) sp.append('p_tk', v);
    expect(docTheTuThamSo(sp, 'p')).toEqual(the);
  });

  /**
   * Đường dẫn cũ còn nằm trong dấu trang và tin nhắn của cán bộ. Mở ra mà mất bộ lọc thì người
   * ta tưởng hồ sơ biến mất — nên tham số cũ phải thành thẻ, không bị bỏ qua.
   */
  it('tham số cũ (`q`, ô lọc chữ) đọc thành thẻ', () => {
    const the = docTheTuThamSo(
      new URLSearchParams('p_q=abc&p_sender=Nguyen&p_tk=nguoiGui~Tran&p_page=3'),
      'p',
      { q: KHOA_TAT_CA, sender: 'nguoiGui' },
    );
    expect(the).toEqual([
      { khoa: 'nguoiGui', giaTri: ['Tran', 'Nguyen'] },
      { khoa: '*', giaTri: ['abc'] },
    ]);
  });
});

describe('thẻ tìm kiếm — sửa', () => {
  const goc: The[] = [{ khoa: 'nguoiGui', giaTri: ['An'] }];

  it('thêm giá trị vào khoá đã có → "hoặc" trong cùng thẻ', () => {
    expect(themGiaTri(goc, 'nguoiGui', ' Bình ')).toEqual([
      { khoa: 'nguoiGui', giaTri: ['An', 'Bình'] },
    ]);
  });

  it('thêm khoá mới → thẻ mới ở cuối; trùng hoặc rỗng → không đổi', () => {
    expect(themGiaTri(goc, '*', 'x')).toEqual([...goc, { khoa: '*', giaTri: ['x'] }]);
    expect(themGiaTri(goc, 'nguoiGui', 'An')).toBe(goc);
    expect(themGiaTri(goc, 'nguoiGui', '   ')).toBe(goc);
  });

  it('cắt giá trị về 200 ký tự như máy chủ nhận', () => {
    const dai = 'a'.repeat(250);
    expect(themGiaTri([], '*', dai)[0].giaTri[0]).toHaveLength(200);
  });

  it(`quá ${SO_GIA_TRI_TOI_DA} giá trị → không thêm (máy chủ sẽ trả 400)`, () => {
    let the: The[] = [];
    for (let i = 0; i < SO_GIA_TRI_TOI_DA; i++) the = themGiaTri(the, '*', `v${i}`);
    expect(demGiaTri(the)).toBe(SO_GIA_TRI_TOI_DA);
    expect(themGiaTri(the, '*', 'thua')).toBe(the);
  });

  it('bỏ một giá trị; bỏ giá trị cuối cùng thì bỏ luôn thẻ', () => {
    const hai: The[] = [{ khoa: 'nguoiGui', giaTri: ['An', 'Bình'] }];
    expect(boGiaTri(hai, 'nguoiGui', 'An')).toEqual([{ khoa: 'nguoiGui', giaTri: ['Bình'] }]);
    expect(boGiaTri(goc, 'nguoiGui', 'An')).toEqual([]);
  });

  it('bỏ cả thẻ', () => {
    expect(boThe([...goc, { khoa: '*', giaTri: ['x'] }], 'nguoiGui')).toEqual([
      { khoa: '*', giaTri: ['x'] },
    ]);
  });
});

describe('thẻ tìm kiếm — hợp lệ', () => {
  it('khoá hợp lệ: "*" hoặc có trong khai', () => {
    expect(khoaHopLe('*', KHAI)).toBe(true);
    expect(khoaHopLe('nguoiGui', KHAI)).toBe(true);
    expect(khoaHopLe('cotDaDoiTen', KHAI)).toBe(false);
  });

  it.each([
    ['12/09/2026', true],
    ['1/9/2026', true],
    ['2026-09-12', true],
    ['09/2026', true],
    ['2026', true],
    ['31/02/2026', false],
    ['13/2026', false],
    ['1899', false],
    ['12-09-2026', false],
    ['abc', false],
  ])('ngày "%s" → %s (cùng quy ước với máy chủ)', (v, mong) => {
    expect(laGiaTriNgay(v)).toBe(mong);
  });
});
