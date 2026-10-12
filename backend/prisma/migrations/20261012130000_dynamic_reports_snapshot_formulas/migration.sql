-- OV1/OV10: the official figures of a closed period's formulas, frozen with the snapshot.
-- Additive and nullable: existing snapshots keep NULL (shown as "no formula figures", never recomputed).
ALTER TABLE "dyn_report_snapshots" ADD COLUMN "formulaValues" JSONB;
ALTER TABLE "dyn_report_snapshots" ADD COLUMN "calcEngineVersion" INTEGER;
