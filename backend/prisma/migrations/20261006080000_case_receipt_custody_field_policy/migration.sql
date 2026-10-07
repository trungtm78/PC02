-- AlterTable
ALTER TABLE "case_handoffs" ADD COLUMN     "receiptFacts" JSONB,
ADD COLUMN     "recipientId" TEXT,
ADD COLUMN     "resolutionFacts" JSONB;

-- AlterTable
ALTER TABLE "case_custody_events" ADD COLUMN     "sourceDocumentId" TEXT,
ADD COLUMN     "sourceDocumentUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "case_disclosure_packet_items" ADD COLUMN     "fieldDefinitionVersionId" TEXT;

-- AddForeignKey
ALTER TABLE "case_handoffs" ADD CONSTRAINT "case_handoffs_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_custody_events" ADD CONSTRAINT "case_custody_events_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_disclosure_packet_items" ADD CONSTRAINT "case_disclosure_packet_items_fieldDefinitionVersionId_fkey" FOREIGN KEY ("fieldDefinitionVersionId") REFERENCES "case_field_definition_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
