export const PHASE_STATUSES: Record<string, string[]> = {
  'tiep-nhan': ['TIEP_NHAN'],
  'xac-minh': ['DANG_XAC_MINH', 'DA_PHAN_CONG', 'QUA_HAN'],
  'ket-qua': ['DA_CHUYEN_VU_AN', 'KHONG_KHOI_TO', 'CHUYEN_XPHC', 'PHAN_LOAI_DAN_SU', 'DA_CHUYEN_DON_VI', 'DA_NHAP_VU_KHAC', 'DA_GIAI_QUYET'],
  'tam-dinh-chi': ['TAM_DINH_CHI', 'PHUC_HOI_NGUON_TIN', 'TDC_HET_THOI_HIEU', 'TDC_HTH_KHONG_KT'],
};

export const PHASE_LABELS: Record<string, string> = {
  'tiep-nhan': 'Ti\u1EBFp nh\u1EADn & Ph\u00E2n lo\u1EA1i',
  'xac-minh': 'X\u00E1c minh & Gi\u1EA3i quy\u1EBFt',
  'ket-qua': 'K\u1EBFt qu\u1EA3',
  'tam-dinh-chi': 'T\u1EA1m \u0111\u00ECnh ch\u1EC9 & Ph\u1EE5c h\u1ED3i',
};

export const PHASE_ORDER = ['tiep-nhan', 'xac-minh', 'ket-qua', 'tam-dinh-chi'];

export function getPhaseForStatus(status: string): string | undefined {
  for (const [phase, statuses] of Object.entries(PHASE_STATUSES)) {
    if (statuses.includes(status)) return phase;
  }
  return undefined;
}
