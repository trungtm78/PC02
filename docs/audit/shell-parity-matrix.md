# Shell Parity Matrix — Legacy (git 2cbdd90) vs Current Shells

**Updated**: 2026-05-30 after v0.66 ship (PR1-PR4 complete).
**Truth-of-record**: legacy commit `2cbdd90` (parent of `a8016b6` v0.57.0.0 deletion).
**Method**: testid extraction + registry inspection.

## Status v0.66 (chain complete)

- ✅ Cases (v0.63 PR1b): 8 actions + 5 filters via casesRowActions + casesListFilters.
- ✅ Incidents (v0.64 PR2): 4 actions + 4 filters. Transition+Prosecute → PR2-bis.
- ✅ Petitions (v0.65 PR3): 4 actions + 5 filters. Archive+Convert → PR3-bis.
- ✅ Comprehensive (v0.66 PR4): 3 polyglot actions (dispatched by row.recordType) + 5 filters.

## CI Gate (this file = process fix)

`.github/workflows/shell-parity-gate.yml`:
- Any PR modifying `*ListPageShell.tsx` MUST also update this matrix file.
- Bypass: `[parity-skip]` in PR title for refactor-only changes.

## Summary (original audit, retained for reference)

| Page | Legacy actions | Legacy filters | Shell actions | Shell filters | MISSING |
|---|---|---|---|---|---|
| Cases | 8 | 5 | **0** | **0** | 13 |
| Incidents | 8 | 1+ | **0** | **0** | 9+ |
| Petitions | 9 | 5 | **0** | **0** | 14 |
| Comprehensive | 3 | 0 (visible) | **0** | **0** | 3 |
| **TOTAL** | **28** | **11+** | **0** | **0** | **39+** |

> Note: v0.61 restored *bulk* actions (export, assign, delete, restore) + chip counts. Matrix below tracks **single-row** actions + **advanced filters** only — those are still missing.

---

## Cases (`/cases`)

### Single-row actions

| testid (legacy) | Action | Status guard | Permission | Current shell | Status |
|---|---|---|---|---|---|
| `btn-view-{id}` | View detail (Eye) | — | — | ❌ missing | NEEDED |
| `btn-edit-{id}` | Edit (Pencil) | — | canEdit | ❌ missing | NEEDED |
| `btn-assign-{id}` | Phân công (UserCheck) | — | canDispatch | ❌ missing | NEEDED |
| `btn-manage-defendants-{id}` | Quản lý bị can (Users) | — | — | ❌ missing | NEEDED |
| `btn-manage-lawyers-{id}` | Quản lý luật sư (Briefcase) | — | — | ❌ missing | NEEDED |
| `btn-conclusion-{id}` | Kết luận điều tra (FileText) | — | — | ❌ missing | NEEDED |
| `btn-transfer-{id}` | Chuyển xử lý (ArrowRightLeft) | — | — | ❌ missing | NEEDED |
| `btn-delete-{id}` | Xóa vụ án (Trash2) | TIEP_NHAN only | canDelete | ❌ missing | NEEDED |

### Advanced filters

| testid (legacy) | Field | Type | Current shell | Status |
|---|---|---|---|---|
| `filter-from-date` | Từ ngày | date | ❌ missing | NEEDED |
| `filter-to-date` | Đến ngày | date | ❌ missing | NEEDED |
| `filter-unit` | Đơn vị | text | ❌ missing | NEEDED |
| `filter-investigator` | Điều tra viên | text | ❌ missing | NEEDED |
| `filter-charges` | Tội danh | text/FKSelect | ❌ missing | NEEDED |

### Header actions (verify shell has)

| testid (legacy) | Action | Current shell |
|---|---|---|
| `btn-refresh` | Refresh | ✅ via PageHeader |
| `btn-add-case` | Tạo mới | ✅ via PageHeader |
| `btn-advanced-filter` | Toggle Bộ lọc nâng cao | ❌ missing (no filter panel exists) |

### Delete modal

| testid (legacy) | Element | Current shell |
|---|---|---|
| `btn-cancel-delete` | Modal cancel button | ❌ missing (no delete UI) |
| `btn-confirm-delete` | Modal confirm button | ❌ missing (no delete UI) |

---

## Incidents (`/incidents`)

### Single-row actions

| testid (legacy) | Action | Current shell | Status |
|---|---|---|---|
| `btn-view-{id}` | View | ❌ missing | NEEDED |
| `btn-edit-{id}` | Edit | ❌ missing | NEEDED |
| `btn-assign` | Phân công | ❌ missing | NEEDED |
| `btn-transition` | Chuyển trạng thái | ❌ missing | NEEDED |
| `btn-confirm-transition` | Modal confirm transition | ❌ missing | NEEDED |
| `btn-prosecute` | Khởi tố | ❌ missing | NEEDED |
| `btn-confirm-prosecute` | Modal confirm prosecute | ❌ missing | NEEDED |
| `btn-delete` | Xóa | ❌ missing | NEEDED |
| `btn-action-menu` | ⋮ kebab | ❌ missing | NEEDED |

### Advanced filters

| testid (legacy) | Field | Current shell | Status |
|---|---|---|---|
| `filter-keyword` | Từ khóa | ❌ missing | NEEDED |
| (also need): `filter-loai-don-vu` enum | TO_GIAC \| TIN_BAO \| KIEN_NGHI_KHOI_TO | ❌ missing | NEEDED |
| (also need): `filter-reporter` | Người tố giác | ❌ missing | NEEDED |
| (also need): `filter-unit` | Đơn vị | ❌ missing | NEEDED |
| `btn-advanced-search` | Toggle advanced filter | ❌ missing | NEEDED |

### Header / bulk

| testid | Status |
|---|---|
| `btn-add-incident` | ✅ via PageHeader |
| `btn-refresh` | ✅ via PageHeader |
| `btn-export` | ✅ via v0.61 BulkActionBar |

---

## Petitions (`/petitions`)

### Single-row actions

| testid (legacy) | Action | Current shell | Status |
|---|---|---|---|
| `btn-view-{id}` | View | ❌ missing | NEEDED |
| `btn-edit-{id}` | Edit | ❌ missing | NEEDED |
| `btn-assign` | Phân công | ❌ missing | NEEDED |
| `btn-archive` | Lưu trữ | ❌ missing | NEEDED |
| `btn-convert-case` | Chuyển thành vụ án | ❌ missing | NEEDED |
| `btn-confirm-convert-case` | Modal confirm | ❌ missing | NEEDED |
| `btn-convert-incident` | Chuyển thành vụ việc | ❌ missing | NEEDED |
| `btn-confirm-convert-incident` | Modal confirm | ❌ missing | NEEDED |
| `btn-delete-{id}` | Xóa | ❌ missing | NEEDED |
| `btn-action-menu` | ⋮ kebab | ❌ missing | NEEDED |

### Advanced filters

| testid (legacy) | Field | Current shell | Status |
|---|---|---|---|
| `filter-from-date` | Từ ngày | ❌ missing | NEEDED |
| `filter-to-date` | Đến ngày | ❌ missing | NEEDED |
| `filter-sender` | Người gửi | ❌ missing | NEEDED |
| `filter-status` | Trạng thái | ❌ missing | NEEDED |
| `filter-unit` | Đơn vị | ❌ missing | NEEDED |
| `btn-advanced-search` | Toggle | ❌ missing | NEEDED |

### Header / bulk

| testid | Status |
|---|---|
| `btn-add-petition` | ✅ via PageHeader |
| `btn-refresh` | ✅ via PageHeader |
| `btn-export` | ✅ via v0.61 BulkActionBar |
| `btn-batch-export` | ✅ via v0.61 BulkActionBar |
| `btn-batch-clear` | ✅ via v0.61 useBulkSelection |
| `btn-guide` | ✅ giữ trong shell (verify) |

---

## Comprehensive (`/comprehensive`)

### Single-row actions (polyglot: row type ∈ Case/Incident/Petition)

| testid (legacy) | Action | Current shell | Status |
|---|---|---|---|
| `btn-edit-{id}` | Edit (route per type) | ❌ missing | NEEDED |
| `btn-delete-{id}` | Xóa (route per type) | ❌ missing | NEEDED |
| `btn-transfer-{id}` | Chuyển xử lý | ❌ missing | NEEDED |

### Filters

Legacy Comprehensive had 7 filter fields (FilterData interface lines 29-36):
- `quickSearch`, `fromDate`, `toDate`, `district`, `status`, `createdBy`, `type`

All ❌ missing trong shell.

---

## Cross-cutting v0.61 baselines (must NOT regress)

| Feature | testid pattern | Verify still works after PR1b |
|---|---|---|
| Bulk checkbox header | `bulk-select-all` | ✅ |
| Bulk checkbox row | `bulk-select-row-{id}` | ✅ |
| Status chips | `status-chip-{value}` | ✅ chip counts visible |
| Bulk action bar | `bulk-action-bar` | ✅ appears when selected |
| Bulk export | `bulk-action-export` | ✅ |
| Bulk delete | `bulk-action-delete` | ✅ |

---

## A11y gaps (Claude finding #8 — pre-existing in `ActionMenuPortal`)

| Feature | Status | Fix in PR1a |
|---|---|---|
| Escape closes menu | ✅ exists | — |
| Click outside closes | ✅ exists | — |
| Arrow Up/Down nav | ❌ missing | YES |
| Focus first item on open | ❌ missing | YES |
| Return focus to anchor on close | ❌ missing | YES |
| `role="menu"` + `role="menuitem"` | unverified | YES |
| Focus visible ring on items | unverified | YES |

---

## Action Plan (PR mapping)

- **PR1a (v0.62.0.0)**: Build registry infra + Modal Providers + a11y patch. Wire Lawyers + Subjects (existing, low-risk) as canary. NO new actions on Cases yet — canary validates pattern.
- **PR1b (v0.62.1.0)**: Register 8 Cases actions + 5 Cases filters. Wire CaseListPageShell. ✅ Anh's complaint #1 + #2 resolved for Cases.
- **PR2 (v0.63.0.0)**: Register 8 Incidents actions + 4 Incidents filters.
- **PR3 (v0.64.0.0)**: Register 9 Petitions actions + 5 Petitions filters.
- **PR4 (v0.65.0.0)**: Register 3 Comprehensive actions (polyglot) + 7 Comprehensive filters.
- **PR5 (v0.65.1.0)**: husky pre-commit + CI workflow blocking future swap PRs without parity matrix update. Also: implement `scripts/audit-shell-parity.mjs` (ts-morph) for automated matrix generation.

## Acceptance criteria

After all PRs ship, this matrix must show **0 ❌ missing** rows for Cases/Incidents/Petitions/Comprehensive single-row actions + advanced filters. Bulk + chip baselines must remain ✅.

---

## v0.70.0.0 — Phím tắt danh sách (cross-cutting, không đổi feature parity)

Bổ sung hook `useListShortcuts` (Alt+N thêm mới, Alt+R làm mới, Ctrl+K tìm kiếm)
**đồng nhất** cho cả 4 shell (Cases, Comprehensive, Incidents, Petitions) +
sửa 1 comment stale trong `PetitionListPageShell`. Đây là hành vi bàn phím
xuyên suốt, **không thêm/bớt cột/lọc/bulk-action** nên **không thay đổi ma trận
parity** ở trên — ghi nhận ở đây để thỏa gate `shell-parity-gate`.

---

## v0.70.0.3 — Gợi ý phím tắt cạnh nút (cross-cutting, không đổi feature parity)

Thêm `<ShortcutHint action="newRecord" />` (hiện `<kbd>Alt+N</kbd>`) cạnh nút
"Tạo mới" ở cả 4 shell (Cases, Comprehensive, Incidents, Petitions). Chỉ là gợi
ý phím tắt hiển thị, **không thêm/bớt cột/lọc/bulk-action** nên **không đổi ma
trận parity** — ghi nhận để thỏa gate `shell-parity-gate`.
