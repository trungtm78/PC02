# CG-QD01 — same-day legacy deadline marked overdue

First review **FAIL / MAJOR** before fixes, CG16 and acceptance9.

`case-operations.service.ts:62` compares a stored timestamp directly with the current timestamp. Ordinary Case creation/edit stores `new Date(dto.deadline)` (`cases.service.ts:1548`, `:2366`), so a date-only entry becomes midnight UTC. At noon HCM on that same deadline day it already appears overdue. The existing list predicate at `cases.service.ts:819` repeats the comparison, while newly calculated legal deadlines use inclusive HCM end-of-day.

Read-only reproduction: `tools/case-governance/probe-civil-overdue.cjs` extracts and executes the actual pure membership function without DB or product mutation. Deadline2026-10-06 at noon HCM on2026-10-06 expects overdue=false, receives true, exit1. Evidence `civil-overdue-probe.json`.

Closure: compare the deadline's HCM civil day consistently for queue/KPI/list/count/export, including before/at/after local midnight and seven-day due boundaries. Preserve stored dates and provenance; do not migrate legacy timestamps into invented legal calculations. Current shared authorization predicates must remain intact. Add meaningful regressions before implementation.

Scoped ownership transfer: child-access writer may update CaseOperationsService, CasesService's overdue predicate and their directly relevant specs, plus a small shared civil-boundary helper if necessary. No unrelated core edits. Record changed-source hashes and review only this delta after final verification.
