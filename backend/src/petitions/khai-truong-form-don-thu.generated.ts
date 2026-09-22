/* SINH TỰ ĐỘNG — đừng sửa tay. Chạy lại: npm run gen:khai-xuat-day-du */
/* Nguồn: frontend/src/features/cases/legacy-form-layout.def.ts (bố cục hệ cũ),
   trừ ô đã bỏ khỏi Đơn thư (o-an.def.ts) và ô đã có chỗ khác (legacy-form-binding.ts). */

export interface TruongFormDonThu {
  /** Tên ô theo đặc tả hệ cũ. */
  field: string;
  /** Nhãn nguyên văn trên màn — dùng làm tiêu đề cột Excel. */
  caption: string;
  /** Cột thật trên bảng `petitions`; `null` = nằm trong `metadata`. */
  cot: string | null;
  /** Khoá THẬT để đọc giá trị — cột riêng, hoặc khoá `metadata` đã cắt `statistic.`. */
  khoaLuu: string;
}

export const TRUONG_FORM_DON_THU: readonly TruongFormDonThu[] = [
  {
    "field": "vatChungMoTa",
    "caption": "Loại, đặc điểm đồ vật, tài liệu, vật chứng",
    "cot": null,
    "khoaLuu": "vatChungMoTa"
  },
  {
    "field": "lenhNhapKho",
    "caption": "Lệnh nhập, phiếu nhập kho",
    "cot": null,
    "khoaLuu": "lenhNhapKho"
  },
  {
    "field": "noiLuuTruBaoQuan",
    "caption": "Nơi lưu trữ, bảo quản, kê biên, phong tỏa",
    "cot": null,
    "khoaLuu": "noiLuuTruBaoQuan"
  },
  {
    "field": "statistic.soDangKyHoSo",
    "caption": "Số đăng ký hồ sơ nghiệp vụ",
    "cot": null,
    "khoaLuu": "soDangKyHoSo"
  },
  {
    "field": "statistic.ngayDangKyHoSo",
    "caption": "Ngày đăng ký hồ sơ nghiệp vụ",
    "cot": null,
    "khoaLuu": "ngayDangKyHoSo"
  },
  {
    "field": "statistic.hoSoLuu",
    "caption": "Số hồ sơ lưu",
    "cot": null,
    "khoaLuu": "hoSoLuu"
  },
  {
    "field": "statistic.ngayNopLuuHoSo",
    "caption": "Ngày nộp lưu hồ sơ",
    "cot": null,
    "khoaLuu": "ngayNopLuuHoSo"
  },
  {
    "field": "statistic.donViBaoQuanHoSo",
    "caption": "Đơn vị lưu giữ, bảo quản hồ sơ",
    "cot": null,
    "khoaLuu": "donViBaoQuanHoSo"
  },
  {
    "field": "dieuTraVienText",
    "caption": "Điều tra viên thụ lý",
    "cot": "dieuTraVien",
    "khoaLuu": "dieuTraVien"
  },
  {
    "field": "lanhDaoToTung",
    "caption": "Lãnh đạo phụ trách tố tụng",
    "cot": "lanhDaoToTung",
    "khoaLuu": "lanhDaoToTung"
  },
  {
    "field": "soQDPhanCongNguonTin",
    "caption": "Quyết định phân công giải quyết nguồn tin tội phạm",
    "cot": "soQDPhanCongNguonTin",
    "khoaLuu": "soQDPhanCongNguonTin"
  },
  {
    "field": "ngayQDPhanCongNguonTin",
    "caption": "Ngày ra Quyết định phân công giải quyết nguồn tin tội phạm",
    "cot": "ngayQDPhanCongNguonTin",
    "khoaLuu": "ngayQDPhanCongNguonTin"
  },
  {
    "field": "soQDKhongKhoiTo",
    "caption": "Quyết định Không khởi tố",
    "cot": null,
    "khoaLuu": "soQDKhongKhoiTo"
  },
  {
    "field": "ngayQDKhongKhoiTo",
    "caption": "Ngày ra Quyết định Không khởi tố",
    "cot": null,
    "khoaLuu": "ngayQDKhongKhoiTo"
  },
  {
    "field": "canCuKhongKhoiTo",
    "caption": "Căn cứ để ra Quyết định Không khởi tố",
    "cot": null,
    "khoaLuu": "canCuKhongKhoiTo"
  },
  {
    "field": "lyDoKhongKhoiTo",
    "caption": "Lý do ra Quyết định không khởi tố vụ án",
    "cot": null,
    "khoaLuu": "lyDoKhongKhoiTo"
  },
  {
    "field": "ngayDeXuat",
    "caption": "Ngày/Tháng/Năm đề xuất",
    "cot": "ngayDeXuat",
    "khoaLuu": "ngayDeXuat"
  },
  {
    "field": "phanLoaiNguonTinBanDau",
    "caption": "Phân loại ban đầu",
    "cot": "phanLoaiNguonTin",
    "khoaLuu": "phanLoaiNguonTin"
  },
  {
    "field": "nguonDon",
    "caption": "Nguồn đơn/Đơn vị giao",
    "cot": "nguonDon",
    "khoaLuu": "nguonDon"
  },
  {
    "field": "loaiThongTin",
    "caption": "Loại thông tin",
    "cot": "loaiThongTin",
    "khoaLuu": "loaiThongTin"
  },
  {
    "field": "soPhieuChuyen",
    "caption": "Số phiếu chuyển/ Công văn/ Ủy thác điều tra",
    "cot": "soPhieuChuyen",
    "khoaLuu": "soPhieuChuyen"
  },
  {
    "field": "ngayPhieuChuyen",
    "caption": "Ngày phiếu chuyển/ Công văn/ Ủy thác điều tra",
    "cot": "ngayPhieuChuyen",
    "khoaLuu": "ngayPhieuChuyen"
  },
  {
    "field": "ngayTiepNhanNguonTin",
    "caption": "Ngày tiếp nhận (theo biên bản tiếp nhận nguồn tin)",
    "cot": "ngayTiepNhanNguonTin",
    "khoaLuu": "ngayTiepNhanNguonTin"
  },
  {
    "field": "tenCungCap",
    "caption": "Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại",
    "cot": "senderName",
    "khoaLuu": "senderName"
  },
  {
    "field": "sdtCungCap",
    "caption": "Số điện thoại nguyên đơn",
    "cot": "senderPhone",
    "khoaLuu": "senderPhone"
  },
  {
    "field": "sinhNamCungCap",
    "caption": "Sinh năm",
    "cot": "senderBirthYear",
    "khoaLuu": "senderBirthYear"
  },
  {
    "field": "cccdCungCap",
    "caption": "Số căn cước công dân",
    "cot": "senderIdNumber",
    "khoaLuu": "senderIdNumber"
  },
  {
    "field": "ngayCapCccd",
    "caption": "Ngày cấp CCCD",
    "cot": "senderIdIssueDate",
    "khoaLuu": "senderIdIssueDate"
  },
  {
    "field": "noiCapCccd",
    "caption": "Nơi cấp CCCD",
    "cot": "senderIdIssuePlace",
    "khoaLuu": "senderIdIssuePlace"
  },
  {
    "field": "diaChiCungCap",
    "caption": "Địa chỉ cá nhân, cơ quan, tổ chức cung cấp, bị hại",
    "cot": "senderAddress",
    "khoaLuu": "senderAddress"
  },
  {
    "field": "crimeChinhId",
    "caption": "Tội danh chính - BLHS 2015 (nhận định ban đầu)",
    "cot": "crimeChinhId",
    "khoaLuu": "crimeChinhId"
  },
  {
    "field": "utdt_thoiHanUyThac",
    "caption": "Thời hạn thực hiện Uỷ thác điều tra",
    "cot": "thoiHanUTDT",
    "khoaLuu": "thoiHanUTDT"
  },
  {
    "field": "description",
    "caption": "Tóm tắt nội dung",
    "cot": "detailContent",
    "khoaLuu": "detailContent"
  },
  {
    "field": "ngayVietDon",
    "caption": "Ngày viết đơn",
    "cot": "petitionDate",
    "khoaLuu": "petitionDate"
  },
  {
    "field": "nhanXet",
    "caption": "Nhận xét",
    "cot": "nhanThay",
    "khoaLuu": "nhanThay"
  },
  {
    "field": "ghiChuTrungDon",
    "caption": "Ghi chú trùng đơn",
    "cot": "raSoatTrung",
    "khoaLuu": "raSoatTrung"
  },
  {
    "field": "baoCaoBanGiamDoc",
    "caption": "Trường hợp báo cáo Ban Giám đốc",
    "cot": "baoCaoBanGiamDocText",
    "khoaLuu": "baoCaoBanGiamDocText"
  },
  {
    "field": "ngayGiaoDonViGiaiQuyet",
    "caption": "Ngày giao đơn vị giải quyết",
    "cot": "ngayGiaoDonViGiaiQuyet",
    "khoaLuu": "ngayGiaoDonViGiaiQuyet"
  },
  {
    "field": "laCongNgheCao",
    "caption": "Bấm chọn nếu xác định đây là tội phạm công nghệ cao",
    "cot": "laCongNgheCao",
    "khoaLuu": "laCongNgheCao"
  },
  {
    "field": "ketQuaXuLyKhac",
    "caption": "Kết quả xử lý, giải quyết khác",
    "cot": "ketQuaXuLyKhac",
    "khoaLuu": "ketQuaXuLyKhac"
  },
  {
    "field": "ghiChuKhac",
    "caption": "Ghi chú khác",
    "cot": "ghiChuKhac",
    "khoaLuu": "ghiChuKhac"
  },
  {
    "field": "chuyenVuViecDonViKhac",
    "caption": "Chuyển vụ việc cho đơn vị khác",
    "cot": null,
    "khoaLuu": "chuyenVuViecDonViKhac"
  },
  {
    "field": "nhapVaoVuViecSo",
    "caption": "Nhập vào vụ việc hồ sơ khác",
    "cot": null,
    "khoaLuu": "nhapVaoVuViecSo"
  },
  {
    "field": "phanLoaiDanSu",
    "caption": "Phân loại dân sự",
    "cot": null,
    "khoaLuu": "phanLoaiDanSu"
  },
  {
    "field": "capDoToiPham",
    "caption": "Phân loại tội phạm (Chỉ xác định sau khi có Quyết định khởi tố vụ án)",
    "cot": null,
    "khoaLuu": "capDoToiPham"
  },
  {
    "field": "toiDanhChinhKhoiToId",
    "caption": "Tội danh chính khi khởi tố",
    "cot": null,
    "khoaLuu": "toiDanhChinhKhoiToId"
  },
  {
    "field": "toiDanhKhacIds",
    "caption": "Tội danh phụ khi khởi tố",
    "cot": null,
    "khoaLuu": "toiDanhKhacIds"
  },
  {
    "field": "soQuyetDinhKhoiTo",
    "caption": "Số Quyết định Khởi tố vụ án",
    "cot": null,
    "khoaLuu": "soQuyetDinhKhoiTo"
  },
  {
    "field": "ngayKhoiTo",
    "caption": "Ngày ra Quyết định Khởi tố vụ án",
    "cot": null,
    "khoaLuu": "ngayKhoiTo"
  },
  {
    "field": "soQDNhapVuAn",
    "caption": "Số Quyết định nhập vụ án",
    "cot": null,
    "khoaLuu": "soQDNhapVuAn"
  },
  {
    "field": "ngayNhapVuAn",
    "caption": "Ngày tháng năm nhập vụ án",
    "cot": null,
    "khoaLuu": "ngayNhapVuAn"
  },
  {
    "field": "ghiChuNhapHoSo",
    "caption": "Ghi chú nhập vào hồ sơ nào",
    "cot": null,
    "khoaLuu": "ghiChuNhapHoSo"
  },
  {
    "field": "soQDTachVuAn",
    "caption": "Số Quyết định tách vụ án",
    "cot": null,
    "khoaLuu": "soQDTachVuAn"
  },
  {
    "field": "ngayTachVuAn",
    "caption": "Ngày Quyết định tách hồ sơ",
    "cot": null,
    "khoaLuu": "ngayTachVuAn"
  },
  {
    "field": "soQDTachHanhVi",
    "caption": "Số Quyết định tách hành vi",
    "cot": null,
    "khoaLuu": "soQDTachHanhVi"
  },
  {
    "field": "ngayTachHanhVi",
    "caption": "Ngày Quyết định tách hành vi",
    "cot": null,
    "khoaLuu": "ngayTachHanhVi"
  },
  {
    "field": "soKLDT",
    "caption": "Số KLĐT đề nghị truy tố",
    "cot": null,
    "khoaLuu": "soKLDT"
  },
  {
    "field": "ngayKLDT",
    "caption": "Ngày Kết luận điều tra vụ án",
    "cot": null,
    "khoaLuu": "ngayKLDT"
  },
  {
    "field": "soQDDieuTraLai",
    "caption": "Số Quyết định điều tra lại",
    "cot": null,
    "khoaLuu": "soQDDieuTraLai"
  },
  {
    "field": "ngayQDDieuTraLai",
    "caption": "Ngày Quyết định điều tra lại",
    "cot": null,
    "khoaLuu": "ngayQDDieuTraLai"
  },
  {
    "field": "soQDDinhChiVuAn",
    "caption": "Số Quyết định đình chỉ vụ án",
    "cot": null,
    "khoaLuu": "soQDDinhChiVuAn"
  },
  {
    "field": "ngayDinhChiVuAn",
    "caption": "Ngày Quyết định đình chỉ vụ án",
    "cot": null,
    "khoaLuu": "ngayDinhChiVuAn"
  },
  {
    "field": "chuyenVuAnChoCQK",
    "caption": "Đã chuyển vụ án cho CQĐT khác",
    "cot": null,
    "khoaLuu": "chuyenVuAnChoCQK"
  },
  {
    "field": "soBanAnCoHieuLuc",
    "caption": "Số bản án của toà án có hiệu lực",
    "cot": null,
    "khoaLuu": "soBanAnCoHieuLuc"
  },
  {
    "field": "ngayBanAnCoHieuLuc",
    "caption": "Ngày tháng năm bản án của toà án có hiệu lực",
    "cot": null,
    "khoaLuu": "ngayBanAnCoHieuLuc"
  },
  {
    "field": "vuViecTamDungTruoc2015",
    "caption": "Xác định vụ việc này là vụ việc tạm dừng giải quyết (trước năm 2015)",
    "cot": null,
    "khoaLuu": "vuViecTamDungTruoc2015"
  },
  {
    "field": "soQDTamDinhChiNguonTin",
    "caption": "Quyết định Tạm đình chỉ nguồn tin",
    "cot": "soQDTamDinhChiNguonTin",
    "khoaLuu": "soQDTamDinhChiNguonTin"
  },
  {
    "field": "ngayQDTamDinhChiNguonTin",
    "caption": "Ngày ra Quyết định Tạm đình chỉ nguồn tin",
    "cot": "ngayQDTamDinhChiNguonTin",
    "khoaLuu": "ngayQDTamDinhChiNguonTin"
  },
  {
    "field": "canCuTamDinhChiNguonTin",
    "caption": "Căn cứ Tạm đình chỉ nguồn tin",
    "cot": "canCuTamDinhChiNguonTin",
    "khoaLuu": "canCuTamDinhChiNguonTin"
  },
  {
    "field": "lyDoTamDinhChiNguonTin",
    "caption": "Lý do tạm đình chỉ",
    "cot": null,
    "khoaLuu": "lyDoTamDinhChiNguonTin"
  },
  {
    "field": "ngayHetThoiHieuVuViec",
    "caption": "Ngày tháng năm hết thời hiệu truy cứu TNHS",
    "cot": null,
    "khoaLuu": "ngayHetThoiHieuVuViec"
  },
  {
    "field": "khacPhucLyDoTDCVuViec",
    "caption": "Biên bản, báo cáo, kế hoạch khắc phục lý do TĐC vụ việc",
    "cot": null,
    "khoaLuu": "khacPhucLyDoTDCVuViec"
  },
  {
    "field": "tienDoKhacPhucTDCVuViec",
    "caption": "Tiến độ khắc phục TĐC vụ việc",
    "cot": null,
    "khoaLuu": "tienDoKhacPhucTDCVuViec"
  },
  {
    "field": "soPhucHoiNguonTin",
    "caption": "Số Phục hồi nguồn tin tội phạm",
    "cot": "soPhucHoiNguonTin",
    "khoaLuu": "soPhucHoiNguonTin"
  },
  {
    "field": "ngayPhucHoiNguonTin",
    "caption": "Ngày Phục hồi nguồn tin tội phạm",
    "cot": "ngayPhucHoiNguonTin",
    "khoaLuu": "ngayPhucHoiNguonTin"
  },
  {
    "field": "soQuyetDinhTamDinhChi",
    "caption": "Số Quyết định Tạm đình chỉ vụ án",
    "cot": null,
    "khoaLuu": "soQuyetDinhTamDinhChi"
  },
  {
    "field": "ngayTamDinhChi",
    "caption": "Ngày Quyết định tạm đình chỉ vụ án",
    "cot": null,
    "khoaLuu": "ngayTamDinhChi"
  },
  {
    "field": "canCuTamDinhChiVuAn",
    "caption": "Căn cứ tạm đình chỉ vụ án",
    "cot": null,
    "khoaLuu": "canCuTamDinhChiVuAn"
  },
  {
    "field": "lyDoTamDinhChiVuAn",
    "caption": "Lý do tạm đình chỉ vụ án",
    "cot": null,
    "khoaLuu": "lyDoTamDinhChiVuAn"
  },
  {
    "field": "ngayHetThoiHieu",
    "caption": "Ngày hết thời hiệu truy cứu TNHS vụ án",
    "cot": null,
    "khoaLuu": "ngayHetThoiHieu"
  },
  {
    "field": "tdcKhacPhucBienBan",
    "caption": "Biên bản, báo cáo, kế hoạch khắc phục lý do TĐC vụ án",
    "cot": null,
    "khoaLuu": "tdcKhacPhucBienBan"
  },
  {
    "field": "tdcKhacPhucLyDoBienPhap",
    "caption": "Biện pháp, tiến độ khắc phục lý do TĐC vụ án",
    "cot": null,
    "khoaLuu": "tdcKhacPhucLyDoBienPhap"
  },
  {
    "field": "soQuyetDinhPhucHoi",
    "caption": "Số Quyết định Phục hồi Vụ án",
    "cot": null,
    "khoaLuu": "soQuyetDinhPhucHoi"
  },
  {
    "field": "ngayPhucHoi",
    "caption": "Ngày Quyết định phục hồi điều tra vụ án",
    "cot": null,
    "khoaLuu": "ngayPhucHoi"
  },
  {
    "field": "canCuPhucHoiVuAn",
    "caption": "Căn cứ ra quyết định Phục hồi điều tra vụ án",
    "cot": null,
    "khoaLuu": "canCuPhucHoiVuAn"
  },
  {
    "field": "statistic.ngayThongKe",
    "caption": "Ngày tổng hợp thống kê",
    "cot": null,
    "khoaLuu": "ngayThongKe"
  },
  {
    "field": "statistic.ngayPhanCongGiaiQuyetToGiac",
    "caption": "Ngày Thời điểm phân công giải quyết tố giác, tin báo",
    "cot": null,
    "khoaLuu": "ngayPhanCongGiaiQuyetToGiac"
  },
  {
    "field": "statistic.ngayTiepNhanTin",
    "caption": "Ngày tiếp nhận tin khi đơn vị nhận được",
    "cot": null,
    "khoaLuu": "ngayTiepNhanTin"
  },
  {
    "field": "statistic.ngayDauThu",
    "caption": "Ngày người phạm tội đầu thú, tự thú",
    "cot": null,
    "khoaLuu": "ngayDauThu"
  },
  {
    "field": "statistic.ngayPhamToiQuaTang",
    "caption": "Ngày người phạm tội bị bắt quả tang",
    "cot": null,
    "khoaLuu": "ngayPhamToiQuaTang"
  },
  {
    "field": "statistic.ngayBatKhanCap",
    "caption": "Ngày Người phạm tội bị giữ trong các trường hợp khẩn cấp",
    "cot": null,
    "khoaLuu": "ngayBatKhanCap"
  },
  {
    "field": "statistic.ngayPhatHienDauHieu",
    "caption": "Ngày CQCSĐT trực tiếp phát hiện có dấu hiệu tội phạm",
    "cot": null,
    "khoaLuu": "ngayPhatHienDauHieu"
  },
  {
    "field": "ngayXayRa",
    "caption": "Ngày tội phạm xảy ra",
    "cot": "ngayXayRa",
    "khoaLuu": "ngayXayRa"
  },
  {
    "field": "statistic.soTienBiThietHai",
    "caption": "Số tiền bị thiệt hại (triệu Việt nam Đồng)",
    "cot": "soTienBiThietHai",
    "khoaLuu": "soTienBiThietHai"
  },
  {
    "field": "statistic.soTienThuHoi",
    "caption": "Số tiền thu hồi được (triệu Việt Nam Đồng)",
    "cot": null,
    "khoaLuu": "soTienThuHoi"
  },
  {
    "field": "phuongThucThuDoan",
    "caption": "Phương thức thủ đoạn",
    "cot": "phuongThucThuDoan",
    "khoaLuu": "phuongThucThuDoan"
  },
  {
    "field": "noiXayRaPhuongXa",
    "caption": "Nơi xảy ra (cấp phường/xã)",
    "cot": "noiXayRaPhuongXa",
    "khoaLuu": "noiXayRaPhuongXa"
  },
  {
    "field": "statistic.soDoiTuong",
    "caption": "Số đối tượng phạm tội",
    "cot": null,
    "khoaLuu": "soDoiTuong"
  },
  {
    "field": "statistic.soDoiTuongDaBat",
    "caption": "Số đối tượng bắt được",
    "cot": null,
    "khoaLuu": "soDoiTuongDaBat"
  },
  {
    "field": "statistic.soDoiTuongBiBatVuAnKhac",
    "caption": "Số đối tượng bị bắt trong vụ án khác",
    "cot": null,
    "khoaLuu": "soDoiTuongBiBatVuAnKhac"
  },
  {
    "field": "statistic.dieuTraMoRong",
    "caption": "Điều tra mở rộng",
    "cot": null,
    "khoaLuu": "dieuTraMoRong"
  },
  {
    "field": "statistic.suDungVuKhiNong",
    "caption": "Sử dụng vũ khí nóng",
    "cot": null,
    "khoaLuu": "suDungVuKhiNong"
  },
  {
    "field": "statistic.soLuongBiHai",
    "caption": "Số lượng người bị hại",
    "cot": "soLuongBiHai",
    "khoaLuu": "soLuongBiHai"
  },
  {
    "field": "statistic.soLuongNguoiChet",
    "caption": "Số người chết",
    "cot": null,
    "khoaLuu": "soLuongNguoiChet"
  },
  {
    "field": "statistic.soNguoiBiThuong",
    "caption": "Số người bị thương",
    "cot": null,
    "khoaLuu": "soNguoiBiThuong"
  },
  {
    "field": "statistic.coBangNhom",
    "caption": "Xác nhận có băng nhóm",
    "cot": null,
    "khoaLuu": "coBangNhom"
  },
  {
    "field": "statistic.soBangNhomBatDuoc",
    "caption": "Bắt được bao nhiêu băng nhóm",
    "cot": null,
    "khoaLuu": "soBangNhomBatDuoc"
  },
  {
    "field": "statistic.soSungThuHoi",
    "caption": "Số lượng súng thu hồi",
    "cot": null,
    "khoaLuu": "soSungThuHoi"
  },
  {
    "field": "statistic.soThuocNoThuHoi",
    "caption": "Số lượng thuốc nổ thu hồi",
    "cot": null,
    "khoaLuu": "soThuocNoThuHoi"
  },
  {
    "field": "statistic.coVPHC",
    "caption": "Xác nhận vụ việc có vi phạm hành chính",
    "cot": null,
    "khoaLuu": "coVPHC"
  },
  {
    "field": "statistic.soDoiTuongVPHC",
    "caption": "Số đối tượng vi phạm hành chính",
    "cot": null,
    "khoaLuu": "soDoiTuongVPHC"
  },
  {
    "field": "statistic.soNguoiBiPhatTien",
    "caption": "Số người bị phạt tiền",
    "cot": null,
    "khoaLuu": "soNguoiBiPhatTien"
  },
  {
    "field": "statistic.tongTienPhatHanhChinh",
    "caption": "Tổng số tiền phạt hành chính (triệu Việt Nam Đồng)",
    "cot": null,
    "khoaLuu": "tongTienPhatHanhChinh"
  },
  {
    "field": "statistic.soDoiTuongSuuTraHiemNghi",
    "caption": "Số đối tượng sưu tra/hiềm nghi",
    "cot": null,
    "khoaLuu": "soDoiTuongSuuTraHiemNghi"
  },
  {
    "field": "statistic.coGhiAmGhiHinh",
    "caption": "Bấm xác nhận nếu là nguồn tin có sử dụng Ghi âm, Ghi hình",
    "cot": null,
    "khoaLuu": "coGhiAmGhiHinh"
  },
  {
    "field": "statistic.tongSoBienBanGhiLoiKhai",
    "caption": "Tổng số biên bản ghi lời khai",
    "cot": null,
    "khoaLuu": "tongSoBienBanGhiLoiKhai"
  },
  {
    "field": "statistic.soBienBanGhiLoiKhaiCoGhiAm",
    "caption": "Số lượng biên bản ghi lời khai có ghi âm ghi hình",
    "cot": null,
    "khoaLuu": "soBienBanGhiLoiKhaiCoGhiAm"
  },
  {
    "field": "statistic.laVuAnGhiAmGhiHinh",
    "caption": "Xác nhận nếu là Vụ án có sử dụng Ghi âm, Ghi hình",
    "cot": null,
    "khoaLuu": "laVuAnGhiAmGhiHinh"
  },
  {
    "field": "statistic.tongSoBienBanHoiCung",
    "caption": "Tổng số biên bản hỏi cung bị can",
    "cot": null,
    "khoaLuu": "tongSoBienBanHoiCung"
  },
  {
    "field": "statistic.tongSoBienBanHoiCungCoGhiAm",
    "caption": "Tổng số biên bản hỏi cung có ghi âm ghi hình",
    "cot": null,
    "khoaLuu": "tongSoBienBanHoiCungCoGhiAm"
  },
  {
    "field": "statistic.soBiCanCoGhiAm",
    "caption": "Số lượng bị can có ghi âm ghi hình",
    "cot": null,
    "khoaLuu": "soBiCanCoGhiAm"
  },
  {
    "field": "statistic.vksYeuCauGhiAm",
    "caption": "Bấm xác nhận nếu VKS yêu cầu ghi âm ghi hình",
    "cot": null,
    "khoaLuu": "vksYeuCauGhiAm"
  },
  {
    "field": "statistic.soBiCanVksYeuCauGhiAm",
    "caption": "Số lượng bị can VKS yêu cầu ghi âm ghi hình",
    "cot": null,
    "khoaLuu": "soBiCanVksYeuCauGhiAm"
  },
  {
    "field": "statistic.vuAnDaDuocXetXu",
    "caption": "Xác nhận vụ án đã được xét xử",
    "cot": null,
    "khoaLuu": "vuAnDaDuocXetXu"
  },
  {
    "field": "statistic.ghiAmGhiHinhDaDuocXetXu",
    "caption": "Xác nhận Trong đó: Số vụ án tiến hành Ghi âm, Ghi hình đã được xét xử",
    "cot": null,
    "khoaLuu": "ghiAmGhiHinhDaDuocXetXu"
  },
  {
    "field": "statistic.coSuDungKQGhiAmTrongXetXu",
    "caption": "Xác nhận trong đó: Vụ án có sử dụng kết quả Ghi âm ghi hình trong xét xử",
    "cot": null,
    "khoaLuu": "coSuDungKQGhiAmTrongXetXu"
  },
  {
    "field": "statistic.khongGAGHNhungToaYeuCau",
    "caption": "Xác nhận trong đó: Vụ án không ghi âm ghi hình nhưng Tòa án yêu cầu cung cấp ghi âm ghi hình",
    "cot": null,
    "khoaLuu": "khongGAGHNhungToaYeuCau"
  },
  {
    "field": "huongXuLy",
    "caption": "Hướng xử lý",
    "cot": "huongXuLy",
    "khoaLuu": "huongXuLy"
  },
  {
    "field": "donViGiaiQuyet",
    "caption": "Đơn vị xử lý",
    "cot": "donViGiaiQuyet",
    "khoaLuu": "donViGiaiQuyet"
  },
  {
    "field": "deXuat",
    "caption": "Đề xuất xử lý",
    "cot": "deXuat",
    "khoaLuu": "deXuat"
  }
];
