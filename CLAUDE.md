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

## Testing
- Backend tests: `cd backend && npx jest --no-coverage`
- Full test suite: `cd backend && npm test`
- Test count: 400 tests across 19 suites

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
