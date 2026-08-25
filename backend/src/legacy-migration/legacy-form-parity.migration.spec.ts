import { buildCase, buildCaseStatistic, MAPPED_LEGACY_KEYS } from './legacy-mapper';

/**
 * "Toàn bộ dữ liệu cũ phải được chuyển qua đầy đủ" — yêu cầu anh nêu 26/08/2026.
 *
 * Bộ ca kiểm này lấy MỘT bản ghi hệ cũ điền kín mọi khoá mà form /doi-1/Them có thể sinh
 * ra, rồi khẳng định từng khoá đi vào đúng cột. Trước bản vá, tám mốc ngày thống kê
 * (16.9k–17.8k hồ sơ mỗi khoá) chỉ nằm trong legacy_raw: form mới có ô để hiện, nhưng ô
 * ấy luôn trắng vì builder chưa bao giờ đọc.
 */

/** Mốc thời gian hệ cũ lưu dạng Unix giây. */
const T = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

const HO_SO_HE_CU: Record<string, unknown> = {
  id: 991,
  phan_loai_nguon_tin_ban_dau: 'Vụ án',
  tom_tat_noi_dung: 'Nội dung vụ án thử',

  // Tám mốc ngày của tab TK 48 trường
  ngay_thong_ke: T('2026-08-10T00:00:00Z'),
  ngay_thoi_diem_phan_cong_giai_quyet_to_giac: T('2026-08-02T00:00:00Z'),
  ngay_tiep_nhan_tin: T('2026-08-01T00:00:00Z'),
  ngay_nguoi_pham_toi_dau_thu: T('2026-08-03T00:00:00Z'),
  ngay_pham_toi_qua_tang: T('2026-08-04T00:00:00Z'),
  ngay_nguoi_pham_toi_bi_bat_khan_cap: T('2026-08-05T00:00:00Z'),
  ngay_cqcsdt_phat_hien_co_dau_hieu_pham_toi: T('2026-08-06T00:00:00Z'),
  ngay_xay_ra: T('2026-07-30T00:00:00Z'),

  // Đếm và tiền còn sót
  su_dung_vu_khi_nong: 'Súng ngắn K59',
  so_doi_tuong_vi_pham_hanh_chinh: '3',
  so_luong_nguoi_bi_phat_tien: '2',
  tong_so_tien_phat_hanh_chinh: '15.5',
  so_doi_tuong_suu_tra_hiem_nghi: '4',
  tong_so_bien_ban_ghi_loi_khai: '10',
  so_bien_ban_ghi_loi_khai_co_ghi_am_ghi_hinh: '7',
  tong_so_bien_ban_hoi_cung_bi_can: '6',
  tong_so_bien_ban_hoi_cung_co_ghi_am_ghi_hinh: '5',
  so_bi_can_co_ghi_am_ghi_hinh: '2',
  xac_nhan_vks_yeu_cau_ghi_am_ghi_hinh: '1',
  so_luong_bi_can_vks_yeu_cau_ghi_am_ghi_hinh: '1',

  // Ô tab Vụ việc / Vụ việc TĐC / Vật chứng nay đã có cột trên Vụ án
  quyet_dinh_phan_cong_giai_quyet_nguon_tin: '12/QD-PC02',
  ngay_ra_quyet_dinh_phan_cong_tin_bao: T('2026-08-02T00:00:00Z'),
  quyet_dinh_khong_khoi_to: '05/QD-KKT',
  ngay_ra_quyet_dinh_khong_khoi_to: T('2026-08-03T00:00:00Z'),
  can_cu_ra_quyet_dinh_khong_khoi_to: 'Điều 157 khoản 2',
  vu_viec_chuyen_don_vi_khac: 'CV 88 ngày 04/8',
  nhap_vao_vu_viec_so: '2026-1122',
  phan_loai_dan_su: 'TB 09 ngày 05/8',
  xac_dinh_vu_viec_tam_dung_giai_quyet: '1',
  quyet_dinh_tam_dinh_chi_nguon_tin: '07/QD-TDC',
  ngay_ra_quyet_dinh_tam_dinh_chi_nguon_tin: T('2026-08-05T00:00:00Z'),
  can_cu_tam_dinh_chi_nguon_tin: 'Điều 148',
  ngay_thang_nam_het_thoi_hieu_vu_viec: T('2031-08-05T00:00:00Z'),
  khac_phuc_ly_do_tdc: 'BB trao đổi VKS số 12',
  tien_do_khac_phuc_tdc: 'Đang chờ giám định',
  phuc_hoi_nguon_tin_toi_pham: '02/QD-PH',
  ngay_phuc_hoi_nguon_tin_toi_pham: T('2026-08-20T00:00:00Z'),
  vat_chung: '01 điện thoại iPhone 13',
  lenh_nhap_kho: 'PN 33 ngày 06/8',
  Noi_luu_tru_bao_quan_ke_bien_phong_toa: 'Kho vật chứng PC02',
  noi_xay_ra_phuong_xa: 'Phường Bến Nghé',
  khac_phuc_tdc_vu_an: 'BB TDC vụ án 21',
  bien_phap_khac_phuc_tdc_vu_an: 'Tiến độ khắc phục vụ án',
  quyet_dinh_phuc_hoi_vu_an: '09/QD-PHVA',
  ngay_phuc_hoi_dieu_tra_vu_an: T('2026-08-22T00:00:00Z'),
};

describe('Di trú: mốc thời gian thống kê không còn kẹt trong legacy_raw', () => {
  const stat = buildCaseStatistic(HO_SO_HE_CU) as Record<string, unknown>;

  it.each([
    ['ngayThongKe', '2026-08-10'],
    ['ngayPhanCongGiaiQuyetToGiac', '2026-08-02'],
    ['ngayTiepNhanTin', '2026-08-01'],
    ['ngayDauThu', '2026-08-03'],
    ['ngayPhamToiQuaTang', '2026-08-04'],
    ['ngayBatKhanCap', '2026-08-05'],
    ['ngayPhatHienDauHieu', '2026-08-06'],
  ])('cột %s nhận đúng ngày %s', (cot, ngay) => {
    expect(stat[cot]).toBeInstanceOf(Date);
    expect((stat[cot] as Date).toISOString().slice(0, 10)).toBe(ngay);
  });

  it('vũ khí nóng, vi phạm hành chính và ghi âm ghi hình đều vào cột, không rơi', () => {
    expect(stat.suDungVuKhiNong).toBe('Súng ngắn K59');
    expect(stat.soDoiTuongVPHC).toBe(3);
    expect(stat.soNguoiBiPhatTien).toBe(2);
    expect(stat.tongTienPhatHanhChinh).toBeCloseTo(15.5);
    expect(stat.soDoiTuongSuuTraHiemNghi).toBe(4);
    expect(stat.tongSoBienBanGhiLoiKhai).toBe(10);
    expect(stat.soBienBanGhiLoiKhaiCoGhiAm).toBe(7);
    expect(stat.tongSoBienBanHoiCung).toBe(6);
    expect(stat.tongSoBienBanHoiCungCoGhiAm).toBe(5);
    expect(stat.soBiCanCoGhiAm).toBe(2);
    expect(stat.vksYeuCauGhiAm).toBe(true);
    expect(stat.soBiCanVksYeuCauGhiAm).toBe(1);
  });

  it('hồ sơ không có chỉ tiêu nào thì KHÔNG tạo dòng thống kê rác', () => {
    expect(buildCaseStatistic({ id: 1, tom_tat_noi_dung: 'x' })).toBeUndefined();
  });
});

describe('Di trú: ô hệ cũ mới có cột đều được đổ dữ liệu', () => {
  const c = buildCase(HO_SO_HE_CU) as unknown as Record<string, unknown>;

  it.each([
    ['phanLoaiNguonTinBanDau', 'Vụ án'],
    ['soQDPhanCongNguonTin', '12/QD-PC02'],
    ['soQDKhongKhoiTo', '05/QD-KKT'],
    ['canCuKhongKhoiTo', 'Điều 157 khoản 2'],
    ['chuyenVuViecDonViKhac', 'CV 88 ngày 04/8'],
    ['nhapVaoVuViecSo', '2026-1122'],
    ['phanLoaiDanSu', 'TB 09 ngày 05/8'],
    ['soQDTamDinhChiNguonTin', '07/QD-TDC'],
    ['canCuTamDinhChiNguonTin', 'Điều 148'],
    ['khacPhucLyDoTDCVuViec', 'BB trao đổi VKS số 12'],
    ['tienDoKhacPhucTDCVuViec', 'Đang chờ giám định'],
    ['soPhucHoiNguonTin', '02/QD-PH'],
    ['vatChungMoTa', '01 điện thoại iPhone 13'],
    ['lenhNhapKho', 'PN 33 ngày 06/8'],
    ['noiLuuTruBaoQuan', 'Kho vật chứng PC02'],
    ['noiXayRaPhuongXa', 'Phường Bến Nghé'],
    ['tdcKhacPhucBienBan', 'BB TDC vụ án 21'],
    ['tdcKhacPhucLyDoBienPhap', 'Tiến độ khắc phục vụ án'],
    ['soQuyetDinhPhucHoi', '09/QD-PHVA'],
  ])('cột %s nhận giá trị %s', (cot, giaTri) => {
    expect(c[cot]).toBe(giaTri);
  });

  it.each([
    ['ngayXayRa', '2026-07-30'],
    ['ngayQDPhanCongNguonTin', '2026-08-02'],
    ['ngayQDKhongKhoiTo', '2026-08-03'],
    ['ngayQDTamDinhChiNguonTin', '2026-08-05'],
    ['ngayHetThoiHieuVuViec', '2031-08-05'],
    ['ngayPhucHoiNguonTin', '2026-08-20'],
    ['ngayPhucHoi', '2026-08-22'],
  ])('cột ngày %s nhận %s', (cot, ngay) => {
    expect(c[cot]).toBeInstanceOf(Date);
    expect((c[cot] as Date).toISOString().slice(0, 10)).toBe(ngay);
  });

  it('cờ vụ việc tạm dừng trước 2015 chuyển thành đúng-sai', () => {
    expect(c.vuViecTamDungTruoc2015).toBe(true);
  });

  it('bản gốc vẫn giữ nguyên trong legacyRaw — lưới an toàn không được mỏng đi', () => {
    expect(c.legacyRaw).toMatchObject(HO_SO_HE_CU);
  });
});

describe('Sổ đăng ký khoá đã ánh xạ phản ánh đúng thực tế', () => {
  it.each([
    'ngay_thong_ke',
    'ngay_thoi_diem_phan_cong_giai_quyet_to_giac',
    'ngay_tiep_nhan_tin',
    'ngay_nguoi_pham_toi_dau_thu',
    'ngay_pham_toi_qua_tang',
    'ngay_nguoi_pham_toi_bi_bat_khan_cap',
    'ngay_cqcsdt_phat_hien_co_dau_hieu_pham_toi',
    'su_dung_vu_khi_nong',
    'vat_chung',
    'lenh_nhap_kho',
    'Noi_luu_tru_bao_quan_ke_bien_phong_toa',
    'nhap_vao_vu_viec_so',
    'xac_dinh_vu_viec_tam_dung_giai_quyet',
    'khac_phuc_ly_do_tdc',
    'khac_phuc_tdc_vu_an',
    'bien_phap_khac_phuc_tdc_vu_an',
    'quyet_dinh_phuc_hoi_vu_an',
    'ngay_phuc_hoi_dieu_tra_vu_an',
  ])('khoá %s đã ghi vào sổ đăng ký', (khoa) => {
    // Sổ này là đầu vào của audit-field-coverage.ts. Map rồi mà quên ghi sổ thì báo cáo
    // đối soát vẫn kêu thiếu — và ngược lại, ghi sổ mà chưa map thì báo cáo nói dối.
    expect(MAPPED_LEGACY_KEYS.has(khoa)).toBe(true);
  });
});
