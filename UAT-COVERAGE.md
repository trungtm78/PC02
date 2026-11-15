# UAT coverage — processing flow and deadlines per information type ("Quy trình & hạn xử lý")

Oracle: the top part of the plan `t-i-m-n-h-nh-danh-twinkling-acorn.md` (the owner's rules, sections 1–4, decisions C1–C16, R3–R11) and the engine rules listed in `PROGRESS.md`. Expected values are computed by the script, never read back from the product.

Evidence: `tools/uat-quy-trinh/workflow.cjs`, run on 2026-11-15 over HTTP against a local stack of branch `test/processing-flow-uat` (database `pc02_uat_quy_trinh`; schema by `prisma db push`, because `prisma migrate deploy` does not replay on an empty database). Checks: **79 PASS, 5 FAIL, 18 NOT RUN** of 102.

**Coverage: 25 of 62 requirements = 40.3%** (PASS only; FAIL 4, NOT RUN 15 and GAP 18 all count as not covered). A NOT RUN is not a pass.

| Requirement | What it says | Checks | Layer | Status | Note |
|---|---|---|---|---|---|
| O1 | Thời hạn bước theo giờ / ngày / ngày làm việc (qua 30/4, 1/5, cuối tuần) / tháng; hạn do script tự tính | QT-024..027 | HTTP | PASS | — |
| O2 | Bước giao cho đơn vị; không chỉ định thì trưởng đơn vị chịu trách nhiệm (Việc của tôi) | QT-043 | HTTP | PASS | — |
| O2b | Chỉ định / đổi cán bộ chịu trách nhiệm của bước | — | — | GAP | no check; PROGRESS lists it as not built |
| O3 | Mức màu theo số ngày còn lại; đúng hạn = ĐỎ, sau hạn = QUÁ HẠN; ranh giới nửa đêm VN | QT-031..039 | HTTP | PASS | — |
| O3b | Mỗi lần đổi mức gửi một lần nhắc; quá hạn nhắc mỗi ngày | QT-095 | HTTP | NOT RUN | proc_reminders absent (not merged); the tick has no HTTP trigger |
| O4 | Đơn vị được giao bước đang mở: xem hồ sơ, báo cáo bước mình, KHÔNG sửa hồ sơ; hết khi bước xong; tổ ngoài 403/404 | QT-055..060, QT-075 | HTTP | PASS | ran with role permissions + data scope (mode OFF) |
| O4-ENFORCE | Cùng các ca quyền ở chế độ ENFORCE như production | QT-089 | HTTP | NOT RUN | ENFORCE set-up (team templates, second administrator) not built in the time box |
| CFG-CREATE | Tạo quy trình, có bản nháp; quy trình mặc định | QT-005, QT-006, QT-020 | HTTP | PASS | — |
| CFG-STEPS | Bước: 4 đơn vị tính, 4 vai trò, ngưỡng, căn cứ pháp lý, mốc | QT-012, QT-014 | HTTP | PASS | — |
| CFG-PUBLISH | Kiểm khi xuất bản: đúng một xử lý chính, ngưỡng giảm dần, giờ cần mốc có giờ, tối đa một hạn chung | QT-007..011, QT-013 | HTTP | PASS | — |
| D09 | Bản đã xuất bản bất biến; sửa = bản nháp mới | QT-015, QT-016 | HTTP | PASS | — |
| CFG-BIND | Gắn với Loại thông tin | QT-018 | HTTP | PASS | binding by deadline group and binding conflicts: no check |
| CFG-ARCHIVE | Lưu trữ ⇄ khôi phục | QT-019 | HTTP | PASS | — |
| CFG-DELETE | Xoá bị chặn khi đang được dùng | QT-078 | HTTP | PASS | — |
| TAO-SUA-XOA | Tạo thì phải sửa và xoá (bản nháp xoá được) | QT-017 | HTTP | PASS | hard delete of an unused flow with the typed name: no check |
| CFG-COPY | Sao chép từ quy trình khác; bộ mẫu theo luật | — | — | GAP | no check |
| C1 | Vụ án HẠN CHẾ không lộ qua bước (chính sách hồ sơ cha) | QT-087 | HTTP | NOT RUN | not built in the time box |
| C2 | Ma trận quyền theo hành động (report, assign, adjustDue, extend, skip, reopen, approve...) | — | — | GAP | one cell touched (QT-059); no matrix check |
| C3 | Mẫu Lãnh đạo: xem toàn bộ, không cấp quyền sửa; người hai tổ | QT-088 | HTTP | NOT RUN | needs ENFORCE; not built in the time box |
| C4 | Đính kèm vào báo cáo của bước | — | — | GAP | PROGRESS: not built in the product yet |
| C5 | Một đầu mối ghi hạn; đường cũ bị từ chối khi quy trình giữ hạn | — | — | GAP | no check |
| C6 | Hạn quy định chỉ đổi bằng Gia hạn trong giới hạn; hạn nội bộ chỉ bằng hoặc sớm hơn; record.deadline = hạn quy định của bước hạn chung | QT-030, QT-050..054 | HTTP | FAIL | QT-030: the record deadline stayed 2026-05-12, expected 2026-06-27 |
| C7 | Duyệt không tự kết thúc hồ sơ | QT-073 | HTTP | PASS | — |
| C8 | Máy trạng thái: hoàn thành, mở lại, bỏ qua ⇄ bỏ bỏ qua, bước chờ bước trước | QT-028, QT-061, QT-064..066, QT-074 | HTTP | PASS | — |
| C8-IDEM | Thử lại cùng khoá idempotency không ghi hai lần | QT-062 | HTTP | PASS | — |
| C8-REV | expectedRevision cũ → 409 REVISION_CONFLICT | QT-063 | HTTP | PASS | — |
| C8-APPROVE | Bước cần duyệt chỉ xong khi lãnh đạo đồng ý đúng phiên bản báo cáo | QT-067..070, QT-072 | HTTP | FAIL | QT-069: editing the RESULT report while REPORTED answers 409 STEP_NOT_OPEN, so an approval of an older report revision could not be produced |
| C8-REWORK | Yêu cầu bổ sung mở lại bước | QT-071 | HTTP | PASS | the reminder to the handling unit: no check |
| C9 | Ghim căn cứ chọn quy trình (khớp theo LOẠI) | QT-023 | HTTP | PASS | version change with a per-step comparison: no check |
| C10 | Loại không nhận diện được → đề xuất, không khẳng định hạn pháp lý tới khi xác nhận | QT-080..084 | HTTP | FAIL | QT-081 counted in tracking, QT-082 band OVERDUE before confirmation |
| C11 | Lịch làm việc theo năm: nhập ngày nghỉ, xác nhận, hạn ngày làm việc dùng lịch đó | QT-004, QT-026 | HTTP | PASS | make-up days and the provisional label: no check |
| C11b | Bước mẫu chưa đối chiếu: nhãn tạm tính, không ghi hạn chung | — | — | GAP | no check |
| C12 | Nhắc qua outbox: một lần mỗi mức, A→B→A | QT-095 | HTTP | NOT RUN | not merged |
| C13 | Liên kết thông báo tới bước | — | — | GAP | no check |
| C14 | Quy trình tự nạp sau khi lưu hồ sơ (Đơn thư, Vụ việc) | QT-021, QT-022, QT-079 | HTTP | PASS | conversion Đơn thư→Vụ việc→Vụ án and Vụ án creation: no check |
| C15 | Số thẻ = số dòng ở cùng đồng hồ; đếm bước × đơn vị xử lý chính | QT-040..042, QT-044 | HTTP | PASS | — |
| C16 | Bật → ghi → tắt (route 404, quyền theo bước hết) → bật (dữ liệu còn) | QT-002, QT-003, QT-098, QT-101, QT-102 | HTTP | PASS | — |
| C16-LIST | Tắt: danh sách không có alert, tham số không đổi gì | QT-099, QT-100 | HTTP | NOT RUN | blocked by LIST-BASE |
| C16-LEGACY | Tắt bộ nhắc mới thì bộ nhắc cũ nhắc lại | — | — | GAP | no check |
| R3 | Tạm đình chỉ dừng đồng hồ, phục hồi dời hạn đúng thời gian dừng | QT-086 | HTTP | NOT RUN | settled by a 60 s server interval on the real clock; not drivable over HTTP |
| R4 | Đôn đốc + bậc thang | QT-094 | HTTP | NOT RUN | route absent (not merged) |
| R5 | Tỷ lệ đúng hạn theo đơn vị, theo kỳ | QT-092 | HTTP | NOT RUN | route absent (not merged) |
| R6 | CLI áp quy trình hàng loạt, chạy thử không ghi | QT-096 | HTTP | NOT RUN | npm script absent (not merged) |
| R7 | Vai trò Xem để biết: được xem, được báo, không có hạn | — | — | GAP | only configured (QT-014); behaviour not checked |
| R8 | Uỷ quyền theo khoảng ngày | — | — | GAP | PROGRESS: not built in the product yet |
| R9 | Cột Cảnh báo: mức nặng nhất trong các bước đang mở | QT-047, QT-048, QT-097 | HTTP | NOT RUN | blocked by LIST-BASE |
| LIST-BASE | Hồ sơ vừa tạo có mặt trên danh sách Đơn thư | QT-046 | HTTP | FAIL | GET /petitions answers total 0 on the db-push database while GET /petitions/:id returns the record |
| LIST-FILTER | Lọc alertBand, sắp xếp sortBy=alert | QT-049 | HTTP | NOT RUN | blocked by LIST-BASE; sortBy=alert has no check of its own |
| R10 | Một tệp hợp đồng mã cho máy chủ, web, Flutter | — | unit (repo) | GAP | no HTTP or browser evidence |
| R11 | Hồ sơ không có quy trình giữ hạn như cũ | QT-085 | HTTP | NOT RUN | the script could not create a case (caseProvenance is required) |
| TRACK-MINE | Lọc Việc của tôi | QT-043 | HTTP | PASS | — |
| TRACK-SCOPE | Người ngoài phạm vi không thấy việc của tổ khác | QT-045 | HTTP | PASS | — |
| TRACK-LEAVES | Bước xong / hồ sơ bị xoá rời số đếm ngay | QT-076, QT-077 | HTTP | PASS | finished and suspended records: no check |
| BACKLOG | Tồn đọng theo đơn vị: số trong ô = số dòng mở ra | QT-090, QT-091 | HTTP | NOT RUN | route absent (not merged) |
| BACKLOG-XLSX | Xuất Excel mở được, số khớp bảng | QT-093 | HTTP | NOT RUN | route absent (not merged) |
| S1 | Màn cài quy trình + Gantt | — | browser | GAP | no browser run |
| S2 | Tab Phân công xử lý | — | browser | GAP | no browser run |
| S3 | Tab Kết quả xử lý | — | browser | GAP | no browser run |
| S4 | Màn Theo dõi xử lý | — | browser | GAP | no browser run |
| S5 | Màn Tồn đọng theo đơn vị | — | browser | GAP | not merged; no browser run |
| S6 | Cột Cảnh báo trên ba danh sách | — | browser | GAP | no browser run |
| S7 | App smartphone | — | device | GAP | no device run |

Not verified at all: the browser click-through of the seven screens, the monkey run, ENFORCE mode, anything on production.

---

## Earlier ledgers (preserved)

# UAT coverage ? petition all-column search

Original spec: docs/superpowers/specs/2026-09-27-petition-all-column-search-design.md
Evidence: docs/uat/petition-all-column-search/REPORT.md; isolated UAT 27/27 PASS, retries 0, 0 cached. Scope covers this feature, not historical whole-application UAT.

| ID | M?n h?nh/Ch?c n?ng | Vi?t test | Ch?y test | K?t qu? |
|---|---|---|---|---|
| C01 | Danh s?ch ??n th?: stt | C? | API + E2E | PASS |
| C02 | Danh s?ch ??n th?: sttCu | C? | API + E2E | PASS |
| C03 | Danh s?ch ??n th?: loaiThongTin | C? | API + E2E | PASS |
| C04 | Danh s?ch ??n th?: nguonDon | C? | API + E2E | PASS |
| C05 | Danh s?ch ??n th?: nguoiGui | C? | API + E2E | PASS |
| C06 | Danh s?ch ??n th?: tomTat | C? | API + E2E | PASS |
| C07 | Danh s?ch ??n th?: donViGiaiQuyet | C? | API + E2E | PASS |
| C08 | Danh s?ch ??n th?: ketQuaXuLyKhac | C? | API + E2E | PASS |
| C09 | Danh s?ch ??n th?: nguoiNhap | C? | API + E2E | PASS |
| C10 | Danh s?ch ??n th?: trangThai | C? | API + E2E | PASS |
| C11 | Danh s?ch ??n th?: doiTuong | C? | API + E2E | PASS |
| C12 | Danh s?ch ??n th?: hanXuLy | C? | API + E2E | PASS |
| C13 | Danh s?ch ??n th?: ngayTao | C? | API + E2E | PASS |
| C14 | Danh s?ch ??n th?: ngayDeXuat | C? | API + E2E | PASS |
| C15 | Danh s?ch ??n th?: ngayTiepNhan | C? | API + E2E | PASS |
| C16 | Danh s?ch ??n th?: ngayTiepNhanNguonTin | C? | API + E2E | PASS |
| C17 | Danh s?ch ??n th?: ngayVietDon | C? | API + E2E | PASS |
| C18 | Danh s?ch ??n th?: ngayGiaoDonViGiaiQuyet | C? | API + E2E | PASS |
| C19 | Danh s?ch ??n th?: ngayPhieuChuyen | C? | API + E2E | PASS |
| C20 | Danh s?ch ??n th?: ngayCapCCCD | C? | API + E2E | PASS |
| C21 | Danh s?ch ??n th?: ngayVietDonChu | C? | API + E2E | PASS |
| B01 | Enter, kh?ng t?m live khi g? | C? | E2E | PASS |
| B02 | Ch?n g?i ? Lo?i th?ng tin | C? | E2E | PASS |
| B03 | ?n c?t kh?ng ??i ph?m vi t?m | C? | E2E | PASS |
| B04 | T?m kh?ng d?u | C? | API + E2E | PASS |
| B05 | Chip Lo?i th?ng tin v? search c? | C? | API | PASS |
| B06 | Ng?y ??y ??/th?ng/n?m | C? | API + E2E | PASS |
| B07 | Giao b? l?c tr?ng th?i v? ph?n trang | C? | API | PASS |
| B08 | Th?ng k? c?ng ?i?u ki?n | C? | API | PASS |
| B09 | Ph?n quy?n v? t? ch?i kh?ng ??ng nh?p | C? | API | PASS |
| B10 | Xu?t ??ng h? s? ?? t?m | C? | API + E2E | PASS |
| B11 | Kh?ng c? k?t qu? | C? | API | PASS |
| B12 | H? s? c? c? ch? m?c kh?ng r?ng ???c n?p l?i | C? | PostgreSQL integration | PASS |
| B13 | S?a d? li?u c?p nh?t ch? m?c, kh?ng ??i ng?y khi n?p l?i | C? | PostgreSQL integration | PASS |
| B14 | Petition list: select a calendar date, create a global-search chip, and find the matching record | Yes | API smoke + Playwright Chromium | PASS |

Reverse alignment: every data column in the petition list registry appears above, including hidden columns and free-text petition dates. API and UI behavior rows map to persisted qa/petition-search tests; database rows map to the isolated fixture assertions. Overall protocol remains NOT DONE because full-repository lint, default Playwright fixtures and cross-model review have outstanding gates.


---

## Historical UAT guidance (preserved)

# UAT-COVERAGE — đã chuyển về đúng chỗ

Tệp này từng chứa một ma trận **46 dòng viết tay** cho đợt 22/09/2026. Nó sai ở hai điểm, và
cả hai đều là lỗi quy trình chứ không phải lỗi nội dung:

1. **Đặt sai chỗ.** Quy ước của kho là mỗi đợt một thư mục `docs/uat/dot-XXXX/` gồm **bốn** tệp:
   `_domain-pack.md` (oracle) · `_coverage-ledger.md` (sổ phủ + `TC_min`) · `_platform.json`
   (nền tảng + vật cản) · `UAT-COVERAGE.md` (ma trận). Xem `docs/uat/dot-1809/` và
   `docs/uat/dot-2009/`. Tệp ở gốc kho không đi qua được công cụ nào.

2. **Con số 46 là em tự đặt.** Không tính từ phương pháp nào. Sàn thật do
   `coverage_calc.py` tính từ sổ phủ: `M1=140 · M2=120 · M3=33 · M4=120 → TC_min = 140`.
   Ma trận viết tay thiếu **94 ca**.

## Đợt 22–23/09/2026 nay nằm ở

**[`docs/uat/dot-2309/`](docs/uat/dot-2309/)** — 140 ca / 10 nhóm A–J, phủ trọn 12 PR
(#467 → #482) và cả 14 yêu cầu của anh trong hai ngày.

| Tệp | Vai |
|---|---|
| [`_domain-pack.md`](docs/uat/dot-2309/_domain-pack.md) | Oracle — 47 luật lấy từ yêu cầu của anh, không lấy từ mã |
| [`_coverage-ledger.md`](docs/uat/dot-2309/_coverage-ledger.md) | Sổ phủ 140 mệnh đề + cách tính `TC_min` |
| [`_platform.json`](docs/uat/dot-2309/_platform.json) | Nền tảng, phạm vi, vật cản |
| [`UAT-COVERAGE.md`](docs/uat/dot-2309/UAT-COVERAGE.md) | Ma trận 140 dòng |
| [`uat.json`](docs/uat/dot-2309/uat.json) | Bản máy đọc, bàn giao cho `uat-test-runner` |

## Trạng thái đo được

| | |
|---|---|
| Cổng máy | `validate_uat_json` ĐẠT · `coverage_calc` ĐẠT (140/140) · `self_audit` **SẴN SÀNG-KÈM-KHUYẾT** |
| Độ phủ | 134/140 item = 95,7% · 6 item là GAP có lý do |
| Đã chạy | **2/140** — mốc bản dựng, đo 23/09 04:38, `buildId 290f65d17c` khớp `origin/main` |
| Chưa chạy | **138/140** — chặn ở tài khoản thử prod |

Hai trong ba mục máy không đo được **đã làm**: soát đối kháng (Codex, 7 lỗi thật, đã sửa,
bộ ca 136 → 140) và gieo lỗi (`_fault-seeding.md`, 47 luật, 0 luật không ca nào bắt).
Còn trống **đánh giá trải nghiệm bằng người đóng vai thật** — cần tài khoản prod.

## Chặn ở anh

1. **Một tài khoản thử trên prod.** 5 tài khoản cũ khoá từ 20/09 vì mật khẩu lộ ở repo công khai.
2. **Một tài khoản cán bộ thuộc tổ khác.** Không có tài khoản thứ hai thì bốn ca phạm vi dữ liệu
   chỉ chứng minh được là mình thấy hồ sơ của mình, không chứng minh được ranh giới.

---

## Đợt 14/11/2026 (vòng đời Tổ · tiêu chí báo cáo theo tổ · quyền theo Tổ)

Nằm ở **[`docs/uat/dot-1411/`](docs/uat/dot-1411/)**: `_domain-pack.md` (59 luật, lấy từ yêu cầu và tệp kế hoạch) · `_coverage-ledger.md` · `_platform.json` · `UAT-COVERAGE.md` (179 dòng) · `uat.json`. Ba tệp sau sinh từ một bảng mệnh đề (`_build.py`).

Trạng thái đo được ngày 14/11: `validate_uat_json` đạt; độ phủ 179/179 mục; **`TC_min` hỏng (179 < 807, M2 chi phối)**; đã chạy **0/179 trên production**, 46/179 trên máy chủ dựng cục bộ qua HTTP (`tools/uat-phan-quyen/workflow.cjs`, `tools/uat-to/workflow.cjs`); gieo lỗi, soát đối kháng và đánh giá bằng người đóng vai chưa làm. Chặn ở tài khoản thử production.
