# RTM — PC02 Case Management System
Path: docs/specs/rtm.md | Version: v1.2.0
Updated: 2026-02-26 | Tasks: TASK-2026-000004, TASK-2026-260202

| Requirement ID | Description | AC Mapping | Test Scenario | Status | Evidence |
|----------------|-------------|------------|---------------|--------|----------|
| REQ-UI-01 | Đồng bộ Government Theme (Navy/Gold) | AC-01 | UAT-SC-01, UAT-05 | DONE | index.css (--primary:#003973, --accent:#F59E0B), LoginPage.tsx gradient, sidebar Navy bg verified by E2E |
| REQ-UI-02 | Sử dụng Logo PNG chính quy | AC-02 | UAT-SC-01 | DONE | logo-cong-an.png (177KB), LoginPage.tsx line 83 img[data-testid="login-logo"], login-step01-visual.png |
| REQ-BUS-01 | Danh sách vụ án PC02 | AC-05 | UAT-SC-03 | OPEN |
| REQ-BUS-02 | Form 10 tabs nghiệp vụ | AC-06 | UAT-SC-03 | OPEN |
| REQ-BUS-03 | Quản lý đối tượng (Bị can/Bị hại) | AC-07 | UAT-SC-03 | OPEN |
| REQ-BUS-04 | Quản lý vật chứng | AC-08 | UAT-SC-03 | OPEN |
| REQ-BUS-05 | Tài liệu Media (Audio/Video) | AC-09 | UAT-SC-04 | OPEN |
| REQ-UI-03 | Sidebar đa cấp (Remake toàn bộ menu) | AC-03 | UAT-SC-02, AC-01 Sidebar tests | DONE | AppSidebar.tsx 591L, 7 sections, ~30 items, sidebar-step01-expanded.png, sidebar-step02-compact.png |
| REQ-UI-04 | Route mapping (~30 routes) | AC-04 | AC-02 Coming Soon tests | DONE | App.tsx 104L, 3 real + ~27 CS(), 5 Coming Soon E2E tests pass |
| REQ-UI-05 | Chuyển hướng "Coming Soon" cho mục chưa làm | AC-04 | UAT-SC-02, AC-02 Coming Soon | DONE | ComingSoonPage.tsx 251L, 27 moduleMap entries, 5 E2E + 3 UAT tests pass |
| REQ-UI-06 | Vietnamese labels 100% | AC-05 | UAT-05, all visual tests | DONE | All labels in LoginPage, AppSidebar, ComingSoonPage in Vietnamese |

## TASK-2026-260202 — Quản lý Đơn thư (Petition Management)
EXECUTION_ID: INTAKE-20260226-001-B7C9 | SCOPE_LOCK_ID: SL-TASK-2026-260202-A9F2

| Requirement ID | Description | AC Mapping | Test Scenario | Status | Evidence |
|----------------|-------------|------------|---------------|--------|----------|
| REQ-PET-01 | Tiếp nhận đơn thư (CRUD) | AC-01, AC-02 | E2E AC-01/02, UAT-AC01/02 | DONE | PetitionFormPage.tsx, PetitionListPage.tsx, POST /api/v1/petitions → 201, GET → 200 |
| REQ-PET-02 | Danh sách đơn thư với bộ lọc | AC-01 | E2E AC-01, UAT-AC01 | DONE | GET /api/v1/petitions?search&status&unit&fromDate&toDate, PetitionListPage.tsx |
| REQ-PET-03 | Chuyển đơn thư → Vụ việc | AC-03 | E2E AC-03 convert-incident | DONE | POST /api/v1/petitions/:id/convert-incident → 201, status=DA_CHUYEN_VU_VIEC |
| REQ-PET-04 | Chuyển đơn thư → Vụ án | AC-03 | E2E AC-03 convert-case, Full Flow | DONE | POST /api/v1/petitions/:id/convert-case → 201, status=DA_CHUYEN_VU_AN |
| REQ-PET-05 | Validation trường bắt buộc | EC-01 | E2E EC-01, UAT-EC01 | DONE | Frontend + backend DTO validation, modal stays open on missing fields |
| REQ-PET-06 | Cảnh báo quá hạn xử lý | EC-04 | E2E EC-04, UAT-EC04 | DONE | isOverdue() logic, overdue-badge data-testid, overdue-warning banner |
| REQ-PET-07 | Backend unit tests ≥80% coverage | N/A | petitions.service.spec.ts | DONE | 31/31 tests pass, 90.19% statement coverage |
| REQ-PET-08 | E2E tests 9/9 pass | N/A | tests/e2e/petitions.e2e.spec.ts | DONE | 9/9 PASS, 27 screenshots in test-results/uat/screenshots/ |
| REQ-PET-09 | UAT tests 13/13 pass | N/A | tests/uat/petitions.uat.spec.ts | DONE | 13/13 PASS including regression sidebar/dashboard |
| REQ-PET-10 | Refs-first UI adaptation | N/A | REFS-FIRST rule | DONE | PetitionListPage.tsx + PetitionFormPage.tsx adapted from Refs/ |
