import { khoaTheoTenHeCu, KHOA_HE_CU_NGOAI_PARITY } from './khoa-he-cu';
import { KIEU_TRUONG_HE_CU } from './kieu-truong-he-cu.generated';

/**
 * Bản in của hệ mới phải giống bản in của hệ cũ trên CÙNG một hồ sơ.
 *
 * ── Mốc đúng lấy từ đâu ──
 *
 * KHÔNG lấy từ mã hệ mới. Ba tệp `.docx` ở `docs/uat/in-nhu-he-cu/ban-in-he-cu/` là bản in
 * THẬT tải về từ `pc02hcm.com` ngày 28/08/2026 (chỉ đọc, `GET /doi-1/XuatFile/<id>`), cộng với
 * mã in gốc `_PC02/Modules/doi_1/act/xuatfile.php` và bảng kiểu trường `TruongTuyChinh` đọc từ
 * bản sao CSDL hệ cũ.
 *
 * Ba hồ sơ neo:
 *
 * | id | loai | stt | ngay | thang | nam | hệ cũ in ở đầu văn bản |
 * |----|------|-----|------|-------|-----|------------------------|
 * | 85651 | vu_an_da_phan_loai | 9842 | 21 | 7 | 2026 | `Số: 9842/ĐX-PC02-Đ1` · `ngày 21 tháng 7 năm 2026` |
 * | 86950 | don_thu | 11141 | 24 | 8 | 2026 | `Số: 11141/ĐX-PC02-Đ1` · `ngày 24 tháng 8 năm 2026` |
 * | 86374 | don_thu | 10565 | 9 | 8 | 2026 | `Số: 10565/ĐX-PC02-Đ1` · `ngày 09 tháng 8 năm 2026` |
 *
 * Hồ sơ 86374 là hồ sơ quyết định: nó có ngày MỘT CHỮ SỐ và tháng MỘT CHỮ SỐ, nên nó chứng
 * minh được luật đệm số 0 mà hai hồ sơ kia không phân biệt nổi.
 */
describe('In như hệ cũ — mốc đúng là bản in thật, không phải mã hệ mới', () => {
  /**
   * Hệ cũ in `${stt}` bằng giá trị TRẦN của trường `stt`, không ghép năm.
   *
   * Bằng chứng: `Số: 9842/ĐX-PC02-Đ1` với `stt = 9842`, và `Số: 11141/ĐX-PC02-Đ1` với
   * `stt = 11141`. Mã in gốc chỉ `setValue('stt', (string)$info['stt'])` — không chỗ nào ghép
   * năm vào.
   *
   * Ca kiểm cũ chốt `2026-11253 → 26-11253`. Con số ấy đúng với thứ hệ cũ hiện trên MÀN HÌNH
   * danh sách, nhưng bản in là bề mặt khác và nó in số trần. Ca kiểm ấy viết theo suy đoán nên
   * nó đang bảo vệ đúng chỗ sai.
   */
  it('`stt` in số trần như hệ cũ, KHÔNG ghép năm', () => {
    const k = KHOA_HE_CU_NGOAI_PARITY.find((x) => x.key === 'stt')!;
    expect(k.resolve({ legacyRaw: { stt: 9842, nam: 2026 } })).toBe('9842');
    expect(k.resolve({ caseCode: '2026-11141', legacyRaw: { stt: 11141, nam: 2026 } })).toBe(
      '11141',
    );
  });

  /**
   * `${ngay}`, `${thang}`, `${nam}` là TRƯỜNG CỦA HỒ SƠ, không phải ngày ký văn bản.
   *
   * Hệ cũ đổ thẳng `$info['ngay']`, `$info['thang']`, `$info['nam']`. Hồ sơ 85651 mở đầu bằng
   * `ngày 21 tháng 7 năm 2026` đúng bằng ba trường ấy của bản ghi, dù hồ sơ ấy có ngày đề xuất
   * khác hẳn.
   */
  it('`ngay`/`thang`/`nam` lấy từ chính trường của hồ sơ', () => {
    const hs = {
      ngayDeXuat: new Date('2026-08-27T03:00:00Z'),
      legacyRaw: { ngay: 21, thang: 7, nam: 2026 },
    };
    expect(KHOA_HE_CU_NGOAI_PARITY.find((x) => x.key === 'ngay')!.resolve(hs)).toBe('21');
    expect(KHOA_HE_CU_NGOAI_PARITY.find((x) => x.key === 'thang')!.resolve(hs)).toBe('7');
    expect(KHOA_HE_CU_NGOAI_PARITY.find((x) => x.key === 'nam')!.resolve(hs)).toBe('2026');
  });

  /**
   * Luật đệm số 0 của hệ cũ KHÔNG đối xứng, và đây là chỗ dễ sai nhất.
   *
   * `xuatfile.php` chỉ đệm cho hai khoá `ngay` và `ngay_thang`. Khoá `thang` KHÔNG nằm trong
   * danh sách ấy, nên tháng một chữ số in ra trần.
   *
   * Hồ sơ 86374 (`ngay = 9`, `thang = 8`) in ra `ngày 09 tháng 8 năm 2026` — chứng minh cả hai
   * vế cùng lúc. Đo 28/08/2026: 42.178/55.067 hồ sơ có tháng một chữ số.
   */
  it('đệm số 0 cho `ngay` nhưng KHÔNG đệm cho `thang`', () => {
    const hs = { legacyRaw: { ngay: 9, thang: 8, nam: 2026 } };
    expect(KHOA_HE_CU_NGOAI_PARITY.find((x) => x.key === 'ngay')!.resolve(hs)).toBe('09');
    expect(KHOA_HE_CU_NGOAI_PARITY.find((x) => x.key === 'thang')!.resolve(hs)).toBe('8');
  });

  /**
   * Hồ sơ tạo mới trên hệ mới không có bản thô, nên ba ô ấy phải rơi về ngày ký như trước —
   * không thì văn bản mất hẳn phần "ngày … tháng … năm …".
   */
  it('không có bản thô thì rơi về ngày ký, không in trống', () => {
    const hs = { ngayDeXuat: new Date('2026-08-27T03:00:00Z') };
    expect(KHOA_HE_CU_NGOAI_PARITY.find((x) => x.key === 'ngay')!.resolve(hs)).toBe('27');
    expect(KHOA_HE_CU_NGOAI_PARITY.find((x) => x.key === 'nam')!.resolve(hs)).toBe('2026');
  });

  /**
   * Bốn trường "ngày" mà hệ cũ khai là kiểu CHỮ, không phải kiểu ngày.
   *
   * Bảng `TruongTuyChinh` của hệ cũ khai `ngay_phieu_chuyen`, `ngay_tiep_nhan_nguon_tin`,
   * `ngay_viet_don`, `ngay_cap_cccd_nguyen_don` đều là `text`. Trong 11 trường `date` thật của
   * hệ cũ, chỉ `thoi_han_thuc_hien_uy_thac_dieu_tra` có mặt trên mẫu in.
   *
   * Hệ cũ in nguyên văn thứ cán bộ gõ. Hồ sơ 86374 in `Ngày 09/8/2026` và `ghi ngày 15/7/2026`
   * — hai chuỗi không đệm số 0, đúng như trong CSDL.
   *
   * Hệ mới khai chúng là `DateTime` nên chuẩn hoá thành `09/08/2026`. Nặng hơn: 4.447 hồ sơ có
   * `ngay_viet_don` là chữ tự do (đo 28/08/2026 trên 55.067 hồ sơ) — chuẩn hoá là in ra TRỐNG,
   * mất hẳn thông tin trên văn bản gửi đi.
   */
  it.each([['ngay_phieu_chuyen'], ['ngay_tiep_nhan_nguon_tin'], ['ngay_viet_don']])(
    'trường chữ `%s` in NGUYÊN VĂN, không chuẩn hoá',
    (field) => {
      const k = khoaTheoTenHeCu('petition').find((x) => x.key === field)!;
      expect(k).toBeDefined();
      expect(k.resolve({ legacyRaw: { [field]: '15/7/2026' } })).toBe('15/7/2026');
    },
  );

  it('trường chữ giữ được cả nội dung KHÔNG phải ngày', () => {
    const k = khoaTheoTenHeCu('petition').find((x) => x.key === 'ngay_viet_don')!;
    expect(k.resolve({ legacyRaw: { ngay_viet_don: 'tháng 5/2026' } })).toBe('tháng 5/2026');
    expect(k.resolve({ legacyRaw: { ngay_viet_don: 'không rõ' } })).toBe('không rõ');
  });

  /**
   * `thoi_han_thuc_hien_uy_thac_dieu_tra` là trường `date` THẬT của hệ cũ, nên nó vẫn phải đi
   * qua bộ đọc mốc — giữ đúng ranh giới, không để việc "sửa cho giống" tràn sang trường ngày
   * thật và biến mốc unix thành một chuỗi số trên văn bản.
   */
  it('trường ngày THẬT vẫn định dạng như hệ cũ', () => {
    const k = khoaTheoTenHeCu('petition').find(
      (x) => x.key === 'thoi_han_thuc_hien_uy_thac_dieu_tra',
    );
    expect(k).toBeDefined();
    expect(k!.resolve({ legacyRaw: { thoi_han_thuc_hien_uy_thac_dieu_tra: 0 } })).toBe('');
    expect(k!.resolve({ legacyRaw: { thoi_han_thuc_hien_uy_thac_dieu_tra: 1755000000 } })).toMatch(
      /^\d{2}\/\d{2}\/\d{4}$/,
    );
  });

  /**
   * Hệ cũ `trim()` MỌI giá trị trước khi điền. Đo 28/08/2026: 791 hồ sơ có khoảng trắng thừa ở
   * riêng trường `nguon_don`, và chỗ ấy nằm giữa câu nên thừa một dấu cách là thấy ngay.
   */
  it('cắt khoảng trắng thừa như hệ cũ', () => {
    const k = khoaTheoTenHeCu('petition').find((x) => x.key === 'nguon_don')!;
    expect(k.resolve({ legacyRaw: { nguon_don: 'C02 Bộ Công an ' } })).toBe('C02 Bộ Công an');
  });

  /**
   * Cột typed của hệ mới đứng trước bản thô — giữ nguyên thứ tự ấy, vì hồ sơ tạo mới trên hệ
   * mới không có bản thô. Ca kiểm này canh cho việc "sửa cho giống hệ cũ" không lỡ tay đảo
   * thứ tự và làm hồ sơ mới in ra trống.
   */
  it('hồ sơ tạo mới trên hệ mới (không có bản thô) vẫn in được', () => {
    const k = khoaTheoTenHeCu('petition').find((x) => x.key === 'nguon_don')!;
    expect(k.resolve({ nguonDon: 'Trực tiếp' })).toBe('Trực tiếp');
  });

  /**
   * BẪY của chính bản vá này. Cột typed của hệ mới giữ một đối tượng ngày, và nó đứng trước
   * bản thô. Đổi luật in mà quên chặn đối tượng ngày là in ra `Fri Aug 28 2026 00:00:00 GMT…`
   * giữa văn bản gửi đi — tệ hơn hẳn lỗi đang sửa.
   */
  it('cột ngày của hệ mới KHÔNG in ra chuỗi ngày kiểu máy', () => {
    const k = khoaTheoTenHeCu('petition').find((x) => x.key === 'ngay_viet_don')!;
    expect(k.resolve({ petitionDate: new Date('2026-08-28T00:00:00Z') })).toBe('28/08/2026');
  });

  /**
   * Ô lệch vai còn một dạng nữa: hệ cũ khai chữ, hệ mới lưu thành ô đánh dấu.
   * `truong_hop_bao_cao_ban_giam_doc` ở Vụ việc và Vụ án đổ vào cột `Boolean`, nên bản in cũ
   * ra `Có` thay vì câu cán bộ đã ghi. Mẫu `don_thu_mau.docx` in thẳng ô này giữa văn bản.
   */
  it('ô lệch vai kiểu đánh dấu vẫn in đúng câu cán bộ ghi', () => {
    const k = khoaTheoTenHeCu('incident').find(
      (x) => x.key === 'truong_hop_bao_cao_ban_giam_doc',
    )!;
    expect(k).toBeDefined();
    expect(
      k.resolve({
        baoCaoBanGiamDoc: true,
        legacyRaw: { truong_hop_bao_cao_ban_giam_doc: 'Báo cáo theo chỉ đạo ngày 12/8' },
      }),
    ).toBe('Báo cáo theo chỉ đạo ngày 12/8');
  });

  /**
   * Chốt chặn ngược lại: trường mà HAI hệ cùng khai là chữ thì cột typed vẫn phải đứng trước.
   * Đảo thứ tự ở đây là hồ sơ di trú cán bộ đã sửa trên hệ mới lại in ra bản gốc chưa sửa —
   * đúng thứ khó phát hiện nhất vì bản in vẫn "có chữ", chỉ là chữ cũ.
   */
  it('trường hai hệ cùng khai chữ: bản sửa trên hệ mới thắng bản thô', () => {
    const k = khoaTheoTenHeCu('petition').find((x) => x.key === 'nguon_don')!;
    expect(
      k.resolve({ nguonDon: 'Bưu điện', legacyRaw: { nguon_don: 'Trực tiếp' } }),
    ).toBe('Bưu điện');
  });
});

/**
 * Bộ tra giá trị phải quyết định theo KIỂU CỦA HỆ CŨ, không theo kiểu cột của hệ mới.
 *
 * Hai bảng phục vụ hai việc khác nhau: `field-parity.def.ts` nói lưu vào cột kiểu gì (di trú),
 * còn bản in phải theo `TruongTuyChinh` — thứ quyết định hệ cũ IN ra sao. Trộn hai vai là gốc
 * của cả bốn trường ngày ở trên.
 */
describe('Kiểu trường lấy từ bảng của hệ cũ', () => {
  it('khai đủ 132 trường hồ sơ của hệ cũ', () => {
    expect(Object.keys(KIEU_TRUONG_HE_CU)).toHaveLength(132);
  });

  it.each([
    ['ngay_phieu_chuyen', 'text'],
    ['ngay_tiep_nhan_nguon_tin', 'text'],
    ['ngay_viet_don', 'text'],
    ['ngay_cap_cccd_nguyen_don', 'text'],
    ['thoi_han_thuc_hien_uy_thac_dieu_tra', 'date'],
    ['tom_tat_noi_dung', 'textarea'],
    ['nhan_xet', 'textarea'],
  ])('`%s` là kiểu `%s`', (field, kieu) => {
    expect(KIEU_TRUONG_HE_CU[field]).toBe(kieu);
  });
});
