import { type ReactNode } from 'react';
import {
  Clock,
  CheckCircle,
  PauseCircle,
  XCircle,
  Archive,
  Inbox,
  Search,
  RefreshCw,
  FileSearch,
  Mail,
} from 'lucide-react';
import { CaseStatus, IncidentStatus, PetitionStatus } from './generated';

export function getCaseStatusIcon(status: CaseStatus): ReactNode {
  const map: Partial<Record<CaseStatus, ReactNode>> = {
    [CaseStatus.TIEP_NHAN]: <Inbox className="w-3 h-3" />,
    [CaseStatus.DANG_XAC_MINH]: <Search className="w-3 h-3" />,
    [CaseStatus.DA_XAC_MINH]: <Search className="w-3 h-3" />,
    [CaseStatus.DANG_DIEU_TRA]: <Clock className="w-3 h-3" />,
    [CaseStatus.TAM_DINH_CHI]: <PauseCircle className="w-3 h-3" />,
    [CaseStatus.DINH_CHI]: <XCircle className="w-3 h-3" />,
    [CaseStatus.DA_KET_LUAN]: <CheckCircle className="w-3 h-3" />,
    [CaseStatus.DANG_TRUY_TO]: <RefreshCw className="w-3 h-3" />,
    [CaseStatus.DANG_XET_XU]: <RefreshCw className="w-3 h-3" />,
    [CaseStatus.DA_LUU_TRU]: <Archive className="w-3 h-3" />,
  };
  return map[status] ?? null;
}

export function getIncidentStatusIcon(status: IncidentStatus): ReactNode {
  const map: Partial<Record<IncidentStatus, ReactNode>> = {
    [IncidentStatus.TIEP_NHAN]: <Inbox className="w-3 h-3" />,
    [IncidentStatus.DANG_XAC_MINH]: <Search className="w-3 h-3" />,
    [IncidentStatus.DA_PHAN_CONG]: <Search className="w-3 h-3" />,
    [IncidentStatus.DA_GIAI_QUYET]: <CheckCircle className="w-3 h-3" />,
    [IncidentStatus.TAM_DINH_CHI]: <PauseCircle className="w-3 h-3" />,
    [IncidentStatus.QUA_HAN]: <Clock className="w-3 h-3" />,
    [IncidentStatus.DA_CHUYEN_VU_AN]: <FileSearch className="w-3 h-3" />,
    [IncidentStatus.KHONG_KHOI_TO]: <XCircle className="w-3 h-3" />,
    [IncidentStatus.CHUYEN_XPHC]: <RefreshCw className="w-3 h-3" />,
    [IncidentStatus.TDC_HET_THOI_HIEU]: <PauseCircle className="w-3 h-3" />,
    [IncidentStatus.TDC_HTH_KHONG_KT]: <PauseCircle className="w-3 h-3" />,
    [IncidentStatus.PHUC_HOI_NGUON_TIN]: <RefreshCw className="w-3 h-3" />,
    [IncidentStatus.DA_CHUYEN_DON_VI]: <RefreshCw className="w-3 h-3" />,
    [IncidentStatus.DA_NHAP_VU_KHAC]: <Archive className="w-3 h-3" />,
    [IncidentStatus.PHAN_LOAI_DAN_SU]: <Archive className="w-3 h-3" />,
  };
  return map[status] ?? null;
}

export function getPetitionStatusIcon(status: PetitionStatus): ReactNode {
  const map: Partial<Record<PetitionStatus, ReactNode>> = {
    [PetitionStatus.MOI_TIEP_NHAN]: <Inbox className="w-3 h-3" />,
    [PetitionStatus.DANG_XU_LY]: <RefreshCw className="w-3 h-3" />,
    [PetitionStatus.CHO_PHE_DUYET]: <Clock className="w-3 h-3" />,
    [PetitionStatus.DA_LUU_DON]: <Archive className="w-3 h-3" />,
    [PetitionStatus.DA_GIAI_QUYET]: <CheckCircle className="w-3 h-3" />,
    [PetitionStatus.DA_CHUYEN_VU_VIEC]: <FileSearch className="w-3 h-3" />,
    [PetitionStatus.DA_CHUYEN_VU_AN]: <FileSearch className="w-3 h-3" />,
  };
  return map[status] ?? null;
}

// Re-export for convenience alongside status-labels
export { Mail };
