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
export { ROLE_LABEL as roles, getRoleLabel } from '@/shared/enums/role-labels';
export {
  AUDIT_ACTION_LABEL as auditActions,
  getAuditActionLabel,
} from '@/shared/enums/audit-action-labels';

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

// ── First-login forced password change (D1) ──────────────────────────────────

export const firstLoginPasswordChange = {
  title: 'Đổi mật khẩu lần đầu',
  hint: 'Anh/chị phải đổi mật khẩu trước khi sử dụng hệ thống. Mật khẩu tạm thời chỉ dùng để đăng nhập lần đầu — vui lòng đặt mật khẩu mới của riêng anh/chị. Quản trị viên không thể xem mật khẩu mới.',
  newPasswordLabel: 'Mật khẩu mới',
  confirmPasswordLabel: 'Nhập lại mật khẩu mới',
  submitButton: 'Đổi mật khẩu và vào hệ thống',
  submitting: 'Đang đổi mật khẩu...',
  successMessage: 'Đổi mật khẩu thành công. Đang chuyển vào hệ thống sau 3 giây...',
  errorWeak: 'Mật khẩu chưa đủ mạnh, vui lòng kiểm tra danh sách yêu cầu bên trên.',
  errorSameAsTemp: 'Mật khẩu mới không được trùng mật khẩu tạm thời.',
  errorMismatch: 'Hai mật khẩu chưa trùng nhau.',
  errorTokenExpired: 'Phiên đổi mật khẩu đã hết hạn. Vui lòng đăng nhập lại.',
  errorNetwork: 'Không kết nối được máy chủ. Mật khẩu chưa được đổi, vui lòng thử lại.',
  countdownLabel: (minutes: number) => `Phiên đổi mật khẩu hết hạn sau ${minutes} phút.`,
  countdownExpiringSoon: (minutes: number) => `Còn ${minutes} phút trước khi phiên hết hạn — vui lòng hoàn tất.`,
  showPassword: 'Hiện mật khẩu mới',
  hidePassword: 'Ẩn mật khẩu mới',
  showConfirmPassword: 'Hiện xác nhận mật khẩu',
  hideConfirmPassword: 'Ẩn xác nhận mật khẩu',
} as const;

// ── Admin temp password handover modal (F1) ──────────────────────────────────

export const tempPasswordHandover = {
  title: 'Mật khẩu tạm thời',
  warning:
    '⚠ Mật khẩu này chỉ hiển thị MỘT LẦN. Sau khi đóng, hệ thống không thể xem lại — anh/chị phải reset lại nếu mất.',
  userLabel: 'Cán bộ',
  copyButton: 'Sao chép mật khẩu',
  copySuccess: '✓ Đã sao chép mật khẩu tạm thời.',
  copyFallback:
    'Trình duyệt không hỗ trợ tự động sao chép. Vui lòng bôi đen mật khẩu bên trên và nhấn Ctrl+C.',
  acknowledgeCheckbox:
    'Tôi đã bàn giao mật khẩu cho cán bộ và hiểu rằng mật khẩu sẽ không hiển thị lại.',
  closeButton: 'Đóng',
  passwordLabel: 'Mật khẩu',
} as const;

// ── Mobile app download (LoginPage section) ──────────────────────────────────

export const mobileDownload = {
  sectionTitle: 'Tải ứng dụng di động',
  androidLabel: 'Android',
  androidDownloadLink: 'Tải APK trực tiếp',
  iosLabel: 'iOS',
  // No "Sắp ra mắt" / "Đang phát triển" status captions — placeholder visuals
  // (dashed border + brand logo / striped overlay) communicate disabled state.
  // Screen readers receive explicit context via placeholderAriaLabel below.
  qrAriaLabel: (platform: string) => `Mã QR tải ứng dụng ${platform}`,
  placeholderAriaLabel: (platform: string) =>
    `Ứng dụng ${platform} chưa sẵn sàng`,
  qrErrorFallback: (url: string) => `Truy cập trực tiếp: ${url}`,
} as const;
