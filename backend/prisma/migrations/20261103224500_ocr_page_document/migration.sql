-- The Document a scan became once its session was bound to a record. NULL until then; set once, which is what
-- makes copying the originals into the record's documents safe to repeat after a crash.
ALTER TABLE "ocr_pages" ADD COLUMN IF NOT EXISTS "documentId" TEXT;
