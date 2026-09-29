# Execution plan

Original spec: ../specs/2026-09-27-petition-all-column-search-design.md

1. Preserve existing work; create a dedicated branch. Record baseline and reproduce the Playwright configuration error. Write failing regression tests for missing search fields and stale non-null aggregates.
2. Extend the petition registry and list metadata. Add the Prisma shadow field. Generate a new migration and refresh existing petition aggregates in the migration. Run focused tests, then full suites.
3. Verify lint, types, builds and patch coverage. Review the diff and run a cross-model review after the first review. Check alignment with the original spec.
4. Write and run API-first UAT on an isolated local environment. Record every in-scope column and behavior in UAT-COVERAGE.md. Fix failures, rerun, and only mark DONE when every protocol gate passes.

Use RED/GREEN/REFACTOR for each behavior change. Preserve pre-existing user changes. Do not run against production or send credentials. Update PROGRESS.md after every task and milestone; read it, the original spec and the autonomous protocol after compaction.
