ALTER TABLE "incidents"
  ADD COLUMN "createRequestKey" TEXT,
  ADD COLUMN "createRequestHash" TEXT;

CREATE UNIQUE INDEX "incidents_createdById_createRequestKey_key"
  ON "incidents"("createdById", "createRequestKey");
