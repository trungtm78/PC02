# PLAN — Chuẩn hóa Skill UAT đẳng cấp thế giới (DOMAIN-AGNOSTIC, dùng cho MỌI dự án)

> Skill **phổ quát**: cốt lõi là phương pháp kiểm thử world-class + một **Domain Discovery Protocol** tự trích nghiệp vụ của *bất kỳ* dự án nào (pháp lý, fintech, e-commerce, SaaS, y tế…). Nghiệp vụ KHÔNG hardcode — skill tự sinh "Domain Pack" cho từng repo. PC02 (tố tụng hình sự) chỉ là **1 ví dụ điền vào** (Phụ lục A).
> Tổng hợp 4 nhánh research (ISTQB/ISO 29119/25010/IEEE 829 · RST+HTSM+FEW HICCUPPS+SBTM+Risk-Based · BDD/SBE/Screenplay/Trophy/Pact · AI-agent skill + over-mock/oracle pitfalls). Nguồn primary ở cuối.

---

## 0. Triết lý cốt lõi (PHỔ QUÁT — đúng cho mọi domain)

1. **Oracle là QUY TẮC NGUỒN CHÂN LÝ của domain, không phải HTTP 200.** (FEW HICCUPPS — Bolton/Bach: sản phẩm phải nhất quán với **S=Standards/Statutes, C=Claims, P=Purpose, H=History, U=User…**). Mỗi TC khai báo `oracle_type` + `rule_ref`. Không có oracle áp dụng → đánh dấu **oracle gap**, KHÔNG giả vờ pass.
   *Domain quyết định nguồn oracle:* luật/thông tư (pháp lý) · pricing/SLA/hợp đồng (fintech, SaaS) · tồn kho/khuyến mãi (e-commerce) · phác đồ/HL7 (y tế) · RFC/spec (protocol).
2. **Test như user thật = Persona × Journey, LIVE, không mock cái mình sở hữu.** (Screenplay + Testing Trophy "resemble real usage" + over-mock study arXiv 2602.00409). UAT ở **đỉnh** kim tự tháp: ít, giá trị cao, đi trọn vòng đời nghiệp vụ, **API thật + DB seed thật**; chỉ mock biên ngoài (payment/email/3rd-party), mỗi mock phải có lý do.
3. **Generation ≠ Evaluation; bằng chứng trước khi kết luận.** (Anthropic evals + verification-before-completion + TestGen-LLM assured loop). Lớp verify riêng (được phép trả "Unknown"); mutation testing chứng minh test bắt được bug; trace/screenshot làm bằng chứng. Reject rate thật ~25% (Meta) — không hứa "100% dùng được".

---

## 1. Kiến trúc skill (lõi phổ quát + pack sinh theo dự án)

```
uat-test-writer (Q2 — thiết kế case)                uat-test-runner (thực thi 2 lớp)
  ├─ SKILL.md  (<500 dòng, lõi PHỔ QUÁT)              ├─ Lớp API  (smoke gate)
  ├─ reference/  (kiến thức chuẩn — KHÔNG domain)      └─ Lớp E2E  (browser thật, Screenplay)
  │    ├─ techniques.md     (ISTQB/29119-4)
  │    ├─ oracle-catalog.md (FEW HICCUPPS — generic)
  │    ├─ red-patterns.md   (RCRCRC/CRUD/Goldilocks)
  │    ├─ data-builders.md  (Test Data Builder × state machine)
  │    ├─ playwright.md      (fixtures/auth/evidence/agents)
  │    ├─ domain-discovery.md ←★ GIAO THỨC trích nghiệp vụ cho MỌI repo
  │    └─ plan-analysis.md    ←★ phân tích sâu PLAN đang thực thi (nếu có) → cột UAT vào plan
  └─ <generated per-project>  _domain-pack.md + _plan-scope.md   ← skill TỰ SINH, lưu trong repo đích
       (oracle table · personas · journeys · state-map · plan tasks/AC/failure-modes)
```

Skill **không chứa** nghiệp vụ cụ thể. Khi chạy trên 1 repo, **Bước 0 = Domain Discovery** tạo ra `docs/uat/_domain-pack.md` của repo đó rồi mới sinh case. Đổi repo → đổi pack, lõi giữ nguyên.

---

## 2. ★ DOMAIN DISCOVERY PROTOCOL = RESEARCH-driven (tim của tính tái dùng)

**Nguyên tắc:** nghiệp vụ KHÔNG đoán từ code, cũng KHÔNG hardcode — mà **RESEARCH theo từng dự án** (giống cách mình vừa research các framework testing). Quy trình 2 pha: **PHA A research domain (web + refs + chuẩn ngành) → PHA B neo vào code**. Output = Domain Pack có **trích nguồn**.

### Pha A — DOMAIN RESEARCH (mỗi repo một lần, có citation)
Engine research (WebSearch / `deep-research` / tải refs vào `docs/refs/`), 4 bước:
1. **Nhận diện domain của dự án:** đọc README/package/manifest/ngôn ngữ nghiệp vụ trong code → phân loại (pháp lý, fintech, e-commerce, y tế, SaaS, logistics…).
2. **Research nguồn chân lý của domain đó:** luật/thông tư · chuẩn ngành (PCI-DSS, HIPAA, HL7, ISO, GDPR, SLA mẫu) · acceptance norms · "định nghĩa đúng" mà giới chuyên môn công nhận. Ưu tiên nguồn chính thống, **lưu citation + tải bản refs** khi tải được.
3. **Trích rule có thể kiểm chứng:** chuyển nguồn → danh sách rule dạng *"theo <điều/chuẩn>, hệ phải <hành vi đo được>"*.
4. **Domain Authority Brief:** báo cáo có nguồn, là đầu vào cho Pha B. (Nếu domain regulated → đây chính là oracle RAT.)

> Có thể chạy nhiều nhánh research song song (như plan này được tạo). Domain mơ hồ / không tra được nguồn → **đánh dấu giả định + HỎI**, không bịa.

### Pha B — GROUND vào repo (neo research vào code thật) — 6 câu hỏi
| # | Câu hỏi | Neo research (Pha A) vào… | Sinh ra |
|---|---|---|---|
| **D1. Oracle ở đâu?** | rule từ research khớp gì trong code? | constants/business-rule services/validators/comment dẫn điều khoản | **Bảng Oracle** (rule_id → **nguồn research** + **vị trí code** → quy tắc → loại TC) |
| **D2. Ai dùng?** | vai trò chuẩn ngành vs RBAC repo | roles/guards/permission seed | **Personas** (role × quyền × account test) |
| **D3. Vòng đời?** | lifecycle chuẩn ngành vs state machine | status enum + transition map/guard | **State-map** (cạnh hợp lệ + cạnh CẤM) |
| **D4. Luồng giá trị?** | quy trình chuẩn ngành vs route/use-case | service "happy flow", e2e cũ | **Journeys** (chính + alternative + exception) |
| **D5. Dữ liệu?** | entity × state × biên | schema/DTO, factory/seed | **Data Builders** (fluent, theo state) |
| **D6. Ranh giới ngoài?** | tích hợp được phép mock | 3rd-party (payment/email/AI) | **Mock-allowlist** |

**Quy tắc cứng (chống ảo giác + chống hardcode 1 domain):**
- Mỗi oracle có **2 neo**: nguồn research (điều luật/chuẩn) **và** vị trí code thật. Thiếu một trong hai → flag (research-without-code = chưa làm / code-without-research = chưa có oracle).
- Mismatch research↔code (vd luật yêu cầu nhưng code chưa enforce) = **finding giá trị cao** (gap tuân thủ), không phải fail test.
- Domain Pack + Authority Brief lưu **trong repo đích** (versioned, review được); skill không giữ trạng thái domain.

---

## 2b. ★ PLAN GROUNDING (Bước 0.5 — phân tích sâu plan đang thực thi, CÓ ĐIỀU KIỆN)
Khi có plan đang triển khai → UAT **cột vào plan**: detect (`CLAUDE_PLAN_FILE`/`~/.claude/plans`/artifacts `/plan-eng-review`/PR) → deep-read (Context/Tasks/Failure-modes/NOT-in-scope/unresolved) → extract `PLAN-T*`/`PLAN-FM*`/`PLAN-AC*` (mỗi cái bắt buộc có TC) → **cross-check plan-claim vs CODE THẬT** (plan ghi "đã fix" ≠ chắc đã fix) → xuất `_plan-scope.md` + Plan↔UAT coverage matrix. Không có plan → skip. → `references/plan-analysis.md`.

## 3. Quy trình AUTHORING (phổ quát)

**B1. Exploration-grounded:** quét codebase + state-map THẬT (Discovery) trước — chống ảo giác luồng/selector.
**B2. AC-first qua Example Mapping** (Wynne): Rule = AC mined từ Oracle (D1) → Example = TC cụ thể → **Question = chỗ mơ hồ surface ra**, không bịa.
**B3. Three Amigos lens:** mỗi case nhìn 3 góc — Nghiệp vụ (giá trị/oracle) · Kỹ thuật (data thật) · QA (RED/biên/security). Lens QA → RED ≥40%.
**B4. Technique-router theo shape input** (ISTQB/29119-4):
- field miền → **EP + BVA** · status → **State Transition** (cạnh hợp lệ + **cạnh cấm** = RED) · tổ hợp điều kiện → **Decision Table** · luồng → **Use-Case** · nhiều tham số → **Pairwise**.
**B5. Viết Given/When/Then DECLARATIVE bằng ngôn ngữ NGHIỆP VỤ của domain** (không `click #id`). Selector chỉ ở lớp driver → case sống sót khi UI đổi.
**B6. Gắn mỗi case:** `rule_ref` (oracle) · `risk_score = Likelihood(RCRCRC) × Impact(theo domain)` · `priority MoSCoW` · `oracle_type`.

---

## 4. Quy trình RUN (live như user thật — phổ quát)

**Lớp 1 — API smoke (gate, không mock):** spec live + runner chuẩn hoá env (§6).
**Lớp 2 — E2E browser (Screenplay):** **Actor=persona** (storageState/role, git-ignored) · **Task=bước nghiệp vụ** tái dùng · **Question=assert qua DOM** (≥3: URL+visibility+text) · **Interaction** giữ selector cô lập (`getByRole` ưu tiên, cấm `waitForTimeout`).
- **Seed via API, assert via UI**, suffix unique/worker tránh đụng mã tự sinh.
**Bằng chứng:** trace `on-first-retry` + screenshot/video `only-on-failure`; fail → agent **đọc trace** tự chẩn đoán.
**Realism proof:** mutation testing chứng minh suite bắt bug; lint-guard **cấm mock module nội bộ** + cấm assert tautology (`assert true` / assert lại input).

---

## 5. OUTPUT & TRACEABILITY (chuẩn IEEE 829 / ISO 29119-3 — phổ quát)

- **3 tầng:** Test Plan (scope + **features NOT tested** + entry/exit + GO/NO-GO) → Test Design (theo feature + kỹ thuật + coverage target) → Test Case (GWT + preconditions + expected/oracle + `rule_ref`).
- **RTM bắt buộc:** mỗi AC/oracle ↔ ≥1 case; **flag AC chưa phủ** = tiêu chí "đủ" mạnh nhất.
- **Coverage oracle định lượng (29119-4):** % theo từng kỹ thuật (EP mọi partition, BVA mọi biên, State mọi transition hợp lệ) — KHÔNG đếm case theo dòng code.
- **Non-functional checklist ISO 25010:2023 (9 đặc tính — bản mới: thêm Safety, Usability→Interaction Capability, Portability→Flexibility):** mỗi đặc tính ≥1 nhóm case khi áp dụng.
- **Mở rộng dạng acceptance theo ISTQB:** UAT + **OAT** (deploy/health/seed/rollback) + **RAT** (tuân thủ quy định — nếu domain bị regulated) + **CAT** (hợp đồng).
- Giữ Excel 6-sheet, map về artifact 29119.

---

## 6. SIGN-OFF & chuẩn hoá ENV (root-cause "lỗi giả 401" đã gặp — phổ quát)

**Sign-off (DoD gate):** Must(MoSCoW) 100% pass + RTM 0 AC hở + 0 critical + mutation ≥ngưỡng → GO.
**Runner tự lo env:** `THROTTLE_DISABLE` + tự `source .env` (nạp đủ các tên biến account mỗi spec dùng) + `UAT_TOKEN` **fresh per-module** (token hết hạn). 1 lệnh chạy sạch, hết 401-cascade.

---

## 7. MIGRATION PLAN (các PR)

| PR | Nội dung | Phạm vi |
|----|----------|---------|
| **PR-B** | Rewrite `SKILL.md` lean (lõi phổ quát) + `reference/*` (techniques/oracle/red/data-builders/playwright) + **`reference/domain-discovery.md`** | **global skill** |
| **PR-C** | Chuẩn hoá `run-uat-api.sh` (auto env + token fresh) + lint-guard (cấm mock nội bộ / tautology / `waitForTimeout`) | global |
| **PR-D** | Chạy **Domain Discovery trên PC02** → sinh `docs/uat/_domain-pack.md` (ví dụ A) + 1 bộ UAT golden-path **Vụ việc** làm mẫu vàng | repo PC02 |
| **PR-E** | Nhân khuôn sang Vụ án/Đơn thư + cross-cutting; và chạy Discovery thử trên ≥1 repo domain khác để chứng minh tính tái dùng | đa repo |

---

## 8. ACCEPTANCE CRITERIA của việc chuẩn hoá (đo thành công)
- [ ] SKILL.md + reference/ **0 nghiệp vụ hardcode**; mọi domain knowledge đến từ Discovery → `_domain-pack.md` trong repo đích.
- [ ] Chạy Discovery trên **2 domain khác nhau** (vd PC02 pháp lý + 1 repo CRUD/SaaS) đều sinh Domain Pack hợp lệ.
- [ ] **Plan Grounding:** khi có plan đang thực thi → 100% task (T*) & failure-mode của plan có ≥1 TC; cross-check plan-claim vs code; không có plan → skip sạch.
- [ ] Mỗi TC có `oracle_type` + `rule_ref` trỏ nguồn có thật (0 case "status 200" trần trụi).
- [ ] RTM: 100% rule có ≥1 case; AC hở = 0. 0 mock module nội bộ (lint xanh).
- [ ] Mỗi golden-path journey có E2E browser thật, ≥3 DOM assert, có trace.
- [ ] `run-uat-api.sh` 1 lệnh, không còn 401-cascade giả. Mutation chứng minh suite bắt bug.
- [ ] SKILL.md < 500 dòng; reference 1 cấp; `description`/`when_to_use` đủ trigger.

---

## Phụ lục A — Ví dụ điền Domain Pack: PC02 (tố tụng hình sự)
*Minh hoạ Discovery áp cho 1 domain regulated. KHÔNG phải nội dung skill.*
- **D1 Oracle:** BLTTHS Đ.147/148/149 (thời hạn) · TT28/2020/TT-BCA (4 giai đoạn, nguồn tin) · TT119/2021 (biểu mẫu) · KPI 4 chỉ tiêu cứng · transition map 15 trạng thái · DataScope 12 resource · cấp số atomic · auto-petition sync · convert atomic.
- **D2 Personas:** cán bộ tiếp nhận (officer1) · điều tra viên (officer2) · lãnh đạo duyệt (approver1) · admin · đối tượng ngoài scope.
- **D3 State-map:** 15 trạng thái vụ việc/vụ án; cạnh cấm (vd "Tiếp nhận"→"Kết thúc") → RED 422.
- **D4 Journeys:** tiếp nhận nguồn tin→auto-deadline→cấp số→phân công→xác minh→khởi tố/không khởi tố→xuất chứng từ; convert đơn thư→vụ án (toàn vẹn link).
- **D5 Builders:** `aVuViec().nguon(TO_GIAC).giaiDoan(XAC_MINH).sapDaoHan(3)`; data tiếng Việt có dấu, ngày biên.
- **D6 Mock-allowlist:** push/email; KHÔNG mock DB/NestJS nội bộ.

## Phụ lục B — Ví dụ điền cho domain khác (chứng minh tái dùng)
- **E-commerce:** D1 = pricing/khuyến mãi/tồn kho rules; D2 = guest/buyer/seller/admin; D3 = order lifecycle (cart→paid→shipped→refunded), cạnh cấm refund-khi-chưa-paid; D6 mock = payment gateway.
- **SaaS B2B:** D1 = plan/quota/billing SLA; D2 = owner/member/billing-admin; D3 = subscription (trial→active→past_due→canceled); D6 mock = Stripe.
→ Cùng 1 skill, khác Domain Pack.

---

## Nguồn primary (load-bearing)
ISTQB CTFL v4/CTAL-TA (istqb.org, astqb.org) · ISO/IEC/IEEE 29119-3/-4 (iso.org, softwaretestingstandard.org) · ISO/IEC 25010:2023 9 đặc tính (iso.org, iso25000.com, quality.arc42.org) · IEEE 829 · RST/testing-vs-checking/HTSM-SFDIPOT/FEW-HICCUPPS/SBTM-PROOF (satisfice.com, developsense.com) · Risk-Based · RCRCRC (Karen Johnson)/CRUD/Goldilocks · BDD-Gherkin (Dan North, cucumber.io) · Specification-by-Example + Example-Mapping (Adzic, Wynne) · Three Amigos · Screenplay vs POM (serenity-js, martinfowler.com) · Testing Trophy (Kent C. Dodds) · Honeycomb (Spotify) · Pact (docs.pact.io) · Test Data Builder (Nat Pryce) · TMAP CRUD · Anthropic Agent Skills/evals/superpowers verification-before-completion · over-mock arXiv 2602.00409 · TestGen-LLM/Qodo Cover-Agent · ChatTester · ISTQB CT-GenAI CRISP · Playwright docs (fixtures/auth/best-practices/test-agents/MCP).
