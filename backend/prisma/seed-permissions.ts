/**
 * Permission registry — single source of truth for `permissions` table seed.
 *
 * Every `@RequirePermissions({ action, subject })` decorator in a controller
 * MUST have a matching entry here, otherwise the permission cannot exist in
 * the DB and ALL roles will be blocked (403) — even super-admin, because
 * `ADMIN` is granted permissions via `findMany()` over rows that don't exist.
 *
 * Reference: ISSUE-001 in `.gstack/qa-reports/qa-report-pc02-prod-2026-05-14.md`
 * — `Setting` was missing here, breaking /admin/settings for every role.
 *
 * Consumed by `prisma/seed.ts`. Tested by `src/seed/seed-permissions.spec.ts`.
 *
 * Located in `prisma/` (not `src/`) because the deploy bundle (deploy.yml)
 * ships `backend/prisma/` but NOT `backend/src/` raw TypeScript. Seed runs
 * via `ts-node prisma/seed.ts` on the VM and needs all imports inside the
 * prisma directory to resolve. v0.21.3.0 broke this by importing from
 * `../src/seed/` — fixed in v0.21.4.0 by colocating here.
 */

export interface SeedPermission {
  action: string;
  subject: string;
  description?: string;
}

export const SEED_PERMISSIONS: readonly SeedPermission[] = [
  // ── User CRUD ──────────────────────────────────────────────────────────
  { action: 'read', subject: 'User' },
  { action: 'write', subject: 'User' },
  { action: 'delete', subject: 'User' },

  // ── AuditLog ───────────────────────────────────────────────────────────
  { action: 'read', subject: 'AuditLog' },

  // ── Case CRUD ──────────────────────────────────────────────────────────
  { action: 'read', subject: 'Case' },
  { action: 'write', subject: 'Case' },
  { action: 'edit', subject: 'Case' },
  { action: 'delete', subject: 'Case' },

  // ── Directory ──────────────────────────────────────────────────────────
  { action: 'read', subject: 'Directory' },
  { action: 'write', subject: 'Directory' },
  { action: 'delete', subject: 'Directory' },

  // ── Role / permission management ───────────────────────────────────────
  { action: 'read', subject: 'Role' },
  { action: 'write', subject: 'Role' },
  { action: 'delete', subject: 'Role' },

  // ── Document (TASK-2026-022601) ────────────────────────────────────────
  { action: 'read', subject: 'Document' },
  { action: 'write', subject: 'Document' },
  { action: 'edit', subject: 'Document' },
  { action: 'delete', subject: 'Document' },

  // ── Subject (Bị can / Bị hại / Nhân chứng) ─────────────────────────────
  { action: 'read', subject: 'Subject' },
  { action: 'write', subject: 'Subject' },
  { action: 'edit', subject: 'Subject' },
  { action: 'delete', subject: 'Subject' },

  // ── Petition (Đơn thư) ─────────────────────────────────────────────────
  { action: 'read', subject: 'Petition' },
  { action: 'write', subject: 'Petition' },
  { action: 'edit', subject: 'Petition' },
  { action: 'delete', subject: 'Petition' },

  // ── Incident (Vụ việc) ─────────────────────────────────────────────────
  { action: 'read', subject: 'Incident' },
  { action: 'write', subject: 'Incident' },
  { action: 'edit', subject: 'Incident' },
  { action: 'delete', subject: 'Incident' },

  // ── Lawyer (Luật sư) ───────────────────────────────────────────────────
  { action: 'read', subject: 'Lawyer' },
  { action: 'write', subject: 'Lawyer' },
  { action: 'edit', subject: 'Lawyer' },
  { action: 'delete', subject: 'Lawyer' },

  // ── Team — needed for dispatcher to read teams when assigning ─────────
  { action: 'read', subject: 'Team' },
  { action: 'write', subject: 'Team' },
  { action: 'edit', subject: 'Team' },
  { action: 'delete', subject: 'Team' },

  // ── Report TĐC ────────────────────────────────────────────────────────
  { action: 'read', subject: 'Report', description: 'Xem báo cáo TĐC' },
  { action: 'write', subject: 'Report', description: 'Tạo và điều chỉnh báo cáo TĐC' },
  { action: 'approve', subject: 'Report', description: 'Phê duyệt và khóa báo cáo TĐC' },

  // ── DeadlineRuleVersion — maker/checker workflow for legal deadlines ──
  { action: 'read', subject: 'DeadlineRuleVersion', description: 'Xem quy tắc thời hạn xử lý' },
  { action: 'write', subject: 'DeadlineRuleVersion', description: 'Đề xuất sửa quy tắc thời hạn (maker)' },
  { action: 'approve', subject: 'DeadlineRuleVersion', description: 'Duyệt và kích hoạt quy tắc thời hạn (checker)' },
  { action: 'withdraw_own', subject: 'DeadlineRuleVersion', description: 'Thu hồi đề xuất quy tắc của chính mình (maker)' },
  { action: 'request_changes', subject: 'DeadlineRuleVersion', description: 'Yêu cầu sửa đổi đề xuất quy tắc (checker)' },

  // ── Calendar (PR 1 v0.16.0.0) — replaces 'Case' gate on /calendar/events.
  // PR 2 adds POST/PATCH/DELETE on /calendar-events with these subjects.
  { action: 'read', subject: 'Calendar', description: 'Xem lịch + sự kiện calendar' },
  { action: 'write', subject: 'Calendar', description: 'Tạo sự kiện calendar (PR 2)' },
  { action: 'edit', subject: 'Calendar', description: 'Sửa sự kiện calendar (PR 2)' },
  { action: 'delete', subject: 'Calendar', description: 'Xóa sự kiện calendar (PR 2)' },

  // ── Setting (v0.21.3.0 — fix ISSUE-001) ────────────────────────────────
  // /api/v1/settings GET/PUT/POST. Missing from seed pre-v0.21.3.0 caused
  // /admin/settings to 403 for every role including super-admin.
  { action: 'read', subject: 'Setting', description: 'Xem cấu hình hệ thống (system settings page)' },
  { action: 'write', subject: 'Setting', description: 'Sửa cấu hình hệ thống + seed defaults' },

  // ── LLM provider configuration for scan-image intake (admin only: ADMIN receives every subject but CaseGovernance) ──
  { action: 'read', subject: 'LlmConfig', description: 'Xem cấu hình nhà cung cấp LLM (không bao giờ trả khoá API)' },
  { action: 'write', subject: 'LlmConfig', description: 'Thêm, sửa, kiểm thử, lưu trữ nhà cung cấp LLM và hồ sơ đánh giá chuyển dữ liệu ra nước ngoài' },

  // ── Scan-image intake. ADMIN receives these automatically; other roles are granted by the role screen. ──
  // `sendCloud` is deliberately separate: it allows scans to leave the country (Luật 91/2025).
  { action: 'use', subject: 'OcrImport', description: 'Nhập đơn thư, vụ việc, vụ án từ ảnh scan' },
  { action: 'sendInternal', subject: 'OcrImport', description: 'Cho phép gửi ảnh scan tới máy chủ LLM nội bộ' },
  { action: 'sendCloud', subject: 'OcrImport', description: 'Cho phép gửi ảnh scan tới LLM đám mây (chuyển dữ liệu ra nước ngoài)' },

  { action: 'read', subject: 'OcrQuality', description: 'Xem thống kê chất lượng và chi phí đọc ảnh scan (chỉ số đếm, không có nội dung)' },

  // ── Restore (v0.32.0.0) — khôi phục records đã soft-delete ────────────
  // Gắn duy nhất cho ADMIN qua role-permission mapping (xem grant block below).
  // Missing seed → @RequirePermissions trả 403 cho mọi user kể cả ADMIN.
  { action: 'restore', subject: 'Case', description: 'Khôi phục vụ án đã xóa mềm' },
  { action: 'restore', subject: 'Incident', description: 'Khôi phục vụ việc đã xóa mềm' },
  { action: 'restore', subject: 'Petition', description: 'Khôi phục đơn thư đã xóa mềm' },

  /*
    Xuất ĐẦY ĐỦ mọi trường của đơn thư — quyền RIÊNG, không dùng chung `read`.

    Tệp xuất ra mang 3.335 số CCCD và 2.933 số điện thoại (đo bản sao prod 22/09/2026). Đọc một
    hồ sơ trên màn và rút trọn khối định danh của cả kỳ về máy là hai việc khác hẳn nhau về
    mức rủi ro, nên phải là hai quyền khác nhau.

    Gắn cho ADMIN qua khối grant-all trong `seed.ts`. Vai khác cấp bằng màn quản trị quyền —
    cố ý KHÔNG tự mở rộng cho vai nào đang có `read`.
  */
  { action: 'export_full', subject: 'Petition', description: 'Xuất Excel đầy đủ mọi trường đơn thư (chứa CCCD, số điện thoại)' },

  // ── Edit window reset request review (v0.33.0.0 Phase 5b) ─────────────
  // ADMIN + HEAD_UNIT review reset requests. ADMIN auto-grant via seed.ts ALL block.
  // HEAD_UNIT grant via admin role-permission UI sau (defer per autoplan).
  { action: 'review_reset_request', subject: 'EditWindowResetRequest', description: 'Duyệt/từ chối yêu cầu reset bộ đếm sửa dữ liệu cấp phường' },
  { action: 'read', subject: 'CaseGovernance', description: 'Read governed records' },
  { action: 'read_sensitive', subject: 'CaseGovernance', description: 'Read explicitly classified restricted cases' },
  { action: 'operate', subject: 'CaseGovernance', description: 'Operate case governance' },
  { action: 'review', subject: 'CaseGovernance', description: 'Independently review case governance' },
  { action: 'publish', subject: 'CaseGovernance', description: 'Publish reviewed case governance configuration' },
  { action: 'share', subject: 'CaseGovernance', description: 'Disclose approved case evidence' },
  { action: 'download', subject: 'CaseGovernance', description: 'Download authorized registered evidence' },
  { action: 'manage_access', subject: 'CaseGovernance', description: 'Manage explicit Case principal access profiles' },
  { action: 'custody', subject: 'CaseGovernance', description: 'Record evidence custody' },
  { action: 'dispose', subject: 'CaseGovernance', description: 'Review governed disposition' },

  // ── Dynamic Report Builder (Báo cáo động), D10 ─────────────────────────
  // `read` only opens the sidebar menu group — viewing an actual report
  // requires a DynReportRole (MANAGER/VIEWER) row, independent of system role.
  { action: 'read', subject: 'DynamicReport', description: 'Vào menu Báo cáo động' },
  { action: 'manage', subject: 'DynamicReport', description: 'Thiết lập mẫu, lịch, phân công, xuất bản báo cáo động' },
  { action: 'admin', subject: 'DynamicReport', description: 'Xem toàn bộ (chỉ đọc), huỷ chốt kỳ, miễn nộp — không sửa số liệu hộ' },

  // ── Processing flow and deadlines per information type (the configuration) ──
  // ADMIN receives these through the grant-all block of `seed-quyen.ts`; no other role is given any of them.
  // `publish` and `verify` are separate from `edit` on purpose: drafting a flow, making it the rule records follow, and
  // confirming a legal figure against the source text are three different responsibilities.
  { action: 'read', subject: 'ProcessingFlow', description: 'Xem quy trình xử lý và thời hạn theo loại thông tin' },
  { action: 'create', subject: 'ProcessingFlow', description: 'Tạo quy trình xử lý (bản nháp)' },
  { action: 'edit', subject: 'ProcessingFlow', description: 'Sửa quy trình, các bước của bản nháp, gắn loại thông tin, lưu trữ và khôi phục' },
  { action: 'delete', subject: 'ProcessingFlow', description: 'Xoá quy trình chưa từng ban hành' },
  { action: 'publish', subject: 'ProcessingFlow', description: 'Ban hành một phiên bản quy trình để áp dụng cho hồ sơ' },
  { action: 'verify', subject: 'ProcessingFlow', description: 'Xác nhận căn cứ pháp lý của một bước đã đối chiếu với văn bản gốc' },
  { action: 'read', subject: 'ProcessingCalendar', description: 'Xem lịch làm việc dùng để tính hạn' },
  { action: 'edit', subject: 'ProcessingCalendar', description: 'Sửa, xoá ngày nghỉ và ngày làm bù của một năm' },
  { action: 'confirm', subject: 'ProcessingCalendar', description: 'Xác nhận lịch làm việc của một năm đã đầy đủ, và bỏ xác nhận' },

  // ── Processing flow on a record: the steps of ONE petition, incident or case ──
  // ADMIN receives these through the grant-all block of `seed-quyen.ts`; no other role is given any of them. Holding one
  // opens the route only: the record's own read policy still decides whether the person may see that record at all.
  { action: 'read', subject: 'ProcessingStep', description: 'Xem các bước xử lý, hạn và màu cảnh báo của một hồ sơ' },
  { action: 'assign', subject: 'ProcessingStep', description: 'Áp dụng quy trình cho hồ sơ, xác nhận quy trình đề xuất, ghi ngày thụ lý' },
  { action: 'complete', subject: 'ProcessingStep', description: 'Hoàn thành một bước xử lý không cần lãnh đạo duyệt' },
  { action: 'reopen', subject: 'ProcessingStep', description: 'Mở lại một bước đã hoàn thành' },
  { action: 'adjustDue', subject: 'ProcessingStep', description: 'Đặt hạn xử lý riêng của đơn vị cho một bước (sớm hơn hoặc bằng hạn quy định)' },
  { action: 'extend', subject: 'ProcessingStep', description: 'Gia hạn hạn quy định của một bước, theo số lần quy trình cho phép' },
  { action: 'report', subject: 'ProcessingStep', description: 'Ghi báo cáo tiến độ, kết quả và đề xuất của đơn vị mình ở một bước' },
  { action: 'opine', subject: 'ProcessingStep', description: 'Cho ý kiến ở một bước (tổ trưởng, đơn vị phối hợp, đơn vị kiểm tra)' },
  { action: 'approve', subject: 'ProcessingStep', description: 'Phê duyệt hoặc trả lại kết quả của một bước cần lãnh đạo duyệt' },
  { action: 'skip', subject: 'ProcessingStep', description: 'Bỏ qua một bước (có lý do) và bỏ bỏ qua' },
];
