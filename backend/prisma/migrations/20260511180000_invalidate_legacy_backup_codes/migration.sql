-- Invalidate sha256-hashed 2FA backup codes. The verification path now uses
-- bcrypt.compare, so legacy entries (64-char hex, no $2 prefix) silently fail
-- and lock users out of the backup-code recovery path. Wipe them so the user
-- regenerates fresh bcrypt-hashed codes via 2FA re-setup.
--
-- Idempotent: only fires when the first stored hash is NOT a bcrypt hash.
-- Re-running on a bcrypt-only table is a no-op.
UPDATE "users"
SET "backupCodes" = ARRAY[]::text[],
    "backupCodeSalts" = ARRAY[]::text[]
WHERE "totpEnabled" = true
  AND COALESCE(array_length("backupCodes", 1), 0) > 0
  AND "backupCodes"[1] NOT LIKE '$2%';
