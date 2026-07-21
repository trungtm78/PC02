import { createListFilterRegistry } from '@/features/_shared/list-filters/registry';

/**
 * v0.65 PR3 — Petitions advanced filter fields registration.
 *
 * Mirrors legacy PetitionListPage.tsx (commit 2cbdd90^):
 *   fromDate, toDate, sender, status (enum), unit.
 *
 * See docs/audit/shell-parity-matrix.md Petitions section.
 */

export interface PetitionFilterValue {
  fromDate?: string;
  toDate?: string;
  sender?: string;
  status?: string;
  unit?: string;
}

const petitions = createListFilterRegistry<PetitionFilterValue>();

petitions.registerMany([
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
    key: 'sender',
    label: 'Người gửi',
    type: 'text',
    urlKey: 'sender',
    testid: 'filter-sender',
    placeholder: 'Tên người gửi đơn',
  },
  // ĐÃ GỠ field 'status'. Nó khai `urlKey:'status'` nên `useListFilters` ghi vào
  // `petitions_status` — ĐÚNG key mà thanh chip đang dùng. Hai control cùng ghi một
  // state, khiến trang gửi kèm param `advancedStatus` không có trong DTO, và
  // `forbidNonWhitelisted` trả 400 → bộ lọc nâng cao gãy.
  // Lọc theo trạng thái nay đã có thanh chip + thẻ thống kê bấm được, nên field này thừa.
  {
    key: 'unit',
    label: 'Đơn vị',
    type: 'text',
    urlKey: 'unit',
    testid: 'filter-unit',
    placeholder: 'PC02, PC03, ...',
  },
]);

export const petitionsListFilters = petitions;
