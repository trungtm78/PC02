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

## Deploy Configuration

- **Platform**: Viettel Cloud VM (171.244.40.245), Ubuntu 24.04 LTS
- **Production URL**: http://171.244.40.245/ (sẽ là `https://<domain>` khi có domain)
- **Pipeline**: GitHub Actions (`.github/workflows/deploy.yml`)
- **Deploy trigger**: auto-deploy khi push `main` HOẶC tạo tag `v*`
- **Project type**: NestJS API (systemd `pc02-backend`) + React SPA (nginx serve `/var/www/pc02`)
- **Health check**: `http://171.244.40.245/api/v1/health` (return `{"status":"ok"}`)

### Pipeline
1. **test** job: `npm ci backend` → `prisma generate` → `npm test` (1054 tests) → `tsc --noEmit`
2. **build** job: build backend (`dist/src/main.js`) + frontend (`dist/`) → tar artifact
3. **deploy** job: rsync artifact lên VM → `bash /home/pc02/bin/deploy.sh <sha>`
4. (Tag only) **release** job: tạo GitHub Release với CHANGELOG section

`deploy.sh` trên VM:
- Extract artifact → `/home/pc02/releases/<sha>/`
- Symlink shared resources (`.env`, `keys/`, `uploads/`) từ `/home/pc02/shared/`
- pg_dump pre-deploy backup (`/var/backups/pc02/pre-deploy-<sha>-*.sql.gz`)
- `prisma migrate deploy` (auto, fail-safe — symlink chưa switch nếu migration fail)
- Atomic symlink switch `/home/pc02/current → releases/<sha>`
- Copy frontend `dist/*` → `/var/www/pc02/`
- `systemctl restart pc02-backend` + health check
- Prune giữ 5 releases gần nhất

### Rollback
- **Code**: `ssh pc02@171.244.40.245 'bash /home/pc02/bin/rollback.sh'` (về release trước)
- **DB**: `pg_restore` từ `/var/backups/pc02/pre-deploy-<sha>-*.sql.gz`
- Chi tiết: [docs/DEPLOY.md](docs/DEPLOY.md)

### CRITICAL — feature_flags seed
`prisma migrate deploy` không chạy seed. Nếu fresh DB hoặc `feature_flags` table trống → sidebar trống cho mọi user. Sau khi setup VM mới, chạy 1 lần:
```bash
cd /home/pc02/current/backend && npm run db:seed:features
```
Seed idempotent — rerun an toàn.

### GitHub Secrets cần
- `VM_HOST` = `171.244.40.245`
- `VM_PORT` = `22`
- `VM_USER` = `pc02`
- `VM_SSH_PRIVATE_KEY` = full PEM (private key, public key paste vào VM `~pc02/.ssh/authorized_keys`)

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

## GBrain Configuration (configured by /setup-gbrain)
- Engine: pglite (local PGLite, single-machine)
- Config file: `~/.gbrain/config.json`
- Database path: `~/.gbrain/brain.pglite/`
- Setup date: 2026-05-08 (Windows repair path — fixed PATH + re-registered MCP with `.exe` suffix)
- MCP registered: yes (Claude Code, user scope) — `C:\Users\Than Minh Trung\.bun\bin\gbrain.exe serve`
- Memory sync: off (no `~/.gstack/.git`; run `/setup-gbrain` and pick a sync mode to enable)
- Current repo policy: unset (run `/setup-gbrain --repo` from this directory to set)
- Pages indexed: 0 — run `/sync-gbrain --full` to import this repo's code surface
- Platform: Windows. The skill is Mac-targeted; if you redo setup, expect manual fixups (PATH propagation, `gbrain put` requires `--content` instead of stdin pipe).
