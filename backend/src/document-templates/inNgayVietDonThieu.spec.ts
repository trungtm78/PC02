import { khoaTheoTenHeCu } from './khoa-he-cu';

/**
 * Bản in Word của hệ cũ dùng `{ngay_viet_don}`. Đơn nhập THIẾU thành phần phải in ra
 * `__/12/2026`, KHÔNG được in chỗ trống.
 *
 * Lỗi đã gặp: khoá ấy đọc thẳng cột `petitionDate` — mà đơn nhập thiếu thì cột ấy NULL theo
 * đúng thiết kế. Kết quả: một văn bản gửi ra ngoài ngành thiếu đúng cái ngày cán bộ ĐÃ nhập,
 * và thiếu im lặng — bản in trông vẫn bình thường.
 */
function inRa(record: Record<string, unknown>): string {
  const f = khoaTheoTenHeCu('petition').find((x) => x.key === 'ngay_viet_don');
  if (!f) throw new Error('không có khoá ngay_viet_don');
  return f.resolve(record);
}

describe('In `{ngay_viet_don}` cho đơn nhập thiếu thành phần', () => {
  it('nhập ĐỦ → in ngày đầy đủ', () => {
    expect(
      inRa({
        petitionDate: new Date('2026-12-15T00:00:00Z'),
        ngayVietDonEdtf: '2026-12-15',
      }),
    ).toContain('15');
  });

  it('nhập THIẾU ngày → in "__/12/2026", KHÔNG in chỗ trống', () => {
    expect(inRa({ petitionDate: null, ngayVietDonEdtf: '2026-12-XX' })).toBe(
      '__/12/2026',
    );
  });

  it('chỉ có năm → "__/__/2026"', () => {
    expect(inRa({ petitionDate: null, ngayVietDonEdtf: '2026-XX-XX' })).toBe(
      '__/__/2026',
    );
  });

  it('hồ sơ CŨ chỉ có cột ngày thật vẫn in được', () => {
    expect(inRa({ petitionDate: new Date('2026-12-15T00:00:00Z') })).toContain(
      '2026',
    );
  });

  it('không có ngày nào → chuỗi rỗng, không in "__/__/____" trống trơn', () => {
    expect(inRa({})).toBe('');
  });
});
