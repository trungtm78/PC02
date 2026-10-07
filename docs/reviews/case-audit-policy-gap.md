# CG-AU01 — Case audit confidentiality

First review is read-only. Status: MAJOR, OPEN. Requirement CG14 and acceptance criterion 8 require current case and field authorization on audit, search, counts and export.

Evidence: `backend/src/audit/audit.controller.ts` forwards list, detail, action/subject filters and CSV export without actor context. `backend/src/audit/audit.service.ts` findAll constructs only user-supplied filters, queries raw audit rows and counts, and computes changedFields before any Case visibility or field policy check. findById returns full before/after metadata. distinctActions/distinctSubjects are global. `backend/src/cases/cases.service.ts` records Case updates with full before/after through wrapUpdate, subject Case, subjectId case ID.

A role with AuditLog.read can therefore retrieve a restricted Case ID and protected field before/after values without Case read_sensitive or the current case grant. Sanitizing secrets does not authorize dossier fields. This also permits inference through total, filter suggestions and changed-field count in CSV.

Required closure: carry authenticated actor through audit read routes and enforce Case-specific current visibility at the database predicate before pagination/count/filter/search/export. Apply current published field policy to metadata snapshots and changedFields. Cover Case-linked governance/evidence/document audit subjects whose metadata references a case; preserve non-Case behavior. Detail must return concealed/not-found for an unauthorized row. Add regressions before fixes, including revoked grants, inactive actor, native and custom field masking and filtered counts. Avoid circular AuditService→CaseGovernanceService dependencies because core mutations call AuditService; reuse pure policy helpers and Prisma current-actor resolution where appropriate.

No product source was edited by this review. Assign closure to an implementer and require independent re-review.
