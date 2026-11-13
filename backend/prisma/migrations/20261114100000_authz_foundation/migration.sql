-- Permissions by team: the tables of module `src/authz`. Additions only; `roles` and `role_permissions` are not
-- touched, and nothing reads these tables while the setting QUYEN_THEO_TO_CHE_DO is OFF (the default).

-- CreateEnum
CREATE TYPE "PermissionReach" AS ENUM ('OWN', 'TEAM', 'TEAM_TREE', 'ALL');

-- CreateEnum
CREATE TYPE "PermissionTemplateStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TeamPermissionMode" AS ENUM ('INHERIT', 'EXPLICIT');

-- CreateEnum
CREATE TYPE "TeamPermissionAudience" AS ENUM ('ALL', 'MEMBER', 'LEADER');

-- CreateEnum
CREATE TYPE "PermissionOverrideEffect" AS ENUM ('GRANT', 'MUTE');

-- CreateTable
CREATE TABLE "permission_templates" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "PermissionTemplateStatus" NOT NULL DEFAULT 'ACTIVE',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permission_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_template_entries" (
    "templateId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "reach" "PermissionReach" NOT NULL,

    CONSTRAINT "permission_template_entries_pkey" PRIMARY KEY ("templateId","permissionId")
);

-- CreateTable
CREATE TABLE "team_permission_configs" (
    "teamId" TEXT NOT NULL,
    "mode" "TeamPermissionMode" NOT NULL DEFAULT 'INHERIT',
    "memberTemplateId" TEXT,
    "leaderTemplateId" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_permission_configs_pkey" PRIMARY KEY ("teamId")
);

-- CreateTable
CREATE TABLE "team_permission_overrides" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "audience" "TeamPermissionAudience" NOT NULL DEFAULT 'ALL',
    "effect" "PermissionOverrideEffect" NOT NULL,
    "reach" "PermissionReach",
    "reason" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_permission_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_permission_overrides" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "effect" "PermissionOverrideEffect" NOT NULL,
    "reach" "PermissionReach",
    "reason" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_permission_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_change_sets" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "reason" TEXT,
    "changes" JSONB NOT NULL,
    "revertsId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_change_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authz_changes" (
    "id" BIGSERIAL NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "authz_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "permission_templates_code_key" ON "permission_templates"("code");

-- CreateIndex
CREATE INDEX "permission_templates_status_idx" ON "permission_templates"("status");

-- CreateIndex
CREATE INDEX "team_permission_configs_memberTemplateId_idx" ON "team_permission_configs"("memberTemplateId");

-- CreateIndex
CREATE INDEX "team_permission_configs_leaderTemplateId_idx" ON "team_permission_configs"("leaderTemplateId");

-- CreateIndex
CREATE INDEX "team_permission_overrides_expiresAt_idx" ON "team_permission_overrides"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "team_permission_overrides_teamId_permissionId_audience_key" ON "team_permission_overrides"("teamId", "permissionId", "audience");

-- CreateIndex
CREATE INDEX "user_permission_overrides_expiresAt_idx" ON "user_permission_overrides"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_permission_overrides_userId_permissionId_key" ON "user_permission_overrides"("userId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "permission_change_sets_revertsId_key" ON "permission_change_sets"("revertsId");

-- CreateIndex
CREATE INDEX "permission_change_sets_createdAt_idx" ON "permission_change_sets"("createdAt");

-- CreateIndex
CREATE INDEX "permission_change_sets_actorId_idx" ON "permission_change_sets"("actorId");

-- AddForeignKey
ALTER TABLE "permission_template_entries" ADD CONSTRAINT "permission_template_entries_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "permission_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permission_template_entries" ADD CONSTRAINT "permission_template_entries_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_permission_configs" ADD CONSTRAINT "team_permission_configs_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_permission_configs" ADD CONSTRAINT "team_permission_configs_memberTemplateId_fkey" FOREIGN KEY ("memberTemplateId") REFERENCES "permission_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_permission_configs" ADD CONSTRAINT "team_permission_configs_leaderTemplateId_fkey" FOREIGN KEY ("leaderTemplateId") REFERENCES "permission_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_permission_overrides" ADD CONSTRAINT "team_permission_overrides_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team_permission_configs"("teamId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_permission_overrides" ADD CONSTRAINT "team_permission_overrides_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- TRIGGER-SECTION: everything below is re-applied by the database spec (the CI scratch schema is built with
-- `prisma db push`, which creates the tables but not triggers).
-- Anything a person's effective permissions are computed from leaves one row in "authz_changes"; caches are keyed by
-- the rows a reader can see. An INSERT of a new row never waits for another transaction, so these triggers add no
-- lock order to the writers that fire them (a counter row updated in place would: every writer would queue on it
-- until the others commit).
CREATE OR REPLACE FUNCTION authz_bump() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO "authz_changes" DEFAULT VALUES;
  RETURN NULL;
END $$;

-- The same, for statement triggers that are handed the rows the statement touched ("changed"): a statement that
-- touched none (a cascade with nothing to delete, an update matching no row) is not a change.
CREATE OR REPLACE FUNCTION authz_bump_if_rows() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM changed) THEN
    INSERT INTO "authz_changes" DEFAULT VALUES;
  END IF;
  RETURN NULL;
END $$;

DO $$
DECLARE t text;
BEGIN
  -- Whole-table sources: any row inserted, updated or deleted.
  FOREACH t IN ARRAY ARRAY['user_teams', 'role_permissions', 'data_access_grants', 'permission_templates',
                           'permission_template_entries', 'team_permission_configs', 'team_permission_overrides',
                           'user_permission_overrides'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS authz_bump_upd ON %I', t);
    EXECUTE format('CREATE TRIGGER authz_bump_upd AFTER UPDATE ON %I REFERENCING NEW TABLE AS changed FOR EACH STATEMENT EXECUTE FUNCTION authz_bump_if_rows()', t);
  END LOOP;
  -- Rows appearing or disappearing, for those and for the tables whose updates are watched by column below.
  FOREACH t IN ARRAY ARRAY['user_teams', 'role_permissions', 'data_access_grants', 'permission_templates',
                           'permission_template_entries', 'team_permission_configs', 'team_permission_overrides',
                           'user_permission_overrides', 'teams', 'users', 'roles', 'permissions'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS authz_bump_ins ON %I', t);
    EXECUTE format('CREATE TRIGGER authz_bump_ins AFTER INSERT ON %I REFERENCING NEW TABLE AS changed FOR EACH STATEMENT EXECUTE FUNCTION authz_bump_if_rows()', t);
    EXECUTE format('DROP TRIGGER IF EXISTS authz_bump_del ON %I', t);
    EXECUTE format('CREATE TRIGGER authz_bump_del AFTER DELETE ON %I REFERENCING OLD TABLE AS changed FOR EACH STATEMENT EXECUTE FUNCTION authz_bump_if_rows()', t);
  END LOOP;
END $$;

-- Teams: only what changes who belongs under whom, or whether the team counts at all.
DROP TRIGGER IF EXISTS authz_bump_upd ON "teams";
CREATE TRIGGER authz_bump_upd AFTER UPDATE OF "parentId", "status", "isActive", "wardId" ON "teams"
  FOR EACH ROW
  WHEN (OLD."parentId" IS DISTINCT FROM NEW."parentId" OR OLD."status" IS DISTINCT FROM NEW."status"
        OR OLD."isActive" IS DISTINCT FROM NEW."isActive" OR OLD."wardId" IS DISTINCT FROM NEW."wardId")
  EXECUTE FUNCTION authz_bump();

-- Users: ONLY the three columns permissions depend on. `lastLoginAt` and `failedLoginAttempts` change at every
-- login; a trigger on the whole row would empty every cache at each sign-in.
DROP TRIGGER IF EXISTS authz_bump_upd ON "users";
CREATE TRIGGER authz_bump_upd AFTER UPDATE OF "roleId", "isActive", "canDispatch" ON "users"
  FOR EACH ROW
  WHEN (OLD."roleId" IS DISTINCT FROM NEW."roleId" OR OLD."isActive" IS DISTINCT FROM NEW."isActive"
        OR OLD."canDispatch" IS DISTINCT FROM NEW."canDispatch")
  EXECUTE FUNCTION authz_bump();

-- Roles: the name decides who is ADMIN. Permissions: what a pair IS. Rewriting a row with the same values (the
-- permission seed does, at every deploy) is not a change.
DROP TRIGGER IF EXISTS authz_bump_upd ON "roles";
CREATE TRIGGER authz_bump_upd AFTER UPDATE OF "name" ON "roles"
  FOR EACH ROW WHEN (OLD."name" IS DISTINCT FROM NEW."name") EXECUTE FUNCTION authz_bump();
DROP TRIGGER IF EXISTS authz_bump_upd ON "permissions";
CREATE TRIGGER authz_bump_upd AFTER UPDATE OF "action", "subject" ON "permissions"
  FOR EACH ROW WHEN (OLD."action" IS DISTINCT FROM NEW."action" OR OLD."subject" IS DISTINCT FROM NEW."subject")
  EXECUTE FUNCTION authz_bump();

-- The mode switch itself (OFF / SHADOW / ENFORCE).
DROP TRIGGER IF EXISTS authz_bump_mode ON "system_settings";
CREATE TRIGGER authz_bump_mode AFTER INSERT OR UPDATE ON "system_settings"
  FOR EACH ROW WHEN (NEW."key" = 'QUYEN_THEO_TO_CHE_DO') EXECUTE FUNCTION authz_bump();
DROP TRIGGER IF EXISTS authz_bump_mode_removed ON "system_settings";
CREATE TRIGGER authz_bump_mode_removed AFTER DELETE ON "system_settings"
  FOR EACH ROW WHEN (OLD."key" = 'QUYEN_THEO_TO_CHE_DO') EXECUTE FUNCTION authz_bump();
