# CG-CH01 — Case child entrypoints retain scope-only authorization

Read-only review, MAJOR OPEN. CG14/acceptance8 require current sensitivity and field authorization across child APIs/search/count/export, not only /cases.

Evidence: SubjectsService.getList uses buildScopeFilter(dataScope) and returns child data plus Case id/name/status, with no actor or current Case sensitivity predicate. getById loads only Case id/name/status/assignedTeamId/investigatorId then assertParentInScope. LawyersService and ConclusionsService use the same patterns. Their calls to kiemVuAnChaDeGhi check scope/pending only, selecting no sensitivity/field schema and receiving no actor. A readable unit or ADMIN scope=NULL therefore can query child details of a restricted Case despite lacking the explicit current sensitive capability/grant. The narrow common parent projection cannot enforce a policy it has not loaded.

Required closure: inventory all Case child read/write/list/count/export/bulk and job entrypoints; carry current authenticated identity and apply the same Case readable/writable predicate before list pagination/count and all mutations. Serialize hydrated Case fields using pinned native policies; child token queries over parent Case fields cannot infer hidden values. Preserve non-Case domains and avoid adding Case-only SQL predicates to a generic filter used by Incident/Petition. Add negative actor/unit/sensitivity/grant-revocation tests and actual private DB/API evidence. Common pending-write guard remains required, but is insufficient by itself.

No source changes in this review. Case core/evidence writers own their existing files; a separate child-access closure writer may own other modules after interfaces freeze. No reductions to the accepted all-entrypoint security matrix.
