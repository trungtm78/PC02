import { createListFilterRegistry } from '@/features/_shared/list-filters/registry';

/**
 * v0.63 PR1b — Cases advanced filter fields registration.
 *
 * Mirrors legacy CaseListPage.tsx:460-600 (commit 2cbdd90^):
 *   fromDate, toDate, unit, investigator, charges (Tội danh = crime field).
 *
 * See docs/audit/shell-parity-matrix.md Cases section.
 */

export interface CaseFilterValue {
  fromDate?: string;
  toDate?: string;
  unit?: string;
  investigator?: string;
  charges?: string;
  stt?: string;
  sttCu?: string;
  createdById?: string;
}

const cases = createListFilterRegistry<CaseFilterValue>();

cases.registerMany([
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
    key: 'unit',
    label: 'Đơn vị',
    type: 'text',
    urlKey: 'unit',
    testid: 'filter-unit',
    placeholder: 'PC02, PC03, ...',
  },
  {
    key: 'investigator',
    label: 'Điều tra viên',
    type: 'text',
    urlKey: 'investigator',
    testid: 'filter-investigator',
    placeholder: 'Tên hoặc username',
  },
  {
    key: 'charges',
    label: 'Tội danh',
    type: 'text',
    urlKey: 'charges',
    testid: 'filter-charges',
    placeholder: 'Trộm cắp, Cướp giật, ...',
  },
  // ── Bổ sung theo bảng lọc hệ cũ (25/08/2026) ─────────────────────────────
  // Khai VÀO ĐÂY chứ không dựng mặt lọc riêng: hai mặt lọc trên một màn hình thì không có
  // cách nào đúng để trả lời "ô nào đang có hiệu lực" — đúng lỗi đã mắc và phải gỡ.
  {
    key: 'stt',
    label: 'STT',
    type: 'text',
    urlKey: 'stt',
    testid: 'filter-stt',
    placeholder: 'vd 26-9893',
  },
  {
    key: 'sttCu',
    label: 'STT cũ',
    type: 'text',
    urlKey: 'stt_cu',
    testid: 'filter-stt-cu',
  },
  {
    key: 'createdById',
    label: 'Cán bộ nhập',
    type: 'enumSelect',
    urlKey: 'created_by',
    testid: 'filter-can-bo-nhap',
  },
]);

export const casesListFilters = cases;
