# Kết quả thực thi UAT — Xuất chứng từ động (run 2026-06-28)

## Layer 1 — API smoke (Playwright `tests/api/export-chung-tu-dong-uat.api.spec.ts`)
**41/41 Đạt · 0 Không đạt · 0 Bỏ qua** (5.8s, workers=1, THROTTLE_DISABLE, backend local nhánh feat/vu-viec-vu-an-export-documents @ DB pc02_db:5432).

Phủ (machine-verifiable): upload mẫu + phân loại biến auto/manual (P1-B), cấp số bắt buộc series (P1-A: TC-003/017), validation (entityType/category/file/code trùng→409 P2002), list export-templates (cách ly entity, omit fileBytes, ẩn soft-delete), export render **201 + docx/zip hợp lệ** (merged/zip/cấp-số tuần tự/manualValues/mode-default), RBAC (officer 403 upload/delete/patch/list, 401 no-token, **officer 200 GET export-templates** = P1-fix hoạt động, DataScope export 403), security (template-injection escape, SQLi entityId, manualValues non-string không 500).

Phát hiện khi viết spec: endpoint export trả **201** (NestJS POST default), không phải 200 — đã chỉnh assertion (không phải bug).

## Layer 2 — UI E2E Chromium
**CHƯA chạy run này**: frontend Vite không khởi động được trong cửa sổ (RTK hook wrap `npm run dev` dev-server dài hạn bị treo). KHÔNG bịa kết quả (kỷ luật Skip≠PASS).
Bù đắp coverage UI: 37 test component/integration vitest đã xanh (DynamicExportDocumentsModal, SaveSplitButton, CaseFormPage/IncidentFormPage/PetitionFormPage export wiring, TemplateFormModal numberSeriesId).

## Kết luận
- **Backend contract: GO** (41/41 API + 2469 unit BE).
- **UI: covered by component tests**; cần spot-check E2E thủ công hoặc chạy lại runner với frontend khởi động riêng (không qua RTK).
