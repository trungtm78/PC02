# T1 core integration finish evidence

Worktree `.worktrees/case-governance-20261006`; baseline `10030bed`. Approved T1 scope and existing source permissions, adopted legal fields, receipt, clone/version, replay and atomicity contracts are retained. This report certifies the owned implementation gates only. It does **not** mark full T1, CG01–17, independent review, UAT or production release complete.

The predecessor report/57-file manifest remain intact. The new manifest covers those 57 sources plus the explicitly parent-authorized BCA Excel helper, its new regression suite, and migration 132: `t1-core-finish-source-hashes.json` (60 sources). Reproduction: `rtk proxy node docs/test-evidence/case-governance/freeze-core-finish-manifest.cjs`. No source changes are permitted after this freeze without regenerating evidence.

## Implemented boundaries and TDD

1. CasesService constructs the actual Settings period predicate separately and sends `{field,where}` through argument six of the frozen T1b `policyAwareSearchWhere` factory. The predicate is no longer attached globally outside current field/mode/grant partitions. List/count/Excel share this builder. Normal authorized explicit URL dates and configured periods are retained; hidden dates and representation list-only grants cannot be inferred through default period membership.
2. Governance snapshot now returns actual rule/field pins, Case type and assignment facts through current authorization/serialization. Controller regression proves private owner/type fields are omitted while Case ID, version and pins remain command context; deactivation denies the current actor.
3. Meaningful tests cover current scope and descendant/borrowed READ isolation; same-team assignment ledger/event/audit/outbox plus replay and cross-team denial; malformed/foreign receipt documents; inactive targets/nonmembers; current permissions versus forged actor context; restore sensitivity/pending/permission checks; serialization race without committed replay; and actual PostgreSQL rollback of Case CAS/ledger after invalid receipt. Existing negative security assertions are preserved.
4. The initial narrow Excel probe found signature merge overlap for 1–2 columns. Parent authorized the helper fix after the read-only finding. One column now stacks signature blocks; two columns use separate left/right cells; normal wide formats retain position, fonts, alignment and signing space. Reopened workbook regressions cover 1/2/3 columns plus wide layout, and private DB export exercises the original single-selected-column path.
5. At parent/T3 request, disposition receipts have nullable typed `receiptDocumentId`, `receiptDocumentUpdatedAt`, `receiptSha256`, `receiptByteLength` and a named restrictive Document relation. No legacy receipt history is synthesized. Server-owned receipt/sourceSnapshot behavior is implemented and independently verified by its T3 owner, outside this writer's scope.

RED evidence: `t1-period-red.json` proves missing factory argument; `t1-core-finish-red.json` proves missing snapshot facts; `t1-receipt-footer-red.json` proves missing schema pins and actual ExcelJS overlap. GREEN: `t1-core-finish-green.json` (40 tests), `t1-core-finish-targeted.json` (63 tests), `t1-receipt-footer-green.json` (8 tests), and the later full affected/database results. The first period spy attached to a transient getter instance; it was corrected before recording the actual missing-argument RED. No setup failure is claimed as a product RED.

## Fresh final commands and evidence

All commands use `rtk proxy`. The JSON/log artifacts record exact timestamps, scopes and process exit codes; skipped database opt-ins are never claimed PASS. `t1-core-finish-final-verification.json` consolidates fresh results and verifies every frozen source hash.

| Command/scope | Fresh result |
|---|---|
| Expanded affected Jest + raw coverage command below | Exit 0; 72 suites /1,309 tests PASS /0 FAIL; 48 opt-in SKIP; 51.479s; `t1-core-finish-affected.json` |
| `rtk proxy powershell -NoProfile -File ../tools/case-governance/run-core-finish-db.ps1` from backend | Exit 0; 10 actual PostgreSQL tests PASS; 4.062s; `t1-core-finish-db.json` |
| `rtk proxy powershell -NoProfile -File ../tools/case-governance/run-core-finish-static.ps1 -Gate types` | Exit 0; whole backend `npx tsc --noEmit`; 08:27:37.776Z–08:27:43.651Z; `t1-core-finish-types.json` and `.log` |
| Same static runner `-Gate lint` | Exit 0; scoped owned production/controller/module/core and new fixtures/helper/schema tests; exact arguments/timestamps in `t1-core-finish-lint.json` |
| Same static runner `-Gate build` | Exit 0; `npm run build`; 08:21:16.744Z–08:21:55.704Z; `t1-core-finish-build.json` and `.log` |
| `rtk proxy npx prisma validate --config ../tools/case-governance/prisma-offline132.config.ts` | Exit 0; offline schema valid; no dotenv/DB connection |
| `rtk proxy npx prisma generate --config ../tools/case-governance/prisma-offline132.config.ts` | Exit 0; generated Prisma 7.8.0 client |
| `rtk proxy npx prisma migrate diff --from-schema ../tools/case-governance/schema-before-receipt132.prisma --to-schema prisma/schema.prisma --script --config ../tools/case-governance/prisma-offline132.config.ts` | Exit 0; exactly the additive receipt columns and restrictive FK in migration 132 |
| `rtk proxy node docs/test-evidence/case-governance/measure-foundation-patch-coverage.cjs` from worktree | Exit 0; 12 product boundaries; raw changed executable line gate PASS |

Coverage command, from backend (the coverage directory must be this worktree's absolute evidence directory):

```text
rtk proxy npx jest src/cases src/common/utils/scope src/common/utils/kiem src/common/bca-excel-footer.spec.ts src/common/xuat-danh-sach src/audit src/seed/case-governance-permissions.spec.ts --runInBand --silent --json --outputFile=../docs/test-evidence/case-governance/t1-core-finish-affected.json --coverage --collectCoverageFrom=cases/governance/case-governance.service.ts --collectCoverageFrom=cases/governance/case-governance.contract.ts --collectCoverageFrom=cases/governance/case-principal-access.service.ts --collectCoverageFrom=cases/cases.service.ts --collectCoverageFrom=cases/bulk/cases.bulk.service.ts --collectCoverageFrom=cases/case-statistic.builder.ts --collectCoverageFrom=audit/case-audit-policy.service.ts --collectCoverageFrom=audit/audit.service.ts --collectCoverageFrom=audit/audit.controller.ts --collectCoverageFrom=common/utils/scope-filter.util.ts --collectCoverageFrom=common/utils/kiem-vu-an-cha.ts --collectCoverageFrom=common/bca-excel.helper.ts --coverageDirectory=C:/PC02/pc02-case-management/.worktrees/case-governance-20261006/docs/test-evidence/case-governance/foundation-coverage
```

Copy `foundation-coverage/coverage-final.json` to `foundation-coverage-final.json` before running the reproducible patch measure. Final raw result: **769/852 executable changed lines =90.2582159624%**, **749/934 changed branch outcomes =80.1927194861%**. Original 11-product gate first reached 747/830=90.0000% (`t1-core-finish-patch-before-footer.json`); adding the newly owned helper increases both denominator and covered lines. The helper is fully included. No products, statement starts or negative assertions were excluded to reach 90%. Full-module line percentages and branch coverage are not substituted for the executable patch-line gate.

Private DB proves hidden date membership remains stable after the date changes, an exact current sensitive grant restores legitimate configured date filtering, representation list/count works without hidden date inference, general representation export is denied, the actual narrow Excel contains the eligible protected row and omits the public outside-period row, and invalid receipt rollback preserves Case version/revision/stage with no handoff/ledger record. It also introspects all four nullable receipt columns and PostgreSQL FK `confdeltype='r'`.

Earlier failures remain recorded, not relabeled PASS: a combined period DB test exceeded Jest's default 5s under concurrent compiler/coverage load (`t1-core-finish-db-timeout.json`); its bounded allowance is now 30s without changing assertions. The narrow export bug was reported before repair. The Excel `name` column uses `tenCungCap`, so synthetic export labels were added to that real source field. Concurrent T3 immutable-packet and admin type fixtures were handed to their owners; their failure evidence is `t1-core-finish-affected-t3-transient.json` and `t1-core-finish-types-admin-transient.json/.log`. T3 retained 409/no-update immutability assertions and supplied a valid collection, separately retaining malformed-collection 400 tests. RTK's no-hook stderr warning appears as a PowerShell native-command warning in static logs; recorded process exit codes distinguish it from actual compiler/lint failures.

## Frozen migrations

128–131 checksum comparison is enforced by the new freeze script; all remain identical to the predecessor's certified values. Root applied and locked **132** `20261006083000_case_disposition_receipt_pin` on the private DB: SHA-256 **`919dd540b29168a072ea0b92575afdb718357412c557a735c57a7e0d073b503e`**. No applied migration was rewritten. Any future schema addition requires a new migration.

The runner trims the parent password file outside the repo, never prints credentials, and sets a process-local private URL only. Exact host/port/database guarding remains. No shared flag change, DB reset, fixture deletion, ordinary `.env`, production, real dossier data, commit/index operation or external message was used. Offline schema snapshots/config and private runner tooling are not business release sources.

## Stable UI snapshot contract

Sent to `case_governance_ui` after the first 40-test GREEN:

```ts
{ success: true, data: {
  caseId: string,
  updatedAt: Date, // ISO string over HTTP
  intakeStage: CaseIntakeStage | null,
  investigationPhase: CaseInvestigationPhase | null,
  governanceRevision: number,
  governanceRuleVersionId: string | null,
  fieldDefinitionVersionId: string | null,
  caseType?: CaseType,
  assignedTeamId?: string | null,
  investigatorId?: string | null,
  sensitivity: CaseSensitivity,
  handoffs: Array<Partial<CaseHandoff>>,
  events: Array<Partial<CaseGovernanceEvent>> // current policy can mask facts
} }
```

Optional owner/type keys are omitted if current policy masks them; never infer ownership/type from missing values. Native policy also applies within handoffs/events. ID/version/pins remain current command context. Backend build's existing enum/catalog generators ran; UI owner was notified, and no frontend product edits were made by this writer.

## Remaining gates

Implementation is frozen for the **first independent read-only core review**; report findings before repairs. Full T1 is incomplete until that review, child/admin/Auth ACL and custody guard closure, T1b/T3/frontend freezes, full milestone regression, requirement-derived UAT, browser/monkey testing and recovery rehearsal are complete. Branch coverage remains 80.19%; this report certifies the approved executable line gate only. Production requires a human GO.
