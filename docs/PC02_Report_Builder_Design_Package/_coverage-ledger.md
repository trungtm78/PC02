# Coverage Ledger — Dynamic Report Builder UAT (PR10)

M2= KHÔNG ĐO ĐƯỢC (tool `lizard` không cài được trên máy này — không có quyền admin ghi
`C:\Program Files\Python311\Lib\site-packages`, đã thử `pip install --system` và thất bại
với lỗi Access denied. Không giả định số thay thế.)
FP= KHÔNG ƯỚC LƯỢNG (chưa làm Function Point formal estimate cho module này — ngoài phạm vi
thời gian của checkpoint này).
risk= CRITICAL cho E01-E11 (engine tính số liệu dùng để nộp/duyệt — sai số liệu là sai
nghiệp vụ lõi) + S11-S14/S33/S38 (workflow nộp/duyệt/chốt kỳ) + X01/X04/X05 (quyền, hiệu
năng, upload an toàn); HIGH cho S01-S10/S36/S37/Reminder/Notif (wizard thiết lập + phạm vi
tăng PR9); STANDARD cho S15-S32 (dashboard/quản lý/hiển thị); LOW cho S23/S24/S27/S28 phần
thuần UI/UX không ảnh hưởng số liệu.

> **Ghi chú trung thực về trạng thái checkpoint này**: Bảng dưới đây enumerate coverage item
> cho **toàn bộ 53 dòng** ở mức ĐỦ để tính `TC_min` và không bỏ sót hạng mục, nhưng TC chi
> tiết (uat.json) ở lượt này chỉ **viết đầy đủ cho nhóm P0** (E01-E11, S01-S14, S33, S36,
> S37, S38, X01, X03 phần quyền của Reminder/Notif). Các dòng P1/P2 còn lại có coverage item
> đã liệt kê (cột `coverage_ids`) nhưng **chưa có TC cụ thể** — đánh dấu `TC: PENDING` ở cột
> cuối, không phải "đã phủ". Đây là enumerate-before-write đúng luật #1, không phải padding.

## M1 — Spec coverage items (tính theo AC + EP/BVA/decision/state/pairwise mỗi dòng)

| Row | AC liên quan | EP | BVA | Decision | State | Pairwise | Tổng item dòng | coverage_ids | TC |
|---|---|---|---|---|---|---|---|---|---|
| S01 Danh sách thiết lập | AC-012 | 2 | 0 | 0 | 0 | 0 | 3 | COV-S01-01..03 | WRITTEN |
| S02 Upload mẫu Excel | AC-001,039 | 3 | 2 | 1 | 0 | 0 | 8 | COV-S02-01..08 | WRITTEN |
| S03 Preview/thuộc tính ô | AC-002(sửa),005 | 4 | 0 | 1 | 0 | 0 | 7 | COV-S03-01..07 | WRITTEN |
| S04 Lỗi import/validation mẫu | AC-003,039 | 3 | 0 | 0 | 0 | 0 | 5 | COV-S04-01..05 | WRITTEN |
| S05 Kỳ tuần | AC-006,040 | 1 | 2 | 0 | 0 | 0 | 5 | COV-S05-01..05 | WRITTEN |
| S06 Kỳ tháng | AC-007 | 1 | 3 | 0 | 0 | 0 | 6 | COV-S06-01..06 | WRITTEN |
| S07 Kỳ quý | AC-008 | 1 | 2 | 0 | 0 | 0 | 5 | COV-S07-01..05 | WRITTEN |
| S08 Kỳ ngày cụ thể (+DAILY) | AC-009(sửa) | 2 | 1 | 0 | 0 | 0 | 5 | COV-S08-01..05 | WRITTEN |
| S09 Phân công | AC-011(sửa) | 3 | 0 | 1 | 0 | 1 | 7 | COV-S09-01..07 | WRITTEN |
| S10 Xác nhận xuất bản | AC-004,005,011,012 | 2 | 0 | 0 | 0 | 0 | 4 | COV-S10-01..04 | WRITTEN |
| S11 Nhập báo cáo | AC-018,019,020,023(sửa) | 4 | 2 | 1 | 1 | 0 | 10 | COV-S11-01..10 | WRITTEN |
| S12 Kiểm tra dữ liệu nhập | AC-018,019,021 | 3 | 3 | 0 | 0 | 0 | 8 | COV-S12-01..08 | WRITTEN |
| S13 Báo cáo đã khoá | AC-010,023(sửa) | 1 | 1 | 0 | 1 | 0 | 4 | COV-S13-01..04 | WRITTEN |
| S14 Báo cáo được mở lại | AC-015,016,017 | 2 | 2 | 0 | 1 | 0 | 6 | COV-S14-01..06 | WRITTEN |
| S15 Tổng hợp quản lý | AC-013(sửa),026 | 2 | 0 | 1 | 0 | 0 | 4 | COV-S15-01..04 | PENDING |
| S16 Xem cá nhân chỉ đọc | AC-014,035 | 2 | 0 | 0 | 0 | 0 | 3 | COV-S16-01..03 | PENDING |
| S17 Dialog mở khoá | AC-015,016,017 | 2 | 1 | 0 | 0 | 0 | 4 | COV-S17-01..04 | PENDING |
| S18 Nguồn số tổng | AC-025(sửa),027 | 2 | 1 | 1 | 0 | 0 | 5 | COV-S18-01..05 | PENDING |
| S19 Dashboard tình trạng | AC-028,029,030 | 2 | 0 | 0 | 0 | 0 | 4 | COV-S19-01..04 | PENDING |
| S20 Ma trận người/tổ | AC-031 | 1 | 0 | 0 | 0 | 0 | 2 | COV-S20-01..02 | PENDING |
| S21 Lịch sử/audit | AC-033 | 1 | 0 | 0 | 0 | 0 | 2 | COV-S21-01..02 | WRITTEN |
| S22 Quản lý phiên bản | AC-032,041 | 2 | 0 | 0 | 0 | 0 | 3 | COV-S22-01..03 | PENDING |
| S23 Loading/empty/error/forbidden | AC-036 | 0 | 0 | 0 | 0 | 0 | 4 (4 trạng thái) | COV-S23-01..04 | PENDING |
| S24 Responsive/editor di động | AC-037 | 0 | 0 | 0 | 0 | 0 | 3 (3 viewport) | COV-S24-01..03 | PENDING |
| S25 Xuất file/job | AC-034 | 1 | 0 | 0 | 0 | 0 | 2 | COV-S25-01..02 | PENDING |
| S26 Mất mạng/revision conflict | AC-022,024 | 1 | 0 | 0 | 0 | 0 | 2 | COV-S26-01..02 | PENDING |
| S27 Biểu đồ/filter nâng cao | AC-029 | 1 | 0 | 0 | 0 | 0 | 1 | COV-S27-01 | PENDING |
| S28 Date/Time picker | AC-019 | 1 | 1 | 0 | 0 | 0 | 2 | COV-S28-01..02 | PENDING |
| S29 Xác nhận hoàn thành/nộp | AC-023(sửa) | 1 | 0 | 0 | 0 | 0 | 1 | COV-S29-01 | PENDING |
| S30 Điều chỉnh/miễn giữa kỳ | AC-041 | 1 | 0 | 0 | 0 | 0 | 1 | COV-S30-01 | PENDING |
| S31 Ngừng phát sinh/thu hồi grant | AC-017,032 | 1 | 0 | 0 | 0 | 0 | 1 | COV-S31-01 | PENDING |
| S32 Lưới template field | AC-004,005 | 1 | 0 | 0 | 0 | 0 | 1 | COV-S32-01 | PENDING |
| S33 Duyệt/Trả lại/Huỷ duyệt (R21) | PLAN-R21 (transitions.ts) | 1 | 0 | 2 | 1 | 1 | 5 | COV-S33-01..05 | WRITTEN |
| S34 Hàng chờ mở lại + mở khoá hàng loạt | AC-015,016 | 1 | 0 | 0 | 0 | 0 | 2 | COV-S34-01..02 | PENDING |
| S35 Nhập từ Excel (re-import `__dr_meta`) | AC-004 | 2 | 0 | 0 | 0 | 0 | 2 | COV-S35-01..02 | PENDING |
| S36 Validation rules (ERROR/WARNING/gợi ý IF) | PLAN-S36 | 2 | 0 | 1 | 0 | 0 | 5 | COV-S36-01..05 | WRITTEN |
| S37 Ghi chú theo ô/bản nộp | PLAN-S37 | 2 | 0 | 0 | 0 | 0 | 4 | COV-S37-01..04 | WRITTEN |
| S38 Chốt kỳ/mở chốt (ADJUSTMENT) | AC-004(D04) | 1 | 0 | 1 | 1 | 0 | 4 | COV-S38-01..04 | WRITTEN |
| E01 period | — | 3 | 6 | 0 | 0 | 0 | 25 (đã PASS jest 25/25) | COV-E01-01..04 | WRITTEN(sample) |
| E02 token | — | 3 | 0 | 2 | 0 | 0 | 27 (PASS jest 27/27) | COV-E02-01..03 | WRITTEN(sample) |
| E03 template-parser | AC-002(sửa),005 | 2 | 0 | 1 | 0 | 0 | 6 | COV-E03-01..06 | PENDING |
| E04 expr | — | 4 | 0 | 3 | 0 | 0 | 52 (PASS jest 52/52) | COV-E04-01..04 | WRITTEN(sample) |
| E05 decimal | AC-018 | 2 | 3 | 0 | 0 | 0 | 36 (PASS jest 36/36) | COV-E05-01..03 | WRITTEN(sample) |
| E06 values | AC-018,019,020 | 3 | 1 | 0 | 0 | 0 | 39 (PASS jest 39/39) | COV-E06-01..03 | WRITTEN(sample) |
| E07 aggregate | AC-025(sửa) | 2 | 0 | 1 | 0 | 0 | 12 (PASS jest 12/12, đối chiếu 228 dòng oracle Excel thật) | COV-E07-01..04 | WRITTEN |
| E08 access | AC-007(D07) | 2 | 0 | 2 | 1 | 0 | 18 | COV-E08-01..03 | WRITTEN(sample) |
| E09 status | AC-030 | 1 | 1 | 0 | 0 | 0 | 17 | COV-E09-01..02 | PENDING |
| E10 paste | AC-021 | 2 | 0 | 1 | 0 | 0 | 16 | COV-E10-01..03 | PENDING |
| E11 date-math | D08 | 2 | 3 | 0 | 0 | 0 | 32 | COV-E11-01..02 | PENDING |
| X01 Quyền route-gate/404/VIEWER scope | D10 | 1 | 0 | 0 | 0 | 1 | 6 (7 persona × route) | COV-X01-01..06 | WRITTEN |
| X02 Đồng thời | AC-024 | 0 | 0 | 0 | 0 | 0 | 3 | COV-X02-01..03 | PENDING |
| X03 Audit không chứa số liệu | AC-033 | 0 | 0 | 0 | 0 | 0 | 2 | COV-X03-01..02 | WRITTEN |
| X04 Hiệu năng 5000/200/50 | AC-038 | 0 | 0 | 0 | 0 | 0 | 1 (budget CHƯA có — xem GAP dưới) | COV-X04-01 | PENDING(GAP p95) |
| X05 Upload không an toàn | AC-039 | 4 | 0 | 0 | 0 | 0 | 4 | COV-X05-01..04 | WRITTEN |
| X06 Monkey test (một lần cuối) | — | 0 | 0 | 0 | 0 | 0 | 1 | COV-X06-01 | PENDING (chạy ĐÚNG MỘT LẦN ở cuối PR10, không chạy ở checkpoint này) |
| X07 Triển khai an toàn | AC-042 | 0 | 0 | 0 | 0 | 0 | 3 | COV-X07-01..03 | PENDING |

**Tổng M1 (đếm item cột "Tổng item dòng", trừ các dòng engine dùng số jest hiện có vì đã có
unit test — quy ước: coverage item UAT-level cho các dòng này tính bằng số coverage_ids liệt
kê, KHÔNG nhân lại số case jest, để tránh double-count giữa lớp unit và lớp UAT):**
Σ = 3+8+7+5+5+6+5+5+7+4+10+8+4+6+4+3+4+5+4+2+2+3+4+3+2+2+1+2+1+1+1+1+5+2+2+5+4+4
  + 4+3+6+4+3+3+4+2+3+2
  + 6+3+2+1+4+1+3
= **224** coverage items (M1).

## M4 — Risk-tier backstop
CRITICAL rows (E01-E11=11, S11-S14=4, S33=1, S38=1, X01=1, X04=1, X05=1) = 20 rows × 120 = áp
dụng per-row không hợp lý (backstop vốn tính trên TOÀN FEATURE, không nhân theo dòng) →
dùng đúng định nghĩa: **toàn module là 1 feature CRITICAL** (số liệu nộp/duyệt dùng thay quy
trình Excel tay cho báo cáo chính thức) → **M4 = 120**.

## TC_min = MAX(M1=224, M2=KHÔNG ĐO ĐƯỢC, M3=KHÔNG ƯỚC LƯỢNG, M4=120) = **224**

(M2/M3 không tính vào MAX vì không đo được — đúng luật "không lấy số nào thay thế"; ghi rõ
đây **CHƯA phải ENSEMBLE đầy đủ 4 phương pháp** — `coverage_calc.py --write` sẽ in cảnh báo
này, đã được dự đoán trước và chấp nhận là giới hạn môi trường, không che giấu.)

## Bảng item phẳng (1 dòng = 1 coverage item, cho `coverage_calc.py` đếm M1 máy — bảng theo
dòng S/E/X phía trên là tóm tắt đọc cho người, bảng này là nguồn đếm cho máy)

| cov_id | status | TC/lý do |
|---|---|---|
| COV-S01-01 | WRITTEN | TC-S01-01 |
| COV-S01-02 | WRITTEN | TC-S01-01 |
| COV-S01-03 | WRITTEN | TC-S01-02 |
| COV-S02-01 | WRITTEN | TC-S02-01, TC-E2E-WIZARD-01 |
| COV-S02-02 | WRITTEN | TC-S02-02 |
| COV-S02-03 | WRITTEN | TC-S02-03 |
| COV-S02-04 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S02-05 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S02-06 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S02-07 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S02-08 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S03-01 | WRITTEN | TC-S02-04 |
| COV-S03-02 | WRITTEN | TC-S02-04 |
| COV-S03-03 | WRITTEN | TC-S03-01 |
| COV-S03-04 | WRITTEN | TC-S03-02 |
| COV-S03-05 | WRITTEN | TC-S03-03 |
| COV-S03-06 | WRITTEN | TC-S03-04 |
| COV-S03-07 | WRITTEN | TC-S03-05 |
| COV-S04-01 | WRITTEN | TC-S04-01 |
| COV-S04-02 | WRITTEN | TC-S04-02 |
| COV-S04-03 | WRITTEN | TC-S04-03 |
| COV-S04-04 | WRITTEN | TC-S04-04 |
| COV-S04-05 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S05-01 | WRITTEN | TC-S05-01 |
| COV-S05-02 | WRITTEN | TC-S05-01 |
| COV-S05-03 | WRITTEN | TC-S05-02 |
| COV-S05-04 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S05-05 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S06-01 | WRITTEN | TC-S06-01 |
| COV-S06-02 | WRITTEN | TC-S06-02 |
| COV-S06-03 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S06-04 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S06-05 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S06-06 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S07-01 | WRITTEN | TC-S07-01 |
| COV-S07-02 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S07-03 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S07-04 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S07-05 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S08-01 | WRITTEN | TC-S08-01 |
| COV-S08-02 | WRITTEN | TC-S08-02 |
| COV-S08-03 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S08-04 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S08-05 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S09-01 | WRITTEN | TC-S09-01, TC-E2E-WIZARD-01 |
| COV-S09-02 | WRITTEN | TC-S09-02 |
| COV-S09-03 | WRITTEN | TC-S09-03 |
| COV-S09-04 | WRITTEN | TC-S09-04 |
| COV-S09-05 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S09-06 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S09-07 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S10-01 | WRITTEN | TC-S10-01, TC-E2E-WIZARD-01 |
| COV-S10-02 | WRITTEN | TC-S10-01 |
| COV-S10-03 | WRITTEN | TC-S10-02 |
| COV-S10-04 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S11-01 | WRITTEN | TC-S11-01 |
| COV-S11-02 | WRITTEN | TC-S11-02 |
| COV-S11-03 | WRITTEN | TC-S11-03 |
| COV-S11-04 | WRITTEN | TC-S11-04 |
| COV-S11-05 | WRITTEN | TC-S11-06 |
| COV-S11-06 | WRITTEN | TC-S11-07 |
| COV-S11-07 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S11-08 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S11-09 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S11-10 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S12-01 | WRITTEN | TC-S11-02 |
| COV-S12-02 | WRITTEN | TC-S11-03 |
| COV-S12-03 | WRITTEN | TC-S11-05 |
| COV-S12-04 | WRITTEN | TC-S11-08 |
| COV-S12-05 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S12-06 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S12-07 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S12-08 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S13-01 | WRITTEN | TC-S11-07 |
| COV-S13-02 | WRITTEN | TC-S13-01 |
| COV-S13-03 | WRITTEN | TC-S13-01 |
| COV-S13-04 | WRITTEN | TC-S13-02 |
| COV-S14-01 | WRITTEN | TC-S14-01 |
| COV-S14-02 | WRITTEN | TC-S14-03 |
| COV-S14-03 | WRITTEN | TC-S14-03 |
| COV-S14-04 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S14-05 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S14-06 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S15-01 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S15-02 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S15-03 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S15-04 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S16-01 | WRITTEN | TC-X01-04 |
| COV-S16-02 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S16-03 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S17-01 | WRITTEN | TC-S14-01 |
| COV-S17-02 | WRITTEN | TC-S14-02 |
| COV-S17-03 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S17-04 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S18-01 | WRITTEN | TC-E07-01 |
| COV-S18-02 | WRITTEN | TC-E07-01 |
| COV-S18-03 | WRITTEN | TC-E07-02 |
| COV-S18-04 | WRITTEN | TC-E07-03 |
| COV-S18-05 | WRITTEN | TC-E07-03 |
| COV-S19-01 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S19-02 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S19-03 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S19-04 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S20-01 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S20-02 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S21-01 | WRITTEN | TC-S21-01 |
| COV-S21-02 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S22-01 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S22-02 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S22-03 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S23-01 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S23-02 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S23-03 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S23-04 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S24-01 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S24-02 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S24-03 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S25-01 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S25-02 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S26-01 | WRITTEN | TC-S11-09 |
| COV-S26-02 | WRITTEN | TC-S12-01 |
| COV-S27-01 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S28-01 | WRITTEN | TC-S11-05 |
| COV-S28-02 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S29-01 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S30-01 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S31-01 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S32-01 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S33-01 | WRITTEN | TC-S33-01 |
| COV-S33-02 | WRITTEN | TC-S33-02 |
| COV-S33-03 | WRITTEN | TC-S33-03 |
| COV-S33-04 | WRITTEN | TC-S33-04 |
| COV-S33-05 | WRITTEN | TC-S33-05 |
| COV-S34-01 | WRITTEN | TC-S14-04 |
| COV-S34-02 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S35-01 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S35-02 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-S36-01 | WRITTEN | TC-S36-01 |
| COV-S36-02 | WRITTEN | TC-S36-02 |
| COV-S36-03 | WRITTEN | TC-S36-03 |
| COV-S36-04 | WRITTEN | TC-S36-04 |
| COV-S36-05 | WRITTEN | TC-S36-05 |
| COV-S37-01 | WRITTEN | TC-S37-01 |
| COV-S37-02 | WRITTEN | TC-S37-02 |
| COV-S37-03 | WRITTEN | TC-S37-03 |
| COV-S37-04 | WRITTEN | TC-S37-04 |
| COV-S38-01 | WRITTEN | TC-S38-01 |
| COV-S38-02 | WRITTEN | TC-S38-02 |
| COV-S38-03 | WRITTEN | TC-S38-02 |
| COV-S38-04 | WRITTEN | TC-S38-03 |
| COV-E01-01 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-E01-02 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-E01-03 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-E01-04 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-E02-01 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-E02-02 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-E02-03 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-E03-01 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-E03-02 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-E03-03 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-E03-04 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-E03-05 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-E03-06 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-E04-01 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-E04-02 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-E04-03 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-E04-04 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-E05-01 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-E05-02 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-E05-03 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-E06-01 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-E06-02 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-E06-03 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-E07-01 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-E07-02 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-E07-03 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-E07-04 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-E08-01 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-E08-02 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-E08-03 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-E09-01 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-E09-02 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-E10-01 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-E10-02 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-E10-03 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-E11-01 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-E11-02 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-X01-01 | WRITTEN | TC-X01-01 |
| COV-X01-02 | WRITTEN | TC-X01-01 |
| COV-X01-03 | WRITTEN | TC-X01-02 |
| COV-X01-04 | WRITTEN | TC-X01-03 |
| COV-X01-05 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-X01-06 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-X02-01 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-X02-02 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-X02-03 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-X03-01 | WRITTEN | TC-X03-01 |
| COV-X03-02 | WRITTEN | TC-X03-02 |
| COV-X04-01 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-X05-01 | WRITTEN | TC-S04-03 |
| COV-X05-02 | WRITTEN | TC-S04-04 |
| COV-X05-03 | WRITTEN | TC-X05-01 |
| COV-X05-04 | WRITTEN | TC-X05-02 |
| COV-X06-01-reminder | WRITTEN | TC-REMINDER-01 |
| COV-X06-02-reminder | WRITTEN | TC-REMINDER-02 |
| COV-X06-03-reminder | WRITTEN | TC-REMINDER-03 |
| COV-X06-04-reminder | WRITTEN | TC-NOTIF-01 |
| COV-X07-01 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-X07-02 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-X07-03 | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-X06R-01-reminder | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-X06R-02-reminder | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-X06R-03-reminder | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |
| COV-X06R-04-reminder | PENDING | GAP: PENDING — chưa viết TC chi tiết ở checkpoint này, coverage item đã enumerate, chờ checkpoint kế tiếp |


## GAP ghi nhận ở bước này
- **GAP-PERF-BUDGET**: X04/X38 (hiệu năng p95 form 3s/save 1s/aggregate 3s) có số trong
  UAT_CASES.md gốc (UAT-038) nhưng đó là **con số từ brief cũ**, cần xác nhận lại với người
  đặt ngân sách trước khi khai `perf_budget.p95_ms` — chưa khai cứng trong `uat.json` ở
  checkpoint này (xem khối tầng sâu §5, luật "không bịa p95_ms"). Case X04 do đó ở trạng
  thái PENDING cho tới khi có xác nhận.
- **GAP-R22**: `ReportingUnit=USER` chưa có trong code (`grep -r "ReportingUnit" backend/src`
  = 0 kết quả, xác nhận trực tiếp 11/10/2026). Không viết TC khẳng định hành vi — ghi `GAP`
  trong domain pack rule `R22-REPORTINGUNIT-GAP`, không chấm coverage item nào cho R22.
- **GAP-ADMIN-APPROVER-WAIVER**: waiver môi trường dev cục bộ (xem `_domain-pack.md` cuối
  file) chưa có named approver ký — không tự coi GO.
