# Kế hoạch triển khai chi tiết

Ước lượng đề xuất 62–87 ngày công. Cập nhật sau M01.

## M01-T01 Khảo sát source và chốt nghiệp vụ

Phụ thuộc: Không. Thành phần: BRD, RBAC, repository. Ước lượng 3–4 ngày công.

RED: Viết fixture và expected độc lập cho khảo sát source và chốt nghiệp vụ.

GREEN: Triển khai vừa đủ cho hành vi và tiêu chí trong contract.

REFACTOR: Giảm trùng lặp, giữ nguyên test hành vi và chạy regression bị ảnh hưởng.

Test: UAT-901. Bằng chứng: Biên bản kiểm tra, artifact/version và môi trường xác minh.

## M01-T02 Spike Excel và chọn engine

Phụ thuộc: M01-T01. Thành phần: parser, grid, formula, license. Ước lượng 4–6 ngày công.

RED: Viết fixture và expected độc lập cho spike excel và chọn engine.

GREEN: Triển khai vừa đủ cho hành vi và tiêu chí trong contract.

REFACTOR: Giảm trùng lặp, giữ nguyên test hành vi và chạy regression bị ảnh hưởng.

Test: IT-902. Bằng chứng: Biên bản kiểm tra, artifact/version và môi trường xác minh.

## M01-T03 Duyệt UX và mẫu nghiệm thu

Phụ thuộc: M01-T01. Thành phần: mockup, design system. Ước lượng 3–4 ngày công.

RED: Viết fixture và expected độc lập cho duyệt ux và mẫu nghiệm thu.

GREEN: Triển khai vừa đủ cho hành vi và tiêu chí trong contract.

REFACTOR: Giảm trùng lặp, giữ nguyên test hành vi và chạy regression bị ảnh hưởng.

Test: UAT-903. Bằng chứng: Biên bản kiểm tra, artifact/version và môi trường xác minh.

## M02-T01 Schema phiên bản và migration

Phụ thuộc: M01-T02. Thành phần: database, storage. Ước lượng 3–4 ngày công.

RED: Viết fixture và expected độc lập cho schema phiên bản và migration.

GREEN: Triển khai vừa đủ cho hành vi và tiêu chí trong contract.

REFACTOR: Giảm trùng lặp, giữ nguyên test hành vi và chạy regression bị ảnh hưởng.

Test: IT-904. Bằng chứng: Biên bản kiểm tra, artifact/version và môi trường xác minh.

## M02-T02 Policy phân quyền báo cáo

Phụ thuộc: M02-T01. Thành phần: authorization, API. Ước lượng 2–3 ngày công.

RED: Viết fixture và expected độc lập cho policy phân quyền báo cáo.

GREEN: Triển khai vừa đủ cho hành vi và tiêu chí trong contract.

REFACTOR: Giảm trùng lặp, giữ nguyên test hành vi và chạy regression bị ảnh hưởng.

Test: IT-012, IT-035, UAT-012, UAT-035. Bằng chứng: API list/detail không lộ dữ liệu; không có write hộ

## M02-T03 Sinh kỳ và deadline

Phụ thuộc: M02-T01. Thành phần: scheduler, clock. Ước lượng 3–4 ngày công.

RED: Viết fixture và expected độc lập cho sinh kỳ và deadline.

GREEN: Triển khai vừa đủ cho hành vi và tiêu chí trong contract.

REFACTOR: Giảm trùng lặp, giữ nguyên test hành vi và chạy regression bị ảnh hưởng.

Test: IT-006, IT-007, IT-008, IT-009, IT-040, UAT-006, UAT-007, UAT-008, UAT-009, UAT-040. Bằng chứng: ngày giờ kỳ khớp fixture; hạn đúng lịch; hạn không lệch năm; chỉ một kỳ được tạo; unique period và hạn đúng

## M03-T01 Parser token và kiểm tra workbook

Phụ thuộc: M01-T02, M02-T01. Thành phần: Excel import. Ước lượng 4–6 ngày công.

RED: Viết fixture và expected độc lập cho parser token và kiểm tra workbook.

GREEN: Triển khai vừa đủ cho hành vi và tiêu chí trong contract.

REFACTOR: Giảm trùng lặp, giữ nguyên test hành vi và chạy regression bị ảnh hưởng.

Test: IT-001, IT-002, IT-003, IT-005, IT-039, UAT-001, UAT-002, UAT-003, UAT-005, UAT-039. Bằng chứng: parser trả schema hoặc lỗi có mã; schema field đúng và lỗi đúng ô; fixture parser pass; field count đúng; lỗi an toàn và log không secret

## M03-T02 Wizard và xuất bản mẫu

Phụ thuộc: M03-T01, M02-T02, M02-T03, M01-T03. Thành phần: Setup UI, publish API. Ước lượng 4–5 ngày công.

RED: Viết fixture và expected độc lập cho wizard và xuất bản mẫu.

GREEN: Triển khai vừa đủ cho hành vi và tiêu chí trong contract.

REFACTOR: Giảm trùng lặp, giữ nguyên test hành vi và chạy regression bị ảnh hưởng.

Test: IT-011, IT-032, IT-041, UAT-011, UAT-032, UAT-041. Bằng chứng: validation + DB unique; kỳ cũ vẫn render v1; lịch sử giữ và số denominator đúng

## M04-T01 Renderer lưới và editor theo kiểu

Phụ thuộc: M03-T01, M01-T03. Thành phần: Register UI, grid. Ước lượng 5–7 ngày công.

RED: Viết fixture và expected độc lập cho renderer lưới và editor theo kiểu.

GREEN: Triển khai vừa đủ cho hành vi và tiêu chí trong contract.

REFACTOR: Giảm trùng lặp, giữ nguyên test hành vi và chạy regression bị ảnh hưởng.

Test: IT-004, IT-018, IT-019, IT-020, IT-021, UAT-004, UAT-018, UAT-019, UAT-020, UAT-021. Bằng chứng: đối soát vị trí và visual QA; raw decimal không sai lệch; client/server cùng kết quả; UI/export đúng kiểu string; không có partial write

## M04-T02 Lưu revision và hoàn thành

Phụ thuộc: M04-T01, M02-T02, M02-T03. Thành phần: submission API, autosave. Ước lượng 3–4 ngày công.

RED: Viết fixture và expected độc lập cho lưu revision và hoàn thành.

GREEN: Triển khai vừa đủ cho hành vi và tiêu chí trong contract.

REFACTOR: Giảm trùng lặp, giữ nguyên test hành vi và chạy regression bị ảnh hưởng.

Test: IT-010, IT-022, IT-023, IT-024, UAT-010, UAT-022, UAT-023, UAT-024. Bằng chứng: IT transaction và UI readonly; một revision, không trùng; state transition đúng; một commit một conflict

## M04-T03 Mở lại và khóa lại

Phụ thuộc: M04-T02. Thành phần: grant API, dialog, audit. Ước lượng 2–3 ngày công.

RED: Viết fixture và expected độc lập cho mở lại và khóa lại.

GREEN: Triển khai vừa đủ cho hành vi và tiêu chí trong contract.

REFACTOR: Giảm trùng lặp, giữ nguyên test hành vi và chạy regression bị ảnh hưởng.

Test: IT-015, IT-016, IT-017, IT-033, UAT-015, UAT-016, UAT-017, UAT-033. Bằng chứng: policy đúng phạm vi; datetime dialog và API đúng; quyền ghi đúng tại boundary; audit đủ và đúng thứ tự

## M05-T01 Tổng hợp và công thức

Phụ thuộc: M04-T02, M03-T01. Thành phần: aggregate, formula engine. Ước lượng 4–6 ngày công.

RED: Viết fixture và expected độc lập cho tổng hợp và công thức.

GREEN: Triển khai vừa đủ cho hành vi và tiêu chí trong contract.

REFACTOR: Giảm trùng lặp, giữ nguyên test hành vi và chạy regression bị ảnh hưởng.

Test: IT-025, IT-026, IT-027, UAT-025, UAT-026, UAT-027. Bằng chứng: expected independent pass; không tự chọn giá trị người cuối; kết quả đúng hoặc lỗi rõ

## M05-T02 Màn quản lý và nguồn số liệu

Phụ thuộc: M05-T01, M04-T03. Thành phần: manager UI, drilldown. Ước lượng 2–3 ngày công.

RED: Viết fixture và expected độc lập cho màn quản lý và nguồn số liệu.

GREEN: Triển khai vừa đủ cho hành vi và tiêu chí trong contract.

REFACTOR: Giảm trùng lặp, giữ nguyên test hành vi và chạy regression bị ảnh hưởng.

Test: IT-013, IT-014, UAT-013, UAT-014. Bằng chứng: số tổng và contributor khớp; 403 và không đổi revision

## M06-T01 API và KPI tình trạng

Phụ thuộc: M04-T02, M04-T03. Thành phần: status query, indices. Ước lượng 3–4 ngày công.

RED: Viết fixture và expected độc lập cho api và kpi tình trạng.

GREEN: Triển khai vừa đủ cho hành vi và tiêu chí trong contract.

REFACTOR: Giảm trùng lặp, giữ nguyên test hành vi và chạy regression bị ảnh hưởng.

Test: IT-028, IT-030, UAT-028, UAT-030. Bằng chứng: mẫu số khớp phân công; KPI không cộng trùng

## M06-T02 Dashboard ma trận và lịch sử

Phụ thuộc: M06-T01, M01-T03. Thành phần: Status UI, history. Ước lượng 3–4 ngày công.

RED: Viết fixture và expected độc lập cho dashboard ma trận và lịch sử.

GREEN: Triển khai vừa đủ cho hành vi và tiêu chí trong contract.

REFACTOR: Giảm trùng lặp, giữ nguyên test hành vi và chạy regression bị ảnh hưởng.

Test: IT-029, IT-031, UAT-029, UAT-031. Bằng chứng: filter và kết quả giữ đúng; đúng route và trạng thái

## M06-T03 Xuất Excel theo snapshot

Phụ thuộc: M05-T01, M06-T01. Thành phần: export, download policy. Ước lượng 2–3 ngày công.

RED: Viết fixture và expected độc lập cho xuất excel theo snapshot.

GREEN: Triển khai vừa đủ cho hành vi và tiêu chí trong contract.

REFACTOR: Giảm trùng lặp, giữ nguyên test hành vi và chạy regression bị ảnh hưởng.

Test: IT-034, UAT-034. Bằng chứng: file không trộn revision

## M07-T01 Tích hợp quyền thời gian và hồi quy

Phụ thuộc: M03-T02, M05-T02, M06-T02, M06-T03. Thành phần: IT, E2E, regression. Ước lượng 4–5 ngày công.

RED: Viết fixture và expected độc lập cho tích hợp quyền thời gian và hồi quy.

GREEN: Triển khai vừa đủ cho hành vi và tiêu chí trong contract.

REFACTOR: Giảm trùng lặp, giữ nguyên test hành vi và chạy regression bị ảnh hưởng.

Test: IT-036, UAT-036. Bằng chứng: ảnh và E2E state pass

## M07-T02 Hiệu năng và khả năng sử dụng

Phụ thuộc: M07-T01. Thành phần: benchmark, keyboard, responsive. Ước lượng 2–3 ngày công.

RED: Viết fixture và expected độc lập cho hiệu năng và khả năng sử dụng.

GREEN: Triển khai vừa đủ cho hành vi và tiêu chí trong contract.

REFACTOR: Giảm trùng lặp, giữ nguyên test hành vi và chạy regression bị ảnh hưởng.

Test: IT-037, IT-038, UAT-037, UAT-038. Bằng chứng: biên bản usability; báo cáo p95 và không mất dữ liệu

## M08-T01 UAT và sửa lỗi nghiệm thu

Phụ thuộc: M07-T02. Thành phần: UAT, business signoff. Ước lượng 4–6 ngày công.

RED: Viết fixture và expected độc lập cho uat và sửa lỗi nghiệm thu.

GREEN: Triển khai vừa đủ cho hành vi và tiêu chí trong contract.

REFACTOR: Giảm trùng lặp, giữ nguyên test hành vi và chạy regression bị ảnh hưởng.

Test: UAT-905. Bằng chứng: Biên bản kiểm tra, artifact/version và môi trường xác minh.

## M08-T02 Pilot vận hành và rollback

Phụ thuộc: M08-T01. Thành phần: migration, monitoring, runbook. Ước lượng 2–3 ngày công.

RED: Viết fixture và expected độc lập cho pilot vận hành và rollback.

GREEN: Triển khai vừa đủ cho hành vi và tiêu chí trong contract.

REFACTOR: Giảm trùng lặp, giữ nguyên test hành vi và chạy regression bị ảnh hưởng.

Test: IT-042, UAT-042. Bằng chứng: runbook và biên bản restore

