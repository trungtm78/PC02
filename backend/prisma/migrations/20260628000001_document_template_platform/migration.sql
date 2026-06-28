-- Nền tảng template động đa-định-dạng + delimiter động.
-- Thêm cột format / delimStart / delimEnd (default an toàn, không phá dữ liệu cũ).
ALTER TABLE "document_templates" ADD COLUMN "format" TEXT NOT NULL DEFAULT 'DOCX';
ALTER TABLE "document_templates" ADD COLUMN "delimStart" TEXT NOT NULL DEFAULT '{';
ALTER TABLE "document_templates" ADD COLUMN "delimEnd" TEXT NOT NULL DEFAULT '}';

-- Backfill mapping: template cũ có variable source='auto' nhưng THIẾU 'field'
-- → set field = name (name cũ chính là catalog key) để engine mapping-driven chạy y hệt.
UPDATE "document_templates"
SET "variables" = (
  SELECT jsonb_agg(
    CASE
      WHEN (elem->>'source') = 'auto' AND NOT (elem ? 'field')
        THEN elem || jsonb_build_object('field', elem->>'name')
      ELSE elem
    END
  )
  FROM jsonb_array_elements("variables") AS elem
)
WHERE jsonb_typeof("variables") = 'array'
  AND jsonb_array_length("variables") > 0;
