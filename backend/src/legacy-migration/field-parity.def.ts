/**
 * field-parity.def.ts — NGUỒN SỰ THẬT field-parity (field cũ → cột typed hệ mới).
 *
 * Chốt từ ma trận `docs/legacy/field-parity-matrix.md` (sinh từ data thật): mỗi field cũ
 * CÓ DATA được promote thành CỘT typed ở thực thể NÓ THUỘC VỀ theo nghĩa:
 *   - Field intake/chung (người cung cấp, nội dung, mốc tiếp nhận…) → có mặt ở mọi giai đoạn.
 *   - Field thủ tục (QĐ khởi tố, tạm đình chỉ vụ án…) → CHỈ ở giai đoạn của nó.
 * Leak chéo-giai-đoạn count nhỏ (vd QĐ vụ án rơi lên đơn thư) KHÔNG tạo cột — giữ ở
 * metadata động (đã hiển thị/sửa) + GATE bảo chứng không sót.
 *
 * `exists: true` = cột ĐÃ có trong schema → chỉ cần builder đọc + backfill (không migration).
 * `exists` vắng/false = cột MỚI → schema + migration additive + builder + backfill.
 *
 * Dùng bởi: legacy-mapper `parityColumns()` (di trú), backfill-parity.ts, audit gate.
 * Kiểu parser suy từ `type`: String→s, DateTime→parseLegacyDate, Int→parseInt(round), Boolean→boolFromText.
 */

export type ParityType = 'String' | 'DateTime' | 'Int' | 'Boolean';
export type Entity = 'petition' | 'incident' | 'case';

export interface ParityCol {
  /** Key field hệ cũ (rec[field]). Giữ đúng cả dạng gạch ngang: 'toi-danh-ban-dau'. */
  field: string;
  /** Cột hệ mới (camelCase). */
  col: string;
  type: ParityType;
  /** true = cột đã tồn tại (chỉ fix builder + backfill). */
  exists?: boolean;
  /** type=Boolean: true → boolFromText (text mô tả tự do ⇒ true); mặc định parseLegacyBool (checkbox). */
  textBool?: boolean;
}

/**
 * Field intake dùng chung — thêm cột cho thực thể nào CHƯA có (Petition đã đủ; Incident/Case thiếu).
 * Case trước đây để ở metadata → nay promote thành cột typed.
 */
export const PARITY: Record<Entity, ParityCol[]> = {
  // Petition gần đủ — chỉ vá vài cột đã có (builder chưa đọc) + số liệu thiệt hại + phân loại.
  petition: [
    { field: 'dieu_tra_vien', col: 'dieuTraVien', type: 'String', exists: true },
    { field: 'ngay_de_xuat', col: 'ngayDeXuat', type: 'DateTime', exists: true },
    { field: 'de_xuat', col: 'deXuat', type: 'String', exists: true },
    { field: 'phan_loai_toi_pham_theo_linh_vuc', col: 'phanLoaiToiPhamLinhVuc', type: 'String' },
    { field: 'phan_loai_ho_so_doi_1', col: 'phanLoaiHoSoNoiBo', type: 'String' },
    { field: 'ghi_chu_khac', col: 'ghiChuKhac', type: 'String' },
    { field: 'yeu_cau_bo_sung', col: 'yeuCauBoSung', type: 'String' },
    { field: 'so_tien_bi_thiet_hai', col: 'soTienBiThietHai', type: 'Int' },
    { field: 'so_luong_bi_hai', col: 'soLuongBiHai', type: 'Int' },
  ],

  // Incident — LỖ HỔNG LỚN NHẤT: thiếu hầu hết field intake mà Petition đã có cột.
  incident: [
    { field: 'nhan_xet', col: 'nhanXet', type: 'String' },
    { field: 'ngay_tiep_nhan_nguon_tin', col: 'ngayTiepNhanNguonTin', type: 'DateTime' },
    { field: 'loai_thong_tin', col: 'loaiThongTin', type: 'String' },
    { field: 'ngay_viet_don', col: 'ngayVietDon', type: 'DateTime' },
    { field: 'ghi_chu_trung_don', col: 'ghiChuTrungDon', type: 'String' },
    { field: 'truong_hop_bao_cao_ban_giam_doc', col: 'baoCaoBanGiamDoc', type: 'Boolean', textBool: true },
    { field: 'ngay_giao_don_vi_giai_quyet', col: 'ngayGiaoDonViGiaiQuyet', type: 'DateTime' },
    { field: 'toi-danh-ban-dau', col: 'toiDanhBanDau', type: 'String' },
    { field: 'so_phieu_chuyen', col: 'soPhieuChuyen', type: 'String' },
    { field: 'ngay_phieu_chuyen', col: 'ngayPhieuChuyen', type: 'DateTime' },
    { field: 'do_vat_tai_lieu_kem_theo', col: 'doVatTaiLieuKemTheo', type: 'String' },
    { field: 'phan_loai_toi_pham_theo_linh_vuc', col: 'phanLoaiToiPhamLinhVuc', type: 'String' },
    { field: 'phan_loai_ho_so_doi_1', col: 'phanLoaiHoSoNoiBo', type: 'String' },
    { field: 'lanh_dao_to_tung', col: 'lanhDaoToTung', type: 'String' },
    { field: 'dieu_tra_vien', col: 'dieuTraVien', type: 'String' },
    { field: 'dieu_tra_vien_phuong_xa', col: 'dieuTraVienPhuongXa', type: 'String' },
    { field: 'noi_cap_cccd_nguyen_don', col: 'noiCapCccd', type: 'String' },
    { field: 'ngay_cap_cccd_nguyen_don', col: 'ngayCapCccd', type: 'DateTime' },
    { field: 'de_xuat', col: 'deXuat', type: 'String' },
    { field: 'yeu_cau_bo_sung', col: 'yeuCauBoSung', type: 'String' },
    { field: 'ghi_chu_khac', col: 'ghiChuKhac', type: 'String' },
    { field: 'phan_loai_toi_pham_cong_nghe_cao', col: 'laCongNgheCaoVV', type: 'Boolean', exists: true },
  ],

  // Case — promote field intake (đang ở metadata) thành cột typed; vá vài cột đã có.
  case: [
    { field: 'ngay_de_xuat', col: 'ngayDeXuat', type: 'DateTime' },
    { field: 'tom_tat_noi_dung', col: 'moTaChiTiet', type: 'String' },
    { field: 'nguon_don', col: 'nguonDon', type: 'String' },
    { field: 'ten_ca_nhan_co_quan_to_chuc_cung_cap', col: 'tenCungCap', type: 'String' },
    { field: 'sinh_nam_nguoi_to_giac', col: 'sinhNamCungCap', type: 'String' },
    { field: 'so_cccd_nguyen_don', col: 'cccdCungCap', type: 'String' },
    { field: 'ngay_cap_cccd_nguyen_don', col: 'ngayCapCccd', type: 'DateTime' },
    { field: 'noi_cap_cccd_nguyen_don', col: 'noiCapCccd', type: 'String' },
    { field: 'so_dien_thoai_nguyen_don', col: 'sdtCungCap', type: 'String' },
    { field: 'dia-chi-bi-hai', col: 'diaChiCungCap', type: 'String' },
    { field: 'nghi_van_doi_tuong', col: 'nghiVanDoiTuong', type: 'String' },
    { field: 'nhan_xet', col: 'nhanXet', type: 'String' },
    { field: 'noi_xay_ra', col: 'noiXayRa', type: 'String' },
    { field: 'phuong_thuc_thu_doan', col: 'phuongThucThuDoan', type: 'String' },
    { field: 'ket_qua_xu_ly_giai_quyet_khac', col: 'ketQuaXuLyKhac', type: 'String' },
    { field: 'so_phieu_chuyen', col: 'soPhieuChuyen', type: 'String' },
    { field: 'ngay_phieu_chuyen', col: 'ngayPhieuChuyen', type: 'DateTime' },
    { field: 'do_vat_tai_lieu_kem_theo', col: 'doVatTaiLieuKemTheo', type: 'String' },
    { field: 'ngay_viet_don', col: 'ngayVietDon', type: 'DateTime' },
    { field: 'ghi_chu_trung_don', col: 'ghiChuTrungDon', type: 'String' },
    { field: 'truong_hop_bao_cao_ban_giam_doc', col: 'baoCaoBanGiamDoc', type: 'Boolean', textBool: true },
    { field: 'ngay_giao_don_vi_giai_quyet', col: 'ngayGiaoDonViGiaiQuyet', type: 'DateTime' },
    { field: 'lanh_dao_to_tung', col: 'lanhDaoToTung', type: 'String' },
    { field: 'dieu_tra_vien', col: 'dieuTraVien', type: 'String' },
    { field: 'phan_loai_toi_pham_theo_linh_vuc', col: 'phanLoaiToiPhamLinhVuc', type: 'String' },
    { field: 'phan_loai_ho_so_doi_1', col: 'phanLoaiHoSoNoiBo', type: 'String' },
    { field: 'de_xuat', col: 'deXuat', type: 'String' },
    { field: 'yeu_cau_bo_sung', col: 'yeuCauBoSung', type: 'String' },
    { field: 'phan_loai_toi_pham_cong_nghe_cao', col: 'laCongNgheCao', type: 'Boolean', exists: true },
    { field: 'thoi_han_thuc_hien_uy_thac_dieu_tra', col: 'thoiHanUyThac', type: 'DateTime', exists: true },
  ],
};

/** Field thủ tục leak chéo-giai-đoạn (count nhỏ) — CỐ Ý giữ ở metadata động, KHÔNG tạo cột.
 * Gate coi các field này "có nhà" ở metadata/legacyRaw (không tính là sót). */
export const PARITY_METADATA_ONLY: ReadonlySet<string> = new Set([
  // Thủ tục nguồn-tin/vụ-án rơi lên đơn thư/vụ án (đã có cột đúng ở Incident/Case-của-nó)
  'ngay_ra_quyet_dinh_phan_cong_tin_bao', 'quyet_dinh_phan_cong_giai_quyet_nguon_tin',
  'ngay_phuc_hoi_nguon_tin_toi_pham', 'phuc_hoi_nguon_tin_toi_pham',
  'ngay_ra_quyet_dinh_tam_dinh_chi_nguon_tin', 'quyet_dinh_tam_dinh_chi_nguon_tin', 'can_cu_tam_dinh_chi_nguon_tin',
  'ngay_ra_quyet_dinh_khoi_to', 'ngay_ra_quyet_dinh_khong_khoi_to', 'quyet_dinh_khong_khoi_to', 'can_cu_ra_quyet_dinh_khong_khoi_to',
  'ngay_tam_dinh_chi_vu_an', 'quyet_dinh_tam_dinh_chi_vu_an',
  'het_thoi_hieu_tnhs', 'ngay_het_han_vu_an', 'thoi_gian_het_thoi_hieu_truy_cuu_tnhs',
  'phan_loai_dan_su', 'loai_toi_pham',
  // Số liệu thiệt hại vụ án — nhà thật là case_statistics (buildCaseStatistic đã đổ), không cột trên cases.
  'so_tien_bi_thiet_hai', 'so_luong_bi_hai',
  // Mốc thời hiệu / thống kê rơi lên đơn thư (đã có cột đúng ở Case/CaseStatistic)
  'ngay_thong_ke', 'ngay_thang_nam_het_thoi_hieu_vu_viec', 'ngay_het_thoi_hieu_truy_cuu_tnhs_vu_an',
  // Lịch sử chuyển đơn vị = mảng con (đã giữ ở metadata.lichSuChuyenDonVi / legacyRaw)
  'lich_su',
]);
