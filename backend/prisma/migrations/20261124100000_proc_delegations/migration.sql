-- Delegation of a person's processing work to another person for a period (R8). One new table.
CREATE TABLE "proc_delegations" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,

    CONSTRAINT "proc_delegations_pkey" PRIMARY KEY ("id"),
    -- A person does not delegate to themself, and a period does not end before it begins.
    CONSTRAINT "proc_delegations_not_self" CHECK ("fromUserId" <> "toUserId"),
    CONSTRAINT "proc_delegations_period" CHECK ("validTo" >= "validFrom")
);

CREATE INDEX "proc_delegations_toUserId_validFrom_validTo_idx" ON "proc_delegations"("toUserId", "validFrom", "validTo");
CREATE INDEX "proc_delegations_fromUserId_validFrom_validTo_idx" ON "proc_delegations"("fromUserId", "validFrom", "validTo");
