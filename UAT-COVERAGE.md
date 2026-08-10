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
| Backend | 241 suite / **3250** test PASS |
| Frontend | 167 file / **1619** test PASS |
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

## 2. Grep chốt chặn của kế hoạch — MỘT PHẦN

| # | Chốt | Kết quả |
|---|---|---|
| 3 | `(bg\|text\|border\|ring)-${` — class Tailwind ghép mảnh | ✅ **SẠCH**. Một kết quả duy nhất nằm trong *comment* của `StatCard.tsx` giải thích chính luật này. |
| 1 | `<button` không có `onClick` | ⚠️ **CHƯA SOÁT**. Heuristic thô đếm 57 — phần lớn gần như chắc chắn là dương tính giả (`type="submit"`, nút bên trong `<form onSubmit>`, nút chỉ có `onKeyDown`). Cần một lượt soát từng chỗ; **chưa làm**. |
| 2 | `alert(` trong `handleSubmit` không kèm gọi API | ⚠️ **CHƯA SOÁT**. 42 lời gọi `alert(` trên toàn bộ `src`. Ba chỗ tệ nhất đã sửa ở đợt này (đơn trùng lặp, trả hồ sơ, xuất Excel hướng dẫn), nhưng 42 chỗ còn lại chưa được phân loại "thông báo lỗi hợp lệ" và "báo thành công giả". |
| 4 | `catch` không `extractApiError` trong handler lưu | ⚠️ **CHƯA SOÁT**. Cần đọc từng handler. |

**Vì sao không tự tuyên bố PASS:** ba chốt còn lại cần đọc mã từng chỗ, không phải đếm.
Ghi "PASS" dựa trên một con số grep là đúng cái kiểu tự tin không có cơ sở mà cả đợt
thi công này đang gỡ bỏ.

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

### Đợt 4 — Xoá mockup
- [ ] `/reports/monthly` bảng "Tồn đầu kỳ" **có số**, thẻ KPI **có màu**, không còn "+12%" cứng
- [ ] `/classification/duplicates` DB không có trùng → **empty-state**, không có chuỗi `001234567890` trong DOM
- [ ] Trang phân loại khác: đặt "từ ngày" → lọc **đúng**
- [ ] `/settings` không còn 3 tab mock
- [ ] **Mới (C10):** trả hồ sơ hàng loạt → panel kết quả hiện đúng số đi / bỏ qua / lỗi
- [ ] **Mới (E3):** `/admin/khoi-phuc` → thẻ **Khác** → khôi phục một đối tượng đã xoá → xuất hiện lại trong danh sách

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
| ND-26 | `prisma migrate deploy` **không dựng được DB trắng** — không migration nào tạo bảng `cases`. Dựng VM mới theo `docs/DEPLOY.md` sẽ hỏng. | Cần một PR riêng: chụp migration baseline + `migrate resolve --applied` trên prod |
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
