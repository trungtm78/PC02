-- Pin the owned disposition receipt document and the exact accepted bytes.
-- Existing receipts remain legacy/unknown; no synthetic history is inferred.
ALTER TABLE "case_disposition_requests"
ADD COLUMN "receiptDocumentId" TEXT,
ADD COLUMN "receiptDocumentUpdatedAt" TIMESTAMP(3),
ADD COLUMN "receiptSha256" TEXT,
ADD COLUMN "receiptByteLength" INTEGER;

ALTER TABLE "case_disposition_requests"
ADD CONSTRAINT "case_disposition_requests_receiptDocumentId_fkey"
FOREIGN KEY ("receiptDocumentId") REFERENCES "documents"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
