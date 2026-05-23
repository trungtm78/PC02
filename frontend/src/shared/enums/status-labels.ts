/**
 * Vietnamese labels and badge styles for all entity status enums.
 * Source of truth: Prisma schema (via generated.ts).
 * Used by: ComprehensiveListPage, and any future aggregate or detail view.
 */
import { CaseStatus, IncidentStatus, PetitionStatus, LyDoKhongKhoiTo, LoaiNguonTin, NguonPhatTin, PhuongThucTiepNhan, DeadlineRuleStatus, LoaiDon } from './generated';

// ── Vietnamese labels ───────────────────────────────────────────

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  [CaseStatus.TIEP_NHAN]:      'Tiếp nhận',
  [CaseStatus.DANG_XAC_MINH]: 'Đang xác minh',
  [CaseStatus.DA_XAC_MINH]:   'Đã xác minh',
  [CaseStatus.DANG_DIEU_TRA]: 'Đang điều tra',
  [CaseStatus.TAM_DINH_CHI]:  'Tạm đình chỉ',
  [CaseStatus.DINH_CHI]:      'Đình chỉ',
  [CaseStatus.DA_KET_LUAN]:   'Đã kết luận',
  [CaseStatus.DANG_TRUY_TO]:  'Đang truy tố',
  [CaseStatus.DANG_XET_XU]:   'Đang xét xử',
  [CaseStatus.DA_LUU_TRU]:    'Đã lưu trữ',
};

export const INCIDENT_STATUS_LABEL: Record<IncidentStatus, string> = {
  [IncidentStatus.TIEP_NHAN]:           'Tiếp nhận',
  [IncidentStatus.DANG_XAC_MINH]:       'Đang xác minh',
  [IncidentStatus.DA_PHAN_CONG]:        'Đã phân công',
  [IncidentStatus.DA_GIAI_QUYET]:       'Đã giải quyết',
  [IncidentStatus.TAM_DINH_CHI]:        'Tạm đình chỉ',
  [IncidentStatus.QUA_HAN]:             'Quá hạn',
  [IncidentStatus.DA_CHUYEN_VU_AN]:     'Đã chuyển vụ án',
  [IncidentStatus.KHONG_KHOI_TO]:       'Không khởi tố',
  [IncidentStatus.CHUYEN_XPHC]:         'Chuyển XPHC',
  [IncidentStatus.TDC_HET_THOI_HIEU]:  'TĐC hết thời hiệu',
  [IncidentStatus.TDC_HTH_KHONG_KT]:   'TĐC không khởi tố',
  [IncidentStatus.PHUC_HOI_NGUON_TIN]:  'Phục hồi nguồn tin',
  [IncidentStatus.DA_CHUYEN_DON_VI]:    'Đã chuyển đơn vị',
  [IncidentStatus.DA_NHAP_VU_KHAC]:     'Đã nhập vụ khác',
  [IncidentStatus.PHAN_LOAI_DAN_SU]:    'Phân loại dân sự',
};

export const PETITION_STATUS_LABEL: Record<PetitionStatus, string> = {
  [PetitionStatus.MOI_TIEP_NHAN]:      'Mới tiếp nhận',
  [PetitionStatus.DANG_XU_LY]:         'Đang xử lý',
  [PetitionStatus.CHO_PHE_DUYET]:      'Chờ phê duyệt',
  [PetitionStatus.DA_LUU_DON]:         'Đã lưu đơn',
  [PetitionStatus.DA_GIAI_QUYET]:      'Đã giải quyết',
  [PetitionStatus.DA_CHUYEN_VU_VIEC]:  'Đã chuyển vụ việc',
  [PetitionStatus.DA_CHUYEN_VU_AN]:    'Đã chuyển vụ án',
};

// v0.37.2.4 — single source of truth cho Loại đơn (LoaiDon enum) Vietnamese labels.
// PetitionFormPage uses this for <select> options. Backend DTO validates against
// enum values (TO_CAO/KHIEU_NAI/KIEN_NGHI/PHAN_ANH) — labels here are display-only.
export const LOAI_DON_LABEL: Record<LoaiDon, string> = {
  [LoaiDon.TO_CAO]:    'Tố cáo',
  [LoaiDon.KHIEU_NAI]: 'Khiếu nại',
  [LoaiDon.KIEN_NGHI]: 'Kiến nghị',
  [LoaiDon.PHAN_ANH]:  'Phản ánh',
};

export const LOAI_DON_OPTIONS: ReadonlyArray<{ value: LoaiDon; label: string }> =
  (Object.keys(LOAI_DON_LABEL) as LoaiDon[]).map((value) => ({
    value,
    label: LOAI_DON_LABEL[value],
  }));

// ── Badge Tailwind classes (grouped by phase) ───────────────────

const BADGE_WAITING    = 'bg-amber-100 text-amber-800 border-amber-300';
const BADGE_PROCESSING = 'bg-blue-100 text-blue-800 border-blue-300';
const BADGE_DONE       = 'bg-green-100 text-green-800 border-green-300';
const BADGE_SUSPENDED  = 'bg-slate-100 text-slate-800 border-slate-300';
const BADGE_OVERDUE    = 'bg-red-100 text-red-800 border-red-300';
export const BADGE_DEFAULT = 'bg-slate-100 text-slate-600 border-slate-200';

export const CASE_STATUS_BADGE: Record<CaseStatus, string> = {
  [CaseStatus.TIEP_NHAN]:      BADGE_WAITING,
  [CaseStatus.DANG_XAC_MINH]: BADGE_PROCESSING,
  [CaseStatus.DA_XAC_MINH]:   BADGE_PROCESSING,
  [CaseStatus.DANG_DIEU_TRA]: BADGE_PROCESSING,
  [CaseStatus.TAM_DINH_CHI]:  BADGE_SUSPENDED,
  [CaseStatus.DINH_CHI]:      BADGE_SUSPENDED,
  [CaseStatus.DA_KET_LUAN]:   BADGE_DONE,
  [CaseStatus.DANG_TRUY_TO]:  BADGE_PROCESSING,
  [CaseStatus.DANG_XET_XU]:   BADGE_PROCESSING,
  [CaseStatus.DA_LUU_TRU]:    BADGE_DONE,
};

export const INCIDENT_STATUS_BADGE: Record<IncidentStatus, string> = {
  [IncidentStatus.TIEP_NHAN]:           BADGE_WAITING,
  [IncidentStatus.DANG_XAC_MINH]:       BADGE_PROCESSING,
  [IncidentStatus.DA_PHAN_CONG]:        BADGE_PROCESSING,
  [IncidentStatus.DA_GIAI_QUYET]:       BADGE_DONE,
  [IncidentStatus.TAM_DINH_CHI]:        BADGE_SUSPENDED,
  [IncidentStatus.QUA_HAN]:             BADGE_OVERDUE,
  [IncidentStatus.DA_CHUYEN_VU_AN]:     BADGE_DONE,
  [IncidentStatus.KHONG_KHOI_TO]:       BADGE_DONE,
  [IncidentStatus.CHUYEN_XPHC]:         BADGE_DONE,
  [IncidentStatus.TDC_HET_THOI_HIEU]:  BADGE_SUSPENDED,
  [IncidentStatus.TDC_HTH_KHONG_KT]:   BADGE_SUSPENDED,
  [IncidentStatus.PHUC_HOI_NGUON_TIN]:  BADGE_PROCESSING,
  [IncidentStatus.DA_CHUYEN_DON_VI]:    BADGE_DONE,
  [IncidentStatus.DA_NHAP_VU_KHAC]:     BADGE_DONE,
  [IncidentStatus.PHAN_LOAI_DAN_SU]:    BADGE_DONE,
};

export const PETITION_STATUS_BADGE: Record<PetitionStatus, string> = {
  [PetitionStatus.MOI_TIEP_NHAN]:      BADGE_WAITING,
  [PetitionStatus.DANG_XU_LY]:         BADGE_PROCESSING,
  [PetitionStatus.CHO_PHE_DUYET]:      BADGE_PROCESSING,
  [PetitionStatus.DA_LUU_DON]:         BADGE_SUSPENDED,
  [PetitionStatus.DA_GIAI_QUYET]:      BADGE_DONE,
  [PetitionStatus.DA_CHUYEN_VU_VIEC]:  BADGE_DONE,
  [PetitionStatus.DA_CHUYEN_VU_AN]:    BADGE_DONE,
};

// ── Terminal statuses (used by isOverdue logic) ─────────────────

export const TERMINAL_CASE_STATUSES: CaseStatus[] = [
  CaseStatus.DA_KET_LUAN,
  CaseStatus.DA_LUU_TRU,
  CaseStatus.DINH_CHI,
  CaseStatus.TAM_DINH_CHI,
];

export const TERMINAL_INCIDENT_STATUSES: IncidentStatus[] = [
  IncidentStatus.DA_GIAI_QUYET,
  IncidentStatus.DA_CHUYEN_VU_AN,
  IncidentStatus.KHONG_KHOI_TO,
  IncidentStatus.DA_NHAP_VU_KHAC,
  IncidentStatus.PHAN_LOAI_DAN_SU,
  IncidentStatus.DA_CHUYEN_DON_VI,
  IncidentStatus.CHUYEN_XPHC,
  IncidentStatus.TDC_HET_THOI_HIEU,
  IncidentStatus.TDC_HTH_KHONG_KT,
];

export const TERMINAL_PETITION_STATUSES: PetitionStatus[] = [
  PetitionStatus.DA_GIAI_QUYET,
  PetitionStatus.DA_CHUYEN_VU_VIEC,
  PetitionStatus.DA_CHUYEN_VU_AN,
];

// ── Lý do không khởi tố (Điều 157 BLTTHS 2015) ─────────────────
// Dùng cho FKSelect trong IncidentFormPage.

export const LY_DO_KHONG_KHOI_TO_LABEL: Record<LyDoKhongKhoiTo, string> = {
  [LyDoKhongKhoiTo.KHONG_CO_SU_VIEC]:                 'Không có sự việc phạm tội (Đ.157 khoản 1a)',
  [LyDoKhongKhoiTo.HANH_VI_KHONG_CAU_THANH_TOI_PHAM]: 'Hành vi không cấu thành tội phạm (khoản 1b)',
  [LyDoKhongKhoiTo.NGUOI_THUC_HIEN_CHUA_DU_TUOI]:     'Người thực hiện chưa đủ tuổi TNHS (khoản 1c)',
  [LyDoKhongKhoiTo.NGUOI_PHAM_TOI_CHET]:              'Người phạm tội đã chết (khoản 1d)',
  [LyDoKhongKhoiTo.HET_THOI_HIEU]:                    'Hết thời hiệu truy cứu TNHS (khoản 1đ)',
  [LyDoKhongKhoiTo.TOI_PHAM_DA_DUOC_XOA_AN_TICH]:     'Tội phạm đã được đại xá (khoản 1e)',
  [LyDoKhongKhoiTo.TRUONG_HOP_KHAC]:                  'Trường hợp khác theo quy định BLTTHS (khoản 1g)',
};

export const LY_DO_KHONG_KHOI_TO_OPTIONS = Object.entries(LY_DO_KHONG_KHOI_TO_LABEL).map(
  ([value, label]) => ({ value, label }),
);

// ── LoaiNguonTin (Điều 144 BLTTHS 2015 — 3 căn cứ tiếp nhận nguồn tin) ──
// Hardcoded enum dropdown options (NOT a directory lookup). Pre-v0.30.0.3 this
// field was wired through FKSelect directoryType="TDC_SOURCE" + seed entries
// with codes that did NOT match the Prisma enum — every submission failed
// validation. See plan doc + PR #75 for the regression history.

export const LOAI_NGUON_TIN_LABEL: Record<LoaiNguonTin, string> = {
  [LoaiNguonTin.TO_GIAC]:           'Tố giác của cá nhân (Đ.144 khoản 1a)',
  [LoaiNguonTin.TIN_BAO]:           'Tin báo của cơ quan, tổ chức (Đ.144 khoản 1b)',
  [LoaiNguonTin.KIEN_NGHI_KHOI_TO]: 'Kiến nghị khởi tố (Đ.144 khoản 1c)',
};

export const LOAI_NGUON_TIN_OPTIONS = Object.entries(LOAI_NGUON_TIN_LABEL).map(
  ([value, label]) => ({ value, label }),
);

// ── NguonPhatTin (Đ.144 BLTTHS 2015 — chủ thể chi tiết, cascading từ LoaiNguonTin) ─
// FE+BE single source of truth. Mirror tại
// backend/src/common/validators/nguon-phat-tin-match.validator.ts NGUON_PHAT_TIN_BY_LOAI.
// Keep in sync — drift caught by Test 8 (FE helper unit) + BE validator spec.

export const NGUON_PHAT_TIN_LABEL: Record<NguonPhatTin, string> = {
  [NguonPhatTin.CA_NHAN_TO_GIAC]:           'Cá nhân tố giác',
  [NguonPhatTin.CO_QUAN_NHA_NUOC]:          'Cơ quan nhà nước',
  [NguonPhatTin.TO_CHUC]:                   'Tổ chức (doanh nghiệp, đoàn thể)',
  [NguonPhatTin.CA_NHAN_BAO_TIN]:           'Cá nhân báo tin',
  [NguonPhatTin.PHUONG_TIEN_TRUYEN_THONG]:  'Phương tiện thông tin đại chúng',
  [NguonPhatTin.VIEN_KIEM_SAT]:             'Viện kiểm sát nhân dân',
  [NguonPhatTin.THANH_TRA]:                 'Cơ quan thanh tra',
  [NguonPhatTin.KIEM_TOAN]:                 'Cơ quan kiểm toán',
  [NguonPhatTin.TOA_AN]:                    'Tòa án nhân dân',
  [NguonPhatTin.CO_QUAN_KHAC]:              'Cơ quan nhà nước khác',
};

export const NGUON_PHAT_TIN_BY_LOAI: Record<LoaiNguonTin, NguonPhatTin[]> = {
  [LoaiNguonTin.TO_GIAC]:           [NguonPhatTin.CA_NHAN_TO_GIAC],
  [LoaiNguonTin.TIN_BAO]:           [
    NguonPhatTin.CO_QUAN_NHA_NUOC, NguonPhatTin.TO_CHUC,
    NguonPhatTin.CA_NHAN_BAO_TIN,  NguonPhatTin.PHUONG_TIEN_TRUYEN_THONG,
  ],
  [LoaiNguonTin.KIEN_NGHI_KHOI_TO]: [
    NguonPhatTin.VIEN_KIEM_SAT, NguonPhatTin.THANH_TRA,
    NguonPhatTin.KIEM_TOAN,     NguonPhatTin.TOA_AN,
    NguonPhatTin.CO_QUAN_KHAC,
  ],
};

// Helper for form: returns filtered options based on currently-selected loaiDonVu.
// Accepts plain string (no cast at call site) — internal guard handles invalid/empty.
export function getNguonPhatTinOptions(loaiDonVu: string) {
  if (!loaiDonVu || !(loaiDonVu in NGUON_PHAT_TIN_BY_LOAI)) return [];
  return NGUON_PHAT_TIN_BY_LOAI[loaiDonVu as LoaiNguonTin].map((value) => ({
    value,
    label: NGUON_PHAT_TIN_LABEL[value],
  }));
}

// ── PhuongThucTiepNhan (TT 28/2020/TT-BCA Điều 6 — 5 phương thức) ──────────────

export const PHUONG_THUC_TIEP_NHAN_LABEL: Record<PhuongThucTiepNhan, string> = {
  [PhuongThucTiepNhan.TRUC_TIEP_BANG_LOI]:     'Bằng lời trực tiếp',
  [PhuongThucTiepNhan.TRUC_TIEP_BANG_VAN_BAN]: 'Bằng văn bản trực tiếp',
  [PhuongThucTiepNhan.DIEN_THOAI]:             'Qua điện thoại',
  [PhuongThucTiepNhan.BUU_DIEN]:               'Qua bưu điện / giao liên',
  [PhuongThucTiepNhan.PHUONG_TIEN_DIEN_TU]:    'Qua mạng / email / phương tiện điện tử',
};

export const PHUONG_THUC_TIEP_NHAN_OPTIONS = Object.entries(PHUONG_THUC_TIEP_NHAN_LABEL).map(
  ([value, label]) => ({ value, label }),
);

// ── DeadlineRuleStatus (6 workflow states + migrated-needs-doc virtual state) ──

export const DEADLINE_RULE_STATUS_LABEL: Record<DeadlineRuleStatus, string> = {
  [DeadlineRuleStatus.draft]:       'Bản nháp',
  [DeadlineRuleStatus.submitted]:   'Chờ duyệt',
  [DeadlineRuleStatus.approved]:    'Đã duyệt (chờ hiệu lực)',
  [DeadlineRuleStatus.active]:      'Đang hiệu lực',
  [DeadlineRuleStatus.superseded]:  'Đã thay thế',
  [DeadlineRuleStatus.rejected]:    'Bị từ chối',
};

export const DEADLINE_RULE_STATUS_BADGE_CLASS: Record<DeadlineRuleStatus, string> = {
  [DeadlineRuleStatus.draft]:       'bg-slate-100 text-slate-600',
  [DeadlineRuleStatus.submitted]:   'bg-blue-100 text-blue-700',
  [DeadlineRuleStatus.approved]:    'bg-violet-100 text-violet-700',
  [DeadlineRuleStatus.active]:      'bg-green-100 text-green-700',
  [DeadlineRuleStatus.superseded]:  'bg-slate-100 text-slate-400',
  [DeadlineRuleStatus.rejected]:    'bg-red-100 text-red-700',
};

/** Migration-cleanup virtual sub-status: rule is active but legalBasis is INITIAL_MIGRATION. */
export const MIGRATED_NEEDS_DOC_BADGE_CLASS = 'bg-amber-100 text-amber-700';
export const MIGRATED_NEEDS_DOC_LABEL = 'Cần bổ sung tài liệu';

// 12 deadline rule keys with their Vietnamese display labels
export const DEADLINE_RULE_KEY_LABEL: Record<string, string> = {
  THOI_HAN_XAC_MINH:        'Thời hạn xác minh ban đầu',
  THOI_HAN_GIA_HAN_1:       'Thời hạn gia hạn lần 1',
  THOI_HAN_GIA_HAN_2:       'Thời hạn gia hạn lần 2',
  THOI_HAN_TOI_DA:          'Thời hạn giải quyết tối đa',
  THOI_HAN_PHUC_HOI:        'Thời hạn giải quyết sau phục hồi',
  THOI_HAN_PHAN_LOAI:       'Thời hạn phân loại nguồn tin',
  SO_LAN_GIA_HAN_TOI_DA:    'Số lần gia hạn tối đa',
  THOI_HAN_GUI_QD_VKS:      'Thời hạn gửi QĐ cho VKS',
  THOI_HAN_TO_CAO:          'Thời hạn giải quyết tố cáo',
  THOI_HAN_KHIEU_NAI:       'Thời hạn giải quyết khiếu nại',
  THOI_HAN_KIEN_NGHI:       'Thời hạn xử lý kiến nghị',
  THOI_HAN_PHAN_ANH:        'Thời hạn xử lý phản ánh',
};

export const DEADLINE_RULE_KEY_UNIT: Record<string, string> = {
  THOI_HAN_XAC_MINH:        'ngày',
  THOI_HAN_GIA_HAN_1:       'ngày',
  THOI_HAN_GIA_HAN_2:       'ngày',
  THOI_HAN_TOI_DA:          'ngày',
  THOI_HAN_PHUC_HOI:        'ngày',
  THOI_HAN_PHAN_LOAI:       'ngày',
  SO_LAN_GIA_HAN_TOI_DA:    'lần',
  THOI_HAN_GUI_QD_VKS:      'ngày',
  THOI_HAN_TO_CAO:          'ngày',
  THOI_HAN_KHIEU_NAI:       'ngày',
  THOI_HAN_KIEN_NGHI:       'ngày',
  THOI_HAN_PHAN_ANH:        'ngày',
};
