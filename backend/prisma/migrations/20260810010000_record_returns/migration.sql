
-- CreateEnum
CREATE TYPE "record_return_type" AS ENUM ('KHONG_THUOC_THAM_QUYEN', 'THIEU_TAI_LIEU', 'TRUNG_HO_SO', 'SAI_DIA_BAN', 'LY_DO_KHAC');

-- CreateTable
CREATE TABLE "record_returns" (
    "id" TEXT NOT NULL,
    "caseId" TEXT,
    "incidentId" TEXT,
    "petitionId" TEXT,
    "returnType" "record_return_type" NOT NULL,
    "reason" TEXT NOT NULL,
    "toUnit" TEXT NOT NULL,
    "documentNo" TEXT,
    "returnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returnedById" TEXT,
    "revertedAt" TIMESTAMP(3),
    "revertedById" TEXT,
    "revertReason" TEXT,
    "bulkOperationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "record_returns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "record_returns_caseId_idx" ON "record_returns"("caseId");

-- CreateIndex
CREATE INDEX "record_returns_incidentId_idx" ON "record_returns"("incidentId");

-- CreateIndex
CREATE INDEX "record_returns_petitionId_idx" ON "record_returns"("petitionId");

-- CreateIndex
CREATE INDEX "record_returns_returnType_idx" ON "record_returns"("returnType");

-- CreateIndex
CREATE INDEX "record_returns_bulkOperationId_idx" ON "record_returns"("bulkOperationId");

-- AddForeignKey
ALTER TABLE "record_returns" ADD CONSTRAINT "record_returns_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_returns" ADD CONSTRAINT "record_returns_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_returns" ADD CONSTRAINT "record_returns_petitionId_fkey" FOREIGN KEY ("petitionId") REFERENCES "petitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_returns" ADD CONSTRAINT "record_returns_returnedById_fkey" FOREIGN KEY ("returnedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "record_returns" ADD CONSTRAINT "record_returns_revertedById_fkey" FOREIGN KEY ("revertedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Đúng MỘT hồ sơ cho mỗi bản ghi trả.
--
-- Ở tầng CSDL vì đây là bất biến của dữ liệu, không phải quy ước của ứng dụng:
-- Prisma không biểu diễn được `CHECK`, nên nó chỉ tồn tại ở đây và
-- `prisma migrate diff` sẽ báo lệch — độ lệch đã được chấp nhận, xem ADR-0011.
-- Không có nó thì một bản ghi trỏ tới cả vụ án lẫn đơn thư, hoặc không trỏ tới
-- gì cả, vẫn ghi được — và không câu lệnh nào ở tầng ứng dụng chặn được người
-- sửa trực tiếp bằng psql.
ALTER TABLE "record_returns"
  ADD CONSTRAINT "record_returns_exactly_one_target"
  CHECK (num_nonnulls("caseId", "incidentId", "petitionId") = 1);
