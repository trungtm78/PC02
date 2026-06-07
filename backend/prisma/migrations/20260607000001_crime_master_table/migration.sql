-- Master tội danh BLHS 2015 (bảng `crimes`) — FK thật để nơi khác dùng chung.
-- Backfill 47 Directory(type=CRIME) sang crimes GIỮ NGUYÊN id để Subject.crimeId hiện có không vỡ FK.
-- Plain DDL (KHÔNG CONCURRENTLY — bài học v0.40).

-- CreateTable
CREATE TABLE "crimes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "articleNo" INTEGER NOT NULL,
    "chapter" TEXT NOT NULL,
    "pc02Relevant" BOOLEAN NOT NULL DEFAULT false,
    "legacyValue" INTEGER,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crimes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "crimes_code_key" ON "crimes"("code");
CREATE INDEX "crimes_pc02Relevant_idx" ON "crimes"("pc02Relevant");
CREATE INDEX "crimes_chapter_idx" ON "crimes"("chapter");
CREATE INDEX "crimes_articleNo_idx" ON "crimes"("articleNo");
CREATE INDEX "crimes_legacyValue_idx" ON "crimes"("legacyValue");

-- Backfill 1: copy Directory(type=CRIME) → crimes GIỮ id (để Subject.crimeId trỏ tiếp tục hợp lệ).
-- articleNo/chapter/pc02Relevant để giá trị tạm; seed-crimes-blhs2015 sẽ upsert theo code và chuẩn hóa.
INSERT INTO "crimes" ("id","code","name","articleNo","chapter","pc02Relevant","order","isActive","createdAt","updatedAt")
SELECT d."id", d."code", d."name", 0, 'KHAC', false, d."order", true, NOW(), NOW()
FROM "directories" d
WHERE d."type" = 'CRIME'
ON CONFLICT ("id") DO NOTHING;

-- Backfill 2 (safety): bất kỳ Subject.crimeId nào chưa có trong crimes (trỏ tới directory không phải CRIME
-- hoặc id cũ) → tạo placeholder để FK không vỡ. Seed/đối soát sau có thể chuẩn hóa.
INSERT INTO "crimes" ("id","code","name","articleNo","chapter","pc02Relevant","order","isActive","createdAt","updatedAt")
SELECT DISTINCT s."crimeId", 'LEGACY-' || s."crimeId", 'Tội danh (di trú — chưa chuẩn hóa)', 0, 'KHAC', false, 0, true, NOW(), NOW()
FROM "subjects" s
WHERE s."crimeId" IS NOT NULL
  AND s."crimeId" NOT IN (SELECT "id" FROM "crimes")
ON CONFLICT ("id") DO NOTHING;

-- AddForeignKey
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_crimeId_fkey" FOREIGN KEY ("crimeId") REFERENCES "crimes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
