/**
 * ĐẶC TẢ BỐ CỤC FORM VỤ ÁN THEO HỆ CŨ pc02hcm.com
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Nguồn sự thật DUY NHẤT cho: tên nhãn, thứ tự, và vị trí (nửa dòng / tràn dòng)
 * của mọi ô nhập trên form Vụ án. Màn Tạo mới và màn Chỉnh sửa cùng đọc file này
 * nên không thể lệch nhau — đó là lý do bố cục được khai bằng dữ liệu thay vì
 * viết tay trong JSX.
 *
 * ĐỐI CHIẾU GỐC: chụp trực tiếp `https://pc02hcm.com/doi-1/Them` ngày 26/08/2026
 * (chỉ đọc, không tạo/sửa/lưu bản ghi nào). `/VuAn/Them` chuyển hướng sang
 * `/VuViecVuAn/them` và bị chặn với Đội 1, nên `/doi-1/Them` mới là form nhập
 * thật sự đang dùng. Ảnh và bản kết xuất DOM lưu kèm phiên làm việc.
 *
 * NHÃN CHÉP NGUYÊN VĂN, trừ ba lỗi đánh máy anh đồng ý sửa 26/08/2026:
 *   "nễu"        → "nếu"
 *   "vụ khí nóng" → "vũ khí nóng"
 *   "toàn án"     → "toà án"
 * Ngoài ba chỗ ấy, KHÔNG diễn đạt lại, KHÔNG rút gọn, KHÔNG thêm bớt dấu câu —
 * cán bộ tìm ô bằng đúng chuỗi chữ họ đã quen.
 *
 * TRƯỜNG GƯƠNG (`mirrorOf`): hệ cũ hiện lại cùng một ô ở nhiều tab, nhãn kèm hậu
 * tố "(Tab: X)". Ở đây không cần cơ chế riêng — hai mục cùng trỏ một `field` nên
 * sửa ở đâu cũng đồng bộ tức thì. `mirrorOf` chỉ để dựng hậu tố nhãn và để ca
 * kiểm khẳng định đúng chỗ nào là gương.
 */

import type { CaseFormData, CaseStatisticForm } from "@/pages/cases/CaseFormPage/types";

/** Khoá tab, trùng `TabId` của form. */
export type LegacyTabId =
  | "info"
  | "incident"
  | "case"
  | "subjects"
  | "incident-tdc"
  | "case-tdc"
  | "evidence"
  | "business-files"
  | "statistics"
  | "media";

/** Nhãn tab đúng chữ hệ cũ — dùng dựng hậu tố "(Tab: X)" của trường gương. */
export const LEGACY_TAB_LABEL: Record<LegacyTabId, string> = {
  info: "Thông tin",
  incident: "Vụ việc",
  case: "Vụ án",
  subjects: "ĐTBS",
  "incident-tdc": "Vụ việc TĐC",
  "case-tdc": "Vụ án TĐC",
  evidence: "Vật chứng",
  "business-files": "HS nghiệp vụ",
  statistics: "TK 48 trường",
  media: "Ghi âm, ghi hình",
};

/**
 * Đường dẫn tới ô lưu giá trị. Cho phép trỏ vào bảng thống kê lồng bên trong
 * (`statistic.*`) vì hệ cũ trộn lẫn ô hồ sơ và ô thống kê trong cùng một tab.
 */
export type CaseFieldPath =
  | keyof CaseFormData
  | `statistic.${keyof CaseStatisticForm}`;

export type LegacyFieldKind =
  | "text"
  | "date"
  | "textarea"
  | "number"
  | "select"
  | "multiselect"
  | "toggle"
  | "crime"
  | "fk";

export interface LegacyLayoutItem {
  /** Nhãn nguyên văn hệ cũ. */
  caption: string;
  /** Ô lưu giá trị trong `CaseFormData`. */
  field: CaseFieldPath;
  kind: LegacyFieldKind;
  /** `half` = col-sm-6 hệ cũ, `full` = col-xs-12 tràn dòng. */
  span: "half" | "full";
  /** Có dấu sao đỏ ở hệ cũ. */
  required?: boolean;
  /** Tab gốc của ô, khi mục này chỉ là bản hiện lại. */
  mirrorOf?: LegacyTabId;
  /** Gợi ý trong ô, nguyên văn hệ cũ. */
  placeholder?: string;
  /** Lựa chọn cho `select` / `multiselect` khai thẳng. */
  options?: readonly { value: string; label: string }[];
  /** Loại danh mục cho `fk`, hoặc khoá catalog cho `multiselect` lấy từ registry. */
  source?: string;
  /** Số dòng cho `textarea`. */
  rows?: number;
}

// ─── Bộ lựa chọn khai thẳng theo hệ cũ ──────────────────────────────────────

/** "Phân loại ban đầu" — quyết định hồ sơ đi vào đơn thư / vụ việc / vụ án. */
export const PHAN_LOAI_BAN_DAU_OPTIONS = [
  { value: "don_cong_van", label: "Đơn, Công văn" },
  { value: "vu_viec", label: "Vụ việc" },
  { value: "vu_viec_nguon_tin", label: "Vụ việc (nguồn tin)" },
  { value: "vu_an", label: "Vụ án" },
  { value: "tra_ho_so", label: "Trả hồ sơ cho đơn vị chuyển" },
  { value: "huong_dan", label: "Hướng dẫn nghiệp vụ" },
  { value: "trao_doi_chuyen_an", label: "Trao đổi chuyển án" },
] as const;

/** Lý do không khởi tố — BLTTHS 2015 Điều 157, chép nguyên văn 8 khoản của hệ cũ. */
export const LY_DO_KHONG_KHOI_TO_OPTIONS = [
  { value: "khong_co_su_viec", label: "Không có sự việc phạm tội;" },
  { value: "khong_cau_thanh", label: "Hành vi không cấu thành tội phạm;" },
  { value: "chua_du_tuoi", label: "Người thực hiện hành vi nguy hiểm cho xã hội chưa đến tuổi chịu trách nhiệm hình sự;" },
  { value: "da_co_ban_an", label: "Người mà hành vi phạm tội của họ đã có bản án hoặc quyết định đình chỉ vụ án có hiệu lực pháp luật;" },
  { value: "het_thoi_hieu", label: "Đã hết thời hiệu truy cứu trách nhiệm hình sự;" },
  { value: "dai_xa", label: "Tội phạm đã được đại xá;" },
  { value: "nguoi_thuc_hien_da_chet", label: "Người thực hiện hành vi nguy hiểm cho xã hội đã chết, trừ trường hợp cần tái thẩm đối với người khác;" },
  { value: "bi_hai_khong_yeu_cau", label: "Tội phạm quy định tại khoản 1 các điều 134, 135, 136, 138, 139, 141, 143, 155, 156 và 226 của Bộ luật hình sự mà bị hại hoặc người đại diện của bị hại không yêu cầu khởi tố." },
] as const;

/** Lý do tạm đình chỉ NGUỒN TIN — BLTTHS Điều 148. */
export const LY_DO_TAM_DINH_CHI_NGUON_TIN_OPTIONS = [
  { value: "chua_co_giam_dinh", label: "Do chưa có kết quả trưng cầu giám định" },
  { value: "chua_co_dinh_gia", label: "Do chưa có kết quả yêu cầu định giá tài sản" },
  { value: "chua_co_tuong_tro", label: "Do chưa có kết quả yêu cầu nước ngoài tương trợ tư pháp" },
  { value: "chua_co_tai_lieu", label: "Đã yêu cầu cơ quan, tổ chức, cá nhân cung cấp tài liệu, đồ vật quan trọng có ý nghĩa quyết định đối với vụ việc nhưng chưa có kết quả" },
  { value: "bat_kha_khang", label: "Do bất khả kháng do thiên tai, dịch bệnh" },
  { value: "khac", label: "Căn cứ tạm đình chỉ khác" },
] as const;

/** "Phân loại tội phạm" hệ cũ — trùng nghĩa cấp độ tội phạm BLHS 2015 Điều 9. */
export const PHAN_LOAI_TOI_PHAM_OPTIONS = [
  { value: "IT_NGHIEM_TRONG", label: "Ít nghiêm trọng" },
  { value: "NGHIEM_TRONG", label: "Nghiêm trọng" },
  { value: "RAT_NGHIEM_TRONG", label: "Rất nghiêm trọng" },
  { value: "DAC_BIET_NGHIEM_TRONG", label: "Đặc biệt nghiêm trọng" },
] as const;

// ─── Cụm trường gương dùng lại ở nhiều tab ──────────────────────────────────
//
// Hệ cũ lặp nguyên các cụm này ở Vụ việc / Vụ án / Vụ việc TĐC / Vụ án TĐC.
// Khai một lần rồi rải ra, để sửa nhãn một chỗ là mọi tab đổi theo.

const VAT_CHUNG_MIRROR: readonly LegacyLayoutItem[] = [
  { caption: "Loại, đặc điểm đồ vật, tài liệu, vật chứng", field: "vatChungMoTa", kind: "textarea", span: "full", rows: 3, mirrorOf: "evidence" },
  { caption: "Lệnh nhập, phiếu nhập kho", field: "lenhNhapKho", kind: "text", span: "half", mirrorOf: "evidence" },
  { caption: "Nơi lưu trữ, bảo quản, kê biên, phong tỏa", field: "noiLuuTruBaoQuan", kind: "text", span: "half", mirrorOf: "evidence" },
] as const;

const HS_NGHIEP_VU_MIRROR: readonly LegacyLayoutItem[] = [
  { caption: "Số đăng ký hồ sơ nghiệp vụ", field: "statistic.soDangKyHoSo", kind: "text", span: "half", mirrorOf: "business-files" },
  { caption: "Ngày đăng ký hồ sơ nghiệp vụ", field: "statistic.ngayDangKyHoSo", kind: "date", span: "half", mirrorOf: "business-files" },
  { caption: "Số hồ sơ lưu", field: "statistic.hoSoLuu", kind: "text", span: "half", mirrorOf: "business-files" },
  { caption: "Ngày nộp lưu hồ sơ", field: "statistic.ngayNopLuuHoSo", kind: "date", span: "half", mirrorOf: "business-files" },
  { caption: "Đơn vị lưu giữ, bảo quản hồ sơ", field: "statistic.donViBaoQuanHoSo", kind: "text", span: "half", mirrorOf: "business-files" },
] as const;

const CAN_BO_MIRROR: readonly LegacyLayoutItem[] = [
  { caption: "Điều tra viên thụ lý", field: "dieuTraVienText", kind: "text", span: "half", mirrorOf: "info" },
  { caption: "Lãnh đạo phụ trách tố tụng", field: "lanhDaoToTung", kind: "text", span: "half", mirrorOf: "info" },
] as const;

/** Cụm "Không khởi tố" — gốc ở tab Vụ việc, hiện lại ở Vụ việc TĐC và TK 48 trường. */
const KHONG_KHOI_TO_MIRROR: readonly LegacyLayoutItem[] = [
  { caption: "Quyết định phân công giải quyết nguồn tin tội phạm", field: "soQDPhanCongNguonTin", kind: "text", span: "half", mirrorOf: "incident" },
  { caption: "Ngày ra Quyết định phân công giải quyết nguồn tin tội phạm", field: "ngayQDPhanCongNguonTin", kind: "date", span: "half", mirrorOf: "incident" },
  { caption: "Quyết định Không khởi tố", field: "soQDKhongKhoiTo", kind: "text", span: "half", mirrorOf: "incident" },
  { caption: "Ngày ra Quyết định Không khởi tố", field: "ngayQDKhongKhoiTo", kind: "date", span: "half", mirrorOf: "incident" },
  { caption: "Căn cứ để ra Quyết định Không khởi tố", field: "canCuKhongKhoiTo", kind: "text", span: "half", mirrorOf: "incident" },
  { caption: "Lý do ra Quyết định không khởi tố vụ án", field: "lyDoKhongKhoiTo", kind: "multiselect", span: "full", options: LY_DO_KHONG_KHOI_TO_OPTIONS, mirrorOf: "incident" },
] as const;

// ─── Tab 1 · Thông tin ──────────────────────────────────────────────────────

const TAB_INFO: readonly LegacyLayoutItem[] = [
  { caption: "Ngày/Tháng/Năm đề xuất", field: "ngayDeXuat", kind: "date", span: "half" },
  { caption: "Phân loại ban đầu", field: "phanLoaiNguonTinBanDau", kind: "select", span: "half", options: PHAN_LOAI_BAN_DAU_OPTIONS, placeholder: "Chọn" },
  { caption: "Nguồn đơn/Đơn vị giao", field: "nguonDon", kind: "text", span: "half", placeholder: "Bưu điện, Trực tiếp, PC01 Công an TPHCM, ..." },
  { caption: "Loại thông tin", field: "loaiThongTin", kind: "text", span: "half", placeholder: "Tố giác, trình báo, đề nghị, kiến nghị, phản ánh, khiếu nại (hành vi tố tụng), khiếu nại (QĐHC), khiếu nại (QĐTT), ..." },
  { caption: "Số phiếu chuyển/ Công văn/ Ủy thác điều tra", field: "soPhieuChuyen", kind: "text", span: "half", placeholder: "Điền số phiếu chuyển từ đơn vị khác chuyển đến" },
  { caption: "Ngày phiếu chuyển/ Công văn/ Ủy thác điều tra", field: "ngayPhieuChuyen", kind: "date", span: "half" },
  { caption: "Ngày tiếp nhận (theo biên bản tiếp nhận nguồn tin)", field: "ngayTiepNhanNguonTin", kind: "date", span: "half" },
  { caption: "Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại", field: "tenCungCap", kind: "text", span: "half", placeholder: "Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại, nạn nhân" },
  { caption: "Số điện thoại nguyên đơn", field: "sdtCungCap", kind: "text", span: "half", required: true, placeholder: "Nhập số điện thoại nguyên đơn" },
  { caption: "Sinh năm", field: "sinhNamCungCap", kind: "text", span: "half", placeholder: "Điền sinh năm của nguyên đơn" },
  { caption: "Số căn cước công dân", field: "cccdCungCap", kind: "text", span: "half", placeholder: "Điền số CCCD của nguyên đơn" },
  { caption: "Ngày cấp CCCD", field: "ngayCapCccd", kind: "date", span: "half" },
  { caption: "Nơi cấp CCCD", field: "noiCapCccd", kind: "text", span: "half", placeholder: "Nơi cấp CCCD của nguyên đơn" },
  { caption: "Địa chỉ cá nhân, cơ quan, tổ chức cung cấp, bị hại", field: "diaChiCungCap", kind: "text", span: "half", placeholder: "Nhập tên Địa chỉ Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại, nạn nhân" },
  { caption: "Nghi vấn đối tượng hoặc bị can", field: "nghiVanDoiTuong", kind: "text", span: "half", placeholder: "Đối tượng nghi vấn thực hiện tội phạm, có đối tượng bị tố giác, kiến nghị khởi tố, có dấu vết truy nguyên, bị can" },
  { caption: "Tội danh cũ trước đây", field: "toiDanhBanDau", kind: "text", span: "half", placeholder: "Nhận định tội danh ban đầu của nguồn tin tội phạm, vụ việc, vụ án" },
  { caption: "Tội danh chính - BLHS 2015 (nhận định ban đầu)", field: "crimeChinhId", kind: "crime", span: "half", required: true, placeholder: "Chọn tội danh" },
  { caption: "Nơi xảy ra tội phạm", field: "noiXayRa", kind: "text", span: "half", placeholder: "Nhập địa điểm nơi xảy ra tội phạm" },
  { caption: "Thời hạn thực hiện Uỷ thác điều tra", field: "utdt_thoiHanUyThac", kind: "date", span: "half" },
  { caption: "Tóm tắt nội dung", field: "description", kind: "textarea", span: "full", rows: 4, placeholder: "Tóm tắt nội dung vụ việc, vụ án" },
  { caption: "Đồ vật, tài liệu kèm theo", field: "doVatTaiLieuKemTheo", kind: "textarea", span: "full", rows: 4, placeholder: "Điền thông tin các tài liệu, đồ vật kèm theo: đơn tố giác, cccd (photo), usb, ..." },
  { caption: "Ngày viết đơn", field: "ngayVietDon", kind: "date", span: "half" },
  { caption: "Nhận xét", field: "nhanXet", kind: "textarea", span: "full", rows: 4, placeholder: "Nhận xét về vụ việc trên: vụ việc có dấu hiệu tội phạm, chưa rõ đối tượng, số tiền bị chiếm đoạt, hiện đơn vị nào đang thụ lý" },
  { caption: "Ghi chú trùng đơn", field: "ghiChuTrungDon", kind: "text", span: "half", placeholder: "Ghi chú trùng đơn của nguyên đơn hoặc đơn vị nào" },
  { caption: "Trường hợp báo cáo Ban Giám đốc", field: "baoCaoBanGiamDoc", kind: "text", span: "half", placeholder: "Ghi chú chỉ đạo ban giám đốc" },
  { caption: "Đơn vị giải quyết", field: "supervisingUnit", kind: "fk", span: "half", source: "UNIT", placeholder: "Điền đơn vị giải quyết vụ việc trên" },
  { caption: "Ngày giao đơn vị giải quyết", field: "ngayGiaoDonViGiaiQuyet", kind: "date", span: "half" },
  // Hệ cũ ghi "nễu" — lỗi đánh máy, anh đồng ý sửa 26/08/2026.
  { caption: "Bấm chọn nếu xác định đây là tội phạm công nghệ cao", field: "laCongNgheCao", kind: "toggle", span: "full" },
  { caption: "Điều tra viên thụ lý", field: "dieuTraVienText", kind: "text", span: "half", placeholder: "Ghi rõ tên điều tra viên thụ lý" },
  { caption: "Lãnh đạo phụ trách tố tụng", field: "lanhDaoToTung", kind: "text", span: "half", placeholder: "Ghi rõ tên lãnh đạo phụ trách ký tố tụng" },
  { caption: "Kết quả xử lý, giải quyết khác", field: "ketQuaXuLyKhac", kind: "textarea", span: "full", rows: 4, placeholder: "Các trường hợp xử lý giải quyết khác" },
  { caption: "Ghi chú khác", field: "ghiChuKhac", kind: "textarea", span: "full", rows: 4, placeholder: "Thêm rõ thông tin khác cho vụ việc, vụ án" },
] as const;

// ─── Tab 2 · Vụ việc ────────────────────────────────────────────────────────

const TAB_INCIDENT: readonly LegacyLayoutItem[] = [
  { caption: "Ngày tiếp nhận (theo biên bản tiếp nhận nguồn tin)", field: "ngayTiepNhanNguonTin", kind: "date", span: "half", mirrorOf: "info" },
  { caption: "Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại", field: "tenCungCap", kind: "text", span: "half", mirrorOf: "info" },
  { caption: "Tội danh chính - BLHS 2015 (nhận định ban đầu)", field: "crimeChinhId", kind: "crime", span: "half", required: true, mirrorOf: "info" },
  { caption: "Tóm tắt nội dung", field: "description", kind: "textarea", span: "full", rows: 4, mirrorOf: "info" },
  { caption: "Quyết định phân công giải quyết nguồn tin tội phạm", field: "soQDPhanCongNguonTin", kind: "text", span: "half", placeholder: "Quyết định phân công giải quyết nguồn tin tội phạm" },
  { caption: "Ngày ra Quyết định phân công giải quyết nguồn tin tội phạm", field: "ngayQDPhanCongNguonTin", kind: "date", span: "half" },
  { caption: "Quyết định Không khởi tố", field: "soQDKhongKhoiTo", kind: "text", span: "half", placeholder: "Quyết định Không khởi tố" },
  { caption: "Ngày ra Quyết định Không khởi tố", field: "ngayQDKhongKhoiTo", kind: "date", span: "half" },
  { caption: "Căn cứ để ra Quyết định Không khởi tố", field: "canCuKhongKhoiTo", kind: "text", span: "half", placeholder: "Ghi rõ căn cứ để ra Quyết định Không khởi tố" },
  { caption: "Lý do ra Quyết định không khởi tố vụ án", field: "lyDoKhongKhoiTo", kind: "multiselect", span: "full", options: LY_DO_KHONG_KHOI_TO_OPTIONS },
  { caption: "Chuyển vụ việc cho đơn vị khác", field: "chuyenVuViecDonViKhac", kind: "text", span: "half", placeholder: "Điền công văn hoặc phiếu chuyển đơn vị khác (Số, ngày, tháng, năm, đơn vị nhận hồ sơ)" },
  { caption: "Nhập vào vụ việc hồ sơ khác", field: "nhapVaoVuViecSo", kind: "text", span: "half", placeholder: "Ghi rõ vụ việc hiện tại được nhập vào vụ việc nào" },
  { caption: "Phân loại dân sự", field: "phanLoaiDanSu", kind: "text", span: "half", placeholder: "Điền thông báo phân loại dân sự (số, ngày, tháng, năm)" },
  ...VAT_CHUNG_MIRROR,
  ...HS_NGHIEP_VU_MIRROR,
  ...CAN_BO_MIRROR,
] as const;

// ─── Tab 3 · Vụ án ──────────────────────────────────────────────────────────

const TAB_CASE: readonly LegacyLayoutItem[] = [
  // Trùng nghĩa cấp độ tội phạm BLHS 2015 Điều 9 mà hệ mới đã có (`capDoToiPham`)
  // — dùng lại đúng ô ấy thay vì dựng cột thứ hai cho cùng một khái niệm.
  { caption: "Phân loại tội phạm (Chỉ xác định sau khi có Quyết định khởi tố vụ án)", field: "capDoToiPham", kind: "select", span: "half", options: PHAN_LOAI_TOI_PHAM_OPTIONS, placeholder: "Chọn" },
  { caption: "Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại", field: "tenCungCap", kind: "text", span: "half", mirrorOf: "info" },
  { caption: "Tội danh chính - BLHS 2015 (nhận định ban đầu)", field: "crimeChinhId", kind: "crime", span: "half", required: true, mirrorOf: "info" },
  { caption: "Tóm tắt nội dung", field: "description", kind: "textarea", span: "full", rows: 4, mirrorOf: "info" },
  { caption: "Tội danh chính khi khởi tố", field: "toiDanhChinhKhoiToId", kind: "crime", span: "half", placeholder: "Chọn tội danh" },
  { caption: "Tội danh phụ khi khởi tố", field: "toiDanhKhacIds", kind: "multiselect", span: "half" },
  { caption: "Số Quyết định Khởi tố vụ án", field: "soQuyetDinhKhoiTo", kind: "text", span: "half", placeholder: "Nhập Số Quyết định Khởi tố vụ án" },
  { caption: "Ngày ra Quyết định Khởi tố vụ án", field: "ngayKhoiTo", kind: "date", span: "half" },
  { caption: "Số Quyết định nhập vụ án", field: "soQDNhapVuAn", kind: "text", span: "half", placeholder: "Thêm số Quyết định nhập vụ án" },
  { caption: "Ngày tháng năm nhập vụ án", field: "ngayNhapVuAn", kind: "date", span: "half" },
  { caption: "Ghi chú nhập vào hồ sơ nào", field: "ghiChuNhapHoSo", kind: "textarea", span: "full", rows: 3, placeholder: "Điền rõ đã nhập vào số hồ sơ nào" },
  { caption: "Số Quyết định tách vụ án", field: "soQDTachVuAn", kind: "text", span: "half", placeholder: "Số Quyết định tách vụ án" },
  { caption: "Ngày Quyết định tách hồ sơ", field: "ngayTachVuAn", kind: "date", span: "half" },
  { caption: "Số Quyết định tách hành vi", field: "soQDTachHanhVi", kind: "text", span: "half", placeholder: "Nhập số Quyết định tách hành vi" },
  { caption: "Ngày Quyết định tách hành vi", field: "ngayTachHanhVi", kind: "date", span: "half" },
  { caption: "Số KLĐT đề nghị truy tố", field: "soKLDT", kind: "text", span: "half", placeholder: "Ghi số KLĐT đề nghị truy tố" },
  { caption: "Ngày Kết luận điều tra vụ án", field: "ngayKLDT", kind: "date", span: "half" },
  { caption: "Số Quyết định điều tra lại", field: "soQDDieuTraLai", kind: "text", span: "half", placeholder: "Điền Số Quyết định điều tra lại" },
  { caption: "Ngày Quyết định điều tra lại", field: "ngayQDDieuTraLai", kind: "date", span: "half" },
  { caption: "Số Quyết định đình chỉ vụ án", field: "soQDDinhChiVuAn", kind: "text", span: "half", placeholder: "Nhập số Quyết định Đình chỉ Vụ án" },
  { caption: "Ngày Quyết định đình chỉ vụ án", field: "ngayDinhChiVuAn", kind: "date", span: "half" },
  { caption: "Đã chuyển vụ án cho CQĐT khác", field: "chuyenVuAnChoCQK", kind: "text", span: "half", placeholder: "Số Quyết định chuyển vụ án cho CQĐT khác (số, ngày, tháng, năm, đơn vị nhận hồ sơ)" },
  ...VAT_CHUNG_MIRROR,
  ...HS_NGHIEP_VU_MIRROR,
  ...CAN_BO_MIRROR,
  // Hệ cũ ghi "toàn án" — lỗi đánh máy, anh đồng ý sửa 26/08/2026.
  { caption: "Số bản án của toà án có hiệu lực", field: "soBanAnCoHieuLuc", kind: "text", span: "half", placeholder: "Điền Số bản án có hiệu lực pháp luật (sơ thẩm, phúc thẩm)" },
  { caption: "Ngày tháng năm bản án của toà án có hiệu lực", field: "ngayBanAnCoHieuLuc", kind: "date", span: "half" },
] as const;

// ─── Tab 4 · ĐTBS ───────────────────────────────────────────────────────────
//
// Phần chính của tab là BẢNG con "Danh sách điều tra bổ sung" (dựng riêng, không
// khai được bằng danh sách ô). Dưới bảng là bốn ô gương.

const TAB_SUBJECTS: readonly LegacyLayoutItem[] = [
  { caption: "Tóm tắt nội dung", field: "description", kind: "textarea", span: "full", rows: 4, mirrorOf: "info" },
  { caption: "Số KLĐT đề nghị truy tố", field: "soKLDT", kind: "text", span: "half", mirrorOf: "case" },
  { caption: "Ngày Kết luận điều tra vụ án", field: "ngayKLDT", kind: "date", span: "half", mirrorOf: "case" },
  { caption: "Điều tra viên thụ lý", field: "dieuTraVienText", kind: "text", span: "half", mirrorOf: "info" },
] as const;

/** Cột bảng con "Danh sách điều tra bổ sung" của hệ cũ, đúng thứ tự. */
export const DTBS_TABLE_COLUMNS = [
  "STT",
  "Ngày tiếp nhận án điều tra bổ sung",
  "Số Quyết định điều tra bổ sung",
  "Ngày trả hồ sơ điều tra bổ sung của Viện kiểm sát",
  "Ngày trả hồ sơ điều tra bổ sung của Toà án",
  "Thao tác",
] as const;

// ─── Tab 5 · Vụ việc TĐC ────────────────────────────────────────────────────

const TAB_INCIDENT_TDC: readonly LegacyLayoutItem[] = [
  { caption: "Ngày tiếp nhận (theo biên bản tiếp nhận nguồn tin)", field: "ngayTiepNhanNguonTin", kind: "date", span: "half", mirrorOf: "info" },
  { caption: "Tên cá nhân, cơ quan, tổ chức cung cấp, bị hại", field: "tenCungCap", kind: "text", span: "half", mirrorOf: "info" },
  { caption: "Nghi vấn đối tượng hoặc bị can", field: "nghiVanDoiTuong", kind: "text", span: "half", mirrorOf: "info" },
  { caption: "Tội danh cũ trước đây", field: "toiDanhBanDau", kind: "text", span: "half", mirrorOf: "info" },
  { caption: "Tội danh chính - BLHS 2015 (nhận định ban đầu)", field: "crimeChinhId", kind: "crime", span: "half", required: true, mirrorOf: "info" },
  { caption: "Tóm tắt nội dung", field: "description", kind: "textarea", span: "full", rows: 4, mirrorOf: "info" },
  { caption: "Bấm chọn nếu xác định đây là tội phạm công nghệ cao", field: "laCongNgheCao", kind: "toggle", span: "full", mirrorOf: "info" },
  ...KHONG_KHOI_TO_MIRROR,
  { caption: "Xác định vụ việc này là vụ việc tạm dừng giải quyết (trước năm 2015)", field: "vuViecTamDungTruoc2015", kind: "toggle", span: "full" },
  { caption: "Quyết định Tạm đình chỉ nguồn tin", field: "soQDTamDinhChiNguonTin", kind: "text", span: "half", placeholder: "Ghi số Quyết định Tạm đình chỉ nguồn tin" },
  { caption: "Ngày ra Quyết định Tạm đình chỉ nguồn tin", field: "ngayQDTamDinhChiNguonTin", kind: "date", span: "half" },
  { caption: "Căn cứ Tạm đình chỉ nguồn tin", field: "canCuTamDinhChiNguonTin", kind: "text", span: "half", placeholder: "Căn cứ Tạm đình chỉ nguồn tin" },
  { caption: "Lý do tạm đình chỉ", field: "lyDoTamDinhChiNguonTin", kind: "multiselect", span: "full", options: LY_DO_TAM_DINH_CHI_NGUON_TIN_OPTIONS },
  { caption: "Ngày tháng năm hết thời hiệu truy cứu TNHS", field: "ngayHetThoiHieuVuViec", kind: "date", span: "half" },
  { caption: "Biên bản, báo cáo, kế hoạch khắc phục lý do TĐC vụ việc", field: "khacPhucLyDoTDCVuViec", kind: "textarea", span: "full", rows: 3, placeholder: "BB trao đổi với VKS, báo cáo, KH khắc phục lý do TĐC vụ việc (số, ngày tháng, năm)" },
  { caption: "Tiến độ khắc phục TĐC vụ việc", field: "tienDoKhacPhucTDCVuViec", kind: "textarea", span: "full", rows: 3, placeholder: "Biện pháp, tiến độ khắc phục lý do Tạm đình chỉ vụ việc" },
  { caption: "Số Phục hồi nguồn tin tội phạm", field: "soPhucHoiNguonTin", kind: "text", span: "half", placeholder: "Điền số Phục hồi nguồn tin tội phạm" },
  { caption: "Ngày Phục hồi nguồn tin tội phạm", field: "ngayPhucHoiNguonTin", kind: "date", span: "half" },
  ...VAT_CHUNG_MIRROR,
  ...HS_NGHIEP_VU_MIRROR,
  ...CAN_BO_MIRROR,
  { caption: "Ghi chú khác", field: "ghiChuKhac", kind: "textarea", span: "full", rows: 3, mirrorOf: "info" },
] as const;

// ─── Tab 6 · Vụ án TĐC ──────────────────────────────────────────────────────

const TAB_CASE_TDC: readonly LegacyLayoutItem[] = [
  { caption: "Tội danh cũ trước đây", field: "toiDanhBanDau", kind: "text", span: "half", mirrorOf: "info" },
  { caption: "Tội danh chính - BLHS 2015 (nhận định ban đầu)", field: "crimeChinhId", kind: "crime", span: "half", required: true, mirrorOf: "info" },
  { caption: "Tóm tắt nội dung", field: "description", kind: "textarea", span: "full", rows: 4, mirrorOf: "info" },
  { caption: "Bấm chọn nếu xác định đây là tội phạm công nghệ cao", field: "laCongNgheCao", kind: "toggle", span: "full", mirrorOf: "info" },
  { caption: "Số Quyết định Khởi tố vụ án", field: "soQuyetDinhKhoiTo", kind: "text", span: "half", mirrorOf: "case" },
  { caption: "Ngày ra Quyết định Khởi tố vụ án", field: "ngayKhoiTo", kind: "date", span: "half", mirrorOf: "case" },
  { caption: "Số Quyết định Tạm đình chỉ vụ án", field: "soQuyetDinhTamDinhChi", kind: "text", span: "half", placeholder: "Nhập số Quyết định Tạm đình chỉ vụ án" },
  { caption: "Ngày Quyết định tạm đình chỉ vụ án", field: "ngayTamDinhChi", kind: "date", span: "half" },
  { caption: "Căn cứ tạm đình chỉ vụ án", field: "canCuTamDinhChiVuAn", kind: "text", span: "half", placeholder: "Ghi rõ điều khoản Luật quy định tạm đình chỉ vụ án" },
  { caption: "Lý do tạm đình chỉ vụ án", field: "lyDoTamDinhChiVuAn", kind: "multiselect", span: "full", source: "LY_DO_TAM_DINH_CHI_VU_AN" },
  { caption: "Ngày hết thời hiệu truy cứu TNHS vụ án", field: "ngayHetThoiHieu", kind: "date", span: "half" },
  { caption: "Biên bản, báo cáo, kế hoạch khắc phục lý do TĐC vụ án", field: "tdcKhacPhucBienBan", kind: "textarea", span: "full", rows: 3, placeholder: "BB trao đổi với VKS, báo cáo, KH khắc phục lý do TĐC vụ án (số, ngày tháng, năm)" },
  { caption: "Biện pháp, tiến độ khắc phục lý do TĐC vụ án", field: "tdcKhacPhucLyDoBienPhap", kind: "textarea", span: "full", rows: 3, placeholder: "Biện pháp, tiến độ khắc phục lý do Tạm đình chỉ vụ án" },
  { caption: "Số Quyết định Phục hồi Vụ án", field: "soQuyetDinhPhucHoi", kind: "text", span: "half", placeholder: "Điền Số Quyết định Phục hồi Vụ án" },
  { caption: "Ngày Quyết định phục hồi điều tra vụ án", field: "ngayPhucHoi", kind: "date", span: "half" },
  { caption: "Căn cứ ra quyết định Phục hồi điều tra vụ án", field: "canCuPhucHoiVuAn", kind: "text", span: "half", placeholder: "Ghi rõ Căn cứ luật ra quyết định Phục hồi điều tra vụ án" },
  ...VAT_CHUNG_MIRROR,
  ...HS_NGHIEP_VU_MIRROR,
  ...CAN_BO_MIRROR,
] as const;

// ─── Tab 7 · Vật chứng ──────────────────────────────────────────────────────

const TAB_EVIDENCE: readonly LegacyLayoutItem[] = [
  { caption: "Loại, đặc điểm đồ vật, tài liệu, vật chứng", field: "vatChungMoTa", kind: "textarea", span: "full", rows: 3, placeholder: "Ghi rõ Loại, đặc điểm đồ vật, tài liệu, vật chứng" },
  { caption: "Lệnh nhập, phiếu nhập kho", field: "lenhNhapKho", kind: "text", span: "half", placeholder: "Ghi rõ đơn vị Lệnh nhập, phiếu nhập (số, ngày, tháng, năm)" },
  { caption: "Nơi lưu trữ, bảo quản, kê biên, phong tỏa", field: "noiLuuTruBaoQuan", kind: "text", span: "half", placeholder: "Ghi rõ nơi lưu trữ, bảo quản, kê biên, phong tỏa" },
] as const;

// ─── Tab 8 · HS nghiệp vụ ───────────────────────────────────────────────────

const TAB_BUSINESS_FILES: readonly LegacyLayoutItem[] = [
  { caption: "Số đăng ký hồ sơ nghiệp vụ", field: "statistic.soDangKyHoSo", kind: "text", span: "half", placeholder: "Ghi rõ Số đăng ký hồ sơ  nghiệp vụ" },
  { caption: "Ngày đăng ký hồ sơ nghiệp vụ", field: "statistic.ngayDangKyHoSo", kind: "date", span: "half" },
  { caption: "Số hồ sơ lưu", field: "statistic.hoSoLuu", kind: "text", span: "half", placeholder: "Ghi rõ Số lưu hồ sơ" },
  { caption: "Ngày nộp lưu hồ sơ", field: "statistic.ngayNopLuuHoSo", kind: "date", span: "half" },
  { caption: "Đơn vị lưu giữ, bảo quản hồ sơ", field: "statistic.donViBaoQuanHoSo", kind: "text", span: "half", placeholder: "Ghi rõ Đơn vị lưu giữ, bảo quản hồ sơ" },
] as const;

// ─── Tab 9 · TK 48 trường ───────────────────────────────────────────────────

const TAB_STATISTICS: readonly LegacyLayoutItem[] = [
  { caption: "Phân loại tội phạm (Chỉ xác định sau khi có Quyết định khởi tố vụ án)", field: "capDoToiPham", kind: "select", span: "half", options: PHAN_LOAI_TOI_PHAM_OPTIONS, mirrorOf: "case" },
  { caption: "Ngày tổng hợp thống kê", field: "statistic.ngayThongKe", kind: "date", span: "half" },
  { caption: "Ngày Thời điểm phân công giải quyết tố giác, tin báo", field: "statistic.ngayPhanCongGiaiQuyetToGiac", kind: "date", span: "half" },
  { caption: "Ngày tiếp nhận tin khi đơn vị nhận được", field: "statistic.ngayTiepNhanTin", kind: "date", span: "half" },
  { caption: "Ngày người phạm tội đầu thú, tự thú", field: "statistic.ngayDauThu", kind: "date", span: "half" },
  { caption: "Ngày người phạm tội bị bắt quả tang", field: "statistic.ngayPhamToiQuaTang", kind: "date", span: "half" },
  { caption: "Ngày Người phạm tội bị giữ trong các trường hợp khẩn cấp", field: "statistic.ngayBatKhanCap", kind: "date", span: "half" },
  { caption: "Ngày CQCSĐT trực tiếp phát hiện có dấu hiệu tội phạm", field: "statistic.ngayPhatHienDauHieu", kind: "date", span: "half" },
  { caption: "Tóm tắt nội dung", field: "description", kind: "textarea", span: "full", rows: 4, mirrorOf: "info" },
  { caption: "Tội danh chính khi khởi tố", field: "toiDanhChinhKhoiToId", kind: "crime", span: "half", mirrorOf: "case" },
  { caption: "Tội danh phụ khi khởi tố", field: "toiDanhKhacIds", kind: "multiselect", span: "half", mirrorOf: "case" },
  { caption: "Ngày tội phạm xảy ra", field: "ngayXayRa", kind: "date", span: "half" },
  { caption: "Số tiền bị thiệt hại (triệu Việt nam Đồng)", field: "statistic.soTienBiThietHai", kind: "number", span: "half" },
  { caption: "Số tiền thu hồi được (triệu Việt Nam Đồng)", field: "statistic.soTienThuHoi", kind: "number", span: "half" },
  { caption: "Phương thức thủ đoạn", field: "phuongThucThuDoan", kind: "text", span: "half", placeholder: "Phương thức thủ đoạn" },
  { caption: "Nơi xảy ra (cấp phường/xã)", field: "noiXayRaPhuongXa", kind: "text", span: "half", placeholder: "Điền nơi xảy ra tội phạm cấp phường xã" },
  ...KHONG_KHOI_TO_MIRROR,
  { caption: "Quyết định Tạm đình chỉ nguồn tin", field: "soQDTamDinhChiNguonTin", kind: "text", span: "half", mirrorOf: "incident-tdc" },
  { caption: "Ngày ra Quyết định Tạm đình chỉ nguồn tin", field: "ngayQDTamDinhChiNguonTin", kind: "date", span: "half", mirrorOf: "incident-tdc" },
  { caption: "Số Quyết định Khởi tố vụ án", field: "soQuyetDinhKhoiTo", kind: "text", span: "half", mirrorOf: "case" },
  { caption: "Ngày ra Quyết định Khởi tố vụ án", field: "ngayKhoiTo", kind: "date", span: "half", mirrorOf: "case" },
  { caption: "Số đối tượng phạm tội", field: "statistic.soDoiTuong", kind: "number", span: "half" },
  { caption: "Số đối tượng bắt được", field: "statistic.soDoiTuongDaBat", kind: "number", span: "half" },
  { caption: "Số đối tượng bị bắt trong vụ án khác", field: "statistic.soDoiTuongBiBatVuAnKhac", kind: "number", span: "half" },
  { caption: "Điều tra mở rộng", field: "statistic.dieuTraMoRong", kind: "number", span: "half" },
  // Hệ cũ ghi "vụ khí nóng" — lỗi đánh máy, anh đồng ý sửa 26/08/2026.
  { caption: "Sử dụng vũ khí nóng", field: "statistic.suDungVuKhiNong", kind: "text", span: "half" },
  { caption: "Số lượng người bị hại", field: "statistic.soLuongBiHai", kind: "number", span: "half" },
  { caption: "Số người chết", field: "statistic.soLuongNguoiChet", kind: "number", span: "half" },
  { caption: "Số người bị thương", field: "statistic.soNguoiBiThuong", kind: "number", span: "half" },
  { caption: "Xác nhận có băng nhóm", field: "statistic.coBangNhom", kind: "toggle", span: "full" },
  { caption: "Bắt được bao nhiêu băng nhóm", field: "statistic.soBangNhomBatDuoc", kind: "number", span: "half" },
  { caption: "Số lượng súng thu hồi", field: "statistic.soSungThuHoi", kind: "number", span: "half" },
  { caption: "Số lượng thuốc nổ thu hồi", field: "statistic.soThuocNoThuHoi", kind: "number", span: "half" },
  { caption: "Xác nhận vụ việc có vi phạm hành chính", field: "statistic.coVPHC", kind: "toggle", span: "full" },
  { caption: "Số đối tượng vi phạm hành chính", field: "statistic.soDoiTuongVPHC", kind: "number", span: "half" },
  { caption: "Số người bị phạt tiền", field: "statistic.soNguoiBiPhatTien", kind: "number", span: "half" },
  { caption: "Tổng số tiền phạt hành chính (triệu Việt Nam Đồng)", field: "statistic.tongTienPhatHanhChinh", kind: "number", span: "half" },
  { caption: "Số đối tượng sưu tra/hiềm nghi", field: "statistic.soDoiTuongSuuTraHiemNghi", kind: "number", span: "half" },
] as const;

// ─── Tab 10 · Ghi âm, ghi hình ──────────────────────────────────────────────

const TAB_MEDIA: readonly LegacyLayoutItem[] = [
  { caption: "Bấm xác nhận nếu là nguồn tin có sử dụng Ghi âm, Ghi hình", field: "statistic.coGhiAmGhiHinh", kind: "toggle", span: "full" },
  { caption: "Tổng số biên bản ghi lời khai", field: "statistic.tongSoBienBanGhiLoiKhai", kind: "number", span: "half" },
  { caption: "Số lượng biên bản ghi lời khai có ghi âm ghi hình", field: "statistic.soBienBanGhiLoiKhaiCoGhiAm", kind: "number", span: "half" },
  { caption: "Xác nhận nếu là Vụ án có sử dụng Ghi âm, Ghi hình", field: "statistic.laVuAnGhiAmGhiHinh", kind: "toggle", span: "full" },
  { caption: "Tổng số biên bản hỏi cung bị can", field: "statistic.tongSoBienBanHoiCung", kind: "number", span: "half" },
  { caption: "Tổng số biên bản hỏi cung có ghi âm ghi hình", field: "statistic.tongSoBienBanHoiCungCoGhiAm", kind: "number", span: "half" },
  { caption: "Số lượng bị can có ghi âm ghi hình", field: "statistic.soBiCanCoGhiAm", kind: "number", span: "half" },
  { caption: "Bấm xác nhận nếu VKS yêu cầu ghi âm ghi hình", field: "statistic.vksYeuCauGhiAm", kind: "toggle", span: "full" },
  { caption: "Số lượng bị can VKS yêu cầu ghi âm ghi hình", field: "statistic.soBiCanVksYeuCauGhiAm", kind: "number", span: "half" },
  { caption: "Xác nhận vụ án đã được xét xử", field: "statistic.vuAnDaDuocXetXu", kind: "toggle", span: "full" },
  { caption: "Xác nhận Trong đó: Số vụ án tiến hành Ghi âm, Ghi hình đã được xét xử", field: "statistic.ghiAmGhiHinhDaDuocXetXu", kind: "toggle", span: "full" },
  { caption: "Xác nhận trong đó: Vụ án có sử dụng kết quả Ghi âm ghi hình trong xét xử", field: "statistic.coSuDungKQGhiAmTrongXetXu", kind: "toggle", span: "full" },
  { caption: "Xác nhận trong đó: Vụ án không ghi âm ghi hình nhưng Tòa án yêu cầu cung cấp ghi âm ghi hình", field: "statistic.khongGAGHNhungToaYeuCau", kind: "toggle", span: "full" },
] as const;

// ─── Bảng tra theo tab ──────────────────────────────────────────────────────

export const LEGACY_FORM_LAYOUT: Record<LegacyTabId, readonly LegacyLayoutItem[]> = {
  info: TAB_INFO,
  incident: TAB_INCIDENT,
  case: TAB_CASE,
  subjects: TAB_SUBJECTS,
  "incident-tdc": TAB_INCIDENT_TDC,
  "case-tdc": TAB_CASE_TDC,
  evidence: TAB_EVIDENCE,
  "business-files": TAB_BUSINESS_FILES,
  statistics: TAB_STATISTICS,
  media: TAB_MEDIA,
};

/** Nhãn hiển thị thật: gắn hậu tố "(Tab: X)" cho trường gương, đúng cách hệ cũ làm. */
export function legacyCaption(item: LegacyLayoutItem): string {
  return item.mirrorOf ? `${item.caption} (Tab: ${LEGACY_TAB_LABEL[item.mirrorOf]})` : item.caption;
}

/**
 * Tên cột ở lớp máy chủ khi khác tên ô trong `CaseFormData`.
 *
 * Vài ô mang tên khác vì cột đã tồn tại từ trước epic này. Khai tường minh ở một chỗ để
 * mọi nơi cần đối chiếu ô-với-cột đều nhìn cùng một bảng.
 */
export const LEGACY_FIELD_TO_COLUMN: Readonly<Record<string, string>> = {
  description: "moTaChiTiet",
  supervisingUnit: "unit",
  dieuTraVienText: "dieuTraVien",
  deXuatXuLy: "deXuat",
  ngayTiepNhanNguonTin: "ngayTiepNhan",
  utdt_thoiHanUyThac: "thoiHanUyThac",
  baoCaoBanGiamDoc: "baoCaoBanGiamDocText",
};

/**
 * Tập CỘT mà form Vụ án đã có ô nhập ở đúng vị trí hệ cũ.
 *
 * Panel "Thông tin nghiệp vụ bổ sung" cuối trang dùng tập này để KHÔNG dựng ô thứ hai cho
 * cùng một cột. Không lọc thì mỗi cột có hai ô cùng ghi một chỗ, và vì panel ghi sau nên nó
 * ĐÈ giá trị cán bộ vừa gõ trong tab — mất dữ liệu ngay trong một lần lưu.
 */
export const LEGACY_FORM_OWNED_COLUMNS: ReadonlySet<string> = new Set(
  Object.values(LEGACY_FORM_LAYOUT)
    .flat()
    .map((it) => it.field)
    .filter((f) => !f.startsWith("statistic."))
    .map((f) => LEGACY_FIELD_TO_COLUMN[f] ?? f),
);
