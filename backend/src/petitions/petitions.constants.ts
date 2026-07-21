import { PetitionStatus } from '@prisma/client';
import type { StatusGroups } from '../common/status-groups.util';

/**
 * Nhóm trạng thái Đơn thư — nguồn DUY NHẤT cho cả bộ lọc drill-down lẫn số đếm trên thẻ
 * thống kê (`/petitions/stats` trả `byGroup`). Frontend KHÔNG được chép lại danh sách này.
 *
 * Khớp đúng 4 thẻ đang hiển thị ở màn danh sách Đơn thư.
 */
export const PETITION_STATUS_GROUPS: StatusGroups<PetitionStatus> = {
  'moi-tiep-nhan': [PetitionStatus.MOI_TIEP_NHAN],
  'dang-xu-ly': [PetitionStatus.DANG_XU_LY, PetitionStatus.CHO_PHE_DUYET],
  'da-giai-quyet': [
    PetitionStatus.DA_GIAI_QUYET,
    PetitionStatus.DA_CHUYEN_VU_VIEC,
    PetitionStatus.DA_CHUYEN_VU_AN,
  ],
  'da-luu-don': [PetitionStatus.DA_LUU_DON],
};

export const PETITION_STATUS_GROUP_KEYS = Object.keys(PETITION_STATUS_GROUPS);
