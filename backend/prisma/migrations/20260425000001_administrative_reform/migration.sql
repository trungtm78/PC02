-- Migration: Administrative Reform — Remove district tier
-- Adds lifecycle fields to directories and denormalized district name to subjects

-- Add lifecycle fields to directories (for abolished districts/wards)
ALTER TABLE "directories" ADD COLUMN "abolishedAt" TIMESTAMP(3);
ALTER TABLE "directories" ADD COLUMN "replacedByCode" TEXT;

-- Add denormalized district name to subjects
-- Stores "Quận 1" at creation time so display survives post-reform Directory changes
ALTER TABLE "subjects" ADD COLUMN "districtName" TEXT;
