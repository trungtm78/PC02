-- History of mid-period changes of the criteria a team reports. New table only.

CREATE TABLE "dyn_report_assignment_scope_changes" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dyn_report_assignment_scope_changes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "dyn_report_assignment_scope_changes_assignmentId_createdAt_idx"
  ON "dyn_report_assignment_scope_changes"("assignmentId", "createdAt");

ALTER TABLE "dyn_report_assignment_scope_changes" ADD CONSTRAINT "dyn_report_assignment_scope_changes_assignmentId_fkey"
  FOREIGN KEY ("assignmentId") REFERENCES "dyn_report_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
