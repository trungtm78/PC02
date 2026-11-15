import { createListFilterRegistry } from '@/features/_shared/list-filters/registry';
import { alertBandFilterField } from '@/features/processing-flow/alerts/listAlert';

/**
 * v0.63 PR1b — Cases advanced filter fields registration.
 *
 * Mirrors legacy CaseListPage.tsx:460-600 (commit 2cbdd90^):
 *   fromDate, toDate, unit, investigator, charges (Tội danh = crime field).
 *
 * 15/09/2026: các ô lọc CHỮ (Đơn vị, Điều tra viên, Tội danh, STT, STT cũ) chuyển sang ô tìm kiếm
 * dạng thẻ — khoá thẻ khai ở `backend/src/common/tim-kiem/khai/vu-an.khai.ts`. Giữ ô chữ ở đây nữa
 * là hai lối vào một bộ lọc (tiền lệ #233). Đường dẫn cũ `cases_unit=`… vẫn mở ra thẻ tương ứng
 * (`THAM_SO_CU_VU_AN` ở CaseListPageShell). Mặt lọc còn ngày, chọn cán bộ, kỳ thống kê.
 *
 * See docs/audit/shell-parity-matrix.md Cases section.
 */

export interface CaseFilterValue {
  fromDate?: string;
  toDate?: string;
  createdById?: string;
  /** Tạm đổi kỳ thống kê tính theo ngày nào; rỗng = theo cấu hình hệ thống. */
  thongKeTruongNgay?: string;
  /** The alert band of the processing flow; the box is offered only while the server answers alerts. */
  alertBand?: string;
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
  // ── Bổ sung theo bảng lọc hệ cũ (25/08/2026) ─────────────────────────────
  // Khai VÀO ĐÂY chứ không dựng mặt lọc riêng: hai mặt lọc trên một màn hình thì không có
  // cách nào đúng để trả lời "ô nào đang có hiệu lực" — đúng lỗi đã mắc và phải gỡ.
  {
    key: 'createdById',
    label: 'Cán bộ nhập',
    type: 'enumSelect',
    urlKey: 'created_by',
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

// The alert column of the processing flow (PR 11): one more field of THIS registry, not a second filter panel. The page
// hides the box while the server answers no alerts (`<Filters hiddenKeys>`).
cases.register(alertBandFilterField());

export const casesListFilters = cases;
