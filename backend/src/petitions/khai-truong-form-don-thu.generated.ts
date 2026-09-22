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
}

export const TRUONG_FORM_DON_THU: readonly TruongFormDonThu[] = [
  {
    "field": "vatChungMoTa",
    "caption": "Loại, đặc điểm đồ vật, tài liệu, vật chứng",
    "cot": null
  },
  {
    "field": "lenhNhapKho",
    "caption": "Lệnh nhập, phiếu nhập kho",
    "cot": null
  },
  {
    "field": "noiLuuTruBaoQuan",
    "caption": "Nơi lưu trữ, bảo quản, kê biên, phong tỏa",
    "cot": null
  },
  {
    "field": "statistic.soDangKyHoSo",
    "caption": "Số đăng ký hồ sơ nghiệp vụ",
    "cot": null
  },
  {
    "field": "statistic.ngayDangKyHoSo",
    "caption": "Ngày đăng ký hồ sơ nghiệp vụ",
    "cot": null
  },
  {
    "field": "statistic.hoSoLuu",
    "caption": "Số hồ sơ lưu",
    "cot": null
  },
  {
    "field": "statistic.ngayNopLuuHoSo",
    "caption": "Ngày nộp lưu hồ sơ",
    "cot": null
  },
  {
    "field": "statistic.donViBaoQuanHoSo",
    "caption": "Đơn vị lưu giữ, bảo quản hồ sơ",
    "cot": null
  },
  {
    "field": "dieuTraVienText",
    "caption": "Điều tra viên thụ lý",
    "cot": "dieuTraVien"
  },
  {
    "field": "lanhDaoToTung",
    "caption": "Lãnh đạo phụ trách tố tụng",
    "cot": "lanhDaoToTung"
  },
  {
    "field": "soQDPhanCongNguonTin",
    "caption": "Quyết định phân công giải quyết nguồn tin tội phạm",
    "cot": "soQDPhanCongNguonTin"
  },
  {
    "field": "ngayQDPhanCongNguonTin",
    "caption": "Ngày ra Quyết định phân công giải quyết nguồn tin tội phạm",
    "cot": "ngayQDPhanCongNguonTin"
  },
  {
    "field": "soQDKhongKhoiTo",
    "caption": "Quyết định Không khởi tố",
    "cot": null
  },
  {
    "field": "ngayQDKhongKhoiTo",
    "caption": "Ngày ra Quyết định Không khởi tố",
    "cot": null
  },
  {
    "field": "canCuKhongKhoiTo",
    "caption": "Căn cứ để ra Quyết định Không khởi tố",
    "cot": null
  },
  {
    "field": "lyDoKhongKhoiTo",
    "caption": "Lý do ra Quyết định không khởi tố vụ án",
    "cot": null
  },
  {
    "field": "ngayDeXuat",
    "caption": "Ngày/Tháng/Năm đề xuất",
    "cot": "ngayDeXuat"
  },
  {
    "field": "phanLoaiNguonTinBanDau",
    "caption": "Phân loại ban đầu",
    "cot": "phanLoaiNguonTin"
  },
  {
    "field": "nguonDon",
    "caption": "Nguồn đơn/Đơn vị giao",
    "cot": "nguonDon"
  },
  {
    "field": "loaiThongTin",
    "caption": "Loại thông tin",
    "cot": "loaiThongTin"
  },
  {
    "field": "soPhieuChuyen",
    "caption": "Số phiếu chuyển/ Công văn/ Ủy thác điều tra",
    "cot": "soPhieuChuyen"
  },
  {
    "field": "ngayPhieuChuyen",
    "caption": "Ngày phiếu chuyển/ Công văn/ Ủy thác điều tra",
    "cot": "ngayPhieuChuyen"
  },
  {
    "field": "ngayTiepNhanNguonTin",
    "caption": "Ngày tiếp nhận (theo biên bản tiếp nhận nguồn tin)",
    "cot": "ngayTiepNhanNguonTin"
  },
  {
    "field": "tenCungCap",
    "caption": "Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại",
    "cot": "senderName"
  },
  {
    "field": "sdtCungCap",
    "caption": "Số điện thoại nguyên đơn",
    "cot": "senderPhone"
  },
  {
    "field": "sinhNamCungCap",
    "caption": "Sinh năm",
    "cot": "senderBirthYear"
  },
  {
    "field": "cccdCungCap",
    "caption": "Số căn cước công dân",
    "cot": "senderIdNumber"
  },
  {
    "field": "ngayCapCccd",
    "caption": "Ngày cấp CCCD",
    "cot": "senderIdIssueDate"
  },
  {
    "field": "noiCapCccd",
    "caption": "Nơi cấp CCCD",
    "cot": "senderIdIssuePlace"
  },
  {
    "field": "diaChiCungCap",
    "caption": "Địa chỉ cá nhân, cơ quan, tổ chức cung cấp, bị hại",
    "cot": "senderAddress"
  },
  {
    "field": "crimeChinhId",
    "caption": "Tội danh chính - BLHS 2015 (nhận định ban đầu)",
    "cot": "crimeChinhId"
  },
  {
    "field": "utdt_thoiHanUyThac",
    "caption": "Thời hạn thực hiện Uỷ thác điều tra",
    "cot": "thoiHanUTDT"
  },
  {
    "field": "description",
    "caption": "Tóm tắt nội dung",
    "cot": "detailContent"
  },
  {
    "field": "ngayVietDon",
    "caption": "Ngày viết đơn",
    "cot": "petitionDate"
  },
  {
    "field": "nhanXet",
    "caption": "Nhận xét",
    "cot": "nhanThay"
  },
  {
    "field": "ghiChuTrungDon",
    "caption": "Ghi chú trùng đơn",
    "cot": "raSoatTrung"
  },
  {
    "field": "baoCaoBanGiamDoc",
    "caption": "Trường hợp báo cáo Ban Giám đốc",
    "cot": "baoCaoBanGiamDocText"
  },
  {
    "field": "ngayGiaoDonViGiaiQuyet",
    "caption": "Ngày giao đơn vị giải quyết",
    "cot": "ngayGiaoDonViGiaiQuyet"
  },
  {
    "field": "laCongNgheCao",
    "caption": "Bấm chọn nếu xác định đây là tội phạm công nghệ cao",
    "cot": "laCongNgheCao"
  },
  {
    "field": "ketQuaXuLyKhac",
    "caption": "Kết quả xử lý, giải quyết khác",
    "cot": "ketQuaXuLyKhac"
  },
  {
    "field": "ghiChuKhac",
    "caption": "Ghi chú khác",
    "cot": "ghiChuKhac"
  },
  {
    "field": "chuyenVuViecDonViKhac",
    "caption": "Chuyển vụ việc cho đơn vị khác",
    "cot": null
  },
  {
    "field": "nhapVaoVuViecSo",
    "caption": "Nhập vào vụ việc hồ sơ khác",
    "cot": null
  },
  {
    "field": "phanLoaiDanSu",
    "caption": "Phân loại dân sự",
    "cot": null
  },
  {
    "field": "capDoToiPham",
    "caption": "Phân loại tội phạm (Chỉ xác định sau khi có Quyết định khởi tố vụ án)",
    "cot": null
  },
  {
    "field": "toiDanhChinhKhoiToId",
    "caption": "Tội danh chính khi khởi tố",
    "cot": null
  },
  {
    "field": "toiDanhKhacIds",
    "caption": "Tội danh phụ khi khởi tố",
    "cot": null
  },
  {
    "field": "soQuyetDinhKhoiTo",
    "caption": "Số Quyết định Khởi tố vụ án",
    "cot": null
  },
  {
    "field": "ngayKhoiTo",
    "caption": "Ngày ra Quyết định Khởi tố vụ án",
    "cot": null
  },
  {
    "field": "soQDNhapVuAn",
    "caption": "Số Quyết định nhập vụ án",
    "cot": null
  },
  {
    "field": "ngayNhapVuAn",
    "caption": "Ngày tháng năm nhập vụ án",
    "cot": null
  },
  {
    "field": "ghiChuNhapHoSo",
    "caption": "Ghi chú nhập vào hồ sơ nào",
    "cot": null
  },
  {
    "field": "soQDTachVuAn",
    "caption": "Số Quyết định tách vụ án",
    "cot": null
  },
  {
    "field": "ngayTachVuAn",
    "caption": "Ngày Quyết định tách hồ sơ",
    "cot": null
  },
  {
    "field": "soQDTachHanhVi",
    "caption": "Số Quyết định tách hành vi",
    "cot": null
  },
  {
    "field": "ngayTachHanhVi",
    "caption": "Ngày Quyết định tách hành vi",
    "cot": null
  },
  {
    "field": "soKLDT",
    "caption": "Số KLĐT đề nghị truy tố",
    "cot": null
  },
  {
    "field": "ngayKLDT",
    "caption": "Ngày Kết luận điều tra vụ án",
    "cot": null
  },
  {
    "field": "soQDDieuTraLai",
    "caption": "Số Quyết định điều tra lại",
    "cot": null
  },
  {
    "field": "ngayQDDieuTraLai",
    "caption": "Ngày Quyết định điều tra lại",
    "cot": null
  },
  {
    "field": "soQDDinhChiVuAn",
    "caption": "Số Quyết định đình chỉ vụ án",
    "cot": null
  },
  {
    "field": "ngayDinhChiVuAn",
    "caption": "Ngày Quyết định đình chỉ vụ án",
    "cot": null
  },
  {
    "field": "chuyenVuAnChoCQK",
    "caption": "Đã chuyển vụ án cho CQĐT khác",
    "cot": null
  },
  {
    "field": "soBanAnCoHieuLuc",
    "caption": "Số bản án của toà án có hiệu lực",
    "cot": null
  },
  {
    "field": "ngayBanAnCoHieuLuc",
    "caption": "Ngày tháng năm bản án của toà án có hiệu lực",
    "cot": null
  },
  {
    "field": "vuViecTamDungTruoc2015",
    "caption": "Xác định vụ việc này là vụ việc tạm dừng giải quyết (trước năm 2015)",
    "cot": null
  },
  {
    "field": "soQDTamDinhChiNguonTin",
    "caption": "Quyết định Tạm đình chỉ nguồn tin",
    "cot": "soQDTamDinhChiNguonTin"
  },
  {
    "field": "ngayQDTamDinhChiNguonTin",
    "caption": "Ngày ra Quyết định Tạm đình chỉ nguồn tin",
    "cot": "ngayQDTamDinhChiNguonTin"
  },
  {
    "field": "canCuTamDinhChiNguonTin",
    "caption": "Căn cứ Tạm đình chỉ nguồn tin",
    "cot": "canCuTamDinhChiNguonTin"
  },
  {
    "field": "lyDoTamDinhChiNguonTin",
    "caption": "Lý do tạm đình chỉ",
    "cot": null
  },
  {
    "field": "ngayHetThoiHieuVuViec",
    "caption": "Ngày tháng năm hết thời hiệu truy cứu TNHS",
    "cot": null
  },
  {
    "field": "khacPhucLyDoTDCVuViec",
    "caption": "Biên bản, báo cáo, kế hoạch khắc phục lý do TĐC vụ việc",
    "cot": null
  },
  {
    "field": "tienDoKhacPhucTDCVuViec",
    "caption": "Tiến độ khắc phục TĐC vụ việc",
    "cot": null
  },
  {
    "field": "soPhucHoiNguonTin",
    "caption": "Số Phục hồi nguồn tin tội phạm",
    "cot": "soPhucHoiNguonTin"
  },
  {
    "field": "ngayPhucHoiNguonTin",
    "caption": "Ngày Phục hồi nguồn tin tội phạm",
    "cot": "ngayPhucHoiNguonTin"
  },
  {
    "field": "soQuyetDinhTamDinhChi",
    "caption": "Số Quyết định Tạm đình chỉ vụ án",
    "cot": null
  },
  {
    "field": "ngayTamDinhChi",
    "caption": "Ngày Quyết định tạm đình chỉ vụ án",
    "cot": null
  },
  {
    "field": "canCuTamDinhChiVuAn",
    "caption": "Căn cứ tạm đình chỉ vụ án",
    "cot": null
  },
  {
    "field": "lyDoTamDinhChiVuAn",
    "caption": "Lý do tạm đình chỉ vụ án",
    "cot": null
  },
  {
    "field": "ngayHetThoiHieu",
    "caption": "Ngày hết thời hiệu truy cứu TNHS vụ án",
    "cot": null
  },
  {
    "field": "tdcKhacPhucBienBan",
    "caption": "Biên bản, báo cáo, kế hoạch khắc phục lý do TĐC vụ án",
    "cot": null
  },
  {
    "field": "tdcKhacPhucLyDoBienPhap",
    "caption": "Biện pháp, tiến độ khắc phục lý do TĐC vụ án",
    "cot": null
  },
  {
    "field": "soQuyetDinhPhucHoi",
    "caption": "Số Quyết định Phục hồi Vụ án",
    "cot": null
  },
  {
    "field": "ngayPhucHoi",
    "caption": "Ngày Quyết định phục hồi điều tra vụ án",
    "cot": null
  },
  {
    "field": "canCuPhucHoiVuAn",
    "caption": "Căn cứ ra quyết định Phục hồi điều tra vụ án",
    "cot": null
  },
  {
    "field": "statistic.ngayThongKe",
    "caption": "Ngày tổng hợp thống kê",
    "cot": null
  },
  {
    "field": "statistic.ngayPhanCongGiaiQuyetToGiac",
    "caption": "Ngày Thời điểm phân công giải quyết tố giác, tin báo",
    "cot": null
  },
  {
    "field": "statistic.ngayTiepNhanTin",
    "caption": "Ngày tiếp nhận tin khi đơn vị nhận được",
    "cot": null
  },
  {
    "field": "statistic.ngayDauThu",
    "caption": "Ngày người phạm tội đầu thú, tự thú",
    "cot": null
  },
  {
    "field": "statistic.ngayPhamToiQuaTang",
    "caption": "Ngày người phạm tội bị bắt quả tang",
    "cot": null
  },
  {
    "field": "statistic.ngayBatKhanCap",
    "caption": "Ngày Người phạm tội bị giữ trong các trường hợp khẩn cấp",
    "cot": null
  },
  {
    "field": "statistic.ngayPhatHienDauHieu",
    "caption": "Ngày CQCSĐT trực tiếp phát hiện có dấu hiệu tội phạm",
    "cot": null
  },
  {
    "field": "ngayXayRa",
    "caption": "Ngày tội phạm xảy ra",
    "cot": "ngayXayRa"
  },
  {
    "field": "statistic.soTienBiThietHai",
    "caption": "Số tiền bị thiệt hại (triệu Việt nam Đồng)",
    "cot": "soTienBiThietHai"
  },
  {
    "field": "statistic.soTienThuHoi",
    "caption": "Số tiền thu hồi được (triệu Việt Nam Đồng)",
    "cot": null
  },
  {
    "field": "phuongThucThuDoan",
    "caption": "Phương thức thủ đoạn",
    "cot": "phuongThucThuDoan"
  },
  {
    "field": "noiXayRaPhuongXa",
    "caption": "Nơi xảy ra (cấp phường/xã)",
    "cot": "noiXayRaPhuongXa"
  },
  {
    "field": "statistic.soDoiTuong",
    "caption": "Số đối tượng phạm tội",
    "cot": null
  },
  {
    "field": "statistic.soDoiTuongDaBat",
    "caption": "Số đối tượng bắt được",
    "cot": null
  },
  {
    "field": "statistic.soDoiTuongBiBatVuAnKhac",
    "caption": "Số đối tượng bị bắt trong vụ án khác",
    "cot": null
  },
  {
    "field": "statistic.dieuTraMoRong",
    "caption": "Điều tra mở rộng",
    "cot": null
  },
  {
    "field": "statistic.suDungVuKhiNong",
    "caption": "Sử dụng vũ khí nóng",
    "cot": null
  },
  {
    "field": "statistic.soLuongBiHai",
    "caption": "Số lượng người bị hại",
    "cot": "soLuongBiHai"
  },
  {
    "field": "statistic.soLuongNguoiChet",
    "caption": "Số người chết",
    "cot": null
  },
  {
    "field": "statistic.soNguoiBiThuong",
    "caption": "Số người bị thương",
    "cot": null
  },
  {
    "field": "statistic.coBangNhom",
    "caption": "Xác nhận có băng nhóm",
    "cot": null
  },
  {
    "field": "statistic.soBangNhomBatDuoc",
    "caption": "Bắt được bao nhiêu băng nhóm",
    "cot": null
  },
  {
    "field": "statistic.soSungThuHoi",
    "caption": "Số lượng súng thu hồi",
    "cot": null
  },
  {
    "field": "statistic.soThuocNoThuHoi",
    "caption": "Số lượng thuốc nổ thu hồi",
    "cot": null
  },
  {
    "field": "statistic.coVPHC",
    "caption": "Xác nhận vụ việc có vi phạm hành chính",
    "cot": null
  },
  {
    "field": "statistic.soDoiTuongVPHC",
    "caption": "Số đối tượng vi phạm hành chính",
    "cot": null
  },
  {
    "field": "statistic.soNguoiBiPhatTien",
    "caption": "Số người bị phạt tiền",
    "cot": null
  },
  {
    "field": "statistic.tongTienPhatHanhChinh",
    "caption": "Tổng số tiền phạt hành chính (triệu Việt Nam Đồng)",
    "cot": null
  },
  {
    "field": "statistic.soDoiTuongSuuTraHiemNghi",
    "caption": "Số đối tượng sưu tra/hiềm nghi",
    "cot": null
  },
  {
    "field": "statistic.coGhiAmGhiHinh",
    "caption": "Bấm xác nhận nếu là nguồn tin có sử dụng Ghi âm, Ghi hình",
    "cot": null
  },
  {
    "field": "statistic.tongSoBienBanGhiLoiKhai",
    "caption": "Tổng số biên bản ghi lời khai",
    "cot": null
  },
  {
    "field": "statistic.soBienBanGhiLoiKhaiCoGhiAm",
    "caption": "Số lượng biên bản ghi lời khai có ghi âm ghi hình",
    "cot": null
  },
  {
    "field": "statistic.laVuAnGhiAmGhiHinh",
    "caption": "Xác nhận nếu là Vụ án có sử dụng Ghi âm, Ghi hình",
    "cot": null
  },
  {
    "field": "statistic.tongSoBienBanHoiCung",
    "caption": "Tổng số biên bản hỏi cung bị can",
    "cot": null
  },
  {
    "field": "statistic.tongSoBienBanHoiCungCoGhiAm",
    "caption": "Tổng số biên bản hỏi cung có ghi âm ghi hình",
    "cot": null
  },
  {
    "field": "statistic.soBiCanCoGhiAm",
    "caption": "Số lượng bị can có ghi âm ghi hình",
    "cot": null
  },
  {
    "field": "statistic.vksYeuCauGhiAm",
    "caption": "Bấm xác nhận nếu VKS yêu cầu ghi âm ghi hình",
    "cot": null
  },
  {
    "field": "statistic.soBiCanVksYeuCauGhiAm",
    "caption": "Số lượng bị can VKS yêu cầu ghi âm ghi hình",
    "cot": null
  },
  {
    "field": "statistic.vuAnDaDuocXetXu",
    "caption": "Xác nhận vụ án đã được xét xử",
    "cot": null
  },
  {
    "field": "statistic.ghiAmGhiHinhDaDuocXetXu",
    "caption": "Xác nhận Trong đó: Số vụ án tiến hành Ghi âm, Ghi hình đã được xét xử",
    "cot": null
  },
  {
    "field": "statistic.coSuDungKQGhiAmTrongXetXu",
    "caption": "Xác nhận trong đó: Vụ án có sử dụng kết quả Ghi âm ghi hình trong xét xử",
    "cot": null
  },
  {
    "field": "statistic.khongGAGHNhungToaYeuCau",
    "caption": "Xác nhận trong đó: Vụ án không ghi âm ghi hình nhưng Tòa án yêu cầu cung cấp ghi âm ghi hình",
    "cot": null
  }
];
