-- Every change of the mode of permissions by team (OFF / SHADOW / ENFORCE), and every request to enforce.
-- Enforcing needs two administrators: one asks (PENDING), another approves (APPLIED). The row keeps who, why, and
-- the fingerprint of the comparison ("who gains and loses what") both of them read.
CREATE TABLE "authz_mode_changes" (
    "id" TEXT NOT NULL,
    "fromMode" TEXT NOT NULL,
    "toMode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "fingerprint" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "authz_mode_changes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "authz_mode_changes_status_idx" ON "authz_mode_changes"("status");
CREATE INDEX "authz_mode_changes_createdAt_idx" ON "authz_mode_changes"("createdAt");

ALTER TABLE "authz_mode_changes"
  ADD CONSTRAINT "authz_mode_changes_modes_check"
    CHECK ("fromMode" IN ('OFF', 'SHADOW', 'ENFORCE') AND "toMode" IN ('OFF', 'SHADOW', 'ENFORCE')),
  ADD CONSTRAINT "authz_mode_changes_status_check"
    CHECK ("status" IN ('PENDING', 'APPLIED', 'WITHDRAWN', 'REJECTED', 'SUPERSEDED'));
