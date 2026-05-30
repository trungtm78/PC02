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
 * See docs/audit/shell-parity-matrix.md Comprehensive section.
 */

export interface ComprehensiveFilterValue {
  fromDate?: string;
  toDate?: string;
  district?: string;
  status?: string;
  createdBy?: string;
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
  {
    key: 'district',
    label: 'Quận/Huyện',
    type: 'text',
    urlKey: 'district',
    testid: 'filter-district',
    placeholder: 'Quận 1, Thủ Đức, ...',
  },
  {
    key: 'status',
    label: 'Trạng thái (chung)',
    type: 'text',
    urlKey: 'status',
    testid: 'filter-status',
    placeholder: 'TIEP_NHAN, DANG_XU_LY, ...',
  },
  {
    key: 'createdBy',
    label: 'Người tạo',
    type: 'text',
    urlKey: 'created_by',
    testid: 'filter-created-by',
    placeholder: 'Tên hoặc username',
  },
]);

export const comprehensiveListFilters = comprehensive;
