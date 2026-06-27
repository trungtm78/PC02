# PR3 — UI xuất chứng từ ĐỘNG cho Vụ việc / Vụ án

**Nhánh:** `feat/vu-viec-vu-an-export-documents` (tiếp PR1+PR2 đã DONE).
**Mục tiêu:** thêm UI cho cán bộ chọn mẫu chứng từ động (admin đã upload ở PR1) và xuất file (gộp/zip) cho Vụ án (Case, entityType `VU_AN`) và Vụ việc (Incident, entityType `VU_VIEC`). Backend PR2 đã sẵn sàng: `POST /cases/:id/export-documents` + `POST /incidents/:id/export-documents` nhận `{ templateIds, mode, manualValues }`, trả blob (docx merged / zip) với `content-disposition` filename.

## Quyết định brainstorm áp dụng (đã chốt)
- **Q4 — cả 2 trigger:** (a) split-button **"Lưu + Lưu và xuất file"** (tái dùng `SaveSplitButton`), (b) nút **"In chứng từ"** độc lập (chỉ hiện edit mode — record đã có id).
- **Q5 — modal theo entityType+category:** modal fetch template active theo entityType, **nhóm theo `category`**, mặc định tick hết, chọn định dạng merged/zip.
- **Q2 — biến nhập tay:** modal gom union các biến `source === 'manual'` của các template đang chọn → render input → gửi `manualValues`.

## Khác biệt so với đơn thư (v0.68.1.0)
| | Đơn thư | Vụ việc/Vụ án (PR3) |
|---|---|---|
| Nguồn mẫu | 7 `DOC_TYPES` hardcode | DB động, `listTemplates({entityType})` |
| Payload | `{docTypes, mode}` | `{templateIds, mode, manualValues}` |
| Modal | list phẳng | nhóm theo category + form biến manual |

## Tasks (TDD mỗi task; /review + /codex sau mỗi task)

### T1 — FE export API + helper tải blob
- File mới `frontend/src/features/document-templates/export.api.ts`:
  - `exportEntityDocuments(entity: 'cases'|'incidents', id, body: {templateIds, mode, manualValues?}) => Promise<AxiosResponse<Blob>>` (axios `responseType: 'blob'`).
  - `triggerDownload(response)`: parse `content-disposition` filename (fallback `ChungTu.docx`/`.zip` theo mode) + tạo `<a>` click + revoke URL. (Tách để test thuần.)
- Test `__tests__/export.api.test.ts`: mock `api.post`, assert URL/body/responseType; test parse filename header.

### T2 — DynamicExportDocumentsModal (component tổng quát, tái dùng)
- File mới `frontend/src/features/document-templates/components/DynamicExportDocumentsModal.tsx`:
  - Props: `{ entity: 'cases'|'incidents'; entityType: 'VU_AN'|'VU_VIEC'; entityId: string; onClose: () => void }`.
  - mount: `listTemplates({entityType, status:'active'})` → state templates; group theo `category`; mặc định select tất cả id.
  - UI: nhóm category (heading + checkbox list), "Chọn/Bỏ tất cả", radio merged/zip, **section biến nhập tay** (union variables manual của template đang chọn, input controlled), nút "Xuất file", lỗi qua `parseBlobError`+`extractApiError` (đọc lại từ petitions hoặc tự xử lý blob JSON).
  - submit: gọi `exportEntityDocuments` + `triggerDownload`, đóng modal khi xong.
  - testid: `dynamic-export-modal`, `dyn-export-checkbox-<id>`, `dyn-export-mode-merged|zip`, `dyn-export-confirm`, `dyn-manual-<name>`, `dyn-export-error`.
- Test `__tests__/DynamicExportDocumentsModal.test.tsx`: render với mock listTemplates → hiện nhóm category + checkbox tick sẵn; chọn template có biến manual → input hiện; click Xuất → gọi api.post đúng templateIds/mode/manualValues; empty templates → thông báo "Chưa có mẫu".

### T3 — Wire CaseFormPage (VU_AN)
- Thay nút "Lưu hồ sơ" (`btn-save`) bằng `SaveSplitButton` (label "Lưu hồ sơ").
- State `intent: 'save'|'saveAndExport'` + `exportForId: string|null`.
- `handleConfirmSave` capture id từ `res.data.data.id` (create) hoặc `id` (edit); nếu intent saveAndExport → set `exportForId` (KHÔNG navigate, KHÔNG alert điều hướng) → mở modal; modal `onClose` → navigate(safeReturn).
- Edit mode: thêm nút **"In chứng từ"** (`btn-print-docs`) cạnh Lưu → mở modal trực tiếp với `entityId=id` (không cần lưu lại).
- Pre-save summary modal: giữ nguyên gate; intent được nhớ qua state để `handleConfirmSave` xử lý đúng.
- Test cập nhật/ thêm: render edit mode → có `btn-print-docs`; mở modal.

### T4 — Wire IncidentFormPage (VU_VIEC)
- Thay nút submit cuối form + nút "Lưu vụ việc" top bằng `SaveSplitButton` (giữ form submit cho Enter? — đổi nút submit thành type=button gọi handler; giữ `<form onSubmit>` cho Enter key → submit = intent 'save').
- `handleSubmit(intent)` capture `res.data.data.id` (create) / `id` (edit); intent saveAndExport → mở modal thay vì navigate.
- Edit mode: nút **"In chứng từ"** độc lập.
- Test cập nhật: edit mode có nút In chứng từ; mở modal.

## Verify
- Mỗi task: `cd frontend && npx vitest run --no-coverage <file>` xanh.
- Cuối: `cd frontend && npm run build` (tsc -b thật) + full `npx vitest run --no-coverage` xanh.
- /review + /codex review sau mỗi task; fix tận gốc.

## Không làm trong PR3
- PR4: nút "In chứng từ" độc lập trên chi tiết Đơn thư (đồng bộ) — tách riêng.
- Không đụng engine đơn thư prod.
