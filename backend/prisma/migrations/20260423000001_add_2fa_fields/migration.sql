-- AlterTable: add 2FA fields to users
ALTER TABLE "users"
  ADD COLUMN "totpSecret"         TEXT,
  ADD COLUMN "totpEnabled"        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "totpSetupPending"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "totpSetupPendingAt" TIMESTAMP(3),
  ADD COLUMN "backupCodes"        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "backupCodeSalts"    TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "lastTotpCode"       TEXT,
  ADD COLUMN "twoFaSetupAt"       TIMESTAMP(3),
  ADD COLUMN "twoFaUsedAt"        TIMESTAMP(3);

-- CreateTable: OTP codes for email 2FA fallback
CREATE TABLE "otp_codes" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "codeHash"  TEXT NOT NULL,
  "salt"      TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt"    TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "otp_codes_userId_idx" ON "otp_codes"("userId");
