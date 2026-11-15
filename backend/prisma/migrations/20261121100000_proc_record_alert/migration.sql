-- The alert of a record, stored on its flow, and the way from a flow to its record.
--
--   alertDueAt / alertRedFrom / alertYellowFrom / alertGreenFrom
--       the EARLIEST of each instant over the steps being worked (OPEN or REPORTED). NULL while the clock of the record
--       stands still, when no step counts, and once the record is finished or gone. The three lists filter and sort by
--       them with an index; nothing is computed per row.
--   petitionId / incidentId / caseId
--       "recordId" again, in the one column of the record's kind, as a real foreign key: a query can go from a record to
--       its flow and back. ON DELETE SET NULL: deleting a record row for good is not blocked by its flow.
--
-- New nullable columns only. Existing rows are filled below.

ALTER TABLE "proc_record_flows"
    ADD COLUMN "petitionId" TEXT,
    ADD COLUMN "incidentId" TEXT,
    ADD COLUMN "caseId" TEXT,
    ADD COLUMN "alertDueAt" TIMESTAMP(3),
    ADD COLUMN "alertRedFrom" TIMESTAMP(3),
    ADD COLUMN "alertYellowFrom" TIMESTAMP(3),
    ADD COLUMN "alertGreenFrom" TIMESTAMP(3);

-- The record of each existing flow (only records that still exist: the foreign keys come next).
UPDATE "proc_record_flows" f SET "petitionId" = f."recordId"
 WHERE f."recordKind" = 'PETITION' AND EXISTS (SELECT 1 FROM "petitions" r WHERE r."id" = f."recordId");
UPDATE "proc_record_flows" f SET "incidentId" = f."recordId"
 WHERE f."recordKind" = 'INCIDENT' AND EXISTS (SELECT 1 FROM "incidents" r WHERE r."id" = f."recordId");
UPDATE "proc_record_flows" f SET "caseId" = f."recordId"
 WHERE f."recordKind" = 'CASE' AND EXISTS (SELECT 1 FROM "cases" r WHERE r."id" = f."recordId");

CREATE UNIQUE INDEX "proc_record_flows_petitionId_key" ON "proc_record_flows"("petitionId");
CREATE UNIQUE INDEX "proc_record_flows_incidentId_key" ON "proc_record_flows"("incidentId");
CREATE UNIQUE INDEX "proc_record_flows_caseId_key" ON "proc_record_flows"("caseId");

ALTER TABLE "proc_record_flows" ADD CONSTRAINT "proc_record_flows_petitionId_fkey" FOREIGN KEY ("petitionId") REFERENCES "petitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "proc_record_flows" ADD CONSTRAINT "proc_record_flows_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "proc_record_flows" ADD CONSTRAINT "proc_record_flows_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A link column can only repeat the record of the flow, and only in the column of its kind.
ALTER TABLE "proc_record_flows" ADD CONSTRAINT "proc_record_flows_record_link" CHECK (
    ("petitionId" IS NULL OR ("recordKind" = 'PETITION' AND "petitionId" = "recordId"))
    AND ("incidentId" IS NULL OR ("recordKind" = 'INCIDENT' AND "incidentId" = "recordId"))
    AND ("caseId" IS NULL OR ("recordKind" = 'CASE' AND "caseId" = "recordId"))
);

-- "Records with a running clock, the most urgent first", per kind.
CREATE INDEX "proc_record_flows_recordKind_alertDueAt_idx" ON "proc_record_flows"("recordKind", "alertDueAt");

-- The alert of the flows that exist: the same rule as `refreshRecordAlert` (records/record-alert.ts). A flow whose clock
-- stands still (an open pause), or whose record is deleted, finished or suspended, keeps NULL. The status lists are
-- those of `common/trang-thai/trang-thai-ket-thuc.ts` on the day of this migration; the worker that reconciles the
-- alerts corrects any row this leaves wrong.
UPDATE "proc_record_flows" f
   SET "alertDueAt" = s."dueAt", "alertRedFrom" = s."redFrom", "alertYellowFrom" = s."yellowFrom", "alertGreenFrom" = s."greenFrom"
  FROM (
        SELECT "recordFlowId",
               MIN(LEAST("regulatoryDueAt", "internalDueAt")) AS "dueAt",
               MIN("redFrom") AS "redFrom",
               MIN("yellowFrom") AS "yellowFrom",
               MIN("greenFrom") AS "greenFrom"
          FROM "proc_record_steps"
         WHERE "status" IN ('OPEN', 'REPORTED') AND "regulatoryDueAt" IS NOT NULL
         GROUP BY "recordFlowId"
       ) s
 WHERE s."recordFlowId" = f."id"
   AND NOT EXISTS (SELECT 1 FROM "proc_record_pauses" p WHERE p."recordFlowId" = f."id" AND p."to" IS NULL)
   AND (
        EXISTS (SELECT 1 FROM "petitions" r WHERE r."id" = f."petitionId" AND r."deletedAt" IS NULL
                   AND r."status"::text NOT IN ('DA_GIAI_QUYET', 'DA_LUU_DON', 'DA_CHUYEN_VU_VIEC', 'DA_CHUYEN_VU_AN', 'DA_TRA_DON', 'DA_HUONG_DAN', 'PHAN_LOAI_DAN_SU', 'KHONG_KHOI_TO', 'DA_CHUYEN_DON_VI', 'DA_NHAP_HO_SO_KHAC', 'DINH_CHI', 'CHUYEN_XPHC', 'TAM_DINH_CHI'))
     OR EXISTS (SELECT 1 FROM "incidents" r WHERE r."id" = f."incidentId" AND r."deletedAt" IS NULL
                   AND r."status"::text NOT IN ('DA_GIAI_QUYET', 'DA_CHUYEN_VU_AN', 'KHONG_KHOI_TO', 'DA_NHAP_VU_KHAC', 'PHAN_LOAI_DAN_SU', 'DA_CHUYEN_DON_VI', 'CHUYEN_XPHC', 'TDC_HET_THOI_HIEU', 'TDC_HTH_KHONG_KT', 'DINH_CHI', 'TAM_DINH_CHI'))
     OR EXISTS (SELECT 1 FROM "cases" r WHERE r."id" = f."caseId" AND r."deletedAt" IS NULL
                   AND r."status"::text NOT IN ('DA_KET_LUAN', 'DA_LUU_TRU', 'DINH_CHI', 'DA_CHUYEN_DON_VI', 'DA_NHAP_VU_KHAC', 'CHUYEN_XPHC', 'TAM_DINH_CHI'))
   );
