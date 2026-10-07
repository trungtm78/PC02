# Final adversarial-review fix evidence — 2026-10-07

## RED

- CG-FINAL-R1/R2/R4 regression command: focused Jest run for `foundation-integration.spec.ts`, `case-principal-access.service.spec.ts`, `evidence-governance.service.spec.ts`, and `cases.service.spec.ts`.
- Exit code: `1`.
- Result: `4` expected new regressions failed and `223` tests passed before the product fixes.
- CG-FINAL-R3 regression command: `npm test -- --runInBand src/cases/cases.service.spec.ts`.
- Exit code: `1`.
- Result: `1` expected adapter regression failed and `120` tests passed; `CaseSourceCreationService.execute` had zero calls from legacy `POST /cases`.

## GREEN

- Command: `npm test -- --runInBand --json --outputFile=../docs/test-evidence/case-governance/final-review-fix-focused-green-20261007.json src/cases/cases.service.spec.ts src/cases/cases-incident-prosecution.spec.ts src/cases/governance/foundation-integration.spec.ts src/case-child-access/case-source-creation.service.spec.ts src/cases/governance/case-principal-access.service.spec.ts src/cases/evidence-governance/evidence-governance.service.spec.ts`.
- Exit code: `0`.
- Result: `6/6` suites and `251/251` tests passed.
- Machine-readable report: `final-review-fix-focused-green-20261007.json`.

## Compile/build

- `npx tsc --noEmit`: exit `0`, `TypeScript: No errors found`.
- `npm run build`: exit `0`; enum/catalog generation and Nest build completed.
