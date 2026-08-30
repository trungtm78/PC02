/**
 * Vietnamese labels and badge styles for all entity status enums.
 * Source of truth: Prisma schema (via generated.ts).
 * Used by: ComprehensiveListPage, and any future aggregate or detail view.
 */
import { CaseStatus, IncidentStatus, PetitionStatus, LoaiNguonTin, NguonPhatTin, PhuongThucTiepNhan, DeadlineRuleStatus, LoaiDon, CaseType, LoaiUyThac } from './generated';
import { CATALOG_LEGAL, CATALOG_META } from '@/shared/catalog/catalog.generated';
import { STATUS_PENDING_RESPONSE } from '@/constants/styles';

// ── v0.44 UTDT types ─────────────────────────────────────────────
export type TrangThaiPhanHoi = 'DA_PHAN_HOI' | 'KHONG_THUC_HIEN_DUOC' | 'QUA_HAN' | 'CHUA_PHAN_HOI';

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
  [CaseStatus.DA_CHUYEN_DON_VI]: 'Đã chuyển đơn vị',
  [CaseStatus.DA_NHAP_VU_KHAC]: 'Đã nhập vụ khác',
  [CaseStatus.CHUYEN_XPHC]: 'Chuyển xử phạt hành chính',
};

export const CASE_STATUS_OPTIONS = Object.entries(CASE_STATUS_LABEL).map(([value, label]) => ({ value, label }));

// Short label cho status chips (max 14 chars). Chip width budget per Phase 2
// design: `max-w-[12rem] truncate` trong STATUS_CHIP_BASE — labels dài hơn
// 14 chars sẽ truncate hiển thị "...". Consumer dùng shortLabel cho chip,
// fullLabel cho tooltip.
export const CASE_STATUS_SHORT_LABEL: Record<CaseStatus, string> = {
  [CaseStatus.TIEP_NHAN]:      'Tiếp nhận',
  [CaseStatus.DANG_XAC_MINH]: 'Xác minh',
  [CaseStatus.DA_XAC_MINH]:   'Đã xác minh',
  [CaseStatus.DANG_DIEU_TRA]: 'Điều tra',
  [CaseStatus.TAM_DINH_CHI]:  'Tạm đình chỉ',
  [CaseStatus.DINH_CHI]:      'Đình chỉ',
  [CaseStatus.DA_KET_LUAN]:   'Kết luận',
  [CaseStatus.DANG_TRUY_TO]:  'Truy tố',
  [CaseStatus.DANG_XET_XU]:   'Xét xử',
  [CaseStatus.DA_LUU_TRU]:    'Lưu trữ',
  [CaseStatus.DA_CHUYEN_DON_VI]: 'Chuyển ĐV',
  [CaseStatus.DA_NHAP_VU_KHAC]: 'Nhập vụ khác',
  [CaseStatus.CHUYEN_XPHC]: 'Chuyển XPHC',
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
  [IncidentStatus.DINH_CHI]: 'Đình chỉ',
};

export const INCIDENT_STATUS_SHORT_LABEL: Record<IncidentStatus, string> = {
  [IncidentStatus.TIEP_NHAN]:           'Tiếp nhận',
  [IncidentStatus.DANG_XAC_MINH]:       'Xác minh',
  [IncidentStatus.DA_PHAN_CONG]:        'Phân công',
  [IncidentStatus.DA_GIAI_QUYET]:       'Giải quyết',
  [IncidentStatus.TAM_DINH_CHI]:        'Tạm đình chỉ',
  [IncidentStatus.QUA_HAN]:             'Quá hạn',
  [IncidentStatus.DA_CHUYEN_VU_AN]:     'Chuyển vụ án',
  [IncidentStatus.KHONG_KHOI_TO]:       'Không khởi tố',
  [IncidentStatus.CHUYEN_XPHC]:         'Chuyển XPHC',
  [IncidentStatus.TDC_HET_THOI_HIEU]:  'TĐC hết hạn',
  [IncidentStatus.TDC_HTH_KHONG_KT]:   'TĐC không KT',
  [IncidentStatus.PHUC_HOI_NGUON_TIN]:  'Phục hồi NT',
  [IncidentStatus.DA_CHUYEN_DON_VI]:    'Chuyển ĐV',
  [IncidentStatus.DA_NHAP_VU_KHAC]:     'Nhập vụ khác',
  [IncidentStatus.PHAN_LOAI_DAN_SU]:    'Dân sự',
  [IncidentStatus.DINH_CHI]: 'Đình chỉ',
};

export const PETITION_STATUS_LABEL: Record<PetitionStatus, string> = {
  [PetitionStatus.MOI_TIEP_NHAN]:      'Mới tiếp nhận',
  [PetitionStatus.DANG_XU_LY]:         'Đang xử lý',
  [PetitionStatus.CHO_PHE_DUYET]:      'Chờ phê duyệt',
  [PetitionStatus.DA_LUU_DON]:         'Đã lưu đơn',
  [PetitionStatus.DA_GIAI_QUYET]:      'Đã giải quyết',
  [PetitionStatus.DA_CHUYEN_VU_VIEC]:  'Đã chuyển vụ việc',
  [PetitionStatus.DA_CHUYEN_VU_AN]:    'Đã chuyển vụ án',
  [PetitionStatus.DA_TRA_DON]: 'Đã trả đơn',
  [PetitionStatus.DA_HUONG_DAN]: 'Đã hướng dẫn',
  [PetitionStatus.PHAN_LOAI_DAN_SU]: 'Phân loại dân sự',
  [PetitionStatus.TAM_DINH_CHI]: 'Tạm đình chỉ',
  [PetitionStatus.KHONG_KHOI_TO]: 'Không khởi tố',
  [PetitionStatus.DA_CHUYEN_DON_VI]: 'Đã chuyển đơn vị',
  [PetitionStatus.DA_NHAP_HO_SO_KHAC]: 'Đã nhập hồ sơ khác',
  [PetitionStatus.DINH_CHI]: 'Đình chỉ',
  [PetitionStatus.CHUYEN_XPHC]: 'Chuyển xử phạt hành chính',
};

export const PETITION_STATUS_SHORT_LABEL: Record<PetitionStatus, string> = {
  [PetitionStatus.MOI_TIEP_NHAN]:      'Mới tiếp nhận',
  [PetitionStatus.DANG_XU_LY]:         'Đang xử lý',
  [PetitionStatus.CHO_PHE_DUYET]:      'Chờ duyệt',
  [PetitionStatus.DA_LUU_DON]:         'Lưu đơn',
  [PetitionStatus.DA_GIAI_QUYET]:      'Giải quyết',
  [PetitionStatus.DA_CHUYEN_VU_VIEC]:  'Chuyển vụ việc',
  [PetitionStatus.DA_CHUYEN_VU_AN]:    'Chuyển vụ án',
  [PetitionStatus.DA_TRA_DON]: 'Trả đơn',
  [PetitionStatus.DA_HUONG_DAN]: 'Hướng dẫn',
  [PetitionStatus.PHAN_LOAI_DAN_SU]: 'Dân sự',
  [PetitionStatus.TAM_DINH_CHI]: 'Tạm ĐC',
  [PetitionStatus.KHONG_KHOI_TO]: 'Không KT',
  [PetitionStatus.DA_CHUYEN_DON_VI]: 'Chuyển ĐV',
  [PetitionStatus.DA_NHAP_HO_SO_KHAC]: 'Nhập HS khác',
  [PetitionStatus.DINH_CHI]: 'Đình chỉ',
  [PetitionStatus.CHUYEN_XPHC]: 'Chuyển XPHC',
};

// v0.37.2.4 — single source of truth cho Loại đơn (LoaiDon enum) Vietnamese labels.
// PetitionFormPage uses this for <select> options. Backend DTO validates against
// enum values (TO_CAO/KHIEU_NAI/KIEN_NGHI/PHAN_ANH) — labels here are display-only.
// Derive từ Catalog Registry (nguồn duy nhất). Mọi consumer (petition/incident/case form,
// list-filters) import LOAI_DON_OPTIONS/LABEL từ đây nên đổi 1 chỗ là lan toả.
const _LOAI_DON_CAT = CATALOG_LEGAL.LOAI_DON as readonly { code: string; label: string }[];

export const LOAI_DON_LABEL = Object.fromEntries(
  _LOAI_DON_CAT.map((o) => [o.code, o.label]),
) as Record<LoaiDon, string>;

export const LOAI_DON_OPTIONS: ReadonlyArray<{ value: LoaiDon; label: string }> =
  _LOAI_DON_CAT.map((o) => ({ value: o.code as LoaiDon, label: o.label }));

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
  [CaseStatus.DA_CHUYEN_DON_VI]: BADGE_DONE,
  [CaseStatus.DA_NHAP_VU_KHAC]: BADGE_DONE,
  [CaseStatus.CHUYEN_XPHC]: BADGE_DONE,
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
  [IncidentStatus.DINH_CHI]: BADGE_SUSPENDED,
};

export const PETITION_STATUS_BADGE: Record<PetitionStatus, string> = {
  [PetitionStatus.MOI_TIEP_NHAN]:      BADGE_WAITING,
  [PetitionStatus.DANG_XU_LY]:         BADGE_PROCESSING,
  [PetitionStatus.CHO_PHE_DUYET]:      BADGE_PROCESSING,
  [PetitionStatus.DA_LUU_DON]:         BADGE_SUSPENDED,
  [PetitionStatus.DA_GIAI_QUYET]:      BADGE_DONE,
  [PetitionStatus.DA_CHUYEN_VU_VIEC]:  BADGE_DONE,
  [PetitionStatus.DA_CHUYEN_VU_AN]:    BADGE_DONE,
  [PetitionStatus.DA_TRA_DON]: BADGE_DONE,
  [PetitionStatus.DA_HUONG_DAN]: BADGE_DONE,
  [PetitionStatus.PHAN_LOAI_DAN_SU]: BADGE_DONE,
  [PetitionStatus.TAM_DINH_CHI]: BADGE_SUSPENDED,
  [PetitionStatus.KHONG_KHOI_TO]: BADGE_DONE,
  [PetitionStatus.DA_CHUYEN_DON_VI]: BADGE_DONE,
  [PetitionStatus.DA_NHAP_HO_SO_KHAC]: BADGE_DONE,
  [PetitionStatus.DINH_CHI]: BADGE_SUSPENDED,
  [PetitionStatus.CHUYEN_XPHC]: BADGE_DONE,
};

// ── Status chip options cho <ListPageShell.StatusChips> ──────────
//
// Derive từ existing _LABEL + _SHORT_LABEL records. Order matches
// _LABEL definition (insertion order). Consumer pass trực tiếp:
//   <ListPageShell.StatusChips options={CASE_STATUS_CHIPS} ... />
//
// Counts NOT included — fetch riêng từ /api/v1/{resource}/stats?{filters}
// và merge ở consumer level theo activeFilters scope.

export const CASE_STATUS_CHIPS: ReadonlyArray<{
  value: CaseStatus;
  shortLabel: string;
  label: string;
}> = (Object.keys(CASE_STATUS_LABEL) as CaseStatus[]).map((value) => ({
  value,
  shortLabel: CASE_STATUS_SHORT_LABEL[value],
  label: CASE_STATUS_LABEL[value],
}));

export const INCIDENT_STATUS_CHIPS: ReadonlyArray<{
  value: IncidentStatus;
  shortLabel: string;
  label: string;
}> = (Object.keys(INCIDENT_STATUS_LABEL) as IncidentStatus[]).map((value) => ({
  value,
  shortLabel: INCIDENT_STATUS_SHORT_LABEL[value],
  label: INCIDENT_STATUS_LABEL[value],
}));

export const PETITION_STATUS_CHIPS: ReadonlyArray<{
  value: PetitionStatus;
  shortLabel: string;
  label: string;
}> = (Object.keys(PETITION_STATUS_LABEL) as PetitionStatus[]).map((value) => ({
  value,
  shortLabel: PETITION_STATUS_SHORT_LABEL[value],
  label: PETITION_STATUS_LABEL[value],
}));

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

// Lý do không khởi tố (Đ.157): danh mục LEGAL trong Catalog Registry — FE dùng CatalogSelect
// (LY_DO_KHONG_KHOI_TO_LABEL/OPTIONS cũ đã bỏ vì không còn consumer; nhãn lấy từ catalog.generated).

// ── LoaiNguonTin (Điều 144 BLTTHS 2015 — 3 căn cứ tiếp nhận nguồn tin) ──
// Hardcoded enum dropdown options (NOT a directory lookup). Pre-v0.30.0.3 this
// field was wired through FKSelect directoryType="TDC_SOURCE" + seed entries
// with codes that did NOT match the Prisma enum — every submission failed
// validation. See plan doc + PR #75 for the regression history.

// NGUỒN DUY NHẤT: Catalog Registry (qua catalog.generated). Trước đây map cascade
// được viết tay 2 nơi (FE + BE validator) dễ drift — nay cả hai đọc cùng registry.
const _LOAI_NGUON_TIN_CAT = CATALOG_LEGAL.LOAI_NGUON_TIN as readonly { code: string; label: string }[];
const _NGUON_PHAT_TIN_CAT = CATALOG_LEGAL.NGUON_PHAT_TIN as readonly { code: string; label: string }[];
// Qua `unknown` để gỡ readonly-tuple từ `as const` của catalog.generated (tsc -b strict).
const _NGUON_PHAT_TIN_CASCADE = ((CATALOG_META.NGUON_PHAT_TIN as unknown as {
  cascade?: { map: Record<string, string[]> };
}).cascade?.map ?? {}) as Record<string, string[]>;

export const LOAI_NGUON_TIN_LABEL = Object.fromEntries(
  _LOAI_NGUON_TIN_CAT.map((o) => [o.code, o.label]),
) as Record<LoaiNguonTin, string>;

export const LOAI_NGUON_TIN_OPTIONS = _LOAI_NGUON_TIN_CAT.map((o) => ({ value: o.code, label: o.label }));

export const NGUON_PHAT_TIN_LABEL = Object.fromEntries(
  _NGUON_PHAT_TIN_CAT.map((o) => [o.code, o.label]),
) as Record<NguonPhatTin, string>;

export const NGUON_PHAT_TIN_BY_LOAI = _NGUON_PHAT_TIN_CASCADE as Record<LoaiNguonTin, NguonPhatTin[]>;

// Helper for form: returns filtered options based on currently-selected loaiDonVu.
// Accepts plain string (no cast at call site) — internal guard handles invalid/empty.
export function getNguonPhatTinOptions(loaiDonVu: string) {
  const allowed = (_NGUON_PHAT_TIN_CASCADE as Record<string, string[]>)[loaiDonVu] ?? [];
  return allowed.map((value) => ({
    value,
    label: NGUON_PHAT_TIN_LABEL[value as NguonPhatTin] ?? value,
  }));
}

// ── PhuongThucTiepNhan (TT 28/2020/TT-BCA Điều 6 — 5 phương thức) ──────────────

// Derive từ Catalog Registry (nguồn duy nhất) — xem [[catalog-registry]].
const _PHUONG_THUC_TIEP_NHAN_CAT = CATALOG_LEGAL.PHUONG_THUC_TIEP_NHAN as readonly { code: string; label: string }[];

export const PHUONG_THUC_TIEP_NHAN_LABEL = Object.fromEntries(
  _PHUONG_THUC_TIEP_NHAN_CAT.map((o) => [o.code, o.label]),
) as Record<PhuongThucTiepNhan, string>;

export const PHUONG_THUC_TIEP_NHAN_OPTIONS = _PHUONG_THUC_TIEP_NHAN_CAT.map((o) => ({
  value: o.code,
  label: o.label,
}));

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

// ── v0.44 UTDT — TrangThaiPhanHoi (4 states, computed) ──────────────────────

export const TRANG_THAI_PHAN_HOI_LABEL: Record<TrangThaiPhanHoi, string> = {
  DA_PHAN_HOI:          'Đã phản hồi',
  KHONG_THUC_HIEN_DUOC: 'Không thực hiện được',
  QUA_HAN:              'Quá hạn',
  CHUA_PHAN_HOI:        'Chưa phản hồi',
};

export const TRANG_THAI_PHAN_HOI_BADGE: Record<TrangThaiPhanHoi, string> = {
  DA_PHAN_HOI:          'text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700',
  KHONG_THUC_HIEN_DUOC: 'text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700',
  QUA_HAN:              'text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700',
  CHUA_PHAN_HOI:        `text-xs px-1.5 py-0.5 rounded ${STATUS_PENDING_RESPONSE}`,
};

export const TRANG_THAI_PHAN_HOI_OPTIONS: ReadonlyArray<{ value: TrangThaiPhanHoi; label: string }> = [
  { value: 'DA_PHAN_HOI',          label: TRANG_THAI_PHAN_HOI_LABEL.DA_PHAN_HOI },
  { value: 'KHONG_THUC_HIEN_DUOC', label: TRANG_THAI_PHAN_HOI_LABEL.KHONG_THUC_HIEN_DUOC },
  { value: 'QUA_HAN',              label: TRANG_THAI_PHAN_HOI_LABEL.QUA_HAN },
  { value: 'CHUA_PHAN_HOI',        label: TRANG_THAI_PHAN_HOI_LABEL.CHUA_PHAN_HOI },
];

// PR3 — chip shape (value + shortLabel + label) cho ListPageShell.StatusChips
export const TRANG_THAI_PHAN_HOI_CHIPS: ReadonlyArray<{
  value: TrangThaiPhanHoi;
  shortLabel: string;
  label: string;
}> = TRANG_THAI_PHAN_HOI_OPTIONS.map((opt) => ({
  value: opt.value,
  shortLabel: opt.label,
  label: opt.label,
}));

// ── v0.44 UTDT — LoaiUyThac ───────────────────────────────────────

// Derive từ Catalog Registry (nguồn duy nhất).
const _LOAI_UY_THAC_CAT = CATALOG_LEGAL.LOAI_UY_THAC as readonly { code: string; label: string }[];

export const LOAI_UY_THAC_LABEL = Object.fromEntries(
  _LOAI_UY_THAC_CAT.map((o) => [o.code, o.label]),
) as Record<LoaiUyThac, string>;

export const LOAI_UY_THAC_BADGE: Record<LoaiUyThac, string> = {
  [LoaiUyThac.UY_THAC_DIEU_TRA]:     'text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700',
  [LoaiUyThac.CHUYEN_DON_NGUON_TIN]: 'text-xs px-1.5 py-0.5 rounded bg-violet-100 text-violet-700',
  [LoaiUyThac.UY_THAC_GIAI_QUYET]:   'text-xs px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700',
};

export const LOAI_UY_THAC_OPTIONS: ReadonlyArray<{ value: LoaiUyThac; label: string }> =
  _LOAI_UY_THAC_CAT.map((o) => ({ value: o.code as LoaiUyThac, label: o.label }));

// ── v0.44 UTDT — CaseType ────────────────────────────────────────

export const CASE_TYPE_LABEL = Object.fromEntries(
  (CATALOG_LEGAL.CASE_TYPE as readonly { code: string; label: string }[]).map((o) => [o.code, o.label]),
) as Record<CaseType, string>;

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
