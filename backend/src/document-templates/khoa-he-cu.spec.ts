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

  /**
   * Mốc rỗng của hệ cũ (`0`, `-25200`) không được in ra thành ngày 1970.
   *
   * Ca kiểm này trước đây dùng `ngay_viet_don`, nhưng hệ cũ khai trường ấy là kiểu CHỮ nên nó
   * không bao giờ giữ mốc số — đo 28/08/2026 trên 55.067 hồ sơ: 0 bản ghi có `0` hay `-25200`,
   * còn 8.389 bản ghi để rỗng. Bẫy là thật, chỉ là đặt nhầm nhà nên nó không canh gì cả.
   *
   * `thoi_han_thuc_hien_uy_thac_dieu_tra` mới là trường `date` thật và có mặt trên mẫu in
   * (`uy_thac_dieu_tra_mau.docx`): 18.212 bản ghi, tất cả đều là mốc số.
   */
  it('mốc rỗng của hệ cũ không in ra ngày 1970', () => {
    const k = khoaTheoTenHeCu('petition').find(
      (x) => x.key === 'thoi_han_thuc_hien_uy_thac_dieu_tra',
    );
    expect(k!.resolve({ legacyRaw: { thoi_han_thuc_hien_uy_thac_dieu_tra: 0 } })).toBe('');
    expect(k!.resolve({ legacyRaw: { thoi_han_thuc_hien_uy_thac_dieu_tra: -25200 } })).toBe('');
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

  /**
   * Hệ cũ in `${stt}` bằng số TRẦN, không ghép năm — xem `in-nhu-he-cu.spec.ts` cho bằng chứng
   * từ ba bản in thật. Kỳ vọng cũ (`26-11253`) đúng với thứ hệ cũ hiện trên màn hình danh sách,
   * nhưng bản in là bề mặt khác.
   */
  it('`stt` in số hồ sơ trần, cắt phần năm khỏi mã', () => {
    const k = KHOA_HE_CU_NGOAI_PARITY.find((x) => x.key === 'stt')!;
    expect(k.resolve({ stt: '2026-11253' })).toBe('11253');
    expect(k.resolve({ code: '2026-9705' })).toBe('9705');
    expect(k.resolve({ caseCode: '2019-80' })).toBe('80');
  });

  /**
   * Không có bản thô (hồ sơ tạo mới trên hệ mới) thì ba ô đầu văn bản rơi về ngày ký. Tháng
   * KHÔNG đệm số 0, đúng luật của hệ cũ — xem `in-nhu-he-cu.spec.ts`.
   */
  it('`ngay`/`thang`/`nam` rơi về ngày ký khi hồ sơ không có bản thô', () => {
    const ngay = KHOA_HE_CU_NGOAI_PARITY.find((x) => x.key === 'ngay')!;
    const thang = KHOA_HE_CU_NGOAI_PARITY.find((x) => x.key === 'thang')!;
    const nam = KHOA_HE_CU_NGOAI_PARITY.find((x) => x.key === 'nam')!;
    const hs = { ngayDeXuat: new Date('2026-08-27T03:00:00Z') };
    expect(ngay.resolve(hs)).toBe('27');
    expect(thang.resolve(hs)).toBe('8');
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

/**
 * Ba bẫy codex bắt được sau khi bản vá đầu đã xanh — cả ba đều in ra SAI trên văn bản gửi đi,
 * chứ không phải chỉ để trống.
 */
describe('Bẫy đã trả giá một lần', () => {
  /**
   * Bộ di trú đo trên 53.796 hồ sơ: đọc mốc epoch của hệ cũ theo UTC hay theo giờ VN đều khớp
   * 0%, chỉ `+50400s` khớp 100%. Tự đổi bằng `new Date(n * 1000)` là in ra SỚM MỘT NGÀY.
   */
  it('mốc epoch hệ cũ in đúng ngày, không sớm một ngày', () => {
    const k = khoaTheoTenHeCu('petition').find(
      (x) => x.key === 'thoi_han_thuc_hien_uy_thac_dieu_tra',
    )!;
    // Mốc 1787824800 là chỗ hai cách đọc cho ra NGÀY KHÁC NHAU: nhân 1000 thô ra 27/08,
    // cộng 50400s ra 28/08. Chọn đúng mốc ấy thì ca kiểm mới bắt được lỗi.
    expect(k.resolve({ legacyRaw: { thoi_han_thuc_hien_uy_thac_dieu_tra: 1787824800 } })).toBe(
      '28/08/2026',
    );
  });

  /**
   * Vụ án di trú có `caseCode` rỗng thì mã hồ sơ nằm ở bản thô. Mọi mẫu hệ cũ đều in `${stt}`,
   * nên trả rỗng là văn bản mất số hồ sơ.
   */
  it('`stt` rơi về bản thô khi mã hồ sơ chưa có', () => {
    const k = KHOA_HE_CU_NGOAI_PARITY.find((x) => x.key === 'stt')!;
    expect(k.resolve({ caseCode: null, legacyRaw: { stt: '9705', nam: 2026 } })).toBe('9705');
    expect(k.resolve({ caseCode: null, soHoSoCu: '2019-80' })).toBe('80');
  });

  /**
   * `${ten_ngan}` đứng ở dòng "Lưu:" — hệ cũ đọc chuỗi cán bộ TỰ ĐẶT ở `thanh_vien.ten_ngan`,
   * không suy ra từ họ tên. Kỳ vọng cũ (`H.Duy` suy từ tên) sai với 210/238 cán bộ; chi tiết và
   * số đo ở `in-nhu-he-cu.spec.ts`.
   */
  it('`ten_ngan` in đúng chuỗi cán bộ tự đặt', () => {
    const k = KHOA_HE_CU_NGOAI_PARITY.find((x) => x.key === 'ten_ngan')!;
    expect(
      k.resolve({ enteredBy: { lastName: 'Trần Hoàng', firstName: 'Duy', shortName: 'H.Duy' } }),
    ).toBe('H.Duy');
    // Chưa có chuỗi ấy thì rơi về họ tên đầy đủ, đúng nhánh `?? $nguoi_nhan` của hệ cũ.
    expect(k.resolve({ enteredBy: { lastName: 'Trần Hoàng', firstName: 'Duy' } })).toBe(
      'Trần Hoàng Duy',
    );
  });

  it('`nguoi_nhan` vẫn in tên đầy đủ', () => {
    const k = KHOA_HE_CU_NGOAI_PARITY.find((x) => x.key === 'nguoi_nhan')!;
    expect(k.resolve({ enteredBy: { lastName: 'Trần Hoàng', firstName: 'Duy' } })).toBe('Trần Hoàng Duy');
  });
});
