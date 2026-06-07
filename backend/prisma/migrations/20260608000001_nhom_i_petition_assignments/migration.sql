-- CreateTable: PetitionAssignment (Nhóm I — phân công nhiều cán bộ)
CREATE TABLE "petition_assignments" (
    "id" TEXT NOT NULL,
    "petitionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "petition_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "petition_assignments_petitionId_idx" ON "petition_assignments"("petitionId");

-- CreateIndex (unique constraint petitionId + userId)
CREATE UNIQUE INDEX "petition_assignments_petitionId_userId_key" ON "petition_assignments"("petitionId", "userId");

-- AddForeignKey
ALTER TABLE "petition_assignments" ADD CONSTRAINT "petition_assignments_petitionId_fkey" FOREIGN KEY ("petitionId") REFERENCES "petitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petition_assignments" ADD CONSTRAINT "petition_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "petition_assignments" ADD CONSTRAINT "petition_assignments_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
