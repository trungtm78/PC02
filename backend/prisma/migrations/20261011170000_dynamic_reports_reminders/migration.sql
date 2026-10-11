-- CreateEnum
CREATE TYPE "DynReportReminderWindow" AS ENUM ('T3D', 'T24H', 'T3H');

-- CreateTable
CREATE TABLE "dyn_report_reminders" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "window" "DynReportReminderWindow" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dyn_report_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dyn_report_reminders_assignmentId_window_key" ON "dyn_report_reminders"("assignmentId", "window");

-- AddForeignKey
ALTER TABLE "dyn_report_reminders" ADD CONSTRAINT "dyn_report_reminders_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "dyn_report_assignments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
