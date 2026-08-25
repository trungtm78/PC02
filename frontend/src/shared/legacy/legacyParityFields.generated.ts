// AUTO-GENERATED từ backend field-parity.def.ts — KHÔNG sửa tay.
// Sinh lại: ./node_modules/.bin/ts-node src/legacy-migration/cli/gen-legacy-parity-fields.ts
// CHỈ gồm CỘT MỚI (exists!=true); cột đã có ô form chính bị loại để tránh double-edit.
export type ParityKind = "text"|"date"|"number"|"checkbox";
export interface ParityFieldDef { col: string; kind: ParityKind; label: string; }
export const LEGACY_PARITY_FIELDS: Record<"petition"|"incident"|"case", ParityFieldDef[]> = {
  "petition": [
    {
      "col": "phanLoaiToiPhamLinhVuc",
      "kind": "text",
      "label": "phan_loai_toi_pham_theo_linh_vuc"
    },
    {
      "col": "phanLoaiHoSoNoiBo",
      "kind": "text",
      "label": "phan_loai_ho_so_doi_1"
    },
    {
      "col": "ghiChuKhac",
      "kind": "text",
      "label": "ghi_chu_khac"
    },
    {
      "col": "yeuCauBoSung",
      "kind": "text",
      "label": "yeu_cau_bo_sung"
    },
    {
      "col": "soTienBiThietHai",
      "kind": "number",
      "label": "so_tien_bi_thiet_hai"
    },
    {
      "col": "soLuongBiHai",
      "kind": "number",
      "label": "so_luong_bi_hai"
    }
  ],
  "incident": [
    {
      "col": "nhanXet",
      "kind": "text",
      "label": "nhan_xet"
    },
    {
      "col": "ngayTiepNhanNguonTin",
      "kind": "date",
      "label": "ngay_tiep_nhan_nguon_tin"
    },
    {
      "col": "loaiThongTin",
      "kind": "text",
      "label": "loai_thong_tin"
    },
    {
      "col": "ngayVietDon",
      "kind": "date",
      "label": "ngay_viet_don"
    },
    {
      "col": "ghiChuTrungDon",
      "kind": "text",
      "label": "ghi_chu_trung_don"
    },
    {
      "col": "baoCaoBanGiamDoc",
      "kind": "checkbox",
      "label": "truong_hop_bao_cao_ban_giam_doc"
    },
    {
      "col": "ngayGiaoDonViGiaiQuyet",
      "kind": "date",
      "label": "ngay_giao_don_vi_giai_quyet"
    },
    {
      "col": "toiDanhBanDau",
      "kind": "text",
      "label": "toi-danh-ban-dau"
    },
    {
      "col": "soPhieuChuyen",
      "kind": "text",
      "label": "so_phieu_chuyen"
    },
    {
      "col": "ngayPhieuChuyen",
      "kind": "date",
      "label": "ngay_phieu_chuyen"
    },
    {
      "col": "doVatTaiLieuKemTheo",
      "kind": "text",
      "label": "do_vat_tai_lieu_kem_theo"
    },
    {
      "col": "phanLoaiToiPhamLinhVuc",
      "kind": "text",
      "label": "phan_loai_toi_pham_theo_linh_vuc"
    },
    {
      "col": "phanLoaiHoSoNoiBo",
      "kind": "text",
      "label": "phan_loai_ho_so_doi_1"
    },
    {
      "col": "lanhDaoToTung",
      "kind": "text",
      "label": "lanh_dao_to_tung"
    },
    {
      "col": "dieuTraVien",
      "kind": "text",
      "label": "dieu_tra_vien"
    },
    {
      "col": "dieuTraVienPhuongXa",
      "kind": "text",
      "label": "dieu_tra_vien_phuong_xa"
    },
    {
      "col": "noiCapCccd",
      "kind": "text",
      "label": "noi_cap_cccd_nguyen_don"
    },
    {
      "col": "ngayCapCccd",
      "kind": "date",
      "label": "ngay_cap_cccd_nguyen_don"
    },
    {
      "col": "deXuat",
      "kind": "text",
      "label": "de_xuat"
    },
    {
      "col": "yeuCauBoSung",
      "kind": "text",
      "label": "yeu_cau_bo_sung"
    },
    {
      "col": "ghiChuKhac",
      "kind": "text",
      "label": "ghi_chu_khac"
    }
  ],
  "case": [
    {
      "col": "ngayDeXuat",
      "kind": "date",
      "label": "ngay_de_xuat"
    },
    {
      "col": "moTaChiTiet",
      "kind": "text",
      "label": "tom_tat_noi_dung"
    },
    {
      "col": "nguonDon",
      "kind": "text",
      "label": "nguon_don"
    },
    {
      "col": "tenCungCap",
      "kind": "text",
      "label": "ten_ca_nhan_co_quan_to_chuc_cung_cap"
    },
    {
      "col": "sinhNamCungCap",
      "kind": "text",
      "label": "sinh_nam_nguoi_to_giac"
    },
    {
      "col": "cccdCungCap",
      "kind": "text",
      "label": "so_cccd_nguyen_don"
    },
    {
      "col": "ngayCapCccd",
      "kind": "date",
      "label": "ngay_cap_cccd_nguyen_don"
    },
    {
      "col": "noiCapCccd",
      "kind": "text",
      "label": "noi_cap_cccd_nguyen_don"
    },
    {
      "col": "sdtCungCap",
      "kind": "text",
      "label": "so_dien_thoai_nguyen_don"
    },
    {
      "col": "diaChiCungCap",
      "kind": "text",
      "label": "dia-chi-bi-hai"
    },
    {
      "col": "nghiVanDoiTuong",
      "kind": "text",
      "label": "nghi_van_doi_tuong"
    },
    {
      "col": "nhanXet",
      "kind": "text",
      "label": "nhan_xet"
    },
    {
      "col": "noiXayRa",
      "kind": "text",
      "label": "noi_xay_ra"
    },
    {
      "col": "phuongThucThuDoan",
      "kind": "text",
      "label": "phuong_thuc_thu_doan"
    },
    {
      "col": "ketQuaXuLyKhac",
      "kind": "text",
      "label": "ket_qua_xu_ly_giai_quyet_khac"
    },
    {
      "col": "soPhieuChuyen",
      "kind": "text",
      "label": "so_phieu_chuyen"
    },
    {
      "col": "ngayPhieuChuyen",
      "kind": "date",
      "label": "ngay_phieu_chuyen"
    },
    {
      "col": "doVatTaiLieuKemTheo",
      "kind": "text",
      "label": "do_vat_tai_lieu_kem_theo"
    },
    {
      "col": "ngayVietDon",
      "kind": "date",
      "label": "ngay_viet_don"
    },
    {
      "col": "ghiChuTrungDon",
      "kind": "text",
      "label": "ghi_chu_trung_don"
    },
    {
      "col": "baoCaoBanGiamDoc",
      "kind": "checkbox",
      "label": "truong_hop_bao_cao_ban_giam_doc"
    },
    {
      "col": "ngayGiaoDonViGiaiQuyet",
      "kind": "date",
      "label": "ngay_giao_don_vi_giai_quyet"
    },
    {
      "col": "lanhDaoToTung",
      "kind": "text",
      "label": "lanh_dao_to_tung"
    },
    {
      "col": "dieuTraVien",
      "kind": "text",
      "label": "dieu_tra_vien"
    },
    {
      "col": "phanLoaiToiPhamLinhVuc",
      "kind": "text",
      "label": "phan_loai_toi_pham_theo_linh_vuc"
    },
    {
      "col": "phanLoaiHoSoNoiBo",
      "kind": "text",
      "label": "phan_loai_ho_so_doi_1"
    },
    {
      "col": "deXuat",
      "kind": "text",
      "label": "de_xuat"
    },
    {
      "col": "yeuCauBoSung",
      "kind": "text",
      "label": "yeu_cau_bo_sung"
    },
    {
      "col": "baoCaoBanGiamDocText",
      "kind": "text",
      "label": "truong_hop_bao_cao_ban_giam_doc"
    },
    {
      "col": "phanLoaiNguonTinBanDau",
      "kind": "text",
      "label": "phan_loai_nguon_tin_ban_dau"
    },
    {
      "col": "ngayXayRa",
      "kind": "date",
      "label": "ngay_xay_ra"
    },
    {
      "col": "noiXayRaPhuongXa",
      "kind": "text",
      "label": "noi_xay_ra_phuong_xa"
    },
    {
      "col": "soQDPhanCongNguonTin",
      "kind": "text",
      "label": "quyet_dinh_phan_cong_giai_quyet_nguon_tin"
    },
    {
      "col": "ngayQDPhanCongNguonTin",
      "kind": "date",
      "label": "ngay_ra_quyet_dinh_phan_cong_tin_bao"
    },
    {
      "col": "soQDKhongKhoiTo",
      "kind": "text",
      "label": "quyet_dinh_khong_khoi_to"
    },
    {
      "col": "ngayQDKhongKhoiTo",
      "kind": "date",
      "label": "ngay_ra_quyet_dinh_khong_khoi_to"
    },
    {
      "col": "canCuKhongKhoiTo",
      "kind": "text",
      "label": "can_cu_ra_quyet_dinh_khong_khoi_to"
    },
    {
      "col": "chuyenVuViecDonViKhac",
      "kind": "text",
      "label": "vu_viec_chuyen_don_vi_khac"
    },
    {
      "col": "nhapVaoVuViecSo",
      "kind": "text",
      "label": "nhap_vao_vu_viec_so"
    },
    {
      "col": "phanLoaiDanSu",
      "kind": "text",
      "label": "phan_loai_dan_su"
    },
    {
      "col": "vuViecTamDungTruoc2015",
      "kind": "checkbox",
      "label": "xac_dinh_vu_viec_tam_dung_giai_quyet"
    },
    {
      "col": "soQDTamDinhChiNguonTin",
      "kind": "text",
      "label": "quyet_dinh_tam_dinh_chi_nguon_tin"
    },
    {
      "col": "ngayQDTamDinhChiNguonTin",
      "kind": "date",
      "label": "ngay_ra_quyet_dinh_tam_dinh_chi_nguon_tin"
    },
    {
      "col": "canCuTamDinhChiNguonTin",
      "kind": "text",
      "label": "can_cu_tam_dinh_chi_nguon_tin"
    },
    {
      "col": "ngayHetThoiHieuVuViec",
      "kind": "date",
      "label": "ngay_thang_nam_het_thoi_hieu_vu_viec"
    },
    {
      "col": "khacPhucLyDoTDCVuViec",
      "kind": "text",
      "label": "khac_phuc_ly_do_tdc"
    },
    {
      "col": "tienDoKhacPhucTDCVuViec",
      "kind": "text",
      "label": "tien_do_khac_phuc_tdc"
    },
    {
      "col": "soPhucHoiNguonTin",
      "kind": "text",
      "label": "phuc_hoi_nguon_tin_toi_pham"
    },
    {
      "col": "ngayPhucHoiNguonTin",
      "kind": "date",
      "label": "ngay_phuc_hoi_nguon_tin_toi_pham"
    },
    {
      "col": "vatChungMoTa",
      "kind": "text",
      "label": "vat_chung"
    },
    {
      "col": "lenhNhapKho",
      "kind": "text",
      "label": "lenh_nhap_kho"
    },
    {
      "col": "noiLuuTruBaoQuan",
      "kind": "text",
      "label": "Noi_luu_tru_bao_quan_ke_bien_phong_toa"
    }
  ]
};
