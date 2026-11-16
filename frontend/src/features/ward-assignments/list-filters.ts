/**
 * The filter panel of the list "Hồ sơ phân công phường/xã": the first submission day (the period the statistics
 * count by), the ward unit, the kind of file, the kind of assignment, the deadline alert.
 *
 * Not here: the status (the six cards are the status filter; a second control writing the same state is two answers
 * to "which one is in force"), and what is searched as a tag (code, summary, crime, place…).
 */
import { createListFilterRegistry } from '@/features/_shared/list-filters/registry';
import { wardAssignments as L } from '@/locales/wardAssignments.vi';
import { wardAssignmentAlerts as A } from '@/locales/wardAssignmentAlerts.vi';

export interface WardFilterValue {
  fromDate?: string;
  toDate?: string;
  teamId?: string;
  caseType?: string;
  kind?: string;
  alert?: string;
}

const ALL = { value: '', label: L.list.filters.all };

const ward = createListFilterRegistry<WardFilterValue>();

ward.registerMany([
  { key: 'fromDate', label: L.list.filters.fromDate, type: 'date', urlKey: 'from_date', testid: 'filter-from-date' },
  { key: 'toDate', label: L.list.filters.toDate, type: 'date', urlKey: 'to_date', testid: 'filter-to-date' },
  // The options are the units that have a request the person may read: asked of the server (`dynamicOptions`).
  { key: 'teamId', label: L.list.columns.unit, type: 'enumSelect', urlKey: 'don_vi', testid: 'filter-don-vi' },
  {
    key: 'caseType',
    label: L.list.columns.caseType,
    type: 'enumSelect',
    urlKey: 'loai_ho_so',
    testid: 'filter-loai-ho-so',
    options: [ALL, { value: 'INCIDENT', label: L.caseType.INCIDENT }, { value: 'CASE', label: L.caseType.CASE }],
  },
  {
    key: 'kind',
    label: L.list.columns.kind,
    type: 'enumSelect',
    urlKey: 'phan_cong',
    testid: 'filter-phan-cong',
    options: [ALL, { value: 'NEW', label: L.kind.NEW }, { value: 'REASSIGN', label: L.kind.REASSIGN }],
  },
  {
    key: 'alert',
    label: L.list.filters.alert,
    type: 'enumSelect',
    urlKey: 'canh_bao',
    testid: 'filter-canh-bao',
    options: [
      ALL,
      { value: 'YELLOW', label: A.alertFilter.YELLOW },
      { value: 'RED', label: A.alertFilter.RED },
      { value: 'OVERDUE', label: A.alertFilter.OVERDUE },
      { value: 'DONE', label: A.alertFilter.DONE },
      { value: 'NONE', label: A.alertFilter.NONE },
    ],
  },
]);

export const wardListFilters = ward;
