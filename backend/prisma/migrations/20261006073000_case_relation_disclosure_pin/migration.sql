-- AlterTable
ALTER TABLE "case_relations" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "revokedAt" TIMESTAMP(3),
ADD COLUMN     "revokedById" TEXT;

-- AlterTable
ALTER TABLE "case_disclosure_packet_items" ADD COLUMN     "relationId" TEXT,
ADD COLUMN     "relationRevision" INTEGER;

-- AddForeignKey
ALTER TABLE "case_relations" ADD CONSTRAINT "case_relations_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_disclosure_packet_items" ADD CONSTRAINT "case_disclosure_packet_items_relationId_fkey" FOREIGN KEY ("relationId") REFERENCES "case_relations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
