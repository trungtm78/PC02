/**
 * field-mapping.seed.ts — BẢNG MAP field cũ (ho_so) → cột hệ mới, theo từng thực thể.
 *
 * Nguồn: phân tích `legacy-mapper.ts` hiện tại + catalog `TruongTuyChinh` (nhãn thật).
 * Đây là DỮ LIỆU (không phải code imperative) → builder PR-3 đọc để set field.
 * Field không có trong bảng của 1 thực thể → vào `metadata`/`legacyRaw` hoặc UNMAPPED (cần quyết).
 *
 * `RESOLVE`: field cần biến đổi đặc biệt (không map thẳng chuỗi).
 * `DROP`: field hệ thống/tìm kiếm — không migrate.
 */

/** ho_so.phan_loai_nguon_tin_ban_dau → thực thể đích. */
export const PHAN_LOAI_TO_ENTITY: Record<string, 'petition' | 'incident' | 'case' | 'guidance' | 'exchange' | 'proposal' | 'lawyer'> = {
  'don-cong-van-ban-dau': 'petition',
  'vu-viec-ban-dau': 'incident',
  'vu-viec-nguon-tin': 'incident',
  'cong-van-don-doc-phuc-hoi-tdc': 'incident',
  'vu-an-ban-dau': 'case',
  'uy-thac-dieu-tra': 'case',
  'tra-ho-so-ban-dau': 'case',
  'huong-dan': 'guidance',
  'huong-dan-ban-dau': 'guidance',
  'trao-doi-chuyen-an': 'exchange',
  'kien-nghi-vks': 'proposal',
  'luat-su': 'lawyer',
};

/** legacyField → cột Prisma trên PETITION. */
export const PETITION_MAP: Record<string, string> = {
  ten_ca_nhan_co_quan_to_chuc_cung_cap: 'senderName',
  so_dien_thoai_nguyen_don: 'senderPhone',
  so_cccd_nguyen_don: 'senderIdNumber',
  ngay_cap_cccd_nguyen_don: 'senderIdIssueDate',
  noi_cap_cccd_nguyen_don: 'senderIdIssuePlace',
  'dia-chi-bi-hai': 'senderAddress',
  nghi_van_doi_tuong: 'suspectedPerson',
  tom_tat_noi_dung: 'summary',
  nguon_don: 'nguonDon',
  loai_thong_tin: 'loaiThongTin',
  so_phieu_chuyen: 'soPhieuChuyen',
  ngay_phieu_chuyen: 'ngayPhieuChuyen',
  ngay_tiep_nhan_nguon_tin: 'ngayTiepNhanNguonTin',
  'toi-danh-ban-dau': 'toiDanhBanDau',
  noi_xay_ra: 'noiXayRa',
  ngay_giao_don_vi_giai_quyet: 'ngayGiaoDonViGiaiQuyet',
  lanh_dao_to_tung: 'lanhDaoToTung',
  ket_qua_xu_ly_giai_quyet_khac: 'ketQuaXuLyKhac',
  ngay_viet_don: 'petitionDate',
  nhan_xet: 'nhanThay',
  ghi_chu_trung_don: 'raSoatTrung',
  ngay_de_xuat: 'ngayDeXuat',
  dieu_tra_vien: 'dieuTraVien',
  truong_hop_bao_cao_ban_giam_doc: 'baoCaoBanGiamDoc',
  phan_loai_toi_pham_cong_nghe_cao: 'laCongNgheCao',
  phuong_thuc_thu_doan: 'phuongThucThuDoan',
  ngay_xay_ra: 'ngayXayRa',
  noi_xay_ra_phuong_xa: 'noiXayRaPhuongXa',
  loai_toi_pham: 'loaiToiPham',
  thoi_han_thuc_hien_uy_thac_dieu_tra: 'thoiHanUTDT',
  sinh_nam_nguoi_to_giac: 'senderBirthYear',
};

/** legacyField → cột Prisma trên INCIDENT. */
export const INCIDENT_MAP: Record<string, string> = {
  tom_tat_noi_dung: 'name', // + description (builder set cả hai)
  nguon_don: 'chuyenTuDonVi',
  tinh_trang: 'tinhTrangHoSo',
  'dia-chi-bi-hai': 'diaChiNguoiToGiac',
  ngay_de_xuat: 'ngayDeXuat',
  noi_xay_ra: 'diaChiXayRa',
  so_dien_thoai_nguyen_don: 'sdtNguoiToGiac',
  so_cccd_nguyen_don: 'cmndNguoiToGiac',
  ten_ca_nhan_co_quan_to_chuc_cung_cap: 'benVu',
  nghi_van_doi_tuong: 'doiTuongCaNhan',
  don_vi_giai_quyet: 'donViGiaiQuyet',
  quyet_dinh_phan_cong_giai_quyet_nguon_tin: 'soQDPhanCongNguonTin',
  ngay_ra_quyet_dinh_phan_cong_tin_bao: 'ngayQDPhanCongNguonTin',
  can_cu_ra_quyet_dinh_khong_khoi_to: 'canCuKhongKhoiTo',
  can_cu_tam_dinh_chi_nguon_tin: 'canCuTamDinhChi',
  phan_loai_dan_su: 'phanLoaiDanSuText',
  quyet_dinh_tam_dinh_chi_nguon_tin: 'soQuyetDinhTamDinhChiVV',
  ngay_ra_quyet_dinh_tam_dinh_chi_nguon_tin: 'ngayTamDinhChiVV',
  phuc_hoi_nguon_tin_toi_pham: 'soQuyetDinhPhucHoiVV',
  ngay_phuc_hoi_nguon_tin_toi_pham: 'ngayPhucHoiVV',
  ngay_thang_nam_het_thoi_hieu_vu_viec: 'ngayHetThoiHieuVV',
  tien_do_khac_phuc_tdc: 'tienDoKhacPhucTDC',
  vu_viec_chuyen_don_vi_khac: 'chuyenDenDonVi',
};

/** legacyField → cột Prisma trên CASE. */
export const CASE_MAP: Record<string, string> = {
  'toi-danh-ban-dau': 'crime', // + name (builder rút gọn caseTitle)
  quyet_dinh_khoi_to_vu_an: 'soQuyetDinhKhoiTo',
  ngay_ra_quyet_dinh_khoi_to: 'ngayKhoiTo',
  quyet_dinh_tam_dinh_chi_vu_an: 'soQuyetDinhTamDinhChi',
  ngay_tam_dinh_chi_vu_an: 'ngayTamDinhChi',
  ngay_het_thoi_hieu_truy_cuu_tnhs_vu_an: 'ngayHetThoiHieu',
  quyet_dinh_nhap_vu_an: 'soQDNhapVuAn',
  ngay_nhap_vu_an: 'ngayNhapVuAn',
  ghi_chu_nhap_ho_so: 'ghiChuNhapHoSo',
  quyet_dinh_tach_vu_an: 'soQDTachVuAn',
  ngay_tach_ho_so: 'ngayTachVuAn',
  dinh_chi_vu_an: 'soQDDinhChiVuAn',
  chuyen_vu_an_cho_co_quan_khac: 'chuyenVuAnChoCQK',
  so_ban_an_co_hieu_luc: 'soBanAnCoHieuLuc',
  ket_luan_dieu_tra_vu_an: 'soKLDT',
  ngay_ket_luan_dieu_tra: 'ngayKLDT',
  quyet_dinh_dieu_tra_lai: 'soQDDieuTraLai',
  quyet_dinh_tach_hanh_vi: 'soQDTachHanhVi',
  'ngay-quyet-dinh-tach-hanh-vi': 'ngayTachHanhVi',
  can_cu_tam_dinh_chi_vu_an: 'canCuTamDinhChiVuAn',
  can_cu_phuc_hoi_dieu_tra_vu_an: 'canCuPhucHoiVuAn',
  ghi_chu_khac: 'ghiChuKhac',
};

/** legacyField → cột CaseStatistic (số liệu vụ án). */
export const CASE_STATISTIC_MAP: Record<string, string> = {
  so_luong_bi_hai: 'soLuongBiHai',
  so_tien_bi_thiet_hai: 'soTienBiThietHai',
  so_tien_thu_hoi: 'soTienThuHoi',
  so_luong_sung_thu_hoi: 'soSungThuHoi',
  so_doi_tuong: 'soDoiTuong',
  so_doi_tuong_da_bat: 'soDoiTuongDaBat',
  so_doi_tuong_bi_bat_trong_vu_an_khac: 'soDoiTuongBiBatVuAnKhac',
  so_luong_nguoi_chet: 'soLuongNguoiChet',
  so_nguoi_bi_thuong: 'soNguoiBiThuong',
  ngay_thong_ke: 'ngayThongKe',
  // Mốc tố tụng (CaseStatistic đã có sẵn cột — Agent phân tích schema xác nhận)
  ngay_pham_toi_qua_tang: 'ngayPhamToiQuaTang',
  ngay_nguoi_pham_toi_dau_thu: 'ngayDauThu',
  ngay_nguoi_pham_toi_bi_bat_khan_cap: 'ngayBatKhanCap',
  ngay_cqcsdt_phat_hien_co_dau_hieu_pham_toi: 'ngayPhatHienDauHieu',
  ngay_thoi_diem_phan_cong_giai_quyet_to_giac: 'ngayPhanCongGiaiQuyetToGiac',
  ngay_tiep_nhan_tin: 'ngayTiepNhanTin',
  so_tien_thu_hoi_tai_san: 'soTienThuHoi',
  su_dung_vu_khi_nong: 'suDungVuKhiNong',
  dieu_tra_mo_rong: 'dieuTraMoRong',
};

/** Field cần RESOLVE đặc biệt (không map chuỗi thẳng). */
export const RESOLVE: Record<string, string> = {
  toi_danh_chinh_blhs2015: 'crimeChinhId ← resolveCrime(ToiDanh.legacyValue), validate FK tồn tại',
  toi_danh_chinh: 'crimeChinhId ← resolveCrime',
  toi_danh_khac: 'toiDanhKhacIds[] ← resolveCrime nhiều',
  phan_loai_nguon_tin_ban_dau: '→ thực thể đích (PHAN_LOAI_TO_ENTITY) + caseProvenance/petitionType (crosswalk)',
  tinh_trang: '→ status enum (crosswalk NgonNgu tinh_trang_*)',
  don_vi_giai_quyet: '→ assignedTeamId (LegacyUnitAlias classification)',
  nguoi_them: '→ createdById/importedById (map thanh_vien→user)',
};

/** Field hệ thống/tìm kiếm — KHÔNG migrate (đã có trong legacyRaw). */
export const DROP_PATTERNS: RegExp[] = [
  /_search$/,
  /^da_xoa$/,
  /^_add_time$/,
  /^_update_time$/,
  /^__v$/,
  /^id$/, // → soHoSoIdCu (traceability) xử lý riêng, không map field nghiệp vụ
  /^_id$/,
  /^don_vi_id$/, // → assignedTeamId qua resolve
];
