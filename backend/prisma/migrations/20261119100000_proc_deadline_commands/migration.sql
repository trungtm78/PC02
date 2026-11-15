-- Deadline commands on a record's steps: how many times a step's regulatory deadline was extended, and the pauses of a
-- record's clock (a record that is suspended stops counting). New column with a default and a new table only; nothing
-- existing is rewritten.

ALTER TABLE "proc_record_steps" ADD COLUMN "extensionsUsed" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "proc_record_pauses" (
    "id" TEXT NOT NULL,
    "recordFlowId" TEXT NOT NULL,
    "from" TIMESTAMP(3) NOT NULL,
    "to" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proc_record_pauses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "proc_record_pauses_recordFlowId_to_idx" ON "proc_record_pauses"("recordFlowId", "to");

ALTER TABLE "proc_record_pauses" ADD CONSTRAINT "proc_record_pauses_recordFlowId_fkey" FOREIGN KEY ("recordFlowId") REFERENCES "proc_record_flows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A pause ends after it starts.
ALTER TABLE "proc_record_pauses" ADD CONSTRAINT "proc_record_pauses_ends_after_start" CHECK ("to" IS NULL OR "to" >= "from");

-- A flow has at most one open pause (the service holds the record's lock when it opens one; this backs it).
CREATE UNIQUE INDEX "proc_record_pauses_one_open_per_flow" ON "proc_record_pauses"("recordFlowId") WHERE "to" IS NULL;
