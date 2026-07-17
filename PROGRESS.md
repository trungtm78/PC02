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
