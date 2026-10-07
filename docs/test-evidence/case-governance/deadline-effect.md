# Deadline effect helper evidence

Date: 2026-10-06. Scope: approved T1b pure deadline helper, CG05/06/10/16 and acceptance 3–6/9. The reported CG-DL01 calculation gap is implemented at helper level; legal workflow integration, transactional rollback/replay, current field authorization, independent review and requirements-derived UAT remain the owning tasks' gates. No statutory rule or calendar was published. No production, database, environment, git index, commit or push operation was performed.

## Contract

Owned product files: `backend/src/cases/governance/case-deadline-effect.ts` and `.spec.ts`.

Stable exports coordinated with the legal workflow writer:

```ts
evaluateDeadlineEffect(
  ruleActionDefinition: unknown,
  caseRecord: unknown,
  payload: unknown,
  clock: () => Date = () => new Date(),
): DeadlineEffectResult // { deadline: Date | null, provenance: JSON object }
validateDeadlineEffect(value: unknown): DeadlineEffect
getDeadlineEffectRequiredInputs(ruleActionDefinition: unknown): string[]
```

Also exported: `DeadlineJson`, `DeadlineDuration`, `DeadlineCalendar`, `DeadlineEffect`, `DeadlineEffectResult`, `InvestigationDeadlinePhase`. The action definition contains `deadlineEffect`; validation receives that property directly, evaluation/required-input helpers receive the whole action definition.

Effect is either `{mode:'PRESERVE'}` or:

```ts
{
  mode: 'CALCULATE', algorithm: 'CIVIL_PERIOD', version: 1,
  phase: 'INITIAL' | 'RESTORED' | 'SUPPLEMENTARY' | 'REINVESTIGATION',
  anchors: {
    initiation?: 'case.path' | 'payload.path',
    restoration?: 'case.path' | 'payload.path',
    dossierReceipt?: 'case.path' | 'payload.path',
    requestReceipt?: 'case.path' | 'payload.path'
  },
  gravityPath: 'case.path' | 'payload.path',
  authorityPath?: 'case.path' | 'payload.path',
  durations: [{ gravity: 'CONFIGURED_UPPERCASE_LABEL', authority?: 'VKS' | 'TOA', value: 1, unit: 'DAYS' | 'MONTHS' }],
  calendar: {
    id: 'PINNED_ID', version: 'PINNED_VERSION',
    effectiveFrom: 'YYYY-MM-DD', effectiveTo: 'YYYY-MM-DD',
    weekendDays: [0, 6], nonworkingDates: [], workingOverrides: [],
    sourceReferenceIds: ['DECLARED_CALENDAR_REFERENCE']
  },
  sourceReferenceIds: ['DECLARED_POLICY_REFERENCE']
}
```

Anchor values are complete structured facts `{date:'YYYY-MM-DD',quality:'VERIFIED'|'COMPLETE',sourceReferenceIds?:string[]}`. INITIAL requires only `initiation`; RESTORED only `restoration`; SUPPLEMENTARY/REINVESTIGATION require both receipt roles and use the later actual receipt date. SUPPLEMENTARY requires explicit authority path and mappings; other phases disallow authority mappings. Gravity labels map only to configured positive integer durations; actual repository gravity enums can be used without changing the helper. Action legalSources, when present, must contain unique `id` entries declaring every policy/calendar reference.

Required inputs contain the actual anchor paths followed by gravity and optional authority paths. PRESERVE requires `case.deadline` explicitly present as null or a valid Date: an omitted, inaccessible or getter-backed field is not known null. Caller must authorize/filter all required paths before calling the helper, enforce action-to-phase policy and require CALCULATE on phase entry, pin the published rule/effective interval, add actual ruleVersionId and immutable request/source snapshots, then save deadline/provenance atomically. Internal handoffs must retain their existing identity/proposal/deadline and do not call this effect engine.

Calculation uses civil periods, excludes the anchor day for DAYS, clamps MONTHS at month end, rolls final nonworking days using the pinned office calendar, and returns inclusive local end-of-day `23:59:59.999` in Asia/Ho_Chi_Minh (`16:59:59.999Z`). Complete dates are checked against the injected local clock; no absent or partial date becomes now. Every anchor and each final/rolled civil date must lie within the pinned inclusive calendar coverage. Detention arithmetic and inferred statutory durations are unsupported.

Provenance identifies algorithm/version, phase, actual anchor roles/paths/dates/quality/source IDs, selected duration/gravity/authority, full pinned calendar snapshot/SHA256, unadjusted and adjusted civil due dates, rolled days, resulting instant and dependencies. It records VERIFIED_POLICY versus LEGACY_UNVERIFIED and explicitly sets statutoryCertification:false. Returned snapshots are detached from caller inputs.

Config is bounded JSON with exact supported keys, safe owned paths, no accessors/cycles/functions/symbols/prototype keys/sparse arrays. Bounds: depth12, 50,000 nodes, 5,001 own keys per collection, 100 durations/references, 5,000 dates per calendar list, 36,600 calendar days, positive safe integer duration≤1,000,000 and nonworking roll≤366 days. Dates, duplicates, ranges and contradictory holiday/override dates reject. Missing/protected/invalid calculation facts use the generic `Deadline inputs are not ready` reason.

## TDD and fresh commands

All commands run from the isolated worktree `backend` directory through `rtk proxy powershell -NoProfile -Command`; raw Jest JSON and logs are retained beside this report. Tests use synthetic policy/calendar/source fixtures only; independent calendar oracle expectations are literal civil dates rather than values produced by the helper.

| Gate | Command inside the RTK PowerShell wrapper | Exit | Evidence |
|---|---|---:|---|
| Initial semantic RED | `npx.cmd jest --runInBand --runTestsByPath src/cases/governance/case-deadline-effect.spec.ts --json --outputFile=../docs/test-evidence/case-governance/deadline-effect-red.json` | 1 | 66 failures/1 pass/67 total, old preserve-only behavior fails phase/date/validation assertions; `deadline-effect-red.log/json` |
| Protected preserve regression RED | same scoped Jest with `--testNamePattern=inaccessible` | 1 | 1 expected failure/67 skipped, omitted protected value incorrectly treated as known null; `deadline-effect-protected-preserve-red.log/json` |
| GREEN + exact production helper coverage | scoped Jest with `--coverage --collectCoverageFrom=cases/governance/case-deadline-effect.ts --coverageDirectory=C:/PC02/pc02-case-management/.worktrees/case-governance-20261006/docs/test-evidence/case-governance/deadline-effect-coverage --coverageReporters=json --coverageReporters=json-summary --coverageReporters=text --json --outputFile=../docs/test-evidence/case-governance/deadline-effect-green.json` | 0 | 68/68 pass; raw executable helper coverage JSON and summary, excluding test code from production denominator |
| Coverage≥90% each metric | PowerShell parses coverage-summary.json, exits1 if any of lines/statements/branches/functions is <90 | 0 | Lines206/209=98.56%; statements228/241=94.60%; branches224/237=94.51%; functions34/35=97.14% |
| Affected regression | `npx.cmd jest --runInBand --runTestsByPath src/cases/governance/case-deadline-effect.spec.ts src/cases/governance/configuration.validation.spec.ts src/cases/governance/legal-workflow.validation.spec.ts src/cases/governance/legal-action.validation.spec.ts --json --outputFile=../docs/test-evidence/case-governance/deadline-effect-affected.json` | 0 | 111/111 tests,4/4 suites; `deadline-effect-affected.log/json` |
| Scoped lint | `npx.cmd eslint src/cases/governance/case-deadline-effect.ts src/cases/governance/case-deadline-effect.spec.ts` | 0 | Zero warnings/errors; `deadline-effect-lint.log` |
| Scoped types | `npx.cmd tsc --noEmit --skipLibCheck --strictNullChecks --target ES2023 --module NodeNext --moduleResolution NodeNext --esModuleInterop --types node,jest src/cases/governance/case-deadline-effect.ts src/cases/governance/case-deadline-effect.spec.ts` | 0 | `deadline-effect-scoped-types.log` |

The first full `npx.cmd tsc --noEmit --incremental false` snapshot exited1: concurrent evidence-lifecycle.spec.ts nullable source/mock transaction types and legal-workflow.private-http.spec.ts nullable body, plus this helper spec's union-array push typing. The helper typing was corrected and scoped types pass; other errors were reported to their owners. `deadline-effect-types.log` preserves that snapshot and is not a final whole-project type verdict. No test assertion was weakened. One fixture clock was corrected to2030 because a calendar coverage test used2028 facts with a2027 clock; the future-date readiness and coverage assertions both remain intact.

The tests cover leap/common years, end-month and year roll, day periods, inclusive UTC+07 representation, future-fact local midnight, initial/restored/receipt anchors, receipt ordering versus decision dates, authority and gravity selection, holiday chains/working override, bounded roll and effective coverage, missing/partial/extracted/hidden facts, unknown algorithms/units/conditions, positive integer bounds, provenance/source links/hash, duplicates/ranges/cycles/prototypes/accessors and immutability. No HTTP/DB/browser UAT success is claimed by this unit task.

Next: legal writer integrates this helper with action publication/readiness/execution/tasks and transactional provenance; independent adversarial review precedes final UAT and the full frozen-source milestone gates. Selected primary legal references were supplied and already checked in `docs/reviews/case-deadline-effect-gap.md`; these are reference anchors, not statutory certification. Production configuration remains UNPUBLISHED pending separate authority review.
