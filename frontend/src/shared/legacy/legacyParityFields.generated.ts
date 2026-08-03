// AUTO-GENERATED từ backend field-parity.def.ts — KHÔNG sửa tay.
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
      "label": "Ghi chú khác"
    },
    {
      "col": "yeuCauBoSung",
      "kind": "text",
      "label": "yeu_cau_bo_sung"
    },
    {
      "col": "soTienBiThietHai",
      "kind": "number",
      "label": "Số tiền bị thiệt hại (triệu Việt nam Đồng)"
    },
    {
      "col": "soLuongBiHai",
      "kind": "number",
      "label": "Số lượng người bị hại"
    }
  ],
  "incident": [
    {
      "col": "nhanXet",
      "kind": "text",
      "label": "Nhận xét"
    },
    {
      "col": "ngayTiepNhanNguonTin",
      "kind": "date",
      "label": "Ngày tiếp nhận (theo biên bản tiếp nhận nguồn tin)"
    },
    {
      "col": "loaiThongTin",
      "kind": "text",
      "label": "Loại thông tin"
    },
    {
      "col": "ngayVietDon",
      "kind": "date",
      "label": "Ngày viết đơn"
    },
    {
      "col": "ghiChuTrungDon",
      "kind": "text",
      "label": "Ghi chú trùng đơn"
    },
    {
      "col": "baoCaoBanGiamDoc",
      "kind": "checkbox",
      "label": "Trường hợp báo cáo Ban Giám đốc"
    },
    {
      "col": "ngayGiaoDonViGiaiQuyet",
      "kind": "date",
      "label": "Ngày giao đơn vị giải quyết"
    },
    {
      "col": "toiDanhBanDau",
      "kind": "text",
      "label": "Tội danh cũ trước đây"
    },
    {
      "col": "soPhieuChuyen",
      "kind": "text",
      "label": "Số phiếu chuyển/ Công văn/ Ủy thác điều tra"
    },
    {
      "col": "ngayPhieuChuyen",
      "kind": "date",
      "label": "Ngày phiếu chuyển/ Công văn/ Ủy thác điều tra"
    },
    {
      "col": "doVatTaiLieuKemTheo",
      "kind": "text",
      "label": "Đồ vật, tài liệu kèm theo"
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
      "label": "Lãnh đạo phụ trách tố tụng"
    },
    {
      "col": "dieuTraVien",
      "kind": "text",
      "label": "Điều tra viên thụ lý"
    },
    {
      "col": "dieuTraVienPhuongXa",
      "kind": "text",
      "label": "Điều tra viên là trưởng - phó Công an phường thụ lý"
    },
    {
      "col": "noiCapCccd",
      "kind": "text",
      "label": "Nơi cấp CCCD"
    },
    {
      "col": "ngayCapCccd",
      "kind": "date",
      "label": "Ngày cấp CCCD"
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
      "label": "Ghi chú khác"
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
      "label": "Tóm tắt nội dung"
    },
    {
      "col": "nguonDon",
      "kind": "text",
      "label": "Nguồn đơn/Đơn vị giao"
    },
    {
      "col": "tenCungCap",
      "kind": "text",
      "label": "Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại"
    },
    {
      "col": "sinhNamCungCap",
      "kind": "text",
      "label": "Sinh năm"
    },
    {
      "col": "cccdCungCap",
      "kind": "text",
      "label": "Số căn cước công dân"
    },
    {
      "col": "ngayCapCccd",
      "kind": "date",
      "label": "Ngày cấp CCCD"
    },
    {
      "col": "noiCapCccd",
      "kind": "text",
      "label": "Nơi cấp CCCD"
    },
    {
      "col": "sdtCungCap",
      "kind": "text",
      "label": "Số điện thoại nguyên đơn"
    },
    {
      "col": "diaChiCungCap",
      "kind": "text",
      "label": "Địa chỉ cá nhân, cơ quan, tổ chức cung cấp, bị hại"
    },
    {
      "col": "nghiVanDoiTuong",
      "kind": "text",
      "label": "Nghi vấn đối tượng hoặc bị can"
    },
    {
      "col": "nhanXet",
      "kind": "text",
      "label": "Nhận xét"
    },
    {
      "col": "noiXayRa",
      "kind": "text",
      "label": "Nơi xảy ra tội phạm"
    },
    {
      "col": "phuongThucThuDoan",
      "kind": "text",
      "label": "Phương thức thủ đoạn"
    },
    {
      "col": "ketQuaXuLyKhac",
      "kind": "text",
      "label": "Kết quả xử lý, giải quyết khác"
    },
    {
      "col": "soPhieuChuyen",
      "kind": "text",
      "label": "Số phiếu chuyển/ Công văn/ Ủy thác điều tra"
    },
    {
      "col": "ngayPhieuChuyen",
      "kind": "date",
      "label": "Ngày phiếu chuyển/ Công văn/ Ủy thác điều tra"
    },
    {
      "col": "doVatTaiLieuKemTheo",
      "kind": "text",
      "label": "Đồ vật, tài liệu kèm theo"
    },
    {
      "col": "ngayVietDon",
      "kind": "date",
      "label": "Ngày viết đơn"
    },
    {
      "col": "ghiChuTrungDon",
      "kind": "text",
      "label": "Ghi chú trùng đơn"
    },
    {
      "col": "baoCaoBanGiamDoc",
      "kind": "checkbox",
      "label": "Trường hợp báo cáo Ban Giám đốc"
    },
    {
      "col": "ngayGiaoDonViGiaiQuyet",
      "kind": "date",
      "label": "Ngày giao đơn vị giải quyết"
    },
    {
      "col": "lanhDaoToTung",
      "kind": "text",
      "label": "Lãnh đạo phụ trách tố tụng"
    },
    {
      "col": "dieuTraVien",
      "kind": "text",
      "label": "Điều tra viên thụ lý"
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
    }
  ]
};
