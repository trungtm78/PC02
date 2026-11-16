-- "Mở lại" of a completed ward assignment request: the reason is kept in this history, not in the audit log.
CREATE TABLE "ward_assignment_reopenings" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "completedOn" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "reopenedById" TEXT NOT NULL,
    "reopenedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ward_assignment_reopenings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ward_assignment_reopenings_assignmentId_idx" ON "ward_assignment_reopenings"("assignmentId");

ALTER TABLE "ward_assignment_reopenings" ADD CONSTRAINT "ward_assignment_reopenings_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "ward_assignments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ward_assignment_reopenings" ADD CONSTRAINT "ward_assignment_reopenings_reopenedById_fkey" FOREIGN KEY ("reopenedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
