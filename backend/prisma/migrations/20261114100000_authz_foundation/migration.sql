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
CREATE TABLE "authz_revision" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "revision" BIGINT NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "authz_revision_pkey" PRIMARY KEY ("id")
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

-- The one row of the revision counter.
INSERT INTO "authz_revision" ("id", "revision") VALUES (1, 0) ON CONFLICT ("id") DO NOTHING;

-- TRIGGER-SECTION: everything below is re-applied by the database spec (the CI scratch schema is built with
-- `prisma db push`, which creates the tables but not triggers).
-- Anything a person's effective permissions are computed from bumps the counter; caches are keyed by it.
CREATE OR REPLACE FUNCTION authz_bump() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO "authz_revision" ("id", "revision", "updatedAt") VALUES (1, 1, now())
  ON CONFLICT ("id") DO UPDATE SET "revision" = "authz_revision"."revision" + 1, "updatedAt" = now();
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS authz_bump ON "user_teams";
CREATE TRIGGER authz_bump AFTER INSERT OR UPDATE OR DELETE ON "user_teams"
  FOR EACH STATEMENT EXECUTE FUNCTION authz_bump();

DROP TRIGGER IF EXISTS authz_bump ON "role_permissions";
CREATE TRIGGER authz_bump AFTER INSERT OR UPDATE OR DELETE ON "role_permissions"
  FOR EACH STATEMENT EXECUTE FUNCTION authz_bump();

DROP TRIGGER IF EXISTS authz_bump ON "data_access_grants";
CREATE TRIGGER authz_bump AFTER INSERT OR UPDATE OR DELETE ON "data_access_grants"
  FOR EACH STATEMENT EXECUTE FUNCTION authz_bump();

DROP TRIGGER IF EXISTS authz_bump ON "permission_templates";
CREATE TRIGGER authz_bump AFTER INSERT OR UPDATE OR DELETE ON "permission_templates"
  FOR EACH STATEMENT EXECUTE FUNCTION authz_bump();

DROP TRIGGER IF EXISTS authz_bump ON "permission_template_entries";
CREATE TRIGGER authz_bump AFTER INSERT OR UPDATE OR DELETE ON "permission_template_entries"
  FOR EACH STATEMENT EXECUTE FUNCTION authz_bump();

DROP TRIGGER IF EXISTS authz_bump ON "team_permission_configs";
CREATE TRIGGER authz_bump AFTER INSERT OR UPDATE OR DELETE ON "team_permission_configs"
  FOR EACH STATEMENT EXECUTE FUNCTION authz_bump();

DROP TRIGGER IF EXISTS authz_bump ON "team_permission_overrides";
CREATE TRIGGER authz_bump AFTER INSERT OR UPDATE OR DELETE ON "team_permission_overrides"
  FOR EACH STATEMENT EXECUTE FUNCTION authz_bump();

DROP TRIGGER IF EXISTS authz_bump ON "user_permission_overrides";
CREATE TRIGGER authz_bump AFTER INSERT OR UPDATE OR DELETE ON "user_permission_overrides"
  FOR EACH STATEMENT EXECUTE FUNCTION authz_bump();

-- Teams: only what changes who belongs under whom, or whether the team counts at all.
DROP TRIGGER IF EXISTS authz_bump ON "teams";
CREATE TRIGGER authz_bump AFTER INSERT OR DELETE OR UPDATE OF "parentId", "status", "isActive", "wardId" ON "teams"
  FOR EACH STATEMENT EXECUTE FUNCTION authz_bump();

-- Users: ONLY the three columns permissions depend on. `lastLoginAt` and `failedLoginAttempts` change at every login;
-- a trigger on the whole row would empty every cache each time anybody signs in.
DROP TRIGGER IF EXISTS authz_bump ON "users";
CREATE TRIGGER authz_bump AFTER UPDATE OF "roleId", "isActive", "canDispatch" ON "users"
  FOR EACH ROW
  WHEN (OLD."roleId" IS DISTINCT FROM NEW."roleId" OR OLD."isActive" IS DISTINCT FROM NEW."isActive"
        OR OLD."canDispatch" IS DISTINCT FROM NEW."canDispatch")
  EXECUTE FUNCTION authz_bump();

-- The mode switch itself (OFF / SHADOW / ENFORCE).
DROP TRIGGER IF EXISTS authz_bump_mode ON "system_settings";
CREATE TRIGGER authz_bump_mode AFTER INSERT OR UPDATE ON "system_settings"
  FOR EACH ROW WHEN (NEW."key" = 'QUYEN_THEO_TO_CHE_DO') EXECUTE FUNCTION authz_bump();
DROP TRIGGER IF EXISTS authz_bump_mode_removed ON "system_settings";
CREATE TRIGGER authz_bump_mode_removed AFTER DELETE ON "system_settings"
  FOR EACH ROW WHEN (OLD."key" = 'QUYEN_THEO_TO_CHE_DO') EXECUTE FUNCTION authz_bump();
