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

### Đợt 4 — Xoá mockup — **ĐÃ CHẠY TỰ ĐỘNG, 5/5 XANH**

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
