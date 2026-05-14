/**
 * Vietnamese labels for audit log `action` strings.
 *
 * Source of truth: `audit_logs.action` column, populated by backend services
 * (cases, petitions, incidents, auth, etc.). Backend keys grep'd from
 * `backend/src/**\/*.service.ts` action constants.
 *
 * When backend adds a new action constant, append a key here. Missing keys
 * fall back via `getAuditActionLabel` to lowercased+space-replaced text so
 * the activity log keeps rendering legibly until labeled.
 */
export const AUDIT_ACTION_LABEL: Record<string, string> = {
  // Cases
  CASE_CREATED: 'Tạo vụ án',
  CASE_UPDATED: 'Cập nhật vụ án',
  CASE_DELETED: 'Xóa vụ án',
  CASE_ASSIGNED: 'Phân công vụ án',
  CASE_STATUS_CHANGED: 'Đổi trạng thái vụ án',

  // Incidents
  INCIDENT_CREATED: 'Tạo vụ việc',
  INCIDENT_UPDATED: 'Cập nhật vụ việc',
  INCIDENT_DELETED: 'Xóa vụ việc',
  INCIDENT_ASSIGNED: 'Phân công vụ việc',
  INCIDENT_STATUS_CHANGED: 'Đổi trạng thái vụ việc',
  INCIDENT_DEADLINE_EXTENDED: 'Gia hạn thời hạn vụ việc',
  INCIDENT_TRANSFERRED: 'Chuyển vụ việc',
  INCIDENT_MERGED: 'Gộp vụ việc',
  INCIDENT_PROSECUTED: 'Khởi tố vụ việc',

  // Petitions
  PETITION_CREATED: 'Tiếp nhận đơn thư',
  PETITION_AUTO_CREATED: 'Tự động tạo đơn thư',
  PETITION_UPDATED: 'Cập nhật đơn thư',
  PETITION_DELETED: 'Xóa đơn thư',
  PETITION_ASSIGNED: 'Phân công đơn thư',
  PETITION_EXPORTED: 'Xuất đơn thư',
  PETITION_CONVERTED_TO_CASE: 'Chuyển đơn thư thành vụ án',
  PETITION_CONVERTED_TO_INCIDENT: 'Chuyển đơn thư thành vụ việc',

  // Conclusions / Proposals / Investigations
  CONCLUSION_CREATED: 'Tạo kết luận',
  CONCLUSION_UPDATED: 'Cập nhật kết luận',
  CONCLUSION_DELETED: 'Xóa kết luận',
  PROPOSAL_CREATED: 'Tạo đề xuất',
  PROPOSAL_UPDATED: 'Cập nhật đề xuất',
  PROPOSAL_DELETED: 'Xóa đề xuất',
  INVESTIGATION_SUPPLEMENT_CREATED: 'Tạo bổ sung điều tra',
  INVESTIGATION_SUPPLEMENT_DELETED: 'Xóa bổ sung điều tra',

  // Subjects / Documents / Lawyers
  SUBJECT_CREATED: 'Tạo đối tượng',
  SUBJECT_UPDATED: 'Cập nhật đối tượng',
  SUBJECT_DELETED: 'Xóa đối tượng',
  DOCUMENT_CREATED: 'Tạo tài liệu',
  DOCUMENT_UPDATED: 'Cập nhật tài liệu',
  DOCUMENT_DELETED: 'Xóa tài liệu',
  LAWYER_CREATED: 'Tạo luật sư',
  LAWYER_UPDATED: 'Cập nhật luật sư',
  LAWYER_DELETED: 'Xóa luật sư',

  // Workflow (transfer/exchange/delegation/guidance)
  EXCHANGE_CREATED: 'Tạo trao đổi vụ án',
  EXCHANGE_UPDATED: 'Cập nhật trao đổi',
  EXCHANGE_DELETED: 'Xóa trao đổi',
  DELEGATION_CREATED: 'Tạo ủy quyền điều tra',
  DELEGATION_UPDATED: 'Cập nhật ủy quyền',
  DELEGATION_DELETED: 'Xóa ủy quyền',
  GUIDANCE_CREATED: 'Tạo hướng dẫn nghiệp vụ',
  GUIDANCE_UPDATED: 'Cập nhật hướng dẫn',
  GUIDANCE_DELETED: 'Xóa hướng dẫn',

  // Master class
  MASTER_CLASS_CREATED: 'Tạo lớp phân loại',
  MASTER_CLASS_UPDATED: 'Cập nhật lớp phân loại',
  MASTER_CLASS_DELETED: 'Xóa lớp phân loại',

  // Auth
  USER_LOGIN: 'Đăng nhập',
  USER_LOGIN_FAILED: 'Đăng nhập thất bại',
  USER_LOGIN_BLOCKED_PENDING_PASSWORD_CHANGE: 'Đăng nhập bị chặn (chưa đổi mật khẩu)',
  TOKEN_REFRESHED: 'Làm mới phiên đăng nhập',
  PASSWORD_CHANGED: 'Đổi mật khẩu',
  PASSWORD_RESET: 'Đặt lại mật khẩu',
  ADMIN_PASSWORD_RESET: 'Quản trị viên đặt lại mật khẩu',
  FIRST_LOGIN_PASSWORD_CHANGED: 'Đổi mật khẩu lần đầu',

  // Users / roles / teams
  USER_CREATED: 'Tạo người dùng',
  USER_UPDATED: 'Cập nhật người dùng',
  USER_DELETED: 'Xóa người dùng',
  ROLE_PERMISSIONS_UPDATED: 'Cập nhật quyền của vai trò',
  TEAM_CREATED: 'Tạo tổ/đội',
  TEAM_UPDATED: 'Cập nhật tổ/đội',
  TEAM_DELETED: 'Xóa tổ/đội',
  TEAM_MEMBER_ADDED: 'Thêm thành viên tổ/đội',
  TEAM_MEMBER_REMOVED: 'Gỡ thành viên tổ/đội',

  // Data scope
  DATA_GRANT_CREATED: 'Cấp quyền truy cập dữ liệu',
  DATA_GRANT_REVOKED: 'Thu hồi quyền truy cập dữ liệu',

  // Generic CRUD (rarely used directly)
  CREATE: 'Tạo mới',
};

export function getAuditActionLabel(
  action: string | null | undefined,
): string {
  if (!action) return '';
  return AUDIT_ACTION_LABEL[action] ?? action.replace(/_/g, ' ').toLowerCase();
}
