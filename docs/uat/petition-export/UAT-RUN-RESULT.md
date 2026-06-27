# Kết quả thực thi UAT — Popup Xuất chứng từ Đơn thư + Split-button Lưu

**Nhánh:** `feat/petition-export-documents` · **Ngày:** 2026-06-27 · **Môi trường:** local (BE :3000 `THROTTLE_DISABLE=true`, FE :5173)

## Tổng quan

| Layer | Spec | Pass | Fail | Thời gian |
|-------|------|------|------|-----------|
| **API smoke** (Layer 1) | `tests/api/petition-export-uat.api.spec.ts` | **36/36** | 0 | 5.9s |
| **UI E2E Chromium** (Layer 2) | `tests/e2e/petition-export-uat.e2e.spec.ts` | **5/5** | 0 | 13.9s |
| **TỔNG (auto-run)** | | **41/41** | **0** | |

**Bug phát hiện: 0.** Hệ thống đạt toàn bộ TC máy kiểm được.

## Bộ TC nguồn
- `docs/uat/petition-export/uat.json` — **168 TC** (uat-test-writer, self-audit gate PASS: GREEN 14%, RED 40%, SECURITY 10%, BND+EP 15%, A11Y 5%, COMPAT 5%, PERF 3%, P0 30%).
- Excel: `test-results/UAT/uat_petition-export.xlsx` (6 sheet).

## Auto-run (41 TC máy kiểm được)

### API Layer (36) — contract `POST /petitions/:id/export-documents`
- **M3 Merged (11):** mỗi mẫu trong 7 mẫu → 201 docx hợp lệ (PK); 7 mẫu → **đúng 6 ngắt trang + 1 sectPr**; 2 mẫu → 1 ngắt trang; 1 mẫu → 0 ngắt trang; bỏ `mode` → mặc định merged.
- **M4 Zip (3):** 7 mẫu → **7 entry .docx** có số văn bản; 1 mẫu → 1 entry; docType trùng → dedupe 1 entry.
- **M5 Validation (12):** docTypes rỗng/thiếu/sai allowlist/sai kiểu/sai hoa-thường/trộn-sai → **400**; mode `pdf`/`ZIP` → 400; body rỗng → 400; id không tồn tại → **404**.
- **M5 Atomic (3):** thiếu deXuat + PHIEU_DE_XUAT → 400; mẫu cuối thiếu → 400 toàn request; **export fail KHÔNG tiêu số văn bản (no gap: BN chỉ +1)**.
- **M6 Security (7):** không token/token sai/thiếu Bearer → **401**; SQLi trong id → không 500 (404/400); XSS/path-traversal trong docType → 400; GET thay POST → 404/405.

### E2E Layer (5) — luồng UI thật qua DOM (Chromium)
- **M1:** form hiển thị split-button "Lưu đơn thư" + caret; caret mở menu "Lưu đơn thư" / "Lưu và xuất file".
- **M2:** "Lưu và xuất file" → **popup "Xuất chứng từ" với 7 mẫu tick sẵn + radio Gộp mặc định**; "Bỏ chọn tất cả" → [Xuất file] disabled; [Đóng] → đóng popup + về `/petitions`.

## TC còn lại (127) — kiểm thủ công / quan sát (không tự động hoá được)
A11Y screen-reader/contrast/focus-trap, COMPAT cross-browser (Firefox/Safari) + cross-OS (macOS/mobile viewport) + mở file trên MS Word/LibreOffice, PERFORMANCE đo tay (memory/concurrency), một số RED hạ tầng (mất mạng, alg=none JWT, CORS). Đã verify thủ công các điểm chính qua `/qa` (browse Chromium thật): split-button, menu, popup 7 mẫu, format radio, tải file .docx/.zip mở được trên Word.

## Bằng chứng
- Specs: `tests/api/petition-export-uat.api.spec.ts`, `tests/e2e/petition-export-uat.e2e.spec.ts`
- Kết quả JSON: `test-results/petition-export-run/{api,e2e}-results.json` (api expected 36/0, e2e expected 5/0)
- Screenshots `/qa`: `.gstack/qa-reports/screenshots/` (01-landing → 05-export-popup)

**Kết luận: GO** — 41/41 auto-run pass, 0 bug; backend contract + UI flow đều đạt. Sẵn sàng merge/deploy chờ anh duyệt.
