-- v0.29 audit PII backfill scrub
-- Purpose: existing audit_logs rows pre-v0.29 có thể chứa passwordHash, refreshTokenHash,
-- totpSecret, backupCodes, enrollmentTokenHash, etc. trong metadata.before/after.
-- Strip these keys from existing rows. v0.29 application code đã sanitize at write
-- nên rows mới không leak.
--
-- Strategy: rebuild metadata jsonb without PII keys, applied recursively to
-- metadata.before và metadata.after nested objects.
--
-- Idempotent: re-run an toàn vì WHERE clause chỉ match rows còn chứa PII.

UPDATE audit_logs
SET metadata = jsonb_build_object(
  'before', COALESCE((
    SELECT jsonb_object_agg(k, v) FROM jsonb_each(metadata->'before') AS kv(k, v)
    WHERE k !~* '(hash|secret|token|password|backup_?code|recovery|otp_?code|2fa)'
  ), '{}'::jsonb),
  'after', COALESCE((
    SELECT jsonb_object_agg(k, v) FROM jsonb_each(metadata->'after') AS kv(k, v)
    WHERE k !~* '(hash|secret|token|password|backup_?code|recovery|otp_?code|2fa)'
  ), '{}'::jsonb)
) || (
  -- Preserve top-level non-before/after keys (e.g., USER_LOGIN_FAILED uses identifier/shape)
  SELECT COALESCE(jsonb_object_agg(k, v), '{}'::jsonb)
  FROM jsonb_each(metadata) AS kv(k, v)
  WHERE k NOT IN ('before', 'after')
    AND k !~* '(hash|secret|token|password|backup_?code|recovery|otp_?code|2fa)'
)
WHERE metadata IS NOT NULL
  AND jsonb_typeof(metadata) = 'object'
  AND (
    -- Only update rows that actually contain PII (avoid unnecessary writes)
    metadata::text ~* '(passwordhash|refreshtokenhash|totpsecret|enrollmenttokenhash|backupcode|backupcodesalt|recoverycode|twofasecret|magicLinkTokenHash)'
  );

-- Audit the migration itself (meta-audit)
INSERT INTO audit_logs (id, "userId", action, subject, metadata, "createdAt")
VALUES (
  gen_random_uuid()::text,
  NULL,
  'AUDIT_PII_BACKFILL',
  'AuditLog',
  jsonb_build_object(
    'migration', '20260520120000_audit_pii_sanitize_backfill',
    'note', 'Scrubbed pre-v0.29 PII from audit_logs.metadata'
  ),
  NOW()
);
