# Thiết kế: Xuất chứng từ động cho Vụ việc / Vụ án (+ đồng bộ Đơn thư)

> Ngày: 2026-06-27 · Trạng thái: ĐÃ DUYỆT (brainstorming) · Nhánh: `feat/vu-viec-vu-an-export-documents`

## Context (vì sao)

Hệ thống vừa ship tính năng **xuất chứng từ cho Đơn thư** (v0.68.1.0): 7 mẫu `.docx` **hardcode** + split-button "Lưu và xuất file" + popup gộp/ZIP + atomic cấp số. Nay cần bổ sung xuất chứng từ cho **Vụ việc** và **Vụ án**.

Khác biệt cốt lõi so với đơn thư:
- Chứng từ vụ việc/vụ án **nhiều loại** và **thay đổi theo nghiệp vụ/luật** (BLTTHS): Quyết định khởi tố vụ án/bị can, Kết luận điều tra, Lệnh bắt/khám xét, Quyết định tạm đình chỉ/đình chỉ, nhiều loại Biên bản (khám nghiệm hiện trường, lấy lời khai), Giấy chứng nhận, Thông báo...
- In ở **nhiều giai đoạn tố tụng** khác nhau trong suốt vòng đời hồ sơ, không chỉ lúc tạo.

Hệ thống cũ (pc02hcm.com) đi hướng **template-manager động**: admin upload `.docx`, gán danh mục (Quyết định/Biên bản/Văn bản/Giấy chứng nhận/Biểu mẫu), khai báo biến `{SO_BIEN_BAN}`, `{NGAY_LAP}`... (khảo sát: live data trống ở account truy cập được, nhưng cơ chế rõ từ code + module).

Hạ tầng hệ thống mới đã sẵn sàng để tái dùng:
- `Document` + `DocumentRenderLog` **đã có** cột `caseId` / `incidentId`.
- **document-numbers engine v0.42** (DocumentNumberTemplate/Counter/Log) — cấp số động configurable.
- Engine xuất đơn thư: `DocxMergeService` (gộp N docx), `renderDocumentsAtomic` (render + cấp số + gộp/zip trong 1 transaction), `ExportDocumentsModal` + `SaveSplitButton` (FE tái dùng được).

## Quyết định đã chốt (brainstorming)

| # | Quyết định | Chọn |
|---|-----------|------|
| Q1 | Cách quản lý mẫu | **A — Động (template-manager):** admin upload `.docx` + gán danh mục, thêm/bớt mẫu KHÔNG cần deploy |
| Q2 | Điền biến từ dữ liệu | **A — Auto-map theo danh mục biến chuẩn:** hệ thống công bố placeholder, admin dùng đúng tên → tự điền; kết hợp một ít **biến nhập tay** |
| Q3 | Cấp số văn bản | **C — Tuỳ chọn per-template:** admin bật/tắt "cần cấp số" từng mẫu (Quyết định/Lệnh → cấp số + log; Biên bản nội bộ → không) |
| Q4 | Trigger xuất | **C — Cả hai:** split-button "Lưu và xuất file" lúc tạo + nút **"In chứng từ" độc lập** trên chi tiết (in lại bất kỳ lúc nào) |
| Q5 | Gắn template | **A — Theo `entityType` + `category`:** popup chỉ hiện mẫu đúng thực thể, nhóm theo danh mục |
| Đồng bộ | Áp dụng cho cả 3 module | Đơn thư **giữ 7 mẫu hardcode** (ổn định prod) + **thêm nút "In chứng từ" độc lập**; vụ việc/vụ án dùng engine động mới |
| Biến nhập tay | Xử lý biến ngoài danh mục | Lúc in, biến KHÔNG thuộc danh mục auto → popup form nhỏ điền trước khi render |

## BACKEND

### Bảng mới `DocumentTemplate` (Prisma)
```
model DocumentTemplate {
  id            String   @id @default(cuid())
  code          String   @unique          // mã mẫu (vd QD-KTVA)
  name          String                    // Quyết định khởi tố vụ án
  entityType    String                    // VU_VIEC | VU_AN | DON_THU (catalog/enum)
  category      String                    // Quyết định | Biên bản | Lệnh | Thông báo | Giấy chứng nhận | Khác
  fileBytes     Bytes                     // nội dung .docx (lưu DB → thêm/đổi không deploy)
  fileSha       String                    // SHA256 audit
  fileName      String
  variables     Json                      // [{name, source: 'auto'|'manual', label}] auto-detect khi upload
  needsNumber   Boolean  @default(false)  // Q3 — có cấp số văn bản không
  numberSeriesId String?                  // FK DocumentNumberTemplate (series cấp số) khi needsNumber
  status        String   @default("active")
  sortOrder     Int      @default(0)
  createdById   String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  deletedAt     DateTime?
}
```
- Lưu `.docx` trong DB (Bytes) → admin upload/sửa mẫu runtime, không cần deploy + sống qua các lần deploy. Loader đọc từ DB thay vì disk (khác với 7 mẫu đơn thư đọc từ `templates/docx/`).
- `variables` auto-detect: parse `{tenBien}` trong `.docx` lúc upload, đối chiếu danh mục → đánh dấu `auto` (có trong catalog) hay `manual` (phải nhập tay).

### Danh mục biến chuẩn (placeholder catalog)
- Mở rộng từ 23 biến đơn thư. Định nghĩa **per entityType** trong code (catalog tĩnh, versioned):
  - **VU_AN:** `{soVuAn}, {tenVuAn}, {hoTenBiCan}, {ngaySinhBiCan}, {cccdBiCan}, {diaChiBiCan}, {toiDanh}, {ngayKhoiTo}, {dieuTraVien}, {noiXayRa}, {ngayXayRa}, {donViGiaiQuyet}...`
  - **VU_VIEC:** `{soVuViec}, {tenVuViec}, {nguonTin}, {ngayTiepNhan}, {noiDung}, {dieuTraVien}, {trangThai}...`
  - **DON_THU:** dùng lại 23 biến hiện có.
- Builder `buildEntityPlaceholders(entityType, record, manualValues)` — tổng quát hoá `buildDocxPlaceholders` của đơn thư. Escape token người dùng (chống injection docxtemplater) như hiện tại.

### Render engine (tổng quát hoá engine đơn thư)
- Tổng quát `renderDocumentsAtomic` để nhận `entityType` + `templateId[]` + `manualValues` + `mode`:
  1. Load templates (từ DB) + validate field bắt buộc (per template).
  2. Trong **1 `$transaction`**: với mỗi template → nếu `needsNumber` thì cấp số (document-numbers engine) → render docx (docxtemplater với placeholder catalog + manual) → ghi `DocumentRenderLog` (caseId/incidentId/petitionId + templateSha + generatedNumber).
  3. Gộp (`DocxMergeService`) / zip (buffer in-memory) **trong tx** → lỗi bất kỳ rollback HẾT (không gap số), giống đơn thư.
- Endpoint mới: `POST /cases/:id/export-documents` và `POST /incidents/:id/export-documents` (body `{ templateIds[], mode, manualValues? }`). Đơn thư giữ endpoint cũ.

### Trang quản lý template (admin)
- Module mới `document-templates` (CRUD): list (filter entityType/category/status), upload `.docx` (multipart) → auto-detect biến → form gán entity/category/needsNumber/series/sortOrder. Guard `@RequirePermissions admin` (chỉ admin/cấu hình).
- Endpoint: `GET/POST/PATCH/DELETE /document-templates`, `POST /document-templates/:id/file` (upload), `GET /document-templates/catalog/:entityType` (danh mục biến để admin tham khảo).

## FRONTEND

### Trang admin Template Manager (mới)
- `features/document-templates/` — bảng danh sách + modal upload/sửa (tái dùng pattern TemplateFormModal của document-numbers v0.42). Hiện biến auto/manual sau upload.

### Tích hợp Vụ việc / Vụ án
- **Split-button "Lưu và xuất file"** trên CaseFormPage / IncidentFormPage (tái dùng `SaveSplitButton`).
- **Nút "In chứng từ" độc lập** trên chi tiết vụ việc/vụ án — mở popup bất kỳ lúc nào.
- **Popup** = `ExportDocumentsModal` tổng quát hoá: nhận `entityType` + `entityId`, fetch template theo entity (`GET /document-templates?entityType=VU_AN&status=active`), **nhóm checkbox theo category**, format Gộp/ZIP. Nếu mẫu chọn có biến `manual` → bước phụ điền form trước khi xuất.

### Đồng bộ Đơn thư
- Thêm nút **"In chứng từ" độc lập** trên chi tiết đơn thư (tái dùng `ExportDocumentsModal` hiện có, 7 mẫu hardcode) — KHÔNG đụng engine đơn thư đang chạy prod.

## Phân nhỏ (epic ~4 PR)

| PR | Nội dung |
|----|----------|
| **PR1** | Data model `DocumentTemplate` + migration + module `document-templates` CRUD + upload `.docx` + auto-detect biến + trang admin FE |
| **PR2** | Render engine tổng quát (`renderDocumentsAtomic` nhận entityType + manual) + placeholder catalog vụ việc/vụ án + endpoint export cases/incidents + atomic |
| **PR3** | Tích hợp UI Vụ việc/Vụ án: split-button + nút "In chứng từ" + popup tổng quát (nhóm category, manual-var form) |
| **PR4** | Đồng bộ Đơn thư: nút "In chứng từ" độc lập trên chi tiết |

## Verification
- TDD mỗi task (RED→GREEN→REFACTOR). Unit: parse biến từ .docx, buildEntityPlaceholders, renderDocumentsAtomic (atomic/no-gap/manual), upload+sha, RBAC admin.
- Không hồi quy: đơn thư export hiện tại + 7 mẫu hardcode giữ nguyên (regression test).
- /review + /codex mỗi task; /plan-eng-review mỗi PR; /qa + /uat cuối epic.
- E2E: upload 1 mẫu vụ án thật → mở vụ án → In chứng từ → gộp/zip → mở Word kiểm biến điền đúng + số văn bản.

## NOT in scope (cố ý hoãn)
- Lọc template theo **trạng thái tố tụng** (Q5 option C) — bổ sung sau nếu cần; bản đầu chỉ lọc theo entityType + category.
- **Migrate 7 mẫu đơn thư** sang engine động — giữ hardcode cho ổn định; migrate sau nếu muốn nhất thể hoá.
- Trình soạn thảo template trực tuyến (WYSIWYG) — admin soạn .docx ngoài (Word) rồi upload.
- Xuất PDF / in trực tiếp máy in — vẫn .docx, in từ Word.
- Ký số / đóng dấu điện tử.

## Tái dùng (không build lại)
- `DocxMergeService`, `renderDocumentsAtomic`, `ExportDocumentsModal`, `SaveSplitButton`, `parseBlobError`, `docTypes.ts` pattern (đơn thư v0.68.1.0).
- document-numbers engine v0.42 (`DocumentNumberTemplate`, `commitWithTx`) cho cấp số.
- `Document` / `DocumentRenderLog` đã có `caseId`/`incidentId`.
- Pattern TemplateFormModal (document-numbers) cho UI quản lý template.
