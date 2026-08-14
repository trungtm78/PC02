STATUS: BLOCKED
BLOCKED_REASON: 🔴 MỚI: gate cờ tính năng (E4/E5/E6) KHÔNG BAO GIỜ CHẠY — `FeatureFlagGuard`
là APP_GUARD toàn cục nên chạy trước `JwtAuthGuard` cấp controller, `request.user` luôn
undefined, dòng `if (!request.user) return true` luôn thoát sớm, `isEnabled()` không bao giờ
được gọi. Xác nhận từ mã + đo bằng curl. CHẶN MERGE E6. Chi tiết + cách sửa: UAT-COVERAGE.md.
Ngoài mục đó: hết việc code. Năm mục còn lại cần người: chạy lại /codex cho PR-F1;
kiểm tay 4 đợt UAT; `migrate resolve --applied 00000000000000_baseline` trên DB thật;
ngưỡng tỷ lệ APK cũ cho E6; ND-12 (mật khẩu trong git history), ND-13 (mã vật chứng
trùng trong 53k dòng legacy), ND-20 (chính sách ghi bản ghi chưa phân công).

# PROGRESS
Cập nhật: 2026-08-10T03:15:00+07:00 | Milestone: M1/5 | Task: 0/5 của M1

> Nguồn sự thật về trạng thái thi công. Kế hoạch gốc: `~/.claude/plans/r-so-t-to-n-b-vast-minsky.md`
> (đã qua `/plan-eng-review` + outside voice). Lịch sử đợt di trú legacy trước đó đã chuyển sang
> [docs/legacy/PROGRESS-legacy-remigration.md](docs/legacy/PROGRESS-legacy-remigration.md).

## Bản đồ milestone

| MS | Tên | PR | Trạng thái |
|----|-----|----|-----------|
| M0 | Hồi sức — lỗi đang phá dữ liệu trên production | A1 | **1/1 xong** |
| M0.5 | Governance — CI gate + ADR | B0a, B0b, B0c | **3/3 xong** |
| M1 | Mất dữ liệu / bảo mật còn lại + nền mobile | D1, A2, A3, A4, M1 | chưa bắt đầu |
| M2 | Hạ tầng cờ tính năng | B1, B2, B3 | chưa bắt đầu |
| M3 | Xóa mockup | C1–C12 | chưa bắt đầu |
| M4 | Vòng đời dữ liệu | D2–D9 | chưa bắt đầu |
| M5 | Dọn dẹp + gate API | E1–E6 | chưa bắt đầu |

## Đã hoàn thành

- [x] **M0.5-T1 — PR-B0a `chore/ci-governance-gate`** — nhánh `chore/ci-governance-gate`
  - CI job `Governance Gate` (`.github/workflows/ci.yml`): enum-literal guard → gen:enums drift → lint ratchet. Hai guard đầu **không cần dependency** nên fail nhanh trước `npm ci`.
  - `scripts/governance/check-enum-literals.cjs` — hiện thực quy tắc CLAUDE.md:31 vốn chỉ là tuyên bố. Ratchet qua `enum-literals-baseline.json` (57 vi phạm sẵn có, chỉ được giảm). Dùng lại `parseEnums` của generator nên guard và codegen không thể lệch nhau.
  - `scripts/governance/lint-changed.cjs` — ratchet đếm lỗi theo file qua `lint-baseline.json` (555 file / 9278 vấn đề). File đã đụng không được **tệ đi**; file mới phải sạch.
  - Nối `backend/test/` vào jest roots và mở rộng vitest `include` → 2 file test chưa bao giờ chạy nay đã chạy; sửa 2 lỗi drift mà `enums-sync.spec.ts` phát hiện ngay khi được chạy.
  - Dọn 117 lỗi lint trên các file PR-A1 đã đụng (`eslint --fix`), tuân đúng chính sách ratchet vừa đặt ra.
  - Sửa 2 tuyên bố sai trong CLAUDE.md (grep guard "đã có", số test 2461) + bổ sung `tsc -b` và cảnh báo chạy tuần tự.
  - Test: +7 BE cho chính guard (`test/governance-enum-literals.spec.ts`).

- [x] **M0-T1 — PR-A1 `fix/admin-role-permission-matrix`** — 3 commit (`6ff8e67`, `98f9b7c`, `e64161c`) — patch coverage: BE 100% dòng mới, FE 69/70 statement (1 guard chống race)
  - BE: thêm `GET /admin/roles/:id/permissions` (`admin.controller.ts:127-132`, `admin.service.ts:getRolePermissions`)
  - BE: `deleteRole` chặn xóa vai trò hệ thống trong `SYSTEM_ROLE_NAMES` + validate tồn tại + ghi audit `ROLE_DELETED`
  - BE: thêm `SYSTEM_ROLE_NAMES` vào `common/constants/role.constants.ts`
  - FE: ma trận quyền dựng động từ `GET /admin/permissions`, fail-closed khi load lỗi, modal xác nhận hiện diff thật
  - Test: +8 BE (3 `getRolePermissions`, 4 role hệ thống, 1 NotFound), +2 BE controller, +8 FE

## Đang làm dở

Task: Phase 0 + Phase 1 — môi trường Flutter (**XONG**) và quyền frontend thật (**CHƯA XONG — xem finding bên dưới**)

**Phase 0 — Flutter (mở khóa toàn bộ M5).** `winget` không có gói Google.Flutter ⇒ dùng cách chính thức thứ hai: clone kênh stable về `C:\srclutter` (không cần quyền admin). `flutter test` trên `mobile/` chạy được: **96 test**.
- Sửa 1 test đỏ **có sẵn**: `petitions_api_test.dart` stub `limit: 20` trong khi `getPetitions()` khai mặc định `limit: 50` ⇒ mock không khớp, mocktail trả `null`, test chết vì `type 'Null' is not a subtype of Future<Response>` chứ không phải vì bộ lọc trạng thái mà nó tuyên bố kiểm. Test sai về giá trị mặc định, không phải code sai.
- **Chạy mobile test:** `$env:Path = "C:\srclutterin;$env:Path"; cd mobile; flutter test`

**Phase 1 — ND-6: bỏ `MOCK_ALL_PERMISSIONS`.** Tầng quyền FE là một hằng số cấp **mọi quyền cho mọi người**, dùng ở 48 file / 252 chỗ gồm cả xóa hàng loạt. BE là cổng thật duy nhất nên không có lỗ bảo mật trực tiếp — thứ người dùng nhận được là **nút họ không được bấm**, bấm vào thì 403.
- BE: `getProfile()` trả thêm `permissions: [{action, subject}]`.
- FE: `shared/enums/permission-mapping.ts` dịch từ vựng BE (`read|write|edit|delete` × `Case|Petition|…`) sang từ vựng FE (`view|create|edit|delete` × `cases|petitions|…`). **Hai hệ chưa bao giờ dùng chung từ vựng** — khi câu trả lời luôn là `true` thì khoảng cách đó vô hình.
- **Một nguồn, không phải hai:** ban đầu tôi đọc cả `getUser()` lẫn `getProfile()` ⇒ **32 test đỏ** vì mock chỉ stub `getUser`. Nhưng `getUser()` vốn đã trả profile khi có cache và rơi về JWT khi không — mà JWT **không mang quyền**, nên phiên chưa hydrate tự động ra tập rỗng. Đó đúng là hành vi fail-closed cần có, miễn phí.
- Subject/action không ánh xạ được thì **bỏ**, không đoán: một resource FE không biết thì không render được, mà bịa câu trả lời cho nó chính là cách một mockup bắt đầu.
Test: +9 FE (tầng ánh xạ) +3 BE (`/auth/me` trả quyền); sửa 5 test cũ vốn khẳng định hành vi "ai cũng có mọi quyền".
Kiểm: BE **227 suite / 3104 test** PASS, FE **159 file / 1547 test** PASS, **mobile 96 test** PASS, tsc sạch, 3 cổng xanh.
### Finding `/codex` PR-F1 — **7×[P1], ĐÃ XONG 7/7**

Vòng review khắt khe nhất từ đầu dự án. Tôi commit khi **chưa đạt** điều đã tuyên bố. Phải sửa hết trước khi coi Phase 1 là xong:

1. **[P1] Tôi đổi cái *hook*, không gate các *nút*.** Tuyên bố "UI thôi nói dối" **không thành hiện thực**: `UserManagementPage` chỉ gate click-vào-dòng; nút Thêm người dùng, nhập hàng loạt, sửa, reset mật khẩu/2FA, xoá vẫn bật cho OFFICER chỉ có `read:User`. Nút tạo ở danh sách vụ án/đơn thư/vụ việc cũng vô điều kiện. **Đây là finding quan trọng nhất** — phần còn lại vô nghĩa nếu không làm cái này.
2. **[P1] `usePermission()` không phản ứng.** Chỉ chụp `authStore.getUser()` một lần, **không subscribe** `AUTH_TOKEN_EVENT`. `/auth/me` xong thì component đã mount vẫn giữ tập quyền rỗng của JWT ⇒ điều khiển bị chặn **vĩnh viễn** cho tới khi có render vì lý do khác.
3. **[P1] `write → create` sai ở phạm vi toàn cục.** BE dùng `write` cho **cả tạo lẫn sửa** với `Directory`, `Setting`, `User`, `Report` — các subject này **không có** permission `edit`. Nên người có `write:Directory` trượt `canEdit(...)` dù BE cho phép.
4. **[P1] Profile cache cũ suốt cả phiên tab.** `useAuthHydration` bỏ qua khi đã có cache; đường refresh 401 thay access token nhưng **không** xoá `authProfile` ⇒ quyền bị thu hồi vẫn sống trên UI tới khi đăng xuất.
5. **[P1] Lối tắt ADMIN bất nhất với BE.** `PermissionsGuard` **không** có bypass ADMIN — nó đọc `rolePermission` thật. Màn hình sửa quyền vai trò có thể gỡ quyền của ADMIN ⇒ FE trả `true`, API trả 403.
6. **[P1] OFFICER mất quyền UI** ở `objects`, `lawyers`, `directories`, `reports`, `settings`; `users` và `calendar` còn view-only. **Quyền `Evidence` đầy đủ của OFFICER bị vứt** vì Evidence không có trong bảng ánh xạ — đây là hồi quy thật do chính tôi vừa thêm module vật chứng ở PR-D1.
7. **[P1] Spec auth gán trực tiếp vào field `private readonly`** — codex nói là lỗi TS. `tsc --noEmit` của tôi **xanh**, nên cần kiểm lại: hoặc false positive, hoặc tsconfig không cover file đó.

[P2]: bảng ánh xạ bỏ sót `AuditLog`, `Role`, `Document`, `Evidence`, `Team`, `DeadlineRuleVersion`, `FeatureFlag`, `EditWindowResetRequest` và các action `approve`, `withdraw_own`, `request_changes`, `review_reset_request` ⇒ **`DEADLINE_APPROVER` ánh xạ ra tập rỗng**. Test ánh xạ của tôi so với **danh sách viết tay**, không so với seed BE ⇒ nó xanh trong khi mọi thiếu sót trên vẫn tồn tại; lời khẳng định "phủ mọi action trừ restore" là **sai**.

**Sai sót của riêng tôi cần ghi lại:** tôi lặp lại con số "48 file / 252 chỗ dùng" từ kế hoạch gốc **mà không kiểm chứng**, trong commit message và trong comment code. Thực tế là **17 file**. Phải sửa các chỗ đã viết.

**Đã sửa 6/7 finding (commit tiếp theo):**
- #1 ✅ gate nút thật: `UserManagementPage` (Thêm/Import/Sửa/Reset mật khẩu/Reset 2FA/Xoá), `CaseListPageShell` (Tạo mới).
- #2 ✅ `useSyncExternalStore` + `authStore.onTokenChanged`. Thêm `getProfileRaw()` trả **chuỗi thô** vì `useSyncExternalStore` so snapshot theo tham chiếu — `getProfile()` parse JSON mỗi lần sẽ render vô hạn.
- #3 ✅ `WRITE_ALSO_MEANS_EDIT` theo từng subject (`Setting`, `Report`, `Directory`, `User` không có permission `edit`, nên `write` bao cả sửa).
- #4 ✅ xoá `authProfile` trong nhánh refresh 401 của `lib/api.ts`.
- #5 ✅ **bỏ lối tắt ADMIN ở FE** (không thêm bypass ở BE) — BE cố ý không có bypass và seed đã cấp ADMIN mọi quyền, nên thực tế không đổi gì mà hai bên hết mâu thuẫn.
- #6 ✅ thêm `Evidence` vào bảng ánh xạ (gắn với resource `cases`).
- #7 ✅ **codex đúng về bản chất, sai về cơ chế.** Không phải lỗi TS — là `as any` **bịt** lỗi TS lại. `tsc` của tôi xanh vì phép kiểm không nhìn xuyên được qua cast, không phải vì codex báo nhầm. 26 chỗ trong 12 spec dùng `Object.create(X.prototype)` rồi chọc thẳng vào dependency `private readonly`. Tác hại thật: đổi tên `prisma` trong service thì spec vẫn biên dịch, vẫn xanh, mà tiêm vào một field không còn tồn tại. Đã chuyển 11 spec sang constructor thật (2 guard + jwt strategy dùng `keys/public.pem` CÓ trong repo nên constructor chạy nguyên vẹn). **Hai ngoại lệ có lý do, đã ghi tại chỗ:** `auth.service.spec.ts` (constructor đọc `keys/private.pem` — khoá bí mật không nằm trong repo, đúng như vậy) và các chỗ thay *state nội bộ* (`running`, `logger`, `sendInApp`) chứ không phải dependency.

**BƯỚC TIẾP THEO — đã xong hết:**
1. ✅ Finding #7 (xem trên).
2. ✅ Test ánh xạ đọc `seed-permissions.ts` thật qua `?raw`, không còn danh sách viết tay.
3. ✅ Nút tạo đã gate ở cả ba: `CaseListPageShell`, `PetitionListPageShell`, `IncidentListPageShell` (kèm cả phím tắt Alt+N).
4. ⏳ `/codex` cho PR-F1 — **chưa chạy lại**. Đừng coi là sạch khi chưa chạy.
5. ✅ ND-22 và Phase 2 (C4, C5, C9, C10, C11, C12-rest) đã xong ở các đợt sau.

---

Task: M3-T7 — PR-C3 `feat/petition-duplicates-api` (**code xong, chờ `/codex`**)
Đã làm: `GET /petitions/duplicates` — nhóm đơn nghi trùng, **có điểm khớp thật**.
- **Vì sao phải nâng cấp, không chỉ trích hàm ra dùng chung:** thuật toán cũ gộp **một cột**, khớp **chuỗi chính xác**, rồi coi mọi bản trong nhóm là trùng. "Nguyễn Văn A" không hiếm ở Việt Nam ⇒ hai công dân không liên quan bị trình bày như một người nộp hai lần. Trên hồ sơ pháp lý đó là **quy kết**, không phải gợi ý. Nay mỗi nhóm mang `{matched, compared}` — bao nhiêu tiêu chí **thực sự so được** thì khớp. Trường mà **không phải ai cũng điền** thì không tính, vì ô trống không phải bằng chứng theo chiều nào cả.
- **Phân trang thật** thay cho `take: 500` cắt cụt im lặng (500 dòng trông như "chỉ có bấy nhiêu").
- **`crossTeam`**: đánh dấu nhóm trải trên nhiều tổ — chính là thứ đáng phát hiện nhất, mà lại vô hình khi bộ lọc phạm vi chạy trước groupBy.
- `buildDuplicateWhere` + `resolveDuplicateKey` dùng chung cho cả API lẫn xuất Excel ⇒ hai đường không thể bất đồng về "thế nào là trùng".
- **+3 btree index** (`senderPhone`, `senderAddress`, `suspectedPerson`) + migration viết tay. Chỉ `senderName` có index; index gin trigram đang có là để ILIKE, **không phục vụ GROUP BY**. Ghi rõ trong migration vì sao không dùng `CONCURRENTLY`.
Test: +14 cho thuật toán chấm điểm, gồm đúng ca "hai người trùng tên".
Kiểm: BE **227 suite / 3101 test** PASS, tsc sạch, 3 cổng xanh.
**BƯỚC TIẾP THEO:** `/codex` cho PR-C3, rồi C4 (quyết định hợp nhất) và C5 (viết lại trang).

---

Task: M3-T6 — PR-C6 `feat/reports-period-and-delta` (**code xong, chờ `/codex`**)
Đã làm: `getMonthly` trả thêm **`tableRows`** và **`summary`** — hai field mà `MonthlyReportPage` **đã đọc từ khi được viết** nhưng BE chưa từng trả. Hệ quả: bảng "Tồn đầu kỳ / Phát sinh / Đã giải quyết / Tồn cuối kỳ" luôn render nhánh rỗng và dòng tổng luôn bằng 0 — trông như kỳ báo cáo không có hoạt động, chứ không như một API còn thiếu.
- Đúng **6 truy vấn**, không nhân thêm vào vòng lặp 12 tháng đang có (12 × 6). PERF-002 chính là mẫu này phình ra.
- `tonCuoiKy` chặn dưới ở 0 — tồn âm là vô nghĩa trên báo cáo.
- Tỷ lệ khi mẫu số 0 trả **0%**, không phải `NaN` hiện thành "NaN%".
Test: +5.
Kiểm: BE **226 suite / 3087 test** PASS, FE **158 file / 1538 test** PASS, tsc sạch, 3 cổng xanh, baseline lint **8.036**.
**BƯỚC TIẾP THEO:** `/codex` cho PR-C6, rồi C3/C4/C5 (trùng đơn) và C9/C10/C11.

---

### Finding đã xử lý ở checkpoint `/codex` gộp cho cả M3 (C1, C2, C7, C8, C12)

Codex mở đầu bằng **"Not merge-ready"** — và đúng. Ba [P1], tất cả đều là **bản vá của tôi chưa thật sự chạy được**:

1. **Ô chọn vụ án ở kiến nghị không tải được trên production.** Tôi gọi `/cases?limit=200` trong khi DTO chặn `@Max(100)` ⇒ 400, lỗi bị nuốt, ô chọn bắt buộc luôn rỗng ⇒ **không tạo được kiến nghị**. Tôi tự phát hiện trước khi codex trả lời và đã hạ xuống 100; codex chỉ thêm rằng 100 vẫn cắt mất vụ án cũ — `FKSelection` có ô tìm trong dropdown nên vẫn tìm được trong 100 bản mới nhất, nhưng quá 100 thì cần tìm phía server ⇒ **ND-24**.
2. **Sửa vụ án liên quan vẫn báo thành công giả.** `proposals.update` nhận `relatedCaseId` rồi **bỏ qua** — whitelist dừng ở `caseType`. Đúng hình dạng bug tôi vừa sửa ở đường tạo, còn nguyên ở đường sửa. Nay ghi thật, kèm **kiểm phạm vi trên vụ án đích** (đổi cha là ghi vào *cả hai* hồ sơ, kiểm cha cũ thôi thì chưa đủ) — chính là ND-18 áp cho riêng module này.
3. **Bản vá "phường" của tôi đọc một trường hệ thống không hề lưu.** `metadata.ward` không tồn tại: địa điểm lưu ở `metadata.noiXayRa`, còn phường thật nằm ở `subjects.wardId` và BE lọc **qua subjects**. Tức tôi thay một nguồn sai bằng một nguồn sai khác. Ô chọn cũng vẫn là 3 phường bịa. Đã **gỡ hẳn** control + trường `ward`, kèm ghi chú tại chỗ chỉ sang cách đúng ⇒ **ND-25**.

Hai [P2] + một [P3], sửa hết:
- **Lệch múi giờ**: `createdAt.slice(0,10)` cắt theo UTC trong khi hiển thị theo `Asia/Ho_Chi_Minh` ⇒ bản ghi lúc `20:00Z` hiện 11/08 mà lọc như 10/08. Dùng `toDateInput`.
- **Test "không báo thành công khi hỏng" chưa hề submit** — form trống nên validate chặn trước, `api.post` không bao giờ được gọi ⇒ test đó **xanh cả với code cũ**. Nay điền đủ trường, khẳng định `api.post` **đã** được gọi, rồi mới kiểm lỗi hiện ra và modal còn mở.
- **Test bộ lọc kiểm bản sao, không kiểm code thật** — đã tách `applyFilters`/`deriveCategories` ra `otherClassificationFilters.ts` và test import chính nó.

Task: M3-T5 — PR-C7 `fix/reports-dynamic-period` (**xong — qua `/codex` gộp M3**)
Đã làm: hai lỗi trên **cả ba** trang báo cáo.
- **Thẻ KPI mất màu trên production.** `` className={`text-${stat.color}-600`} `` — Tailwind JIT quét **tên class đầy đủ trong source**, chuỗi ghép lúc chạy không bao giờ nằm trong lượt quét đó, nên các class này **không có trong stylesheet bản build**. Dev thấy bình thường vì bản dev quét lỏng hơn — đó là lý do không ai bắt được. Rút `<StatCard>` dùng chung, bản đồ màu **tĩnh**, mọi class viết nguyên văn.
- **Số phần trăm bịa.** `change: "+12%"`, `"+18%"`, `"-12%"`… đứng cạnh tổng số thật, cố định vĩnh viễn cho mọi tháng và mọi người dùng. Một con số không bao giờ đổi vẫn đọc như một phép đo, nên tệ hơn là không hiện gì. Đã bỏ; `change` giờ là prop tùy chọn, chỉ hiện khi có số thật (BE cấp `previousTotals` ở PR-C6).
- Bắt được thêm `color: "orange"` ở `OverdueRecordsPage` — không có trong bảng màu, tức mất màu ở lớp thứ hai.
Test: 10 test khẳng định **tên class thật sự phát ra**, gồm một assert `not.toContain('${')` — chính là hình dạng của bug.
Kiểm: FE **158 file / 1535 test** PASS, tsc sạch, 3 cổng xanh.
**BƯỚC TIẾP THEO:** `/codex` cho PR-C7.

---

Task: M3-T4 — PR-C12 (một phần) `fix/dead-controls` (**xong — qua `/codex` gộp M3**)
Đã làm: tab "Lịch sử" ở `DocumentNumberSettingsPage` ghi **"Chức năng xem lịch sử đang phát triển"** trong khi `documentNumbersApi.getLogs()` đã hiện thực xong và **không ai gọi**. Không có gì cần phát triển — tab chỉ là chưa từng gọi hàm đó. Nay là bảng thật: số đã cấp, loại chứng từ, trạng thái (nháp / đã dùng), thời điểm, kèm phân trang; có trạng thái rỗng và trạng thái lỗi riêng biệt (lỗi tải **không** hiện thành bảng rỗng).
Test: +4.
Kiểm: FE **157 file / 1525 test** PASS, tsc sạch, 3 cổng xanh.
**Còn lại của C12** (chưa làm, tách vì đụng file khác): nút "Xuất Excel" ở `PetitionGuidancePage` và nút "Xem chi tiết" trùng chức năng ở `UserManagementPage`.
**BƯỚC TIẾP THEO:** `/codex` cho PR-C12, rồi phần còn lại của M3.

---

Task: M3-T3 — PR-C8 `fix/other-classification-real-fields` (**xong — qua `/codex` gộp M3**)
Đã làm: `OtherClassificationPage` có **ba** bộ lọc không bao giờ khớp được gì:
- **Lọc ngày** so `reportedDate` (đã format `dd/MM/yyyy` để hiển thị) với giá trị `<input type="date">` (`yyyy-MM-dd`) bằng phép so chuỗi. `"10/08/2026" < "2026-08-01"` là **true** vì `'1' < '2'` ⇒ đặt "từ ngày" loại sạch mọi dòng, đặt "đến ngày" không loại gì. Thêm `reportedDateISO` riêng cho việc lọc.
- **Lọc phường**: `ward` được gán cứng `""` cho mọi dòng ⇒ ô lọc và nửa "tìm theo phường" của ô tìm kiếm không khớp được gì. Nay lấy từ `metadata.ward`, khớp nguồn mà `reports.service.ts` đang dùng.
- **Lọc danh mục**: danh sách cứng là một phân loại **khác hẳn** ("Vụ án hình sự", "Đơn thư khiếu nại"…) trong khi `category` map từ `c.crime` ⇒ cũng không khớp. Nay suy ra từ chính dữ liệu đang có.
Bỏ `location`/`notes` — luôn rỗng, không nơi nào dùng.
Test: 9 test cho quy tắc so sánh, gồm một test **neo hồi quy** khẳng định phép so cũ sai đúng ở đâu.
Kiểm: FE **157 file / 1521 test** PASS, tsc sạch, 3 cổng xanh.
**BƯỚC TIẾP THEO:** `/codex` cho PR-C8, rồi C12 (các nút chết).

---

Task: M3-T2 — PR-C2 `fix/proposal-false-success` (**xong — qua `/codex` gộp M3**)
Đã làm: `ProsecutorProposalPage` là ví dụ rõ nhất của "báo thành công khi hỏng" — khối `catch` hiện **đúng thông báo thành công** như nhánh thành công rồi đóng hộp thoại. Cộng với `relatedCaseId` mang **mã vụ án người dùng gõ** vào một khóa ngoại (luôn P2003), chức năng này **chưa từng ghi được một dòng nào** mà lần nào cũng báo thành công.
- Ô nhập tự do → `FKSelection` nạp vụ án thật, gửi **id**.
- `catch` → `extractApiError` + banner đỏ, **không** gọi `onSaved()`/`onClose()`; nút Lưu disable khi đang gửi.
- `relatedCaseId` được map từ API để form sửa chọn sẵn đúng dòng.
Test: 2 test mới (không còn ô text mã vụ án; hỏng thì không có chữ "thành công" nào xuất hiện).
Kiểm: FE **156 file / 1512 test** PASS, tsc sạch, 3 cổng xanh.
**BƯỚC TIẾP THEO:** `/codex` cho PR-C2, rồi C8 / C12 (các nút chết, filter ngày so chuỗi sai).

---

Task: M3-T1 — PR-C1 `refactor/settings-remove-mock-modules` (**xong — qua `/codex` gộp M3**)
Đã làm: xoá 3 tab mockup khỏi `SettingsPage`:
- **Người dùng** — chỉ là một nút điều hướng sang `/nguoi-dung`.
- **Phân quyền** — liệt kê 4 vai trò **bịa** (`admin/investigator/secretary/viewer`), không phải `ROLE_NAMES` thật, và không lưu đi đâu cả.
- **Tham số** — 5 giá trị cứng (`max_file_size`, `session_timeout`, …) không có endpoint nào phía sau.
Thay bằng khối "Quản trị (trang riêng)" ở cuối sidebar với 2 link thật (`/nguoi-dung`, `/admin/settings`). Sửa mojibake `ngườI`/`ThờI`/`NgườI` + thêm test chặn nó quay lại.
**Bug có sẵn phát hiện được:** `SettingsPage.test.tsx` bọc `MemoryRouter` từ `react-router` trong khi app dùng `react-router-dom` ở **93** file. Hai instance router khác nhau ⇒ `<Link>` đầu tiên thêm vào là toàn bộ 15 test đỏ với `Cannot destructure property 'basename'`. Đã sửa test cho khớp app.
Test: xoá 7 test vốn khẳng định đúng hành vi mockup, thêm 4 test cho hành vi mới (không còn tab mock, có link thật, hết mojibake).
Kiểm: BE **226 suite / 3078 test** PASS, FE **155 file / 1510 test** PASS, tsc sạch, 3 cổng xanh.
**BƯỚC TIẾP THEO:** `/codex` cho PR-C1, rồi C2 (`fix/proposal-false-success`).

---

Task: M2-T2 — PR-B2 `feat/feature-flags-admin-page` (**xong — qua `/codex`**; M2 đóng)
Đã làm:
- Module FE mới `features/feature-flags/` + trang `/admin/tinh-nang`. Nhóm theo `domain`; **domain lạ rơi vào nhóm "Khác" chứ không bị lọc mất** — lọc đi là giấu một tính năng đang chạy khỏi đúng màn hình duy nhất tắt được nó (có test).
- Cờ lõi: nút **disabled** + nhãn "Lõi — không thể tắt", đọc từ `isCore` server trả về nên FE **không giữ bản sao thứ hai** của danh sách lõi.
- Tắt thì hỏi xác nhận, nêu rõ hệ quả (mục menu biến mất với mọi người, ai đang mở màn hình đó sẽ nhận thông báo). Bật lại **không** hỏi — chiều đó an toàn.
- Lỗi hiển thị **banner** với thông điệp thật từ server, không `alert()`, không báo thành công khi hỏng. Sau mỗi PATCH gọi `refresh()` của context nên sidebar cập nhật ngay.
- Quyền dùng `role === ADMIN` chứ **không** `hasPermission` — tầng quyền FE vẫn là mock trả `true` cho mọi người (ND-6), gắn vào đó là "trông như có kiểm mà không kiểm gì". BE mới là cổng thật (`write:FeatureFlag`).
- Sửa `featureRegistry.test.tsx` vốn hardcode 24 key ⇒ module thứ 25 làm test đỏ. Kế hoạch đã cảnh báo trước điều này.
Kiểm: BE **226 suite / 3078 test** PASS, FE **155 file / 1511 test** PASS, tsc sạch, 3 cổng xanh.
**BƯỚC TIẾP THEO:** M3 (C1–C12 — xóa mockup).

### Finding đã xử lý ở checkpoint `/codex` PR-B2

Ba [P1], trong đó **một cái là bug auth store có sẵn, ảnh hưởng toàn app**:

1. **`setTokens()` không xoá profile đã cache, mà `getUser()` ưu tiên profile hơn JWT.** Đăng nhập bằng tài khoản quyền thấp **đè lên** phiên admin đang có thì danh tính admin vẫn còn ⇒ mọi chỗ trong app kiểm `role === ADMIN` đều đọc sai, không riêng trang này. Sửa ở gốc: `setTokens` xoá profile.
2. **PATCH thành công + refresh hỏng ⇒ báo "Không đổi được…" và giữ trạng thái cũ**, trong khi server đã ghi rồi. Người vận hành sẽ thử lại một thay đổi đã xảy ra. Tách hai `try` riêng: lỗi refresh nay là **cảnh báo** ("đã đổi thành công, chưa tải lại được"), không phải báo lỗi.
3. **Không khoá toàn cục khi đang ghi** — chỉ dòng đang lưu bị disable, nên bấm dòng khác vẫn chạy và `finally` của request này mở khoá trong khi request kia còn bay. Thêm `useRef` làm mutex + disable **mọi** toggle khi đang lưu.

Kèm [P2] về a11y hộp thoại: thêm `aria-labelledby`, focus vào nút xác nhận khi mở, Escape để đóng.

Còn 1 [P2] ghi nợ: mục menu hiện với mọi user đã đăng nhập vì menu chỉ lái theo cờ, không theo quyền — đã ghi ở **ND-22**, phải quyết cùng ND-6.

Codex xác nhận parity không vỡ: key `feature-flags` có sẵn ở BE và nằm trong registry sinh ra.

---

Task: M2-T3 — PR-B3 `refactor/feature-registry-codegen` (**xong — qua `/codex`**)
Đã làm:
- **`scripts/generate-feature-registry.cjs`** quét mọi `src/**/feature.manifest.ts` → sinh `feature-registry.generated.ts`, `FEATURE_REGISTRY` chỉ còn re-export. Nối vào `npm run build` cạnh `gen:enums`, **commit file sinh ra** đúng khuôn `generated.ts` hiện có, + bước kiểm drift trong CI.
- **Sửa bug đang sống:** thêm `backend/src/edit-window/feature.manifest.ts` key `edit-window-requests`. FE có module + mục menu "Yêu cầu reset thời hạn", BE chưa từng có key ⇒ `listAll()` không trả về ⇒ **mục menu biến mất, chỉ vào được bằng gõ URL**. Đây là lần thứ 3 của cùng một lỗi (sau `comprehensive` và `document-templates`) — nên registry chuyển sang codegen chứ không vá lẻ.
- **Cổng parity `test/feature-registry-parity.spec.ts`**: khẳng định **FE ⊆ BE** (không phải bằng nhau — BE có module hạ tầng không màn hình, thế là đúng), và mọi manifest trên đĩa đều nằm trong registry sinh ra. Spec cũ chỉ so **số đếm**, mà đếm thì không bao giờ bắt được module chưa từng được thêm. Khi hỏng, thông báo nêu **tên thư mục** cần sửa. Có thêm một test chống "đếm 0 nên qua vô nghĩa".
- Registry: **38** wire tay → **39** sinh tự động. Đối chiếu từng tên: **không mất manifest nào**, thêm đúng `EDIT_WINDOW_MANIFEST`. (Commit message ghi "37 → 39" là đếm sai; `uy-thac-dieu-tra` vốn đã có trong danh sách cũ.)
Kiểm: BE **226 suite / 3077 test** PASS, FE **154 file / 1504 test** PASS, tsc sạch, 3 cổng xanh.
**BƯỚC TIẾP THEO:** M2-T2 (PR-B2 — trang `/admin/tinh-nang`, là phần M2 còn lại).

### Finding đã xử lý ở checkpoint `/codex` PR-B3

**Không có [P1].** Codex đối chiếu từng tên và xác nhận: registry cũ **38** mục (không phải 37 như commit message tôi ghi), mới 39, **không mất mục nào**, thêm đúng `EDIT_WINDOW_MANIFEST`; `UY_THAC_DIEU_TRA_MANIFEST` vốn đã có sẵn. Mọi manifest BE hiện tại đều khớp regex của generator, và dạng không khớp (`satisfies`, không chú kiểu, default export) sẽ làm generator **ném lỗi to** chứ không bỏ sót âm thầm. Bước kiểm drift trong CI hoạt động đúng.

Đã sửa 1 [P2]: cổng parity **bỏ qua** manifest FE mà nó không parse được (nháy đôi, template literal, hằng), mà khẳng định `> 10` vẫn qua ⇒ đúng kiểu "qua vô nghĩa" mà chính cổng này sinh ra để chặn. Nay nhận cả 3 kiểu nháy và **nêu tên** module không đọc được thay vì lờ đi.

Hai [P2] ghi nợ — cả hai là lỗ **có sẵn** mà bản vá của tôi làm lộ ra chứ không tạo ra:

---

Task: M2-T1 — PR-B1 `feat/feature-flags-write-api` (**xong — qua `/codex`**)
Đã làm:
- **`PATCH /feature-flags/:key`** + **`POST /feature-flags/refresh`**, cả hai gắn `write:FeatureFlag`. **Cạm bẫy đã tránh:** quyền đặt ở **từng route**, không ở cấp class — `GET /feature-flags` được **mọi** user gọi mỗi lần tải trang để dựng sidebar, gắn quyền ở class là menu trống cho ai không có quyền và họ sẽ tưởng hệ thống hỏng.
- **`setEnabled` từ dead code thành đường ghi thật:** `update` → **`upsert`** (bản cũ ném P2025 với mọi cờ mà lần seed đầu chưa tạo, tức mọi cờ thêm sau đó); 3 validate fail-fast (key ngoài registry → 404, cờ lõi + `false` → 400, key ngoài `ENABLED_FEATURES` → 400); **audit trong cùng transaction** — cờ đổi mà không có ai chịu trách nhiệm còn tệ hơn cờ không đổi.
- **Chống khoá cứng 3 lớp** (`CORE_FEATURE_KEYS`, compile-time theo ADR-0001): `effectiveEnabled()` ép `true` cho cờ lõi nên `UPDATE feature_flags SET enabled=false WHERE key='admin'` chạy tay cũng **không** khoá được ai; `setEnabled` từ chối; DTO trả `isCore` để UI vô hiệu hoá nút. Có test khẳng định **mọi** core key tồn tại trong registry — gõ sai một chữ là hàng rào biến mất trong im lặng.
- **`effectiveEnabled()` là nguồn duy nhất** cho cả `isEnabled()` lẫn `listAll()`. Trước đó hai hàm tự trả lời riêng, mà hai bản sao của một quy tắc thì sẽ lệch.
- **`AuditService` tiêm `@Optional()`** — module này `@Global` + cấp `APP_GUARD` nên dựng rất sớm; phụ thuộc cứng vào `AuditModule` có nguy cơ đồ thị vòng, mà biểu hiện chỉ là app không boot được.
- Quyền `write:FeatureFlag` vào `seed-permissions.ts` ⇒ runner ở `deploy.sh` tự cấp cho ADMIN. **Không** thêm `read:FeatureFlag` — đọc phải mở cho mọi người, xem ghi chú trong seed.
Kiểm: BE **225 suite / 3073 test** PASS, FE **154 file / 1504 test** PASS, tsc sạch, 3 cổng xanh, baseline lint **8.386**.
**BƯỚC TIẾP THEO:** M2-T2 (PR-B2 — trang `/admin/tinh-nang`).

### Finding đã xử lý ở checkpoint `/codex` PR-B1

Hai [P1], cả hai đều là **lỗi trong chính bản vá của tôi**, và cả hai đều thuộc loại "hàng rào có mà không chạy":

1. **Whitelist chạy trước bảo vệ cờ lõi ⇒ hai hàng rào triệt tiêu nhau.** `isEnabled()` kiểm `ENABLED_FEATURES` **trước** `effectiveEnabled()`, còn `listAll()` thì loại thẳng key không có trong whitelist. Nên một biến môi trường chỉ đơn giản **quên** liệt kê `admin` hoặc `feature-flags` là tạo ra đúng cái khoá cứng mà danh sách lõi sinh ra để chặn — mất mục sidebar, rồi API ghi lại từ chối bật lại vì "key ngoài gói build". Sửa: thêm `shippedInThisBuild()`, cờ lõi **luôn** thuộc mọi gói build. Không thể ship một bản build không có `auth`; coi đó là thứ cấu hình được mới là chỗ sai.
2. **`@Optional()` của tôi khiến audit KHÔNG BAO GIỜ chạy, chứ không phải "chạy khi có".** `FeatureFlagsModule` không import `AuditModule`, mà module anh em thì không chia sẻ provider — nên `audit` luôn `undefined` và `this.audit?.log()` lặng lẽ bỏ qua. Tôi đã tự biện minh là "phòng đồ thị vòng"; codex kiểm và khẳng định **không có vòng nào**. Sửa: import `AuditModule`, bỏ `@Optional()`, thiếu là **không boot được**.

Ba [P2]: `before` trong audit lấy từ cache có thể cũ ⇒ nay đọc trong chính transaction (trên DB mới thì bản ghi chưa tồn tại, trước đây ghi `before: undefined` cho một thay đổi thật sự là true→false). Hai cái còn lại ghi nợ: cache là process-local (ADR-0009 đã chấp nhận giả định 1 instance) và `ensureFresh()` nuốt lỗi nên `PATCH` vẫn báo thành công dù refresh hỏng → **ND-21**.

Codex cũng xác nhận: `GET /feature-flags` vẫn gọi được khi không có `write:FeatureFlag`; không có đường ghi thay thế nào lọt lưới; và khi audit hỏng thì transaction **có** rollback cờ.

**Ghi nhận ND-9 tái diễn:** một lần chạy full suite đỏ 1 suite/21 test, chạy lại xanh ngay. Đúng dấu hiệu đua tranh cache transform của jest đã ghi ở ND-9, không liên quan thay đổi này.

---

Task: M1-T5 — PR-M1 `feat/mobile-feature-flag-awareness` (**làm được 2/3 — phần mobile BỊ CHẶN, xem bên dưới**)

Đã làm (đều kiểm chứng được, có test):
- **BE — `FeatureFlagGuard` trả thân lỗi phân biệt được.** Trước: `throw new NotFoundException()` trần ⇒ client không tài nào phân biệt "tính năng bị tắt" với "không tìm thấy bản ghi". Giữ nguyên **404** (mã trạng thái riêng sẽ giúp người ngoài dò được module nào đang tắt) nhưng thân lỗi nay có `error: 'FEATURE_DISABLED'`, `feature: <key>`, và câu tiếng Việt lấy `label` từ manifest. Hằng `FEATURE_DISABLED_ERROR` đánh dấu **WIRE FORMAT** — APK đã cài mang bản sao của chuỗi này, đổi tên là client cũ lặng lẽ quay về hiện 404 thô.
- **Web — `lib/feature-disabled.ts` + nhánh trong interceptor.** Nhận cả hai hình dạng thân lỗi Nest có thể sinh ra (phẳng và lồng dưới `message`), phát sự kiện `pc02:feature-disabled`.
- **Web — hết cờ cũ.** `FeatureFlagsContext` trước chỉ fetch **một lần lúc mount**, nên admin tắt module xong mọi tab đang mở vẫn hiện menu trỏ tới route đã 404. Nay refetch khi (a) có request trả `FEATURE_DISABLED` — bằng chứng cờ đã cũ, và (b) tab được đưa lại lên trước.

**🚫 CHẶN — phần mobile chưa làm: máy này không có Flutter/Dart.**
`command -v flutter dart` → không có. `mobile/test/` có sẵn bộ test nhưng **không chạy được**. Viết Dart mà không compile hay test nổi, vào đúng module đang **chặn cứng E4–E6**, là tạo ra sự tự tin giả — nên tôi dừng lại thay vì đẩy code không kiểm chứng.

Phần còn thiếu, đặc tả sẵn để làm khi có toolchain:
1. `mobile/lib/core/api/feature_flags_api.dart` — gọi `GET /feature-flags` lúc khởi động + cache.
2. `api_client.dart::_onError` — hiện chỉ bắt 401. Thêm nhánh đọc `error == 'FEATURE_DISABLED'` → màn "Tính năng tạm tắt" thay vì để `Lỗi: DioException ... 404` lọt ra UI (`case_detail_screen.dart:32`).
3. Ẩn mục điều hướng theo cờ.
4. Version gate: gọi `/api/v1/health`, so phiên bản tối thiểu → màn buộc cập nhật. **Không có nó thì APK đã cài không có đường cứu** khi gate API bật.

**Điều kiện để mở khoá E4–E6 vẫn nguyên:** chưa có 4 mục trên trên production thì không được merge PR gate API nào.
Kiểm: BE **224 suite / 3052 test** PASS, FE **154 file / 1504 test** PASS, tsc sạch cả hai, 3 cổng governance xanh.
**BƯỚC TIẾP THEO:** cần Flutter SDK để hoàn tất PR-M1. Trong lúc chờ, M2 (B1/B2/B3 — hạ tầng cờ) không phụ thuộc mobile và làm được ngay.

---

Task: M1-T4 — PR-A4 `fix/seed-endpoints-and-settings-validation` (**xong — qua `/codex`**)
Đã làm:
- **`SeedEndpointGuard`** áp lên 4 endpoint nạp dữ liệu mẫu. Hai điều kiện đồng thời: `ALLOW_SEED_ENDPOINTS==='true'` (so khớp **đúng chuỗi**, để `1`/`yes`/`TRUE` không vô tình mở cổng) **và** vai trò ADMIN. Trước đó `POST /notifications/seed` **không có decorator quyền nào cả**, còn `/directories/seed` chỉ cần `write:Directory` — quyền mà nhiều vai trò đang có. `POST /address-mappings/seed/:id/cancel` **cố ý không gate**: hủy job đang treo phải gọi được. `test-fixtures` đã có `TestModeGuard` riêng nên không đụng.
- **Trần thời hạn theo đơn vị.** Trước: chỉ `'ngày'`/`'lần'` bị chặn ở 365, còn **`'giờ'` không được validate gì cả** — mà `THOI_HAN_XOA_VU_AN` và `THOI_HAN_EDIT_VU_VAN` đều dùng đơn vị này. Nếu áp 365 cho giờ thì còn tệ hơn không có: `THOI_HAN_EDIT_VU_VAN` mặc định 168h, cơ sở pháp lý BLTTHS Đ.147 là 20 ngày = **480h**, tức 365 sẽ âm thầm cắt cửa sổ xuống dưới mức luật cho phép. Nay `ngày`→365, `lần`→365, `giờ`→**8760**; đơn vị không có trong bảng thì không phải số, để nguyên. Thông điệp lỗi có nêu đơn vị.
- `docs/DEPLOY.md`: mục `ALLOW_SEED_ENDPOINTS` — để TẮT trên production.
Kiểm: BE **224 suite / 3049 test** PASS, FE **153 file / 1494 test** PASS, tsc sạch, 3 cổng xanh, baseline lint 8.488 → **8.392**.
**BƯỚC TIẾP THEO:** M1-T5 (PR-M1 — mobile, chặn cứng E4–E6).

### Finding đã xử lý ở checkpoint `/codex` PR-A4

**Không có [P1].** Codex xác nhận 4 điểm tôi cần chắc: thứ tự guard đúng (global → class → route, nên `JwtAuthGuard` chạy trước và `req.user` đã có); `role` là **tên** vai trò (`user.role.name` ở `jwt.strategy.ts:71`) nên so với `ROLE_NAMES.ADMIN` là khớp; cả 5 giá trị seed mặc định đều nằm trong trần mới; không còn seed endpoint nào khác bị bỏ sót. Hai [P2] đã sửa:

1. **`POST /address-mappings/seed/:id/cancel` ai có `write:Directory` cũng hủy được job của người khác**, không kiểm sở hữu — tức DoS lên một tiến trình nhập liệu có thể đã chạy hàng giờ. Tôi đã cố ý **không** áp `SeedEndpointGuard` ở đây (hủy job treo phải gọi được trên production, nơi cờ env tắt), nhưng "không gate hoàn toàn" là quá tay. Thêm `SeedCancelGuard`: **chỉ kiểm vai trò ADMIN**, không kiểm cờ env — giữ đúng ý định ban đầu mà vẫn đóng lỗ.
2. **`parseInt` cắt tiền tố** ⇒ `'480abc'` thành 480, `'0x10'` thành 0 — đầu vào rác được nhận rồi âm thầm viết lại, trong khi thông điệp lỗi hứa là số nguyên. Đổi sang khớp **cả chuỗi** rồi mới chuyển đổi; vẫn nhận số thập phân và cắt phần lẻ vì đó là chuẩn hoá có sẵn và có test riêng.

---

Task: M1-T3 — PR-A3 `fix/create-endpoints-datascope` (**xong — qua `/codex`**)
Đã làm:
- **ND-14 đã quyết và sửa (ADR-0017):** `canDispatch` chỉ còn bỏ qua kiểm tra ở `operation:'read'`. Trước đó cả 3 hàm `assertParentInScope`/`assertPetitionParentInScope`/`assertCreatorInScope` đều thoát sớm bất kể read hay write ⇒ mọi người điều phối tạo/sửa/xóa/khôi phục được bản ghi con của **mọi** vụ án. Phân công **không** phụ thuộc lối tắt này (`PATCH /:id/assign` + 3 endpoint bulk-assign có `DispatchGuard` riêng, `assignCase()` không nhận scope) nên siết lại không đụng nghiệp vụ. **Cảnh báo vận hành:** ai đang dùng tài khoản `canDispatch` để sửa hồ sơ tổ khác sẽ nhận 403 — cách xử lý đúng là cấp WRITE grant cho tổ đó, không phải mở lại lối tắt.
- `POST /subjects` và `POST /lawyers`: thêm `dataScope` + `assertParentInScope(caseRecord, scope, 'write')`. Đường đọc và đường sửa vốn đã kiểm, riêng `create` thì không — biết id vụ án là gắn được người vào hồ sơ tổ khác.
- `POST /investigation-supplements`: **hai lỗ, không phải một.** Chưa hề kiểm `caseId` có tồn tại ⇒ id sai trả lỗi FK thô 500 thay vì 400; và chưa hề kiểm scope ⇒ quyết định điều tra bổ sung (văn bản tố tụng có thời hạn) nộp được vào bất kỳ vụ án nào.
- **`exchanges` không cần sửa:** model `Exchange` không có vụ án cha, chỉ neo `createdById` — mà người tạo luôn là chính người gọi, nên không có gì để kiểm. Kế hoạch xếp nó vào A3 theo một giả định không đúng; ghi lại thay vì thêm một lệnh kiểm vô nghĩa.
- **`POST /documents` đã đúng từ trước** (`documents.service.ts:181,193` kiểm cả `caseId` lẫn `incidentId`) — mục "mở issue riêng" trong kế hoạch coi như đóng.
Kiểm: BE **223 suite / 3010 test** PASS, FE **153 file / 1494 test** PASS, tsc sạch cả hai, 3 cổng governance xanh, baseline lint 8.939 → **8.859**.
**BƯỚC TIẾP THEO:** M1-T4 (PR-A4).

### Finding đã xử lý ở checkpoint `/codex` PR-A3

Codex trả 6×[P1] + 2×[P2]. Bốn cái sửa trong vòng này, hai cái ghi nợ có lý do, một cái tôi đã tự tìm và sửa trước khi codex trả lời.

1. **[P1] Grant CHỈ-ĐỌC vẫn ghi được, qua nhánh "chủ sở hữu".** `userIds` gom thành viên của **mọi tổ đọc được**, mà đường ghi lại coi khớp investigator/enteredById/createdById là chủ sở hữu được phép sửa ⇒ `writableTeamIds` hoàn toàn vô nghĩa trên nhánh đó. Thêm `writableUserIds` (thành viên các tổ **ghi được**, luôn gồm chính người gọi) và cho đường ghi dùng nó. Thiếu trường này thì tập chủ sở hữu là **rỗng**, không phải quay về `userIds` — scope không đầy đủ thì phải từ chối.
2. **[P1] Bulk-delete dùng bộ lọc đọc** ⇒ quyền chỉ-đọc trên tổ khác vẫn xóa hàng loạt được, và `canDispatch` thì xóa được tất cả. **Tôi tự tìm ra cái này trong lúc chờ codex**, kết quả trùng khớp. `buildScopeFilter`/`buildPetitionScopeFilter` nay nhận `operation`; 5 preflight xóa chuyển sang `'write'`. Bulk-**assign** giữ nguyên lối tắt vì đó đúng là thứ `canDispatch` cấp.
3. **[P1] Ba đường tạo con của vụ án vẫn chưa kiểm scope:** `conclusions` (kết luận điều tra), `delegations` và `proposals` (cả hai qua `relatedCaseId` tùy chọn). Đã thêm kiểm tồn tại + kiểm scope.
4. **[P1] `POST /exchanges/:id/messages` chỉ kiểm tồn tại** ⇒ biết id là chèn tin nhắn vào luồng trao đổi của người khác. Thêm `assertCreatorInScope(..., 'write')`.
5. **[P1] ADR-0017 của tôi ghi sai sự thật** — đã đính chính ngay trong ADR và ghi thành ND-17.
6. **[P1] Đổi cha chỉ kiểm cha cũ** → ND-18. Không sửa ở đây vì là đường `update`, còn PR này là `create`; gộp vào sẽ làm diff bảo mật khó rà.
7. **[P2] Nạp cha và tạo con là hai câu lệnh rời** → ND-19. **[P2] Ai có ≥1 tổ ghi được thì ghi được lên mọi bản ghi chưa phân công** → ND-20 (cần quyết chính sách, không phải lỗi code).

Codex cũng xác nhận: **không** có cron/migration/event handler/importer nào gọi các đường vừa siết, và người tạo vẫn tự sửa được bản ghi của mình.

**Bẫy đã gặp:** thêm `.rejects.toThrow(ForbiddenException)` vào một spec **chưa import `ForbiddenException`** làm jest **giết cả tiến trình** (dump uncaught exception, không có báo cáo test nào). Triệu chứng trông như lỗi hạ tầng chứ không như test đỏ. Kiểm import trước khi nghi ngờ chỗ khác.

---

Task: M1-T2 — PR-A2 `fix/case-update-subentity-dataloss` (**xong — qua `/codex`**)
Đã làm: `UpdateCaseDto` = `OmitType(PartialType(CreateCaseDto), ['subjects','evidences','documentIds'])` rồi khai lại 3 field với `@Equals(undefined)` kèm **thông điệp tiếng Việt chỉ sang endpoint đúng** — chỉ omit không thì `forbidNonWhitelisted` trả "property subjects should not exist", đúng nhưng không nói người dùng phải làm gì. FE: `buildCreateCasePayload` nhận `mode:'create'|'update'`, mode update bỏ 3 mảng (mặc định vẫn `create` nên mọi lời gọi cũ không đổi).
**Quan trọng — không chỉ dời chỗ mất dữ liệu:** nếu chỉ sửa payload thì hai tab "ĐTBS"/"Vật chứng" ở chế độ sửa vẫn cho nhập, và giờ FE lặng lẽ vứt đi thay vì BE. Nên ở chế độ sửa: tab ĐTBS thay bằng bảng chỉ đường sang tab thật ở trang chi tiết; tab Vật chứng **nhúng thẳng `CaseEvidenceTab`** của D1 — lưu ngay khi thêm dòng, không chờ bấm Lưu. Chế độ tạo giữ nguyên vì đó là nơi 3 mảng thực sự được ghi.
Kiểm: BE **223 suite / 2999 test** PASS, FE **153 file / 1492 test** PASS, `tsc --noEmit` + `tsc -b` sạch, 3 cổng governance xanh.
**BƯỚC TIẾP THEO:** `/review` rồi `/codex` cho PR-A2. Sau đó M1-T3 (PR-A3).

**Sai sót đã tự phát hiện và khắc phục trong lúc làm:** tôi ghi đè mất `update-case.dto.spec.ts` vốn đã có 9 test (regression TAM_DINH_CHI/PHUC_HOI v0.37.2.6). Phát hiện vì tổng số test giảm 9 so với dự kiến chứ không phải vì có test đỏ — suite vẫn báo xanh. Đã khôi phục từ `git show HEAD:` và nối 5 test mới vào cuối. **Bài học ghi lại:** đối chiếu tổng số test sau mỗi lần thêm, vì mất test không làm CI đỏ.

### Finding đã xử lý ở checkpoint `/codex` PR-A2

Codex xác nhận 3 điểm tôi lo là **không** có vấn đề: `@Equals(undefined)` cư xử đúng (thiếu/`undefined` qua; `null`, `[]`, mảng có phần tử đều bị chặn) và vẫn whitelist được property; `OmitType(PartialType(...))` giữ nguyên metadata validate/transform của mọi field không bị omit; không sinh đường 400 mới cho luồng sửa thường; route + state của `Link` hợp lệ. Thêm 2 finding:

1. **[P1] Tab "Ghi âm, ghi hình" vẫn vứt file — đúng anh em sinh đôi của bug tôi vừa sửa, trong cùng một form.** `handleUploadMedia` chỉ dựng metadata cục bộ (kể cả `uploader: "Nguyễn Văn A"` cứng), `documentIds` thì bị vô hiệu từ trước, mà Lưu vẫn báo thành công rồi điều hướng đi. Sửa: chế độ sửa dùng `EntityDocumentsTab` **có sẵn và chạy thật**; chế độ tạo thay bằng bảng nói thẳng "tài liệu đính kèm sau khi lưu hồ sơ" — trung thực và không mất gì, vì trước nay chưa từng lưu được gì. Xoá hẳn `handleUploadMedia` và state `mediaFiles`.
2. **[P2] Bảng chỉ đường gộp mọi loại đối tượng về tab "Bị can"**, trong khi editor cũ có 4 loại và tab đích `POST /subjects` với `type: "SUSPECT"` cứng. Sửa: nêu đúng 2 đích có thật (Bị can, Luật sư) và **nói rõ** bị hại/nhân chứng của hồ sơ đã tạo hiện chưa có màn hình → ND-16.

**Lỗi có sẵn phát hiện nhờ vòng này:** `Card` (`components/shared/CardSection.tsx`) không nhận `data-testid` nên thuộc tính bị bỏ, tức test hook mà `EntityDocumentsTab` khai báo **chưa từng render ở bất kỳ đâu**. Hệ quả: test `does NOT render EntityDocumentsTab in create mode` của `IncidentFormPage` xanh **vì lý do sai** — component vẫn luôn render, chỉ là không có testid. Đã cho `Card` chuyển tiếp `data-testid` và sửa test khẳng định đúng ý định vốn ghi ngay trong code (`luôn hiển thị; EntityDocumentsTab tự guard`).

---

Task: M1-T1 — PR-D1 `feat/evidences-lifecycle` (**xong — qua `/review` và `/codex`**)
Đã làm: module `backend/src/evidences/` CRUD + soft-delete + restore, tab "Vật chứng" ở trang chi tiết vụ án, `cases.getById()` include evidences (**không** include ở `getList` — N+1, có comment cảnh báo tại chỗ), constants `EVIDENCE_STATUS` 2 phía (`Evidence.status` là `String`, **không** phải Prisma enum nên `gen:enums` không sinh), permission Evidence + runner seed chạy trong `deploy.sh`.
Kiểm: BE **223 suite / 2985 test** PASS, FE **152 file / 1485 test** PASS, `tsc --noEmit` + `tsc -b` sạch, 3 cổng governance xanh.
**BƯỚC TIẾP THEO:** chạy `/codex` cho PR-D1 theo §4, rồi commit. Sau đó M1-T2 (PR-A2) — D1 đã lên nên A2 không còn cắt đường nhập vật chứng.

### Finding đã xử lý ở checkpoint PR-D1

Bảy cái, đều **do tôi gây ra** trong chính PR này:
1. `QueryDeletedEvidencesDto` thiếu ⇒ endpoint `listDeleted` nhận query không validate.
2. **Permission mới sẽ 403 cho mọi người trên production** — `deploy.sh` không chạy `db:seed`, nên `seed-permissions.ts` không bao giờ tới prod. Đây đúng lớp lỗi ISSUE-001. Thêm `seed-permissions-runner.ts` (idempotent) + bước 9b-2 trong `deploy.sh`, fatal nếu hỏng.
3. Evidence chưa có trong danh sách quyền của `OFFICER` ⇒ đúng vai trò dùng module nhiều nhất lại không đọc được.
4. Form sửa gửi `''` cho ô đã xoá trắng thay vì `null` ⇒ không xoá được giá trị. Thêm `orNull()` + nới DTO cho nullable.
5. `restore()` không kiểm trùng `code` ⇒ khôi phục có thể tạo 2 vật chứng cùng mã trong một vụ án. Nay ném `ConflictException`.
6. Bộ lọc comment của enum guard mất đồng bộ khi gặp dấu nháy trong regex literal ⇒ **báo sai trên một cổng chặn**. Sửa thành máy trạng thái nhận biết cả chuỗi lẫn regex, +3 test.
7. `makeReq()`/`mockUser` trả `any` ⇒ lây `no-unsafe-*` sang mọi spec controller gọi chúng. Đổi sang `ScopedRequest`/`AuthUser` thật.

Kèm quyết định governance: **ADR-0015** — tắt họ `no-unsafe-*` cho file test. Lý do: `@types/jest` khai `expect.objectContaining()` trả `any`, nên rule bắn vì cú pháp matcher chuẩn chứ không vì test viết ẩu; né rule đồng nghĩa với viết assertion yếu hơn. Mã sản phẩm giữ nguyên toàn bộ rule. Baseline ratchet 11.507 → **8.945**.

### Finding đã xử lý ở checkpoint `/codex` PR-D1

Codex CLI treo 2 lần ở `codex review` (diff `main...HEAD` = 402KB/79 file vì chưa PR nào merge). Chạy được bằng cách thu hẹp về đúng diff PR-D1 và đưa prompt qua **stdin** (`codex exec -`) — truyền 120KB qua argv thì Windows trả `Argument list too long`. Ghi lại vì sẽ gặp lại ở mọi checkpoint sau.

Kết quả: 6×[P1] + 2×[P2]. Sáu cái sửa trong vòng này:

1. **[P1] Quyền của OFFICER vẫn không tới production.** Runner chỉ cấp cho ADMIN; grant OFFICER nằm trong `seed.ts` mà deploy không chạy. Tức là tôi mới sửa được nửa lỗi ở vòng trước — module 403 với đúng những người nó phục vụ. Thêm `DEFAULT_ROLE_GRANTS` khai báo được, runner áp **chỉ cho permission nó vừa tạo** trong lần chạy đó, nên admin đã chủ động thu hồi quyền nào thì lần deploy sau không âm thầm cấp lại.
2. **[P1] Vụ án đã xóa mềm không kéo theo vật chứng.** List/detail/restore chưa hề kiểm `case.deletedAt` ⇒ xóa vụ án xong vật chứng vẫn đọc/sửa được, và khôi phục sinh ra con sống dưới cha đã xóa. Thêm `LIVE_CASE` vào cả 4 đường đọc.
3. **[P1] Đua tranh mã vật chứng.** Kiểm-rồi-ghi tách rời ở `create`/`update`/`restore`. Đóng bằng `withCaseLock` — `SELECT … FOR UPDATE` trên hàng vụ án cha, kiểm và ghi cùng transaction. **Không** thêm partial unique index: bảng đã có dữ liệu chưa từng bị ràng buộc trong nền 53k bản ghi legacy, `CREATE UNIQUE INDEX` sẽ hỏng nếu đang có cặp trùng, và chọn bỏ bản nào là quyết định về hồ sơ pháp lý — **ADR-0016** ghi rõ điều kiện chuyển sang index thật.
4. **[P1] `check-enum-literals.cjs` chỉ nhớ 1 ký tự trước.** `return /["']/…` không được nhận là regex ⇒ dấu nháy mở chuỗi ⇒ comment phía sau bị quét như code ⇒ **báo sai trên cổng chặn**. Thêm nhận diện theo từ khóa (`return`/`throw`/`typeof`/…), xử lý `i++ / 2`, và cho chuỗi chưa đóng dừng ở cuối dòng thay vì nuốt tới hết file. +4 test. (Tôi tự tìm ra cái này song song với codex — trùng khớp.)
5. **[P1] Bước seed trong `deploy.sh` không có giới hạn thời gian** ⇒ một khóa DB treo là treo cả job deploy vô hạn. Bọc `timeout 300`.
6. **[P2] Miễn trừ lint cho file test rộng hơn phần bị loại khỏi build.** `tsconfig.build.json` chỉ loại `**/*spec.ts`, nên `test-utils/` và `*.test.ts` vẫn biên dịch vào `dist` — miễn trừ của ADR-0015 chỉ chính đáng nếu chúng không ship. Loại đúng cùng tập hợp.

Hai cái **không** sửa trong PR này, có lý do:

- **[P1] `assertParentInScope` bỏ qua mọi kiểm tra khi `canDispatch`**, kể cả thao tác ghi. Đúng, nhưng đây là hành vi dùng chung của **cả 12 resource**, không phải hồi quy của D1. Sửa ở đây sẽ đổi ngữ nghĩa phân quyền cho toàn hệ thống trong một PR về vật chứng. → ND-14, xử lý ở PR-A3 (PR chuyên về DataScope).
- **[P2] `getById` trả 403 cho ngoài phạm vi và 404 cho không tồn tại**, tức lộ sự tồn tại của bản ghi. Đúng, nhưng mọi module khác đang theo đúng mẫu này; đổi riêng một module tạo ra bất nhất. → ND-15, quyết một lần cho toàn hệ thống.

---

Task: M0.5-T3 — PR-B0c `docs/adr-foundation` (**xong**)
Đã làm: `docs/adr/` + template MADR + README danh mục + **14 ADR** + workflow `adr-nudge.yml` (cảnh báo, không chặn) + trỏ dẫn trong CLAUDE.md. Kiểm: 0 link hỏng, 0 số hiệu trùng. BE 221 suite/2951 test PASS, FE 151 file/1475 test PASS, 3 cổng governance xanh.
**BƯỚC TIẾP THEO:** M1-T1 — PR-D1 `feat/evidences-lifecycle`. Xem mục 2 hàng đợi. Nhớ: D1 **phải trước** A2.

ADR đã ghi: 0001 cờ lõi compile-time · 0002 `caseId` giữ NOT NULL · 0003 model quyết định trùng đơn · 0004 không có `POST /settings` · 0005 danh mục seed-only · 0006 xoá 3 tab mockup · 0007 gate cấp class · 0008 mobile chặn gate API · 0009 cache một-instance · 0010 `ALTER TYPE` một chiều · 0011 chấp nhận drift partial index · 0012 lint ratchet · 0013 bộ UAT cũ không vào CI · 0014 RLS chỉ 2 bảng · 0015 `no-unsafe-*` tắt trong file test.

---

Task: M0.5-T2 — PR-B0b `chore/ci-drift-and-e2e-scaffold` (**xong**)
Đã làm: 2 commit (`030d3d2`, `80dd6c3`). `/review` xong — 7 finding, đã sửa hết. BE 221 suite/**2951** test PASS, FE 151 file/**1475** test PASS, 3 cổng governance xanh, collect Playwright từ **0 → 3849 test / 182 file**.
**BƯỚC TIẾP THEO:** M0.5-T3 — PR-B0c `docs/adr-foundation`: tạo `docs/adr/` + template MADR + 12 ADR (danh sách ở mục "Quyết định kiến trúc" bên dưới + 12 quyết định trong kế hoạch gốc) + CI nudge khi PR đổi `schema.prisma` hoặc `feature-flags/` mà không chạm `docs/adr/`, theo khuôn `shell-parity-gate.yml`.

### Finding đã xử lý ở checkpoint PR-B0b

3 cái **do tôi gây ra**: `testMatch` trên `chromium` làm 134 spec mồ côi; `_helpers.ts` ném lỗi lúc import làm vỡ collect; `.env.test.example` chỉ dẫn đặt `UAT_PROD` sai chỗ.
4 cái **có sẵn**: thiếu dependency `jszip` khiến **toàn bộ** khâu collect của Playwright chết (mọi project báo 0 test); allow-list `prisma/` miễn trừ nhầm `backend/src/prisma`; bộ lọc comment xoá nhầm `//` trong chuỗi; `asyncUtilTimeout` bằng đúng `testTimeout` mặc định nên vô hiệu.

---

Task: M0.5-T1e — checkpoint PR-B0a (**xong**)
Đã làm: code xong; `/review` xong (4 finding, đã sửa hết, commit `90d01e7`); dọn nợ lint trên chính file mới của mình thay vì baseline hoá nó. BE 220 suite/**2949** test PASS, FE 151 file/**1475** test PASS, BE `tsc --noEmit` + FE `tsc -b` sạch, 3 cổng governance xanh.
**BƯỚC TIẾP THEO:** sang M0.5-T2 (PR-B0b `chore/ci-drift-and-e2e-scaffold`) — xem mục 1 của hàng đợi.
File liên quan: `.github/workflows/ci.yml`, `scripts/governance/*`, `backend/package.json`, `backend/test/`, `frontend/vite.config.ts`, `frontend/src/test-setup.ts`, `CLAUDE.md`

### Finding đã xử lý ở checkpoint PR-B0a

`/review` (4) — đều nằm trong chính công cụ governance, 2 cái làm cổng **im lặng đi qua**:
1. Ratchet lint quét `backend/**` nhưng baseline chỉ sinh từ `src`+`test` ⇒ `prisma/seed.ts` (62 lỗi) fail `0 → 62` và `--write-baseline` không ghi nổi. Gộp về một nguồn sự thật `ownedBy()`, mở rộng sang `prisma/` + `scripts/`.
2. `lintCounts` coi stdout rỗng là "không lỗi" và bỏ qua exit code ⇒ eslint crash thì cổng báo xanh. Nay phân biệt exit 1 (có lỗi, bình thường) với lỗi thật và ném exception.
3. Spec khẳng định source production **vẫn còn** vi phạm ⇒ ai làm đúng hướng dẫn của guard sẽ làm đỏ test. Chuyển sang quét cây fixture tạm.
4. Allow-list khớp trên đường dẫn tuyệt đối ⇒ thư mục checkout chứa segment `prisma`/`test-utils` sẽ tắt guard toàn repo. Đổi sang đường dẫn tương đối + neo `(^|/)`.

Tự phát hiện thêm: 3 file test mới của chính tôi bị baseline hoá 7 lỗi lint thay vì dọn — đúng kiểu tự miễn trừ mà chính sách này cấm. Đã khai báo kiểu cho 2 script CommonJS (`test/governance-scripts.d.ts`) để dùng `import` thật thay `require()` + `any`; cả 4 file mới nay 0 lỗi.

### Finding đã xử lý ở checkpoint PR-A1

`/review` (4):
1. Race trong `loadPermissions` — response chậm của vai trò cũ đè lên vai trò đang chọn **và** đè cả baseline ⇒ diff báo "không có thay đổi" trong khi Lưu ghi quyền vai trò A sang B. Sửa bằng `permRequestSeq`.
2. `updateRole` cho đổi tên vai trò hệ thống ⇒ phá mọi so sánh `ROLE_NAMES` và lách được guard xoá. Chặn hai chiều.
3. Đổi tab làm refetch danh mục ⇒ đổi identity mảng ⇒ effect chạy lại ⇒ mất chỉnh sửa chưa lưu. Chỉ nạp một lần.
4. Audit `ROLE_DELETED` thiếu `ipAddress`/`userAgent`.

`/codex` (3):
5. `PATCH /admin/roles/:id/permissions` vẫn nhận mảng rỗng không điều kiện ⇒ đúng cơ chế đã gây mất quyền, chỉ là từ client khác. Thêm cờ `allowEmpty` bắt buộc + cảnh báo đỏ trong modal.
6. `permCatalogLoaded` là boolean ⇒ hai request đồng thời, cái lỗi đến sau xoá danh mục nhưng ref vẫn `true` ⇒ **kẹt vĩnh viễn tới khi reload trang**. Đổi thành state machine `idle/loading/loaded` + nút "Thử lại".
7. `SYSTEM_ROLE_NAMES` thiếu `OFFICER` và `DEADLINE_APPROVER` — hai vai trò seed thật và **được so sánh bằng chuỗi cứng** ở `deadline-rules.service.ts:905`, `calendar-events.controller.ts:42`, nên không được bảo vệ. Bổ sung vào `ROLE_NAMES` (cả BE lẫn FE) và thay chuỗi cứng bằng hằng số.

## Hàng đợi task kế tiếp

1. M1-T1 — PR-D1 `feat/evidences-lifecycle` (**phải trước A2**).
2. M1-T1 — PR-D1 `feat/evidences-lifecycle` (**phải trước A2** — nếu A2 chặn `evidences[]` khi chưa có module thay thế thì cán bộ mất luôn đường nhập vật chứng lúc sửa hồ sơ).
3. M1-T2 — PR-A2 `fix/case-update-subentity-dataloss` (FE + BE **cùng một PR**).
4. M1-T3 — PR-A3 `fix/create-endpoints-datascope` (4 service: subjects, lawyers, investigation-supplements, exchanges).
5. M1-T4 — PR-A4 `fix/seed-endpoints-and-settings-validation` (dùng chuỗi **có dấu** `'ngày'`/`'lần'`/`'giờ'`; trần theo unit, `giờ` → 8760).
6. M1-T5 — PR-M1 `feat/mobile-feature-flag-awareness` (**chặn cứng** E4–E6).

### Nhánh đã tạo (chưa mở PR, chưa push)
`fix/admin-role-permission-matrix` → `chore/ci-governance-gate` → `chore/ci-drift-and-e2e-scaffold` (xếp chồng, mỗi nhánh dựa trên nhánh trước). Khi mở PR cần tách hoặc merge tuần tự theo đúng thứ tự này.

## Quyết định kiến trúc

| Ngày | Quyết định | Lý do | Ảnh hưởng |
|------|-----------|-------|-----------|
| 2026-08-10 | Cài Node.js LTS v24.19.0 qua winget | Máy chưa có Node → không chạy được test/lint/tsc, tức không thoả §3 | Môi trường dev cục bộ |
| 2026-08-10 | Ma trận quyền FE dựng động từ `GET /admin/permissions`, không dùng danh sách cứng | Danh sách cứng cũ (8 subject × 5 action) bỏ sót 8/16 subject và 5/9 action thật, và chứa `export` không tồn tại → nút Lưu âm thầm xoá mọi quyền ngoài lưới | Mọi permission mới seed vào DB tự động xuất hiện trên lưới |
| 2026-08-10 | Ô không có trong danh mục render `—` thay vì checkbox | Lưới đầy đủ cartesian cho phép admin tạo permission không guard nào kiểm, và `updateRolePermissions` sẽ upsert chúng thành row thật | Không sinh Permission rác |
| 2026-08-10 | Fail-closed: load quyền lỗi → khoá nút Lưu | Trước đây lỗi bị nuốt, ma trận rỗng vẫn ghi đè được — đây chính là cơ chế gây mất quyền | Không thể ghi đè bằng dữ liệu chưa tải được |
| 2026-08-10 | `deleteRole` ghi audit `ROLE_DELETED` | `requesterId` vốn bị `eslint-disable no-unused-vars`; xoá vai trò là thao tác an ninh phải có vết | Bỏ được 1 lint suppression (§5) |
| 2026-08-10 | Chuyển `PROGRESS.md` cũ sang `docs/legacy/` thay vì ghi đè | §2 — bảo toàn dữ liệu khi spec mâu thuẫn | Lịch sử di trú legacy vẫn tra cứu được |

## Assumption đã tự quyết

| Điểm mơ hồ | Diễn giải đã chọn | Căn cứ |
|---|---|---|
| §4 yêu cầu message là hằng số/khoá i18n, nhưng repo không có hạ tầng i18n | Gom message của ma trận quyền vào hằng `MESSAGES` có namespace ở đầu file, không dựng framework i18n giữa PR | §4 "convention hiện có của repo thắng"; vẫn tạo được điểm neo cho lần i18n sau |
| §3.4 "lint sạch" vs 59 lỗi lint có sẵn trong `admin.service.ts` | Diễn giải theo đúng chữ "không warning **mới**": chỉ đảm bảo dòng tôi thêm sạch, không reformat code cũ không liên quan | Reformat cả file làm diff phình và trộn mục đích, trái "1 branch = 1 mục đích". Nợ này giao cho PR-B0a — PR mà mục đích chính là bật lint |
| Baseline test trong CLAUDE.md (1728 BE + 733 FE) | Đo lại thực tế: **2867 BE + 1457 FE** (trước khi tôi thêm test). Dùng số đo thật làm mốc | Chạy `npx jest` và `npx vitest run` trực tiếp |

## Trạng thái test

Full suite: **PASS**
- Backend: 227 suite / **3104** test — PASS (xem ND-9: 1 suite flaky ~1/6 lần, có sẵn từ trước)
- Frontend: 159 file / **1547** test · Mobile: **96** test (mới chạy được) — PASS (3 lần chạy liên tiếp ổn định)
- Cổng governance: enum guard ✅ · gen:enums drift ✅ · lint ratchet ✅ (baseline 8.945 sau ADR-0015)
- `tsc --noEmit` (BE): sạch · `tsc -b` (FE): sạch
- eslint: không có lỗi mới trên dòng đã thêm (nợ lint có sẵn xem ND-1)

Patch coverage: BE 100% dòng mới · FE chỉ còn 1 guard chống race chưa phủ
Test fail: không

## Nợ kỹ thuật / rủi ro

| # | Nội dung | Giao cho |
|---|---|---|
| ND-1 | `backend/src/admin/admin.service.ts` có **59 lỗi prettier** và `admin.service.spec.ts` có ~32 dòng lỗi `no-unsafe-*` — đều có sẵn, do CI chưa bao giờ chạy eslint | PR-B0a |
| ND-2 | CLAUDE.md:31 tuyên bố "Verified by grep guard in CI" nhưng guard **không tồn tại** trong `.github/workflows/` | PR-B0a |
| ND-3 | CLAUDE.md ghi baseline test 1728+733, thực tế 2867+1457 — cần sửa tài liệu | PR-B0a |
| ND-4 | `backend/test/` không bao giờ chạy (`jest.rootDir = "src"`); `frontend/src/hooks/useMasterClassOptions.test.ts` không bao giờ chạy (vitest `include` chỉ nhận `__tests__/`) | PR-B0a |
| ND-5 | Chạy song song jest (BE) và vitest (FE) trên máy này gây timeout giả ở test dùng `findBy*` — **luôn chạy tuần tự**. Đã giảm nhẹ bằng `asyncUtilTimeout: 5000` trong `frontend/src/test-setup.ts` | Ghi chú vận hành |
| ND-10 | **6 spec UAT tự sinh không type-check được** (9 lỗi, đã bớt 2 sau khi thêm `jszip`): `cases-uat.api` (shorthand `linkedIncidentId` không có biến), `petitions-uat.api` (×4, `senderName`/`receivedDate` — `__baseBody()` đã có `receivedDate`, thiếu `senderName`), `petitions-uat-security.api` (`senderIsAnonymous` khai 2 lần + mojibake tiếng Việt), `export-chung-tu-dong-uat.api` + `petition-export-uat.api` (thiếu dependency `jszip`), `document-numbers-uat-2.e2e` (implicit any), `system-wide-uat.e2e` (possibly null). Generator quên khai báo biến ⇒ chạy sẽ `ReferenceError`. Chưa sửa vì phải nối fixture cho từng file và suite này đã bị loại khỏi CI. Đang là bước **advisory** trong job `Advisory Checks` | PR triage suite UAT |
| ND-11 | **Đã xoá** `tests/fixtures/data-factory-cases.ts` — file tự sinh với placeholder `⚠️ Chưa có fixture nào define` chèn thẳng vào tên hàm, `path = ""`, `fixture_id`. Không parse được, không ai import. Nếu generator UAT chạy lại với danh sách fixture rỗng thì nó sẽ sinh lại — cần sửa generator | PR triage suite UAT |
| ND-12 | **`tests/global-setup.ts` từng nhúng sẵn 5 mật khẩu trong source** và `tests/uat-auto/_helpers.ts` mặc định trỏ IP production `171.244.40.245`. Đã sửa ở PR-B0b (bắt buộc lấy từ env, thiếu thì ném lỗi rõ ràng). **Cần đối chiếu**: 5 mật khẩu đó có phải credential thật đang dùng không — nếu có, phải đổi vì chúng nằm trong git history | Cần người xác nhận |
| ND-13 | **`Evidence` chưa có ràng buộc DB cho `(caseId, code)` khi bản ghi còn sống.** Bất biến hiện thi hành bằng khóa hàng vụ án cha (`withCaseLock`) — đủ chặn đua tranh, nhưng chỉ đúng khi mọi đường ghi đều đi qua đó, và người sửa DB trực tiếp bằng `psql` vẫn tạo được bản trùng. Chưa thêm partial unique index vì bảng đã có dữ liệu chưa từng bị ràng buộc trong nền 53k bản ghi legacy: nếu đang có cặp trùng thì `CREATE UNIQUE INDEX` hỏng và deploy đứng, mà chọn bỏ bản nào là quyết định về hồ sơ pháp lý. **Việc cần làm:** chạy câu đối soát trong ADR-0016 §"Điều kiện chuyển sang index thật"; nếu rỗng thì thêm index luôn | Cần người giữ hồ sơ quyết |
| ND-17 | **`cases.service.ts` tự viết lại logic scope và cố ý bỏ qua khi `canDispatch`** ở hai chỗ: liên kết đơn thư (`if (dataScope && !dataScope.canDispatch)`) và liên kết vụ việc khi tạo vụ án. Hai chỗ đó **chuyển trạng thái** bản ghi được liên kết ⇒ là ghi thật, chéo tổ. Nằm ngoài `scope-filter.util.ts` nên ADR-0017 không chạm tới. Bản đầu ADR-0017 nói "phân công là đường ghi chéo tổ duy nhất" — **sai**, đã đính chính trong chính ADR | PR riêng (đụng luồng tạo vụ án, rủi ro riêng) |
| ND-18 | **Đổi cha (reparenting) chỉ kiểm cha cũ, không kiểm cha mới.** `subjects.update`, `lawyers.update`, `documents.update` xác nhận cha mới *tồn tại* nhưng không kiểm nó có trong phạm vi ghi ⇒ bản ghi con đang trong tầm có thể bị chuyển sang vụ án ngoài tầm. `documents` còn tách được thành mồ côi | PR riêng — cùng lớp với A3 nhưng là đường `update`, không phải `create` |
| ND-19 | **Nạp cha và tạo con là hai câu lệnh rời ở cả 6 service vừa vá.** Phân công có thể đổi giữa lúc kiểm và lúc ghi ⇒ ghi bằng scope cũ. Cách sửa: gộp nạp/kiểm/tạo vào một transaction có điều kiện phiên bản, như `withCaseLock` của module vật chứng (ADR-0016) | PR riêng |
| ND-20 | **Người không phải cán bộ phường, chỉ cần có 1 tổ ghi được, là ghi được lên mọi bản ghi cha chưa phân công** trong toàn hệ thống (`unassigned` branch trong `assertParentInScope`). Đúng thiết kế cho luồng "nhận việc từ intake", nhưng phạm vi rộng hơn mức cần và không có gì giới hạn theo nguồn gốc bản ghi | Cần quyết chính sách |
| ND-22 | **Menu chỉ kiểm cờ tính năng, không kiểm quyền.** Sau khi `edit-window-requests` được đăng ký, mục "Yêu cầu reset thời hạn" hiện cho **mọi** user đã đăng nhập (cờ default-allow), nhưng endpoint đòi `review_reset_request:EditWindowResetRequest` ⇒ bấm vào là 403. Lỗ này có sẵn ở mọi mục menu; trước đây không thấy vì mục này vốn đã ẩn do bug. Liên quan ND-6 (tầng phân quyền FE vẫn là mock) | Quyết cùng ND-6 sau M2 |
| ND-23 | **`edit-window-requests` chưa gate API.** `EditWindowController` không có `@FeatureFlag(...)`, route FE luôn đăng ký ⇒ tắt cờ chỉ ẩn menu, gõ URL và gọi API vẫn chạy. Đúng thiết kế hiện tại (gate API là Wave 5 / E4–E6, đang bị PR-M1 chặn cứng), ghi lại để không nhầm là đã gate | PR-E5 |
| ND-24 | **Ô chọn vụ án chỉ tải 100 bản mới nhất** (`GET /cases` chặn `@Max(100)`). `FKSelection` có ô tìm nhưng tìm trên dữ liệu **đã tải**, nên quá 100 vụ án là không gắn được kiến nghị vào vụ cũ. Cần ô chọn tìm phía server | PR riêng |
| ND-25 | **Lọc theo phường/xã đã gỡ khỏi trang "phân loại khác".** Giá trị thật nằm ở `subjects.wardId`, BE lọc qua quan hệ subjects (`GET /cases?wardId=`), không lọc được trên dữ liệu đã tải. Ô cũ có 3 phường bịa và so với một trường luôn rỗng. Muốn khôi phục thì phải: (a) ô chọn phường lấy từ admin-units, (b) truyền `wardId` xuống server | PR riêng |
| ND-21 | **`ensureFresh()` nuốt lỗi refresh**, nên `PATCH /feature-flags/:key` báo thành công dù cache không đọc lại được, và guard cục bộ phục vụ giá trị cũ trong cửa sổ backoff. `POST /refresh` cũng trả `success: true` sau một lần đọc hỏng. Cùng với đó, cache là process-local nên nhiều instance sẽ lệch tới 30s (ADR-0009 đã chấp nhận giả định 1 instance — cần xem lại nếu scale ngang) | PR riêng |
| ND-16 | **Bị hại và nhân chứng của hồ sơ đã tạo không có màn hình nào để thêm.** Form tạo có đủ 4 loại (Bị can/Bị hại/Luật sư/Nhân chứng), nhưng trang chi tiết chỉ có tab Bị can (`POST /subjects` với `type:"SUSPECT"` cứng, `CaseDetailPage.tsx:907`) và tab Luật sư. Trước PR-A2 thì mọi loại đều "nhập được" ở chế độ sửa nhưng bị vứt im lặng — nay bảng chỉ đường nói rõ khoảng trống thay vì gửi người dùng tới tab không tạo được thứ họ cần | PR-D2 (form tạo độc lập subjects) |
| ND-14 ✅ | **ĐÃ XỬ LÝ ở PR-A3 (ADR-0017).** **`assertParentInScope` bỏ qua toàn bộ kiểm tra khi `scope.canDispatch`, kể cả `operation: 'write'`** (`scope-filter.util.ts:104`). `canDispatch` được mô tả là quyền đọc toàn cục + quyền phân công, không phải quyền sửa mọi hồ sơ — nhưng thực tế người điều phối tạo/sửa/xóa/khôi phục được bản ghi con của **mọi** vụ án. Ảnh hưởng cả 12 resource, không riêng vật chứng | PR-A3 (PR chuyên về DataScope) |
| ND-15 | **Đường đọc chi tiết trả 403 cho bản ghi ngoài phạm vi và 404 cho bản ghi không tồn tại**, tức lộ sự tồn tại của hồ sơ tổ khác. Mẫu này dùng thống nhất toàn hệ thống nên phải quyết một lần (đưa scope vào `where` rồi trả 404 cho cả hai), không sửa lẻ từng module | Quyết cùng PR-A3 |
| ND-26 | **`prisma migrate deploy` KHÔNG dựng được DB trắng.** Lịch sử migration bắt đầu bằng `20260227000000_add_case_metadata`, một câu `ALTER TABLE "cases"`, và **không migration nào tạo bảng `cases`** — kiểm bằng `grep -l 'CREATE TABLE "cases"' */migration.sql` → rỗng. Nghĩa là schema nền chưa từng được chụp thành migration; production được dựng bằng `db push` rồi mới bắt đầu ghi migration. Hệ quả: dựng VM mới theo `docs/DEPLOY.md` sẽ hỏng ở bước `prisma migrate deploy` với `ERROR: relation "cases" does not exist`. Phát hiện khi dựng DB dev cho C4 (`docker run postgres:16-alpine` → `migrate deploy` → P3009). Không phải do đợt thi công này. **Việc cần làm:** chụp một migration baseline từ `schema.prisma` và `prisma migrate resolve --applied` nó trên prod, hoặc ghi rõ trong DEPLOY.md rằng DB mới phải `db push` trước. | PR riêng |
| ND-9 ✅ **ĐÃ SỬA** | **Không phải đua tranh cache. Chẩn đoán cũ sai từ đầu.** Lỗi thật lấy được khi tái hiện (đỏ 1/10 vòng chạy full, log giữ ở `run9.txt`): `node_modules/@scure/base/index.js:366 — SyntaxError: Unexpected token 'export'`. Chuỗi nạp: `two-fa.service.ts:10` → `otplib/dist/index.cjs` → `@otplib/plugin-base32-scure/dist/index.cjs` → **`@scure/base`**, gói `"type":"module"` **không có trường `exports`** nên chỉ có đúng một lối vào là ESM thuần. `transformIgnorePatterns` cho phép `@otplib` và `@noble` nhưng **sót `@scure`** ⇒ jest đưa ESM thô cho runtime CJS. Sở dĩ *ngẫu nhiên* là vì `two-fa.service.spec.ts:9` có `jest.mock('otplib')`: bình thường module thật không bao giờ được nạp, chỉ những lần mock không phủ tới mới lộ. Không liên quan gì tới cache, tới `maxWorkers`, hay tới Windows. **Tái hiện tất định**: một spec `require('otplib')` không mock → đỏ 100%. Vá: thêm `@scure` (và cả cây ESM của `file-type`) vào danh sách cho phép. Chốt chặn: `src/common/esm-dependencies.spec.ts` nạp **mọi** dependency lúc chạy — chính nó tìm ra ca thứ hai (`file-type`) ngay lần chạy đầu. **Nhưng `@scure` chỉ là tầng ngoài.** Vá xong thì otplib thật nạp được, và lỗi *đổi chữ ký* chứ chưa hết: `SecretTooShortError: Secret must be at least 16 bytes, got 10 bytes`, vẫn 3/12 vòng — chứng cứ rằng thứ hỏng là **`jest.mock('otplib')` có lúc không ăn**, còn otplib thật thì chạy với secret giả 10 byte của fixture. Đã loại tiếp giả thuyết "spy `fs.readFileSync` không khôi phục" (dòng 104 `makeService` vá `fs` — module lõi dùng chung cả tiến trình, chính jest đọc cache transform qua đó): thêm `afterEach(restoreAllMocks)` giảm còn 1/20 nhưng **không dứt**, nên đó không phải nguyên nhân gốc — giữ bản vá vì bản thân nó là lỗi thật. Kết luận: khớp module-ID của jest giữa spec và service không phải lúc nào cũng đồng ý dưới tải song song; không sửa được từ phía cấu hình. **Cách sửa cuối — xoá hẳn bề mặt đó:** `TwoFaService` phơi 3 hàm otplib qua một field `totp` (mặc định `REAL_TOTP` — production không đổi gì), spec gán thẳng stub vào field và **không mock package nữa**. Gán field thì không thể trượt như phân giải module. Kiểm chứng: 25 vòng full suite liên tiếp. | — |
| ND-9 (chẩn đoán cũ, **SAI** — giữ lại để không ai đi lại đường này) | **`two-fa.service.spec.ts` flaky ~1/6 lần chạy full — CHƯA sửa được, đã điều tra kỹ.** Đã thử và **loại bỏ** các giả thuyết: (a) `cacheDirectory` riêng cho backend — đã áp dụng, giảm va chạm giữa các tiến trình jest nhưng không dứt vì đua tranh nằm **giữa các worker trong cùng một lần chạy**; (b) `maxWorkers=4` — giảm tỷ lệ nhưng vẫn đỏ 1/6, và trên runner CI 4 nhân thì `50%`=2 worker còn ít hơn 4 nên giữ nguyên `50%`; (c) bỏ `transformIgnorePatterns` — **làm hỏng một suite khác** (2976 vs 2981), hoàn tác; (d) `globalSetup` hâm cache — **vô tác dụng**, vì globalSetup dùng `require` thuần của Node, không đi qua `ScriptTransformer` nên không ghi mục cache nào; đã gỡ thay vì để lại file giả vờ sửa. Hướng còn lại chưa thử: mock `otplib` trong spec (làm yếu test), hoặc chờ bản jest vá đua tranh ghi cache trên Windows. **Rủi ro CI: job `Backend Tests` có thể đỏ ngẫu nhiên ~1/6 lần.** | PR riêng |
| ND-9 (gốc) | **`backend/src/auth/services/two-fa.service.spec.ts` flaky ~1/4 lần chạy full song song.** Không phải lỗi TOTP theo thời gian: là `invariant` rỗng từ `ScriptTransformer._buildTransformResult` của jest khi nạp `node_modules/otplib/dist/index.cjs` → dấu hiệu đua tranh cache giữa các worker. Pass 5/5 khi chạy riêng. **Có sẵn từ trước** — không file nào trong chuỗi phụ thuộc này bị đợt thi công chạm tới. Chưa sửa: chẩn đoán cache race của jest là việc riêng. Rủi ro: job `Backend Tests` trong CI có thể đỏ ngẫu nhiên. Hướng điều tra: `cacheDirectory` riêng cho từng workspace, hoặc rà `transformIgnorePatterns` (`node_modules/(?!(@otplib\|@noble)/)` không bao gồm `otplib` không có scope) | PR riêng |
| ND-6 ✅ | **ĐÃ XỬ LÝ ở Phase 1.** Tầng phân quyền FE vẫn là mock (`MOCK_ALL_PERMISSIONS` cấp toàn quyền cho mọi user, 252 call site) — người dùng chủ động hoãn; yêu cầu "không mockup" **chưa thoả mãn hoàn toàn** | Quyết lại sau M2 |
| ND-7 | Cổng `prisma migrate diff` sẽ đỏ ngay do ≥6 partial index không biểu diễn được trong Prisma 7; PR-C4 còn cần thêm một cái nữa | PR-B0b (đặt `continue-on-error`) |
| ND-8 | Gate API bằng feature flag sẽ làm hỏng app mobile đã cài (`mobile/lib` không đọc cờ, interceptor chỉ bắt 401, không có forced-update) | PR-M1 chặn cứng E4–E6 |

---

## Trạng thái sau đợt thi công M4 + M5 (phiên này)

**M0–M4 XONG HẾT. M5 xong phần mã; còn E3 và điều kiện vận hành cho E6.**

| Mốc | Trạng thái |
|---|---|
| M0, M0.5, M1, M2, M3 | ✅ hết |
| ND-6, ND-9, ND-16, ND-18, ND-19, ND-22 | ✅ |
| M4 — D2, D3, D4, D5, D6, D7, D8, D9 | ✅ hết |
| M5 — PR-M1-mobile (4 việc Dart) | ✅ mobile 107 test |
| M5 — E1 (xoá mã chết), E2 | ✅ |
| M5 — E4, E5, E6 (gate API 18 controller) | ✅ **mã xong**, xem điều kiện merge E6 bên dưới |
| M5 — E3 (restore 9 child entity) | ❌ **chưa làm** |
| UAT 4 đợt + `UAT-COVERAGE.md` + merge | ❌ **chưa làm** |

### Điều kiện merge còn treo — E6

Mã đã có (`cases`, `incidents`, `petitions`, `calendar`, `teams`, `reports` mang
`@FeatureFlag`). **Chưa merge được** cho tới khi PR-M1-mobile lên production VÀ tỷ lệ APK cũ đủ
thấp. **Ngưỡng chưa ấn định** — cần người quyết một con số, không phải việc code.

### Nợ mới phát hiện trong phiên

| # | Nội dung |
|---|---|
| ND-26 | `prisma migrate deploy` **không dựng được DB trắng**: lịch sử migration mở đầu bằng `ALTER TABLE "cases"` và không migration nào tạo bảng `cases`. Dựng VM mới theo `docs/DEPLOY.md` sẽ hỏng. Có sẵn từ trước. Cách sửa: chụp một migration baseline từ `schema.prisma` rồi `prisma migrate resolve --applied` trên prod. |
| ND-27 | `.gitignore` gốc có `*.png` không neo → nuốt ảnh tài liệu; `backend/.gitignore` có `reports/` không neo → nuốt `src/reports/` là mã nguồn. **Đã sửa cả hai**, ghi lại vì cùng một lớp lỗi có thể tái diễn với pattern khác. |
| ND-28 | ✅ **ĐÃ SỬA.** Nay là **503** kèm câu tiếng Việt nói rõ đây là thiếu cấu hình (không phải lỗi dữ liệu người dùng nhập) và chỉ đúng lệnh sửa. Cả ba nơi gọi `findActiveTemplate` đều là đường *sinh số để tạo* hồ sơ, không nơi nào là tra cứu, nên đổi loại lỗi an toàn. **Suýt viết sai chỉ dẫn:** tên script là `db:seed:doc-templates`, KHÔNG phải `db:seed:document-templates` như tên file gợi ý — đã thêm test đọc `package.json` thật để chỉ dẫn không thể trôi khỏi hiện thực. |
| ND-29 | 3 module (`calendar-events`, `event-categories`, `event-reminders`) đã gate API từ trước mà manifest **không khai** `gating`. `feature-gating.spec.ts` bắt được khi kiểm chiều ngược. Đã khai. |

### Môi trường chạy thật (dựng trong phiên)

Postgres dev `localhost:55432` (docker `pc02-dev-db`), backend `:3000`, frontend `:5173`.
Khoá JWT dev ở `backend/.dev-keys/` (đã ignore) — **không** ghi đè `backend/keys/public.pem` của repo.
Seed cần cho luồng chạy được: `seed.ts`, `seed-crimes-blhs2015.ts`, `seed-document-numbers.ts`,
`seed-document-templates.ts`.

STATUS: BLOCKED
