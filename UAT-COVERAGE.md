# UAT coverage — processing flow and deadlines per information type ("Quy trình & hạn xử lý")

Oracle: the top part of the plan `t-i-m-n-h-nh-danh-twinkling-acorn.md` (the owner's rules, sections 1–4, decisions C1–C16, R3–R11) and the engine rules listed in `PROGRESS.md`. Expected values are computed by the script, never read back from the product.

Evidence: `tools/uat-quy-trinh/workflow.cjs`, final round, run on 2026-11-15 over HTTP against a local stack built from `origin/feat/processing-flow-assign-delegate-attach` at `a64f564e` (plus the UAT script), on a freshly created database `pc02_uat_quy_trinh` (`prisma db push` + `tools/uat-quy-trinh/install-triggers.cjs` + the seeds; `prisma migrate deploy` does not replay on an empty database). Checks: **195 PASS, 0 FAIL, 0 NOT RUN** of 195. One run; the script refuses a database that already holds processing flows.

**HTTP coverage: 54 of 56 requirements = 96.4%** (PASS only; FAIL 0, NOT RUN 0 and GAP 2 count as not covered). The seven screens are outside this percentage: see the browser pass. A PASS covers what its row says; what a row's note lists as "no check" is NOT covered.

| Requirement | What it says | Checks | Layer | Status | Note |
|---|---|---|---|---|---|
| O1 | Thời hạn bước theo giờ / ngày / ngày làm việc (qua 30/4, 1/5, cuối tuần) / tháng; hạn do script tự tính | QT-027..030 | HTTP | PASS | — |
| O2 | Bước giao cho đơn vị; không chỉ định thì trưởng đơn vị chịu trách nhiệm (Việc của tôi) | QT-048 | HTTP | PASS | — |
| O2b | Chỉ định cán bộ của bước: tổ trưởng chỉ định, thành viên tự nhận / trả lại, người ngoài đơn vị bị từ chối, danh sách ứng viên | QT-079..084 | HTTP | PASS | — |
| O3 | Mức màu theo số ngày còn lại; đúng hạn = ĐỎ, sau hạn = QUÁ HẠN; ranh giới nửa đêm VN | QT-036..044 | HTTP | PASS | — |
| O3b / C12 | Nhắc việc: chỉ mức hiện tại, một lần mỗi mức, không dồn, quá hạn mỗi ngày VN, nhắc lại sau đổi hạn | QT-182..187 | in-process tick on the real database + SQL read of proc_reminders + HTTP /notifications | PASS | the tick is driven by tools/uat-quy-trinh/reminder-tick.ts, not by the server's scheduler; bands exercised: YELLOW, RED, OVERDUE (a GREEN reminder was not exercised); the 'may not read' check only shows that people outside the step got nothing; the escalation ladder (R4) and the off-hours deferral: no check |
| O4 | Đơn vị được giao bước đang mở: xem hồ sơ, báo cáo bước mình, KHÔNG sửa hồ sơ; hết khi bước xong; tổ ngoài 403/404 | QT-061..066, QT-120 | HTTP | PASS | mode OFF |
| O4-ENFORCE | Cùng các ca quyền ở chế độ ENFORCE như production (bật bằng hai quản trị, trả về OFF) | QT-154..157, QT-160, QT-161 | HTTP | PASS | trigger sections installed on the db-push database |
| CFG-CREATE | Tạo quy trình, có bản nháp; quy trình mặc định | QT-006, QT-007, QT-021 | HTTP | PASS | — |
| CFG-STEPS | Bước: 4 đơn vị tính, 4 vai trò, ngưỡng, căn cứ pháp lý, mốc | QT-013, QT-015 | HTTP | PASS | — |
| CFG-PUBLISH | Kiểm khi xuất bản: đúng một xử lý chính, ngưỡng giảm dần, giờ cần mốc có giờ, tối đa một hạn chung | QT-008..012, QT-014 | HTTP | PASS | — |
| D09 | Bản đã xuất bản bất biến; sửa = bản nháp mới | QT-016, QT-017 | HTTP | PASS | moving a running record to a new version: no check |
| CFG-BIND | Gắn với Loại thông tin | QT-019 | HTTP | PASS | binding by deadline group and binding conflicts: no check |
| CFG-ARCHIVE | Lưu trữ ⇄ khôi phục | QT-020 | HTTP | PASS | — |
| CFG-DELETE | Xoá bị chặn khi đang được dùng | QT-124 | HTTP | PASS | — |
| TAO-SUA-XOA | Tạo thì phải sửa và xoá (bản nháp xoá được; quy trình chưa dùng xoá cứng khi gõ đúng tên) | QT-018, QT-150 | HTTP | PASS | — |
| CFG-COPY | Sao chép từ quy trình khác | QT-149 | HTTP | PASS | — |
| CFG-TEMPLATES | Bộ mẫu theo luật có sẵn; bước của mẫu ở trạng thái chưa đối chiếu | QT-147, QT-148 | HTTP | PASS | — |
| C1 | Vụ án HẠN CHẾ không lộ qua bước (bước, kết quả, hồ sơ, màn Theo dõi) | QT-137, QT-138 | HTTP | PASS | the case is marked RESTRICTED by SQL (set-up) |
| C2 | Ma trận quyền: thiếu quyền của hành động → 403; có quyền → không bị từ chối vì quyền | QT-070..078 | HTTP | PASS | refused without the permission: reopen, skip, adjustDue, extend, approve, assign, nudge; allowed with it: report, complete; opine without the permission: no check |
| C3 | Mẫu Lãnh đạo: xem toàn bộ, không cấp quyền sửa; người hai tổ | QT-152, QT-153, QT-158, QT-159 | HTTP | PASS | ENFORCE |
| C4 | Đính kèm vào báo cáo của bước: đơn vị phối hợp đính kèm, thấy, tải đúng byte, gỡ; đơn vị khác và hồ sơ khác bị từ chối; hết sau khi bước xong; POST /documents vẫn từ chối | QT-088..093, QT-121 | HTTP | PASS | — |
| C5 | Một đầu mối ghi hạn: form cũ gửi hạn khác → 409 DEADLINE_MANAGED_BY_FLOW; cùng ngày thì nhận | QT-034, QT-035 | HTTP | PASS | Đơn thư only; the assign and /extend paths of Vụ việc: no check |
| C6 | Hạn quy định chỉ đổi bằng Gia hạn trong giới hạn; hạn nội bộ chỉ bằng hoặc sớm hơn; record.deadline = hạn quy định của bước hạn chung | QT-033, QT-056..060 | HTTP | PASS | — |
| C7 | Duyệt không tự kết thúc hồ sơ | QT-118 | HTTP | PASS | — |
| C8 | Máy trạng thái: hoàn thành, mở lại, bỏ qua ⇄ bỏ bỏ qua, bước chờ bước trước | QT-031, QT-104, QT-107..109, QT-119 | HTTP | PASS | the 'upstream reopened' flag: no check |
| C8-IDEM | Thử lại cùng khoá idempotency không ghi hai lần | QT-105 | HTTP | PASS | — |
| C8-REV | expectedRevision cũ → 409 REVISION_CONFLICT | QT-106 | HTTP | PASS | — |
| C8-APPROVE | Bước cần duyệt chỉ xong khi lãnh đạo đồng ý; sửa chỉ khi OPEN; rút lại trước khi duyệt; ý kiến duyệt ghi mã + phiên bản báo cáo | QT-110..114, QT-116, QT-117 | HTTP | PASS | — |
| C8-REWORK | Yêu cầu bổ sung mở lại bước | QT-115 | HTTP | PASS | the reminder to the handling unit: no check |
| C9 | Ghim căn cứ chọn quy trình (khớp theo LOẠI) | QT-026 | HTTP | PASS | — |
| C10 | Loại không nhận diện được → đề xuất: không màu, không đếm trong bốn mức, đếm riêng (summary.unconfirmed), danh sách theo RECORD_DEADLINE; xác nhận một lần bấm | QT-126..132 | HTTP | PASS | — |
| C11 | Lịch làm việc theo năm: nhập ngày nghỉ, xác nhận, hạn ngày làm việc dùng lịch đó | QT-004, QT-005, QT-029 | HTTP | PASS | make-up days and the provisional label: no check |
| C11b | Bước hạn chung chưa đối chiếu: không ghi hạn chung; đối chiếu rồi mới ghi | QT-022, QT-023, QT-033 | HTTP | PASS | — |
| C13 | Liên kết thông báo tới bước (mở đúng bước từ thông báo) | — | — | GAP | no check |
| C14 | Quy trình tự nạp sau khi lưu hồ sơ; chuyển Đơn thư → Vụ việc mở quy trình đích, việc của nguồn rời màn Theo dõi | QT-024, QT-025, QT-125, QT-139 | HTTP | PASS | Vụ việc → Vụ án (prosecute): no check |
| C15 | Số thẻ = số dòng ở cùng đồng hồ; đếm bước × đơn vị xử lý chính; dòng tổng không đếm trùng | QT-045..047, QT-049, QT-164 | HTTP | PASS | — |
| C16 | Bật → ghi → tắt (route 404 kể cả Đôn đốc, tick không ghi, danh sách như trước, quyền theo bước hết) → bật (dữ liệu còn) | QT-002, QT-003, QT-188, QT-190..195 | HTTP + in-process tick | PASS | — |
| C16-LEGACY | Tắt bộ nhắc mới thì bộ nhắc hạn cũ nhắc lại | — | — | GAP | no check |
| R3 | Tạm đình chỉ dừng đồng hồ; phục hồi dời hạn đúng thời gian dừng | QT-141..143 | HTTP | PASS | the end of the pause is bracketed by the script's clock (the API does not report it), so the shift is checked within that bracket, not to the millisecond |
| R4 | Đôn đốc kèm lời nhắn, ghi vào sổ ý kiến (NUDGE); chặn 30 phút | QT-178..181 | HTTP | PASS | the escalation ladder (after N / M days): no check |
| R5 | Tỷ lệ đúng hạn theo đơn vị = đúng hạn / (đúng hạn + chậm + đang quá hạn) | QT-173..175 | HTTP | PASS | the average days: no check |
| R6 | CLI áp quy trình: chạy thử không ghi; chạy thật áp được; chạy lại không còn gì | QT-134..136 | CLI + HTTP + SQL counts | PASS | — |
| R7 | Vai trò Xem để biết: được xem, không có hạn riêng, không được đếm là việc, không báo cáo | QT-067..069 | HTTP | PASS | whether it receives reminders: no check |
| R8 | Uỷ quyền theo khoảng ngày: mở chỉ đọc, báo cáo thay (ghi làm thay ai), Việc của tôi, không sửa, không mở hồ sơ khác, thu hồi, chồng khoảng, không cùng tổ | QT-094..103 | HTTP (+ one SQL read of the history as a fallback for onBehalfOfUserId) | PASS | the delegate receiving the reminders: no check |
| R9 | Cột Cảnh báo: mức nặng nhất trong các bước đang mở, trên cả ba danh sách | QT-053, QT-054, QT-145, QT-146, QT-189 | HTTP | PASS | — |
| LIST-FILTER | Lọc alertBand, sắp xếp sortBy=alert | QT-051, QT-052, QT-055 | HTTP | PASS | Đơn thư only |
| R10 | Một tệp hợp đồng mã cho máy chủ, web, Flutter | QT-151 | HTTP + files | PASS | — |
| R11 | Hồ sơ không có quy trình giữ hạn như cũ (Vụ án không tự tính) | QT-133 | HTTP | PASS | Đơn thư / Vụ việc legacy deadlines and the legacy reminder (pinned by the repository's database specs): no HTTP check |
| VIEWER | DTO `viewer` khớp với máy chủ (canReport) | QT-085, QT-086 | HTTP | PASS | — |
| TRACK-MINE | Lọc Việc của tôi | QT-048 | HTTP | PASS | — |
| TRACK-SCOPE | Người ngoài phạm vi không thấy việc của tổ khác | QT-050 | HTTP | PASS | — |
| TRACK-TEAMS | Danh sách đơn vị để lọc, cho cán bộ không có read:User | QT-087 | HTTP | PASS | — |
| TRACK-LEAVES | Bước xong / hồ sơ bị xoá / đã chuyển / tạm đình chỉ / đã kết thúc rời số đếm ngay | QT-122, QT-123, QT-139, QT-140, QT-144 | HTTP | PASS | — |
| BACKLOG | Tồn đọng theo đơn vị: mọi ô = số dòng mở ra; người ngoài không thấy đơn vị khác | QT-162, QT-163, QT-165 | HTTP | PASS | the oldest record column and the 'chưa áp quy trình' column: no check |
| BACKLOG-FILTER | Bộ lọc loại hồ sơ, vai trò, khoảng ngày: ô vẫn bằng số dòng | QT-166..172 | HTTP | PASS | filter by information type: no check |
| BACKLOG-XLSX | Xuất Excel mở được, số khớp bảng | QT-176, QT-177 | HTTP + ExcelJS | PASS | — |

Screens (not in the HTTP percentage):

- S1 Màn cài quy trình + Gantt — browser: see browser pass
- S2 Tab Phân công xử lý — browser: see browser pass
- S3 Tab Kết quả xử lý — browser: see browser pass
- S4 Màn Theo dõi xử lý — browser: see browser pass
- S5 Màn Tồn đọng theo đơn vị — browser: see browser pass
- S6 Cột Cảnh báo trên ba danh sách — browser: see browser pass
- S7 App smartphone — browser: see browser pass

Not verified by this run: the screens, the monkey run, the server's own 15-minute scheduler firing the reminder tick, push delivery (FCM), `prisma migrate deploy` on an empty database (it fails at the first migration), anything on production.

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
