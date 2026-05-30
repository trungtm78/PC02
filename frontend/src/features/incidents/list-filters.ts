import { createListFilterRegistry } from '@/features/_shared/list-filters/registry';

/**
 * v0.64 PR2 — Incidents advanced filter fields registration.
 *
 * Mirrors legacy IncidentListPage.tsx (commit 2cbdd90^):
 *   keyword, loaiDonVu (TO_GIAC | TIN_BAO | KIEN_NGHI_KHOI_TO), reporter, đơn vị.
 *
 * Phase tabs (Tiếp nhận / Xác minh / Kết quả / Tạm đình chỉ) handled by shell
 * separately via existing phaseFilter URL state.
 *
 * See docs/audit/shell-parity-matrix.md Incidents section.
 */

export interface IncidentFilterValue {
  keyword?: string;
  loaiDonVu?: string;
  reporter?: string;
  unit?: string;
}

const incidents = createListFilterRegistry<IncidentFilterValue>();

incidents.registerMany([
  {
    key: 'keyword',
    label: 'Từ khóa',
    type: 'text',
    urlKey: 'keyword',
    testid: 'filter-keyword',
    placeholder: 'Mã, tên, mô tả...',
  },
  {
    key: 'loaiDonVu',
    label: 'Loại nguồn tin',
    type: 'enumSelect',
    urlKey: 'loai_don_vu',
    testid: 'filter-loai-don-vu',
    options: [
      { value: 'TO_GIAC', label: 'Tố giác' },
      { value: 'TIN_BAO', label: 'Tin báo' },
      { value: 'KIEN_NGHI_KHOI_TO', label: 'Kiến nghị khởi tố' },
    ],
  },
  {
    key: 'reporter',
    label: 'Người tố giác/báo tin',
    type: 'text',
    urlKey: 'reporter',
    testid: 'filter-reporter',
    placeholder: 'Tên hoặc CCCD',
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

export const incidentsListFilters = incidents;
