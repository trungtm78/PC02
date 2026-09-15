import { createListFilterRegistry } from '@/features/_shared/list-filters/registry';

/**
 * v0.66 PR4 — Comprehensive advanced filter fields registration.
 *
 * Mirrors legacy ComprehensiveListPage.tsx (commit 2cbdd90^) FilterData interface:
 *   fromDate, toDate, district, status, createdBy, type.
 *
 * Note: `recordType` (CASE/INCIDENT/PETITION) is rendered as separate chips in
 * the shell (not as a filter dropdown), so excluded from this advanced filter
 * registry. Stats fanout already isolates per-type counts.
 *
 * M4 (15/09/2026): ba ô chữ Quận/Huyện, Trạng thái (chung), Người tạo từng khai mà KHÔNG ô nào đi
 * xuống API — cán bộ nhập, danh sách đứng yên. Nay là thẻ của ô tìm kiếm (Đơn vị giải quyết, Trạng
 * thái, Người nhập); đường dẫn cũ `comp_district=`… vẫn mở ra thẻ (`THAM_SO_CU_TONG_HOP`). Hai ô ngày
 * ở lại và nay THẬT SỰ gửi xuống cả ba API.
 *
 * See docs/audit/shell-parity-matrix.md Comprehensive section.
 */

export interface ComprehensiveFilterValue {
  fromDate?: string;
  toDate?: string;
}

const comprehensive = createListFilterRegistry<ComprehensiveFilterValue>();

comprehensive.registerMany([
  {
    key: 'fromDate',
    label: 'Từ ngày',
    type: 'date',
    urlKey: 'from_date',
    testid: 'filter-from-date',
  },
  {
    key: 'toDate',
    label: 'Đến ngày',
    type: 'date',
    urlKey: 'to_date',
    testid: 'filter-to-date',
  },
]);

export const comprehensiveListFilters = comprehensive;
