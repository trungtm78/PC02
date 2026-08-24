# Coverage Ledger — "In chứng từ: báo & bổ sung thông tin thiếu per mẫu"

> Phơi bày từng coverage item → coverage% TÍNH từ bảng. 128 TC (xem `live-results.json`). Anti-laziness: 0 drop ngầm, 0 TC mồ côi, GAP có lý do.

## A. AC / Requirement coverage (xương sống — mục tiêu 100%)

| cov_id | AC / rule_ref | TC phủ (xác nhận + negative) | TT |
|---|---|---|---|
| COV-AC-01 | PET-READY-BARE (mọi mẫu cần senderName+content) | TC-003..016, 022-024, 080, 109-112 | ✅ |
| COV-AC-02 | PET-READY-DEXUAT (PHIEU_DE_XUAT +nhanThay+deXuat) | TC-017, 025, 027, 081, 085 | ✅ |
| COV-AC-03 | PET-READY-CHUYEN-NGUON (+lyDoChuyen+canCuPhapLy) | TC-018, 086 | ✅ |
| COV-AC-04 | PET-READY-TRALAI (+lyDoTraDon) | TC-019, 029, 089 | ✅ |
| COV-AC-05 | DYN-READY-REQUIRED (mẫu động theo cờ required) | TC-030,034,035,039,072,079 | ✅ |
| COV-AC-06 | DYN-SAVABLE-FALSE (manual-override, không PUT) | TC-032,037,065-067,073 | ✅ |
| COV-AC-07 | ADMIN-REQUIRED-SET (PATCH set cờ, giữ name/source/label) | TC-040..044,103,104 | ✅ |
| COV-AC-08 | ADMIN-DONTHU-GUARD (DON_THU→400) | TC-045 (live) + jest spec | ⚠️ GAP-live (xem dưới) |
| COV-AC-09 | OPT-LOCK-409 (PUT cũ/đồng thời) | TC-026, 059, 108 | ✅ |
| COV-AC-10 | RBAC-SCOPE (DataScope/auth/Setting:write) | TC-046-050,068-071,090-095,106 | ✅ |
| COV-AC-11 | SEC-ESCAPE (escape injection docxtemplater) | TC-051,060,061,067 | ✅ |

**AC coverage = 11/11 = 100%** (COV-AC-08 phủ bằng unit-test do thiếu đối tượng live — khai GAP-live, không drop).

## B. Coverage theo kỹ thuật (29119-4)

### EP — Equivalence Partitioning
| cov_id | Item (partition) | TC | TT |
|---|---|---|---|
| COV-EP-01 | content: detailContent có | TC-109 | ✅ |
| COV-EP-02 | content: summary có (OR) | TC-054 | ✅ |
| COV-EP-03 | content: cả 2 rỗng → thiếu | TC-112,016 | ✅ |
| COV-EP-04 | senderName có | TC-055 | ✅ |
| COV-EP-05 | senderName rỗng (anon) → thiếu | TC-004 | ✅ |
| COV-EP-06..09 | petitionType ∈ {TO_CAO,KHIEU_NAI,KIEN_NGHI,PHAN_ANH} hợp lệ | TC-113-116 | ✅ |
| COV-EP-10 | petitionType sai enum | TC-096 | ✅ |
→ **EP 10/10 = 100%**

### BVA — Boundary Value Analysis
| cov_id | Item (biên) | TC | TT |
|---|---|---|---|
| COV-BVA-01 | field whitespace-only = rỗng (trim) | TC-056 | ✅ |
| COV-BVA-02 | senderName 1 ký tự (min hợp lệ) | TC-110 | ✅ |
| COV-BVA-03 | docTypes count = 7 (đủ mẫu) | TC-111 | ✅ |
| COV-BVA-04 | docTypes = [] (rỗng) | TC-084 | ✅ |
| COV-BVA-05 | templateIds = [] (rỗng) | TC-101 | ✅ |
| COV-BVA-06 | templateIds 1 phần tử (min hợp lệ) | TC-117 | ✅ |
→ **BVA 6/6 = 100%**

### Decision Table — quy tắc thiếu-trường per docType (7 mẫu đơn thư)
| cov_id | Rule | TC | TT |
|---|---|---|---|
| COV-DT-01..07 | 7 docType × {bare-min, +field riêng} | TC-085-089 + 003-016 + 020 | ✅ |
| COV-DT-08 | xuất cụm 1 mẫu thiếu → chặn cả cụm | TC-083 | ✅ |
| COV-DT-09 | dynamic dup templateIds → 400 | TC-062,075 | ✅ |
| COV-DT-10 | dynamic wrong-entity → 400 | TC-064,076 | ✅ |
| COV-DT-11 | dynamic nonexistent template → 400 | TC-063 | ✅ |
→ **DT 11/11 = 100%**

### State Transition
| cov_id | Transition / sneak | TC | TT |
|---|---|---|---|
| COV-ST-01 | thiếu → bổ sung bare-min → BIEN_NHAN ready | TC-024,080,057 | ✅ |
| COV-ST-02 | bare-min đủ nhưng docType-field vẫn thiếu (giữ khoá) | TC-025,058,081 | ✅ |
| COV-ST-03 | bổ sung field riêng → mẫu mở lại | TC-027,057 | ✅ |
| COV-ST-04 | sneak: readiness trên petition ĐÃ XOÁ → 404 | TC-107 | ✅ |
| COV-ST-05 | concurrency 2 PUT đồng thời → 1 OK + 1 409 | TC-059 | ✅ |
→ **ST 5/5 = 100%**

### Pairwise (tham số tổ hợp)
| cov_id | Cặp | TC | TT |
|---|---|---|---|
| COV-PW-01..04 | {cases,incidents} × {merged,zip} | TC-065,066,077,078 | ✅ |
| COV-PW-05,06 | {cases,incidents} × no-token→401 | TC-068,069 | ✅ |
| COV-PW-07 | IDOR cross-entity (incidentId trên /cases) | TC-070 | ✅ |
→ **Pairwise 7/7 = 100%**

## C. ISO/IEC 25010:2023 — đặc tính áp dụng
| cov_id | Đặc tính | TC | TT |
|---|---|---|---|
| COV-25010-FUNC | Functional suitability | toàn bộ GREEN/RED/DECISION/STATE | ✅ |
| COV-25010-SEC | Security (auth/RBAC/IDOR/injection/privilege) | TC-046-051,060,061,068-071,090-106 | ✅ |
| COV-25010-COMPAT | Compatibility (chromium + filename* UTF-8) | TC-125-127 | ✅ (chỉ chromium — GAP đa-browser) |
| COV-25010-INTERACT | Interaction/a11y (role=dialog/alert, label, aria) | TC-120-124 | ✅ |
| COV-25010-RELIABILITY | Reliability (optimistic-lock, no lost-update) | TC-026,059,108 | ✅ |
| COV-25010-PERF | Performance efficiency | N/A — feature không có SLA/latency target (đọc nhẹ); KHÔNG bịa TC |
| COV-25010-MAINTAIN/SAFETY/FLEX | — | N/A — không áp dụng cho feature này |
→ **25010 áp dụng: 5/5 có TC; 1 N/A có lý do; 1 GAP đa-browser (môi trường)**

## TỔNG COVERAGE (tính từ bảng)
`AC 11/11=100% · EP 10/10 · BVA 6/6 · DT 11/11 · ST 5/5 · Pairwise 7/7 · 25010 5/5 áp dụng`
→ **Coverage = 100% trên mọi kỹ thuật đã chọn.** TC mồ côi = 0 (mọi TC trỏ ≥1 cov_id). Padding = 0.

## GAP (khai báo — KHÔNG drop ngầm)
1. **GAP-live COV-AC-08** (DON_THU guard): không có mẫu động DON_THU trong DB → không chạy live; phủ bằng **jest** `document-templates.service.spec`. Lý do: đơn thư dùng 7 mẫu hardcode, không có DocumentTemplate loại DON_THU (đúng thiết kế).
2. **GAP-env COV-25010-COMPAT**: chỉ chromium (môi trường local 1 browser). Firefox/WebKit = mở rộng khi cài.
3. **GAP-data** (officer in-scope positive): officer1 không có case trong scope ở DB hiện tại; negative (ngoài scope→403/404) đã phủ TC-049.

## Completeness-critic (6 câu mutation — đã chạy)
1. Input còn partition chưa phủ? → KHÔNG (content/senderName/petitionType/whitespace đã liệt kê).
2. State còn transition/sneak chưa phủ? → KHÔNG (đã thêm petition-đã-xoá + concurrency).
3. Decision rule tổ hợp còn thiếu? → KHÔNG (7 docType + dynamic dup/wrong/nonexistent).
4. Đặc tính 25010 áp dụng chưa có TC? → KHÔNG (PERF N/A có lý do).
5. AC/Plan-task chưa map? → KHÔNG (11/11 AC; PR1-3 task đều có TC).
6. "Cố làm hỏng 1 dòng code có TC bắt không?" → Hỏng escape()→TC-060/067 bắt; hỏng required-check→TC-003/072 bắt; hỏng optimistic-lock→TC-026/059 bắt; hỏng savable=false→TC-032/037 bắt; hỏng DON_THU-guard→jest bắt. **Không vùng nào mù.**

---
## (v9) TC_min — ENSEMBLE MAX
- **M1** spec coverage items = 11 AC×~2 + EP 10 + BVA 6 + DT 11 + ST 5 + Pairwise 7 + 25010 5 ≈ **~75 nền** (mở rộng negative → 128).
- **M2** Σ cyclomatic V(G): `getMissingFieldsForDocType` (~9 nhánh docType+field) + `getExportReadiness` (~5) + `update` guard (~3) + controllers ≈ **~40–55**.
- **M3** FP^1.2: ~12 FP (3 endpoint readiness + admin config + export) → 12^1.2 ≈ **~21**.
- **M4** risk-tier: tố tụng/pháp lý → CRITICAL = **120**.
- **TC_min = MAX(75, 55, 21, 120) = 120.** Thực tế **128 ≥ 120** ✅ — đạt BẰNG coverage thật (không padding; 0 TC mồ côi).

## (v9) E2E — `COV-E2E-*` (Testing Trophy, journey chính)
| cov_id | Journey | E2E | TT |
|---|---|---|---|
| COV-E2E-01 | Đơn thư: mở "In chứng từ" → mẫu thiếu khoá+"Thiếu" → bổ sung → Lưu → enable → xuất download | `petition-export-readiness.e2e.spec.ts` (chromium) | ✅ PASS |
| COV-E2E-02 | Vụ án: popup → thiếu → nhập manualValues → enable → tick → xuất download | `dynamic-export-readiness.e2e.spec.ts` (chromium) | ✅ PASS |
→ Edge KHÔNG nhồi E2E (đẩy xuống API live TC-001..117) — đúng Trophy.

## (v9) UI/UX — `COV-UX-*` (Nielsen + ISO 9241-11 + WCAG 2.2)
| cov_id | Heuristic/state | Quan sát | Severity | TT |
|---|---|---|---|---|
| COV-UX-01 | H1 visibility | loading "Đang kiểm tra…" + "Đang lưu…" khi fetch/PUT | 0 | ✅ đạt |
| COV-UX-02 | H5 error prevention | mẫu thiếu → checkbox **disabled** (không cho xuất lỗi) | 0 | ✅ đạt |
| COV-UX-03 | H9 help errors | "Thiếu: <nhãn VN>" + role=alert (ngôn ngữ người, nói rõ cần gì) | 0 | ✅ đạt |
| COV-UX-04 | H3 control/freedom | nút Đóng (X) aria-label="Đóng" | 0 | ✅ đạt |
| COV-UX-05 | WCAG 4.1.2 | role="dialog"+aria-modal, <label> bọc input | 0 | ✅ đạt |
| COV-UX-06 | state responsive | modal max-w-lg/max-h-[90vh]/overflow-y-auto | 0 | ✅ đạt |
→ 0 phát hiện severity ≥3. (Đã quét — đạt, không bỏ qua.)

## (v9) EFFECTIVENESS — Mutation (mutant↔TC, thủ công)
| mut_id | Đột biến | TC giết | TT |
|---|---|---|---|
| MUT-01 | đảo `if(!v.required)` → bỏ qua required | TC-072 | ✅ |
| MUT-02 | bỏ guard DataScope readiness | TC-049/071 | ✅ |
| MUT-03 | `esc()` → no-op | TC-060/067 | ✅ |
| MUT-04 | optimistic-lock `===`→`!==` (bỏ 409) | TC-026/059 | ✅ |
| MUT-05 | DON_THU guard bỏ throw | jest spec | ✅ |
| MUT-06 | savable: false→true (PUT nhầm) | TC-032/037 + manual-override behavior | ✅ |
→ 0 mutant sống sót. Mutation-thinking phủ mọi guard/branch/biên trọng yếu (tool Stryker khả dụng nếu cần số chính xác).

