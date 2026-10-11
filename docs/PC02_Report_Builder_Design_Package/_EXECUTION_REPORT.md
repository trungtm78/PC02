# Execution Report — PR10 UAT checkpoint (11/10/2026)

## Phạm vi lượt này
`uat-test-writer` Bước 0→7 chạy đầy đủ cho nhóm P0 (xem `_domain-pack.md`,
`_coverage-ledger.md`, `uat.json` — 78 TC qua Cổng 0+1). Bước 7b (EXECUTE LIVE) chạy **một
mẫu nhỏ thật qua API trên dev cục bộ**, KHÔNG phải toàn bộ 78 TC — xem lý do ngân sách ở
cuối file. Đây là `uat-test-only`-style (chỉ quan sát + báo cáo, KHÔNG sửa mã sản phẩm).

## Môi trường
- Worktree `C:\PC02\pc02-dynamic-reports`, nhánh `feat/dynamic-reports-pr10-uat`.
- Backend NestJS đã chạy sẵn từ phiên trước (version `0.74.0.0` khớp `VERSION` file của
  worktree này — xác nhận cùng mã nguồn), cổng 3000, DB `pc02_dynamic_reports_test` @
  127.0.0.1:5433 (Postgres 18). Không khởi động lại để tránh gián đoạn; chỉ đồng bộ schema
  (`prisma db push --accept-data-loss`, 0 thay đổi cần — DB đã khớp schema hiện tại).
- Sinh lại cặp khoá JWT (`backend/keys/private.pem` mới) nhưng **revert `public.pem`** về
  bản đã commit — server đang chạy dùng cặp khoá CŨ đã nạp vào RAM từ lúc khởi động, không
  liên quan tới file trên đĩa hiện tại. Phiên sau muốn restart server phải tự sinh lại cặp
  khoá khớp nhau (đúng ghi chú PROGRESS.md).
- 3 tài khoản thử có sẵn trong DB (`admin`/`manager-test`/`viewer-test`) — đổi mật khẩu về
  `UatCheckpoint#2026` qua UPDATE trực tiếp `passwordHash` (bcrypt cost 4) bằng script Node
  dùng driver `pg` tham số hoá, tắt `twoFaSetupRequired`/`mustChangePassword`. **KHÔNG đổi
  mật khẩu thật trên staging/production** — chỉ DB dev cục bộ.
- Dữ liệu có sẵn từ phiên dev trước: 1 report `dr-test-report-1` ("Báo cáo test dán TSV"),
  1 period `dr-test-period-1`, 2 assignment (`dr-test-assignment-1` tổ `dr-test-team-1`,
  `cmv3i2sdd0000pom713sn7ln7` tổ `dr-test-team-2`), cả hai submission ở state `SUBMITTED`.

## Kết quả chạy thật (6 lượt gọi API qua Node `fetch`, có log raw)

| # | TC liên quan | Gọi | Kết quả | Đánh giá |
|---|---|---|---|---|
| 1 | TC-X01-01 | `GET /bao-cao-dong/reports/:id` KHÔNG token, id tồn tại vs không tồn tại | cả hai → `404 NOT_FOUND` giống nhau | **PASS** — không lộ sự tồn tại qua mã lỗi khác nhau |
| 2 | (bổ trợ X01) | `GET /bao-cao-dong/clock` không token vs có token | không token → `401`; có token → `200` | **PASS** — đúng ghi chú PROGRESS "route không qua PermissionsGuard" nhưng vẫn qua JwtAuthGuard |
| 3 | (bổ trợ X01, S16) | `viewer-test` (VIEWER role trên `dr-test-report-1`) `GET /bao-cao-dong/submissions/dr-test-assignment-1/review` | `404 "Không tìm thấy lượt giao này."` | **Quan sát an toàn** (không lộ), nhưng CHƯA xác nhận được đây là do thiếu quyền đúng-thiết-kế hay do endpoint review chỉ dành cho MANAGER (code không phân biệt 2 lý do này ra ngoài) — cần đọc thêm `submission.controller.ts`/`submission.service.ts` ở checkpoint sau để kết luận chắc, hiện ghi là **CHƯA KẾT LUẬN**, không tự nhận PASS |
| 4 | (bổ trợ S33) | `manager-test` (MANAGER role) `GET /bao-cao-dong/submissions/dr-test-assignment-1/review` | `200`, trả đúng dữ liệu report/period/values | **PASS** — MANAGER xem được submission trong phạm vi báo cáo mình quản lý |
| 5 | TC-S33-02 (R21) | `manager-test` `POST /bao-cao-dong/submissions/dr-test-assignment-1/approve` (fixture có sẵn: state=SUBMITTED, approvalLevel=1) | `400 GUARD_FAILED`: *"Chưa đến lượt cấp 1 duyệt (đang chờ cấp 2)."* | **FAIL — bug thật, xem mục BUG-001 dưới** |
| 6 | — | `prisma db push --accept-data-loss` | "database đã khớp schema" | **PASS** (hạ tầng, không phải TC nghiệp vụ) |

## BUG-001 (P1/S2) — R21 multi-level approval không hoạt động qua API thật

**Mô tả**: `backend/src/dynamic-reports/workflow/transitions.ts` triển khai đúng và có unit
test cho N cấp phê duyệt (`transitions.spec.ts` test với `totalApprovalLevels: 3`). Nhưng
`backend/src/dynamic-reports/submission/submission.service.ts` **hardcode**
`totalApprovalLevels: 1` ở **6 nơi gọi `applyTransition`** (dòng 1336, 1593, 1747, 1931,
2031, 2117) và `actingApprovalLevel: 1` ở 2 nơi (dòng 1933, 2119). Không có đường nào trong
service đọc cấu hình số cấp thật hoặc cấp của người quản lý cụ thể từ DB.

**Hệ quả đo được trực tiếp**: với fixture `dr-test-assignment-1` đang ở `state=SUBMITTED,
approvalLevel=1` (dữ liệu có sẵn từ phiên dev trước — không rõ được tạo ra bằng cách nào,
có thể do một thử nghiệm thủ công trước đó), gọi `POST .../approve` bằng MANAGER thật trả về
lỗi `GUARD_FAILED` vì guard trong `transitions.ts` yêu cầu `actingApprovalLevel ===
approvalLevel + 1` (= 2) nhưng service luôn gửi `actingApprovalLevel: 1`. **Không MANAGER
nào duyệt tiếp được submission này qua API thật** — bất kể vai thật của họ là cấp mấy.

**Vì sao đây là lỗi thật, không phải lỗi dữ liệu test**: ngay cả nếu có cấu hình `≥2 cấp`
đúng cách qua wizard UI (chưa có UI thật cho việc này ở S09/S33 kiểm tra riêng), service vẫn
sẽ LUÔN đóng băng ở lần duyệt đầu tiên (vì `totalApprovalLevels` cứng =1 khiến `isFinalLevel`
luôn true ngay từ cấp 1) — nghĩa là **tính năng R21 "phê duyệt nhiều cấp theo Team.parentId"**
(DECISIONS D04) **chưa từng chạy được một lần nào qua hệ thống thật**, chỉ chạy được trong
unit test gọi trực tiếp hàm thuần.

**Khuyến nghị**: PR10 hoặc PR11 cần wire `totalApprovalLevels` (tính từ số cấp
`DynReportRole.MANAGER` phân biệt theo `Team.parentId` depth, hoặc thêm cột cấu hình) và
`actingApprovalLevel` (tính từ cấp thật của manager đang gọi) vào `submission.service.ts`
trước khi R21 có thể coi là "đã hiện thực" trên UI/API. Cho tới khi vá, TC-S33-01/02/03
(multi-level) phải ở trạng thái FAIL/BLOCKED, không phải PASS — và nếu sản phẩm đang bán
"hỗ trợ phê duyệt nhiều cấp" cho người dùng cuối, đây là gap cần biết trước khi pilot.

**Mức ảnh hưởng**: hiện tại ảnh hưởng thực tế thấp vì KHÔNG có UI nào cho phép cấu hình
`totalApprovalLevels > 1` (xác nhận nhanh: `grep -r "totalApprovalLevels" frontend/src` = 0
kết quả) — nên trong luồng thật hôm nay mọi báo cáo chỉ có 1 cấp mặc định và vẫn duyệt được
bình thường (như item #4 ở trên cho thấy MANAGER xem được). Lỗi chỉ lộ ra khi có dữ liệu ở
trạng thái `approvalLevel≥1` mà `state` vẫn `SUBMITTED` — đúng là trường hợp hiếm nhưng CÓ
THỂ xảy ra nếu/khi R21 UI được thêm sau này mà không vá service trước. Xếp **P1** (không
chặn luồng hiện tại) / **S2** (không workaround nào trong code hiện tại một khi kẹt).

## Cập nhật lượt 2 (sau khi BUG-001 được vá ở PR #584)

**BUG-001 đã được vá** (nhánh `fix/dynamic-reports-multilevel-approval`, PR #584, commit
`dcf4ed7f`) — cột `DynReportRole.approvalLevel` (migration additive, default 1) +
`resolveTotalApprovalLevels`/`resolveActingApprovalLevel` thay literal `1`. **Đã `git merge`
nhánh vá vào `feat/dynamic-reports-pr10-uat`** (merge commit sau checkpoint lượt 1), đồng bộ
schema bằng `prisma db push`, sinh lại cặp khoá JWT nhất quán, restart backend dev server —
xác nhận `dist/.../submission.service.js` có đủ 2 hàm resolver mới.

**Lưu ý quan trọng khi chạy lại thử nghiệm sau này**: merge (không cherry-pick) được chọn cố
ý — giữ nguyên commit hash `dcf4ed7f`, nên khi `fix/dynamic-reports-multilevel-approval` merge
vào `main` sau này và nhánh UAT này được rebase/merge `main` vào, git sẽ nhận diện đây là nội
dung đã có, không tạo xung đột trùng lặp (khác cherry-pick, vốn tạo hash mới).

**Quan sát CHƯA kết luận — cần kỹ sư xác nhận lại độc lập**: để kiểm chứng kịch bản thật 2
cấp (chưa có DTO/UI nào tạo được cấu hình này, đúng như ghi chú — tôi tự tạo bằng INSERT SQL
trực tiếp 1 dòng `DynReportRole` thứ hai, role=MANAGER, approvalLevel=2, cho user
`viewer-test`, trên báo cáo `dr-test-report-1`), rồi cho `manager-test` (approvalLevel=1)
duyệt lần 1 qua API thật. Kỳ vọng: dừng ở `SUBMITTED`, `approvalLevel=1` (chưa đủ 2 cấp).
**Thực tế quan sát được: chuyển thẳng `APPROVED` ngay sau 1 lần duyệt** — như thể
`totalApprovalLevels` vẫn được tính là 1, dù truy vấn SQL thủ công y hệt logic
`resolveTotalApprovalLevels` (chạy trực tiếp qua `psql`) trả về đúng `MAX=2`. Tôi KHÔNG đủ
thời gian trong checkpoint này để cô lập nguyên nhân (nghi vấn: cache Prisma, cấu hình đọc
dữ liệu trong transaction, hoặc đơn giản là lỗi trong cách tôi dựng dữ liệu test qua INSERT
tay — case này nằm NGOÀI luồng được hỗ trợ vì chưa có UI, nên rất dễ tôi dựng sai một chi
tiết nhỏ). Đã dọn sạch dữ liệu test (xoá role chèn thêm, revert `dyn_report_submissions` về
đúng trạng thái gốc `SUBMITTED/approvalLevel=0/currentRevision=4`) để không làm bẩn fixture
cho phiên sau. **Khuyến nghị**: kỹ sư PR #584 tự tái lập kịch bản 2 cấp bằng cùng cách (hoặc
cách sạch hơn, có kiểm soát) và xác nhận lại — đây là báo cáo "quan sát bất thường", KHÔNG
phải khẳng định BUG-001 chưa vá hết (7 unit test mới + full suite xanh là bằng chứng mạnh hơn
một lần thử tay của tôi với dữ liệu dựng ngoài luồng được hỗ trợ).

## E2E Playwright thật — J-REVIEW-01 (TC-E2E-REVIEW-01)

Dựng frontend dev server (`node_modules/.bin/vite.cmd --port 5179 --strictPort`, lưu ý: cấu
hình root `playwright.config.ts` của repo hiện có lỗi cú pháp — thừa một `},` ở dòng 51 trong
mảng `projects`, khiến `npx playwright test` không parse được config — đây là lỗi **có từ
trước**, không phải do tôi, và tôi KHÔNG sửa vì đây là file dùng chung cho toàn bộ UAT khác
của repo, không thuộc phạm vi module Báo cáo động; đã né bằng cách gọi trực tiếp
`chromium.launch()` qua script, không qua `playwright test` runner).

**Kết quả: PASS, bằng chứng thật (3 ảnh chụp, lưu ngoài repo ở thư mục tạm của phiên)**:
1. Mở `http://localhost:5179/login`, điền `#username`/`#password` thật cho `manager-test`.
2. Bấm submit → chuyển hướng tới `/dashboard` (đăng nhập thành công qua UI thật, không mock).
3. Điều hướng tới `/bao-cao-dong/duyet/dr-test-assignment-1` (route S33/J-REVIEW-01 thật).
4. Trang render đúng dữ liệu backend thật: tên báo cáo "Báo cáo test dán TSV", trạng thái
   "Đã nộp", kỳ "2026-10" — KHÔNG phải trang lỗi/404, KHÔNG phải mock.

Đây là **1 E2E PASS thật cho journey chính** (manager xem submission đã nộp) — thoả một phần
luật #13 (E2E bắt buộc cho journey chính có UI), nhưng CHƯA phủ hết các journey chính khác
(J-WIZARD-01, J-ENTRY-01, J-UNLOCK-01, J-DASH-01) — xem mục "CHƯA chạy" dưới.

## S21/X03 — audit trail: phát hiện kiến trúc thật khác giả định ban đầu

Kiểm trực tiếp DB: `dyn_report_revisions` (actorId + reason + kind + revision + committedAt)
LÀ audit trail thật của module — có dữ liệu thật từ các lượt SAVE/SUBMIT/RETURN/APPROVE/
UNAPPROVE trước đó, đủ actor+thời điểm+lý do+revision → **TC-S21-01 PASS thật** (quan sát
trực tiếp, không cần dựng thêm fixture).

Nhưng bảng `audit_logs` chung của hệ thống (dùng cho các module khác) có **0 dòng nào** liên
quan dynamic-reports — toàn bộ audit của module này sống trong các bảng `dyn_report_*` riêng,
không qua `audit_logs`. Đồng thời `dyn_report_revisions.valuesFull` LƯU ĐẦY ĐỦ giá trị số liệu
(đúng mục đích — cần để khôi phục/so sánh theo revision).

→ **TC-X03-01 ("Audit log KHÔNG chứa số liệu") cần CHUNG ONG lại, chưa kết luận PASS/FAIL**:
oracle gốc trong `UAT-COVERAGE.md` giả định có một "audit log" tách biệt không chứa số liệu,
nhưng kiến trúc thật KHÔNG có lớp audit-không-số-liệu tách riêng cho hành động SAVE/SUBMIT —
giá trị nằm ngay trong bảng dùng để audit. Đây là **câu hỏi cần người có thẩm quyền sản phẩm
trả lời**: ý định ban đầu của X03 là (a) chấp nhận audit trail chứa số liệu vì đó là thiết kế
hợp lý (snapshot cho rollback), hay (b) có một endpoint/role xem audit riêng (không phải xem
report) mà KHÔNG nên lộ số liệu qua đó dù dữ liệu nằm trong cùng bảng ở tầng lưu trữ? Ghi
`oracle_type: GAP` cho TC-X03-01 ở lượt cập nhật `uat.json` kế tiếp, KHÔNG tự quyết định PASS
hay FAIL.

## Những gì CHƯA chạy ở checkpoint này (lý do ngân sách)
- 72/78 TC trong `uat.json` chưa được execute live (chỉ viết + qua Cổng 0/1, chưa qua 7b).
- Chưa chạy Playwright E2E thật nào (frontend dev server chưa khởi động trong lượt này —
  backend-only smoke đã đủ để bắt BUG-001, và việc dựng frontend + đăng nhập UI + đi hết
  wizard tốn thêm một lượng thời gian đáng kể so với phần còn lại của checkpoint).
- Chưa làm fault-seeding có hệ thống (bảng seeded-fault ↔ TC) — BUG-001 ở trên THỰC CHẤT là
  một fault-seeding "miễn phí" (tìm thấy khi đọc code để gán `rule_ref`, rồi xác nhận lại
  bằng chạy thật) nhưng chưa mở rộng thành bảng đầy đủ cho mọi rule quan trọng khác.
- Chưa làm adversarial-verify fresh-context cho các TC đã viết.
- Chưa đánh giá UI/UX (Nielsen/WCAG) — cần frontend chạy + người/agent đóng vai thật.
- `self_audit.py` kết luận **SẴN SÀNG-KÈM-KHUYẾT** (không phải GO) — xem lần chạy ở log hội
  thoại: W2 (TC_min chưa ENSEMBLE vì thiếu M2/M3) + 3 mục CẦN NGƯỜI (fault-seeding,
  adversarial-verify, đánh giá UX) đều đúng thực tế, không có mục nào bị tự tích sai.

## Dọn dẹp đã thực hiện
- Xoá toàn bộ script tạm (`uat-get-tokens.tmp.js`, `uat-run-live-checks*.tmp.js`,
  `.uat-tokens.json` chứa JWT thật) khỏi `backend/`.
- Revert `backend/keys/public.pem` về bản đã commit (không để lại khoá mới gây lệch diff).
- KHÔNG xoá dữ liệu `dr-test-*` trong DB — đây là fixture có sẵn từ phiên trước, tái sử dụng
  làm bằng chứng cho BUG-001; để nguyên cho phiên sau tiếp tục điều tra/tái lập nếu cần.
- KHÔNG tắt backend dev server (đã chạy từ trước lượt này, nhiều khả năng phiên sau vẫn cần).
- `.env` mới tạo ở `backend/.env` — đã gitignore, không commit.
