# UAT coverage — Đồng bộ Vụ việc với Đơn thư

Ngày chạy: 2026-09-29
Phạm vi: Web, form và danh sách Vụ việc; thanh thao tác dùng chung cho Đơn thư, Vụ việc, Vụ án và Ủy thác điều tra.
Oracle: `docs/superpowers/specs/2026-09-29-incident-parity-and-action-bar.md`.

## Form

| Mã | Tiêu chí nghiệm thu | Bằng chứng tự động | Trạng thái |
|---|---|---|---|
| I-F01 | Tạo Vụ việc và lưu lại các trường nghiệp vụ | `IncidentFormPage.test.tsx`; `incidents.service.spec.ts` create | PASS |
| I-F02 | Mở, sửa, lưu và tải lại hồ sơ; giữ optimistic lock mới | `IncidentFormPage.test.tsx`; `incidents.service.spec.ts` update/locking | PASS |
| I-F03 | Nguồn đơn dùng `NGUON_DON`, tìm máy chủ và tạo nhanh | `IncidentFormPage.petition-parity.test.tsx` | PASS |
| I-F04 | Đơn vị giải quyết dùng `DON_VI`, tìm/tạo nhanh và giữ tên lịch sử | `IncidentFormPage.petition-parity.test.tsx`; `FKSelect.taoNhanh.test.tsx` | PASS |
| I-F05 | Nguồn Trực tiếp mở nhóm CCCD; nguồn khác thu nhóm rỗng; không xóa dữ liệu | `IncidentFormPage.petition-parity.test.tsx`; `nhomOGap.test.tsx` | PASS |
| I-F06 | Gợi ý người cung cấp tin dùng `benVu` và giữ phạm vi dữ liệu | `RecordNameSuggestions.test.tsx`; `incidents.service.spec.ts` reporter suggestions | PASS |
| I-F07 | Rà trùng đa tín hiệu, giải thích lý do và bắt xác nhận ứng viên mạnh | `RecordDuplicateReview.test.tsx`; `incidents.service.spec.ts` duplicate review | PASS |
| I-F08 | Tạo mới từ hồ sơ hiện tại sao chép dữ liệu người dùng, loại metadata hệ thống | `clone-incident-state.test.ts`; `clone-incident-navigation.test.tsx` | PASS |
| I-F09 | Thanh thao tác theo thứ tự Hủy → Tạo mới → In → Lưu và có Lưu tạm trong menu | `FormActionBar.test.tsx`; `SaveSplitButton.test.tsx`; `IncidentFormPageExport.test.tsx` | PASS |
| I-F10 | Chế độ xem dùng cùng form, khóa ghi nhưng vẫn cho tab, in và sao chép theo quyền | `formSuaChiXem.test.tsx`; `chiXemAnNutGhi.test.tsx` | PASS |
| I-F11 | Thử lại POST cùng khóa không tạo Vụ việc thứ hai, kể cả race sau commit | `create-idempotency.test.tsx`; `incidents.service.spec.ts` idempotency race | PASS |
| I-F12 | Upload lỗi một phần giữ tệp lỗi và thử lại trên cùng `effectiveId` | `stage-upload-retry.test.tsx`; `EntityDocumentsTab.test.tsx` | PASS |
| I-F13 | Cập nhật chung không đổi phân công; command phân công kiểm quyền và thành viên tổ | `incidents.service.spec.ts` assignment fields/assign; `incidents.quyen-ghi.spec.ts` | PASS |
| I-F14 | Sửa kết quả dùng endpoint hẹp; chuyển trạng thái có side effect dùng command nghiệp vụ | `incidents-result.service.spec.ts`; `incidents-transitions-service.expert.spec.ts` | PASS |
| I-F15 | Lỗi validation/409/403 hiển thị đúng; submit đồng thời bị chặn | `IncidentFormPage.test.tsx`; `chongBamHaiLan.test.tsx`; controller/service specs | PASS |

## Danh sách

| Mã | Tiêu chí nghiệm thu | Bằng chứng tự động | Trạng thái |
|---|---|---|---|
| I-L01 | Danh sách dùng shell, toolbar và thứ tự cột thống nhất | `IncidentListPageShell.test.tsx` | PASS |
| I-L02 | Tìm kiếm dạng thẻ trên mọi cột được phép, gồm cột ẩn | `IncidentListPageShell.test.tsx`; `vu-viec.khai.ts` gate specs | PASS |
| I-L03 | Bộ lọc ghi URL, Back/Forward và reset trang nhất quán | `IncidentListPageShell.test.tsx`; `useListPageUrlState.test.tsx` | PASS |
| I-L04 | Thẻ giai đoạn và chip trạng thái loại trừ nhau; không còn tab giai đoạn trùng | `IncidentListPageShell.test.tsx` | PASS |
| I-L05 | Thống kê dùng cùng bộ điều kiện và cùng kỳ với danh sách | `incidents.service.spec.ts`; incident stats specs | PASS |
| I-L06 | Chọn cột, đổi thứ tự, kéo rộng và mật độ được lưu theo người dùng | `IncidentListPageShell.test.tsx`; ListPageShell layout tests | PASS |
| I-L07 | Sửa nhanh kết quả chỉ hiện khi dòng có `quyenGhi` và dùng optimistic lock | `IncidentListPageShell.test.tsx`; `incidents-result.service.spec.ts` | PASS |
| I-L08 | Thao tác hàng tuân capability máy chủ; merge loại đích terminal/đã merge và chống race | `MergeIncidentModalProvider.test.tsx`; `incidents.service.spec.ts` merge | PASS |
| I-L09 | Chọn hàng/hàng loạt giữ đúng phạm vi khi lọc và phân trang | `IncidentListPageShell.test.tsx`; `useBulkSelection.test.ts` | PASS |
| I-L10 | Excel đang xem mang cùng bộ lọc danh sách | controller/service export specs; `IncidentListPageShell.test.tsx` | PASS |
| I-L11 | Excel mọi trường yêu cầu quyền riêng và dùng đúng tập dữ liệu | `xuat-day-du-vu-viec.spec.ts`; controller full export test | PASS |
| I-L12 | Word hàng loạt giới hạn 100 hồ sơ, kiểm lại scope từng hồ sơ và báo lỗi một phần | `incidents.controller.spec.ts`; `wordBatchActions.test.ts` | PASS |
| I-L13 | `quyenGhi` được máy chủ tính theo từng dòng; UI không suy từ quyền global | `incidents.quyen-ghi.spec.ts`; `IncidentListPageShell.test.tsx` | PASS |
| I-L14 | Loading, error, empty và empty-filtered có trạng thái rõ ràng, thử lại được | `IncidentListPageShell.test.tsx`; ListPageShell banner tests | PASS |
| I-L15 | Tìm ngày EDTF/chữ tự do, sắp xếp và xuất dùng cùng điều kiện | search generator/gate specs; incident list/export service specs | PASS |

## Kết quả cổng tự động

- Backend: 443/443 suite, 6.135/6.135 test PASS; type-check và build PASS; lint toàn bộ tệp backend thay đổi/mới không có lỗi hoặc cảnh báo.
- Frontend: 374/374 tệp, 3.995/3.995 test PASS; lint, type-check và build PASS.
- Patch line coverage trên checkout sạch Frontend: 203/221 = **91,86%**; Backend: 319/354 = **90,11%**; `missingCoverage` bằng 0 ở cả hai phía.
- UAT Playwright trình duyệt/API thật PASS: đăng nhập, tạo Vụ việc, thử lại idempotent, payload khác trả 409, sửa nguồn trực tiếp và CCCD, kiểm tra thứ tự action bar, tạo nhanh và tự chọn Đơn vị giải quyết, cập nhật, sao chép, xác nhận trùng, lưu bản sao, tải lại, tìm kiếm danh sách và xuất Excel.
- Spec Playwright chuẩn được giữ tại `tests/e2e/incident-parity-real-uat.e2e.spec.ts` để chạy trên CI. Runner chuẩn tại máy Windows/Node 24 dừng trước khi khởi tạo worker; runner độc lập dùng cùng browser/API flow đã PASS và được lưu tại `tools/run-incident-parity-uat.mjs`.
- Production smoke và canary được bổ sung sau khi CI merge và deploy bản phát hành này.
