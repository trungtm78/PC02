-- v0.37.2.0 PROV-002 — extend CaseProvenance enum with 2 BLTTHS Đ.143 căn cứ.
--
-- Each ALTER TYPE ADD VALUE is a separate statement (PG 12+ allows this in
-- transaction but Prisma migrate wraps the file in one transaction, which is fine).
-- New rows use new values via form; existing rows unchanged.
--
-- IF NOT EXISTS makes this idempotent if rerun.

ALTER TYPE "case_provenance" ADD VALUE IF NOT EXISTS 'SELF_SURRENDER';
ALTER TYPE "case_provenance" ADD VALUE IF NOT EXISTS 'PROSECUTOR_PROPOSAL';
