import { ngayVietDonHienThi } from './ngay-viet-don.util';

/**
 * Một nơi duy nhất quyết định "Ngày viết đơn" hiện thế nào.
 *
 * Hồ sơ giữ hai cột (`petitionDate` ngày thật + `ngayVietDonEdtf`), nên mỗi nơi tự ghép là
 * mời chúng trôi khỏi nhau: nơi này in "__/12/2026", nơi kia in rỗng, nơi thứ ba bịa ngày 01.
 */
describe('ngayVietDonHienThi', () => {
  it.each([
    ['2026-12-15', '15/12/2026'],
    ['2026-12-XX', '__/12/2026'],
    ['2026-XX-XX', '__/__/2026'],
  ])('EDTF %s → %s', (edtf, mong) => {
    expect(ngayVietDonHienThi({ ngayVietDonEdtf: edtf })).toBe(mong);
  });

  it('hồ sơ CŨ chưa có cột EDTF thì vẫn in được từ cột ngày thật', () => {
    expect(
      ngayVietDonHienThi({ petitionDate: new Date('2026-12-15T00:00:00Z') }),
    ).toBe('15/12/2026');
  });

  it('EDTF thắng cột ngày thật khi có cả hai — EDTF là thứ cán bộ đã gõ', () => {
    expect(
      ngayVietDonHienThi({
        petitionDate: new Date('2026-12-01T00:00:00Z'),
        ngayVietDonEdtf: '2026-12-XX',
      }),
    ).toBe('__/12/2026');
  });

  it('không có gì → chuỗi rỗng, KHÔNG in "__/__/____" trống trơn lên chứng từ', () => {
    expect(ngayVietDonHienThi({})).toBe('');
    expect(
      ngayVietDonHienThi({ petitionDate: null, ngayVietDonEdtf: null }),
    ).toBe('');
  });

  it('chuỗi EDTF hỏng thì lùi về cột ngày thật, không nổ', () => {
    expect(
      ngayVietDonHienThi({
        ngayVietDonEdtf: 'rác',
        petitionDate: new Date('2026-01-02T00:00:00Z'),
      }),
    ).toBe('02/01/2026');
  });
});

/**
 * Hồ sơ DI TRÚ: thông tin chỉ nằm ở bản thô hệ cũ, hai cột đều rỗng.
 *
 * Đo bản sao prod 20/09/2026: 46.580 hồ sơ có `legacyRaw.ngay_viet_don`, trong đó **4.435 hồ sơ
 * là CHỮ TỰ DO** — "Không ghi ngày", "tháng 5/2026", "28/12/2023, 19/12/2023 (03 đơn)…". Những
 * hồ sơ ấy có `petitionDate` NULL và cột EDTF NULL, nên hàm này trả rỗng và bản in ra TRỐNG.
 *
 * Bắt được khi chạy UAT thật: in `PHIEU_CHUYEN_DON` cho hồ sơ `cmtbu9xzl…` (thô = "Không ghi
 * ngày") thì ô ngày trên bản in trống trơn. Mẫu HE_CU_* thì không sao vì `khoa-he-cu.ts` cho bản
 * thô thắng — nhưng mẫu PC01 đi thẳng qua hàm này, nên cả một họ mẫu bị hở.
 *
 * Vá ở ĐÂY chứ không ở từng mẫu: cổng `moiNoiInNgayVietDon` đã bắt mọi nơi in phải đi qua hàm
 * này, nên vá một chỗ là mọi mẫu được đỡ.
 */
describe('ngayVietDonHienThi — hồ sơ di trú chỉ có bản thô', () => {
  it('cả hai cột rỗng mà bản thô có chữ → in NGUYÊN VĂN bản thô', () => {
    expect(
      ngayVietDonHienThi({
        petitionDate: null,
        ngayVietDonEdtf: null,
        legacyRaw: { ngay_viet_don: 'Không ghi ngày' },
      }),
    ).toBe('Không ghi ngày');
  });

  it('cột EDTF có thì THẮNG bản thô — cán bộ đã sửa trên hệ mới', () => {
    expect(
      ngayVietDonHienThi({
        petitionDate: null,
        ngayVietDonEdtf: '2026-12-XX',
        legacyRaw: { ngay_viet_don: 'Không ghi ngày' },
      }),
    ).toBe('__/12/2026');
  });

  it('cột ngày thật có thì cũng THẮNG bản thô', () => {
    expect(
      ngayVietDonHienThi({
        petitionDate: '2026-12-15T00:00:00.000Z',
        ngayVietDonEdtf: null,
        legacyRaw: { ngay_viet_don: 'Không ghi ngày' },
      }),
    ).toBe('15/12/2026');
  });

  it('bản thô chỉ-khoảng-trắng thì bỏ qua, không in ra một ô toàn dấu cách', () => {
    expect(
      ngayVietDonHienThi({
        petitionDate: null,
        ngayVietDonEdtf: null,
        legacyRaw: { ngay_viet_don: '   ' },
      }),
    ).toBe('');
  });

  it('không có bản thô thì vẫn trả rỗng như cũ', () => {
    expect(ngayVietDonHienThi({ petitionDate: null, ngayVietDonEdtf: null })).toBe('');
  });
});
