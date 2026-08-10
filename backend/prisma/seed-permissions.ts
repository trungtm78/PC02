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

  // ── Evidence (Vật chứng) ───────────────────────────────────────────────
  { action: 'read', subject: 'Evidence' },
  { action: 'write', subject: 'Evidence' },
  { action: 'edit', subject: 'Evidence' },
  { action: 'delete', subject: 'Evidence' },

  // ── Team — needed for dispatcher to read teams when assigning ─────────
  { action: 'read', subject: 'Team' },
  { action: 'write', subject: 'Team' },
  { action: 'edit', subject: 'Team' },
  { action: 'delete', subject: 'Team' },

  // ── Report TĐC ────────────────────────────────────────────────────────
  { action: 'read', subject: 'Report', description: 'Xem báo cáo TĐC' },
  {
    action: 'write',
    subject: 'Report',
    description: 'Tạo và điều chỉnh báo cáo TĐC',
  },
  {
    action: 'approve',
    subject: 'Report',
    description: 'Phê duyệt và khóa báo cáo TĐC',
  },

  // ── DeadlineRuleVersion — maker/checker workflow for legal deadlines ──
  {
    action: 'read',
    subject: 'DeadlineRuleVersion',
    description: 'Xem quy tắc thời hạn xử lý',
  },
  {
    action: 'write',
    subject: 'DeadlineRuleVersion',
    description: 'Đề xuất sửa quy tắc thời hạn (maker)',
  },
  {
    action: 'approve',
    subject: 'DeadlineRuleVersion',
    description: 'Duyệt và kích hoạt quy tắc thời hạn (checker)',
  },
  {
    action: 'withdraw_own',
    subject: 'DeadlineRuleVersion',
    description: 'Thu hồi đề xuất quy tắc của chính mình (maker)',
  },
  {
    action: 'request_changes',
    subject: 'DeadlineRuleVersion',
    description: 'Yêu cầu sửa đổi đề xuất quy tắc (checker)',
  },

  // ── Calendar (PR 1 v0.16.0.0) — replaces 'Case' gate on /calendar/events.
  // PR 2 adds POST/PATCH/DELETE on /calendar-events with these subjects.
  {
    action: 'read',
    subject: 'Calendar',
    description: 'Xem lịch + sự kiện calendar',
  },
  {
    action: 'write',
    subject: 'Calendar',
    description: 'Tạo sự kiện calendar (PR 2)',
  },
  {
    action: 'edit',
    subject: 'Calendar',
    description: 'Sửa sự kiện calendar (PR 2)',
  },
  {
    action: 'delete',
    subject: 'Calendar',
    description: 'Xóa sự kiện calendar (PR 2)',
  },

  // ── Setting (v0.21.3.0 — fix ISSUE-001) ────────────────────────────────
  // /api/v1/settings GET/PUT/POST. Missing from seed pre-v0.21.3.0 caused
  // /admin/settings to 403 for every role including super-admin.
  {
    action: 'read',
    subject: 'Setting',
    description: 'Xem cấu hình hệ thống (system settings page)',
  },
  {
    action: 'write',
    subject: 'Setting',
    description: 'Sửa cấu hình hệ thống + seed defaults',
  },

  // ── Restore (v0.32.0.0) — khôi phục records đã soft-delete ────────────
  // Gắn duy nhất cho ADMIN qua role-permission mapping (xem grant block below).
  // Missing seed → @RequirePermissions trả 403 cho mọi user kể cả ADMIN.
  {
    action: 'restore',
    subject: 'Case',
    description: 'Khôi phục vụ án đã xóa mềm',
  },
  {
    action: 'restore',
    subject: 'Incident',
    description: 'Khôi phục vụ việc đã xóa mềm',
  },
  {
    action: 'restore',
    subject: 'Petition',
    description: 'Khôi phục đơn thư đã xóa mềm',
  },
  {
    action: 'restore',
    subject: 'Evidence',
    description: 'Khôi phục vật chứng đã xóa mềm',
  },

  // ── Edit window reset request review (v0.33.0.0 Phase 5b) ─────────────
  // ADMIN + HEAD_UNIT review reset requests. ADMIN auto-grant via seed.ts ALL block.
  // HEAD_UNIT grant via admin role-permission UI sau (defer per autoplan).
  {
    action: 'review_reset_request',
    subject: 'EditWindowResetRequest',
    description: 'Duyệt/từ chối yêu cầu reset bộ đếm sửa dữ liệu cấp phường',
  },
];

/**
 * Which non-admin roles a permission belongs to by default.
 *
 * ADMIN is not listed: it gets everything, unconditionally.
 *
 * This exists because `seed.ts` — the only place these grants used to live —
 * never runs on deploy. A PR that adds a permission and grants it to OFFICER in
 * seed.ts ships an endpoint that 403s for every officer in production until
 * somebody notices and clicks through the role-permission UI. Evidence hit
 * exactly that: read and write rows existed, and no officer could use either.
 *
 * `seed-permissions-runner.ts` applies these ONLY to permissions it creates on
 * that run. A permission that already existed is left alone, so an admin who
 * deliberately revoked something in the UI does not get it handed back on the
 * next deploy.
 */
export const DEFAULT_ROLE_GRANTS: Readonly<Record<string, readonly string[]>> =
  {
    OFFICER: [
      // Read: the dispatcher workflow. Mirrors the officerReadPerms block in seed.ts.
      'read:Team',
      'read:User',
      'read:Case',
      'read:Petition',
      'read:Incident',
      'read:DeadlineRuleVersion',
      'read:Calendar',
      'read:Evidence',
      // Write/edit/delete on the officer's own case files. DataScope keeps this
      // inside their team; `restore` stays with ADMIN.
      'write:Case',
      'edit:Case',
      'delete:Case',
      'write:Incident',
      'edit:Incident',
      'delete:Incident',
      'write:Petition',
      'edit:Petition',
      'delete:Petition',
      'write:Evidence',
      'edit:Evidence',
      'delete:Evidence',
    ],
  };

/** `action:subject` key, the shape DEFAULT_ROLE_GRANTS uses. */
export function permissionKey(action: string, subject: string): string {
  return `${action}:${subject}`;
}
