# Full frontend regression gate — FAIL

Fresh frozen run:4451 PASS/7 FAIL,4458 total, exit1,1133361ms. Command `run-check.cjs frontend frontend-frozen-final 2`; raw report/log/summary retained. No whole frontend PASS or release eligibility claim.

| Failure | Required closure |
|---|---|
| Legacy default column and matching form-label gates (2) | Preserve old approved list labels/defaults and132field layout. New policy/config labels must not rename legacy list columns accidentally. |
| Permitted edit/F2 save (1) | Confirm valid current schema fixture/loading and allowed write; keep readonly and successful actual-save/navigation oracles. |
| New form routes excluded from update/reload protection (1) | Protect real new governance form routes from losing unsaved input; do not merely whitelist failures. |
| Feature registry exact route list (1) | Include the3approved added routes while retaining the7old routes and exact authorization contract. This is an approved route addition, not scope removal or an empty assertion. |
| Officer single-source gate (1) | Business assignee/holder pickers use the existing authorized cached officer source. Principal account management remains a distinct scoped workflow; avoid unguarded generic user-fetch paths. |
| Source creation successful navigation (1) | Preserve actual newCase.id onSuccess after valid schema readiness; loading/mock correction must not erase navigation assertion. |

Findings sent to the frontend owner before fixes. Focused regressions first, fresh affected verification/coverage/hash afterwards; no timeout increases or assertion weakening. Backend source/graph work continues independently.
