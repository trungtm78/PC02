
-- CreateEnum
CREATE TYPE "petition_duplicate_decision" AS ENUM ('DA_HOP_NHAT', 'KHONG_TRUNG');

-- CreateTable
CREATE TABLE "petition_duplicate_links" (
    "id" TEXT NOT NULL,
    "primaryPetitionId" TEXT NOT NULL,
    "duplicatePetitionId" TEXT NOT NULL,
    "decision" "petition_duplicate_decision" NOT NULL,
    "reason" TEXT NOT NULL,
    "matchedCriteria" INTEGER NOT NULL,
    "comparedCriteria" INTEGER NOT NULL,
    "decidedById" TEXT,
    "revertedAt" TIMESTAMP(3),
    "revertedById" TEXT,
    "revertReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "petition_duplicate_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "petition_duplicate_links_primaryPetitionId_idx" ON "petition_duplicate_links"("primaryPetitionId");

-- CreateIndex
CREATE INDEX "petition_duplicate_links_duplicatePetitionId_idx" ON "petition_duplicate_links"("duplicatePetitionId");

-- CreateIndex
CREATE INDEX "petition_duplicate_links_decision_idx" ON "petition_duplicate_links"("decision");

-- AddForeignKey
ALTER TABLE "petition_duplicate_links" ADD CONSTRAINT "petition_duplicate_links_primaryPetitionId_fkey" FOREIGN KEY ("primaryPetitionId") REFERENCES "petitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petition_duplicate_links" ADD CONSTRAINT "petition_duplicate_links_duplicatePetitionId_fkey" FOREIGN KEY ("duplicatePetitionId") REFERENCES "petitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petition_duplicate_links" ADD CONSTRAINT "petition_duplicate_links_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petition_duplicate_links" ADD CONSTRAINT "petition_duplicate_links_revertedById_fkey" FOREIGN KEY ("revertedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Một đơn chỉ có MỘT quyết định trùng đang hiệu lực.
--
-- Partial unique index: Prisma không biểu diễn được `WHERE`, nên nó chỉ tồn tại
-- ở đây và `prisma migrate diff` sẽ luôn báo lệch — độ lệch này đã được chấp
-- nhận, xem ADR-0011. Không có nó thì hai cán bộ rà cùng lúc tạo được hai liên
-- kết mâu thuẫn cho cùng một đơn, và không câu lệnh nào ở tầng ứng dụng chặn
-- được cuộc đua đó.
CREATE UNIQUE INDEX "petition_duplicate_links_active_duplicate_key"
  ON "petition_duplicate_links" ("duplicatePetitionId")
  WHERE "revertedAt" IS NULL;

-- Không tự gắn trùng với chính mình.
ALTER TABLE "petition_duplicate_links"
  ADD CONSTRAINT "petition_duplicate_links_not_self"
  CHECK ("primaryPetitionId" <> "duplicatePetitionId");
