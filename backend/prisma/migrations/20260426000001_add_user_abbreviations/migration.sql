-- CreateTable
CREATE TABLE "user_abbreviations" (
    "id"        TEXT        NOT NULL,
    "userId"    TEXT        NOT NULL,
    "shortcut"  TEXT        NOT NULL,
    "expansion" TEXT        NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_abbreviations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_abbreviations_userId_idx" ON "user_abbreviations"("userId");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "user_abbreviations_userId_shortcut_key" ON "user_abbreviations"("userId", "shortcut");

-- AddForeignKey
ALTER TABLE "user_abbreviations"
    ADD CONSTRAINT "user_abbreviations_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
