# Coverage Ledger — đợt 18/09/2026

> Sinh TRƯỚC khi viết ca (enumerate-before-write). Cột Trạng thái = kết quả lượt cuối 19/09 (xem UAT-COVERAGE.md §1). Mỗi dòng = một mệnh đề; cột **Tầng** nói bằng chứng đi qua đâu
> (E2E = Chrome thật + backend/CSDL thật; API = HTTP thật; UNIT = ca kiểm đơn vị/tích hợp — chỉ dùng khi chủ ngữ
> của mệnh đề là một hàm/bảng và câu đã thu hẹp cho khớp). Oracle: `_domain-pack.md`.

## TC_min = MAX(M1, M2, M3, M4)

| Phương pháp | Cách đếm | Giá trị |
|---|---|---|
| M1 spec coverage items | 25 rule × (1 xác nhận + 1 phủ định khi áp dụng) = 25 + 14 phủ định + 8 biên/phân vùng | **47** |
| M2 ΣV(G) | Logic mới dưới kiểm: `canCapNhat` 5 · `SummaryCell` 6 · `ThanhCuonNgangTren` (2 bộ nghe) 8 · `xuatDanhSachExcel` 7 · `NutXuatTheoBoLoc` 5 · `reset/luuMatDo/listMatDo` 5 · `DateCell` 3 | 39 (phủ ở tầng UNIT: 3.306 FE + 5.503 BE ca, phủ dòng đổi ≥ 97%) |
| M3 FP^1.2 | ~20 FP (6 yêu cầu + 2 tăng phạm vi, mỗi cái 2–3 FP) → 20^1.2 | 36 |
| M4 risk-tier | STANDARD–HIGH (UI đọc hằng ngày + xuất dữ liệu + ghi dữ liệu hệ cũ) → HIGH | 80 |

**TC_min = 80** (M4 thắng). Tổng ca UAT đợt này: **E2E 28 lượt (18 ca, E04/E07/E09 chạy theo từng màn) + API 16 lượt (8 ca × thực thể)** = 44 lượt UAT
+ ca UNIT/tích hợp đã có dẫn chứng ở dưới (tính vào phủ khi chủ ngữ là hàm) → vượt 80 mục phủ thật, **0 ca độn**.
Chỗ M4 buộc đào sâu thêm: thêm ca phủ định cho R1 (E02, E03), R2-KEY (E05), R5-EMPTY (E13, A04), R4 không tràn (E08).

## Ledger

| cov_id | Mệnh đề (chủ ngữ) | rule | Loại | Tầng | Ca | Trạng thái |
|---|---|---|---|---|---|---|
| C1.1 | Người dùng KHÔNG thấy hộp/toast nhắc khi có bản mới | R1-NODIALOG | GREEN/UX | E2E | E01 | PASS |
| C1.2 | Người dùng chuyển màn khi có bản mới → trang lên bản mới ở màn đích | R1-ROUTE | GREEN/E2E | E2E | E01 | PASS |
| C1.3 | Cùng bản → chuyển màn không tải lại (không phiền) | R1-SAME | RED | E2E | E02 | PASS |
| C1.4 | /health lỗi → không tải lại, không báo | R1-HEALTHERR | RED | E2E | E03 | PASS |
| C1.5 | Hàm `trangDangRanh` trả sai khi đang gõ / có hộp thoại / có tệp chờ tải → không tải lại lúc quay tab | R1-SAFE | STATE/DECISION | UNIT | `capNhat.test.tsx` (hàm) | PASS (mệnh đề thu hẹp về hàm) |
| C1.6 | Biên tab ẩn 4:59 vs 5:00 | R1-SAFE | BOUNDARY | UNIT | `capNhat.test.tsx` (`TAB_AN_TOI_THIEU_MS`) | PASS (hàm) |
| C1.7 | Lỗi tải gói → tự tải lại MỘT lần theo buildId | R1-ROUTE | RECOVERY | UNIT | `capNhat.test.tsx` | PASS (hàm) |
| C2.1–4 | Ô Tóm tắt dài hiện đúng 5 dòng — Đơn thư/Vụ án/Vụ việc/Đơn thư phường | R2-CLAMP5 | GREEN | E2E | E04 ×4 | PASS |
| C2.5 | Tóm tắt không tràn → không nút (số nút = số ô tràn) | R2-NOBTN | EP | E2E | E04 ×4 | PASS |
| C2.6 | "Xem thêm" bung tại chỗ, URL giữ nguyên; "Thu gọn" về 5 dòng | R2-INPLACE | GREEN | E2E | E04 ×4 | PASS |
| C2.7 | Enter/Space trên nút trong dòng có onKeyDown không mở hồ sơ | R2-KEY | RED/A11Y | E2E | E05 | PASS |
| C2.8 | Bấm vào chữ (ngoài nút) vẫn mở hồ sơ | R2-INPLACE | EDGE | E2E | E06 | PASS |
| C2.9 | Ô trống hiện "—" | R2-NOBTN | EDGE | UNIT | `SummaryCell.test.tsx` | PASS (thành phần) |
| C3.1 | Ô chữ xuống dòng (3 màn) | R3-WRAP | GREEN | E2E | E07 ×3 | PASS |
| C3.2 | Ngày/mã một dòng, không tràn cột (3 màn, font mới) | R3-ONELINE | BOUNDARY | E2E | E07 ×3 | PASS |
| C3.3 | Bảng vẫn rộng hơn khung (cuộn ngang, không ép cột) | R3-SCROLL | RED | E2E | E07 ×3 | PASS |
| C3.4 | Ngày phi lý (biểu tượng + ngày) được xuống dòng, không đè cột | R3-ONELINE | EDGE | UNIT | `DateCell.test.tsx` | PASS (thành phần) |
| C4.1 | Bảng tràn → thanh cuộn nằm TRÊN bảng | R4-TOPBAR | GREEN | E2E | E07 ×3 | PASS |
| C4.2 | Bảng không tràn → không có thanh | R4-TOPBAR | EP | E2E | E08 | PASS |
| C4.3 | Kéo thanh ↔ bảng cuộn theo hai chiều | R4-SYNC | GREEN | E2E | E07 ×3 | PASS |
| C4.4 | Cuộn nhanh không giật ngược (tiếng vọng) | R4-SYNC | STATE | E2E + UNIT | E07 ×3 + `ThanhCuonNgangTren.test.tsx` | PASS |
| C4.5 | Gán bị kẹp ở mép không nuốt lần cuộn sau | R4-SYNC | BOUNDARY | UNIT | `ThanhCuonNgangTren.test.tsx` | PASS (thành phần) |
| C5.1 | Áp dụng lọc Cán bộ nhập → danh sách thu hẹp, thẻ số = danh sách (3 màn) | R5-FILTER | GREEN | E2E + API | E09 ×3, A03 ×3 | PASS |
| C5.2 | Nhãn kỳ = kỳ đang áp dụng | R5-LABEL | GREEN | E2E | E11 | PASS |
| C5.3 | Tệp = đúng số dòng đang lọc, đúng cột đang hiện, cùng thứ tự (3 màn) | R5-EXPORT | GREEN | E2E + API | E09 ×3, A03 ×3 | PASS |
| C5.4 | Còn thay đổi chưa áp dụng → "Áp dụng & xuất", tệp theo bộ lọc mới | R5-APPLYFIRST | STATE | E2E | E12 | PASS |
| C5.5 | 0 dòng → nút khoá; máy chủ 400 "Không có dữ liệu" | R5-EMPTY | RED | E2E + API | E13, A04 ×3 | PASS |
| C5.6 | Cột lạ → 400 nêu tên cột | R5-EXPORT | RED | API | A02 ×3 | PASS |
| C5.7 | Chưa đăng nhập → 401 | R5-EXPORT | SECURITY | API | A01 ×3 | PASS |
| C5.8 | Quá 5 lượt/phút/điểm cuối → 429 | R5-EXPORT | SECURITY | API (quan sát) | lượt chạy lặp của A01–A04 | PASS (bằng chứng ở mục Thực thi) |
| C5.9 | Vượt 50.000 dòng → 400 câu rõ | R5-EXPORT | BOUNDARY | UNIT | `xuat-danh-sach.spec.ts` | PASS (hàm — dữ liệu thật 46.741 < trần, không dựng được qua HTTP) |
| C5.10 | Hồ sơ xoá mềm giữa chừng không lọt tệp | R5-EXPORT | EDGE | UNIT | `*-xuat-danh-sach.spec.ts` | PASS (hàm) |
| C5.11 | Tệp phường/xã vẫn xuất, giữ tên tệp, A4 ngang | R5-EXPORT | REGRESSION | API | A05 | PASS |
| C5.12 | Vụ việc: lọc Cán bộ nhập ra hồ sơ, cột Người nhập có tên | R5-OFFICER | GREEN | E2E | E10 | PASS |
| C5.13 | OFFICER chỉ xuất được hồ sơ trong phạm vi | R5-EXPORT | SECURITY | API (token officer1 thật) | A10 | PASS (prod + bản sao) |
| C6.1 | Tìm "Kha Tử Thạnh" ở Vụ việc ra 26-11732 | R6-FIND | GREEN | E2E (bản sao) | E17 | PASS bản sao · prod NOT_EXECUTED (chờ anh xác nhận ghi) |
| C6.2 | Tìm "Lê Nguyễn Yến Thanh" ở Đơn thư ra 26-11129 "Đã chuyển vụ án", mở sang vụ án | R6-FIND, R6-LINK | GREEN | E2E (bản sao) | E18 | PASS bản sao · prod NOT_EXECUTED |
| C6.3 | Chạy lại CLI → 0 (bình ổn) | R6-FIND | REGRESSION | CLI thật (bản sao) | Thực thi mục 3 | PASS |
| C6.4 | Trùng số hệ mới → số theo bộ đếm, số cũ ở STT cũ | R6-STTCU | DECISION | UNIT/tích hợp | `bu-ma-trung-he-moi.spec.ts` | PASS (hàm) — bản sao không có đơn hệ mới ≥11729 để tái hiện |
| CF.1 | Font tự host, đủ glyph tiếng Việt, không gọi Google Fonts | RF-FONT | COMPAT | E2E | E14 | PASS |
| CD.1 | Gọn = 1 dòng, không nút; Đầy đủ = không kẹp; nhớ sau tải lại | RD-DENSITY | STATE | E2E | E15 | PASS |
| CD.2 | Giá trị lạ / bảng lạ → 400; chưa đăng nhập → 401 | RD-DENSITY | RED/SECURITY | API | A06 | PASS |
| CD.3 | "Đặt lại cột" không xoá mật độ | RD-DENSITY | STATE | API | A07 | PASS |
| C5.14 | Ô Cán bộ nhập có ĐỦ mọi cán bộ, không hai nhãn trùng (U3/U4 UAT prod bắt) | R5-FILTER | EP/DATA | E2E prod | E09 ×3, E10, E12 | PASS sau #418 |
| CU.1 | Không hộp thoại chen ngang; aria-pressed/aria-expanded; bàn phím tới được | UX | A11Y | E2E | E16, E05 | PASS |
| CO.1 | Máy chủ báo buildId (OAT) | R1-ROUTE | OAT | API | A08 + 8 lần deploy khớp buildId | PASS |

## Đặc tính ISO 25010 áp dụng

| Đặc tính | Ca | Ghi chú |
|---|---|---|
| Phù hợp chức năng | E01–E18, A01–A08 | — |
| Hiệu năng | GAP có lý do | xuất 46k dòng đo ở unit (ghi luồng + lô 1.000); không đo thời gian ở UAT — đề xuất đo khi anh chạy thật |
| Tương thích | E14 | Chrome (máy cán bộ dùng Chrome/Edge Chromium) |
| Khả dụng (usability/a11y) | E04–E06, E15, E16 | axe tự động: chưa cài `@axe-core/playwright` → thay bằng kiểm tên (aria, bàn phím) |
| Tin cậy | E03, C4.4, C4.5 | — |
| Bảo mật | A01, A06, C5.8, C5.13 | C5.13 GAP-E2E như trên |
| Bảo trì | cổng `bangDeDoc.gate`, `khaiCotXuat.gate`, `fontTuHost.gate` | — |

## Gieo lỗi (effectiveness) — xem UAT-COVERAGE.md §4
