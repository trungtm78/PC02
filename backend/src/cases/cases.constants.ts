import { CaseStatus } from '@prisma/client';
import type { StatusGroups } from '../common/status-groups.util';

/**
 * Nhóm trạng thái Vụ án — nguồn DUY NHẤT cho cả bộ lọc drill-down lẫn số đếm trên thẻ
 * thống kê (`/cases/stats` trả `byGroup`). Frontend KHÔNG được chép lại danh sách này.
 *
 * Khớp đúng 4 thẻ đang hiển thị ở màn danh sách Vụ án.
 */
export const CASE_STATUS_GROUPS: StatusGroups<CaseStatus> = {
  // Nhãn thẻ là "Đang điều tra" nhưng gộp cả truy tố + xét xử — giữ nguyên ngữ nghĩa
  // đang chạy, đổi nhóm là đổi con số cán bộ đang quen nhìn.
  'dang-dieu-tra': [
    CaseStatus.TIEP_NHAN,
    CaseStatus.DANG_XAC_MINH,
    CaseStatus.DA_XAC_MINH,
    CaseStatus.DANG_DIEU_TRA,
    CaseStatus.DANG_TRUY_TO,
    CaseStatus.DANG_XET_XU,
  ],
  'da-ket-luan': [CaseStatus.DA_KET_LUAN, CaseStatus.DA_LUU_TRU],
  'dinh-chi': [CaseStatus.DINH_CHI],
  'tam-dinh-chi': [CaseStatus.TAM_DINH_CHI],
};

export const CASE_STATUS_GROUP_KEYS = Object.keys(CASE_STATUS_GROUPS);

/**
 * Số tên bị can hiển thị trên cột "Đối tượng bị can" của bảng danh sách Vụ án.
 *
 * Hệ cũ (/VuAn) in thẳng toàn bộ tên. Hệ mới cắt ở 5 vì bảng dùng bố cục cố định:
 * một hồ sơ nhiều bị can sẽ kéo dòng cao bất thường và đẩy các cột khác lệch nhau.
 * Phần dư hiển thị dạng "+N" — số tổng lấy từ cột `subjectsCount` đã có, không đếm lại.
 */
export const LIST_SUSPECT_NAMES_LIMIT = 5;
