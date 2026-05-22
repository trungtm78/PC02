# Audit Hypothesis — Threat Model & Focus

**Date:** 2026-05-22
**Author:** Claude Opus 4.7 (Phase 0 inline threat modeling với anh)
**Purpose:** Set ship-block hypothesis trước khi chạy Phase A→G audit. Drive scope cho Phase B (UAT), B' (IDOR matrix + race), C (code review), E (security audit).

---

## Hard constraint (from Q7)

**Launch trong 1-2 tuần. Audit là SHIP-BLOCK GATE.**

P0/P1 findings = block launch. Phase G output phải kết luận GO / NO-GO / GO-WITH-CONDITIONS clear cho cấp trên.

→ Em SHARPEN scope từ "boil the lake" sang "ship-blocker hunting với focus area". Defer non-critical findings sang Tier-2 post-launch sprint.

---

## Threat model summary (từ Q1-Q7)

| Dimension | Answer | Audit implication |
|-----------|--------|-------------------|
| Q1. Prior incidents | All / none specific | Em không bias incident-driven, uniform scan |
| Q2. Crown-jewel data | **Hồ sơ vụ án bí mật** (Documents + Conclusion + Proposal + InvestigationSupplement) | Focus IDOR + scope-filter trên nested resources cha-con Case/Incident |
| Q3. Least-trusted role | **Ward officer** (mới ship v0.35.0.0, bypass logic line 48) | Exhaustive ward officer flow testing, regression cho old roles không thay đổi |
| Q4. Suspicious workflow | **Petition → Case convert** (atomic tx + denormalization) | Trace convertToCase line-by-line, race harness Promise.all([...50]), tx wrapper verify |
| Q5. Compliance pressure | Không có | Skip TT28/BLTTHS/NĐ13 evidence sections, focus pure technical |
| Q6. Real load | Chưa launch | Skip load testing, focus correctness over performance |
| Q7. Timeline | **1-2 tuần, ship-block gate** | Narrow + deep + decisive verdict |

---

## Refined audit priority (drives Phase B-E focus)

### Tier-1 SHIP-BLOCKER (must complete before launch)

**Priority 1: Ward officer flow exhaustive** *(Q3 + Q7)*
- Read full `scope-filter.util.ts` line 48-50 + tất cả ward officer code path
- Test data: seed 2 ward officers ở 2 xã khác nhau + Case/Incident gắn với từng xã
- Scenarios:
  - WO xã A có thấy Case của xã B không? (expect: NO)
  - WO xã A có thấy Case của tổ điều tra (district level) không? (depends on bypass logic intent)
  - WO có promote được role không? (expect: NO)
  - WO bypass `assertParentInScope` ở 12 nested resources?
- File: `backend/src/common/utils/scope-filter.util.ts`, `backend/src/auth/services/unit-scope.service.ts`
- Estimated time: 1.5h

**Priority 2: Crown-jewel IDOR matrix** *(Q2)*
- Scope: 4 nested resources holding hồ sơ bí mật:
  - `Documents` (file uploads via DocumentsController)
  - `Conclusion` (kết luận điều tra)
  - `Proposal` (đề xuất xử lý)
  - `InvestigationSupplement` (bổ sung điều tra)
- Test matrix: 5 users × 4 resources × {GET, GET /:id, PATCH, DELETE, GET attached file blob}
- Scripted via Jest + JWT từ `scripts/audit/fixtures.json`
- Especially: file download — does scope check happen BEFORE serving file blob?
- Estimated time: 1h

**Priority 3: Petition → Case convert race + atomic** *(Q4)*
- Read `petitions.service.ts` line-by-line on `convertToCase` method
- Verify: full Prisma transaction wrapping all mutations, rollback on partial failure
- Race harness: `Promise.all([...20].map(() => svc.convertToCase(petitionId)))` — expect exactly 1 success
- Check denormalization drift: after convert, change Petition status → Case status sync? Both directions?
- File: `backend/src/petitions/petitions.service.ts`, `backend/src/cases/cases.service.ts`
- Estimated time: 1h

**Priority 4: Auth surface hardening** *(implied by ship-block + first user exposure)*
- 2FA TOTP setup flow: replay protection, secret encryption key rotation procedure
- Magic link enrollment: token entropy, single-use enforcement, TTL
- Reset password OTP: rate limit, email enumeration leak
- Account lockout: bypass via varying identifier case/spaces?
- Files: `backend/src/auth/services/{two-fa,otp-code,enrollment,auth}.service.ts`
- Estimated time: 1.5h

### Tier-1 STANDARD (do if time allows, không block launch)

- UAT 15 flows (Phase B) — verify happy path works trên realistic data
- Architecture: madge circular deps + Prisma FK indexes
- /cso comprehensive HOẶC manual OWASP checklist (Windows fallback)
- Infra: CI gaps, deploy safety, monitoring coverage

### Tier-2 DEFER post-launch (don't block ship)

- Load testing (Q6: no real load yet, defer until usage data exists)
- Performance profiling beyond heuristic
- Frontend visual polish / code smell in pages
- Compliance evidence sections (Q5: no pressure)
- Code review of god services beyond the 4 priority files (cases/incidents have implicit coverage via convert flow)
- External pentest (Phase X, anh inquire firms in parallel)

---

## Likely bug classes to actively hunt

Based on threat model + codebase knowledge:

1. **Ward officer scope confusion** — bypass intent might leak Cases up the chain (xã → huyện), or block legitimate access
2. **Document download bypass** — `GET /api/v1/documents/:id/download` may serve file without re-checking parent Case scope
3. **Petition convert race** — 2 dispatchers convert same petition → 2 Cases created, denormalized state inconsistent
4. **2FA setup race** — user starts TOTP setup, gets backup codes, abandons → backup codes leak
5. **Magic link replay** — enrollment link used after expiry, or twice (no single-use enforcement)
6. **Cross-tenant data via shared resources** — Action Plans / VKS Meetings shared across Cases, scope check may use child not parent
7. **Audit log gap** — mutation succeeds but audit_log insert fails silently (no tx wrapper)
8. **Status transition bypass** — direct PATCH /cases/:id with status field skip transition map validation

---

## Stop-the-press rules

If em find any of these during audit, em STOP and tell anh IMMEDIATELY (do not wait for Phase G):

- IDOR confirming cross-tenant data leak (e.g., WO xã A can read Documents of xã B)
- Auth bypass (login without credentials, 2FA bypass, role escalation)
- Audit log gap that hides mutation
- Secret leaked in git history
- Petition convert producing duplicate Cases

---

## Out of scope (explicit)

- Mobile app (anh xác nhận scope = Backend + Frontend Web + Infra)
- Performance under load (Q6: no real users)
- Compliance certification (Q5: no pressure)
- Pentest-grade depth (Phase X external quote in parallel)
- Code quality / refactor opportunities for non-priority files

---

## Time budget (revised post-Phase 0)

| Phase | Original revised | Post-hypothesis |
|-------|------------------|-----------------|
| A. Baseline + A.0-A.7 | 1h 40min | 1h 40min |
| B. UAT 15 flows | 2h | 1h (smoke only, defer deep UAT) |
| **B'. Priority 1+2+3+4 scripted security** | 1h | **5h** (focused depth) |
| C. Code review | 2h | 1h (only 4 priority files) |
| D. Architecture | 45min | 30min (madge + Prisma only) |
| E. /cso or manual | 2h | 1h (Windows fallback likely needed) |
| F. Infra | 45min | 30min |
| Tier-2 G1 | 4h | DEFER post-launch |
| G. Compile + GO/NO-GO verdict | 1h | 1h |
| **Total** | ~11h | **~12h** (more focused, ship-block decisive) |

Realistic wall-clock với parallel agents: **6-8h**.

---

## Success criteria for Phase G output

Report MUST answer 3 questions:

1. **GO / NO-GO / GO-WITH-CONDITIONS?** (one line at top of executive summary)
2. **Nếu GO-WITH-CONDITIONS:** list specific P0/P1 fixes required before launch + ETA
3. **Nếu NO-GO:** explain show-stopper + minimum work to flip to GO

Every P0 finding must have:
- Reproducible exploit step
- File:line evidence
- Effort estimate (S=<4h, M=<1d, L=<3d, XL=>3d)
- Ship-block classification (BLOCK / DEFER)

---

## Next: Phase A — Baseline (em chạy)
