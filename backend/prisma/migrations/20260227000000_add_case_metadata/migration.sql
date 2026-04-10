-- AddColumn: metadata JSONB vào bảng cases
ALTER TABLE "cases" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
