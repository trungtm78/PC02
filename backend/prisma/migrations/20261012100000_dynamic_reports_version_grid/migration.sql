-- Derived cache of the render-ready grid model of a published report version.
-- Additive only; safe to drop and rebuild (see GridModelService).
-- CreateTable
CREATE TABLE "dyn_report_version_grids" (
    "versionId" TEXT NOT NULL,
    "gridEngineVersion" INTEGER NOT NULL,
    "sourceSha256" TEXT NOT NULL,
    "model" JSONB NOT NULL,
    "builtAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dyn_report_version_grids_pkey" PRIMARY KEY ("versionId")
);

-- AddForeignKey
ALTER TABLE "dyn_report_version_grids" ADD CONSTRAINT "dyn_report_version_grids_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "dyn_report_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;