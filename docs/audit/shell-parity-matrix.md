# Shell Parity Matrix — Legacy (git 2cbdd90) vs Current Shells

**Updated**: 2026-08-25 after v0.73.0.0 (danh sách theo bố cục hệ cũ). Trước đó: 2026-08-24 (v0.72), 2026-05-30 (v0.66).
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

## v0.72.0.0 — Sắp xếp danh sách (feat/list-sort-newest-first)

Bổ sung năng lực MỚI cho cả ba shell, không có ở bản cũ (legacy `2cbdd90` cũng không có):

| Năng lực | Cases | Incidents | Petitions | Ghi chú |
|---|---|---|---|---|
| Bấm tiêu đề cột để sắp | ✅ | ✅ | ✅ | `ColumnDef.sortKey` + `SortableHeader`, có `aria-sort` |
| Thứ tự lưu trong địa chỉ trang | ✅ | ✅ | ✅ | `useListSort` (tiền tố riêng mỗi shell) |
| Sắp mặc định mới→cũ theo ngày nhận | ✅ `ngayDeXuat` | ✅ `ngayDeXuat` | ✅ `receivedDate` | trước đây cả ba dùng `createdAt` |
| Cột "Ngày tiếp nhận" | ✅ THÊM MỚI | ✅ THÊM MỚI | ✅ đã có ("Ngày nhận") | |
| Cột "Ngày tạo" | ✅ đã có | ✅ đã có | ✅ THÊM MỚI | có chú giải: hồ sơ di trú cùng một ngày |
| Đánh dấu ngày phi lý | ✅ | ✅ | ✅ | `DateCell`, ngoài khoảng 1900–2100 |

**Không xoá năng lực nào.** Mọi hành động và bộ lọc sẵn có giữ nguyên; thay đổi chỉ thêm
cột và khả năng sắp xếp.

Cơ sở chọn trường sắp (đo trên dữ liệu thật 2026-08-24): `createdAt` giống hệt nhau ở toàn
bộ hồ sơ di trú (45.459 đơn thư và 4.713 vụ việc cùng MỘT ngày), nên không dùng được.
`cases.receiveDate` chỉ có 2/3.304 hồ sơ → phải dùng `ngayDeXuat` (98,8%).

## v0.73.0.0 — Danh sách theo bố cục hệ cũ (feat/danh-sach-giong-he-cu)

Cán bộ vừa chuyển sang hệ mới yêu cầu ba trang danh sách **giống hệ cũ**. Đối chiếu ảnh
chụp hệ cũ cho thấy khoảng cách nằm ở GIAO DIỆN, không ở dữ liệu: mọi cột hệ cũ đều đã có
sẵn trong cơ sở dữ liệu, chỉ là không được hiện.

### Cột bổ sung

| Cột hệ cũ | Cases | Incidents | Petitions | Nguồn dữ liệu · độ phủ thật (25/08) |
|---|---|---|---|---|
| **Tóm tắt nội dung** | ✅ THÊM MỚI | ✅ THÊM MỚI | ✅ THÊM MỚI | `moTaChiTiet` 98% · `description` 99,98% · `summary` 99,99% |
| Nguồn đơn/Đơn vị giao | — | — | ✅ THÊM MỚI | `nguonDon` 99,9% |
| Kết quả xử lý, giải quyết khác | — | ✅ THÊM MỚI | ✅ THÊM MỚI | `ketQuaXuLy` 54% · `ketQuaXuLyKhac` 24% |
| Người nhập | ✅ THÊM MỚI | ✅ THÊM MỚI | ✅ THÊM MỚI | `createdBy` · `canBoNhap` · `enteredBy` |
| Thao tác chuyển về CUỐI bảng | ✅ | ✅ | ✅ | trước đây ở ĐẦU; hệ cũ để cuối |
| Mã hồ sơ hiện dạng ngắn `26-11171` | ✅ | ✅ | ✅ | `formatHoSoCode` — chỉ đổi HIỂN THỊ, dữ liệu giữ nguyên |

### Bộ lọc bổ sung — `LegacyFilterPanel` (thẻ hai vế theo hệ cũ)

| Ô lọc | Cases | Incidents | Petitions | Cột máy chủ |
|---|---|---|---|---|
| STT (nhận cả `26-…` lẫn `2026-…`) | ✅ | ✅ | ✅ | `caseCode` · `code` · `stt` |
| STT cũ | ✅ | ✅ | ✅ | `sttCu` (đã có chỉ mục) |
| Cán bộ nhập | ✅ `createdById` | ✅ `canBoNhapId` (ĐÃ CÓ SẴN) | ✅ `enteredById` | cột thật của từng module |
| Từ ngày · Đến ngày | ✅ | ✅ | ✅ | dùng lại bộ lọc ngày sẵn có |
| Chọn khoảng thời gian (5 mốc) | ✅ | ✅ | ✅ | thuần frontend, ghi vào hai ô ngày |

### KHÔNG xoá năng lực nào

Chip trạng thái, thẻ thống kê bấm-để-lọc, sắp xếp theo cột, chọn nhiều dòng — **giữ nguyên
toàn bộ**. Anh chốt rõ: giống hệ cũ về nội dung và bảng lọc, nhưng không đánh đổi năng lực
mới lấy giao diện cũ. Có ca kiểm hồi quy chốt điều này ở cả ba shell.

### Cố ý KHÔNG dựng

- **Ô "Từ khóa" trong thẻ lọc** — thanh công cụ ngay trên đã có ô tìm kiếm; hai ô tìm trên
  một màn hình gây nhầm chứ không tiện.
- **"Đã chuyển đội khác"** và **"Tìm trường bỏ trống"** — hệ mới chưa có khái niệm tương
  đương; dựng theo phỏng đoán sẽ cho kết quả lọc sai mà cán bộ không biết.

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
| Xuất Word hàng loạt | ✅ v0.70.3.0 — **chuyển** từ dropdown header sang BulkActionBar (`export-word`) |

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

---

## v0.70.3.0 — Xuất Word hàng loạt: DỜI vị trí + MỞ RỘNG (có đổi parity)

**Chỉ ảnh hưởng `PetitionListPageShell`.** Đây là thay đổi parity thật, không phải
refactor, nên ghi nhận đầy đủ:

**Gỡ khỏi header:** dropdown "Xuất Word (N)" màu hổ phách (`FileText` + `ChevronDown`,
danh sách 7 mã cứng từ `features/petitions/docTypes.ts` — file này đã xoá vì mồ côi).
Dropdown chỉ chọn được **1 mẫu** cho N đơn.

**Thêm vào thanh chọn:** bulk action `export-word` ("Xuất Word", `variant:'outline'`,
quyền `petitions/view`). Bấm → mở `BatchExportDocumentsModal` chọn **nhiều mẫu một
lượt** (danh sách lấy ĐỘNG từ CSDL qua `listExportTemplates`) → 1 file ZIP.

**Không mất tính năng nào**: modal mới là bản mở rộng thực sự của dropdown cũ
(1 mẫu → M mẫu). Để cả hai lối vào sẽ gây rối vì chúng làm hai việc khác nhau.

**Cột / bộ lọc / chip: KHÔNG đổi.** Các shell còn lại (Cases, Incidents,
Comprehensive) **không đụng tới** — `export-word` chỉ bật khi adapter được truyền
`onExportWord`, mặc định tắt.

**Hạ tầng bulk dùng chung có thêm 1 field optional** `BulkAction.skipConfirm`
(bỏ hộp xác nhận cho action tự mở UI kế tiếp). `undefined` → hành vi cũ nguyên vẹn,
nên 5 màn đang dùng `BulkActionBar` không đổi parity.

---

## v0.70.4.0 — Thẻ thống kê bấm được để lọc (có đổi parity, cả 3 shell)

**Ảnh hưởng CẢ BA shell**: `CaseListPageShell`, `IncidentListPageShell`,
`PetitionListPageShell`. Đây là thay đổi parity thật, không phải refactor.

**Thêm — thanh thẻ thống kê (`StatsCardsStrip`) nay là bộ lọc:** bấm thẻ lọc danh sách
theo nhóm trạng thái tương ứng. Thẻ đang chọn nổi bật và `aria-disabled` (không bấm lại);
thẻ "Tổng" bấm để bỏ lọc. Nút Back của trình duyệt quay lại được bộ lọc trước
(`useListPageUrlState` thêm tuỳ chọn `history:'push'`).

| Shell | Param lọc | Nguồn số trên thẻ |
|---|---|---|
| Vụ án | `cases_statusGroup` (mới) | `/cases/stats` → `byGroup` |
| Đơn thư | `petitions_statusGroup` (mới) | `/petitions/stats` → `byGroup` |
| Vụ việc | `incidents_phase` (**sẵn có**, không thêm param) | `/incidents/stats` → `byGroup` |

**Gỡ khỏi bộ lọc nâng cao** (đều đang gây lỗi 400 vì param không có trong DTO):
- Đơn thư: field `status` — ghi trùng key `petitions_status` của thanh chip, là gốc rễ
  param `advancedStatus`. Lọc theo trạng thái nay dùng thanh chip hoặc thẻ.
- Vụ việc: field `keyword` — trùng chức năng với ô tìm kiếm trên thanh công cụ.

**Đổi tên param cho khớp DTO** (không đổi giao diện): `sender`→`senderName`,
`investigator`→`investigatorName`, `unit`→`donViGiaiQuyet` (Vụ việc). Thêm `charges`
(Vụ án) và `reporter` (Vụ việc, tra CCCD/SĐT) vào DTO.

**Cột / chip / bulk action: KHÔNG đổi.** `StatsCardsStrip` chỉ bấm được khi trang truyền
`onCardSelect`, nên 16+ trang khác đang dùng component này giữ nguyên DOM.
`StatusChips` thêm prop optional `groupActive` (chip "Tất cả" không sáng khi đang lọc
theo nhóm) — optional nên không đổi parity của shell nào khác.
