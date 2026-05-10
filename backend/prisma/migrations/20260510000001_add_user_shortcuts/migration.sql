-- CreateTable
CREATE TABLE "user_shortcuts" (
    "id"        TEXT        NOT NULL,
    "userId"    TEXT        NOT NULL,
    "action"    TEXT        NOT NULL,
    "binding"   TEXT        NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_shortcuts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_shortcuts_userId_idx" ON "user_shortcuts"("userId");

-- CreateUniqueIndex (one override per user per action)
CREATE UNIQUE INDEX "user_shortcuts_userId_action_key" ON "user_shortcuts"("userId", "action");

-- CreateUniqueIndex (DB-enforced conflict prevention — race-safe against concurrent PUT-PUT)
CREATE UNIQUE INDEX "user_shortcuts_userId_binding_key" ON "user_shortcuts"("userId", "binding");

-- AddForeignKey
ALTER TABLE "user_shortcuts"
    ADD CONSTRAINT "user_shortcuts_userId_fkey"
    FOREIGN KEY ("userId")
    REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
