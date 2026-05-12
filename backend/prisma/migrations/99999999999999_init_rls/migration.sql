-- PC02 Case Management: PostgreSQL Row Level Security Skeleton
-- Applied AFTER Prisma creates the tables via `prisma migrate dev`

-- ─────────────────────────────────────────────────────────────────────────────
-- Enable RLS on sensitive tables
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "users"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- App role used by the NestJS backend connection
-- The backend sets: SET LOCAL app.current_user_id = '<id>';
--                   SET LOCAL app.current_user_role = '<role>';
-- ─────────────────────────────────────────────────────────────────────────────

-- Superuser / service role bypasses RLS (used for migrations & seeding)
-- Normal app connections use the "app_user" role enforced by RLS policies.

-- users: each user can only read their own row unless role is ADMIN/SYSTEM
CREATE POLICY users_self_read ON "users"
  FOR SELECT
  USING (
    id = current_setting('app.current_user_id', true)
    OR current_setting('app.current_user_role', true) IN ('ADMIN', 'SYSTEM')
  );

CREATE POLICY users_admin_all ON "users"
  FOR ALL
  USING (
    current_setting('app.current_user_role', true) IN ('ADMIN', 'SYSTEM')
  );

-- audit_logs: admins can read all; regular users can read their own
CREATE POLICY audit_logs_self_read ON "audit_logs"
  FOR SELECT
  USING (
    "userId" = current_setting('app.current_user_id', true)
    OR current_setting('app.current_user_role', true) IN ('ADMIN', 'SYSTEM')
  );

CREATE POLICY audit_logs_insert ON "audit_logs"
  FOR INSERT
  WITH CHECK (true);  -- Any authenticated connection may insert audit logs

-- ─────────────────────────────────────────────────────────────────────────────
-- Force RLS for table owners too (safety net)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE "users"      FORCE ROW LEVEL SECURITY;
ALTER TABLE "audit_logs" FORCE ROW LEVEL SECURITY;
