# UAT LIVE REPORT — "In chứng từ: báo & bổ sung thông tin thiếu per mẫu"

**Phạm vi:** Đơn thư (Petition) + Vụ việc (Incident/VU_VIEC) + Vụ án (Case/VU_AN) + Admin cấu hình biến bắt buộc.
**Cách chạy:** LIVE trên local API (`http://127.0.0.1:3000`, DB `pc02_db` thật) — KHÔNG mock module nội bộ. + 2 E2E browser (chromium).
**Ngày:** 2026-06-28. **Runner:** [`live-runner.mjs`](live-runner.mjs) → [`live-results.json`](live-results.json).

## Kết quả tổng

| | Số TC | PASS | FAIL | GAP |
|---|---|---|---|---|
| **Tổng (live)** | **128** | **126** | **0** | **2** |

→ **0 bug.** Feature đã deploy + prod-verified (PR #175/#176/#177); UAT live local xác nhận lại toàn bộ hành vi.

## Self-Audit Gate (Bước 10) — honest

| Checkpoint | Ngưỡng | Thực tế | Đạt? |
|---|---|---|---|
| Tổng TC ≥ 100 (HARD FLOOR) | ≥100 | 128 | ✅ |
| 0 FAIL | — | 0 FAIL | ✅ |
| Mọi TC có oracle_type + rule_ref | 100% | 100% (ground vào code) | ✅ |
| 0 mock module nội bộ | 0 | 0 (API+DB thật) | ✅ |
| 0 assert tautology | 0 | 0 | ✅ |
| GREEN ≤ 20% | ≤20% | 16% | ✅ |
| SECURITY ≥ 10% | ≥10% | 11% | ✅ |
| P0 30–50% | 30–50% | 48% | ✅ |
| **RED ≥ 40%** | ≥40% | **33%** | ⚠️ (xem ghi chú) |
| **BOUNDARY+EP ≥ 15%** | ≥15% | **10%** | ⚠️ |
| **A11Y ≥ 5%** | ≥5% | **4%** | ⚠️ |
| **COMPAT ≥ 5%** | ≥5% | **2%** | ⚠️ |

**Ghi chú 4 ratio dưới ngưỡng (minh bạch, KHÔNG padding):** đây là cổng **readiness read-heavy** (chủ yếu GET + tính toán), bề mặt negative/UI hữu hạn. Đã bổ sung batch-4 RED/boundary THẬT (RED 23%→33%, BOUNDARY+EP 4%→10%); ép thêm cho đủ ratio sẽ phải tạo TC tautology — vi phạm chính nguyên tắc v8 (*evidence > ratio-gaming, không fake*). A11Y/COMPAT bị "pha loãng" do tổng tăng (số tuyệt đối A11Y=5, COMPAT=3 vẫn nguyên), được phủ bằng 2 E2E browser thật + component code-grounded (role=dialog/alert, label, aria-label). COMPAT chỉ chromium do môi trường local chỉ cài chromium.

## 2 GAP (honest — KHÔNG giả PASS)

1. **TC DON_THU guard (live):** không có mẫu chứng từ ĐỘNG loại DON_THU trong DB (đúng thiết kế — đơn thư dùng 7 mẫu hardcode). Guard `DON_THU + requiredVariables → 400` đã được **unit-test** (jest `document-templates.service.spec`). Không chạy live được vì thiếu đối tượng.
2. **TC officer in-scope (positive):** officer1 không có case nào trong scope ở DB hiện tại → không test được nhánh "in-scope → 200". Nhánh **negative** (ngoài scope → 403/404) đã PASS (TC RBAC).

## Oracle (rule_ref) — ground vào code thật, không "status 200" trần

| rule_ref | Quy tắc nghiệp vụ | Neo code |
|---|---|---|
| PET-READY-BARE | Mọi mẫu đơn thư cần senderName + (detailContent\|summary) | `document-export.service.ts:76-77` |
| PET-READY-DEXUAT | PHIEU_DE_XUAT cần +nhanThay +deXuat | `:80-82` |
| PET-READY-CHUYEN-NGUON | PHIEU_CHUYEN_NGUON_TIN cần +lyDoChuyen +canCuPhapLy (Mẫu 03 TT128/2025) | `:84-86` |
| PET-READY-TRALAI | THONG_BAO_TRA_LAI cần +lyDoTraDon | `:94-95` |
| DYN-READY-REQUIRED | Mẫu động: biến `required` & auto rỗng=thiếu / manual-required=luôn | `dynamic-export.service.getExportReadiness` |
| DYN-SAVABLE-FALSE | Mẫu động: missing.savable luôn=false (manual-override, không PUT) | `getExportReadiness` |
| ADMIN-REQUIRED-SET | PATCH requiredVariables set cờ required, giữ name/source/label | `document-templates.service.update` |
| ADMIN-DONTHU-GUARD | DON_THU + requiredVariables → 400 | `document-templates.service.ts:107` |
| OPT-LOCK-409 | PUT sai/cũ expectedUpdatedAt → 409; concurrency 2 PUT → 1 OK + 1 409 | optimistic-lock |
| RBAC-SCOPE | readiness/export theo DataScope; ngoài scope→403/404; no token→401; Setting:write cho PATCH | controllers |
| SEC-ESCAPE | Escape `{}<>` (docxtemplater) chống injection; payload XSS/SQLi → DB nguyên | `entity-placeholders.esc()` |

## Điểm xác nhận nổi bật (live)

- ✅ Đơn thư: 7 mẫu đều báo thiếu đúng trường theo từng loại; bổ sung từng phần → mẫu mở lại đúng thứ tự (bare-min → docType-specific); xuất chặn cụm khi 1 mẫu thiếu.
- ✅ Vụ án/Vụ việc: readiness theo cờ `required` (seed), savable=false; manualValues bổ sung → xuất merged + zip 2xx; validation dup/wrong-entity/nonexistent → 400.
- ✅ Admin: PATCH requiredVariables set cờ đúng + giữ name/source/label; DON_THU guard; officer (cả 2) → 403.
- ✅ Optimistic-lock: PUT cũ → 409; **2 PUT đồng thời → đúng 1 OK + 1 409** (no lost-update).
- ✅ Security: no-token→401; ngoài scope→403/404; IDOR cross-entity→404; payload XSS/SQLi/docxtemplater → escape, xuất 2xx, DB còn nguyên.

## Deliverables

- [`uat_in-chung-tu-readiness.md`](uat_in-chung-tu-readiness.md) — 128 TC chi tiết (Markdown cho Claude Code fix).
- [`uat_in-chung-tu-readiness.xlsx`](uat_in-chung-tu-readiness.xlsx) — 6 sheet (Summary/Test Cases/Test Data/Data Matrix/Bug Tracker/Regression Log).
- [`live-runner.mjs`](live-runner.mjs) + [`live-results.json`](live-results.json) — runner chạy lại được + kết quả thô.
- 2 E2E browser: `tests/e2e/petition-export-readiness.e2e.spec.ts`, `tests/e2e/dynamic-export-readiness.e2e.spec.ts`.
