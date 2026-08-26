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

export type ParityType = 'String' | 'DateTime' | 'Int' | 'Float' | 'Boolean';
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
  /**
   * true = cột dựng để FORM NHẬP ĐƯỢC, không phải vì dữ liệu cũ ở thực thể này.
   *
   * Cổng kiểm "spec không khai cột thừa" so spec với ma trận sinh từ dữ liệu thật, nên một
   * cột dựng cho ô mới trên màn hình sẽ bị coi là thừa dù nó hoàn toàn chính đáng: hệ cũ
   * VẪN đang nhận nhập liệu, và ô nào cán bộ gõ được thì phải có chỗ lưu.
   *
   * Cờ này KHÔNG nới lỏng phép kiểm "không sót dữ liệu" — chiều ấy vẫn nguyên vẹn.
   */
  formOnly?: boolean;
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
    { field: 'so_tien_bi_thiet_hai', col: 'soTienBiThietHai', type: 'Float' }, // tiền VND có thể > 2 tỷ (tràn Int)
    { field: 'so_luong_bi_hai', col: 'soLuongBiHai', type: 'Int' },

    // ── Bổ sung 26/08/2026 cho epic "form Đơn thư khớp bố cục hệ cũ" ──
    // Số hồ sơ THẬT có dữ liệu, đo trên máy chạy (đã loại rỗng và hai mốc rỗng "0"/"-25200").
    // Ma trận tài liệu đếm theo SỰ CÓ MẶT của khoá nên cao hơn thực tế — bám số đo, không bám
    // ma trận: vd `ngay_thong_ke` ma trận báo 126, thực tế 1 hồ sơ; `ngay_thang_nam_het_thoi_
    // hieu_vu_viec` ma trận báo 104, thực tế 0.
    { field: 'truong_hop_bao_cao_ban_giam_doc', col: 'baoCaoBanGiamDocText', type: 'String' }, // 35.261
    { field: 'tinh_trang', col: 'tinhTrang', type: 'String' }, // 15.039
    { field: 'quyet_dinh_phan_cong_giai_quyet_nguon_tin', col: 'soQDPhanCongNguonTin', type: 'String' }, // 411
    { field: 'ngay_ra_quyet_dinh_phan_cong_tin_bao', col: 'ngayQDPhanCongNguonTin', type: 'DateTime' }, // 412
    { field: 'quyet_dinh_tam_dinh_chi_nguon_tin', col: 'soQDTamDinhChiNguonTin', type: 'String' }, // 58
    { field: 'ngay_ra_quyet_dinh_tam_dinh_chi_nguon_tin', col: 'ngayQDTamDinhChiNguonTin', type: 'DateTime' }, // 62
    { field: 'can_cu_tam_dinh_chi_nguon_tin', col: 'canCuTamDinhChiNguonTin', type: 'String' }, // 54
    { field: 'phuc_hoi_nguon_tin_toi_pham', col: 'soPhucHoiNguonTin', type: 'String' }, // 48
    { field: 'ngay_phuc_hoi_nguon_tin_toi_pham', col: 'ngayPhucHoiNguonTin', type: 'DateTime' }, // 48

    // ── Bổ sung 27/08/2026: hai cột ĐÃ CÓ SẴN mà builder chưa bao giờ đọc ──
    // Bộ sinh ma trận sửa xong mới thấy: cả hai cột tồn tại trong lược đồ, đo trên máy chạy
    // thì ĐỀU BẰNG 0 hồ sơ, trong khi dữ liệu cũ có gần như đủ 46.660 đơn.
    //
    // `phanLoaiNguonTin` là ô "Phân loại ban đầu" — ô thứ hai của tab Thông tin, và là ô
    // quyết định hồ sơ nằm ở danh sách nào bên hệ cũ. Cán bộ mở một đơn di trú ra thì ô ấy
    // trắng, đúng thứ epic này sinh ra để chấm dứt.
    { field: 'phan_loai_nguon_tin_ban_dau', col: 'phanLoaiNguonTin', type: 'String', exists: true }, // 46.445
    // `assignedTeamId` đã có 35.958 hồ sơ nhờ bộ nạp phân giải tên đơn vị thành id tổ, nhưng
    // CHỮ gốc cán bộ nhìn thấy bên hệ cũ thì chưa ở đâu ngoài `legacyRaw`.
    { field: 'don_vi_giai_quyet', col: 'donViGiaiQuyet', type: 'String', exists: true }, // 46.476
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

    // ── Bổ sung 26/08/2026 — epic "form Vụ án khớp bố cục hệ cũ" ─────────────────────
    // Form mới đã có ô cho từng khoá dưới đây ở đúng vị trí hệ cũ. Khai ở đây để
    // `backfill-parity.ts` đổ được cho 3.380 vụ án ĐÃ di trú — nếu không, hồ sơ cũ mở ra
    // vẫn trắng ô dù dữ liệu nằm sẵn trong `legacy_raw`.
    // Ô "Trường hợp báo cáo Ban Giám đốc" của hệ cũ là ô CHỮ, 34.931 hồ sơ có nội dung.
    // Cột `baoCaoBanGiamDoc` (khai ở cuối danh sách) chỉ giữ CÓ/KHÔNG suy từ chữ ấy, nên
    // phải có thêm một đích cho chính nội dung — nếu không, cán bộ mở hồ sơ cũ ra sẽ thấy
    // ô trắng, mà đó là chỉ đạo của Ban Giám đốc.
    // Cùng một khoá hệ cũ đi vào HAI cột là cố ý; `parityColumns` duyệt cả danh sách.
    { field: 'truong_hop_bao_cao_ban_giam_doc', col: 'baoCaoBanGiamDocText', type: 'String' },
    // Ba cột dưới đây đã có từ lâu và `buildCase` vẫn đổ, nhưng chúng KHÔNG nằm trong đặc
    // tả parity — mà công cụ bù cho hồ sơ ĐÃ di trú chỉ chạy trên đặc tả này. Hệ quả: hồ sơ
    // di trú MỚI thì đủ, hồ sơ di trú từ trước vẫn trắng ba ô. Phát hiện khi mở một hồ sơ
    // di trú thật trên giao diện.
    { field: 'loai_thong_tin', col: 'loaiThongTin', type: 'String', exists: true },
    { field: 'ngay_tiep_nhan_nguon_tin', col: 'ngayTiepNhan', type: 'DateTime', exists: true },
    { field: 'toi-danh-ban-dau', col: 'toiDanhBanDau', type: 'String', exists: true },
    { field: 'phan_loai_nguon_tin_ban_dau', col: 'phanLoaiNguonTinBanDau', type: 'String' , formOnly: true },
    { field: 'ngay_xay_ra', col: 'ngayXayRa', type: 'DateTime' , formOnly: true },
    { field: 'noi_xay_ra_phuong_xa', col: 'noiXayRaPhuongXa', type: 'String' , formOnly: true },
    // Tab "Vụ việc"
    { field: 'quyet_dinh_phan_cong_giai_quyet_nguon_tin', col: 'soQDPhanCongNguonTin', type: 'String' },
    { field: 'ngay_ra_quyet_dinh_phan_cong_tin_bao', col: 'ngayQDPhanCongNguonTin', type: 'DateTime' },
    { field: 'quyet_dinh_khong_khoi_to', col: 'soQDKhongKhoiTo', type: 'String' , formOnly: true },
    { field: 'ngay_ra_quyet_dinh_khong_khoi_to', col: 'ngayQDKhongKhoiTo', type: 'DateTime' },
    { field: 'can_cu_ra_quyet_dinh_khong_khoi_to', col: 'canCuKhongKhoiTo', type: 'String' , formOnly: true },
    { field: 'vu_viec_chuyen_don_vi_khac', col: 'chuyenVuViecDonViKhac', type: 'String' , formOnly: true },
    { field: 'nhap_vao_vu_viec_so', col: 'nhapVaoVuViecSo', type: 'String' , formOnly: true },
    { field: 'phan_loai_dan_su', col: 'phanLoaiDanSu', type: 'String' , formOnly: true },
    // Tab "Vụ việc TĐC"
    { field: 'xac_dinh_vu_viec_tam_dung_giai_quyet', col: 'vuViecTamDungTruoc2015', type: 'Boolean' , formOnly: true },
    { field: 'quyet_dinh_tam_dinh_chi_nguon_tin', col: 'soQDTamDinhChiNguonTin', type: 'String' },
    { field: 'ngay_ra_quyet_dinh_tam_dinh_chi_nguon_tin', col: 'ngayQDTamDinhChiNguonTin', type: 'DateTime' },
    { field: 'can_cu_tam_dinh_chi_nguon_tin', col: 'canCuTamDinhChiNguonTin', type: 'String' },
    { field: 'ngay_thang_nam_het_thoi_hieu_vu_viec', col: 'ngayHetThoiHieuVuViec', type: 'DateTime' },
    { field: 'khac_phuc_ly_do_tdc', col: 'khacPhucLyDoTDCVuViec', type: 'String' , formOnly: true },
    { field: 'tien_do_khac_phuc_tdc', col: 'tienDoKhacPhucTDCVuViec', type: 'String' , formOnly: true },
    { field: 'phuc_hoi_nguon_tin_toi_pham', col: 'soPhucHoiNguonTin', type: 'String' },
    { field: 'ngay_phuc_hoi_nguon_tin_toi_pham', col: 'ngayPhucHoiNguonTin', type: 'DateTime' },
    // Tab "Vụ án TĐC" — bốn cột đã có sẵn, chỉ thiếu dòng đọc
    { field: 'khac_phuc_tdc_vu_an', col: 'tdcKhacPhucBienBan', type: 'String', exists: true },
    { field: 'bien_phap_khac_phuc_tdc_vu_an', col: 'tdcKhacPhucLyDoBienPhap', type: 'String', exists: true },
    { field: 'quyet_dinh_phuc_hoi_vu_an', col: 'soQuyetDinhPhucHoi', type: 'String', exists: true },
    { field: 'ngay_phuc_hoi_dieu_tra_vu_an', col: 'ngayPhucHoi', type: 'DateTime', exists: true },
    // Chữ đơn vị giải quyết — 3.286 vụ án có, bảng `cases` chưa có cột (Đơn thư và Vụ việc
    // đã có). `assignedTeamId` là id tổ bộ nạp PHÂN GIẢI ra từ chính chuỗi này; giữ cả chuỗi
    // gốc vì phân giải có thể sai và 144 vụ không ra tổ nào.
    { field: 'don_vi_giai_quyet', col: 'donViGiaiQuyet', type: 'String' },
    // Chữ tình trạng hệ cũ — 1.872 vụ án có, cột `tinhTrang` đã sẵn trong lược đồ nhưng builder
    // chỉ đặt `metadata.tinhTrang`, nên 75 vụ còn trống. `status` là enum, giữ không nổi chữ.
    { field: 'tinh_trang', col: 'tinhTrang', type: 'String', exists: true },
    // Tab "Vật chứng" — ba ô chữ hệ cũ, khác bảng vật chứng chuẩn hoá
    { field: 'vat_chung', col: 'vatChungMoTa', type: 'String' , formOnly: true },
    { field: 'lenh_nhap_kho', col: 'lenhNhapKho', type: 'String' , formOnly: true },
    { field: 'Noi_luu_tru_bao_quan_ke_bien_phong_toa', col: 'noiLuuTruBaoQuan', type: 'String' , formOnly: true },
  ],
};

/**
 * Ma trận sinh tự động ĐÃ TỰ ĐO ĐƯỢC hai chỗ từng phải khai tay.
 *
 * Bảng `PARITY_BANG_CHUNG_DO_TAY` từng giữ hai khoá mà bộ sinh xếp nhầm — `truong_hop_bao_
 * cao_ban_giam_doc` (báo "OK" vào một cột ĐÚNG/SAI trong khi hệ cũ khai kiểu `text`) và
 * `tinh_trang` (báo "RESOLVE" trong khi không thực thể nào có người nhận). Ngày 27/08/2026 bộ
 * sinh được vá ba điểm mù: nhìn MỌI đích thay vì đích đầu tiên, hỏi cột có CHỨA NỔI không
 * thay vì chỉ có tồn tại không, và đọc cả nhánh đổ dữ liệu theo bảng khai lẫn hàm phụ trợ.
 *
 * Khai tay giờ là thừa: giữ lại một cửa miễn trừ không ai cần chỉ để đó cho lần sau dùng bừa.
 */

/**
 * Hoãn CÓ KỲ HẠN theo TỪNG THỰC THỂ — khác `PARITY_METADATA_ONLY` ở chỗ không miễn cho cả ba.
 *
 * Miễn toàn cục là cách rẻ nhất để làm cổng kiểm xanh, và cũng là cách chắc nhất để một lỗ
 * thật ở thực thể khác không bao giờ bị phát hiện: `phan_loai_nguon_tin_ban_dau` miễn cho
 * Vụ việc thì cũng miễn luôn cho Đơn thư, trong khi Đơn thư vừa mới vá đúng khoá ấy.
 *
 * Mỗi dòng phải ghi SỐ ĐO và LÝ DO hoãn. Đây là nợ đã khai, không phải chỗ giấu việc.
 */
export const PARITY_HOAN_THEO_THUC_THE: ReadonlySet<string> = new Set([
  // Epic 26–27/08/2026 chốt phạm vi là Đơn thư; Vụ việc để epic sau (spec Phần C, mục 7).
  // Dữ liệu vẫn đọc và sửa được qua bảng `legacyRaw` trên màn hồ sơ, chỉ chưa có cột typed.
  'incident/phan_loai_nguon_tin_ban_dau', // 4.568 hồ sơ
  // Vụ việc chưa có cột tội danh nào (không `crimeChinhId`, không `crimeChinhLegacyValue`),
  // nên đây là việc của epic Vụ việc chứ không phải một cột lẻ.
  'incident/toi_danh_chinh_blhs2015', // 1.114 hồ sơ
]);

/** Field thủ tục leak chéo-giai-đoạn (count nhỏ) — CỐ Ý giữ ở metadata động, KHÔNG tạo cột.
 * Gate coi các field này "có nhà" ở metadata/legacyRaw (không tính là sót). */
export const PARITY_METADATA_ONLY: ReadonlySet<string> = new Set([
  // Thủ tục nguồn-tin/vụ-án rơi lên đơn thư/vụ án (đã có cột đúng ở Incident/Case-của-nó)
  // Danh sách này là "nhà dự phòng" cho MỌI thực thể. Case nay đã có cột thật cho phần lớn
  // khoá dưới đây (xem PARITY.case), nhưng Đơn thư và Vụ việc thì chưa — bỏ khoá khỏi đây là
  // cổng kiểm báo sót ngay ở hai thực thể ấy.
  'ngay_ra_quyet_dinh_phan_cong_tin_bao', 'quyet_dinh_phan_cong_giai_quyet_nguon_tin',
  'ngay_phuc_hoi_nguon_tin_toi_pham', 'phuc_hoi_nguon_tin_toi_pham',
  'ngay_ra_quyet_dinh_tam_dinh_chi_nguon_tin', 'quyet_dinh_tam_dinh_chi_nguon_tin', 'can_cu_tam_dinh_chi_nguon_tin',
  'ngay_ra_quyet_dinh_khoi_to', 'ngay_ra_quyet_dinh_khong_khoi_to', 'quyet_dinh_khong_khoi_to', 'can_cu_ra_quyet_dinh_khong_khoi_to',
  'phan_loai_dan_su',
  'ngay_tam_dinh_chi_vu_an', 'quyet_dinh_tam_dinh_chi_vu_an',
  'het_thoi_hieu_tnhs', 'ngay_het_han_vu_an', 'thoi_gian_het_thoi_hieu_truy_cuu_tnhs',
  'loai_toi_pham',
  // Số liệu thiệt hại vụ án — nhà thật là case_statistics (buildCaseStatistic đã đổ), không cột trên cases.
  'so_tien_bi_thiet_hai', 'so_luong_bi_hai',
  // Mốc thời hiệu / thống kê rơi lên đơn thư (đã có cột đúng ở Case/CaseStatistic)
  'ngay_thong_ke', 'ngay_thang_nam_het_thoi_hieu_vu_viec', 'ngay_het_thoi_hieu_truy_cuu_tnhs_vu_an',
  // Lịch sử chuyển đơn vị = mảng con (đã giữ ở metadata.lichSuChuyenDonVi / legacyRaw)
  'lich_su',
]);
