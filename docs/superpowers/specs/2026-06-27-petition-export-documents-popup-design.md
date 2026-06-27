# Thiết kế: Popup xuất chứng từ sau khi lưu đơn thư

**Ngày:** 2026-06-27
**Phạm vi:** Module Đơn thư (Petitions) — frontend + backend
**Trạng thái:** Đã chốt thiết kế, chờ lập kế hoạch triển khai

---

## 1. Bối cảnh & vấn đề

Hệ thống ĐÃ có 2 chức năng xuất chứng từ Word cho đơn thư (v0.47):
- **In từng** — `ExportDocumentDropdown` trên trang chi tiết đơn (`GET /petitions/:id/export-document?docType=X`).
- **In đồng loạt** — nút "Xuất Word (N)" trên danh sách, nhiều đơn × 1 mẫu → ZIP (`POST /petitions/export-document-batch`).

Vướng mắc thực tế: trang đơn thư sau khi **Lưu** thì **tự động `navigate("/petitions")`** ([PetitionFormPage.tsx:387](../../../frontend/src/pages/petitions/PetitionFormPage.tsx#L387)) → người dùng bị đẩy ra danh sách, không kịp xuất chứng từ cho đơn vừa lưu. Để in 1 đơn họ phải mở lại đơn đó. Quy trình nghiệp vụ thường là: nhập đơn → lưu → **in ngay nhiều phiếu** cho đơn đó.

## 2. Mục tiêu

Cho phép: **lưu đơn xong → chọn nhiều mẫu chứng từ (mặc định chọn hết) → xuất ra 1 file (mặc định gộp) hoặc ZIP** — ngay trong luồng lưu, không phá vỡ nút "Lưu" hiện tại.

## 3. Yêu cầu chức năng

### 3.1 Nút lưu kiểu split-button (form đơn thư)
Thay nút "Lưu" hiện tại bằng **split button**:
- Phần chính **"Lưu"** → giữ NGUYÊN hành vi cũ (lưu → về danh sách).
- Mũi tên **▼** → menu 2 mục:
  - **Lưu** (= bấm phần chính).
  - **Lưu và xuất file** → lưu xong → mở popup xuất chứng từ.

Áp dụng cho cả nút lưu trên cùng (`btn-save-top`) và nút lưu dưới form (nếu có) — thống nhất 1 component split-button dùng lại.

### 3.2 Popup "Xuất chứng từ" (`ExportDocumentsModal`)
Hiện sau khi "Lưu và xuất file" lưu thành công:
- **Danh sách 7 mẫu**, mỗi mẫu 1 checkbox (label + mô tả ngắn): BIEN_NHAN, PHIEU_DE_XUAT, PHIEU_CHUYEN_NGUON_TIN, PHIEU_CHUYEN_DON, THONG_BAO_CHUYEN, THONG_BAO_HUONG_DAN, THONG_BAO_TRA_LAI.
- **Mặc định tick HẾT 7 mẫu.** Có nút "Chọn tất cả / Bỏ chọn tất cả".
- **Chọn định dạng:**
  - ◉ **Gộp 1 file Word** (mặc định) — tất cả mẫu chọn gộp vào 1 .docx, ngắt trang giữa các mẫu.
  - ○ **Tách – file ZIP** — mỗi mẫu 1 .docx, gói chung ZIP.
- **2 nút:**
  - **[Xuất file]** — gọi backend, tải file về, đóng popup, về danh sách. Disabled khi không chọn mẫu nào hoặc đang xuất.
  - **[Đóng]** — không xuất, đóng popup, về danh sách.

### 3.3 Điều hướng
- Popup chỉ hiện qua "Lưu và xuất file". Bấm "Lưu" thường → KHÔNG popup (như cũ).
- Đóng popup (qua [Xuất file] xong hoặc [Đóng]) → `navigate("/petitions")` (đồng nhất hành vi lưu cũ).
- Việc `navigate` sau "Lưu và xuất file" được **dời** đến khi popup đóng (không navigate ngay sau lưu).

## 4. Thiết kế kỹ thuật

### 4.1 Backend — endpoint mới
`POST /api/v1/petitions/:id/export-documents`
- **Body:** `{ docTypes: string[] (1..7, allowlist), mode: 'merged' | 'zip' }`. `mode` mặc định `'merged'` nếu thiếu.
- **Guard/permission:** như endpoint export hiện tại (`read Petition`, throttle hợp lý). Validate `docTypes` ⊆ DOCUMENT_TYPES (reject 400 nếu rỗng/sai), khử trùng lặp.
- **Render:** tái dùng `PetitionsService.exportDocumentToBuffer(id, docType, scope)` cho từng mẫu (đã có — dùng docxtemplater + PizZip).
- **mode='merged':** gộp N buffer .docx → 1 .docx, ngắt trang giữa các mẫu. Hiện thực qua thao tác OOXML bằng PizZip: lấy `word/document.xml` body của từng file, nối tiếp (chèn `<w:br w:type="page"/>` giữa các phần), tái đóng gói. (Tách thành `DocxMergeService` để test độc lập.)
- **mode='zip':** tái dùng logic gói ZIP của `batch-export.service.ts` (mỗi mẫu 1 entry).
- **Tên file:** `ChungTu_<caseCode|stt>_<YYYYMMDD>.docx` hoặc `.zip` (qua `Content-Disposition`).
- **Streaming:** trả Buffer/stream như endpoint cũ; FE đọc blob.

### 4.2 Frontend
- **Component mới `SaveSplitButton`** (`features/petitions/components/` hoặc `_shared`): props `{ onSave, onSaveAndExport, isSubmitting, label?='Lưu' }`. Render nút chính + caret + menu. Tái dùng pattern dropdown đã có (click-outside, aria).
- **Component mới `ExportDocumentsModal`** (`features/petitions/components/`): props `{ petitionId, onClose }`. 7 checkbox (default all) + radio mode (default merged) + 2 nút. Gọi `POST /petitions/:id/export-documents` `responseType:'blob'`, tải về (pattern như `ExportDocumentDropdown.handleExport`). Xử lý lỗi blob-JSON (tái dùng `parseBlobError` + `extractApiError`).
- **Sửa `PetitionFormPage`:**
  - `handleSubmit` tách phần "lưu" khỏi `navigate` → trả về `savedId` (id sau create/update).
  - Nút lưu → `SaveSplitButton`. `onSave` = lưu rồi `navigate` (cũ). `onSaveAndExport` = lưu, nếu OK thì set state `exportModalForId = savedId` (mở modal) thay vì navigate.
  - Render `ExportDocumentsModal` khi `exportModalForId` set; `onClose` → `navigate("/petitions")`.
  - Tái dùng hằng `DOC_TYPES` (tách ra `features/petitions/docTypes.ts` để dùng chung 3 nơi: dropdown in từng, batch danh sách, modal mới).

### 4.3 Tái dùng & dọn dẹp
- Gom danh sách 7 mẫu về 1 nguồn (hiện đang lặp ở `ExportDocumentDropdown` + `PetitionListPageShell.BATCH_DOC_TYPES`).
- Component `BatchExportModal` mồ côi: đánh giá khi triển khai — gộp/thay bằng `ExportDocumentsModal` nếu phù hợp, hoặc xoá.

## 5. Luồng dữ liệu

```
[Form] bấm ▼ → "Lưu và xuất file"
  → handleSubmit(save-only) → PUT/POST /petitions → savedId
  → mở <ExportDocumentsModal petitionId=savedId>
       chọn mẫu (default all) + mode (default merged)
       [Xuất file] → POST /petitions/:id/export-documents {docTypes, mode}
            BE: render từng docType (exportDocumentToBuffer)
                merged → DocxMergeService.merge(buffers) → 1 .docx
                zip    → zip(buffers) → .zip
            → blob → FE tải về
       → onClose → navigate("/petitions")
```

## 6. Xử lý lỗi
- Form còn lỗi validate → chặn lưu như cũ (popup không mở).
- `docTypes` rỗng → nút [Xuất file] disabled (FE) + 400 (BE phòng thủ).
- Render 1 mẫu lỗi (thiếu trường nghiệp vụ) → BE trả lỗi rõ; FE hiển thị message (tái dùng `extractApiError`). Quyết định: merged/zip — nếu 1 mẫu lỗi thì **fail cả request** (báo mẫu nào lỗi), không xuất file thiếu.
- Mất mạng khi tải → báo lỗi, popup vẫn mở để thử lại.

## 7. Kiểm thử
- **BE unit:** `DocxMergeService` — gộp 2-3 buffer hợp lệ → 1 .docx mở được, đủ số ngắt trang; input rỗng → lỗi. Endpoint: allowlist docTypes, mode default, 1 mẫu lỗi → fail, ZIP có đủ N entry.
- **FE:** `ExportDocumentsModal` — default tick hết + mode merged; toggle chọn/bỏ; [Xuất file] disabled khi bỏ hết; gọi đúng payload. `SaveSplitButton` — bấm chính = onSave, menu = onSaveAndExport. `PetitionFormPage` — "Lưu" thường vẫn navigate; "Lưu và xuất file" mở modal, không navigate cho tới khi đóng.
- **UAT:** TC in-từng cũ + in-đồng-loạt cũ KHÔNG hồi quy; TC mới: lưu-và-xuất gộp 1 file, lưu-và-xuất ZIP.

## 8. Phạm vi (ranh giới)
- **Chỉ Đơn thư.** Không đụng Vụ việc/Vụ án.
- **Giữ nguyên** 2 chức năng cũ (in từng dropdown chi tiết, in đồng loạt danh sách).
- Không đổi định dạng đầu ra hiện có (vẫn .docx Word; không thêm PDF ở phạm vi này).
- Không in trực tiếp ra máy in (vẫn tải file rồi in từ Word).

## 9. Quyết định đã chốt (với người dùng)
1. Nút: **split button** ("Lưu" chính + ▼ menu "Lưu và xuất file"). KHÔNG đổi nút Lưu cũ.
2. Popup: 7 mẫu, **mặc định tick hết**; định dạng **mặc định gộp 1 file Word**, cho chọn ZIP; 2 nút **[Xuất file] [Đóng]**.
3. Sau khi đóng popup → **về danh sách**.
4. Popup chỉ qua "Lưu và xuất file"; lưu thường không popup.
