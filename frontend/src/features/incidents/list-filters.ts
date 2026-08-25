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
  stt?: string;
  sttCu?: string;
  canBoNhapId?: string;
  fromDateRange?: string;
  toDateRange?: string;
  /** Tạm đổi kỳ thống kê tính theo ngày nào; rỗng = theo cấu hình hệ thống. */
  thongKeTruongNgay?: string;
}

const incidents = createListFilterRegistry<IncidentFilterValue>();

incidents.registerMany([
  // ĐÃ GỠ field 'keyword': trùng chức năng với ô tìm kiếm trên thanh công cụ (cùng tra
  // mã/tên), và param `keyword` không có trong QueryIncidentsDto nên đang trả 400.
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
    // Nhãn cũ ghi "Tên hoặc CCCD" là SAI: schema Incident không có cột tên người tố giác
    // (chỉ cmndNguoiToGiac / sdtNguoiToGiac / diaChiNguoiToGiac).
    placeholder: 'CCCD hoặc số điện thoại',
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
    key: 'fromDateRange',
    label: 'Từ ngày',
    type: 'date',
    urlKey: 'from_date',
    testid: 'filter-from-date',
  },
  {
    key: 'toDateRange',
    label: 'Đến ngày',
    type: 'date',
    urlKey: 'to_date',
    testid: 'filter-to-date',
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
    placeholder: 'vd 26-9706',
  },
  {
    key: 'sttCu',
    label: 'STT cũ',
    type: 'text',
    urlKey: 'stt_cu',
    testid: 'filter-stt-cu',
  },
  {
    key: 'canBoNhapId',
    label: 'Cán bộ nhập',
    type: 'enumSelect',
    urlKey: 'can_bo_nhap',
    testid: 'filter-can-bo-nhap',
  },
  {
    key: 'thongKeTruongNgay',
    label: 'Tính theo',
    type: 'enumSelect',
    urlKey: 'tinh_theo',
    testid: 'filter-tinh-theo',
    options: [
      { value: '', label: 'Theo cấu hình hệ thống' },
      { value: 'NGAY_TIEP_NHAN', label: 'Ngày tiếp nhận' },
      { value: 'NGAY_TAO', label: 'Ngày tạo' },
    ],
  },
]);

export const incidentsListFilters = incidents;
