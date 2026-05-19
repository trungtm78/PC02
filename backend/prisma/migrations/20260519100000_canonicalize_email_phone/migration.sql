-- v0.27.0.0 Multi-field login canonicalization migration
-- Purpose: ensure existing user data matches new canonical form expected by login flow.
-- Idempotent: re-running không có tác dụng phụ vì WHERE clauses chỉ match rows cần update.

-- Fix 1: Email lowercase + trim. Postgres text @unique là case-sensitive →
-- mixed-case email không thể login bằng lowercase identifier sau khi classifier lowercase.
UPDATE users
SET email = LOWER(TRIM(email))
WHERE email IS NOT NULL
  AND email != LOWER(TRIM(email));

-- Fix 2: Phone canonicalization Vietnam → +84 prefix.
-- Pattern: "0934..." (10-11 digits) → "+84934..."
--          "84934..." (11-12 digits no +) → "+84934..."
--          "+84934..." (already canonical) → no-op
-- Phone field KHÔNG @unique (vợ chồng share) — không lo collision khi update.
-- Strip whitespace/dot/dash trước khi pattern-match.

-- Step A: strip all whitespace, dot, dash separators
UPDATE users
SET phone = REGEXP_REPLACE(phone, '[\s.\-]', '', 'g')
WHERE phone IS NOT NULL
  AND phone ~ '[\s.\-]';

-- Step B: "0XXX..." → "+84XXX..." (Vietnam local format)
UPDATE users
SET phone = '+84' || SUBSTRING(phone FROM 2)
WHERE phone IS NOT NULL
  AND phone ~ '^0[0-9]{8,14}$';

-- Step C: "84XXX..." (no +) → "+84XXX..."
UPDATE users
SET phone = '+' || phone
WHERE phone IS NOT NULL
  AND phone ~ '^84[0-9]{9,13}$';

-- Step D: digits-only foreign numbers without + → prepend +
-- (e.g. "1555..." → "+1555...") — defensive fallback for non-VN phones
UPDATE users
SET phone = '+' || phone
WHERE phone IS NOT NULL
  AND phone ~ '^[0-9]{9,15}$'
  AND phone NOT LIKE '+%';

-- Verification (read-only, for deploy log)
-- SELECT COUNT(*) AS "users_with_email" FROM users WHERE email IS NOT NULL;
-- SELECT COUNT(*) AS "users_with_phone" FROM users WHERE phone IS NOT NULL;
-- SELECT COUNT(*) AS "non_canonical_phone" FROM users
--   WHERE phone IS NOT NULL AND phone NOT LIKE '+%';
