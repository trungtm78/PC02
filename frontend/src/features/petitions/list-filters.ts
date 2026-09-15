import { createListFilterRegistry } from '@/features/_shared/list-filters/registry';

/**
 * v0.65 PR3 — Petitions advanced filter fields registration.
 *
 * Mirrors legacy PetitionListPage.tsx (commit 2cbdd90^): fromDate, toDate, status (enum).
 *
 * 15/09/2026: các ô lọc CHỮ (Người gửi, Đơn vị, STT, STT cũ) chuyển sang ô tìm kiếm dạng thẻ —
 * khoá thẻ khai ở `backend/src/common/tim-kiem/khai/don-thu.khai.ts`. Giữ ô chữ ở đây nữa là hai
 * lối vào một bộ lọc (tiền lệ #233). Đường dẫn cũ `petitions_sender=`… vẫn mở ra thẻ tương ứng
 * (`THAM_SO_CU_DON_THU` ở PetitionListPageShell). Mặt lọc còn ngày, chọn cán bộ, kỳ thống kê.
 *
 * See docs/audit/shell-parity-matrix.md Petitions section.
 */

export interface PetitionFilterValue {
  fromDate?: string;
  toDate?: string;
  status?: string;
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
  // ĐÃ GỠ field 'status'. Nó khai `urlKey:'status'` nên `useListFilters` ghi vào
  // `petitions_status` — ĐÚNG key mà thanh chip đang dùng. Hai control cùng ghi một
  // state, khiến trang gửi kèm param `advancedStatus` không có trong DTO, và
  // `forbidNonWhitelisted` trả 400 → bộ lọc nâng cao gãy.
  // Lọc theo trạng thái nay đã có thanh chip + thẻ thống kê bấm được, nên field này thừa.
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
