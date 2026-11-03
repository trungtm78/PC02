/* GENERATED - do not edit by hand. Re-run: npm run gen:khai-nhap-tu-anh */
/* Sources: frontend/src/features/cases/legacy-form-layout.def.ts (shared layout),
   petitions/legacy-form-binding.ts + petitions/o-an.def.ts, incidents/legacy-form-binding.ts. */

export type FormEntity = 'petition' | 'incident' | 'case';

export interface OcrFormField {
  /** Path the form's LegacyFormSpec.read/write use for this field. */
  field: string;
  /** Verbatim on-screen caption. */
  caption: string;
  kind: 'text' | 'date' | 'textarea' | 'number' | 'select' | 'multiselect' | 'toggle' | 'crime' | 'fk';
  required: boolean;
  /** Directory type for fk, or catalog key for multiselect. */
  source?: string;
  storage: 'column' | 'metadata' | 'statistic';
  /** Column name, metadata key, or statistic column, depending on storage. */
  storageKey: string;
}

export const OCR_FORM_FIELDS: Record<FormEntity, readonly OcrFormField[]> = {
  "petition": [
    {
      "field": "vatChungMoTa",
      "caption": "Loại, đặc điểm đồ vật, tài liệu, vật chứng",
      "kind": "textarea",
      "required": false,
      "storage": "metadata",
      "storageKey": "vatChungMoTa"
    },
    {
      "field": "lenhNhapKho",
      "caption": "Lệnh nhập, phiếu nhập kho",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "lenhNhapKho"
    },
    {
      "field": "noiLuuTruBaoQuan",
      "caption": "Nơi lưu trữ, bảo quản, kê biên, phong tỏa",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "noiLuuTruBaoQuan"
    },
    {
      "field": "statistic.soDangKyHoSo",
      "caption": "Số đăng ký hồ sơ nghiệp vụ",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "soDangKyHoSo"
    },
    {
      "field": "statistic.ngayDangKyHoSo",
      "caption": "Ngày đăng ký hồ sơ nghiệp vụ",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayDangKyHoSo"
    },
    {
      "field": "statistic.hoSoLuu",
      "caption": "Số hồ sơ lưu",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "hoSoLuu"
    },
    {
      "field": "statistic.ngayNopLuuHoSo",
      "caption": "Ngày nộp lưu hồ sơ",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayNopLuuHoSo"
    },
    {
      "field": "statistic.donViBaoQuanHoSo",
      "caption": "Đơn vị lưu giữ, bảo quản hồ sơ",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "donViBaoQuanHoSo"
    },
    {
      "field": "dieuTraVienText",
      "caption": "Điều tra viên thụ lý",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "dieuTraVien"
    },
    {
      "field": "lanhDaoToTung",
      "caption": "Lãnh đạo phụ trách tố tụng",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "lanhDaoToTung"
    },
    {
      "field": "soQDPhanCongNguonTin",
      "caption": "Quyết định phân công giải quyết nguồn tin tội phạm",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "soQDPhanCongNguonTin"
    },
    {
      "field": "ngayQDPhanCongNguonTin",
      "caption": "Ngày ra Quyết định phân công giải quyết nguồn tin tội phạm",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayQDPhanCongNguonTin"
    },
    {
      "field": "soQDKhongKhoiTo",
      "caption": "Quyết định Không khởi tố",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "soQDKhongKhoiTo"
    },
    {
      "field": "ngayQDKhongKhoiTo",
      "caption": "Ngày ra Quyết định Không khởi tố",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayQDKhongKhoiTo"
    },
    {
      "field": "canCuKhongKhoiTo",
      "caption": "Căn cứ để ra Quyết định Không khởi tố",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "canCuKhongKhoiTo"
    },
    {
      "field": "lyDoKhongKhoiTo",
      "caption": "Lý do ra Quyết định không khởi tố vụ án",
      "kind": "multiselect",
      "required": false,
      "storage": "metadata",
      "storageKey": "lyDoKhongKhoiTo"
    },
    {
      "field": "ngayDeXuat",
      "caption": "Ngày/Tháng/Năm đề xuất",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayDeXuat"
    },
    {
      "field": "phanLoaiNguonTinBanDau",
      "caption": "Phân loại ban đầu",
      "kind": "select",
      "required": false,
      "storage": "column",
      "storageKey": "phanLoaiNguonTin"
    },
    {
      "field": "nguonDon",
      "caption": "Nguồn đơn/Đơn vị giao",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "nguonDon"
    },
    {
      "field": "loaiThongTin",
      "caption": "Loại thông tin",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "loaiThongTin"
    },
    {
      "field": "soPhieuChuyen",
      "caption": "Số phiếu chuyển/ Công văn/ Ủy thác điều tra",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "soPhieuChuyen"
    },
    {
      "field": "ngayPhieuChuyen",
      "caption": "Ngày phiếu chuyển/ Công văn/ Ủy thác điều tra",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayPhieuChuyen"
    },
    {
      "field": "ngayTiepNhanNguonTin",
      "caption": "Ngày tiếp nhận (theo biên bản tiếp nhận nguồn tin)",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayTiepNhanNguonTin"
    },
    {
      "field": "tenCungCap",
      "caption": "Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "senderName"
    },
    {
      "field": "sdtCungCap",
      "caption": "Số điện thoại nguyên đơn",
      "kind": "text",
      "required": true,
      "storage": "column",
      "storageKey": "senderPhone"
    },
    {
      "field": "sinhNamCungCap",
      "caption": "Sinh năm",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "senderBirthYear"
    },
    {
      "field": "cccdCungCap",
      "caption": "Số căn cước công dân",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "senderIdNumber"
    },
    {
      "field": "ngayCapCccd",
      "caption": "Ngày cấp CCCD",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "senderIdIssueDate"
    },
    {
      "field": "noiCapCccd",
      "caption": "Nơi cấp CCCD",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "senderIdIssuePlace"
    },
    {
      "field": "diaChiCungCap",
      "caption": "Địa chỉ cá nhân, cơ quan, tổ chức cung cấp, bị hại",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "senderAddress"
    },
    {
      "field": "crimeChinhId",
      "caption": "Tội danh chính - BLHS 2015 (nhận định ban đầu)",
      "kind": "crime",
      "required": true,
      "storage": "column",
      "storageKey": "crimeChinhId"
    },
    {
      "field": "utdt_thoiHanUyThac",
      "caption": "Thời hạn thực hiện Uỷ thác điều tra",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "thoiHanUTDT"
    },
    {
      "field": "description",
      "caption": "Tóm tắt nội dung",
      "kind": "textarea",
      "required": false,
      "storage": "column",
      "storageKey": "detailContent"
    },
    {
      "field": "ngayVietDon",
      "caption": "Ngày viết đơn",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "petitionDate"
    },
    {
      "field": "nhanXet",
      "caption": "Nhận xét",
      "kind": "textarea",
      "required": false,
      "storage": "column",
      "storageKey": "nhanThay"
    },
    {
      "field": "ghiChuTrungDon",
      "caption": "Ghi chú trùng đơn",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "raSoatTrung"
    },
    {
      "field": "baoCaoBanGiamDoc",
      "caption": "Trường hợp báo cáo Ban Giám đốc",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "baoCaoBanGiamDocText"
    },
    {
      "field": "ngayGiaoDonViGiaiQuyet",
      "caption": "Ngày giao đơn vị giải quyết",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayGiaoDonViGiaiQuyet"
    },
    {
      "field": "laCongNgheCao",
      "caption": "Bấm chọn nếu xác định đây là tội phạm công nghệ cao",
      "kind": "toggle",
      "required": false,
      "storage": "column",
      "storageKey": "laCongNgheCao"
    },
    {
      "field": "ketQuaXuLyKhac",
      "caption": "Kết quả xử lý, giải quyết khác",
      "kind": "textarea",
      "required": false,
      "storage": "column",
      "storageKey": "ketQuaXuLyKhac"
    },
    {
      "field": "ghiChuKhac",
      "caption": "Ghi chú khác",
      "kind": "textarea",
      "required": false,
      "storage": "column",
      "storageKey": "ghiChuKhac"
    },
    {
      "field": "chuyenVuViecDonViKhac",
      "caption": "Chuyển vụ việc cho đơn vị khác",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "chuyenVuViecDonViKhac"
    },
    {
      "field": "nhapVaoVuViecSo",
      "caption": "Nhập vào vụ việc hồ sơ khác",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "nhapVaoVuViecSo"
    },
    {
      "field": "phanLoaiDanSu",
      "caption": "Phân loại dân sự",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "phanLoaiDanSu"
    },
    {
      "field": "capDoToiPham",
      "caption": "Phân loại tội phạm (Chỉ xác định sau khi có Quyết định khởi tố vụ án)",
      "kind": "select",
      "required": false,
      "storage": "metadata",
      "storageKey": "capDoToiPham"
    },
    {
      "field": "toiDanhChinhKhoiToId",
      "caption": "Tội danh chính khi khởi tố",
      "kind": "crime",
      "required": false,
      "storage": "metadata",
      "storageKey": "toiDanhChinhKhoiToId"
    },
    {
      "field": "toiDanhKhacIds",
      "caption": "Tội danh phụ khi khởi tố",
      "kind": "multiselect",
      "required": false,
      "storage": "metadata",
      "storageKey": "toiDanhKhacIds"
    },
    {
      "field": "soQuyetDinhKhoiTo",
      "caption": "Số Quyết định Khởi tố vụ án",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "soQuyetDinhKhoiTo"
    },
    {
      "field": "ngayKhoiTo",
      "caption": "Ngày ra Quyết định Khởi tố vụ án",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayKhoiTo"
    },
    {
      "field": "soQDNhapVuAn",
      "caption": "Số Quyết định nhập vụ án",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "soQDNhapVuAn"
    },
    {
      "field": "ngayNhapVuAn",
      "caption": "Ngày tháng năm nhập vụ án",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayNhapVuAn"
    },
    {
      "field": "ghiChuNhapHoSo",
      "caption": "Ghi chú nhập vào hồ sơ nào",
      "kind": "textarea",
      "required": false,
      "storage": "metadata",
      "storageKey": "ghiChuNhapHoSo"
    },
    {
      "field": "soQDTachVuAn",
      "caption": "Số Quyết định tách vụ án",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "soQDTachVuAn"
    },
    {
      "field": "ngayTachVuAn",
      "caption": "Ngày Quyết định tách hồ sơ",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayTachVuAn"
    },
    {
      "field": "soQDTachHanhVi",
      "caption": "Số Quyết định tách hành vi",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "soQDTachHanhVi"
    },
    {
      "field": "ngayTachHanhVi",
      "caption": "Ngày Quyết định tách hành vi",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayTachHanhVi"
    },
    {
      "field": "soKLDT",
      "caption": "Số KLĐT đề nghị truy tố",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "soKLDT"
    },
    {
      "field": "ngayKLDT",
      "caption": "Ngày Kết luận điều tra vụ án",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayKLDT"
    },
    {
      "field": "soQDDieuTraLai",
      "caption": "Số Quyết định điều tra lại",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "soQDDieuTraLai"
    },
    {
      "field": "ngayQDDieuTraLai",
      "caption": "Ngày Quyết định điều tra lại",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayQDDieuTraLai"
    },
    {
      "field": "soQDDinhChiVuAn",
      "caption": "Số Quyết định đình chỉ vụ án",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "soQDDinhChiVuAn"
    },
    {
      "field": "ngayDinhChiVuAn",
      "caption": "Ngày Quyết định đình chỉ vụ án",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayDinhChiVuAn"
    },
    {
      "field": "chuyenVuAnChoCQK",
      "caption": "Đã chuyển vụ án cho CQĐT khác",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "chuyenVuAnChoCQK"
    },
    {
      "field": "soBanAnCoHieuLuc",
      "caption": "Số bản án của toà án có hiệu lực",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "soBanAnCoHieuLuc"
    },
    {
      "field": "ngayBanAnCoHieuLuc",
      "caption": "Ngày tháng năm bản án của toà án có hiệu lực",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayBanAnCoHieuLuc"
    },
    {
      "field": "vuViecTamDungTruoc2015",
      "caption": "Xác định vụ việc này là vụ việc tạm dừng giải quyết (trước năm 2015)",
      "kind": "toggle",
      "required": false,
      "storage": "metadata",
      "storageKey": "vuViecTamDungTruoc2015"
    },
    {
      "field": "soQDTamDinhChiNguonTin",
      "caption": "Quyết định Tạm đình chỉ nguồn tin",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "soQDTamDinhChiNguonTin"
    },
    {
      "field": "ngayQDTamDinhChiNguonTin",
      "caption": "Ngày ra Quyết định Tạm đình chỉ nguồn tin",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayQDTamDinhChiNguonTin"
    },
    {
      "field": "canCuTamDinhChiNguonTin",
      "caption": "Căn cứ Tạm đình chỉ nguồn tin",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "canCuTamDinhChiNguonTin"
    },
    {
      "field": "lyDoTamDinhChiNguonTin",
      "caption": "Lý do tạm đình chỉ",
      "kind": "multiselect",
      "required": false,
      "storage": "metadata",
      "storageKey": "lyDoTamDinhChiNguonTin"
    },
    {
      "field": "ngayHetThoiHieuVuViec",
      "caption": "Ngày tháng năm hết thời hiệu truy cứu TNHS",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayHetThoiHieuVuViec"
    },
    {
      "field": "khacPhucLyDoTDCVuViec",
      "caption": "Biên bản, báo cáo, kế hoạch khắc phục lý do TĐC vụ việc",
      "kind": "textarea",
      "required": false,
      "storage": "metadata",
      "storageKey": "khacPhucLyDoTDCVuViec"
    },
    {
      "field": "tienDoKhacPhucTDCVuViec",
      "caption": "Tiến độ khắc phục TĐC vụ việc",
      "kind": "textarea",
      "required": false,
      "storage": "metadata",
      "storageKey": "tienDoKhacPhucTDCVuViec"
    },
    {
      "field": "soPhucHoiNguonTin",
      "caption": "Số Phục hồi nguồn tin tội phạm",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "soPhucHoiNguonTin"
    },
    {
      "field": "ngayPhucHoiNguonTin",
      "caption": "Ngày Phục hồi nguồn tin tội phạm",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayPhucHoiNguonTin"
    },
    {
      "field": "soQuyetDinhTamDinhChi",
      "caption": "Số Quyết định Tạm đình chỉ vụ án",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "soQuyetDinhTamDinhChi"
    },
    {
      "field": "ngayTamDinhChi",
      "caption": "Ngày Quyết định tạm đình chỉ vụ án",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayTamDinhChi"
    },
    {
      "field": "canCuTamDinhChiVuAn",
      "caption": "Căn cứ tạm đình chỉ vụ án",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "canCuTamDinhChiVuAn"
    },
    {
      "field": "lyDoTamDinhChiVuAn",
      "caption": "Lý do tạm đình chỉ vụ án",
      "kind": "multiselect",
      "required": false,
      "source": "LY_DO_TAM_DINH_CHI_VU_AN",
      "storage": "metadata",
      "storageKey": "lyDoTamDinhChiVuAn"
    },
    {
      "field": "ngayHetThoiHieu",
      "caption": "Ngày hết thời hiệu truy cứu TNHS vụ án",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayHetThoiHieu"
    },
    {
      "field": "tdcKhacPhucBienBan",
      "caption": "Biên bản, báo cáo, kế hoạch khắc phục lý do TĐC vụ án",
      "kind": "textarea",
      "required": false,
      "storage": "metadata",
      "storageKey": "tdcKhacPhucBienBan"
    },
    {
      "field": "tdcKhacPhucLyDoBienPhap",
      "caption": "Biện pháp, tiến độ khắc phục lý do TĐC vụ án",
      "kind": "textarea",
      "required": false,
      "storage": "metadata",
      "storageKey": "tdcKhacPhucLyDoBienPhap"
    },
    {
      "field": "soQuyetDinhPhucHoi",
      "caption": "Số Quyết định Phục hồi Vụ án",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "soQuyetDinhPhucHoi"
    },
    {
      "field": "ngayPhucHoi",
      "caption": "Ngày Quyết định phục hồi điều tra vụ án",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayPhucHoi"
    },
    {
      "field": "canCuPhucHoiVuAn",
      "caption": "Căn cứ ra quyết định Phục hồi điều tra vụ án",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "canCuPhucHoiVuAn"
    },
    {
      "field": "statistic.ngayThongKe",
      "caption": "Ngày tổng hợp thống kê",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayThongKe"
    },
    {
      "field": "statistic.ngayPhanCongGiaiQuyetToGiac",
      "caption": "Ngày Thời điểm phân công giải quyết tố giác, tin báo",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayPhanCongGiaiQuyetToGiac"
    },
    {
      "field": "statistic.ngayTiepNhanTin",
      "caption": "Ngày tiếp nhận tin khi đơn vị nhận được",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayTiepNhanTin"
    },
    {
      "field": "statistic.ngayDauThu",
      "caption": "Ngày người phạm tội đầu thú, tự thú",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayDauThu"
    },
    {
      "field": "statistic.ngayPhamToiQuaTang",
      "caption": "Ngày người phạm tội bị bắt quả tang",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayPhamToiQuaTang"
    },
    {
      "field": "statistic.ngayBatKhanCap",
      "caption": "Ngày Người phạm tội bị giữ trong các trường hợp khẩn cấp",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayBatKhanCap"
    },
    {
      "field": "statistic.ngayPhatHienDauHieu",
      "caption": "Ngày CQCSĐT trực tiếp phát hiện có dấu hiệu tội phạm",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayPhatHienDauHieu"
    },
    {
      "field": "ngayXayRa",
      "caption": "Ngày tội phạm xảy ra",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayXayRa"
    },
    {
      "field": "statistic.soTienBiThietHai",
      "caption": "Số tiền bị thiệt hại (triệu Việt nam Đồng)",
      "kind": "number",
      "required": false,
      "storage": "column",
      "storageKey": "soTienBiThietHai"
    },
    {
      "field": "statistic.soTienThuHoi",
      "caption": "Số tiền thu hồi được (triệu Việt Nam Đồng)",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "soTienThuHoi"
    },
    {
      "field": "phuongThucThuDoan",
      "caption": "Phương thức thủ đoạn",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "phuongThucThuDoan"
    },
    {
      "field": "noiXayRaPhuongXa",
      "caption": "Nơi xảy ra (cấp phường/xã)",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "noiXayRaPhuongXa"
    },
    {
      "field": "statistic.soDoiTuong",
      "caption": "Số đối tượng phạm tội",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "soDoiTuong"
    },
    {
      "field": "statistic.soDoiTuongDaBat",
      "caption": "Số đối tượng bắt được",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "soDoiTuongDaBat"
    },
    {
      "field": "statistic.soDoiTuongBiBatVuAnKhac",
      "caption": "Số đối tượng bị bắt trong vụ án khác",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "soDoiTuongBiBatVuAnKhac"
    },
    {
      "field": "statistic.dieuTraMoRong",
      "caption": "Điều tra mở rộng",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "dieuTraMoRong"
    },
    {
      "field": "statistic.suDungVuKhiNong",
      "caption": "Sử dụng vũ khí nóng",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "suDungVuKhiNong"
    },
    {
      "field": "statistic.soLuongBiHai",
      "caption": "Số lượng người bị hại",
      "kind": "number",
      "required": false,
      "storage": "column",
      "storageKey": "soLuongBiHai"
    },
    {
      "field": "statistic.soLuongNguoiChet",
      "caption": "Số người chết",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "soLuongNguoiChet"
    },
    {
      "field": "statistic.soNguoiBiThuong",
      "caption": "Số người bị thương",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "soNguoiBiThuong"
    },
    {
      "field": "statistic.coBangNhom",
      "caption": "Xác nhận có băng nhóm",
      "kind": "toggle",
      "required": false,
      "storage": "metadata",
      "storageKey": "coBangNhom"
    },
    {
      "field": "statistic.soBangNhomBatDuoc",
      "caption": "Bắt được bao nhiêu băng nhóm",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "soBangNhomBatDuoc"
    },
    {
      "field": "statistic.soSungThuHoi",
      "caption": "Số lượng súng thu hồi",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "soSungThuHoi"
    },
    {
      "field": "statistic.soThuocNoThuHoi",
      "caption": "Số lượng thuốc nổ thu hồi",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "soThuocNoThuHoi"
    },
    {
      "field": "statistic.coVPHC",
      "caption": "Xác nhận vụ việc có vi phạm hành chính",
      "kind": "toggle",
      "required": false,
      "storage": "metadata",
      "storageKey": "coVPHC"
    },
    {
      "field": "statistic.soDoiTuongVPHC",
      "caption": "Số đối tượng vi phạm hành chính",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "soDoiTuongVPHC"
    },
    {
      "field": "statistic.soNguoiBiPhatTien",
      "caption": "Số người bị phạt tiền",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "soNguoiBiPhatTien"
    },
    {
      "field": "statistic.tongTienPhatHanhChinh",
      "caption": "Tổng số tiền phạt hành chính (triệu Việt Nam Đồng)",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "tongTienPhatHanhChinh"
    },
    {
      "field": "statistic.soDoiTuongSuuTraHiemNghi",
      "caption": "Số đối tượng sưu tra/hiềm nghi",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "soDoiTuongSuuTraHiemNghi"
    },
    {
      "field": "statistic.coGhiAmGhiHinh",
      "caption": "Bấm xác nhận nếu là nguồn tin có sử dụng Ghi âm, Ghi hình",
      "kind": "toggle",
      "required": false,
      "storage": "metadata",
      "storageKey": "coGhiAmGhiHinh"
    },
    {
      "field": "statistic.tongSoBienBanGhiLoiKhai",
      "caption": "Tổng số biên bản ghi lời khai",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "tongSoBienBanGhiLoiKhai"
    },
    {
      "field": "statistic.soBienBanGhiLoiKhaiCoGhiAm",
      "caption": "Số lượng biên bản ghi lời khai có ghi âm ghi hình",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "soBienBanGhiLoiKhaiCoGhiAm"
    },
    {
      "field": "statistic.laVuAnGhiAmGhiHinh",
      "caption": "Xác nhận nếu là Vụ án có sử dụng Ghi âm, Ghi hình",
      "kind": "toggle",
      "required": false,
      "storage": "metadata",
      "storageKey": "laVuAnGhiAmGhiHinh"
    },
    {
      "field": "statistic.tongSoBienBanHoiCung",
      "caption": "Tổng số biên bản hỏi cung bị can",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "tongSoBienBanHoiCung"
    },
    {
      "field": "statistic.tongSoBienBanHoiCungCoGhiAm",
      "caption": "Tổng số biên bản hỏi cung có ghi âm ghi hình",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "tongSoBienBanHoiCungCoGhiAm"
    },
    {
      "field": "statistic.soBiCanCoGhiAm",
      "caption": "Số lượng bị can có ghi âm ghi hình",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "soBiCanCoGhiAm"
    },
    {
      "field": "statistic.vksYeuCauGhiAm",
      "caption": "Bấm xác nhận nếu VKS yêu cầu ghi âm ghi hình",
      "kind": "toggle",
      "required": false,
      "storage": "metadata",
      "storageKey": "vksYeuCauGhiAm"
    },
    {
      "field": "statistic.soBiCanVksYeuCauGhiAm",
      "caption": "Số lượng bị can VKS yêu cầu ghi âm ghi hình",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "soBiCanVksYeuCauGhiAm"
    },
    {
      "field": "statistic.vuAnDaDuocXetXu",
      "caption": "Xác nhận vụ án đã được xét xử",
      "kind": "toggle",
      "required": false,
      "storage": "metadata",
      "storageKey": "vuAnDaDuocXetXu"
    },
    {
      "field": "statistic.ghiAmGhiHinhDaDuocXetXu",
      "caption": "Xác nhận Trong đó: Số vụ án tiến hành Ghi âm, Ghi hình đã được xét xử",
      "kind": "toggle",
      "required": false,
      "storage": "metadata",
      "storageKey": "ghiAmGhiHinhDaDuocXetXu"
    },
    {
      "field": "statistic.coSuDungKQGhiAmTrongXetXu",
      "caption": "Xác nhận trong đó: Vụ án có sử dụng kết quả Ghi âm ghi hình trong xét xử",
      "kind": "toggle",
      "required": false,
      "storage": "metadata",
      "storageKey": "coSuDungKQGhiAmTrongXetXu"
    },
    {
      "field": "statistic.khongGAGHNhungToaYeuCau",
      "caption": "Xác nhận trong đó: Vụ án không ghi âm ghi hình nhưng Tòa án yêu cầu cung cấp ghi âm ghi hình",
      "kind": "toggle",
      "required": false,
      "storage": "metadata",
      "storageKey": "khongGAGHNhungToaYeuCau"
    },
    {
      "field": "huongXuLy",
      "caption": "Hướng xử lý",
      "kind": "select",
      "required": false,
      "storage": "column",
      "storageKey": "huongXuLy"
    },
    {
      "field": "donViGiaiQuyet",
      "caption": "Đơn vị xử lý",
      "kind": "fk",
      "required": false,
      "source": "DON_VI",
      "storage": "column",
      "storageKey": "donViGiaiQuyet"
    },
    {
      "field": "deXuat",
      "caption": "Đề xuất xử lý",
      "kind": "textarea",
      "required": false,
      "storage": "column",
      "storageKey": "deXuat"
    }
  ],
  "incident": [
    {
      "field": "vatChungMoTa",
      "caption": "Loại, đặc điểm đồ vật, tài liệu, vật chứng",
      "kind": "textarea",
      "required": false,
      "storage": "metadata",
      "storageKey": "vatChungMoTa"
    },
    {
      "field": "lenhNhapKho",
      "caption": "Lệnh nhập, phiếu nhập kho",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "lenhNhapKho"
    },
    {
      "field": "noiLuuTruBaoQuan",
      "caption": "Nơi lưu trữ, bảo quản, kê biên, phong tỏa",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "noiLuuTruBaoQuan"
    },
    {
      "field": "statistic.soDangKyHoSo",
      "caption": "Số đăng ký hồ sơ nghiệp vụ",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "soDangKyHoSo"
    },
    {
      "field": "statistic.ngayDangKyHoSo",
      "caption": "Ngày đăng ký hồ sơ nghiệp vụ",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayDangKyHoSo"
    },
    {
      "field": "statistic.hoSoLuu",
      "caption": "Số hồ sơ lưu",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "hoSoLuu"
    },
    {
      "field": "statistic.ngayNopLuuHoSo",
      "caption": "Ngày nộp lưu hồ sơ",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayNopLuuHoSo"
    },
    {
      "field": "statistic.donViBaoQuanHoSo",
      "caption": "Đơn vị lưu giữ, bảo quản hồ sơ",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "donViBaoQuanHoSo"
    },
    {
      "field": "dieuTraVienText",
      "caption": "Điều tra viên thụ lý",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "dieuTraVien"
    },
    {
      "field": "lanhDaoToTung",
      "caption": "Lãnh đạo phụ trách tố tụng",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "lanhDaoToTung"
    },
    {
      "field": "soQDPhanCongNguonTin",
      "caption": "Quyết định phân công giải quyết nguồn tin tội phạm",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "soQDPhanCongNguonTin"
    },
    {
      "field": "ngayQDPhanCongNguonTin",
      "caption": "Ngày ra Quyết định phân công giải quyết nguồn tin tội phạm",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayQDPhanCongNguonTin"
    },
    {
      "field": "soQDKhongKhoiTo",
      "caption": "Quyết định Không khởi tố",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "soQDKhongKhoiTo"
    },
    {
      "field": "ngayQDKhongKhoiTo",
      "caption": "Ngày ra Quyết định Không khởi tố",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayQDKhongKhoiTo"
    },
    {
      "field": "canCuKhongKhoiTo",
      "caption": "Căn cứ để ra Quyết định Không khởi tố",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "canCuKhongKhoiTo"
    },
    {
      "field": "lyDoKhongKhoiTo",
      "caption": "Lý do ra Quyết định không khởi tố vụ án",
      "kind": "multiselect",
      "required": false,
      "storage": "column",
      "storageKey": "lyDoKhongKhoiTo"
    },
    {
      "field": "ngayDeXuat",
      "caption": "Ngày/Tháng/Năm đề xuất",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayDeXuat"
    },
    {
      "field": "phanLoaiNguonTinBanDau",
      "caption": "Phân loại ban đầu",
      "kind": "select",
      "required": false,
      "storage": "column",
      "storageKey": "phanLoaiNguonTinBanDau"
    },
    {
      "field": "nguonDon",
      "caption": "Nguồn đơn/Đơn vị giao",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "chuyenTuDonVi"
    },
    {
      "field": "loaiThongTin",
      "caption": "Loại thông tin",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "loaiThongTin"
    },
    {
      "field": "soPhieuChuyen",
      "caption": "Số phiếu chuyển/ Công văn/ Ủy thác điều tra",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "soPhieuChuyen"
    },
    {
      "field": "ngayPhieuChuyen",
      "caption": "Ngày phiếu chuyển/ Công văn/ Ủy thác điều tra",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayPhieuChuyen"
    },
    {
      "field": "ngayTiepNhanNguonTin",
      "caption": "Ngày tiếp nhận (theo biên bản tiếp nhận nguồn tin)",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayTiepNhanNguonTin"
    },
    {
      "field": "tenCungCap",
      "caption": "Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "benVu"
    },
    {
      "field": "sdtCungCap",
      "caption": "Số điện thoại nguyên đơn",
      "kind": "text",
      "required": true,
      "storage": "column",
      "storageKey": "sdtNguoiToGiac"
    },
    {
      "field": "sinhNamCungCap",
      "caption": "Sinh năm",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "sinhNamNguoiToGiac"
    },
    {
      "field": "cccdCungCap",
      "caption": "Số căn cước công dân",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "cmndNguoiToGiac"
    },
    {
      "field": "ngayCapCccd",
      "caption": "Ngày cấp CCCD",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayCapCccd"
    },
    {
      "field": "noiCapCccd",
      "caption": "Nơi cấp CCCD",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "noiCapCccd"
    },
    {
      "field": "diaChiCungCap",
      "caption": "Địa chỉ cá nhân, cơ quan, tổ chức cung cấp, bị hại",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "diaChiNguoiToGiac"
    },
    {
      "field": "nghiVanDoiTuong",
      "caption": "Nghi vấn đối tượng hoặc bị can",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "doiTuongCaNhan"
    },
    {
      "field": "toiDanhBanDau",
      "caption": "Tội danh cũ trước đây",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "toiDanhBanDau"
    },
    {
      "field": "crimeChinhId",
      "caption": "Tội danh chính - BLHS 2015 (nhận định ban đầu)",
      "kind": "crime",
      "required": true,
      "storage": "column",
      "storageKey": "crimeChinhId"
    },
    {
      "field": "noiXayRa",
      "caption": "Nơi xảy ra tội phạm",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "diaChiXayRa"
    },
    {
      "field": "utdt_thoiHanUyThac",
      "caption": "Thời hạn thực hiện Uỷ thác điều tra",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "utdt_thoiHanUyThac"
    },
    {
      "field": "description",
      "caption": "Tóm tắt nội dung",
      "kind": "textarea",
      "required": false,
      "storage": "column",
      "storageKey": "description"
    },
    {
      "field": "doVatTaiLieuKemTheo",
      "caption": "Đồ vật, tài liệu kèm theo",
      "kind": "textarea",
      "required": false,
      "storage": "column",
      "storageKey": "doVatTaiLieuKemTheo"
    },
    {
      "field": "ngayVietDon",
      "caption": "Ngày viết đơn",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayVietDon"
    },
    {
      "field": "nhanXet",
      "caption": "Nhận xét",
      "kind": "textarea",
      "required": false,
      "storage": "column",
      "storageKey": "nhanXet"
    },
    {
      "field": "ghiChuTrungDon",
      "caption": "Ghi chú trùng đơn",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "ghiChuTrungDon"
    },
    {
      "field": "baoCaoBanGiamDoc",
      "caption": "Trường hợp báo cáo Ban Giám đốc",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "baoCaoBanGiamDocText"
    },
    {
      "field": "supervisingUnit",
      "caption": "Đơn vị giải quyết",
      "kind": "fk",
      "required": false,
      "source": "UNIT",
      "storage": "column",
      "storageKey": "donViGiaiQuyet"
    },
    {
      "field": "ngayGiaoDonViGiaiQuyet",
      "caption": "Ngày giao đơn vị giải quyết",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayGiaoDonViGiaiQuyet"
    },
    {
      "field": "laCongNgheCao",
      "caption": "Bấm chọn nếu xác định đây là tội phạm công nghệ cao",
      "kind": "toggle",
      "required": false,
      "storage": "column",
      "storageKey": "laCongNgheCaoVV"
    },
    {
      "field": "ketQuaXuLyKhac",
      "caption": "Kết quả xử lý, giải quyết khác",
      "kind": "textarea",
      "required": false,
      "storage": "column",
      "storageKey": "ketQuaXuLy"
    },
    {
      "field": "ghiChuKhac",
      "caption": "Ghi chú khác",
      "kind": "textarea",
      "required": false,
      "storage": "column",
      "storageKey": "ghiChuKhac"
    },
    {
      "field": "chuyenVuViecDonViKhac",
      "caption": "Chuyển vụ việc cho đơn vị khác",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "chuyenDenDonVi"
    },
    {
      "field": "nhapVaoVuViecSo",
      "caption": "Nhập vào vụ việc hồ sơ khác",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "nhapVaoVuViecSo"
    },
    {
      "field": "phanLoaiDanSu",
      "caption": "Phân loại dân sự",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "phanLoaiDanSuText"
    },
    {
      "field": "capDoToiPham",
      "caption": "Phân loại tội phạm (Chỉ xác định sau khi có Quyết định khởi tố vụ án)",
      "kind": "select",
      "required": false,
      "storage": "metadata",
      "storageKey": "capDoToiPham"
    },
    {
      "field": "toiDanhChinhKhoiToId",
      "caption": "Tội danh chính khi khởi tố",
      "kind": "crime",
      "required": false,
      "storage": "metadata",
      "storageKey": "toiDanhChinhKhoiToId"
    },
    {
      "field": "toiDanhKhacIds",
      "caption": "Tội danh phụ khi khởi tố",
      "kind": "multiselect",
      "required": false,
      "storage": "metadata",
      "storageKey": "toiDanhKhacIds"
    },
    {
      "field": "soQuyetDinhKhoiTo",
      "caption": "Số Quyết định Khởi tố vụ án",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "soQuyetDinhKhoiTo"
    },
    {
      "field": "ngayKhoiTo",
      "caption": "Ngày ra Quyết định Khởi tố vụ án",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayKhoiTo"
    },
    {
      "field": "soQDNhapVuAn",
      "caption": "Số Quyết định nhập vụ án",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "soQDNhapVuAn"
    },
    {
      "field": "ngayNhapVuAn",
      "caption": "Ngày tháng năm nhập vụ án",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayNhapVuAn"
    },
    {
      "field": "ghiChuNhapHoSo",
      "caption": "Ghi chú nhập vào hồ sơ nào",
      "kind": "textarea",
      "required": false,
      "storage": "metadata",
      "storageKey": "ghiChuNhapHoSo"
    },
    {
      "field": "soQDTachVuAn",
      "caption": "Số Quyết định tách vụ án",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "soQDTachVuAn"
    },
    {
      "field": "ngayTachVuAn",
      "caption": "Ngày Quyết định tách hồ sơ",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayTachVuAn"
    },
    {
      "field": "soQDTachHanhVi",
      "caption": "Số Quyết định tách hành vi",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "soQDTachHanhVi"
    },
    {
      "field": "ngayTachHanhVi",
      "caption": "Ngày Quyết định tách hành vi",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayTachHanhVi"
    },
    {
      "field": "soKLDT",
      "caption": "Số KLĐT đề nghị truy tố",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "soKLDT"
    },
    {
      "field": "ngayKLDT",
      "caption": "Ngày Kết luận điều tra vụ án",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayKLDT"
    },
    {
      "field": "soQDDieuTraLai",
      "caption": "Số Quyết định điều tra lại",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "soQDDieuTraLai"
    },
    {
      "field": "ngayQDDieuTraLai",
      "caption": "Ngày Quyết định điều tra lại",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayQDDieuTraLai"
    },
    {
      "field": "soQDDinhChiVuAn",
      "caption": "Số Quyết định đình chỉ vụ án",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "soQDDinhChiVuAn"
    },
    {
      "field": "ngayDinhChiVuAn",
      "caption": "Ngày Quyết định đình chỉ vụ án",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayDinhChiVuAn"
    },
    {
      "field": "chuyenVuAnChoCQK",
      "caption": "Đã chuyển vụ án cho CQĐT khác",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "chuyenVuAnChoCQK"
    },
    {
      "field": "soBanAnCoHieuLuc",
      "caption": "Số bản án của toà án có hiệu lực",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "soBanAnCoHieuLuc"
    },
    {
      "field": "ngayBanAnCoHieuLuc",
      "caption": "Ngày tháng năm bản án của toà án có hiệu lực",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayBanAnCoHieuLuc"
    },
    {
      "field": "vuViecTamDungTruoc2015",
      "caption": "Xác định vụ việc này là vụ việc tạm dừng giải quyết (trước năm 2015)",
      "kind": "toggle",
      "required": false,
      "storage": "column",
      "storageKey": "xacDinhVuViecTamDung"
    },
    {
      "field": "soQDTamDinhChiNguonTin",
      "caption": "Quyết định Tạm đình chỉ nguồn tin",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "soQuyetDinhTamDinhChiVV"
    },
    {
      "field": "ngayQDTamDinhChiNguonTin",
      "caption": "Ngày ra Quyết định Tạm đình chỉ nguồn tin",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayTamDinhChiVV"
    },
    {
      "field": "canCuTamDinhChiNguonTin",
      "caption": "Căn cứ Tạm đình chỉ nguồn tin",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "canCuTamDinhChi"
    },
    {
      "field": "lyDoTamDinhChiNguonTin",
      "caption": "Lý do tạm đình chỉ",
      "kind": "multiselect",
      "required": false,
      "storage": "column",
      "storageKey": "lyDoTamDinhChiVuViec"
    },
    {
      "field": "ngayHetThoiHieuVuViec",
      "caption": "Ngày tháng năm hết thời hiệu truy cứu TNHS",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayHetThoiHieuVV"
    },
    {
      "field": "khacPhucLyDoTDCVuViec",
      "caption": "Biên bản, báo cáo, kế hoạch khắc phục lý do TĐC vụ việc",
      "kind": "textarea",
      "required": false,
      "storage": "metadata",
      "storageKey": "khacPhucLyDoTDCVuViec"
    },
    {
      "field": "tienDoKhacPhucTDCVuViec",
      "caption": "Tiến độ khắc phục TĐC vụ việc",
      "kind": "textarea",
      "required": false,
      "storage": "column",
      "storageKey": "tienDoKhacPhucTDC"
    },
    {
      "field": "soPhucHoiNguonTin",
      "caption": "Số Phục hồi nguồn tin tội phạm",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "soQuyetDinhPhucHoiVV"
    },
    {
      "field": "ngayPhucHoiNguonTin",
      "caption": "Ngày Phục hồi nguồn tin tội phạm",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayPhucHoiVV"
    },
    {
      "field": "soQuyetDinhTamDinhChi",
      "caption": "Số Quyết định Tạm đình chỉ vụ án",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "soQuyetDinhTamDinhChi"
    },
    {
      "field": "ngayTamDinhChi",
      "caption": "Ngày Quyết định tạm đình chỉ vụ án",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayTamDinhChi"
    },
    {
      "field": "canCuTamDinhChiVuAn",
      "caption": "Căn cứ tạm đình chỉ vụ án",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "canCuTamDinhChiVuAn"
    },
    {
      "field": "lyDoTamDinhChiVuAn",
      "caption": "Lý do tạm đình chỉ vụ án",
      "kind": "multiselect",
      "required": false,
      "source": "LY_DO_TAM_DINH_CHI_VU_AN",
      "storage": "metadata",
      "storageKey": "lyDoTamDinhChiVuAn"
    },
    {
      "field": "ngayHetThoiHieu",
      "caption": "Ngày hết thời hiệu truy cứu TNHS vụ án",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayHetThoiHieu"
    },
    {
      "field": "tdcKhacPhucBienBan",
      "caption": "Biên bản, báo cáo, kế hoạch khắc phục lý do TĐC vụ án",
      "kind": "textarea",
      "required": false,
      "storage": "column",
      "storageKey": "tdcKhacPhucBienBan"
    },
    {
      "field": "tdcKhacPhucLyDoBienPhap",
      "caption": "Biện pháp, tiến độ khắc phục lý do TĐC vụ án",
      "kind": "textarea",
      "required": false,
      "storage": "column",
      "storageKey": "tdcKhacPhucLyDoBienPhap"
    },
    {
      "field": "soQuyetDinhPhucHoi",
      "caption": "Số Quyết định Phục hồi Vụ án",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "soQuyetDinhPhucHoi"
    },
    {
      "field": "ngayPhucHoi",
      "caption": "Ngày Quyết định phục hồi điều tra vụ án",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayPhucHoi"
    },
    {
      "field": "canCuPhucHoiVuAn",
      "caption": "Căn cứ ra quyết định Phục hồi điều tra vụ án",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "canCuPhucHoiVuAn"
    },
    {
      "field": "statistic.ngayThongKe",
      "caption": "Ngày tổng hợp thống kê",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayThongKe"
    },
    {
      "field": "statistic.ngayPhanCongGiaiQuyetToGiac",
      "caption": "Ngày Thời điểm phân công giải quyết tố giác, tin báo",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayPhanCongGiaiQuyetToGiac"
    },
    {
      "field": "statistic.ngayTiepNhanTin",
      "caption": "Ngày tiếp nhận tin khi đơn vị nhận được",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayTiepNhanTin"
    },
    {
      "field": "statistic.ngayDauThu",
      "caption": "Ngày người phạm tội đầu thú, tự thú",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayDauThu"
    },
    {
      "field": "statistic.ngayPhamToiQuaTang",
      "caption": "Ngày người phạm tội bị bắt quả tang",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayPhamToiQuaTang"
    },
    {
      "field": "statistic.ngayBatKhanCap",
      "caption": "Ngày Người phạm tội bị giữ trong các trường hợp khẩn cấp",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayBatKhanCap"
    },
    {
      "field": "statistic.ngayPhatHienDauHieu",
      "caption": "Ngày CQCSĐT trực tiếp phát hiện có dấu hiệu tội phạm",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayPhatHienDauHieu"
    },
    {
      "field": "ngayXayRa",
      "caption": "Ngày tội phạm xảy ra",
      "kind": "date",
      "required": false,
      "storage": "metadata",
      "storageKey": "ngayXayRa"
    },
    {
      "field": "statistic.soTienBiThietHai",
      "caption": "Số tiền bị thiệt hại (triệu Việt nam Đồng)",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "soTienBiThietHai"
    },
    {
      "field": "statistic.soTienThuHoi",
      "caption": "Số tiền thu hồi được (triệu Việt Nam Đồng)",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "soTienThuHoi"
    },
    {
      "field": "phuongThucThuDoan",
      "caption": "Phương thức thủ đoạn",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "phuongThucThuDoan"
    },
    {
      "field": "noiXayRaPhuongXa",
      "caption": "Nơi xảy ra (cấp phường/xã)",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "noiXayRaPhuongXa"
    },
    {
      "field": "statistic.soDoiTuong",
      "caption": "Số đối tượng phạm tội",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "soDoiTuong"
    },
    {
      "field": "statistic.soDoiTuongDaBat",
      "caption": "Số đối tượng bắt được",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "soDoiTuongDaBat"
    },
    {
      "field": "statistic.soDoiTuongBiBatVuAnKhac",
      "caption": "Số đối tượng bị bắt trong vụ án khác",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "soDoiTuongBiBatVuAnKhac"
    },
    {
      "field": "statistic.dieuTraMoRong",
      "caption": "Điều tra mở rộng",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "dieuTraMoRong"
    },
    {
      "field": "statistic.suDungVuKhiNong",
      "caption": "Sử dụng vũ khí nóng",
      "kind": "text",
      "required": false,
      "storage": "metadata",
      "storageKey": "suDungVuKhiNong"
    },
    {
      "field": "statistic.soLuongBiHai",
      "caption": "Số lượng người bị hại",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "soLuongBiHai"
    },
    {
      "field": "statistic.soLuongNguoiChet",
      "caption": "Số người chết",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "soLuongNguoiChet"
    },
    {
      "field": "statistic.soNguoiBiThuong",
      "caption": "Số người bị thương",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "soNguoiBiThuong"
    },
    {
      "field": "statistic.coBangNhom",
      "caption": "Xác nhận có băng nhóm",
      "kind": "toggle",
      "required": false,
      "storage": "metadata",
      "storageKey": "coBangNhom"
    },
    {
      "field": "statistic.soBangNhomBatDuoc",
      "caption": "Bắt được bao nhiêu băng nhóm",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "soBangNhomBatDuoc"
    },
    {
      "field": "statistic.soSungThuHoi",
      "caption": "Số lượng súng thu hồi",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "soSungThuHoi"
    },
    {
      "field": "statistic.soThuocNoThuHoi",
      "caption": "Số lượng thuốc nổ thu hồi",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "soThuocNoThuHoi"
    },
    {
      "field": "statistic.coVPHC",
      "caption": "Xác nhận vụ việc có vi phạm hành chính",
      "kind": "toggle",
      "required": false,
      "storage": "metadata",
      "storageKey": "coVPHC"
    },
    {
      "field": "statistic.soDoiTuongVPHC",
      "caption": "Số đối tượng vi phạm hành chính",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "soDoiTuongVPHC"
    },
    {
      "field": "statistic.soNguoiBiPhatTien",
      "caption": "Số người bị phạt tiền",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "soNguoiBiPhatTien"
    },
    {
      "field": "statistic.tongTienPhatHanhChinh",
      "caption": "Tổng số tiền phạt hành chính (triệu Việt Nam Đồng)",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "tongTienPhatHanhChinh"
    },
    {
      "field": "statistic.soDoiTuongSuuTraHiemNghi",
      "caption": "Số đối tượng sưu tra/hiềm nghi",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "soDoiTuongSuuTraHiemNghi"
    },
    {
      "field": "statistic.coGhiAmGhiHinh",
      "caption": "Bấm xác nhận nếu là nguồn tin có sử dụng Ghi âm, Ghi hình",
      "kind": "toggle",
      "required": false,
      "storage": "metadata",
      "storageKey": "coGhiAmGhiHinh"
    },
    {
      "field": "statistic.tongSoBienBanGhiLoiKhai",
      "caption": "Tổng số biên bản ghi lời khai",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "tongSoBienBanGhiLoiKhai"
    },
    {
      "field": "statistic.soBienBanGhiLoiKhaiCoGhiAm",
      "caption": "Số lượng biên bản ghi lời khai có ghi âm ghi hình",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "soBienBanGhiLoiKhaiCoGhiAm"
    },
    {
      "field": "statistic.laVuAnGhiAmGhiHinh",
      "caption": "Xác nhận nếu là Vụ án có sử dụng Ghi âm, Ghi hình",
      "kind": "toggle",
      "required": false,
      "storage": "metadata",
      "storageKey": "laVuAnGhiAmGhiHinh"
    },
    {
      "field": "statistic.tongSoBienBanHoiCung",
      "caption": "Tổng số biên bản hỏi cung bị can",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "tongSoBienBanHoiCung"
    },
    {
      "field": "statistic.tongSoBienBanHoiCungCoGhiAm",
      "caption": "Tổng số biên bản hỏi cung có ghi âm ghi hình",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "tongSoBienBanHoiCungCoGhiAm"
    },
    {
      "field": "statistic.soBiCanCoGhiAm",
      "caption": "Số lượng bị can có ghi âm ghi hình",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "soBiCanCoGhiAm"
    },
    {
      "field": "statistic.vksYeuCauGhiAm",
      "caption": "Bấm xác nhận nếu VKS yêu cầu ghi âm ghi hình",
      "kind": "toggle",
      "required": false,
      "storage": "metadata",
      "storageKey": "vksYeuCauGhiAm"
    },
    {
      "field": "statistic.soBiCanVksYeuCauGhiAm",
      "caption": "Số lượng bị can VKS yêu cầu ghi âm ghi hình",
      "kind": "number",
      "required": false,
      "storage": "metadata",
      "storageKey": "soBiCanVksYeuCauGhiAm"
    },
    {
      "field": "statistic.vuAnDaDuocXetXu",
      "caption": "Xác nhận vụ án đã được xét xử",
      "kind": "toggle",
      "required": false,
      "storage": "metadata",
      "storageKey": "vuAnDaDuocXetXu"
    },
    {
      "field": "statistic.ghiAmGhiHinhDaDuocXetXu",
      "caption": "Xác nhận Trong đó: Số vụ án tiến hành Ghi âm, Ghi hình đã được xét xử",
      "kind": "toggle",
      "required": false,
      "storage": "metadata",
      "storageKey": "ghiAmGhiHinhDaDuocXetXu"
    },
    {
      "field": "statistic.coSuDungKQGhiAmTrongXetXu",
      "caption": "Xác nhận trong đó: Vụ án có sử dụng kết quả Ghi âm ghi hình trong xét xử",
      "kind": "toggle",
      "required": false,
      "storage": "metadata",
      "storageKey": "coSuDungKQGhiAmTrongXetXu"
    },
    {
      "field": "statistic.khongGAGHNhungToaYeuCau",
      "caption": "Xác nhận trong đó: Vụ án không ghi âm ghi hình nhưng Tòa án yêu cầu cung cấp ghi âm ghi hình",
      "kind": "toggle",
      "required": false,
      "storage": "metadata",
      "storageKey": "khongGAGHNhungToaYeuCau"
    }
  ],
  "case": [
    {
      "field": "vatChungMoTa",
      "caption": "Loại, đặc điểm đồ vật, tài liệu, vật chứng",
      "kind": "textarea",
      "required": false,
      "storage": "column",
      "storageKey": "vatChungMoTa"
    },
    {
      "field": "lenhNhapKho",
      "caption": "Lệnh nhập, phiếu nhập kho",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "lenhNhapKho"
    },
    {
      "field": "noiLuuTruBaoQuan",
      "caption": "Nơi lưu trữ, bảo quản, kê biên, phong tỏa",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "noiLuuTruBaoQuan"
    },
    {
      "field": "statistic.soDangKyHoSo",
      "caption": "Số đăng ký hồ sơ nghiệp vụ",
      "kind": "text",
      "required": false,
      "storage": "statistic",
      "storageKey": "soDangKyHoSo"
    },
    {
      "field": "statistic.ngayDangKyHoSo",
      "caption": "Ngày đăng ký hồ sơ nghiệp vụ",
      "kind": "date",
      "required": false,
      "storage": "statistic",
      "storageKey": "ngayDangKyHoSo"
    },
    {
      "field": "statistic.hoSoLuu",
      "caption": "Số hồ sơ lưu",
      "kind": "text",
      "required": false,
      "storage": "statistic",
      "storageKey": "hoSoLuu"
    },
    {
      "field": "statistic.ngayNopLuuHoSo",
      "caption": "Ngày nộp lưu hồ sơ",
      "kind": "date",
      "required": false,
      "storage": "statistic",
      "storageKey": "ngayNopLuuHoSo"
    },
    {
      "field": "statistic.donViBaoQuanHoSo",
      "caption": "Đơn vị lưu giữ, bảo quản hồ sơ",
      "kind": "text",
      "required": false,
      "storage": "statistic",
      "storageKey": "donViBaoQuanHoSo"
    },
    {
      "field": "dieuTraVienText",
      "caption": "Điều tra viên thụ lý",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "dieuTraVien"
    },
    {
      "field": "lanhDaoToTung",
      "caption": "Lãnh đạo phụ trách tố tụng",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "lanhDaoToTung"
    },
    {
      "field": "soQDPhanCongNguonTin",
      "caption": "Quyết định phân công giải quyết nguồn tin tội phạm",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "soQDPhanCongNguonTin"
    },
    {
      "field": "ngayQDPhanCongNguonTin",
      "caption": "Ngày ra Quyết định phân công giải quyết nguồn tin tội phạm",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayQDPhanCongNguonTin"
    },
    {
      "field": "soQDKhongKhoiTo",
      "caption": "Quyết định Không khởi tố",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "soQDKhongKhoiTo"
    },
    {
      "field": "ngayQDKhongKhoiTo",
      "caption": "Ngày ra Quyết định Không khởi tố",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayQDKhongKhoiTo"
    },
    {
      "field": "canCuKhongKhoiTo",
      "caption": "Căn cứ để ra Quyết định Không khởi tố",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "canCuKhongKhoiTo"
    },
    {
      "field": "lyDoKhongKhoiTo",
      "caption": "Lý do ra Quyết định không khởi tố vụ án",
      "kind": "multiselect",
      "required": false,
      "storage": "column",
      "storageKey": "lyDoKhongKhoiTo"
    },
    {
      "field": "ngayDeXuat",
      "caption": "Ngày/Tháng/Năm đề xuất",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayDeXuat"
    },
    {
      "field": "phanLoaiNguonTinBanDau",
      "caption": "Phân loại ban đầu",
      "kind": "select",
      "required": false,
      "storage": "column",
      "storageKey": "phanLoaiNguonTinBanDau"
    },
    {
      "field": "nguonDon",
      "caption": "Nguồn đơn/Đơn vị giao",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "nguonDon"
    },
    {
      "field": "loaiThongTin",
      "caption": "Loại thông tin",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "loaiThongTin"
    },
    {
      "field": "soPhieuChuyen",
      "caption": "Số phiếu chuyển/ Công văn/ Ủy thác điều tra",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "soPhieuChuyen"
    },
    {
      "field": "ngayPhieuChuyen",
      "caption": "Ngày phiếu chuyển/ Công văn/ Ủy thác điều tra",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayPhieuChuyen"
    },
    {
      "field": "ngayTiepNhanNguonTin",
      "caption": "Ngày tiếp nhận (theo biên bản tiếp nhận nguồn tin)",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayTiepNhan"
    },
    {
      "field": "tenCungCap",
      "caption": "Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "tenCungCap"
    },
    {
      "field": "sdtCungCap",
      "caption": "Số điện thoại nguyên đơn",
      "kind": "text",
      "required": true,
      "storage": "column",
      "storageKey": "sdtCungCap"
    },
    {
      "field": "sinhNamCungCap",
      "caption": "Sinh năm",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "sinhNamCungCap"
    },
    {
      "field": "cccdCungCap",
      "caption": "Số căn cước công dân",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "cccdCungCap"
    },
    {
      "field": "ngayCapCccd",
      "caption": "Ngày cấp CCCD",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayCapCccd"
    },
    {
      "field": "noiCapCccd",
      "caption": "Nơi cấp CCCD",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "noiCapCccd"
    },
    {
      "field": "diaChiCungCap",
      "caption": "Địa chỉ cá nhân, cơ quan, tổ chức cung cấp, bị hại",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "diaChiCungCap"
    },
    {
      "field": "nghiVanDoiTuong",
      "caption": "Nghi vấn đối tượng hoặc bị can",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "nghiVanDoiTuong"
    },
    {
      "field": "toiDanhBanDau",
      "caption": "Tội danh cũ trước đây",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "toiDanhBanDau"
    },
    {
      "field": "crimeChinhId",
      "caption": "Tội danh chính - BLHS 2015 (nhận định ban đầu)",
      "kind": "crime",
      "required": true,
      "storage": "column",
      "storageKey": "crimeChinhId"
    },
    {
      "field": "noiXayRa",
      "caption": "Nơi xảy ra tội phạm",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "noiXayRa"
    },
    {
      "field": "utdt_thoiHanUyThac",
      "caption": "Thời hạn thực hiện Uỷ thác điều tra",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "thoiHanUyThac"
    },
    {
      "field": "description",
      "caption": "Tóm tắt nội dung",
      "kind": "textarea",
      "required": false,
      "storage": "column",
      "storageKey": "moTaChiTiet"
    },
    {
      "field": "doVatTaiLieuKemTheo",
      "caption": "Đồ vật, tài liệu kèm theo",
      "kind": "textarea",
      "required": false,
      "storage": "column",
      "storageKey": "doVatTaiLieuKemTheo"
    },
    {
      "field": "ngayVietDon",
      "caption": "Ngày viết đơn",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayVietDon"
    },
    {
      "field": "nhanXet",
      "caption": "Nhận xét",
      "kind": "textarea",
      "required": false,
      "storage": "column",
      "storageKey": "nhanXet"
    },
    {
      "field": "ghiChuTrungDon",
      "caption": "Ghi chú trùng đơn",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "ghiChuTrungDon"
    },
    {
      "field": "baoCaoBanGiamDoc",
      "caption": "Trường hợp báo cáo Ban Giám đốc",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "baoCaoBanGiamDocText"
    },
    {
      "field": "supervisingUnit",
      "caption": "Đơn vị giải quyết",
      "kind": "fk",
      "required": false,
      "source": "UNIT",
      "storage": "column",
      "storageKey": "donViGiaiQuyet"
    },
    {
      "field": "ngayGiaoDonViGiaiQuyet",
      "caption": "Ngày giao đơn vị giải quyết",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayGiaoDonViGiaiQuyet"
    },
    {
      "field": "laCongNgheCao",
      "caption": "Bấm chọn nếu xác định đây là tội phạm công nghệ cao",
      "kind": "toggle",
      "required": false,
      "storage": "column",
      "storageKey": "laCongNgheCao"
    },
    {
      "field": "ketQuaXuLyKhac",
      "caption": "Kết quả xử lý, giải quyết khác",
      "kind": "textarea",
      "required": false,
      "storage": "column",
      "storageKey": "ketQuaXuLyKhac"
    },
    {
      "field": "ghiChuKhac",
      "caption": "Ghi chú khác",
      "kind": "textarea",
      "required": false,
      "storage": "column",
      "storageKey": "ghiChuKhac"
    },
    {
      "field": "chuyenVuViecDonViKhac",
      "caption": "Chuyển vụ việc cho đơn vị khác",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "chuyenVuViecDonViKhac"
    },
    {
      "field": "nhapVaoVuViecSo",
      "caption": "Nhập vào vụ việc hồ sơ khác",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "nhapVaoVuViecSo"
    },
    {
      "field": "phanLoaiDanSu",
      "caption": "Phân loại dân sự",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "phanLoaiDanSu"
    },
    {
      "field": "capDoToiPham",
      "caption": "Phân loại tội phạm (Chỉ xác định sau khi có Quyết định khởi tố vụ án)",
      "kind": "select",
      "required": false,
      "storage": "column",
      "storageKey": "capDoToiPham"
    },
    {
      "field": "toiDanhChinhKhoiToId",
      "caption": "Tội danh chính khi khởi tố",
      "kind": "crime",
      "required": false,
      "storage": "column",
      "storageKey": "toiDanhChinhKhoiToId"
    },
    {
      "field": "toiDanhKhacIds",
      "caption": "Tội danh phụ khi khởi tố",
      "kind": "multiselect",
      "required": false,
      "storage": "column",
      "storageKey": "toiDanhKhacIds"
    },
    {
      "field": "soQuyetDinhKhoiTo",
      "caption": "Số Quyết định Khởi tố vụ án",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "soQuyetDinhKhoiTo"
    },
    {
      "field": "ngayKhoiTo",
      "caption": "Ngày ra Quyết định Khởi tố vụ án",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayKhoiTo"
    },
    {
      "field": "soQDNhapVuAn",
      "caption": "Số Quyết định nhập vụ án",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "soQDNhapVuAn"
    },
    {
      "field": "ngayNhapVuAn",
      "caption": "Ngày tháng năm nhập vụ án",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayNhapVuAn"
    },
    {
      "field": "ghiChuNhapHoSo",
      "caption": "Ghi chú nhập vào hồ sơ nào",
      "kind": "textarea",
      "required": false,
      "storage": "column",
      "storageKey": "ghiChuNhapHoSo"
    },
    {
      "field": "soQDTachVuAn",
      "caption": "Số Quyết định tách vụ án",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "soQDTachVuAn"
    },
    {
      "field": "ngayTachVuAn",
      "caption": "Ngày Quyết định tách hồ sơ",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayTachVuAn"
    },
    {
      "field": "soQDTachHanhVi",
      "caption": "Số Quyết định tách hành vi",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "soQDTachHanhVi"
    },
    {
      "field": "ngayTachHanhVi",
      "caption": "Ngày Quyết định tách hành vi",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayTachHanhVi"
    },
    {
      "field": "soKLDT",
      "caption": "Số KLĐT đề nghị truy tố",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "soKLDT"
    },
    {
      "field": "ngayKLDT",
      "caption": "Ngày Kết luận điều tra vụ án",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayKLDT"
    },
    {
      "field": "soQDDieuTraLai",
      "caption": "Số Quyết định điều tra lại",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "soQDDieuTraLai"
    },
    {
      "field": "ngayQDDieuTraLai",
      "caption": "Ngày Quyết định điều tra lại",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayQDDieuTraLai"
    },
    {
      "field": "soQDDinhChiVuAn",
      "caption": "Số Quyết định đình chỉ vụ án",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "soQDDinhChiVuAn"
    },
    {
      "field": "ngayDinhChiVuAn",
      "caption": "Ngày Quyết định đình chỉ vụ án",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayDinhChiVuAn"
    },
    {
      "field": "chuyenVuAnChoCQK",
      "caption": "Đã chuyển vụ án cho CQĐT khác",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "chuyenVuAnChoCQK"
    },
    {
      "field": "soBanAnCoHieuLuc",
      "caption": "Số bản án của toà án có hiệu lực",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "soBanAnCoHieuLuc"
    },
    {
      "field": "ngayBanAnCoHieuLuc",
      "caption": "Ngày tháng năm bản án của toà án có hiệu lực",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayBanAnCoHieuLuc"
    },
    {
      "field": "vuViecTamDungTruoc2015",
      "caption": "Xác định vụ việc này là vụ việc tạm dừng giải quyết (trước năm 2015)",
      "kind": "toggle",
      "required": false,
      "storage": "column",
      "storageKey": "vuViecTamDungTruoc2015"
    },
    {
      "field": "soQDTamDinhChiNguonTin",
      "caption": "Quyết định Tạm đình chỉ nguồn tin",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "soQDTamDinhChiNguonTin"
    },
    {
      "field": "ngayQDTamDinhChiNguonTin",
      "caption": "Ngày ra Quyết định Tạm đình chỉ nguồn tin",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayQDTamDinhChiNguonTin"
    },
    {
      "field": "canCuTamDinhChiNguonTin",
      "caption": "Căn cứ Tạm đình chỉ nguồn tin",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "canCuTamDinhChiNguonTin"
    },
    {
      "field": "lyDoTamDinhChiNguonTin",
      "caption": "Lý do tạm đình chỉ",
      "kind": "multiselect",
      "required": false,
      "storage": "column",
      "storageKey": "lyDoTamDinhChiNguonTin"
    },
    {
      "field": "ngayHetThoiHieuVuViec",
      "caption": "Ngày tháng năm hết thời hiệu truy cứu TNHS",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayHetThoiHieuVuViec"
    },
    {
      "field": "khacPhucLyDoTDCVuViec",
      "caption": "Biên bản, báo cáo, kế hoạch khắc phục lý do TĐC vụ việc",
      "kind": "textarea",
      "required": false,
      "storage": "column",
      "storageKey": "khacPhucLyDoTDCVuViec"
    },
    {
      "field": "tienDoKhacPhucTDCVuViec",
      "caption": "Tiến độ khắc phục TĐC vụ việc",
      "kind": "textarea",
      "required": false,
      "storage": "column",
      "storageKey": "tienDoKhacPhucTDCVuViec"
    },
    {
      "field": "soPhucHoiNguonTin",
      "caption": "Số Phục hồi nguồn tin tội phạm",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "soPhucHoiNguonTin"
    },
    {
      "field": "ngayPhucHoiNguonTin",
      "caption": "Ngày Phục hồi nguồn tin tội phạm",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayPhucHoiNguonTin"
    },
    {
      "field": "soQuyetDinhTamDinhChi",
      "caption": "Số Quyết định Tạm đình chỉ vụ án",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "soQuyetDinhTamDinhChi"
    },
    {
      "field": "ngayTamDinhChi",
      "caption": "Ngày Quyết định tạm đình chỉ vụ án",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayTamDinhChi"
    },
    {
      "field": "canCuTamDinhChiVuAn",
      "caption": "Căn cứ tạm đình chỉ vụ án",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "canCuTamDinhChiVuAn"
    },
    {
      "field": "lyDoTamDinhChiVuAn",
      "caption": "Lý do tạm đình chỉ vụ án",
      "kind": "multiselect",
      "required": false,
      "source": "LY_DO_TAM_DINH_CHI_VU_AN",
      "storage": "column",
      "storageKey": "lyDoTamDinhChiVuAn"
    },
    {
      "field": "ngayHetThoiHieu",
      "caption": "Ngày hết thời hiệu truy cứu TNHS vụ án",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayHetThoiHieu"
    },
    {
      "field": "tdcKhacPhucBienBan",
      "caption": "Biên bản, báo cáo, kế hoạch khắc phục lý do TĐC vụ án",
      "kind": "textarea",
      "required": false,
      "storage": "column",
      "storageKey": "tdcKhacPhucBienBan"
    },
    {
      "field": "tdcKhacPhucLyDoBienPhap",
      "caption": "Biện pháp, tiến độ khắc phục lý do TĐC vụ án",
      "kind": "textarea",
      "required": false,
      "storage": "column",
      "storageKey": "tdcKhacPhucLyDoBienPhap"
    },
    {
      "field": "soQuyetDinhPhucHoi",
      "caption": "Số Quyết định Phục hồi Vụ án",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "soQuyetDinhPhucHoi"
    },
    {
      "field": "ngayPhucHoi",
      "caption": "Ngày Quyết định phục hồi điều tra vụ án",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayPhucHoi"
    },
    {
      "field": "canCuPhucHoiVuAn",
      "caption": "Căn cứ ra quyết định Phục hồi điều tra vụ án",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "canCuPhucHoiVuAn"
    },
    {
      "field": "statistic.ngayThongKe",
      "caption": "Ngày tổng hợp thống kê",
      "kind": "date",
      "required": false,
      "storage": "statistic",
      "storageKey": "ngayThongKe"
    },
    {
      "field": "statistic.ngayPhanCongGiaiQuyetToGiac",
      "caption": "Ngày Thời điểm phân công giải quyết tố giác, tin báo",
      "kind": "date",
      "required": false,
      "storage": "statistic",
      "storageKey": "ngayPhanCongGiaiQuyetToGiac"
    },
    {
      "field": "statistic.ngayTiepNhanTin",
      "caption": "Ngày tiếp nhận tin khi đơn vị nhận được",
      "kind": "date",
      "required": false,
      "storage": "statistic",
      "storageKey": "ngayTiepNhanTin"
    },
    {
      "field": "statistic.ngayDauThu",
      "caption": "Ngày người phạm tội đầu thú, tự thú",
      "kind": "date",
      "required": false,
      "storage": "statistic",
      "storageKey": "ngayDauThu"
    },
    {
      "field": "statistic.ngayPhamToiQuaTang",
      "caption": "Ngày người phạm tội bị bắt quả tang",
      "kind": "date",
      "required": false,
      "storage": "statistic",
      "storageKey": "ngayPhamToiQuaTang"
    },
    {
      "field": "statistic.ngayBatKhanCap",
      "caption": "Ngày Người phạm tội bị giữ trong các trường hợp khẩn cấp",
      "kind": "date",
      "required": false,
      "storage": "statistic",
      "storageKey": "ngayBatKhanCap"
    },
    {
      "field": "statistic.ngayPhatHienDauHieu",
      "caption": "Ngày CQCSĐT trực tiếp phát hiện có dấu hiệu tội phạm",
      "kind": "date",
      "required": false,
      "storage": "statistic",
      "storageKey": "ngayPhatHienDauHieu"
    },
    {
      "field": "ngayXayRa",
      "caption": "Ngày tội phạm xảy ra",
      "kind": "date",
      "required": false,
      "storage": "column",
      "storageKey": "ngayXayRa"
    },
    {
      "field": "statistic.soTienBiThietHai",
      "caption": "Số tiền bị thiệt hại (triệu Việt nam Đồng)",
      "kind": "number",
      "required": false,
      "storage": "statistic",
      "storageKey": "soTienBiThietHai"
    },
    {
      "field": "statistic.soTienThuHoi",
      "caption": "Số tiền thu hồi được (triệu Việt Nam Đồng)",
      "kind": "number",
      "required": false,
      "storage": "statistic",
      "storageKey": "soTienThuHoi"
    },
    {
      "field": "phuongThucThuDoan",
      "caption": "Phương thức thủ đoạn",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "phuongThucThuDoan"
    },
    {
      "field": "noiXayRaPhuongXa",
      "caption": "Nơi xảy ra (cấp phường/xã)",
      "kind": "text",
      "required": false,
      "storage": "column",
      "storageKey": "noiXayRaPhuongXa"
    },
    {
      "field": "statistic.soDoiTuong",
      "caption": "Số đối tượng phạm tội",
      "kind": "number",
      "required": false,
      "storage": "statistic",
      "storageKey": "soDoiTuong"
    },
    {
      "field": "statistic.soDoiTuongDaBat",
      "caption": "Số đối tượng bắt được",
      "kind": "number",
      "required": false,
      "storage": "statistic",
      "storageKey": "soDoiTuongDaBat"
    },
    {
      "field": "statistic.soDoiTuongBiBatVuAnKhac",
      "caption": "Số đối tượng bị bắt trong vụ án khác",
      "kind": "number",
      "required": false,
      "storage": "statistic",
      "storageKey": "soDoiTuongBiBatVuAnKhac"
    },
    {
      "field": "statistic.dieuTraMoRong",
      "caption": "Điều tra mở rộng",
      "kind": "number",
      "required": false,
      "storage": "statistic",
      "storageKey": "dieuTraMoRong"
    },
    {
      "field": "statistic.suDungVuKhiNong",
      "caption": "Sử dụng vũ khí nóng",
      "kind": "text",
      "required": false,
      "storage": "statistic",
      "storageKey": "suDungVuKhiNong"
    },
    {
      "field": "statistic.soLuongBiHai",
      "caption": "Số lượng người bị hại",
      "kind": "number",
      "required": false,
      "storage": "statistic",
      "storageKey": "soLuongBiHai"
    },
    {
      "field": "statistic.soLuongNguoiChet",
      "caption": "Số người chết",
      "kind": "number",
      "required": false,
      "storage": "statistic",
      "storageKey": "soLuongNguoiChet"
    },
    {
      "field": "statistic.soNguoiBiThuong",
      "caption": "Số người bị thương",
      "kind": "number",
      "required": false,
      "storage": "statistic",
      "storageKey": "soNguoiBiThuong"
    },
    {
      "field": "statistic.coBangNhom",
      "caption": "Xác nhận có băng nhóm",
      "kind": "toggle",
      "required": false,
      "storage": "statistic",
      "storageKey": "coBangNhom"
    },
    {
      "field": "statistic.soBangNhomBatDuoc",
      "caption": "Bắt được bao nhiêu băng nhóm",
      "kind": "number",
      "required": false,
      "storage": "statistic",
      "storageKey": "soBangNhomBatDuoc"
    },
    {
      "field": "statistic.soSungThuHoi",
      "caption": "Số lượng súng thu hồi",
      "kind": "number",
      "required": false,
      "storage": "statistic",
      "storageKey": "soSungThuHoi"
    },
    {
      "field": "statistic.soThuocNoThuHoi",
      "caption": "Số lượng thuốc nổ thu hồi",
      "kind": "number",
      "required": false,
      "storage": "statistic",
      "storageKey": "soThuocNoThuHoi"
    },
    {
      "field": "statistic.coVPHC",
      "caption": "Xác nhận vụ việc có vi phạm hành chính",
      "kind": "toggle",
      "required": false,
      "storage": "statistic",
      "storageKey": "coVPHC"
    },
    {
      "field": "statistic.soDoiTuongVPHC",
      "caption": "Số đối tượng vi phạm hành chính",
      "kind": "number",
      "required": false,
      "storage": "statistic",
      "storageKey": "soDoiTuongVPHC"
    },
    {
      "field": "statistic.soNguoiBiPhatTien",
      "caption": "Số người bị phạt tiền",
      "kind": "number",
      "required": false,
      "storage": "statistic",
      "storageKey": "soNguoiBiPhatTien"
    },
    {
      "field": "statistic.tongTienPhatHanhChinh",
      "caption": "Tổng số tiền phạt hành chính (triệu Việt Nam Đồng)",
      "kind": "number",
      "required": false,
      "storage": "statistic",
      "storageKey": "tongTienPhatHanhChinh"
    },
    {
      "field": "statistic.soDoiTuongSuuTraHiemNghi",
      "caption": "Số đối tượng sưu tra/hiềm nghi",
      "kind": "number",
      "required": false,
      "storage": "statistic",
      "storageKey": "soDoiTuongSuuTraHiemNghi"
    },
    {
      "field": "statistic.coGhiAmGhiHinh",
      "caption": "Bấm xác nhận nếu là nguồn tin có sử dụng Ghi âm, Ghi hình",
      "kind": "toggle",
      "required": false,
      "storage": "statistic",
      "storageKey": "coGhiAmGhiHinh"
    },
    {
      "field": "statistic.tongSoBienBanGhiLoiKhai",
      "caption": "Tổng số biên bản ghi lời khai",
      "kind": "number",
      "required": false,
      "storage": "statistic",
      "storageKey": "tongSoBienBanGhiLoiKhai"
    },
    {
      "field": "statistic.soBienBanGhiLoiKhaiCoGhiAm",
      "caption": "Số lượng biên bản ghi lời khai có ghi âm ghi hình",
      "kind": "number",
      "required": false,
      "storage": "statistic",
      "storageKey": "soBienBanGhiLoiKhaiCoGhiAm"
    },
    {
      "field": "statistic.laVuAnGhiAmGhiHinh",
      "caption": "Xác nhận nếu là Vụ án có sử dụng Ghi âm, Ghi hình",
      "kind": "toggle",
      "required": false,
      "storage": "statistic",
      "storageKey": "laVuAnGhiAmGhiHinh"
    },
    {
      "field": "statistic.tongSoBienBanHoiCung",
      "caption": "Tổng số biên bản hỏi cung bị can",
      "kind": "number",
      "required": false,
      "storage": "statistic",
      "storageKey": "tongSoBienBanHoiCung"
    },
    {
      "field": "statistic.tongSoBienBanHoiCungCoGhiAm",
      "caption": "Tổng số biên bản hỏi cung có ghi âm ghi hình",
      "kind": "number",
      "required": false,
      "storage": "statistic",
      "storageKey": "tongSoBienBanHoiCungCoGhiAm"
    },
    {
      "field": "statistic.soBiCanCoGhiAm",
      "caption": "Số lượng bị can có ghi âm ghi hình",
      "kind": "number",
      "required": false,
      "storage": "statistic",
      "storageKey": "soBiCanCoGhiAm"
    },
    {
      "field": "statistic.vksYeuCauGhiAm",
      "caption": "Bấm xác nhận nếu VKS yêu cầu ghi âm ghi hình",
      "kind": "toggle",
      "required": false,
      "storage": "statistic",
      "storageKey": "vksYeuCauGhiAm"
    },
    {
      "field": "statistic.soBiCanVksYeuCauGhiAm",
      "caption": "Số lượng bị can VKS yêu cầu ghi âm ghi hình",
      "kind": "number",
      "required": false,
      "storage": "statistic",
      "storageKey": "soBiCanVksYeuCauGhiAm"
    },
    {
      "field": "statistic.vuAnDaDuocXetXu",
      "caption": "Xác nhận vụ án đã được xét xử",
      "kind": "toggle",
      "required": false,
      "storage": "statistic",
      "storageKey": "vuAnDaDuocXetXu"
    },
    {
      "field": "statistic.ghiAmGhiHinhDaDuocXetXu",
      "caption": "Xác nhận Trong đó: Số vụ án tiến hành Ghi âm, Ghi hình đã được xét xử",
      "kind": "toggle",
      "required": false,
      "storage": "statistic",
      "storageKey": "ghiAmGhiHinhDaDuocXetXu"
    },
    {
      "field": "statistic.coSuDungKQGhiAmTrongXetXu",
      "caption": "Xác nhận trong đó: Vụ án có sử dụng kết quả Ghi âm ghi hình trong xét xử",
      "kind": "toggle",
      "required": false,
      "storage": "statistic",
      "storageKey": "coSuDungKQGhiAmTrongXetXu"
    },
    {
      "field": "statistic.khongGAGHNhungToaYeuCau",
      "caption": "Xác nhận trong đó: Vụ án không ghi âm ghi hình nhưng Tòa án yêu cầu cung cấp ghi âm ghi hình",
      "kind": "toggle",
      "required": false,
      "storage": "statistic",
      "storageKey": "khongGAGHNhungToaYeuCau"
    }
  ]
};
