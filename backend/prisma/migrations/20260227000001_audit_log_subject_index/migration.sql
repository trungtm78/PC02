-- CreateIndex: subjectId trên audit_logs để filter nhanh theo case/entity
CREATE INDEX IF NOT EXISTS "audit_logs_subjectId_idx" ON "audit_logs"("subjectId");
