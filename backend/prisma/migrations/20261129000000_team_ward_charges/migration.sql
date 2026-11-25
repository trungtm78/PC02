-- Which PC02 team is in charge of which ward ("Phường/xã phụ trách" on the team screen).
-- Keyed by the WARD directory row: one ward, one manager team (UNIQUE), whatever ward teams point at it.
-- Every relation is RESTRICT: a team, a ward or a user that still has a charge is not deleted silently.

CREATE TABLE "team_ward_charges" (
    "id" TEXT NOT NULL,
    "wardDirectoryId" TEXT NOT NULL,
    "managerTeamId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_ward_charges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "team_ward_charges_wardDirectoryId_key" ON "team_ward_charges"("wardDirectoryId");

CREATE INDEX "team_ward_charges_managerTeamId_idx" ON "team_ward_charges"("managerTeamId");

ALTER TABLE "team_ward_charges" ADD CONSTRAINT "team_ward_charges_wardDirectoryId_fkey" FOREIGN KEY ("wardDirectoryId") REFERENCES "directories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "team_ward_charges" ADD CONSTRAINT "team_ward_charges_managerTeamId_fkey" FOREIGN KEY ("managerTeamId") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "team_ward_charges" ADD CONSTRAINT "team_ward_charges_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
