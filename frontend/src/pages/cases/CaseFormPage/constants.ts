// ─── Select options for CaseForm tabs (Tiếng Việt có dấu chuẩn) ─────────────

export const CASE_TYPE_OPTIONS = [
  { value: "don-thu", label: "Đơn thư" },
  { value: "vu-viec", label: "Vụ việc" },
  { value: "vu-an", label: "Vụ án" },
];

export const PRIORITY_OPTIONS = [
  { value: "thap", label: "Thấp" },
  { value: "trung-binh", label: "Trung bình" },
  { value: "cao", label: "Cao" },
  { value: "khan-cap", label: "Khẩn cấp" },
];

// values khớp với CaseStatus enum trong Prisma schema
export const STATUS_OPTIONS = [
  { value: "TIEP_NHAN",      label: "Tiếp nhận" },
  { value: "DANG_XAC_MINH",  label: "Đang xác minh" },
  { value: "DA_XAC_MINH",    label: "Đã xác minh" },
  { value: "DANG_DIEU_TRA",  label: "Đang điều tra" },
  { value: "TAM_DINH_CHI",   label: "Tạm đình chỉ" },
  { value: "DINH_CHI",       label: "Đình chỉ" },
  { value: "DA_KET_LUAN",    label: "Đã kết luận" },
  { value: "DANG_TRUY_TO",   label: "Đang truy tố" },
  { value: "DANG_XET_XU",    label: "Đang xét xử" },
  { value: "DA_LUU_TRU",     label: "Đã lưu trữ" },
];

// HANDLER_OPTIONS đã bị xóa — danh sách ĐTV được fetch từ API /admin/users trong CaseFormPage/index.tsx

export const DISTRICT_OPTIONS = [
  { value: "quan-1", label: "Quận 1" },
  { value: "quan-3", label: "Quận 3" },
  { value: "quan-5", label: "Quận 5" },
  { value: "quan-10", label: "Quận 10" },
  { value: "quan-tan-binh", label: "Quận Tân Bình" },
  { value: "quan-binh-thanh", label: "Quận Bình Thạnh" },
  { value: "quan-thu-duc", label: "TP. Thủ Đức" },
];

export const WARD_OPTIONS = [
  { value: "phuong-ben-nghe", label: "Phường Bến Nghé" },
  { value: "phuong-ben-thanh", label: "Phường Bến Thành" },
  { value: "phuong-cau-ong-lanh", label: "Phường Cầu Ông Lãnh" },
  { value: "phuong-da-kao", label: "Phường Đa Kao" },
  { value: "phuong-nguyen-cu-trinh", label: "Phường Nguyễn Cư Trinh" },
];

export const INCIDENT_TYPE_OPTIONS = [
  { value: "gay-roi-trat-tu", label: "Gây rối trật tự công cộng" },
  { value: "vi-pham-giao-thong", label: "Vi phạm giao thông" },
  { value: "danh-nhau", label: "Đánh nhau, xô xát" },
  { value: "trom-cap", label: "Trộm cắp" },
  { value: "lua-dao", label: "Lừa đảo" },
  { value: "khac", label: "Khác" },
];

export const INCIDENT_LEVEL_OPTIONS = [
  { value: "nhe", label: "Nhẹ" },
  { value: "trung-binh", label: "Trung bình" },
  { value: "nghiem-trong", label: "Nghiêm trọng" },
  { value: "rat-nghiem-trong", label: "Rất nghiêm trọng" },
  { value: "dac-biet-nghiem-trong", label: "Đặc biệt nghiêm trọng" },
];

// values khớp với field crime lưu plain string trong DB (seed-sample-data.ts)
export const CRIMINAL_TYPE_OPTIONS = [
  { value: "Giết người (Điều 123 BLHS)",                       label: "Giết người (Điều 123 BLHS)" },
  { value: "Cố ý gây thương tích (Điều 134 BLHS)",             label: "Cố ý gây thương tích (Điều 134 BLHS)" },
  { value: "Cướp tài sản (Điều 168 BLHS)",                     label: "Cướp tài sản (Điều 168 BLHS)" },
  { value: "Cưỡng đoạt tài sản (Điều 170 BLHS)",               label: "Cưỡng đoạt tài sản (Điều 170 BLHS)" },
  { value: "Trộm cắp tài sản (Điều 173 BLHS)",                 label: "Trộm cắp tài sản (Điều 173 BLHS)" },
  { value: "Lừa đảo chiếm đoạt tài sản (Điều 174 BLHS)",       label: "Lừa đảo chiếm đoạt tài sản (Điều 174 BLHS)" },
  { value: "Hủy hoại tài sản (Điều 178 BLHS)",                 label: "Hủy hoại tài sản (Điều 178 BLHS)" },
  { value: "Tàng trữ trái phép chất ma túy (Điều 193 BLHS)",   label: "Tàng trữ trái phép chất ma túy (Điều 193 BLHS)" },
  { value: "Vận chuyển trái phép chất ma túy (Điều 194 BLHS)", label: "Vận chuyển trái phép chất ma túy (Điều 194 BLHS)" },
  { value: "Sản xuất trái phép chất ma túy (Điều 248 BLHS)",   label: "Sản xuất trái phép chất ma túy (Điều 248 BLHS)" },
  { value: "Vi phạm quy định về tham gia GTĐB (Điều 260 BLHS)",label: "Vi phạm quy định về tham gia GTĐB (Điều 260 BLHS)" },
  { value: "Lợi dụng quyền tự do dân chủ (Điều 331 BLHS)",     label: "Lợi dụng quyền tự do dân chủ (Điều 331 BLHS)" },
  { value: "Tội danh khác",                                     label: "Tội danh khác" },
];

export const PROSECUTION_OFFICE_OPTIONS = [
  { value: "vks-quan-1", label: "VKSND Quận 1" },
  { value: "vks-quan-3", label: "VKSND Quận 3" },
  { value: "vks-quan-5", label: "VKSND Quận 5" },
  { value: "vks-quan-10", label: "VKSND Quận 10" },
  { value: "vks-tphcm", label: "VKSND TP.HCM" },
];

export const TDC_SOURCE_OPTIONS = [
  { value: "to-giac-truc-tiep", label: "Tố giác trực tiếp" },
  { value: "tin-bao-dien-thoai", label: "Tin báo qua điện thoại" },
  { value: "don-thu", label: "Đơn thư" },
  { value: "bao-chi", label: "Báo chí" },
  { value: "co-quan-to-chuc", label: "Cơ quan, tổ chức" },
  { value: "khac", label: "Khác" },
];

export const TDC_CASE_TYPE_OPTIONS = [
  { value: "khoi-to-tu-to-giac", label: "Khởi tố từ tố giác" },
  { value: "khoi-to-tu-tin-bao", label: "Khởi tố từ tin báo" },
  { value: "chuyen-tu-vu-viec", label: "Chuyển từ vụ việc" },
  { value: "khac", label: "Khác" },
];

export const SUBJECT_TYPE_OPTIONS = [
  { value: "Bị can", label: "Bị can" },
  { value: "Bị hại", label: "Bị hại" },
  { value: "Luật sư", label: "Luật sư" },
  { value: "Nhân chứng", label: "Nhân chứng" },
];

export const EVIDENCE_STATUS_OPTIONS = [
  { value: "dang-luu-giu", label: "Đang lưu giữ" },
  { value: "da-tra", label: "Đã trả" },
  { value: "da-tieu-huy", label: "Đã tiêu hủy" },
  { value: "chuyen-vks", label: "Chuyển VKS" },
];

// ─── Thống kê 48 trường (4 nhóm × 12 trường) ────────────────────────────────

export const STAT_FIELDS = [
  // Nhóm 1: Nguồn tin (12 trường)
  "Loại nguồn tin",
  "Nguồn gốc",
  "Loại người báo tin",
  "Hình thức tiếp nhận",
  "Mức độ khẩn",
  "Đơn vị tiếp báo",
  "Ngày xảy ra vụ việc",
  "Giờ xảy ra vụ việc",
  "Tỉnh/Thành phố",
  "Quận/Huyện",
  "Phường/Xã",
  "Phân loại ban đầu",
  // Nhóm 2: Tội phạm (12 trường)
  "Tội danh chính",
  "Tội danh phụ",
  "Lĩnh vực",
  "Phương thức thủ đoạn",
  "Thiệt hại (VNĐ)",
  "Đã thu hồi (VNĐ)",
  "Số bị hại",
  "Số người chết",
  "Số người bị thương",
  "Thiệt hại tài sản",
  "Tội phạm có tổ chức",
  "Tái phạm",
  // Nhóm 3: Đối tượng (12 trường)
  "Số đối tượng",
  "Đã bắt giữ",
  "Đã tạm giam",
  "Giới tính",
  "Độ tuổi",
  "Dân tộc",
  "Quốc tịch",
  "Nghề nghiệp",
  "Trình độ học vấn",
  "Tiền án tiền sự",
  "Liên quan ma túy",
  "Sử dụng vũ khí",
  // Nhóm 4: Kết quả (12 trường)
  "Trạng thái xử lý",
  "Kết quả điều tra",
  "Kết quả truy tố",
  "Kết quả xét xử",
  "Mức án",
  "Ngày kết thúc",
  "Số ngày xử lý",
  "Chứng cứ thu thập",
  "Số nhân chứng",
  "Tài sản thu giữ",
  "Chuyển vụ án",
  "Đã báo cáo",
];

export const SUBJECT_TYPE_COLORS: Record<string, string> = {
  "Bị can": "bg-red-100 text-red-700",
  "Bị hại": "bg-blue-100 text-blue-700",
  "Luật sư": "bg-purple-100 text-purple-700",
  "Nhân chứng": "bg-slate-100 text-slate-700",
};

export const BUSINESS_FILES = [
  { name: "Biên bản khám nghiệm hiện trường", date: "10/02/2026", status: "Đã hoàn thành" },
  { name: "Biên bản lấy lời khai", date: "11/02/2026", status: "Đang thực hiện" },
  { name: "Kết luận giám định", date: "", status: "Chưa có" },
  { name: "Quyết định khởi tố", date: "", status: "Chưa có" },
  { name: "Lệnh bắt tạm giam", date: "", status: "Chưa có" },
  { name: "Biên bản đối chất", date: "", status: "Chưa có" },
];

export const FILE_STATUS_COLORS: Record<string, string> = {
  "Đã hoàn thành": "bg-green-100 text-green-700",
  "Đang thực hiện": "bg-blue-100 text-blue-700",
  "Chưa có": "bg-slate-100 text-slate-700",
};

// ─── Đơn vị options — values khớp với field unit lưu plain string trong DB ───

export const UNIT_OPTIONS = [
  { value: "Công an TP. Hồ Chí Minh",    label: "Công an TP. Hồ Chí Minh" },
  { value: "Công an Quận 1",              label: "Công an Quận 1" },
  { value: "Công an Quận 3",              label: "Công an Quận 3" },
  { value: "Công an Quận 5",              label: "Công an Quận 5" },
  { value: "Công an Quận 7",              label: "Công an Quận 7" },
  { value: "Công an Quận 10",             label: "Công an Quận 10" },
  { value: "Công an Quận 12",             label: "Công an Quận 12" },
  { value: "Công an Quận Tân Bình",       label: "Công an Quận Tân Bình" },
  { value: "Công an Quận Bình Thạnh",     label: "Công an Quận Bình Thạnh" },
  { value: "Công an Quận Phú Nhuận",      label: "Công an Quận Phú Nhuận" },
  { value: "Công an Huyện Củ Chi",        label: "Công an Huyện Củ Chi" },
  { value: "Công an Huyện Hóc Môn",       label: "Công an Huyện Hóc Môn" },
];

// ─── Loại vụ án (cấp độ) ─────────────────────────────────────────────────────

export const CASE_CLASSIFICATION_OPTIONS = [
  { value: "hinh-su", label: "Vụ án hình sự" },
  { value: "hanh-chinh", label: "Vi phạm hành chính" },
  { value: "dan-su", label: "Tranh chấp dân sự" },
  { value: "khac", label: "Khác" },
];
