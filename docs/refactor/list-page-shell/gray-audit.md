# gray-* Audit — frontend/src

**Date:** 2026-05-30  
**Branch:** feat/list-page-shell-foundation  
**Purpose:** Categorize all `gray-*` Tailwind class usage before slate-* migration. Avoid blind grep-replace (model Eng review finding: would break archived-state semantic).

## Summary

- **Total occurrences:** 202 across 21 files
- **Semantic (allowlist via named tokens):** 4 file references covering 5 status enum values
- **Accidental (migrate to slate-*):** Everything else (~21 files of UI chrome)

## Semantic uses — keep but rename via named tokens

These uses are intentional and convey domain meaning (archived, neutral, not-responded). They must be preserved but routed through named tokens to make intent explicit:

| File:Line | Original | Semantic | New token name |
|---|---|---|---|
| `constants/styles.ts:168` | `CASE_STATUS_COLORS.DA_LUU_TRU: "text-gray-600 bg-gray-50"` | Case archived (lưu trữ) | `STATUS_ARCHIVED` |
| `shared/enums/status-labels.ts:290` | `TRANG_THAI_PHAN_HOI_BADGE.CHUA_PHAN_HOI: 'bg-gray-100 text-gray-600'` | UTDT response not yet received | `STATUS_PENDING_RESPONSE` |
| `pages/cases/CaseListPage.tsx:126` | `CASE_STATUS_COLORS.DA_LUU_TRU` duplicate | (same as styles.ts) | use `STATUS_ARCHIVED` from styles.ts |
| `pages/cases/CaseListPage.tsx:143` | `DA_LUU_TRU` status chip variant | Case archived chip | `STATUS_ARCHIVED_CHIP` |
| `pages/incidents/IncidentListPage.tsx:57` | `INCIDENT_STATUS_COLORS.KHONG_KHOI_TO: "bg-gray-600 text-white"` | Incident not-prosecuted (no charges) | `STATUS_NOT_PROSECUTED` |

**Action plan:** Define these 3 named tokens (`STATUS_ARCHIVED`, `STATUS_PENDING_RESPONSE`, `STATUS_NOT_PROSECUTED`) in `constants/styles.ts` Layer 2 step. Replace the 5 references above. The tokens internally may still resolve to `bg-slate-*` or kept `bg-gray-*` — that decision is made once at token definition, not 5 times scattered.

**Rationale:** "Archived" and "no prosecution" are legitimately muted/neutral states. Slate provides the same visual register; using slate keeps palette consistent. Final token values will resolve to `bg-slate-100 text-slate-600` and `bg-slate-600 text-white` respectively.

## Accidental uses — migrate to slate-*

These are UI chrome (borders, backgrounds, hover, icon text colors) where `gray-*` was used incidentally. Migrate 1:1 to `slate-*` equivalents during page refactors:

| File | Count | Migration phase |
|---|---|---|
| `features/uy-thac-dieu-tra/UyThacDieuTraListPage.tsx` | 52 | PR3 — full UTDT refactor (entire page rewritten as ListPageShell consumer, gray-* removed by replacement) |
| `pages/cases/CaseFormPage/CaseProvenancePicker.tsx` | 21 | Out of scope for ListPageShell (form picker, not list page) — defer to follow-up |
| `components/HoSoJourney/HoSoJourney.tsx` | 20 | Out of scope (journey component, not list page) — defer |
| `features/document-numbers/components/TemplateFormModal.tsx` | 18 | Out of scope (modal, not list page) — defer |
| `features/journey/JourneyNavigator.tsx` | 15 | Out of scope (journey component) — defer |
| `features/document-numbers/pages/DocumentNumberSettingsPage.tsx` | 15 | Out of scope (settings page, not list page) — defer |
| `pages/kpi/KpiDashboardPage.tsx` | 13 | Out of scope (dashboard, not list page) — defer |
| `features/journey/HoSoJourneyPage.tsx` | 8 | Out of scope — defer |
| `pages/journey/JourneyPage.tsx` | 8 | Out of scope — defer |
| `pages/cases/CaseFormPage/CaseFormTab1UyThac.tsx` | 6 | Out of scope (form tab) — defer |
| `components/DocNumberPreviewField.tsx` | 6 | Out of scope (form field) — defer |
| `pages/cases/CaseFormPage/tabs.tsx` | 4 | Out of scope — defer |
| `pages/cases/CaseJourneyStandalonePage.tsx` | 2 | Out of scope — defer |
| `features/uy-thac-dieu-tra/PrintMau59.tsx` | 2 | Out of scope (print template) — defer |
| `features/uy-thac-dieu-tra/PrintMau60.tsx` | 2 | Out of scope (print template) — defer |
| `pages/workflow/CaseExchangePage.tsx` | 1 | Out of scope — defer |

## Scope decision for PR1-PR3 (ListPageShell project)

- **In scope:** All 10 list pages migrated via ListPageShell refactor (gray-* eliminated by structural replacement, not grep)
- **In scope:** 3 semantic tokens added to `styles.ts` (`STATUS_ARCHIVED`, `STATUS_PENDING_RESPONSE`, `STATUS_NOT_PROSECUTED`)
- **Out of scope:** Non-list-page components (forms, journey, settings, dashboards, modals) — defer to follow-up cleanup PR with separate naming convention audit

## ESLint guard

After PR3, add `eslint-plugin-tailwindcss` rule or custom AST rule:

```js
// eslintrc.json snippet
"no-restricted-syntax": [
  "error",
  {
    "selector": "Literal[value=/\\b(bg|text|border|ring|divide|placeholder)-gray-\\d+\\b/]",
    "message": "Use slate-* for neutral colors or named semantic tokens (STATUS_ARCHIVED, STATUS_PENDING_RESPONSE, STATUS_NOT_PROSECUTED) from constants/styles.ts"
  }
]
```

**Allowlist:** Files in `out-of-scope` table above keep existing `gray-*` until their own refactor PR.

## Acceptance for PR1

- [ ] 3 semantic tokens added to `styles.ts`
- [ ] 5 listed references migrated to named tokens
- [ ] No NEW `gray-*` introductions in PR1 diff (manual review at commit)

## Acceptance for PR3 (UTDT refactor)

- [ ] All 52 UTDT `gray-*` instances removed (page entirely refactored)
- [ ] ESLint guard active with allowlist for out-of-scope files
