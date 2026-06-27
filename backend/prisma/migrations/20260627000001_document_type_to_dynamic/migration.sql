-- Catalog Registry DYNAMIC: documents.documentType enum → TEXT
-- Danh mục động qua bảng Directory (type='DOCUMENT_TYPE'). Data-preserving:
-- mọi giá trị enum cũ (VAN_BAN/HINH_ANH/VIDEO/AM_THANH/KHAC) đã có sẵn trong Directory.
ALTER TABLE "documents" ALTER COLUMN "documentType" DROP DEFAULT;
ALTER TABLE "documents" ALTER COLUMN "documentType" SET DATA TYPE TEXT USING "documentType"::text;
ALTER TABLE "documents" ALTER COLUMN "documentType" SET DEFAULT 'VAN_BAN';
DROP TYPE "document_type";
