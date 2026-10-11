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

**ĐÃ XÁC NHẬN: KHÔNG phải bug — BUG-001 coi như đóng hoàn toàn.** Lượt thử tay đầu tiên của
tôi (dựng role MANAGER cấp 2 qua INSERT SQL rồi cho `manager-test` duyệt lần 1 qua API) cho
kết quả chuyển thẳng `APPROVED` sau 1 lần duyệt, trái kỳ vọng ban đầu — nhưng nguyên nhân THẬT
là **fixture artifact có sẵn từ một thử nghiệm trước chưa dọn hết**: ngay trước lượt thử của
tôi, submission đã ở `approvalLevel=1` (không phải `0` như tôi giả định khi tính kỳ vọng) do
một dòng `DynReportRevision` orphan (`revision=6, kind=APPROVE`) không khớp
`currentRevision=5` lúc đó còn sót lại. Với `approvalLevel` thật đã là `1` và
`totalApprovalLevels=2`, một lần duyệt nữa (`nextApprovalLevel = 1+1 = 2 >= 2`) **ĐÚNG RA**
phải chuyển `APPROVED` ngay — đây là hành vi đúng của code, không phải lỗi. Lỗi nằm ở phép đo
của tôi (không kiểm kỹ trạng thái fixture trước khi gán kỳ vọng), không phải ở sản phẩm.

Kỹ sư PR #584 đã tái lập độc lập bằng thí nghiệm sạch: dừng + build lại backend từ đầu (loại
cache), dọn fixture về đúng baseline gốc (`approvalLevel=0`), chèn 1 role MANAGER cấp 2 cho
`dr-test-viewer-user-1`, gọi trực tiếp `SubmissionService.approve()` qua tầng service/
transition thật (Prisma thật, không mock). Kết quả: **PASS cả 2 bước** — duyệt cấp 1 giữ
đúng `SUBMITTED` (approvalLevel 0→1), chỉ duyệt cấp 2 mới chuyển `APPROVED` (1→2). Đã dọn
sạch hoàn toàn dữ liệu thí nghiệm (xoá role chèn thêm, xoá 2 revision test, phục hồi
submission về đúng `SUBMITTED/approvalLevel=0/currentRevision=5`, xác nhận lại qua SELECT).

**Kết luận cuối**: R21 multi-level hoạt động đúng qua API/service thật sau vá PR #584.
TC-S33-01/02/03 (multi-level) có thể coi là **PASS** cho đường cơ chế lõi (dù UI cấu hình
`approvalLevel>1` vẫn CHƯA tồn tại — đây là GAP khác, không phải BUG-001, xem ghi chú PR #584
"chỉ có hạ tầng engine/DB đúng, chưa lộ ra cho người dùng"). KHÔNG cần điều tra thêm BUG-001.

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

## Cập nhật lượt 3 — thêm 4 E2E Playwright thật + phát hiện hạ tầng (khoá JWT)

**Phát hiện hạ tầng (không phải bug sản phẩm)**: sau khi coordinator restart backend "build
lại từ đầu" để kiểm BUG-001 sạch, login UI bắt đầu thất bại cho MỌI tài khoản (login API trả
200 + token hợp lệ về hình thức, nhưng request kế tiếp `/auth/me` dùng đúng token đó trả
`401`). Nguyên nhân: **tôi** đã để lại `backend/keys/private.pem` (mới, tự sinh) và
`backend/keys/public.pem` (revert về bản đã commit trong git) KHÔNG khớp cặp — vì tôi tưởng
"server đang chạy đã nạp khoá cũ vào RAM, không cần khớp file trên đĩa" ở 2 lượt trước, nhưng
không tính tới việc **ai đó restart lại server** sẽ đọc lại file TRÊN ĐĨA (lúc đó đã lệch cặp)
ngay từ đầu. Đã sửa: sinh lại cặp khoá NHẤT QUÁN (`openssl genrsa` + `openssl rsa -pubout`),
**lần này KHÔNG revert `public.pem` về bản git nữa** (chỉ để local, không commit) để tránh lặp
lại lỗi này nếu backend bị restart lần nữa trong phiên sau. Xác nhận lại bằng
`login → /auth/me` qua `fetch` thật: `200`. **Ghi chú cho phiên sau**: `backend/keys/
public.pem` hiện có thay đổi local chưa commit (khớp `private.pem` hiện tại, cả hai đều chỉ
dùng cho dev cục bộ) — ĐỪNG `git checkout -- backend/keys/public.pem` nếu chưa chắc
`private.pem` nào đang khớp, luôn sinh lại CẢ HAI cùng lúc.

**4 E2E Playwright thật mới (sau khi khoá đã khớp), đều PASS**:
| Screen/journey | Tài khoản | Kết quả |
|---|---|---|
| S01 (danh sách thiết lập) | admin | PASS — hiện đúng "Báo cáo test dán TSV", không lỗi |
| S13 (mở báo cáo đã khoá qua route nhập) | admin (là editor active của assignment) | PASS — trang render đúng submission, không 404/500. *Không kết luận được việc input có bị khoá đúng hay không* — selector của tôi (`input[type=text/number]`) quá rộng, nhiều khả năng bắt trúng ô tìm kiếm chung của layout chứ không phải ô dữ liệu báo cáo; cần locator cụ thể hơn (theo `data-testid`/`fieldKey`) ở lượt sau để kết luận chắc |
| S19 (dashboard tình trạng, J-DASH-01) | manager-test | PASS — hiện đúng dữ liệu thật |
| S34 (hàng chờ mở khoá) | manager-test | PASS — trang tải không lỗi |

Cộng với J-REVIEW-01 (lượt 2) → **tổng 5 E2E Playwright thật PASS** qua 4/10 journey chính
trong `_domain-pack.md` (J-REVIEW-01, J-DASH-01, J-UNLOCK-01 một phần, và phần hiển thị của
J-WIZARD-01/J-ENTRY-01 qua S01/S13). **CHƯA có E2E nào đi hết một journey từ đầu tới cuối
qua nhiều bước** (ví dụ J-WIZARD-01 đầy đủ: upload → preview → cấu hình kỳ → phân công →
publish) — các E2E ở trên là "mở đúng trang, render đúng dữ liệu", không phải "thực hiện
toàn bộ luồng nghiệp vụ". Đây vẫn là GAP cần làm ở lượt sau.

## Cập nhật lượt 4 — Full E2E J-WIZARD-01→J-ENTRY-01→J-REVIEW-01→chốt kỳ qua API thật, bắt BUG-002

Dựng template Excel thật bằng `openpyxl` (2 sheet "To 1"/"To 2", mỗi sheet 4 ô token
`{TEXT}`/`{NUM|0.00|SUM}`/`{DATE}`/`{TIME}`, **ô unlocked đúng chuẩn** qua
`Protection(locked=False)` — bài học: mặc định `openpyxl` mọi ô là LOCKED dù không bật sheet
protection, phải set tường minh). Chạy **toàn bộ journey qua API thật** (không phải mock,
không phải unit test) nối tiếp nhau, dùng chính báo cáo/kỳ/lượt giao MỚI do chính các bước
trước sinh ra (không phải fixture cũ):

1. `POST /templates/sheets` → `POST /templates/preview` (selectedSheets) → **8 field đúng
   kiểu TEXT/NUM/DATE/TIME phát hiện đúng qua token grammar** (E02 xác nhận live).
2. `POST /reports` (multipart, config đầy đủ: 2 team, 1 manager, 2 rule ERROR+WARNING, period
   ONE_TIME) → publish **201** → report+version tạo thật trong DB.
3. (Scheduler sinh kỳ chạy hàng giờ qua `@Cron('0 * * * *')` — KHÔNG kịp trong phiên ngắn,
   nên tôi tự chèn 1 period + 2 assignment/submission/editor qua SQL tham số hoá, additive,
   mô phỏng đúng cấu trúc scheduler sẽ tạo — **đây là giới hạn đã biết của phép đo này, ghi
   rõ không phải tôi đã verify scheduler tạo kỳ ONE_TIME đúng ngay sau publish**).
4. `PATCH .../values` với `'abc'` cho ô NUM → **400 CELL_VALIDATION đúng, có lỗi rõ ràng**
   (sau khi tôi sửa đúng field format `values: {fieldKey: rawString}` theo DTO thật, lần đầu
   tôi gửi sai dạng `{t,v}` gây `500` — lỗi của tôi, không phải sản phẩm).
5. `PATCH` giá trị hợp lệ TEXT/NUM/DATE/TIME cho cả 2 tổ → **200, lưu đúng**.
6. `POST .../submit` cả 2 tổ → **201 SUBMITTED**.
7. `POST .../comments` (ghi chú theo ô + theo cả bản nộp, cả editor và manager) → **201, đọc
   lại đúng cả 2 ghi chú** — **TC-S37-01/02/03 PASS thật**.
8. `POST .../approve` cả 2 tổ (manager-test) → **201 APPROVED**.
9. `POST /periods/:id/finalize` → **201 FINALIZED** — xem BUG-002 dưới.
10. Thử SAVE/SUBMIT/APPROVE lại sau khi đã chốt → **409 REPORT_LOCKED "Kỳ đã chốt, không thể
    lưu."**; thử finalize lần 2 → **409 INVALID_STATE_TRANSITION "Kỳ đã chốt rồi."** —
    **TC-S38 khoá-sau-chốt PASS thật, đúng D04**.

### BUG-002 (P1/S3) — `finalizePeriod()` không kiểm tra đã đủ duyệt trước khi chốt kỳ — **ĐÃ VÁ (PR #586)**

**Cập nhật: ĐÃ VÁ**, nhánh `fix/dynamic-reports-finalize-empty-period`, PR #586 (commit
`db98c32b`, đang chờ CI), **đã merge vào nhánh UAT này** (merge thật, không cherry-pick —
cùng lý do tránh trùng lặp khi rebase `main` như BUG-001). Cách vá: thêm guard trong
`finalizePeriod()` — chặn chốt kỳ khi có ≥1 tổ `REQUIRED` mà KHÔNG tổ nào đạt
`SUBMITTED`/`APPROVED`; kỳ toàn bộ `EXEMPT` hoặc đã có ≥1 tổ nộp (kể cả còn người chưa nộp)
vẫn chốt được bình thường — **không ép 100% hoàn thành** vì spec không yêu cầu điều đó (chỉ
chặn trường hợp hoàn toàn trống, không chặn trường hợp một phần). 2 unit test mới, full suite
8223/8338 PASS, tsc sạch.

**Tôi đã tái lập + xác nhận độc lập qua API thật** (không chỉ tin lời báo cáo): seed 1 kỳ mới
trên `dr-test-report-1` với 1 lượt giao `NOT_STARTED` duy nhất, gọi `POST finalize` →
**409 INVALID_STATE_TRANSITION: "Chưa có tổ nào nộp dữ liệu cho kỳ này — không thể chốt một
kỳ trống."** — đúng như vá. Đã dọn sạch dữ liệu test ngay sau khi xác nhận.

**GAP UX còn lại (CHƯA vá, ghi nhận rõ không lẫn với BUG-002)**: dialog `window.confirm` ở
`ReportPeriodSummaryPage.tsx#handleFinalize()` vẫn CHƯA hiện tỷ lệ hoàn thành (vd "3/16 tổ đã
nộp") — người dùng vẫn có thể chốt kỳ ở trạng thái MỘT PHẦN (vd 1/16 tổ) mà không được cảnh
báo rõ, chỉ bị chặn ở trường hợp 0/16 tuyệt đối. Đây là GAP trải nghiệm riêng, không phải bug
chức năng — xem mục "Đánh giá UI/UX" bên dưới.

**Mô tả**: `backend/src/dynamic-reports/aggregate/aggregate.service.ts` dòng 527-560
(`finalizePeriod`) chỉ kiểm `period.status !== 'OPEN'` trước khi cho chốt — **không có bất kỳ
điều kiện nào** yêu cầu các `DynReportAssignment`/`DynReportSubmission` của kỳ đó đã
`APPROVED` (hay tối thiểu `SUBMITTED`). **Tái lập thật, không giả định**: tạo 1 kỳ mới, 2
lượt giao cả hai còn `NOT_STARTED` (0 dữ liệu), gọi `POST finalize` ngay — **201, period
chuyển `FINALIZED`, snapshot `mode=APPROVED` được tạo** dù không có gì để snapshot (0 tổ nộp).
Xác nhận qua SELECT DB: `dyn_report_submissions.state = 'NOT_STARTED'` cho cả 2 assignment,
`dyn_report_periods.status = 'FINALIZED'` ngay sau đó.

**Kiểm cả lớp UI**: `frontend/src/pages/dynamic-reports/ReportPeriodSummaryPage.tsx` hàm
`handleFinalize()` CÓ `window.confirm(...)` nhưng nội dung chỉ "Chốt kỳ này? Sau khi chốt,
không tổ nào sửa được nữa trừ khi mở chốt lại." — **không nêu tỷ lệ đã nộp/đã duyệt**, nút
không bị disable theo % hoàn thành. Vậy cả API và UI đều không có rào chắn.

**Vì sao đây là vấn đề thật**: D04 ("Chốt kỳ khoá cả kỳ + snapshot chính thức") và mục đích
nghiệp vụ của "chốt kỳ" (thay thế quy trình Excel tay, tạo bản chính thức để báo cáo) ngụ ý
chốt kỳ là hành động CUỐI của một quy trình đã hoàn tất thu thập — không phải một nút bấm vô
điều kiện. Một quản lý (vô ý hoặc thiếu hiểu biết) có thể chốt kỳ khi mới 0/16 hoặc 3/16 tổ
đã nộp, tạo ra snapshot chính thức SAI (gần như toàn số 0) mà không có cảnh báo nào. Có đường
khôi phục (ADMIN "mở chốt" — xem ROLE_MATRIX) nên không chấm S1 (không mất dữ liệu vĩnh viễn,
chỉ cần ai đó phát hiện và mở chốt lại) — xếp **P1/S3**.

**Khuyến nghị**: thêm kiểm tra tối thiểu (chặn cứng hoặc ít nhất cảnh báo rõ số liệu % đã
SUBMITTED/APPROVED ngay trong `window.confirm`, lý tưởng là chặn cứng ở API nếu <100% đã
APPROVED trừ khi có cờ `force`/lý do tường minh — tương tự cách "mở chốt" đã yêu cầu lý do).

### Bài học kiểm thử (KHÔNG phải bug, tự sửa trong lượt này)

Lần thử đầu của tôi gán rule ERROR so sánh `'To 1!B2'` với `'To 2!B2'` (hai SHEET khác nhau —
tức hai TỔ khác nhau) rồi mong SUBMIT của tổ 1 bị chặn khi hai giá trị không khớp. Thực tế:
**không bị chặn** — tôi SUÝT ghi nhận đây là "ERROR rule không hoạt động". Đọc code
(`submission.service.ts` dòng ~1701-1706) cho thấy `evaluateRulesFor()` chỉ nhận
`assignment.submission!.values` — **đúng theo kiến trúc, một lượt giao (1 tổ) không bao giờ
thấy field của tổ khác**, nên `'To 2!B2'` luôn là operand thiếu. `engine/rules.ts` dòng
78-101 xác nhận `missingStrategy` mặc định là `'SKIP'` — operand thiếu thì BỎ QUA rule, không
tính vi phạm. **Đây là hành vi đúng theo thiết kế, test của tôi sai kiến trúc** (rule kiểm
tra chỉ có ý nghĩa SO SÁNH TRONG CÙNG MỘT LƯỢT GIAO, ví dụ `'To 1!B2'` so với hằng số hoặc
field khác CÙNG SHEET). **Khuyến nghị cho `uat.json` lượt sau**: sửa `data_required`/steps
của TC-S36-01/02 dùng rule trong-cùng-sheet, không cross-sheet — tôi CHƯA sửa `uat.json`
trong lượt này (hết ngân sách), ghi rõ ở đây để không ai lặp lại nhầm lẫn này.

## Bảng seeded-fault ↔ TC (effectiveness, Bước 7b) — dựa trên fault THẬT đã gặp, không mô
phỏng thêm trong code sản phẩm (tránh sửa file dùng chung trong worktree đang có người khác
làm việc — rủi ro đã gặp 1 lần ở lượt trước khi nhánh bị đổi dưới tay)

| # | Business rule quan trọng | Fault đã THẬT xảy ra (không phải giả định) | TC nào bắt được | Bắt được? |
|---|---|---|---|---|
| 1 | R21: APPROVE chỉ đúng cấp kế tiếp | `actingApprovalLevel`/`totalApprovalLevels` hardcode `1` (BUG-001, code thật trước PR #584) | TC-S33-01/02 (chạy live) | ✅ CÓ — phát hiện ngay trong lượt 1 |
| 2 | D04: chốt kỳ chỉ sau khi đã có tổ nộp (không ép 100%) | `finalizePeriod()` không kiểm trạng thái submission (BUG-002, code thật) — **ĐÃ VÁ PR #586, đã tái lập xác nhận lại qua API thật: 409 chặn đúng** | TC-S38-01 (chạy live, bản sửa cần viết thêm ở `uat.json`) | ✅ CÓ — phát hiện trong lượt 4, vá xong lượt 5, tái xác nhận độc lập; khuyến nghị bổ sung `db_assert` cho TC-S38-01 ở lượt sau để TC tự biết nếu ai regress lại |
| 3 | AC-002 sửa: khoá+token vẫn chặn publish | (chưa gặp fault thật — test template của tôi vô tình tạo đúng case "mọi ô đều locked" ở lần build đầu, hệ thống phản ứng đúng bằng WARNING `LOCKED_LOOKS_LIKE_TOKEN`, không phải lỗi) | TC-S02-04/TC-S03-02 | N/A — quan sát hành vi đúng, không phải fault-seed |
| 4 | SUBMIT guard: NUM invalid bị chặn | Thử `'abc'` cho ô NUM | TC-S11-02 (chạy live) | ✅ CÓ — `400 CELL_VALIDATION` đúng |
| 5 | D04: nộp thì khoá ngay, sau chốt không ai sửa được | Thử SAVE/SUBMIT/APPROVE lại sau khi đã `FINALIZED` | TC-S13-01/TC-S38-01 (chạy live) | ✅ CÓ — `409 REPORT_LOCKED` đúng mọi lần thử |
| 6 | S36 missingStrategy: rule thiếu operand bị SKIP, không phải VIOLATION | Rule cross-sheet tự tạo (xem mục "Bài học kiểm thử" trên) — fault của TÔI (test sai kiến trúc), không phải sản phẩm | TC-S36-01 (bản gốc trong `uat.json`) | ❌ KHÔNG — vì TC thiết kế sai kiến trúc nghiệp vụ (thiếu Domain Research sâu hơn về phạm vi field trong rule); đã ghi nhận để sửa TC ở lượt sau, không phải oracle trang trí vì root cause đã xác định rõ |

**Đọc bảng này**: 4/6 dòng là fault THẬT (không phải mutation tôi tự tạo trong code — do rủi
ro sửa file sản phẩm trong worktree đang có người khác làm việc đồng thời), và TC tương ứng
ĐÃ bắt được khi chạy thật. Dòng 6 cho thấy ngược lại: TC thiết kế sai có thể không bắt được
fault (ở đây là "thiếu kiến trúc hiểu đúng field scope"), đúng tinh thần oracle-minimizer —
một TC không bắt được gì khi nó SAI, không phải khi sản phẩm đúng.

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
