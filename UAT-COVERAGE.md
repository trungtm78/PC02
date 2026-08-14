# UAT-COVERAGE — nhánh `fix/frontend-real-permissions`

> **Trạng thái: CHƯA ĐỦ ĐỂ MERGE.** Phần tự động đã chạy và xanh. Phần kiểm tay
> **chưa ai chạy** — tài liệu này ghi đúng như vậy chứ không đánh dấu PASS cho
> thứ chưa làm. Một bảng UAT toàn dấu tick mà không ai bấm chuột thì tệ hơn là
> không có bảng nào: nó tạo ra sự tin tưởng không có cơ sở, ngay trước lúc đưa
> lên production.

Cập nhật: sau 26 commit của đợt M4 + M5.

---

## 1. Tự động — ĐÃ CHẠY, XANH

| Hạng mục | Kết quả |
|---|---|
| Backend | 241 suite / **3251** test PASS |
| Frontend | 168 file / **1624** test PASS |
| Mobile | **107** test PASS |
| `tsc --noEmit` (BE) | sạch |
| `tsc -b` (FE) | sạch |
| `flutter analyze` | sạch, trừ 3 info có sẵn |
| Cổng enum-literal | không vi phạm mới |
| Cổng enum-sync (`gen:enums` drift) | sạch |
| Cổng lint ratchet | 350 file thay đổi, không file nào tệ hơn baseline |
| Flake ND-9 | **25/25 vòng full suite liên tiếp xanh** (trước vá đỏ ~25%) |

### Chốt chặn riêng của đợt này

| Chốt | Nơi thi hành |
|---|---|
| Gate API ⇔ manifest, **hai chiều** | `feature-flags/feature-gating.spec.ts` |
| Không gate 6 khoá lõi, `notifications`, 6 danh mục tra cứu | cùng spec trên |
| Mọi dependency lúc chạy nạp được dưới jest | `common/esm-dependencies.spec.ts` |
| Ánh xạ quyền FE khớp seed BE | `shared/enums/__tests__/permission-mapping.test.ts` |
| Giới hạn upload khớp `documents.controller.ts` | `shared/__tests__/upload-limits.test.ts` |

---

## 2. Grep chốt chặn của kế hoạch — ĐÃ SOÁT ĐỦ 4/4

Đã soát từng chỗ, không chỉ đếm.

| # | Chốt | Kết quả |
|---|---|---|
| 3 | `(bg\|text\|border\|ring)-${` — class Tailwind ghép mảnh | ✅ **SẠCH**. Một kết quả duy nhất nằm trong *comment* của `StatCard.tsx` giải thích chính luật này. |
| 1 | `<button` không có `onClick` | ✅ **SẠCH**. Quét chính xác còn 6 ứng viên, **cả 6 là dương tính giả**: 2 chỗ do regex của chính tôi cắt nhầm ở dấu `>` trong `page >= totalPages` và trong `<body>` của một comment; `components/ui/button.tsx` truyền `{...props}` nên handler đến từ nơi gọi; 2 chỗ trong `PetitionFormPage` cố ý dùng `onMouseDown` (phải bắn **trước** `blur` thì mới chọn được mục trong dropdown). |
| 2 | `alert(` trong `handleSubmit` không kèm gọi API | ✅ **SẠCH**. Chỉ còn **một** `alert` báo thành công, ở [CaseFormPage/index.tsx:350](frontend/src/pages/cases/CaseFormPage/index.tsx#L350) — và nó nằm sau `api.post('/cases', payload)` thật, trong `try` có `catch` xử lý 409 và lỗi khác. Số còn lại đều là **thông báo lỗi hoặc chặn thao tác**, hợp lệ. |
| 4 | `catch` không `extractApiError` trong handler lưu | ✅ **SẠCH — sau khi sửa 4 chỗ thật.** Xem bảng dưới. |

### Chốt #4 — 4 lỗi thật đã sửa

Quét 24 `catch` im lặng trong file có gọi `api.post/put/patch/delete`. Phần lớn hợp lệ
(poll thông báo, banner phụ, tải danh mục nền). **Bốn** chỗ nằm đúng trên đường lưu và
tự ghi trong comment rằng chúng cố tình im:

| Nơi | Comment cũ | Người dùng thấy gì | Đã sửa |
|---|---|---|---|
| `PetitionGuidancePage` `handleSave` | *"silently fail — form stays open so user sees no crash"* | **Tệ nhất**: `catch` không `return`, nên lưu hỏng mà **modal vẫn đóng** — không phân biệt được với lưu xong | `setSaveError(...)` + `return`; ô `guidance-save-error` |
| `InvestigationDelegationPage` `handleSave` | *"keep modal open on error"* | Nút Lưu trông như hỏng; người dùng bấm lại nhiều lần | ô `delegation-save-error` |
| `CaseExchangePage` `handleSubmit` | *"keep modal open on error"* | Như trên | ô `exchange-submit-error` |
| `CaseExchangePage` `handleSendMessage` | *"silently fail"* | Tin nhắn biến mất khỏi ô nhập như thể đã gửi | ô `thread-send-error`, giữ nguyên nội dung đã nhập |

`TransferAndReturnPage:836` là **dương tính giả** — nó gom lỗi vào `failed[]` và hiện panel
kết quả thật (`✗ Thất bại: <mã hồ sơ>`).

Chốt bằng test: [save-errors-surface.test.tsx](frontend/src/pages/workflow/__tests__/save-errors-surface.test.tsx) — 4 test, mỗi test khẳng định đúng phần vừa thêm.

**Vì sao đây là cùng một lỗi gốc với `alert("thành công")`:** giao diện nói dối. Chỉ khác
là nói dối bằng cách im lặng thay vì bằng lời.

---

## 3. Kiểm tay theo đợt merge — CHƯA CHẠY

Bốn đợt dưới đây **chưa ai chạy**. Mỗi kịch bản cần một người ngồi trước máy.

### Đợt 1 — Hồi sức + governance (rủi ro thấp)
- [ ] `/nguoi-dung` → thẻ Phân quyền → ma trận hiện **đúng** quyền hiện có
- [ ] Ngắt mạng → nút Lưu **disabled**
- [ ] **Trước khi merge:** `SELECT * FROM audit_logs WHERE action='ROLE_PERMISSIONS_UPDATED'` trên prod. Nếu đã có ai bấm Lưu ⇒ quyền đã mất ⇒ chạy lại `prisma/seed-permissions.ts` (idempotent).

### Đợt 2 — Bảo mật + mất dữ liệu (rủi ro CAO)
- [ ] **Báo người vận hành TRƯỚC KHI merge**: ADR-0017 đổi ngữ nghĩa `canDispatch`. Ai đang dùng tài khoản điều phối để **sửa** hồ sơ tổ khác sẽ nhận 403. Cách xử lý đúng là cấp WRITE grant cho tổ đó, **không** mở lại lối tắt.
- [ ] User tổ A → `POST /subjects` với `caseId` của tổ B → **403**
- [ ] Thêm vật chứng khi sửa vụ án → **lưu được**
- [ ] Gửi `evidences[]` thẳng vào `PUT /cases/:id` → **400**
- [ ] `POST /directories/seed` khi `ALLOW_SEED_ENDPOINTS` không set → **403**
- [ ] **Mới (ND-18):** sửa một đối tượng của tổ A, đổi `caseId` sang vụ án tổ B → **403**

### Đợt 3 — Hạ tầng cờ
- [ ] `GET /feature-flags` bằng token **OFFICER** → **200**, đủ số flag
- [ ] `PATCH /feature-flags/auth {enabled:false}` → **400**
- [ ] `UPDATE feature_flags SET enabled=false WHERE key='admin'` bằng psql → `GET` vẫn trả `admin.enabled=true`
- [ ] Mục **"Yêu cầu reset thời hạn"** xuất hiện trong sidebar
- [ ] **Sau deploy:** `SELECT COUNT(*) FROM feature_flags` = số manifest (**41**); `SELECT * FROM permissions WHERE subject='FeatureFlag'` có row

### Đợt 4 — Xoá mockup — **5/5 XANH khi chạy riêng file**

Chạy bằng trình duyệt thật:
[`tests/e2e-new/uat-wave4-mockup.e2e.spec.ts`](tests/e2e-new/uat-wave4-mockup.e2e.spec.ts).

```bash
BASE_URL=http://localhost:5173 UAT_PROD=1   ADMIN_USERNAME=<user> ADMIN_PASSWORD=<pass> UAT_USER=<user> UAT_PASS=<pass>   npx playwright test --project=e2e-new tests/e2e-new/uat-wave4-mockup.e2e.spec.ts
```

- [x] `/reports/monthly` bảng "Tồn đầu kỳ" render (không rơi vào nhánh rỗng), **không còn `+12%`** cứng
- [x] `/classification/duplicates` **không có** chuỗi `001234567890` trong DOM, không còn `%` giả
- [x] `/settings` không còn thẻ mock (`Tích hợp`, `Sao lưu & Phục hồi`)
- [x] Không route nào trong đợt lọt "Sắp ra mắt" (`/reports/monthly`, `/classification/duplicates`, `/settings`, `/kpi`)
- [x] **E3** `/admin/khoi-phuc` → thẻ **Khác** → panel hiện, ô chọn loại có mục lấy từ
      registry máy chủ.
      *Lần chạy đầu test này SKIP và tôi ghi nhầm nguyên nhân là "panel bị ẩn theo quyền,
      cần tài khoản có `restore`". Sai: panel nằm sau tab "Khác" mặc định chưa chọn, test
      của tôi không bấm tab. Không liên quan gì đến phân quyền.*
- [ ] **C10 trả hồ sơ hàng loạt → panel kết quả** — chưa tự động hoá (cần dữ liệu hồ sơ đủ điều kiện)
- [ ] Trang phân loại khác: đặt "từ ngày" → lọc đúng — chưa tự động hoá

### Đợt 3 — hạ tầng cờ — **3/3 XANH khi chạy riêng file**

[`tests/e2e-new/uat-wave3-feature-flags.api.spec.ts`](tests/e2e-new/uat-wave3-feature-flags.api.spec.ts)

- [x] `GET /feature-flags` → 200, > 20 cờ (cờ rỗng ⇒ sidebar trống)
- [x] `PATCH /feature-flags/auth {enabled:false}` → **400** (không tắt được cờ lõi)
- [x] Tắt cờ `lawyers` → `GET /lawyers` **404 kèm `FEATURE_DISABLED`**, rồi bật lại và
      kiểm chứng đã bật lại thật (test riêng, để bước dọn không chỉ là ý định tốt)

> **Sự thật vận hành phát hiện khi viết test:** cờ được cache trong tiến trình,
> TTL mặc định **30 giây** (`FEATURE_FLAG_CACHE_TTL_MS`), và `PATCH` **không**
> xoá cache. Đây là chủ ý — cache nằm trong từng tiến trình nên nhiều instance
> hội tụ bằng TTL, chứ không bằng một lệnh xoá chỉ tới được một instance.
> **Tắt một cờ mất tới 30 giây mới có hiệu lực, không phải tức thì.** Lần viết
> đầu tôi khẳng định 404 ngay sau `PATCH`, test đỏ, và tôi suýt ghi đó là lỗi gate.

> ### Hai vấn đề của chính bộ test — một đã giải, một chưa
>
> **1. Đợt 4 đỏ khi chạy chung — ĐÃ GIẢI. Là môi trường, không phải mã.**
> Máy chủ dev frontend **tự chết giữa chừng**. Bằng chứng dứt điểm:
> `net::ERR_CONNECTION_REFUSED at http://localhost:5173/login`, và kiểm trực tiếp
> sau đó `FE:000` trong khi `BE:200`. Log Vite khởi động sạch rồi dừng, không lỗi.
> Không liên quan gì tới throttle đăng nhập hay thứ tự chạy — hai giả thuyết đó
> **đều đã bị bác bỏ bằng thí nghiệm**:
> - Giảm 5 lần đăng nhập xuống 1 rồi chờ hết cửa sổ 60s → vẫn đỏ.
> - Loại riêng test tắt cờ ra khỏi lần chạy → vẫn đỏ, và lần này lộ ra
>   `CONNECTION_REFUSED` thay vì `waitForURL timeout`, chính là đầu mối.
>
> Hệ quả cho người chạy: **kiểm máy chủ còn sống ngay trước khi chạy**
> (`curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/`). Một máy chủ
> chết làm bộ test đỏ theo kiểu trông y hệt lỗi đăng nhập của ứng dụng.
>
> **2. Test tắt cờ `lawyers` CHẬP CHỜN — chưa giải.**
> Có lần xanh, có lần hết 40 giây chờ vẫn chưa thấy 404 — kể cả khi chạy **riêng
> file** với backend còn sống. TTL tài liệu ghi 30 giây, nên 40 giây lẽ ra đủ.
> **Chưa xác định được** là cờ lan chậm hơn TTL trong một số điều kiện, hay
> `PATCH` không phải lúc nào cũng ăn. Đây có thể là chuyện vận hành thật đáng
> biết (tắt một cờ mà quá 40 giây chưa có hiệu lực), nên **không tự kết luận là
> lỗi test**. Cần một phiên dò riêng.
>
> Đã kiểm chứng bước dọn có tác dụng: sau mọi lần chạy, `GET /lawyers` trả 200 —
> cờ được bật lại, môi trường không bị bỏ lại ở trạng thái hỏng.

### Đợt 5 — M4 + M5
- [ ] Tắt cờ `lawyers` → `GET /lawyers` trả **404 kèm `error: 'FEATURE_DISABLED'`** (không phải 404 trần)
- [ ] Mobile: tắt cờ → app hiện màn "Tính năng tạm tắt", **không** hiện `Lỗi: DioException`
- [ ] Mobile: đặt `MIN_MOBILE_VERSION` cao hơn bản đang cài → app hiện màn buộc cập nhật
- [ ] Hồ sơ quá hạn sửa → banner + nút "Xin mở lại quyền sửa" → gửi được, hiện trạng thái chờ duyệt

---

## 4. Điều kiện chặn merge còn treo

| # | Nội dung | Ai quyết |
|---|---|---|
| E6 | Mã gate API cho `cases`/`incidents`/`petitions`/`calendar`/`teams`/`reports` **đã có**. Merge cần PR-M1-mobile lên production **và** tỷ lệ APK cũ đủ thấp. **Ngưỡng chưa ấn định.** | Người vận hành |
| ND-26 | ✅ **ĐÃ SỬA.** `prisma/migrations/00000000000000_baseline/` — kiểm chứng: DB trắng → `migrate deploy` → **94/94 sạch** (trước đó chết ở migration thứ nhất). **Việc còn lại của người vận hành:** chạy một lần `npx prisma migrate resolve --applied 00000000000000_baseline` trên DB đang chạy trước lần deploy kế tiếp — chỉ ghi 1 dòng, không đụng dữ liệu. Drift còn lại 46 câu — **đã quy trách nhiệm đủ 46/46: tất cả đều do migration, không câu nào do baseline** (ADR-0011). Xem `docs/DEPLOY.md`. | Người vận hành chạy `migrate resolve` |
| ND-12 | 5 mật khẩu từng nằm trong git history — có phải credential thật đang dùng không | Cần người xác nhận |
| ND-13 | Mã vật chứng trùng trong 53k bản ghi legacy — chọn bỏ bản nào | Người giữ hồ sơ |
| ND-20 | "Ai có ≥1 tổ ghi được thì ghi được mọi bản ghi chưa phân công" — đúng hay quá rộng | Quyết chính sách |

---

## 5. Sau mỗi đợt deploy

- `curl http://171.244.40.245/api/v1/health` → `{"status":"ok", ...}`
- Kiểm log `deploy.sh` bước 9b-2 (`Syncing permission registry`) chạy sạch — hỏng là mọi endpoint mới 403
- Fresh DB: chạy một lần `npm run db:seed:features`, và các seed mà luồng nghiệp vụ cần:
  `seed.ts`, `seed-crimes-blhs2015.ts`, `seed-document-numbers.ts`, `seed-document-templates.ts`
  (thiếu cái thứ ba thì **tạo đơn thư trả 404** — xem ND-28)
