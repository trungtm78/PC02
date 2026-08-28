import { khoaTheoTenHeCu, KHOA_HE_CU_NGOAI_PARITY } from './khoa-he-cu';
import { PARITY } from '../legacy-migration/field-parity.def';

/**
 * Mẫu in của hệ cũ dùng placeholder là CHÍNH TÊN TRƯỜNG hệ cũ (`{tom_tat_noi_dung}`,
 * `{don_vi_giai_quyet}`…). Muốn in được mẫu ấy ở hệ mới thì catalog phải tra được theo tên
 * đó — và tra ra ĐÚNG cột typed mà bộ di trú đã đổ dữ liệu vào.
 *
 * Bảng ánh xạ đã có sẵn: `PARITY` ở `field-parity.def.ts`, nguồn sự thật của epic field-parity.
 * Viết tay lần thứ hai là dựng một hệ song song, và hai bảng sẽ lệch nhau ngay lần sửa đầu.
 */
describe('khoaTheoTenHeCu — khoá catalog mang tên trường hệ cũ', () => {
  it('sinh khoá cho MỌI mục trong bảng parity của thực thể', () => {
    const khoa = khoaTheoTenHeCu('petition');
    const ten = new Set(khoa.map((k) => k.key));
    for (const c of PARITY.petition) {
      expect(ten.has(c.field)).toBe(true);
    }
  });

  it('đọc từ CỘT TYPED trước — hồ sơ tạo mới trên hệ mới không có bản thô', () => {
    const k = khoaTheoTenHeCu('petition').find((x) => x.key === 'tom_tat_noi_dung');
    expect(k).toBeDefined();
    expect(k!.resolve({ detailContent: 'nội dung ở cột typed' })).toBe('nội dung ở cột typed');
  });

  /**
   * Bản thô là lưới an toàn: trường nào chưa kịp thành cột typed vẫn in được, vì hồ sơ di trú
   * luôn mang nguyên tài liệu gốc trong `legacyRaw`.
   */
  it('cột typed rỗng thì rơi về bản thô hệ cũ', () => {
    const k = khoaTheoTenHeCu('petition').find((x) => x.key === 'tom_tat_noi_dung');
    expect(k!.resolve({ detailContent: null, legacyRaw: { tom_tat_noi_dung: 'nội dung bản thô' } }))
      .toBe('nội dung bản thô');
  });

  it('cả hai đều rỗng thì trả chuỗi rỗng, KHÔNG ném — mẫu hệ cũ vốn in cả khi trống', () => {
    const k = khoaTheoTenHeCu('petition').find((x) => x.key === 'tom_tat_noi_dung');
    expect(k!.resolve({})).toBe('');
    expect(k!.resolve({ legacyRaw: null })).toBe('');
  });

  /** Ngày phải in ra chữ Việt như mẫu hệ cũ, không phải chuỗi ISO. */
  it('trường ngày in theo định dạng Việt', () => {
    const k = khoaTheoTenHeCu('petition').find((x) => x.key === 'ngay_viet_don');
    expect(k).toBeDefined();
    expect(k!.resolve({ petitionDate: new Date('2026-08-27T00:00:00Z') })).toMatch(/27.*08.*2026/);
  });

  /** Mốc rỗng của hệ cũ (`0`, `-25200`) không được in ra thành ngày 1970. */
  it('mốc rỗng của hệ cũ không in ra ngày 1970', () => {
    const k = khoaTheoTenHeCu('petition').find((x) => x.key === 'ngay_viet_don');
    expect(k!.resolve({ legacyRaw: { ngay_viet_don: 0 } })).toBe('');
    expect(k!.resolve({ legacyRaw: { ngay_viet_don: -25200 } })).toBe('');
  });

  /** Vụ việc khai `phan_loai_toi_pham_cong_nghe_cao` là cột đúng/sai — in ra chữ, không in `true`. */
  it('trường đúng/sai in ra chữ, không in ra `true`', () => {
    const k = khoaTheoTenHeCu('incident').find((x) => x.key === 'phan_loai_toi_pham_cong_nghe_cao');
    expect(k).toBeDefined();
    expect(k!.resolve({ laCongNgheCaoVV: true })).toBe('Có');
    expect(k!.resolve({ laCongNgheCaoVV: false })).toBe('Không');
  });

  it('mỗi thực thể có bảng khoá riêng, không trộn lẫn', () => {
    const vuAn = new Set(khoaTheoTenHeCu('case').map((k) => k.key));
    const vuViec = new Set(khoaTheoTenHeCu('incident').map((k) => k.key));
    expect(vuAn.size).toBeGreaterThan(20);
    expect(vuViec.size).toBeGreaterThan(20);
  });

  /**
   * Mẫu hệ cũ còn dùng vài biến KHÔNG nằm trong bảng parity — mã hồ sơ và ngày tháng năm in
   * ra trên đầu văn bản. Khai riêng, kèm lý do, chứ không im lặng bỏ qua.
   */
  it.each(['stt', 'nam', 'thang', 'ngay'])('có khoá ngoài bảng parity: %s', (ten) => {
    expect(KHOA_HE_CU_NGOAI_PARITY.some((k) => k.key === ten)).toBe(true);
  });

  it('`stt` in ra mã hồ sơ theo đúng cách hệ cũ hiện — hai chữ số năm', () => {
    const k = KHOA_HE_CU_NGOAI_PARITY.find((x) => x.key === 'stt')!;
    expect(k.resolve({ stt: '2026-11253' })).toBe('26-11253');
    expect(k.resolve({ code: '2026-9705' })).toBe('26-9705');
    expect(k.resolve({ caseCode: '2019-80' })).toBe('19-80');
  });

  it('`ngay`/`thang`/`nam` lấy từ ngày ký, mặc định là hôm nay', () => {
    const ngay = KHOA_HE_CU_NGOAI_PARITY.find((x) => x.key === 'ngay')!;
    const thang = KHOA_HE_CU_NGOAI_PARITY.find((x) => x.key === 'thang')!;
    const nam = KHOA_HE_CU_NGOAI_PARITY.find((x) => x.key === 'nam')!;
    const hs = { ngayDeXuat: new Date('2026-08-27T03:00:00Z') };
    expect(ngay.resolve(hs)).toBe('27');
    expect(thang.resolve(hs)).toBe('08');
    expect(nam.resolve(hs)).toBe('2026');
  });
});

/**
 * Mẫu `an_tra_bo_sung_mau.docx` của hệ cũ in `${toi_danh}` và `${don_vi}`. Không khai hai
 * khoá ấy thì chúng rơi xuống dạng "cán bộ tự điền" và in ra TRỐNG, dù Vụ án đã có sẵn đúng
 * dữ liệu — cán bộ nhìn bản in tưởng hồ sơ chưa nhập tội danh.
 */
describe('Khoá riêng của Vụ án mà mẫu hệ cũ dùng', () => {
  it.each(['toi_danh', 'don_vi'])('có khoá %s', (ten) => {
    expect(khoaTheoTenHeCu('case').some((k) => k.key === ten)).toBe(true);
  });

  it('`toi_danh` đọc tội danh của vụ án', () => {
    const k = khoaTheoTenHeCu('case').find((x) => x.key === 'toi_danh')!;
    expect(k.resolve({ crime: 'Lừa đảo chiếm đoạt tài sản' })).toBe('Lừa đảo chiếm đoạt tài sản');
  });

  it('`don_vi` đọc đơn vị tiếp nhận', () => {
    const k = khoaTheoTenHeCu('case').find((x) => x.key === 'don_vi')!;
    expect(k.resolve({ unit: 'Đội 4' })).toBe('Đội 4');
  });
});
