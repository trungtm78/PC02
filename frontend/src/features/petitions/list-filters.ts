import { createListFilterRegistry } from '@/features/_shared/list-filters/registry';
import { PetitionStatus } from '@/shared/enums/generated';
import { PETITION_STATUS_LABEL } from '@/shared/enums/status-labels';

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
  {
    key: 'status',
    label: 'Trạng thái',
    type: 'enumSelect',
    urlKey: 'status',
    testid: 'filter-status',
    options: Object.values(PetitionStatus).map((v) => ({
      value: v,
      label: PETITION_STATUS_LABEL[v],
    })),
  },
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
