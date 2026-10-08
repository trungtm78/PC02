# Final independent adversarial review — Case Governance

Date: 2026-10-08. Baseline: `10030bed705ad1afa27eff0986b0c4c43d591aa6`. Reviewed branch: `feat/case-governance-20261006`.

## Verdict

**PASS — no unresolved BLOCKER or MAJOR finding.**

The first review pass was read-only apart from this report. It inspected the requirements and acceptance criteria, approved plan, architecture, current branch diff, prior findings, source freezes, tests, migrations, recovery artifacts and fresh requirement-derived UAT. No product, test, configuration or database change was made during this pass.

## Prior findings

| Finding | Severity | Closure evidence | Status |
|---|---|---|---|
| R1 clone could downgrade a legacy restricted source | MAJOR | Classification now derives from dedicated and both legacy aliases; source-only sensitive grants cannot create an unrestricted copy. Mixed-alias, empty-metadata and stale-version regressions pass. | CLOSED |
| R2 business-authority acquisition could retain technical credentials | MAJOR | Principal-mode/representation acquisition invalidates enrollment, refresh and access credentials transactionally while preserving trusted accounts and replay behavior. | CLOSED |
| R3 legacy source adapters bypassed current source authority/protocol | MAJOR | Petition and Incident adapters use the governed source command with current authority, exact version, durable replay, audit/event/outbox transaction and guarded post-commit emit. | CLOSED |
| R4 terminal historical registration invented a resolution date | MAJOR | Ordinary registration preserves an unknown resolution date; governed legal execution uses the validated effective date. | CLOSED |
| R5 release evidence incomplete | BLOCKER | The final matrix now contains 856/856 PASS with executable evidence for fields, actions and cross-cutting journeys; recovery, coverage, performance and full regression gates are present. | CLOSED |

## Acceptance evidence reviewed

- **Fields:** 660/660 PASS. All 132 canonical fields passed create, real-web edit/reload, ten-tab detail, full Excel export, explicit clear, clone and access-policy checks. Clone resets identity/source links and binds the source revision. A published independently reviewed policy verified authorized reads, 132-field redaction, denied write and restricted export.
- **Legal actions:** 168/168 PASS. Private PostgreSQL and HTTP evidence executes all 21 catalog actions and checks exact state/data, one decision, transactional history, immutable source, authority separation, revision/rule binding, replay and injected-audit rollback.
- **Cross-cutting:** 28/28 PASS. Evidence covers principal mode, role authority, classification, deadlines, custody, byte authorization, safe recovery, handoff, flag-off behavior, unknown facts, source creation, relations/split, field publication, originals, file ACL, packets, holds, representation, retention, audit, queues, outbox, search, navigation, upload/export, compatibility, migration and operations.
- **Runtime/browser:** compiled loopback API/UI checks passed. Browser Back/Forward restored the exact filtered URL; all ten information tabs were reached; no page error or failed API occurred in the recorded journeys.
- **Performance:** 100 bounded requests at concurrency 4 completed with 0% errors and p95 337 ms against the 1,000 ms UAT budget.
- **Regression:** backend 7,254 PASS / 0 FAIL and frontend 4,473 PASS / 0 FAIL. The 30 private legal/database/HTTP tests passed separately.
- **Coverage:** recorded executable patch-line coverage is 90.26% for foundation, 90.63% for child/authority, 98.32% for canonical UI/backend, 92.73% for evidence/relations and 96.02% for the final web scope. Final R1–R4 repair suites add 251/251 focused PASS. Every scoped result meets the approved 90% patch-line threshold; branch coverage was not represented as a release requirement.
- **Migration/recovery:** additive migrations retain prior checksums and unknown legacy data. Isolated database restoration recovered 95 tables with dump/restore exit 0. File recovery hash-verified 83 immutable files and explicitly recorded invalid synthetic fixtures rather than treating them as restored.

The machine-readable reconciliation at `docs/test-evidence/case-governance/private-db/composite-uat-evidence.json` reports 856 PASS and checks that every referenced evidence file exists. `tools/case-governance/reconcile-uat-results.cjs` fails on missing or failed field, legal, regression, migration, recovery, navigation or load evidence. `git diff --check` passed.

## Residual limits

- UAT used isolated synthetic data and loopback services. It did not read or mutate production records.
- The feature remains controlled by its rollout flag. Legal rule publication and production rollout remain operational decisions with their existing audit trail.
- Mobile-specific UI was excluded by the user's current scope; responsive web smoke remains recorded.

These limits do not leave a BLOCKER or MAJOR defect in the approved web release scope. The user's standing production GO remains subject to fresh build/CI, merge and post-deploy canary checks.

PASS
