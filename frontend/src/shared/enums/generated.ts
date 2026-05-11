// ──────────────────────────────────────────────────────────────
// AUTO-GENERATED — DO NOT EDIT.
// Source: backend/prisma/schema.prisma
// Run: cd backend && npm run gen:enums
// ──────────────────────────────────────────────────────────────

export const CaseStatus = {
  TIEP_NHAN: 'TIEP_NHAN',
  DANG_XAC_MINH: 'DANG_XAC_MINH',
  DA_XAC_MINH: 'DA_XAC_MINH',
  DANG_DIEU_TRA: 'DANG_DIEU_TRA',
  TAM_DINH_CHI: 'TAM_DINH_CHI',
  DINH_CHI: 'DINH_CHI',
  DA_KET_LUAN: 'DA_KET_LUAN',
  DANG_TRUY_TO: 'DANG_TRUY_TO',
  DANG_XET_XU: 'DANG_XET_XU',
  DA_LUU_TRU: 'DA_LUU_TRU',
} as const;
export type CaseStatus = (typeof CaseStatus)[keyof typeof CaseStatus];

export const IncidentStatus = {
  TIEP_NHAN: 'TIEP_NHAN',
  DANG_XAC_MINH: 'DANG_XAC_MINH',
  DA_PHAN_CONG: 'DA_PHAN_CONG',
  DA_GIAI_QUYET: 'DA_GIAI_QUYET',
  TAM_DINH_CHI: 'TAM_DINH_CHI',
  QUA_HAN: 'QUA_HAN',
  DA_CHUYEN_VU_AN: 'DA_CHUYEN_VU_AN',
  KHONG_KHOI_TO: 'KHONG_KHOI_TO',
  CHUYEN_XPHC: 'CHUYEN_XPHC',
  TDC_HET_THOI_HIEU: 'TDC_HET_THOI_HIEU',
  TDC_HTH_KHONG_KT: 'TDC_HTH_KHONG_KT',
  PHUC_HOI_NGUON_TIN: 'PHUC_HOI_NGUON_TIN',
  DA_CHUYEN_DON_VI: 'DA_CHUYEN_DON_VI',
  DA_NHAP_VU_KHAC: 'DA_NHAP_VU_KHAC',
  PHAN_LOAI_DAN_SU: 'PHAN_LOAI_DAN_SU',
} as const;
export type IncidentStatus = (typeof IncidentStatus)[keyof typeof IncidentStatus];

export const PetitionStatus = {
  MOI_TIEP_NHAN: 'MOI_TIEP_NHAN',
  DANG_XU_LY: 'DANG_XU_LY',
  CHO_PHE_DUYET: 'CHO_PHE_DUYET',
  DA_LUU_DON: 'DA_LUU_DON',
  DA_GIAI_QUYET: 'DA_GIAI_QUYET',
  DA_CHUYEN_VU_VIEC: 'DA_CHUYEN_VU_VIEC',
  DA_CHUYEN_VU_AN: 'DA_CHUYEN_VU_AN',
} as const;
export type PetitionStatus = (typeof PetitionStatus)[keyof typeof PetitionStatus];

export const SubjectType = {
  SUSPECT: 'SUSPECT',
  VICTIM: 'VICTIM',
  WITNESS: 'WITNESS',
} as const;
export type SubjectType = (typeof SubjectType)[keyof typeof SubjectType];

export const SubjectStatus = {
  INVESTIGATING: 'INVESTIGATING',
  DETAINED: 'DETAINED',
  RELEASED: 'RELEASED',
  WANTED: 'WANTED',
} as const;
export type SubjectStatus = (typeof SubjectStatus)[keyof typeof SubjectStatus];

export const ProposalStatus = {
  CHO_GUI: 'CHO_GUI',
  DA_GUI: 'DA_GUI',
  CO_PHAN_HOI: 'CO_PHAN_HOI',
  DA_XU_LY: 'DA_XU_LY',
} as const;
export type ProposalStatus = (typeof ProposalStatus)[keyof typeof ProposalStatus];

export const GuidanceStatus = {
  PENDING: 'PENDING',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type GuidanceStatus = (typeof GuidanceStatus)[keyof typeof GuidanceStatus];

export const ExchangeStatus = {
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  PENDING: 'PENDING',
} as const;
export type ExchangeStatus = (typeof ExchangeStatus)[keyof typeof ExchangeStatus];

export const DelegationStatus = {
  PENDING: 'PENDING',
  RECEIVED: 'RECEIVED',
  COMPLETED: 'COMPLETED',
} as const;
export type DelegationStatus = (typeof DelegationStatus)[keyof typeof DelegationStatus];

export const ConclusionStatus = {
  DU_THAO: 'DU_THAO',
  CHO_DUYET: 'CHO_DUYET',
  DA_DUYET: 'DA_DUYET',
} as const;
export type ConclusionStatus = (typeof ConclusionStatus)[keyof typeof ConclusionStatus];

export const AccessLevel = {
  READ: 'READ',
  WRITE: 'WRITE',
} as const;
export type AccessLevel = (typeof AccessLevel)[keyof typeof AccessLevel];

export const ReportTdcStatus = {
  DRAFT: 'DRAFT',
  REVIEWING: 'REVIEWING',
  REJECTED: 'REJECTED',
  APPROVED: 'APPROVED',
  FINALIZED: 'FINALIZED',
} as const;
export type ReportTdcStatus = (typeof ReportTdcStatus)[keyof typeof ReportTdcStatus];

export const ReportTdcType = {
  VU_AN: 'VU_AN',
  VU_VIEC: 'VU_VIEC',
} as const;
export type ReportTdcType = (typeof ReportTdcType)[keyof typeof ReportTdcType];

export const TienDoKhacPhuc = {
  DANG_THUC_HIEN: 'DANG_THUC_HIEN',
  DAM_BAO: 'DAM_BAO',
  CHAM_TRE: 'CHAM_TRE',
  KHONG_DAT: 'KHONG_DAT',
} as const;
export type TienDoKhacPhuc = (typeof TienDoKhacPhuc)[keyof typeof TienDoKhacPhuc];

export const LyDoKhongKhoiTo = {
  KHONG_CO_SU_VIEC: 'KHONG_CO_SU_VIEC',
  HANH_VI_KHONG_CAU_THANH_TOI_PHAM: 'HANH_VI_KHONG_CAU_THANH_TOI_PHAM',
  NGUOI_THUC_HIEN_CHUA_DU_TUOI: 'NGUOI_THUC_HIEN_CHUA_DU_TUOI',
  NGUOI_PHAM_TOI_CHET: 'NGUOI_PHAM_TOI_CHET',
  HET_THOI_HIEU: 'HET_THOI_HIEU',
  TOI_PHAM_DA_DUOC_XOA_AN_TICH: 'TOI_PHAM_DA_DUOC_XOA_AN_TICH',
  TRUONG_HOP_KHAC: 'TRUONG_HOP_KHAC',
} as const;
export type LyDoKhongKhoiTo = (typeof LyDoKhongKhoiTo)[keyof typeof LyDoKhongKhoiTo];

export const LyDoTamDinhChiVuAn = {
  CHUA_XAC_DINH_BI_CAN: 'CHUA_XAC_DINH_BI_CAN',
  KHONG_BIET_BI_CAN_O_DAU: 'KHONG_BIET_BI_CAN_O_DAU',
  BI_CAN_BENH_TAM_THAN: 'BI_CAN_BENH_TAM_THAN',
  CHUA_CO_KET_QUA_GIAM_DINH: 'CHUA_CO_KET_QUA_GIAM_DINH',
  CHUA_CO_KET_QUA_DINH_GIA: 'CHUA_CO_KET_QUA_DINH_GIA',
  CHUA_CO_KET_QUA_TUONG_TRO: 'CHUA_CO_KET_QUA_TUONG_TRO',
  YEU_CAU_TAI_LIEU_CHUA_CO: 'YEU_CAU_TAI_LIEU_CHUA_CO',
  BAT_KHA_KHANG: 'BAT_KHA_KHANG',
} as const;
export type LyDoTamDinhChiVuAn = (typeof LyDoTamDinhChiVuAn)[keyof typeof LyDoTamDinhChiVuAn];

export const KetQuaPhucHoiVuAn = {
  KET_LUAN_DE_NGHI_TRUY_TO: 'KET_LUAN_DE_NGHI_TRUY_TO',
  DINH_CHI_DIEU_TRA: 'DINH_CHI_DIEU_TRA',
  TAM_DINH_CHI_LAI: 'TAM_DINH_CHI_LAI',
  DANG_DIEU_TRA_XAC_MINH: 'DANG_DIEU_TRA_XAC_MINH',
  CHUYEN_CO_QUAN_DIEU_TRA_KHAC: 'CHUYEN_CO_QUAN_DIEU_TRA_KHAC',
} as const;
export type KetQuaPhucHoiVuAn = (typeof KetQuaPhucHoiVuAn)[keyof typeof KetQuaPhucHoiVuAn];

export const LyDoTamDinhChiVuViec = {
  CHUA_CO_KET_QUA_GIAM_DINH: 'CHUA_CO_KET_QUA_GIAM_DINH',
  CHUA_CO_KET_QUA_DINH_GIA: 'CHUA_CO_KET_QUA_DINH_GIA',
  CHUA_CO_KET_QUA_TUONG_TRO: 'CHUA_CO_KET_QUA_TUONG_TRO',
  YEU_CAU_TAI_LIEU_CHUA_CO: 'YEU_CAU_TAI_LIEU_CHUA_CO',
  BAT_KHA_KHANG: 'BAT_KHA_KHANG',
  CAN_CU_KHAC: 'CAN_CU_KHAC',
} as const;
export type LyDoTamDinhChiVuViec = (typeof LyDoTamDinhChiVuViec)[keyof typeof LyDoTamDinhChiVuViec];

export const KetQuaPhucHoiVuViec = {
  QUYET_DINH_KHOI_TO: 'QUYET_DINH_KHOI_TO',
  QUYET_DINH_KHONG_KHOI_TO: 'QUYET_DINH_KHONG_KHOI_TO',
  TAM_DINH_CHI_LAI: 'TAM_DINH_CHI_LAI',
  DANG_XAC_MINH: 'DANG_XAC_MINH',
  CHUYEN_CO_QUAN_KHAC: 'CHUYEN_CO_QUAN_KHAC',
} as const;
export type KetQuaPhucHoiVuViec = (typeof KetQuaPhucHoiVuViec)[keyof typeof KetQuaPhucHoiVuViec];

export const LoaiDon = {
  TO_CAO: 'TO_CAO',
  KHIEU_NAI: 'KHIEU_NAI',
  KIEN_NGHI: 'KIEN_NGHI',
  PHAN_ANH: 'PHAN_ANH',
} as const;
export type LoaiDon = (typeof LoaiDon)[keyof typeof LoaiDon];

export const LoaiNguonTin = {
  TO_GIAC: 'TO_GIAC',
  TIN_BAO: 'TIN_BAO',
  KIEN_NGHI_KHOI_TO: 'KIEN_NGHI_KHOI_TO',
} as const;
export type LoaiNguonTin = (typeof LoaiNguonTin)[keyof typeof LoaiNguonTin];

export const CapDoToiPham = {
  IT_NGHIEM_TRONG: 'IT_NGHIEM_TRONG',
  NGHIEM_TRONG: 'NGHIEM_TRONG',
  RAT_NGHIEM_TRONG: 'RAT_NGHIEM_TRONG',
  DAC_BIET_NGHIEM_TRONG: 'DAC_BIET_NGHIEM_TRONG',
} as const;
export type CapDoToiPham = (typeof CapDoToiPham)[keyof typeof CapDoToiPham];

export const NotificationType = {
  CASE_STATUS_CHANGED: 'CASE_STATUS_CHANGED',
  CASE_DEADLINE_NEAR: 'CASE_DEADLINE_NEAR',
  CASE_OVERDUE: 'CASE_OVERDUE',
  CASE_ASSIGNED: 'CASE_ASSIGNED',
  PETITION_RECEIVED: 'PETITION_RECEIVED',
  PETITION_DEADLINE_NEAR: 'PETITION_DEADLINE_NEAR',
  PETITION_OVERDUE: 'PETITION_OVERDUE',
  INCIDENT_DEADLINE_NEAR: 'INCIDENT_DEADLINE_NEAR',
  INCIDENT_OVERDUE: 'INCIDENT_OVERDUE',
  DOCUMENT_UPLOADED: 'DOCUMENT_UPLOADED',
  SYSTEM: 'SYSTEM',
  DEADLINE_RULE_SUBMITTED: 'DEADLINE_RULE_SUBMITTED',
  DEADLINE_RULE_APPROVED: 'DEADLINE_RULE_APPROVED',
  DEADLINE_RULE_REJECTED: 'DEADLINE_RULE_REJECTED',
  DEADLINE_RULE_ACTIVATED: 'DEADLINE_RULE_ACTIVATED',
  DEADLINE_RULE_STALE_REVIEW: 'DEADLINE_RULE_STALE_REVIEW',
  DEADLINE_RULE_WITHDRAWN: 'DEADLINE_RULE_WITHDRAWN',
  DEADLINE_RULE_CHANGES_REQUESTED: 'DEADLINE_RULE_CHANGES_REQUESTED',
} as const;
export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const DocumentType = {
  VAN_BAN: 'VAN_BAN',
  HINH_ANH: 'HINH_ANH',
  VIDEO: 'VIDEO',
  AM_THANH: 'AM_THANH',
  KHAC: 'KHAC',
} as const;
export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

export const DeadlineRuleStatus = {
  draft: 'draft',
  submitted: 'submitted',
  approved: 'approved',
  active: 'active',
  superseded: 'superseded',
  rejected: 'rejected',
} as const;
export type DeadlineRuleStatus = (typeof DeadlineRuleStatus)[keyof typeof DeadlineRuleStatus];
