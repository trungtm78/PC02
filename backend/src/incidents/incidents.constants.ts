import { IncidentStatus } from '@prisma/client';

// 4 BCA workflow phases (TT28/2020/TT-BCA)
export const PHASE_STATUSES: Record<string, IncidentStatus[]> = {
  'tiep-nhan': [IncidentStatus.TIEP_NHAN],
  'xac-minh': [IncidentStatus.DANG_XAC_MINH, IncidentStatus.DA_PHAN_CONG, IncidentStatus.QUA_HAN],
  'ket-qua': [
    IncidentStatus.DA_CHUYEN_VU_AN, IncidentStatus.KHONG_KHOI_TO,
    IncidentStatus.CHUYEN_XPHC, IncidentStatus.PHAN_LOAI_DAN_SU,
    IncidentStatus.DA_CHUYEN_DON_VI, IncidentStatus.DA_NHAP_VU_KHAC,
    IncidentStatus.DA_GIAI_QUYET, // Legacy catch-all terminal
  ],
  'tam-dinh-chi': [
    IncidentStatus.TAM_DINH_CHI, IncidentStatus.PHUC_HOI_NGUON_TIN,
    IncidentStatus.TDC_HET_THOI_HIEU, IncidentStatus.TDC_HTH_KHONG_KT,
  ],
};

export const PHASE_LABELS: Record<string, string> = {
  'tiep-nhan': 'Tiếp nhận & Phân loại',
  'xac-minh': 'Xác minh & Giải quyết',
  'ket-qua': 'Kết quả',
  'tam-dinh-chi': 'Tạm đình chỉ & Phục hồi',
};

// Terminal statuses — exclude from overdue filter
export const TERMINAL_STATUSES: IncidentStatus[] = [
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

// Valid status transitions
export const VALID_TRANSITIONS: Record<string, IncidentStatus[]> = {
  [IncidentStatus.TIEP_NHAN]: [
    IncidentStatus.DANG_XAC_MINH,
    IncidentStatus.DA_PHAN_CONG,
    IncidentStatus.DA_CHUYEN_DON_VI,
    IncidentStatus.PHAN_LOAI_DAN_SU,
  ],
  [IncidentStatus.DANG_XAC_MINH]: [
    IncidentStatus.DA_PHAN_CONG,
    IncidentStatus.KHONG_KHOI_TO,
    IncidentStatus.CHUYEN_XPHC,
    IncidentStatus.TAM_DINH_CHI,
    IncidentStatus.DA_CHUYEN_VU_AN,
    IncidentStatus.DA_CHUYEN_DON_VI,
    IncidentStatus.DA_NHAP_VU_KHAC,
    IncidentStatus.PHAN_LOAI_DAN_SU,
    IncidentStatus.DA_GIAI_QUYET,
  ],
  [IncidentStatus.DA_PHAN_CONG]: [
    IncidentStatus.DANG_XAC_MINH,
    IncidentStatus.KHONG_KHOI_TO,
    IncidentStatus.CHUYEN_XPHC,
    IncidentStatus.TAM_DINH_CHI,
    IncidentStatus.DA_CHUYEN_VU_AN,
    IncidentStatus.DA_GIAI_QUYET,
  ],
  [IncidentStatus.TAM_DINH_CHI]: [
    IncidentStatus.PHUC_HOI_NGUON_TIN,
    IncidentStatus.TDC_HET_THOI_HIEU,
    IncidentStatus.TDC_HTH_KHONG_KT,
  ],
  [IncidentStatus.PHUC_HOI_NGUON_TIN]: [
    IncidentStatus.DANG_XAC_MINH,
    IncidentStatus.DA_PHAN_CONG,
  ],
  [IncidentStatus.QUA_HAN]: [
    IncidentStatus.DANG_XAC_MINH,
    IncidentStatus.DA_PHAN_CONG,
    IncidentStatus.TAM_DINH_CHI,
  ],
  // Terminal statuses have no outgoing transitions
};
