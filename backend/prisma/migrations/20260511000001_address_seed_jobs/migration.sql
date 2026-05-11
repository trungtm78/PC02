-- AlterTable: extend AddressMapping with provenance + ambiguity tracking
ALTER TABLE "address_mappings"
    ADD COLUMN "source"     TEXT      NOT NULL DEFAULT 'manual',
    ADD COLUMN "seededAt"   TIMESTAMP(3),
    ADD COLUMN "candidates" JSONB;

-- CreateTable: AddressSeedJob — tracks bulk-seed background jobs
CREATE TABLE "address_seed_jobs" (
    "id"           TEXT         NOT NULL,
    "province"     TEXT         NOT NULL,
    "status"       TEXT         NOT NULL,
    "startedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt"  TIMESTAMP(3),
    "totalWards"   INTEGER      NOT NULL DEFAULT 0,
    "mappedCount"  INTEGER      NOT NULL DEFAULT 0,
    "errorCount"   INTEGER      NOT NULL DEFAULT 0,
    "needsReview"  INTEGER      NOT NULL DEFAULT 0,
    "cancelToken"  TEXT,
    "errorLog"     TEXT,
    "triggeredBy"  TEXT         NOT NULL,

    CONSTRAINT "address_seed_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "address_seed_jobs_province_status_idx" ON "address_seed_jobs"("province", "status");
