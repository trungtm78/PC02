export const PHASE_STATUSES: Record<string, string[]> = {
  'tiep-nhan': ['TIEP_NHAN'],
  'xac-minh': ['DANG_XAC_MINH', 'DA_PHAN_CONG', 'QUA_HAN'],
  'ket-qua': ['DA_CHUYEN_VU_AN', 'KHONG_KHOI_TO', 'CHUYEN_XPHC', 'PHAN_LOAI_DAN_SU', 'DA_CHUYEN_DON_VI', 'DA_NHAP_VU_KHAC', 'DA_GIAI_QUYET'],
  'tam-dinh-chi': ['TAM_DINH_CHI', 'PHUC_HOI_NGUON_TIN', 'TDC_HET_THOI_HIEU', 'TDC_HTH_KHONG_KT'],
};

export const PHASE_LABELS: Record<string, string> = {
  'tiep-nhan': 'Tiếp nhận & Phân loại',
  'xac-minh': 'Xác minh & Giải quyết',
  'ket-qua': 'Kết quả',
  'tam-dinh-chi': 'Tạm đình chỉ & Phục hồi',
};

export const PHASE_ORDER = ['tiep-nhan', 'xac-minh', 'ket-qua', 'tam-dinh-chi'];

export function getPhaseForStatus(status: string): string | undefined {
  for (const [phase, statuses] of Object.entries(PHASE_STATUSES)) {
    if (statuses.includes(status)) return phase;
  }
  return undefined;
}
