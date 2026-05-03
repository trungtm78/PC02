# PC02 Case Management System

## Project Overview
Internal case management system (NestJS backend + React frontend) for managing legal cases, petitions, incidents.

## Key Features
- Auto-create Petition when creating a Case with petitionType (via metadata)
- Bi-directional sync: update Case petitionType syncs to linked Petition
- STT auto-generation for Petitions (format: DT-YYYY-NNNNN)
- Petition-to-Case conversion (convertToCase) with atomic transaction
- Quản lý Vụ việc theo 4 giai đoạn BCA (TT28/2020/TT-BCA): Tiếp nhận, Xác minh, Kết quả, Tạm đình chỉ
- 15 trạng thái vụ việc với transition map validation theo BLTTHS 2015
- SystemSetting: cấu hình thời hạn xử lý với default theo BLTTHS (Đ.147, Đ.148, Đ.149)
- Auto-deadline: tự tính thời hạn giải quyết khi tạo vụ việc
- Team/Data Access Control: phân quyền theo tổ/nhóm/đơn vị
- Modular feature architecture: `src/features/*` (frontend) + `feature.manifest.ts` per module (backend). Auto-discovered via Vite `import.meta.glob` + central registry. Runtime on/off via `feature_flags` table + `@FeatureFlag(key)` guard. Build-time packs via `ENABLED_FEATURES` env.
- KPI Dashboard (`/kpi`): 4 chỉ tiêu cứng TT28/2020/TT-BCA — thụ lý 100%, giải quyết >90%, khám phá >80%, án NT/ĐBNT >95%. Drill-down theo Tổ, biểu đồ 12 tháng.
- DataScope enforcement: tất cả 12 resource (Cases, Incidents, Petitions + 9 child resources) đều enforce phạm vi dữ liệu theo tổ/điều tra viên. `assertParentInScope`/`assertCreatorInScope` trong `scope-filter.util.ts`.

## Testing
- Backend tests: `cd backend && npx jest --no-coverage`
- Full test suite: `cd backend && npm test`
- Frontend tests: `cd frontend && npx vitest run --no-coverage`
- Test count: 936 backend + 247 frontend = 1183 total

## Shared Enum Infrastructure
- **Generator**: `cd backend && npm run gen:enums` — re-generates `frontend/src/shared/enums/generated.ts` from `schema.prisma`. Runs automatically on `npm run build`.
- **Frontend shared enums**: `frontend/src/shared/enums/` — typed constants for all Prisma enums + status labels + badge styles. Never hardcode enum string literals.
- **Backend constants**: `backend/src/common/constants/` — `ROLE_NAMES`, `TOKEN_TYPE`, `SETTINGS_KEY`, `TWO_FA_METHOD`, `FCM_ERROR`, `EXPORT_FORMAT`. Constants with `WIRE FORMAT` JSDoc comment must never be renamed without migration.
- **Status labels**: `frontend/src/shared/enums/status-labels.ts` — CASE/INCIDENT/PETITION status Vietnamese labels + Tailwind badge classes.
- **Rule**: All enum comparisons must use constants/enum values, never string literals. Verified by grep guard in CI.

## Deploy Configuration (configured by /setup-deploy)
- Platform: Render
- Production URL: TBD (update after first deploy)
- Deploy workflow: auto-deploy on push to main
- Deploy status command: HTTP health check
- Merge method: squash
- Project type: web app (NestJS API + React SPA)
- Post-deploy health check: {PRODUCTION_URL}/api/v1/health

### Custom deploy hooks
- Pre-merge: `cd backend && npm test`
- Deploy trigger: automatic on push to main (Render auto-deploy)
- Deploy status: poll production URL
- Health check: {PRODUCTION_URL}/api/v1/health

### Setup instructions
1. Create Render Web Service connected to this repo
2. Set build command: `cd backend && npm install && npm run build && npx prisma migrate deploy && npm run db:seed`
3. Set start command: `cd backend && npm run start:prod`
4. Add environment variables (DATABASE_URL, JWT_SECRET, etc.)
5. After deploy, replace `TBD` and `{PRODUCTION_URL}` above with actual URL

**CRITICAL:** `npm run db:seed` MUST run on every deploy so the `feature_flags` table is populated. Without it, `GET /api/v1/feature-flags` returns an empty array and the entire sidebar goes blank for every user. The seed is idempotent — running it twice is safe. To run only the feature-flag seed without touching other data, use `npm run db:seed:features`.

## Git Branching Convention

**Model:** Simplified Trunk-based development. `main` là nhánh duy nhất thường trú — luôn deployable.

### Quy tắc đặt tên nhánh

| Loại | Pattern | Ví dụ |
|------|---------|-------|
| Feature mới | `feat/short-description` | `feat/export-pdf-report` |
| Bug fix | `fix/short-description` | `fix/overdue-filter-broken` |
| Hotfix production | `hotfix/short-description` | `hotfix/login-500-error` |
| Refactor / cleanup | `refactor/short-description` | `refactor/enum-constants` |
| Chore / tooling | `chore/short-description` | `chore/update-dependencies` |
| Release preparation | `release/vX.Y.Z` | `release/v1.0.0` *(hiếm dùng)* |

### Quy tắc sử dụng

1. **1 branch = 1 mục đích rõ ràng.** Không dùng chung branch cho nhiều feature không liên quan.
2. **Sống ngắn.** Branch nên được PR và merge trong vòng 1-3 ngày. Branch tồn tại > 1 tuần là dấu hiệu scope quá lớn — tách nhỏ.
3. **Branch từ `main`, merge về `main`.** Không có `develop` hay long-running integration branch.
4. **Squash merge khi PR.** Mỗi PR tạo ra 1 commit gọn trên `main` với commit message chuẩn (Conventional Commits).
5. **Xóa branch sau khi merge.** `git push origin --delete <branch>` hoặc tick "Delete branch" trên GitHub PR.
6. **Không commit thẳng vào `main`.** Mọi thay đổi qua PR, dù nhỏ.

### Commit Message Convention (Conventional Commits)

```
<type>(<scope>): <description>

feat(cases):     tính năng mới liên quan Cases
fix(auth):       bug fix
refactor(backend): tái cấu trúc không thay đổi behavior
chore(deps):     update dependency, config
docs:            chỉ thay đổi tài liệu
test:            thêm/sửa test
perf:            cải thiện performance
```

### Workflow nhanh

```bash
# Bắt đầu task mới
git checkout main && git pull
git checkout -b feat/ten-feature-ngan

# ... code, commit thường xuyên ...

# Khi xong
git push -u origin feat/ten-feature-ngan
gh pr create --base main --title "feat: ..."

# Sau khi merge
git checkout main && git pull
git branch -d feat/ten-feature-ngan
```
