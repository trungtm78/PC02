import { CaseStatus, IncidentStatus, PetitionStatus, ProposalStatus } from '@prisma/client';

export const CASE_STATUS_LABEL: Record<CaseStatus, string> = {
  [CaseStatus.TIEP_NHAN]: 'Tiếp nhận',
  [CaseStatus.DANG_XAC_MINH]: 'Đang xác minh',
  [CaseStatus.DA_XAC_MINH]: 'Đã xác minh',
  [CaseStatus.DANG_DIEU_TRA]: 'Đang điều tra',
  [CaseStatus.TAM_DINH_CHI]: 'Tạm đình chỉ',
  [CaseStatus.DINH_CHI]: 'Đình chỉ',
  [CaseStatus.DA_KET_LUAN]: 'Đã kết luận',
  [CaseStatus.DANG_TRUY_TO]: 'Đang truy tố',
  [CaseStatus.DANG_XET_XU]: 'Đang xét xử',
  [CaseStatus.DA_LUU_TRU]: 'Đã lưu trữ',
};

export const INCIDENT_STATUS_LABEL: Record<IncidentStatus, string> = {
  [IncidentStatus.TIEP_NHAN]: 'Tiếp nhận',
  [IncidentStatus.DANG_XAC_MINH]: 'Đang xác minh',
  [IncidentStatus.DA_PHAN_CONG]: 'Đã phân công',
  [IncidentStatus.DA_GIAI_QUYET]: 'Đã giải quyết',
  [IncidentStatus.TAM_DINH_CHI]: 'Tạm đình chỉ',
  [IncidentStatus.QUA_HAN]: 'Quá hạn',
  [IncidentStatus.DA_CHUYEN_VU_AN]: 'Đã chuyển vụ án',
  [IncidentStatus.KHONG_KHOI_TO]: 'Không khởi tố',
  [IncidentStatus.CHUYEN_XPHC]: 'Chuyển XPHC',
  [IncidentStatus.TDC_HET_THOI_HIEU]: 'TĐC hết thời hiệu',
  [IncidentStatus.TDC_HTH_KHONG_KT]: 'TĐC không khởi tố',
  [IncidentStatus.PHUC_HOI_NGUON_TIN]: 'Phục hồi nguồn tin',
  [IncidentStatus.DA_CHUYEN_DON_VI]: 'Đã chuyển đơn vị',
  [IncidentStatus.DA_NHAP_VU_KHAC]: 'Đã nhập vụ khác',
  [IncidentStatus.PHAN_LOAI_DAN_SU]: 'Phân loại dân sự',
};

export const PETITION_STATUS_LABEL: Record<PetitionStatus, string> = {
  [PetitionStatus.MOI_TIEP_NHAN]: 'Mới tiếp nhận',
  [PetitionStatus.DANG_XU_LY]: 'Đang xử lý',
  [PetitionStatus.CHO_PHE_DUYET]: 'Chờ phê duyệt',
  [PetitionStatus.DA_LUU_DON]: 'Đã lưu đơn',
  [PetitionStatus.DA_GIAI_QUYET]: 'Đã giải quyết',
  [PetitionStatus.DA_CHUYEN_VU_VIEC]: 'Đã chuyển vụ việc',
  [PetitionStatus.DA_CHUYEN_VU_AN]: 'Đã chuyển vụ án',
};

export const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = {
  [ProposalStatus.CHO_GUI]: 'Chờ gửi',
  [ProposalStatus.DA_GUI]: 'Đã gửi',
  [ProposalStatus.CO_PHAN_HOI]: 'Đã có phản hồi',
  [ProposalStatus.DA_XU_LY]: 'Đã xử lý',
};
