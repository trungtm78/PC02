-- CreateEnum
CREATE TYPE "OcrEntity" AS ENUM ('PETITION', 'INCIDENT', 'CASE');

-- CreateEnum
CREATE TYPE "OcrSessionStatus" AS ENUM ('OPEN', 'BOUND', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OcrTranscriptSource" AS ENUM ('MODEL', 'OFFICER');

-- CreateTable
CREATE TABLE "ocr_sessions" (
    "id" TEXT NOT NULL,
    "entity" "OcrEntity" NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" "OcrSessionStatus" NOT NULL DEFAULT 'OPEN',
    "boundRecordId" TEXT,
    "boundAt" TIMESTAMP(3),
    "pageSetRevision" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ocr_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocr_pages" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "originalPath" TEXT NOT NULL,
    "derivedPath" TEXT,
    "derivedTransforms" TEXT,
    "removedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocr_page_sets" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "pages" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_page_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocr_transcripts" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "source" "OcrTranscriptSource" NOT NULL,
    "pageKind" TEXT,
    "promptVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocr_analyses" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "entity" "OcrEntity" NOT NULL,
    "pageSetRevision" INTEGER NOT NULL,
    "inputFingerprint" TEXT NOT NULL,
    "bundle" JSONB NOT NULL,
    "cleaned" JSONB NOT NULL,
    "issues" JSONB NOT NULL,
    "projection" JSONB NOT NULL,
    "promptVersions" JSONB NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ocr_sessions_createdById_status_idx" ON "ocr_sessions"("createdById", "status");

-- CreateIndex
CREATE INDEX "ocr_sessions_status_expiresAt_idx" ON "ocr_sessions"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "ocr_pages_sessionId_idx" ON "ocr_pages"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ocr_page_sets_sessionId_revision_key" ON "ocr_page_sets"("sessionId", "revision");

-- CreateIndex
CREATE UNIQUE INDEX "ocr_transcripts_pageId_revision_key" ON "ocr_transcripts"("pageId", "revision");

-- CreateIndex
CREATE INDEX "ocr_analyses_sessionId_isCurrent_idx" ON "ocr_analyses"("sessionId", "isCurrent");

-- AddForeignKey
ALTER TABLE "ocr_pages" ADD CONSTRAINT "ocr_pages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ocr_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocr_page_sets" ADD CONSTRAINT "ocr_page_sets_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ocr_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocr_transcripts" ADD CONSTRAINT "ocr_transcripts_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "ocr_pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocr_analyses" ADD CONSTRAINT "ocr_analyses_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ocr_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Rules Prisma cannot express. Idempotent: the PostgreSQL spec re-applies this section on a scratch database
-- built with `prisma db push`.

-- Exactly one analysis per session is current.
CREATE UNIQUE INDEX IF NOT EXISTS "ocr_analyses_one_current" ON "ocr_analyses" ("sessionId")
  WHERE "isCurrent";

-- The same scan cannot be added twice to a session while it is still in it (a removed page does not count).
CREATE UNIQUE INDEX IF NOT EXISTS "ocr_pages_session_sha_active" ON "ocr_pages" ("sessionId", "sha256")
  WHERE "removedAt" IS NULL;

-- A bound session must say which record it was bound to.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ocr_sessions_bound_has_record') THEN
    ALTER TABLE "ocr_sessions"
      ADD CONSTRAINT "ocr_sessions_bound_has_record"
      CHECK ("status" <> 'BOUND' OR "boundRecordId" IS NOT NULL);
  END IF;
END $$;
