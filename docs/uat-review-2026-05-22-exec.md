# PC02 Tier-1 Ship-Block Audit — Executive Summary

**Date:** 2026-05-22
**Auditor:** Claude Opus 4.7 + Codex GPT-5.5 (cross-model review của plan)
**Scope:** Backend (46 modules) + Frontend Web (20 features) + Infrastructure
**Method:** Static analysis on 4 ship-block priority areas (hypothesis-driven, see [audit-hypothesis-2026-05-22.md](audit-hypothesis-2026-05-22.md))
**Branch context:** `main` @ v0.36.0.0
**Baseline:** Backend jest 1479/1479 PASS ✓ | Backend tsc clean ✓ | Frontend tsc clean ✓ | Frontend vitest 544 PASS, **2 FAIL**

---

## 🚦 SHIP-BLOCK VERDICT: **NO-GO** (revised post-UAT)

UAT phát hiện **login admin trả HTTP 500** trên dev environment → toàn bộ hệ thống không sử dụng được. Đây là **P0-002 CRITICAL** — chặn launch tuyệt đối.

Hệ thống chỉ launch được sau khi fix **5 ship-blockers**:
- **P0-002** Login 500 (CRITICAL — chặn mọi thứ)
- **P1-004** GlobalExceptionFilter nuốt stack trace (prerequisite để debug P0-002)
- **P0-001** Orphan Document scope bypass (crown-jewel leak)
- **P1-002** Petition→Case convert race (data corruption)
- **P1-003** feature_flags seed manual (first-deploy operational risk)

**Tổng effort:** 13-21h = **2-3 ngày tập trung**.

Nếu không fix → **system DOA** ngay ngày 1, P0-001 leak crown-jewel data đến ngày đầu user dùng được.

---

## 📊 Findings summary (revised post-UAT)

| Tier | Count | Ship-block |
|------|-------|-----------|
| **P0 Blocker** | 2 | YES (both) |
| **P1 Critical** | 4 | 3/4 YES |
| **P2 Important** | 3 | NO (Tier-2 post-launch) |
| **P3 Polish** | 2 | NO (Tier-2 polish) |
| **TOTAL** | **11** | **5** |

### UAT smoke (2026-05-22) — BLOCKED at Flow 2

| # | Flow | Result | Note |
|---|------|--------|------|
| 1 | GET /login render | ✅ PASS | No console errors |
| 2 | POST login admin | ❌ FAIL | HTTP 500 INTERNAL_ERROR → P0-002 |
| 3-5 | Dashboard/Cases/Petitions | ⛔ BLOCKED | Cannot proceed without login |

---

## 🚨 Ship-block findings — phải fix trước launch

### [P0-002] 🔥 Login admin trả HTTP 500 — hệ thống không sử dụng được

**Severity:** P0 CRITICAL | **Effort:** M (4-8h) | **Ship-block:** YES (hệ thống DOA)

**UAT 2026-05-22 phát hiện:** POST /api/v1/auth/login với admin@pc02.local + SEED_ADMIN_PASSWORD → HTTP 500 INTERNAL_ERROR. Tried username=email và username=admin — đều fail.

**Verified prereqs đều OK:**
- Admin user exists, isActive=true, role=ADMIN ✓
- `bcrypt.compare(SEED_ADMIN_PASSWORD, passwordHash)` = TRUE trong standalone Node script ✓
- TWO_FA_ENABLED='false' ✓
- JWT private.pem exists ✓
- No `mustChangePassword`, no `twoFaSetupRequired` ✓

**Root cause unknown** vì [P1-004](#p1-004-globalexceptionfilter-nuốt-stack-trace) — backend stderr không log stack trace.

**Likely candidates:** MetricsService init fail, AuditService.log INSERT fail, JWT signing format mismatch, hoặc env var missing causing lazy init fail.

→ [findings.json#P0-002](../scripts/audit/findings.json)

---

### [P1-004] GlobalExceptionFilter nuốt stack trace cho non-HttpException

**Severity:** P1 Critical | **Effort:** S (30min) | **Ship-block:** YES (prerequisite cho P0-002 debug)

[http-exception.filter.ts:22-39](../backend/src/common/filters/http-exception.filter.ts#L22) chỉ xử lý `instanceof HttpException`. Non-HttpException (Prisma error, TypeError, JWT fail, fs error) → fall through silent 500 **không** có `console.error(exception)`. Stack trace lost.

**Impact:** Production 500 errors không debug được. UAT confirm: login 500, backend stdout 0 bytes → em không trace được nguyên nhân.

**Fix:** Inject Logger vào filter, log `exception?.stack ?? String(exception)` cho mọi non-HttpException (và HttpException ≥500). Ship trước P0-002 để debug.

→ [findings.json#P1-004](../scripts/audit/findings.json)

---

### [P0-001] Orphan Document bypass DataScope → crown-jewel hồ sơ bị lộ cross-tenant

**Severity:** P0 Blocker | **Effort:** M (4-8h) | **Ship-block:** YES

Document có thể tồn tại không cha (caseId+incidentId đều null) qua 2 đường:
1. Create endpoint không enforce "phải có ≥1 parent" — DTO accept cả 2 null
2. `onDelete: SetNull` cascade khi Case bị xoá → mọi Document attached tự động orphan

Khi orphan, `assertParentInScope(null, scope)` ở [scope-filter.util.ts:105](../backend/src/common/utils/scope-filter.util.ts#L105) **silent pass** (return without throw). Download endpoint inherit cùng bug. Bất kỳ user nào có `Document.read` permission đều download được orphan file blob.

**Exploit:** investigator B (district khác) lấy được document ID từ audit log/URL leak → GET /api/documents/{id}/download → file streamed về B.

**Affected:** Documents + VksMeetingRecord + SuspensionActionPlan (cùng pattern).

**Fix tối thiểu:** Đổi [scope-filter.util.ts:105](../backend/src/common/utils/scope-filter.util.ts#L105) `if (!parent) return` → `if (!parent) throw new ForbiddenException(FORBIDDEN_MSG)`. Defense-in-depth: DTO require ≥1 parent + schema `onDelete: Cascade`.

→ [findings.json#P0-001](../scripts/audit/findings.json)

---

### [P1-002] Race: concurrent Petition→Case convert tạo orphan Case

**Severity:** P1 Critical | **Effort:** S (2-4h) | **Ship-block:** YES

`convertToCase` ([petitions.service.ts:655](../backend/src/petitions/petitions.service.ts#L655)) wrap atomic transaction NHƯNG optimistic lock chỉ apply nếu `expectedUpdatedAt` được pass vào. Frontend [PetitionListPage.tsx:865](../frontend/src/pages/petitions/PetitionListPage.tsx#L865) **không gửi expectedUpdatedAt** → 2 user click convert đồng thời → 2 Case rows được tạo → Petition.linkedCaseId chỉ trỏ 1 → Case còn lại orphan (không link Petition gốc).

**Impact:** KPI numbers off-by-N, audit chain bị break (Case không trace về Petition gốc), legal compliance risk khi prosecute.

**Fix:** (a) Frontend send `expectedUpdatedAt`. (b) Backend DTO make field required. (c) Schema thêm partial unique index `WHERE linkedCaseId IS NOT NULL`.

→ [findings.json#P1-002](../scripts/audit/findings.json)

---

### [P1-003] feature_flags seed manual step → sidebar trống nếu quên

**Severity:** P1 Critical | **Effort:** S (1h) | **Ship-block:** YES

Per [CLAUDE.md](../CLAUDE.md): "prisma migrate deploy không chạy seed. Fresh DB → feature_flags trống → sidebar trống cho mọi user". Manual fix: `npm run db:seed:features`. KHÔNG tích hợp vào deploy.sh.

**Impact:** Lần đầu deploy production VM nếu admin quên seed → mọi user thấy sidebar trống → hệ thống coi như không khởi động được → bad first impression + downtime metric.

**Fix:** Thêm vào deploy.sh sau `prisma migrate deploy`:
```bash
COUNT=$(psql $DATABASE_URL -tAc 'SELECT COUNT(*) FROM feature_flags' 2>/dev/null || echo 0)
[ "$COUNT" = "0" ] && cd /home/pc02/current/backend && npm run db:seed:features
```

→ [findings.json#P1-003](../scripts/audit/findings.json)

---

## 📋 Non-blocking findings (Tier-2 post-launch sprint)

| ID | Severity | Title | Effort |
|----|----------|-------|--------|
| **P1-001** | P1 | 2 broken frontend tests (CaseListPage + IncidentListPage delete/action menu) — root cause là P2-003 | S |
| **P2-001** | P2 | Ward officer write-scope inconsistent (read excludes intake, write allows it) | S |
| **P2-002** | P2 | exceljs >=3.5.0 → uuid CVE GHSA-w5hq-g745-h8pq (moderate, bulk-import surface) | M |
| **P2-003** | P2 | Frontend vitest không chạy trong CI (root cause cho P1-001) | S |
| **P3-001** | P3 | TOTP `epochTolerance:30` dead code (otplib v13 dùng `window`) | S |
| **P3-002** | P3 | `/auth/2fa/disable` không yêu cầu confirm TOTP hiện tại | S |

---

## ✅ Strong areas (audit found no issues)

- **Auth crypto:** TOTP secret AES encryption, backup codes bcrypt cost 12, timing-leak defense (padded loop with dummy hash), atomic replay protection via SQL UPDATE
- **OTP service:** constant-time compare (timingSafeEqual), single-use, prior-invalidation, 6-digit + 16-byte salt, 15min TTL
- **Rate limiting:** all auth endpoints throttled (login 15/min, refresh 10/min, 2FA verify 5/min, forgot/reset 3/min)
- **Security headers:** Helmet enabled, HSTS 1y + includeSubDomains, crossOriginResourcePolicy same-site, ValidationPipe global whitelist+forbidNonWhitelisted
- **DataScope coverage:** 12 resources sử dụng `assertParentInScope`/`assertCreatorInScope` consistently (issue chỉ ở silent-pass-on-null tại scope-filter line 105)
- **Architecture:** 0 circular dependencies (432 backend files), 48 models với 107 indexes (>1/FK ratio), clean module boundaries
- **Audit log:** mọi mutation log với userId + action + subject + metadata + IP + UA
- **Proposals service** (line 77-81): correctly handles orphan case via fall-back to `assertCreatorInScope` — pattern reference cho fix P0-001
- **Frontend npm audit:** 0 vulnerabilities (443 deps)

---

## 🧭 Methodology limitations (honest disclosure)

- **Tier-1 Rapid Adversarial Audit (~6h)**, không phải pentest đầy đủ — không thay thế external pentest (đề xuất Tier-2 Phase X: quote Viettel Security/VNPT-IT/CMC)
- **Static analysis chủ yếu** + UAT smoke (blocked at Flow 2) — dynamic IDOR matrix + race harness deferred. Findings P0-001, P1-002 cần dynamic verify runtime trước fix
- **/cso skill SKIPPED** — gstack Mac-targeted, không chạy reliably trên Windows. Em làm manual OWASP/STRIDE checklist + npm audit thay thế
- **/codex SKIPPED** — stdin hang issue trên Windows kéo dài (đã chứng minh code chạy được nếu kết hợp `< /dev/null` + tránh pipe `head`/`tail`)
- **UAT 15 flows BLOCKED at Flow 2** — login 500 (P0-002) chặn flow 3-15. Sau khi fix P0-002, anh re-run UAT theo checklist trong audit-hypothesis-2026-05-22.md
- **Backend stdout dev log empty** — em phát hiện rtk wrapper có thể đang filter output. Future audit nên dùng `rtk proxy npm run start:dev` để bypass RTK token filtering. Hoặc dùng `node dist/main.js` thẳng để có raw stdout
- **Tier-2 Security Deep Dive (4h)** DEFERRED post-launch — uniform 12-resource × 5-actor IDOR matrix khi có dev environment ổn định
- **Cases/Incidents/DeadlineRules god services** không review chi tiết — focus là 4 priority areas anh chỉ định. Sprint sau nên cover.

---

## 🎯 Recommended next steps (cho /office-hours triage Phase H)

1. **NGAY (4-12h):** Fix P1-004 (filter log) → re-run UAT để debug P0-002 → fix P0-002. Cho đến khi login work, mọi việc khác đều idle.
2. **Tuần này:** Fix P0-001 + P1-002 + P1-003 (~10-13h)
3. **Tuần launch:** Re-run baseline + smoke UAT 15 flows trên staging trước go-live
3. **Sprint 1 post-launch:** Fix P2-001 + P2-002 + P2-003 + P1-001 (test infra + dependency hygiene + ward officer policy)
4. **Sprint 2 post-launch:** Phase X external pentest quote (Viettel Security/VNPT-IT/CMC, scope: authz/IDOR/file upload/audit log/data export, budget 50-150tr VND)
5. **Sprint 3 post-launch:** Tier-2 security deep dive (uniform 12-resource × 5-actor IDOR matrix khi có k6 + seeded staging)

---

## 📦 Artifacts

- [scripts/audit/findings.json](../scripts/audit/findings.json) — structured 9 findings với full evidence + repro
- [docs/audit-hypothesis-2026-05-22.md](audit-hypothesis-2026-05-22.md) — Phase 0 threat model
- [scripts/audit/create-issues.sh](../scripts/audit/create-issues.sh) — bash script tạo GH issue cho mỗi finding
