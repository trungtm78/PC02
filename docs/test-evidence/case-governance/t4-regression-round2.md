# T4 full-frontend regression repair round2

The coordinator's frozen full run had4,451 PASS/7 FAIL (4,458 total). The source-first focused reproduction retained the seven original suites and produced **48 PASS/7 FAIL, exit1** in `t4-regression-round2-red.json`. No full4,458 repeat was performed by this writer.

## Repairs and retained oracles

- Default INTERNAL list columns/labels and legacy132/form-field gates remain unchanged. The approved REPRESENTATION_ONLY DTO contains Case.name/code/status, not legacy tenCungCap. The coordinator explicitly approved a dedicated typed summary factory with accurate labels; no fake sender-field read or gate exemption was added. Exact three-column semantics, throwing protected-field getter, masked-value hints and no bulk/create controls are tested separately. An empty representation list also offers no creation action.
- `formSuaChiXem` explicitly mocks the field-schema endpoint's valid null/unconfigured response instead of its generic array. The positive F2 save and negative readonly assertions remain. Existing malformed/loading schema negatives remain included.
- The production form-route predicate protects all three new governance routes from automatic reload; three regressions were RED before the fix. No form-in-dialog whitelist was added.
- The exact route registry expectation now includes the approved three new routes alongside the original seven; nonempty/feature assertions remain.
- All six Case consumers stopped fetching raw admin-user lists. Business selectors reuse the existing paginated/cached/authorized `useOfficerOptions` source, retaining current team membership and mode data. The account-management directory is separately typed, paginated, guarded by actual actor/INTERNAL/enabled/manage_access capability, and includes inactive targets. Guard/error/pagination/cache-sharing regressions are included. The original no-raw-admin-source gate remains unchanged.
- Prosecution success waits for the genuinely enabled submission button after schema loading. The actual NEW_CASE_42 callback/navigation oracle remains unchanged.

## Fixture corrections exposed by impact tests

The principal-mode test now waits for its authorized target option before selection. Existing packet fixtures use actual User DTO firstName instead of the obsolete display-only name field. The shared test QueryClient provider is supplied through RTL's wrapper so rerender preserves the command instance and idempotency key; an initial wrapper remounted the retry harness and was corrected without changing its key-equality assertion. The new summary unit test was corrected to call ColumnDef.render with its actual one-argument contract. No timeout, assertion or product authorization was weakened.

Intermediate results remain recorded: focused100 PASS/1 FAIL caught the mislabeled sender mapping; summary64 PASS/0 FAIL after the approved factory; impact254 PASS/5 FAIL exposed the four recipient fixtures and provider-remount issue. Matching fixture/idempotency reruns passed. These intermediate results are not relabelled as green.

## Fresh final evidence

- Final seven original suites plus affected governance/list/schema/source/picker/reload tests: **259 PASS/0 FAIL, exit0**, `t4-regression-round2-final-tests.json`. One worker, original timeouts. Raw coverage: `t4-round2-coverage/coverage-final.json` and summary. Coverage includes all affected governance modules, CaseListPageShell, officer/principal hooks and production reload predicate.
- `rtk proxy npx tsc -b --pretty false`: **exit0**. Scoped source/test lint: **exit0**, `t4-regression-round2-final-lint.json`. `rtk git diff --check -- frontend/src scripts/case-governance-ui-evidence.py`: **exit0**.
- `rtk proxy python scripts/case-governance-ui-evidence.py t4-round2-coverage t4-round2-before-source-hashes.json`: executable whole patch **5,838/6,080 =96.0197%** against10030bed including inherited T2. **60** current source hashes were verified; **33** unchanged sources reuse archived counters only after exact frozen hash matching. No missing instrumented product source. Fresh restricted raw Istanbul lines **1,069/1,202 =88.93%**; this is disclosed separately from the mapped executable patch gate.
- `rtk proxy npm run build`: **exit0**, 3,071 modules. Existing main-chunk size/Browserslist-data warnings remain. Summary factory, officer adapter, principal directory, shared officer hook and reload predicate each have100% fresh raw line coverage; other lower module metrics remain visible in the raw summary. Whole-frontend rerun, independent closure review, actual API/browser UAT and release remain coordinator gates.

No backend/schema, environment, index, commit, production or actual dossier changes were made.
