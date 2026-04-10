# OPENCODE_RUNNER_PROMPT TASK_ID: TASK-2026-261224 EXECUTION_ID: INTAKE-20260226-001-A2B4
TIMESTAMP: 2026-02-26T12:35:00Z FROM: Antigravity Runner TO: Opencode
ACTION: IMPLEMENT

============================================================ A) SCOPE (HARD) ============================================================
SCOPE_LOCK_ID: SL-2026-261224-B4A2
SCOPE_LOCK_HASH: a1b2c3d4e5f6

IN_SCOPE: 
- Cập nhật Prisma Schema: Thêm model Subject và quan hệ với Case, Directory.
- NestJS: Tạo module, controller, service cho Subject CRUD.
- Frontend: Tạo trang ObjectList (/objects) và ObjectForm (Modal/Page).
- UI Patterns: Tái sử dụng 100% styles từ Refs/SuspectsList.tsx và SuspectsManagement.tsx.
- FK Selection: Áp dụng FKSelect cho [crimes, cases, districts, wards, nationalities, occupations].
- Validation: fullName (req), dob (req), idNumber (req, unique), address (req).

OUT_OF_SCOPE: 
- Quản lý tệp đính kèm (MediaFiles) cho đối tượng.
- Phân quyền (RBAC) chi tiết cho từng field (giả định dùng Admin/Officer hiện tại).

ACCEPTANCE_CRITERIA: 
- AC-01: Given user truy cập /objects When hệ thống load Then hiển thị bảng đối tượng với đầy đủ thông tin và paging.
- AC-02: Given form thêm đối tượng When điền đủ info và chọn FK (Vụ án, Tội danh) Then đối tượng được lưu và link đúng context.
- AC-03: Given trường Địa bàn When chọn Quận/Huyện Then danh sách Phường/Xã phải filter theo Quận/Huyện đã chọn.
- AC-04: Given FKSelect component When gõ từ khóa Then phải hiển thị kết quả fuzzy match từ list danh mục tương ứng.

EDGE_CASE_TABLE (IN TESTS): 
- EC-01: Tên đối tượng có dấu tiếng Việt (Hỗ trợ fuzzy search).
- EC-02: Cascading reset logic (Quận/Huyện đổi -> Phường/Xã reset).
- EC-03: Liên kết với vụ án đã lưu trữ/đình chỉ.
- EC-04: Xử lý trùng CCCD (Báo lỗi validate 409).
- EC-05: Fuzzy matching với danh sách danh mục lớn (>1000 items).

UI_INTERACTION_SPEC: 
- TABLE 2.2.A: Field Definitions (fullName, dob, idNumber, etc.)
- MAP 2.2.C: District -> Ward Cascade logic
- TABLE 2.2.E: Submit POST /subjects flow

============================================================ B.0) PROJECT CONTEXT VALIDATION (MANDATORY --- NON-NEGOTIABLE) ============================================================

Before ANY implementation or testing:
1) PROJECT_CONTEXT.md MUST exist.
If missing: → STOP EXECUTION → Return: EXECUTION_STATUS: BLOCKED REASON: PROJECT_CONTEXT.md not found
2) Opencode MUST load and analyze PROJECT_CONTEXT.md.
Extract and declare:
PROJECT_CONTEXT_SUMMARY: - Environment (local / staging / prod): - Base URL(s): - Test login credentials: - Role definitions: - Database configuration: - Feature flags: - Business constraints: - Architecture notes:
This summary MUST be included in EXECUTION_RETURN_PACKAGE.
3) All UT / IT / E2E / UAT tests MUST:
- Use credentials defined in PROJECT_CONTEXT.md
- Use environment URLs defined in PROJECT_CONTEXT.md
- Respect role definitions defined in PROJECT_CONTEXT.md
- Not hard-code any secrets
- Parameterize environment if multiple environments exist

============================================================ B.1) ARTIFACT ALIGNMENT (MANDATORY --- EVIDENCE BASED) ============================================================

Opencode MUST confirm implementation alignment with Antigravity-managed artifacts:

### ARTIFACTS_REFERENCED
- ERD path/version: docs/specs/ERD_Delta_Subjects.md (v1.1)
- UI Spec path/version: docs/specs/UI_Specs_Subjects.md (v1.0)
- API Spec path/version: docs/specs/API_Specs_Subjects.md (v1.0)
- Test Plan path/version: docs/specs/UAT_Plan_Subjects.md (v1.0)

============================================================ B.2) UI DEVELOPMENT POLICY — REFS-FIRST & FK SELECTION (MANDATORY) ============================================================

### B.2.1 — REFS-FIRST RULE (NON-NEGOTIABLE)
- Pattern 1: `ObjectList` khớp 100% `Refs/src/app/pages/SuspectsList.tsx`.
- Pattern 2: `ObjectForm` khớp 100% `Refs/src/app/pages/SuspectsManagement.tsx`.

### B.2.2 — FOREIGN KEY FIELDS — SELECTION COMPONENT (MANDATORY)
Cần áp dụng `FKSelect` cho:
- Field: Tội danh | Resource: directories (type=CRIME)
- Field: Vụ án | Resource: cases
- Field: Quận/Huyện | Resource: directories (type=DISTRICT)
- Field: Phường/Xã | Resource: directories (type=WARD)
- Field: Quốc tịch | Resource: directories (type=NATIONALITY)
- Field: Nghề nghiệp | Resource: directories (type=OCCUPATION)

============================================================ B) IMPLEMENTATION DIRECTIVES (NO DRIFT) ============================================================
- Implement ONLY what is in IN_SCOPE.
- Do NOT touch OUT_OF_SCOPE.

Backend Directives: 
- Sử dụng NestJS, Prisma. Thêm module `subjects`.
- Implement endpoints: GET/POST/PATCH/DELETE /api/subjects.
- Validation dùng class-validator. Đảm bảo logic unique idNumber.

Frontend Directives: 
- React 18, Tailwind CSS 4. Tái sử dụng `src/app/constants/styles.ts`.
- Sử dụng component `FKSelect` từ `src/components/FKSelect.tsx`.

DB Directives: 
- Cập nhật `prisma/schema.prisma` từ ERD Delta. Chạy migrate dev.

============================================================ C) MANDATORY QUALITY GATE (INJECTED VERBATIM) ============================================================

# OPENCODE_QA_GATE.md (V2.0)
# BẮT BUỘC INJECT VÀO MỌI OPENCODE_RUNNER_PROMPT

... [FULL CONTENT OF OPENCODE_QA_GATE.md INJECTED HERE] ...

============================================================ D) MANDATORY RETURN CONTRACT (NO EXCEPTIONS) ============================================================
Opencode MUST return:
1) EXECUTION_RETURN_PACKAGE (Follow template)
2) ANTIGRAVITY_REVIEW_PROMPT (Follow template) - Persist to: docs/Antigrapvity_Review/ANTIGRAVITY_REVIEW_PROMPT__TASK-2026-261224__INTAKE-20260226-001-A2B4.md
