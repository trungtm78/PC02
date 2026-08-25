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
  stt?: string;
  sttCu?: string;
  enteredById?: string;
  /** Tạm đổi kỳ thống kê tính theo ngày nào; rỗng = theo cấu hình hệ thống. */
  thongKeTruongNgay?: string;
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
  // ── Bổ sung theo bảng lọc hệ cũ (25/08/2026) ─────────────────────────────
  // Khai VÀO ĐÂY chứ không dựng mặt lọc riêng: hai mặt lọc trên một màn hình thì không có
  // cách nào đúng để trả lời "ô nào đang có hiệu lực" — đúng lỗi đã mắc và phải gỡ.
  {
    key: 'stt',
    label: 'STT',
    type: 'text',
    urlKey: 'stt',
    testid: 'filter-stt',
    placeholder: 'vd 26-11171',
  },
  {
    key: 'sttCu',
    label: 'STT cũ',
    type: 'text',
    urlKey: 'stt_cu',
    testid: 'filter-stt-cu',
  },
  {
    key: 'enteredById',
    label: 'Cán bộ nhập',
    type: 'enumSelect',
    urlKey: 'entered_by',
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

export const petitionsListFilters = petitions;
