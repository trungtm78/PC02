# GSTACK SHARED CONTEXT
> File nay la trung tam giao tiep giua tat ca terminals.
> Moi terminal poll file nay. Khong ai duoc xoa noi dung cu - chi append hoac update dung field.

---

## PROJECT
```
name:    Quản lý Chỉ tiêu Cứng Công tác Điều tra
goal:    Xây dựng module KPI tracking 4 chỉ tiêu cứng (TT28/2020/TT-BCA + BLTTHS 2015)
         KPI-1: 100% thụ lý tố giác/tin báo/kiến nghị khởi tố
         KPI-2: >90% giải quyết tố giác/tin báo/kiến nghị khởi tố
         KPI-3: >80% điều tra khám phá án các loại
         KPI-4: >95% khám phá án rất nghiêm trọng + đặc biệt nghiêm trọng
status:  PLANNING
```

---

## PLAN APPROVAL
```
plan_written:    true
codex_approved:  false
codex_score:     -
codex_loops:     0
plan_approved:   true
approved_by:     Human
approved_at:     2026-04-20 (current session)
```

---

## ARCHITECTURE NOTES
```
Existing models to extend:
  - Case: thêm field `severity` enum (IT_NGHIEM_TRONG | NGHIEM_TRONG | RAT_NGHIEM_TRONG | DAC_BIET_NGHIEM_TRONG)
  - Incident: đã có đủ status để tính KPI-1 và KPI-2

New Prisma model: KpiPeriod (lưu target theo năm/kỳ/đơn vị)

New backend module: src/kpi/
  - kpi.module.ts
  - kpi.service.ts         (tính toán 4 chỉ tiêu)
  - kpi.controller.ts      (REST endpoints)
  - dto/query-kpi.dto.ts

New frontend feature: src/features/kpi/
  - KpiDashboardPage.tsx   (bảng điều khiển 4 chỉ tiêu)
  - KpiDetailPage.tsx      (drill-down theo kỳ/đơn vị)
  - components/KpiCard.tsx (card hiển thị 1 chỉ tiêu)
  - components/KpiTrend.tsx (biểu đồ xu hướng)

KPI Calculation Logic:
  KPI-1 = (Số vụ đã thụ lý / Tổng số tiếp nhận) × 100  [target: 100%]
          Thụ lý = status != TIEP_NHAN (đã chuyển khỏi giai đoạn tiếp nhận)

  KPI-2 = (Số vụ đã giải quyết / Tổng số thụ lý) × 100  [target: >90%]
          Giải quyết = terminal statuses: DA_GIAI_QUYET, DA_CHUYEN_VU_AN,
          KHONG_KHOI_TO, CHUYEN_XPHC, DA_CHUYEN_DON_VI, PHAN_LOAI_DAN_SU

  KPI-3 = (Số vụ án khám phá / Tổng số vụ án điều tra) × 100  [target: >80%]
          Khám phá = Case.status IN [DA_KET_LUAN, DANG_TRUY_TO, DANG_XET_XU, DA_LUU_TRU]

  KPI-4 = (Số vụ án rất/đặc biệt nghiêm trọng đã khám phá / Tổng số) × 100  [target: >95%]
          Filter: Case.severity IN [RAT_NGHIEM_TRONG, DAC_BIET_NGHIEM_TRONG]
```

---

## TASKS

| ID     | Description                                                                 | Type | Priority | Owner          | Status | Codex | Updated    |
|--------|-----------------------------------------------------------------------------|------|----------|----------------|--------|-------|------------|
| UT-001 | KpiService.calculateKpi1 - tính đúng tỷ lệ 100% khi tất cả đã thụ lý     | UT   | HIGH     | T2_IMPLEMENTER | DONE   | FAIL  | 2026-04-20 |
| UT-002 | KpiService.calculateKpi1 - trả <100% khi có vụ chưa thụ lý               | UT   | HIGH     | T2_IMPLEMENTER | TODO   | -     | 2026-04-20 |
| UT-003 | KpiService.calculateKpi2 - tính đúng tỷ lệ giải quyết (>90%)             | UT   | HIGH     | T2_IMPLEMENTER | TODO   | -     | 2026-04-20 |
| UT-004 | KpiService.calculateKpi2 - đúng danh sách terminal statuses giải quyết    | UT   | HIGH     | T2_IMPLEMENTER | TODO   | -     | 2026-04-20 |
| UT-005 | KpiService.calculateKpi3 - tính tỷ lệ khám phá án (>80%)                 | UT   | HIGH     | T2_IMPLEMENTER | TODO   | -     | 2026-04-20 |
| UT-006 | KpiService.calculateKpi3 - Case.status filter đúng các trạng thái khám phá| UT   | HIGH     | T2_IMPLEMENTER | TODO   | -     | 2026-04-20 |
| UT-007 | KpiService.calculateKpi4 - tính tỷ lệ án rất/đặc biệt nghiêm trọng >95% | UT   | HIGH     | T2_IMPLEMENTER | TODO   | -     | 2026-04-20 |
| UT-008 | KpiService.calculateKpi4 - chỉ lọc severity RAT_NT + DAC_BIET_NT         | UT   | HIGH     | T2_IMPLEMENTER | TODO   | -     | 2026-04-20 |
| UT-009 | KpiService.getKpiSummary - trả đủ 4 KPI với status PASS/FAIL/WARNING     | UT   | HIGH     | T2_IMPLEMENTER | TODO   | -     | 2026-04-20 |
| UT-010 | KpiService.getKpiSummary - filter đúng theo period (year/quarter/month)   | UT   | MEDIUM   | T2_IMPLEMENTER | TODO   | -     | 2026-04-20 |
| UT-011 | KpiService.getKpiTrend - trả 12 tháng xu hướng cho từng KPI              | UT   | MEDIUM   | T2_IMPLEMENTER | TODO   | -     | 2026-04-20 |
| UT-012 | KpiService.getKpiSummary - scope filter theo unitId/teamId                | UT   | MEDIUM   | T2_IMPLEMENTER | TODO   | -     | 2026-04-20 |
| UT-013 | KpiController.getKpiSummary - 200 + đúng shape response                  | UT   | HIGH     | T2_IMPLEMENTER | TODO   | -     | 2026-04-20 |
| UT-014 | KpiController.getKpiDashboard - 200 + có 4 cards + trend data            | UT   | HIGH     | T2_IMPLEMENTER | TODO   | -     | 2026-04-20 |
| UT-015 | Case severity enum - Prisma migration thêm field severity                 | UT   | HIGH     | T2_IMPLEMENTER | TODO   | -     | 2026-04-20 |
| UT-016 | Case severity - CreateCaseDto validate enum values hợp lệ                 | UT   | MEDIUM   | T2_IMPLEMENTER | TODO   | -     | 2026-04-20 |
| UT-017 | KpiCard component - hiển thị đúng % và status màu (xanh/đỏ/vàng)        | UT   | MEDIUM   | T2_IMPLEMENTER | TODO   | -     | 2026-04-20 |
| UT-018 | KpiCard component - badge WARNING khi 85%<=val<target                    | UT   | MEDIUM   | T2_IMPLEMENTER | TODO   | -     | 2026-04-20 |
| IT-001 | POST /api/v1/kpi/summary - trả 4 KPI cho năm hiện tại                   | IT   | HIGH     | T2_IMPLEMENTER | TODO   | -     | 2026-04-20 |
| IT-002 | GET /api/v1/kpi/summary?year=2026&period=Q1 - filter theo quý            | IT   | HIGH     | T2_IMPLEMENTER | TODO   | -     | 2026-04-20 |
| IT-003 | GET /api/v1/kpi/dashboard - trả summary + trend cho frontend             | IT   | HIGH     | T2_IMPLEMENTER | TODO   | -     | 2026-04-20 |
| IT-004 | Case severity E2E - tạo Case với severity, lưu đúng DB                  | IT   | HIGH     | T2_IMPLEMENTER | TODO   | -     | 2026-04-20 |
| IT-005 | KPI-1 E2E - tạo incidents → thụ lý → xác nhận calculateKpi1=100%        | IT   | HIGH     | T2_IMPLEMENTER | TODO   | -     | 2026-04-20 |
| IT-006 | KPI-2 E2E - giải quyết ≥90% incidents → xác nhận KPI-2 PASS             | IT   | HIGH     | T2_IMPLEMENTER | TODO   | -     | 2026-04-20 |
| IT-007 | KPI-3 E2E - kết thúc ≥80% cases → xác nhận KPI-3 PASS                  | IT   | HIGH     | T2_IMPLEMENTER | TODO   | -     | 2026-04-20 |
| IT-008 | KPI-4 E2E - án rất/đặc biệt NT ≥95% khám phá → KPI-4 PASS              | IT   | HIGH     | T2_IMPLEMENTER | TODO   | -     | 2026-04-20 |
| IT-009 | Scope filter E2E - KPI theo unitId chỉ tính vụ của đơn vị đó           | IT   | MEDIUM   | T2_IMPLEMENTER | TODO   | -     | 2026-04-20 |
| IT-010 | GET /api/v1/kpi/trend - 12-month trend đúng dữ liệu lịch sử             | IT   | MEDIUM   | T2_IMPLEMENTER | TODO   | -     | 2026-04-20 |
| IT-011 | Frontend KpiDashboardPage - render 4 cards, gọi đúng API                | IT   | MEDIUM   | T2_IMPLEMENTER | TODO   | -     | 2026-04-20 |
| IT-012 | Frontend KpiDetailPage - drill-down theo kỳ, hiển thị trend chart       | IT   | LOW      | T2_IMPLEMENTER | TODO   | -     | 2026-04-20 |

<!--
Status: TODO | IN_PROGRESS | DONE | NEEDS_REVISION | FAILED | BLOCKED
Codex:  -    | PENDING     | PASS | FAIL
-->

---

## BUG TRACKER

| BugID | TaskID | Source     | Description       | Severity | Status | Fixed_by  | Updated    |
|-------|--------|------------|-------------------|----------|--------|-----------|------------|
| B-001 | UT-001 | CODEX      | safePercent(0,0) returns 100 — "no data = 100% PASS" inflates KPI-1 without product justification | HIGH | FIXED | T2_IMPLEMENTER | 2026-04-20 |
| B-002 | UT-001 | CODEX      | UT-001 spec: no assertion on first count call (deletedAt, createdAt, unitId, teamId filters)        | MEDIUM | FIXED | T2_IMPLEMENTER | 2026-04-20 |
| B-003 | UT-001 | CODEX      | UT-001 spec: no rounding test for safePercent (e.g. 1/3 → 33.33)                                  | LOW    | FIXED | T2_IMPLEMENTER | 2026-04-20 |

<!--
Source:   T3_TESTER | CODEX
Severity: CRITICAL | HIGH | MEDIUM | LOW
Status:   OPEN | FIXED | VERIFIED
-->

---

## MESSAGES

| Time           | From           | To             | Message                                                                 |
|----------------|----------------|----------------|-------------------------------------------------------------------------|
| 2026-04-20 T1  | T1_PLANNER     | HUMAN          | Plan ready: 18 UT + 12 IT = 30 tasks. Chờ /approve để bắt đầu.        |
| 2026-04-20 T1  | T1_PLANNER     | T2_IMPLEMENTER | Plan approved. Start all TODO tasks now.                               |
| 2026-04-20 T2  | T2_IMPLEMENTER | T1_PLANNER     | Starting UT-001: KpiService.calculateKpi1 - 100% case.                |
| 2026-04-20 T2  | T2_IMPLEMENTER | T1_PLANNER     | UT-001 done. Please run /codex code UT-001.                           |
| 2026-04-20 T1  | CODEX          | T2_IMPLEMENTER | CODEX \| T2_IMPLEMENTER \| UT-001 FAIL: B-001 [P1] safePercent(0,0)=100 needs product decision; B-002 [P2] filter assertions missing; B-003 [P2] rounding test missing |
| 2026-04-20 T2  | T2_IMPLEMENTER | T1_PLANNER     | B-001,B-002,B-003 fixed. UT-001 revised (12 tests pass). Please re-run /codex code UT-001. |

---

## TERMINAL STATUS
```
T1_PLANNER:     MONITORING | Plan approved, watching progress
T2_IMPLEMENTER: WORKING   | UT-001 DONE, proceeding with TODO tasks
T3_TESTER:      IDLE      | (cho codex gate)
CODEX:          IDLE | (chua chay)
```

---

## CODEX LOG
| Time | Mode | Target | Score | Verdict | Loops | Issues_fixed |
|------|------|--------|-------|---------|-------|--------------|
| -    | -    | -      | -     | -       | -     | -            |

---

## COMPLETION SUMMARY
```
total_tasks:   30
done:          0
failed:        0
bugs_found:    3
bugs_fixed:    3
codex_reviews: 1
coverage:      -
final_status:  PENDING
```
