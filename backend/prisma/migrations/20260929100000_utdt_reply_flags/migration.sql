-- Generated flags keep legacy blank and missing JSON values consistent with row status.
ALTER TABLE "cases"
  ADD COLUMN "utdt_has_failure_reason" boolean GENERATED ALWAYS AS (
    length(btrim(coalesce("metadata" ->> 'lyDoKhongThucHienDuoc', ''))) > 0
  ) STORED,
  ADD COLUMN "utdt_has_reply_result" boolean GENERATED ALWAYS AS (
    length(btrim(coalesce("ket_qua_uy_thac", ''))) > 0
  ) STORED;

CREATE INDEX "cases_utdt_reply_flags_idx"
  ON "cases" ("utdt_has_failure_reason", "utdt_has_reply_result", "thoi_han_uy_thac")
  WHERE "case_type" = 'UY_THAC_DIEU_TRA' AND "deletedAt" IS NULL;
