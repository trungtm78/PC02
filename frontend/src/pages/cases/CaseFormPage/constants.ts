// ─── Select options for CaseForm tabs (Tiếng Việt có dấu chuẩn) ─────────────

// v0.37.1: CASE_TYPE_OPTIONS removed (vestigial). Replaced by CASE_PROVENANCE_OPTIONS
// below — the 5 provenance values map to BLTTHS Article 143 (Nguồn tin về tội phạm).
// Each option has helperText referencing the legal basis to guide cán bộ điều tra.
import { CaseProvenance } from '@/shared/enums/generated';

export interface CaseProvenanceOption {
  value: typeof CaseProvenance[keyof typeof CaseProvenance];
  label: string;
  helperText: string;
}

export const CASE_PROVENANCE_OPTIONS: CaseProvenanceOption[] = [
  {
    value: CaseProvenance.FROM_PETITION,
    label: 'Khởi tố từ Đơn thư',
    helperText: 'Vụ án khởi tố trên cơ sở Đơn thư (tố giác, khiếu nại, kiến nghị) đã được tiếp nhận và xác minh. BLTTHS Đ.143 điểm a, b.',
  },
  {
    value: CaseProvenance.FROM_INCIDENT,
    label: 'Khởi tố từ Vụ việc',
    helperText: 'Vụ án khởi tố từ Vụ việc đang giải quyết đã được xác minh có dấu hiệu tội phạm. BLTTHS Đ.143.',
  },
  {
    value: CaseProvenance.DIRECT_DISCOVERY,
    label: 'CQĐT phát hiện trực tiếp',
    helperText: 'CQĐT phát hiện trực tiếp tội phạm trong quá trình công tác (tuần tra, kiểm tra hành chính, ...). BLTTHS Đ.143 điểm c.',
  },
  {
    value: CaseProvenance.TRANSFERRED,
    label: 'Chuyển từ cơ quan khác',
    helperText: 'Vụ án chuyển từ cơ quan khác (CQĐT cấp trên, Tòa án, ...) kèm theo hồ sơ. Ghi chú số văn bản chuyển trong "Ghi chú nguồn".',
  },
  {
    value: CaseProvenance.SELF_SURRENDER,
    label: 'Người phạm tội tự thú',
    helperText: 'Người phạm tội tự thú trước CQĐT. BLTTHS Đ.143 điểm d. Ghi rõ thông tin người tự thú và biên bản tiếp nhận trong "Ghi chú nguồn".',
  },
  {
    value: CaseProvenance.PROSECUTOR_PROPOSAL,
    label: 'Kiến nghị khởi tố của VKS',
    helperText: 'Viện Kiểm sát kiến nghị khởi tố. BLTTHS Đ.143 điểm đ. Ghi rõ số văn bản kiến nghị trong "Ghi chú nguồn".',
  },
  {
    value: CaseProvenance.OTHER_LEGAL_SOURCE,
    label: 'Nguồn pháp lý khác',
    helperText: 'Căn cứ pháp lý hợp pháp khác (báo chí, tin báo của công dân ngoài đơn thư, ...). Ghi rõ căn cứ trong "Ghi chú nguồn".',
  },
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
// DISTRICT_OPTIONS và WARD_OPTIONS đã bị xóa — cải cách hành chính xóa bỏ cấp quận/huyện
// Địa chỉ được load từ API /api/v1/directories?type=WARD&isActive=true (xem tabs.tsx)

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

// CRIMINAL_TYPE_OPTIONS removed — fetched dynamically from MasterClass API type '07'
// via FKSelect masterClassType="07" prop. Seed: backend/prisma/seed-master-classes.ts

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
