-- Duplicate detection (PR-C3) groups petitions on senderPhone, senderAddress
-- and suspectedPerson. Only senderName was indexed; the others forced a
-- sequential scan of the whole table on every GROUP BY.
--
-- Note: a gin trigram index on senderName exists for ILIKE search. It does
-- not serve GROUP BY, which is why the btree above it stays.
--
-- CONCURRENTLY is deliberately NOT used: prisma migrate deploy runs each
-- migration in a transaction, and CREATE INDEX CONCURRENTLY cannot run inside
-- one. These tables are small enough that the brief lock is acceptable; if
-- that stops being true, build them by hand outside a migration.
CREATE INDEX IF NOT EXISTS "petitions_senderPhone_idx" ON "petitions" ("senderPhone");
CREATE INDEX IF NOT EXISTS "petitions_senderAddress_idx" ON "petitions" ("senderAddress");
CREATE INDEX IF NOT EXISTS "petitions_suspectedPerson_idx" ON "petitions" ("suspectedPerson");
