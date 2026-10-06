-- Additive; existing records retain unknown intake history (NULL).
CREATE TYPE "IncidentIntakeStage" AS ENUM ('PHAN_LOAI', 'CHO_NHAN', 'DA_NHAN');
CREATE TYPE "IncidentHandoffState" AS ENUM ('PENDING', 'ACCEPTED', 'CANCELLED');
ALTER TABLE "incidents" ADD COLUMN "intakeStage" "IncidentIntakeStage",
  ADD COLUMN "handledIncidentId" TEXT;
CREATE UNIQUE INDEX "incidents_handledIncidentId_key" ON "incidents"("handledIncidentId");
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_handledIncidentId_fkey"
  FOREIGN KEY ("handledIncidentId") REFERENCES "incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_intake_not_self"
  CHECK ("handledIncidentId" IS NULL OR "handledIncidentId" <> "id");
CREATE TABLE "incident_handoffs" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "incidentId" TEXT NOT NULL REFERENCES "incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "fromTeamId" TEXT,
  "toTeamId" TEXT NOT NULL REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "priorIntakeStage" "IncidentIntakeStage",
  "state" "IncidentHandoffState" NOT NULL DEFAULT 'PENDING',
  "sentById" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "receivedById" TEXT, "receivedAt" TIMESTAMP(3),
  "cancelledById" TEXT, "cancelledAt" TIMESTAMP(3), "reason" TEXT,
  "requestKey" TEXT NOT NULL, "requestHash" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "incident_handoffs_sentById_requestKey_key" ON "incident_handoffs"("sentById", "requestKey");
CREATE UNIQUE INDEX "incident_handoffs_one_pending" ON "incident_handoffs"("incidentId") WHERE "state" = 'PENDING';
CREATE INDEX "incident_handoffs_toTeamId_state_sentAt_id_idx" ON "incident_handoffs"("toTeamId", "state", "sentAt", "id");
CREATE INDEX "incident_handoffs_incidentId_sentAt_id_idx" ON "incident_handoffs"("incidentId", "sentAt", "id");
INSERT INTO "feature_flags" ("key", "label", "enabled", "updatedAt")
VALUES ('INCIDENT_INTAKE_HANDOFF', 'Tiếp nhận và bàn giao vụ việc', FALSE, CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
