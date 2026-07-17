# PROGRESS — Sửa form Đăng ký đơn thư + danh mục "Đơn vị"

Nhánh: `feat/donthu-form-donvi`. Plan: `~/.claude/plans/h-y-ph-n-t-ch-to-n-floofy-fairy.md`.
Mục tiêu: 6 yêu cầu chỉnh form đơn thư + danh mục `DON_VI`. Chỉ làm LOCAL, chưa deploy.

## Milestones
- [ ] **M1 — Backend**: schema (`thuocThamQuyen Boolean @default(true)`, `donViXuLy String?`) + migration + DTO (create/update) + builder + service map. TDD.
- [ ] **M2 — Danh mục DON_VI**: seed `seed-directory-types.ts` + nhãn FE `DirectoriesPage.tsx`.
- [ ] **M3 — Frontend form** (`PetitionFormPage.tsx`):
  - YC1 auto-fill ngayTiepNhanNguonTin/ngayDeXuat khi set receivedDate (nếu trống)
  - YC2 ẩn `summary`, đổi nhãn detailContent → "Nội dung *", bỏ validate summary, saveOnly set summary=detailContent.slice(0,300)
  - YC3 focus field trống đầu tiên khi lưu lỗi + Shift+Enter nhảy field trống kế (chỉ khi còn field trống)
  - YC5 `unit` FKSelect directoryType ORG→DON_VI, cho phép trống=PC02 (hint)
  - YC6 checkbox `thuocThamQuyen` + ô "Đơn vị xử lý" (check→Teams→assignedTeamId; uncheck→DON_VI→donViXuLy) ở section phiếu đề xuất
  - hook `useTeamOptions()`
- [ ] **M4 — Tests + verification**: jest backend, vitest FE, tsc -b, chạy app kiểm thử tay.

## Quyết định / Assumptions đã tự chốt
- summary: khi lưu tự gán = detailContent (cắt 300) để list có tóm tắt; bỏ bắt buộc.
- YC6 checkbox áp cho ô "Đơn vị xử lý" MỚI (không phải "Đơn vị tiếp nhận"); "Đơn vị tiếp nhận" theo YC5 nạp DON_VI, cho phép trống.
- "Đơn vị xử lý" nội bộ (thuộc thẩm quyền) lưu vào `assignedTeamId` (FK Team sẵn có) — tái dùng, chấp nhận trùng ý nghĩa với auto-assign ward; nếu vỡ DataScope sẽ tách field riêng.
- Shift+Enter chỉ điều hướng khi CÒN field bắt buộc trống; nếu đã đủ → để hành vi mặc định (xuống dòng trong textarea).
- `unit` đổi ORG→DON_VI: đơn cũ có unit=ORG name sẽ hiển thị giá trị thô (FKSelect show raw) — chấp nhận, đơn mới dùng DON_VI.

## Trạng thái hiện tại
- ✅ M1 Backend DONE: 2 cột (thuocThamQuyen/donViXuLy), migration 20260717000100 (applied+resolved), DTO+builder+service, tests (builder 10, dto 34, petitions 151) xanh, tsc 0.
- ✅ M2 Danh mục DON_VI DONE: seed 5 đơn vị (verified), nhãn FE + priority.
- ✅ M3 Frontend DONE: YC1 auto-fill, YC2 ẩn summary+nhãn "Nội dung", YC3 focus+Shift+Enter theo field lỗi, YC5 unit→DON_VI+hint, YC6 checkbox+Đơn vị xử lý (Team↔DON_VI), hook useTeamOptions. tsc -b 0.
- ✅ M4 Tests DONE: FE petitions+hooks 129 xanh (+6 test mới YC1/2/6); sửa test cũ bỏ field-summary.
- ✅ Verify LIVE (Playwright): auto-fill 2 ngày, summary ẩn, nhãn Nội dung, unit=DON_VI, đơn vị xử lý Team(checked)↔DON_VI(uncheck), focus=senderName khi lưu thiếu, tạo đơn thật persist thuocThamQuyen=false+donViXuLy trong DB.
- ✅ /code-review: bắt bug edit-mode (reuse assignedTeamId). SỬA: YC6 ghi `donViXuLy` cả 2 nhánh (f1b98d0). Verified DB.
- ✅ /codex (cross-model): bắt YC1 chỉ chạy onChange → chấp nhận ngày mặc định thì 2 ngày trống. SỬA: init today() + mirror-logic (fd792b7). Verified LIVE: chấp nhận mặc định → cả 3 ngày = today.

## HOÀN TẤT — sẵn sàng cho anh review local (chưa deploy)
- Commits nhánh feat/donthu-form-donvi: 8382913 (feature), f1b98d0 (fix review), fd792b7 (fix codex).
- Tests: BE petitions 151, FE petitions+hooks 130, tsc BE/FE = 0. Verified LIVE cả create thuộc/không thuộc thẩm quyền + auto-fill + focus lỗi.
- App dev đang chạy BE:3000 FE:5173 để anh mở /petitions/new kiểm tra.

---
# PROGRESS 2 — Phím tắt toàn hệ thống (F2/F3/F4)
Plan: `~/.claude/plans/h-y-ph-n-t-ch-to-n-floofy-fairy.md`. Hạ tầng phím tắt ĐÃ CÓ SẴN (registry/useShortcut/DB per-user/Settings/cheat-sheet) — task = hoàn thiện.
- ✅ Pha 1a: registry.ts — save=F2, delete=F3(scope global), exportDocx=F4 MỚI; fireInInputs cho 3 action (R7); test guard chống trùng binding. registry test 28 xanh.
- ✅ Pha 1b: hook `useFormShortcuts` (DRY) + `useDeleteResourceModalSafe` (no-throw). test 5 xanh.
- ✅ Pha 1c: nối 3 form (Petition/Incident/Case). tsc 0, 272 test xanh. Verify LIVE: F2 lưu-trong-input, F4 export, F3 delete (edit), F3 no-op (create).
- NEXT: Pha 2 nối danh sách (list shell), Pha 3 chi tiết + ShortcutHint. Rồi /codex + commit tổng.
- App dev BE:3000 FE:5173 đang chạy.
- ✅ Pha 2: useListShortcuts + 4 list shell (Alt+N/Alt+R/Ctrl+K). commit f6c460f. Verified LIVE.
- ✅ /codex: bắt 2 bug → fix (b1aa32e): (1) F3 xóa gate theo TIEP_NHAN (case/incident) khớp rule list; (2) ConvertPetitionModal thêm role=dialog để modal-guard chặn shortcut nền.
- ✅ Pha 3: chi tiết page KHÔNG có action export/delete cấp hồ sơ (nằm ở form/list) → không cần nối; ShortcutHint bỏ (cheat-sheet `?` + trang cấu hình đã đủ discoverability).
- Bug có sẵn (ĐÃ BÁO, chưa sửa - ngoài scope): IncidentFormPage:292 getPhaseForStatus(status) dùng window.status toàn cục.

## HOÀN TẤT phím tắt — commits: 38019a4, f6c460f, b1aa32e (nhánh feat/donthu-form-donvi)
- Forms: F2 Lưu, Esc Hủy, F4 In chứng từ, F3 Xóa (gate trạng thái) — chạy CẢ khi con trỏ trong field.
- Lists: Alt+N thêm mới, Alt+R làm mới, Ctrl+K tìm kiếm.
- User tự cấu hình tại Settings → Phím tắt (đã có sẵn), cheat-sheet phím `?`.
- Tests xanh (registry/useFormShortcuts/useListShortcuts/form/list/settings), tsc 0.

---
# PROGRESS 3 — Fix Alt+N + thêm resetForm (init màn hình)
- Nguyên nhân "Alt+N/thêm mới không chạy": action list thiếu fireInInputs → bị nuốt khi con trỏ trong ô tìm kiếm (useShortcut.ts:84).
- ✅ registry: fireInInputs cho newRecord/refreshList/export; thêm action resetForm (F8, form, fireInInputs). Test 30 xanh.
- ✅ useFormShortcuts: +onReset; 3 form (Petition/Incident/Case) reset về INITIAL_FORM (confirm, xóa errors/state phụ, không rời trang).
- ✅ Nối Alt+N cho Ủy thác (UyThacDieuTraListPage). Bỏ Alt+R dashboard (tránh vỡ DashboardPage.test bare-render). Sửa comment stale PetitionListPageShell:13.
- ✅ Tests: registry/useFormShortcuts + wrap uy-thac test QueryClient. tsc 0. 269 form/list + 112 shortcut/hook xanh.
- ✅ Verify LIVE: Alt+N từ trong ô tìm kiếm → /petitions/new; F8 → form về trắng.
- Follow-up (ghi nhận): trang admin tạo-qua-modal (users/teams/danh-muc...) chưa nối Alt+N (mỗi trang handler modal riêng).
- ✅ /codex bắt 3 bug F8 reset → FIX: edit-mode reset giữ id → F2 ghi đè bản ghi cũ bằng dữ liệu trắng; case sót subjects/vật chứng/media; petition sót file đính. Fix đồng nhất: EDIT→navigate route tạo mới (không ghi đè); CREATE→window.location.reload() (sạch mọi state kể cả file đính). Verified LIVE.
- Alt+N và mọi phím tắt ĐỀU đổi được theo user tại Settings → Phím tắt (đã xác nhận với anh).
