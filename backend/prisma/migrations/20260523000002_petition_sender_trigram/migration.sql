-- v0.37.2.0 PROV-005 — trigram index on petitions.senderName for fast ILIKE search.
--
-- /petitions/linkable endpoint (PR-PICK) uses ILIKE on senderName. Standard btree
-- index doesn't help for `%word%` patterns. pg_trgm extension enables GIN index
-- that accelerates contains/similarity queries.
--
-- IMPORTANT: CONCURRENTLY MUST be the only DDL statement in this file (Prisma
-- migrate wraps multi-statement files in BEGIN/COMMIT which conflicts with
-- CREATE INDEX CONCURRENTLY).
-- Pattern reference: 20260522092131_directories_official_code_index_concurrent.

-- pg_trgm extension safe to enable on Postgres 9.1+ (we run 15+).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY IF NOT EXISTS "petitions_senderName_trgm_idx"
  ON "petitions" USING gin (("senderName") gin_trgm_ops);
