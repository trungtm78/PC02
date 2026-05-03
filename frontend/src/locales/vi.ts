/**
 * Vietnamese UI labels — single source of truth for UI strings.
 *
 * STATUS LABELS are re-exported from shared/enums rather than duplicated.
 * To migrate a hardcoded label string to use vi.*: import the matching key.
 * To add multi-language support later: replace this file with i18next
 * namespaces using the same key structure — no call sites change.
 *
 * Migration priority: grep for strings that appear ≥3 times, migrate top-down.
 */

// ── Status labels (source: shared/enums — do NOT re-declare here) ────────────
export { PROPOSAL_STATUS_LABEL as proposalStatus } from '@/shared/enums/proposal-status';
export { CONCLUSION_STATUS_LABEL as conclusionStatus } from '@/shared/enums/conclusion-status';
export { REPORT_TDC_STATUS_LABEL as reportTdcStatus } from '@/shared/enums/report-tdc-status';

// ── Error messages ────────────────────────────────────────────────────────────

export const errors = {
  loadFailed: 'Không thể tải dữ liệu. Vui lòng thử lại.',
  saveFailed: 'Không thể lưu. Vui lòng thử lại.',
  deleteFailed: 'Không thể xóa. Vui lòng thử lại.',
  updateFailed: 'Không thể cập nhật. Vui lòng thử lại.',
  unauthorized: 'Bạn không có quyền thực hiện thao tác này.',
  serverError: 'Lỗi máy chủ. Vui lòng thử lại sau.',
  notFound: 'Không tìm thấy dữ liệu.',
  invalidInput: 'Dữ liệu nhập không hợp lệ.',
  popupBlocked: 'Trình duyệt chặn popup. Vui lòng cho phép popup và thử lại.',
  sessionExpired: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
} as const;

export type ErrorKey = keyof typeof errors;

// ── Common UI actions ─────────────────────────────────────────────────────────

export const common = {
  save: 'Lưu',
  cancel: 'Hủy',
  delete: 'Xóa',
  edit: 'Sửa',
  add: 'Thêm mới',
  search: 'Tìm kiếm...',
  loading: 'Đang tải...',
  noData: 'Không có dữ liệu',
  confirm: 'Xác nhận',
  close: 'Đóng',
  retry: 'Thử lại',
  submit: 'Gửi',
  approve: 'Phê duyệt',
  reject: 'Từ chối',
  export: 'Xuất file',
  print: 'In',
  view: 'Xem chi tiết',
  assign: 'Phân công',
} as const;

export type CommonKey = keyof typeof common;

// ── Navigation labels ─────────────────────────────────────────────────────────

export const nav = {
  dashboard: 'Tổng quan',
  cases: 'Quản lý Vụ án',
  incidents: 'Quản lý Vụ việc',
  petitions: 'Quản lý Đơn thư',
  objects: 'Quản lý Đối tượng',
  reports: 'Báo cáo',
  kpi: 'KPI Dashboard',
  calendar: 'Lịch công tác',
  settings: 'Cài đặt hệ thống',
  activityLog: 'Nhật ký hoạt động',
  lawyers: 'Luật sư',
} as const;

export type NavKey = keyof typeof nav;

// ── Form field labels (frequently duplicated) ─────────────────────────────────

export const fields = {
  status: 'Trạng thái',
  deadline: 'Thời hạn',
  investigator: 'Điều tra viên',
  unit: 'Đơn vị',
  notes: 'Ghi chú',
  createdAt: 'Ngày tạo',
  updatedAt: 'Cập nhật lần cuối',
  createdBy: 'Người tạo',
  assignedTo: 'Người phụ trách',
  action: 'Thao tác',
} as const;

export type FieldKey = keyof typeof fields;
