# UAT-COVERAGE — Dynamic Report Builder

Ma trận phủ theo §9 giao thức. Cập nhật mỗi khi `/uat-test-writer` → `/uat-test-runner` chạy cho một dòng. Chỉ kết thúc toàn bộ công việc khi **100% dòng = PASS**.

Quy ước `Kết quả`: `CHƯA LÀM` / `PASS` / `FAIL` / `N/A (lý do)`.

## A. 38 màn hình/trạng thái (32 mockup gốc + 6 màn mới từ review)

| ID | Màn hình/Chức năng | Viết test | Chạy test | Kết quả |
|---|---|---|---|---|
| S01 | Danh sách thiết lập báo cáo | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S02 | Upload mẫu Excel | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S03 | Preview và thuộc tính ô | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S04 | Lỗi import và validation mẫu | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S05 | Cấu hình kỳ tuần | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S06 | Cấu hình kỳ tháng | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S07 | Cấu hình kỳ quý | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S08 | Cấu hình kỳ ngày cụ thể (+ DAILY mới) | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S09 | Phân công quản lý/VIEWER và người nhập theo tổ | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S10 | Xác nhận xuất bản | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S11 | Nhập báo cáo | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S12 | Kiểm tra dữ liệu nhập | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S13 | Báo cáo đã khoá | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S14 | Báo cáo được mở lại | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S15 | Tổng hợp của người quản lý | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S16 | Xem cá nhân (tổ) chỉ đọc | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S17 | Dialog mở khoá | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S18 | Nguồn số tổng | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S19 | Dashboard tình trạng | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S20 | Ma trận người/tổ và báo cáo | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S21 | Lịch sử và audit | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S22 | Quản lý phiên bản | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S23 | Loading/empty/error/permission toàn module | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S24 | Responsive và editor từng ô (mobile) | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S25 | Xuất file và trạng thái job | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S26 | Mất mạng và revision conflict | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S27 | Biểu đồ và filter nâng cao | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S28 | Date/Time picker và editor theo kiểu | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S29 | Xác nhận và kết quả hoàn thành/nộp | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S30 | Điều chỉnh và miễn nghĩa vụ giữa kỳ | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S31 | Ngừng phát sinh và thu hồi grant | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S32 | Lưới template và ràng buộc field (quét vùng web) | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S33 | Duyệt / Trả lại / Huỷ duyệt (nhiều cấp, R21) | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S34 | Hàng chờ yêu cầu mở lại + mở khoá hàng loạt | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S35 | Nhập từ Excel (re-import có dấu __dr_meta) | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S36 | Validation rules (soạn + gợi ý từ IF) | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S37 | Ghi chú/giải trình theo ô và theo bản nộp | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| S38 | Chốt kỳ / mở chốt (ADJUSTMENT) | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |

## B. Engine thuần (PR1 — không phải màn hình, nhưng là chức năng độc lập cần phủ)

| ID | Chức năng | Viết test | Chạy test | Kết quả |
|---|---|---|---|---|
| E01 | period: sinh kỳ DAILY/WEEKLY/MONTHLY/QUARTERLY/SEMI_ANNUAL/YEARLY/ONE_TIME, biên lịch | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| E02 | token: grammar `{TYPE\|FORMAT\|AGG}`, alias Num/AGV | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| E03 | template-parser: locked hiệu lực, shared formula, merge, hidden | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| E04 | expr: SUM/IF/AVERAGE/MIN/MAX/COUNT/ROUND/AND/OR/ABS, vòng lặp, PREV | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| E05 | decimal: precision/scale, parse vi-VN | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| E06 | values: NUM/TEXT/DATE/TIME validate | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| E07 | aggregate: SUM/AVG/MIN/MAX/COUNT/NONE, blankPolicy ZERO/IGNORE, oracle HSLN | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| E08 | access: canEdit theo state/grant/deadline/now | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| E09 | status: KPI, mẫu số 0 | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| E10 | paste: TSV nguyên tử | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |

## C. Xuyên suốt (gate, không phải 1 màn hình)

| ID | Chức năng | Viết test | Chạy test | Kết quả |
|---|---|---|---|---|
| X01 | Quyền: route-quyền gate, 404 chống dò, VIEWER theo phạm vi | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| X02 | Đồng thời: lưu↔chốt kỳ, lưu↔D09, 2 editor cùng tổ | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| X03 | Audit không chứa số liệu | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| X04 | Hiệu năng: 5.000 input/200 tổ/50 ghi đồng thời | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| X05 | Upload không an toàn (macro/mã hoá/zip bomb) | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| X06 | Monkey test (chạy một lần cuối) | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |
| X07 | Triển khai an toàn: flag, rollback, migration additive | CHƯA LÀM | CHƯA LÀM | CHƯA LÀM |

**Tổng: 52 dòng. PASS: 0/52.**
