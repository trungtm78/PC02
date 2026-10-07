-- CreateEnum
CREATE TYPE "CaseAccessMode" AS ENUM ('INTERNAL', 'REPRESENTATION_ONLY');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "caseAccessMode" "CaseAccessMode" NOT NULL DEFAULT 'INTERNAL',
ADD COLUMN     "caseAccessRevision" INTEGER NOT NULL DEFAULT 0;
