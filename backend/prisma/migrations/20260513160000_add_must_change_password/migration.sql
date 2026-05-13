-- Add force first-login password change fields (D1 + F1).
--
-- mustChangePassword: set true when admin creates a user or resets a password,
-- cleared when user completes /auth/first-login-change-password. Default false
-- so existing users (per D1) are NOT backfilled into the forced-change flow.
--
-- passwordChangedAt: tracks the last successful password change for audit and
-- future rotation policy. NULL for existing users until they next change.

ALTER TABLE "users" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
