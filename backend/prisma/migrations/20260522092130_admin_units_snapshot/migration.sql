-- v0.34.0.0: Admin units snapshot pattern + dataset ledger
-- Snapshot pattern UPDATE existing Directory rows in place per import.
-- Existing 30+ query sites unchanged (snapshot wins over bi-temporal).
-- @@unique([type, code]) kept — no historical duplicates needed.

-- ── Directory: add metadata columns (WARD/PROVINCE only — NULL cho type khác) ──
ALTER TABLE "directories" ADD COLUMN "officialCode" TEXT;
ALTER TABLE "directories" ADD COLUMN "sourceVersion" TEXT;
ALTER TABLE "directories" ADD COLUMN "legalBasis" TEXT;
ALTER TABLE "directories" ADD COLUMN "importedAt" TIMESTAMP;

-- ── Dataset ledger (state machine: IMPORTING | ACTIVE | SUPERSEDED | FAILED) ──
CREATE TABLE "admin_unit_dataset_imports" (
  "version"          TEXT      PRIMARY KEY,
  "status"           TEXT      NOT NULL,
  "checksum"         TEXT      NOT NULL,
  "addedProvinces"   INTEGER   NOT NULL DEFAULT 0,
  "addedWards"       INTEGER   NOT NULL DEFAULT 0,
  "updatedWards"     INTEGER   NOT NULL DEFAULT 0,
  "abolishedWards"   INTEGER   NOT NULL DEFAULT 0,
  "importedAt"       TIMESTAMP NOT NULL DEFAULT now(),
  "completedAt"      TIMESTAMP,
  "errorMessage"     TEXT
);

-- Partial unique: chỉ 1 row ACTIVE tại 1 thời điểm (race-safe)
CREATE UNIQUE INDEX "aud_imports_active_unique"
  ON "admin_unit_dataset_imports"("status")
  WHERE "status" = 'ACTIVE';
