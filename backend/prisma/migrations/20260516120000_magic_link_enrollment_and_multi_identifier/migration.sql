-- Magic link enrollment + multi-field login (post-/autoplan).
--
-- Plan v2 sau /autoplan review (CEO+Eng+Design+DX subagents): replace Mode B bulk
-- default password (NIST SP 800-63B §5.1.1.1 violation) bằng single-use enrollment
-- token. Multi-field login lookup qua regex disambiguator (chống collision DoS).
--
-- Email nullable cho user T2Đ1 (5/12 có email). workId @unique partial cho login lookup.

-- 1. Email nullable (drop NOT NULL — không lose data, existing rows non-null OK)
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;

-- 2. workId unique partial (allows multiple NULLs — Phó đội trưởng có thể không có workId)
CREATE UNIQUE INDEX "users_workId_key" ON "users"("workId") WHERE "workId" IS NOT NULL;

-- 3. Magic link enrollment fields
ALTER TABLE "users" ADD COLUMN "enrollmentTokenHash" TEXT;
ALTER TABLE "users" ADD COLUMN "enrollmentExpiresAt" TIMESTAMP(3);
CREATE INDEX "users_enrollmentExpiresAt_idx" ON "users"("enrollmentExpiresAt") WHERE "enrollmentExpiresAt" IS NOT NULL;

-- 4. Audit table cho enrollment token lifecycle
CREATE TABLE "enrollment_token_audits" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "generatedBy" TEXT NOT NULL,
  "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "consumedAt" TIMESTAMP(3),
  "consumedIp" TEXT,
  "consumedUa" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "channelHint" TEXT,
  CONSTRAINT "enrollment_token_audits_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "enrollment_token_audits_userId_idx" ON "enrollment_token_audits"("userId");
CREATE INDEX "enrollment_token_audits_expiresAt_idx" ON "enrollment_token_audits"("expiresAt");
ALTER TABLE "enrollment_token_audits" ADD CONSTRAINT "enrollment_token_audits_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "enrollment_token_audits" ADD CONSTRAINT "enrollment_token_audits_generatedBy_fkey"
  FOREIGN KEY ("generatedBy") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
