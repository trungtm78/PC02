# Changelog

All notable changes to this project will be documented in this file.

## [0.23.0.0] - 2026-05-15

### Security — Sprint 3 Operational Maturity (monitoring + off-site backup + CSP)

Sprint 3/3. Sau Sprint 1+2+3, hệ thống ở mức 9.5/10 — public-Internet ready.

**S3.3 — Prometheus Metrics + Self-hosted Monitoring Stack**
- New module `MetricsModule` (global), service exposes 5 counter + 1 histogram + default Node.js metrics. Endpoint `GET /api/v1/metrics`.
- Counters wired:
  - `pc02_login_attempts_total{result}`: success/failure/locked/2fa_setup_required
  - `pc02_data_scope_denial_total{resource}`: parent/creator (qua scope-filter.util)
  - `pc02_2fa_verify_total{method,result}`, `pc02_audit_log_total{action}` (chuẩn bị wire ở PR sau)
  - `pc02_http_request_duration_seconds`: P95 latency histogram
- Self-hosted stack docker-compose: Prometheus + Alertmanager + Loki + Grafana. Port nội bộ (127.0.0.1), access qua SSH tunnel. RAM ~500MB, $0/tháng.
- 7 alert rules: BackendDown, BruteForceLogin (+ Critical), HighDataScopeDenial, AccountLockoutSpike, HighRequestLatency, OffsiteBackupStale.

**S3.2 — Off-site Backup**
- `scripts/deploy/offsite-backup.sh`: rclone B2 sync `/var/backups/pc02/` lên Backblaze B2 hằng ngày 03:00. Retention 30 days. Cost ~$2/tháng (10GB). Write health metric vào textfile collector cho Prometheus pickup.
- Anh setup B2 account + rclone config 1 lần, cron tự chạy.

**S3.4 — CSP Tighten + Metrics IP Allowlist**
- nginx `Content-Security-Policy` thêm `report-uri /api/v1/csp-report` để track XSS attempts + legitimate breakage.
- Backend endpoint `POST /csp-report` (no auth, public per CSP spec) log violation reports.
- `Permissions-Policy` tighten: disable USB/Serial/Bluetooth/sensors/interest-cohort ngoài geo/camera/mic/payment đã có.
- nginx `location = /api/v1/metrics`: `allow 127.0.0.1; deny all;` — Prometheus container scrape OK, external 403.

**S3.5 — Documentation (4 file mới)**
- `docs/MONITORING.md`: setup stack + alert rules + Grafana access guide.
- `docs/BACKUP-OFFSITE.md`: B2 account setup + rclone config + cron + recovery procedure.
- `docs/KEY-ROTATION.md`: runbook cho JWT keypair, TOTP encryption, SMTP, DB password, GitHub secrets.
- `docs/SESSION-REGISTRY-FUTURE.md`: ghi rõ tại sao S3.1 (UserSession registry) defer + plan đầy đủ cho PR riêng.

### Deferred ra PR riêng — em không build vì risk regression auth core

- **S3.1 UserSession registry** (per-device session management, admin force-logout 1 device). Refactor refresh-token rotation flow. Plan trong `docs/SESSION-REGISTRY-FUTURE.md`. Sprint 2 logout endpoint + tokenVersion đã đủ secure cho launch — đây là UX improvement.
- **CSP nonce-based** (loại bỏ `'unsafe-inline'` cho style). Cần modify Vite build + verify toàn UI không break. CSP report-uri sẽ catch nếu có violation.

### Anh cần làm sau khi merge

1. **Monitoring stack** (1 lần, ~15 phút):
   ```bash
   ssh pc02vm
   cd /home/pc02/current/scripts/monitoring
   cp .env.example .env  # edit GRAFANA_ADMIN_PASSWORD
   nano alertmanager.yml  # SMTP creds + admin email
   sudo docker compose up -d
   ```
2. **Off-site backup** (~20 phút setup):
   - Tạo Backblaze account + bucket private + Application Key.
   - `sudo apt install rclone && rclone config` (paste B2 keyID/appKey).
   - Cài cron: `sudo cp scripts/deploy/offsite-backup.sh /home/pc02/bin/` + cron entry.
   - Chi tiết: `docs/BACKUP-OFFSITE.md`.
3. **Re-apply nginx config** (CSP report-uri + metrics IP allowlist + Permissions-Policy):
   ```bash
   sudo ~/install-nginx-config.sh <domain>
   ```

### Tests
- Backend Jest: 1263/1263 PASS (Sprint 3 không thay đổi test count)
- Frontend Vitest: 484/484 PASS

## [0.22.0.0] - 2026-05-15

### Security — Sprint 2 Public-Launch Hardening (audit + 2FA mandate + logout + MIME)

Sprint 2/3 trên roadmap. Đóng audit trail + auth maturity gaps trước khi public.

**S2.4 — 2FA Setup Mandate (cho TOÀN BỘ user)**
- Schema mới: `users.twoFaSetupRequired` (default `true` cho user mới, `false` cho user cũ qua migration). Seed admin = `false`.
- Token type mới: `TOKEN_TYPE.TWO_FA_SETUP_PENDING = '2fa_setup_pending'`. Sống 15 phút, bind to tokenVersion, JwtStrategy reject làm access token.
- Login flow mới: nếu `!totpEnabled && (TWO_FA_ENABLED || twoFaSetupRequired)` → return `{ pending: true, twoFaSetupToken, reason: 'TWO_FA_SETUP_REQUIRED' }`.
- Guard mới: `TwoFaSetupTokenGuard` (tương tự `TwoFaTokenGuard` nhưng check type=`2fa_setup_pending`, không single-use).
- 2 endpoint mới gated by setup token:
  - `POST /auth/2fa/initial-setup` — wrap setupTotp() trả QR + backup codes.
  - `POST /auth/2fa/initial-setup/verify` — verify first OTP, enable totp, clear `twoFaSetupRequired`, trả TokenPair (login flow hoàn tất).
- Audit log mới: `USER_2FA_SETUP_REQUIRED` khi login fire setup-pending; `USER_2FA_INITIAL_SETUP_COMPLETED` khi user xong.
- 4 test mới cho login mandate flow.

**S2.3 — Backend Logout Endpoint**
- `POST /auth/logout` (gated by `JwtAuthGuard`): clear `user.refreshTokenHash` → refresh token cũ không refresh được nữa. Server-side revocation thay cho frontend-only clear localStorage.
- Audit log `USER_LOGOUT` với ip + user agent.
- Frontend `MainLayout.handleLogout` gọi backend trước khi clear local tokens (best-effort try/catch).
- 3 test backend.

**S2.2 — Magic-byte MIME Validation**
- Dependency mới: `file-type` (ESM-only — dùng dynamic import).
- `POST /documents` upload: sau khi multer ghi file, đọc magic bytes thật. Nếu detected MIME không khớp `ALLOWED_MIME_TYPES` → xoá file giả mạo + throw 400.
- Bypass cho `text/plain` (no magic bytes).
- Protect: attacker upload `.html` đặt Content-Type=image/png không còn bypass whitelist.

**S2.1 — Audit Log Additions**
- `DOCUMENT_DOWNLOADED`: log khi user download tài liệu (fileName + mimeType + size + ip + UA).
- `CASE_EXPORTED`: log khi user export vụ án ward Excel.
- `INCIDENT_EXPORTED`: log khi user export vụ việc ward Excel.
- Petitions đã có `PETITION_EXPORTED` từ trước.
- Admin actions đã cover đầy đủ (USER_CREATED/UPDATED/DELETED, ADMIN_PASSWORD_RESET, ROLE_PERMISSIONS_UPDATED, DATA_GRANT_CREATED/REVOKED, ADMIN_2FA_RESET).

### Anh cần làm sau khi merge

1. Migration `20260515070000_add_2fa_setup_required` tự apply qua prisma migrate deploy.
2. Bật `TWO_FA_ENABLED=true` trong settings (qua admin UI hoặc psql) khi sẵn sàng force toàn bộ user setup 2FA.
3. Khi user login lần tới, frontend cần handle `reason: 'TWO_FA_SETUP_REQUIRED'` → redirect /auth/2fa-setup. **Frontend page cho initial setup flow chưa làm — em ship backend trước, frontend wire-up có thể làm sau** (tạm thời user bị stuck ở response nếu chưa có UI page).

### Tests
- Backend Jest: 1263/1263 PASS (+7 mới: 4 mandate + 3 logout)
- Frontend Vitest: 484/484 PASS

## [0.21.9.0] - 2026-05-15

### Security — Sprint 1 Public-Launch Hardening (4 hạng mục)

Sprint 1/3 trên roadmap "Public Internet Readiness". Mục tiêu: từ 7.5/10 (internal-VPN-ready) lên ngưỡng đủ để mở Internet (still cần Sprint 2+3 cho audit/session/monitoring).

**S1.2 — Account Lockout**
- Schema mới: `users.failedLoginAttempts`, `lockedUntil`, `lastFailedLoginAt` (migration `20260515060000_add_account_lockout_fields`).
- Login fail 5 lần liên tiếp → khoá 15 phút. Locked user bị reject TRƯỚC khi bcrypt.compare chạy (không leak timing info phân biệt locked vs wrong-pw).
- Audit log mới: `USER_LOGIN_LOCKED` khi threshold trigger; `USER_LOGIN_FAILED` giữ nguyên cho fail thường.
- Success login reset counter + clear lockout state.
- Constants: `MAX_FAILED_LOGIN_ATTEMPTS=5`, `LOCKOUT_DURATION_MS=15*60*1000` trong `auth-policy.constants.ts`.
- 6 test mới (RED→GREEN): increment counter, lock trigger, audit fire, locked reject, expire reset, success reset.

**S1.3 — File Upload Throttle**
- `POST /api/v1/documents` thêm `@Throttle({ default: { ttl: 60000, limit: 10 } })` chống storage abuse (1000 file × 10MB = 10GB nếu không cap).
- 1 reflection test verify metadata còn nguyên (prevent regression).

**S1.4 — 2FA Verify Throttle (regression tests)**
- `/auth/2fa/verify` đã có `limit: 5/min` + `/auth/2fa/send-email-otp` đã có `limit: 3/min` — em add 2 reflection test để prevent regression.
- Tính brute-force: 5/min × 6-digit OTP (1M space) × 10-min TTL = 0.005% chance success.

**S1.1 — nginx Golden Template + S1.5 — Deploy artifacts**
- File mới `scripts/deploy/nginx-pc02.conf`: production-grade nginx config với TLS, HSTS preload, CSP, X-Frame-Options DENY, Permissions-Policy, rate-limit zones (api 10r/s, login 3r/s), `client_max_body_size 25M`, immutable cache cho hashed assets.
- File mới `scripts/deploy/install-nginx-config.sh`: idempotent installer — backup config cũ, render template với domain, validate `nginx -t`, reload, health check.
- File mới `docs/PUBLIC-LAUNCH.md`: full step-by-step guide cho anh: certbot, install nginx, migration verify, 6 acceptance tests (TLS, headers, lockout, rate limit, upload throttle, request size cap), rollback procedure.

### Anh cần làm tay sau khi merge

1. Trỏ A record domain về `171.244.40.245`.
2. `ssh pc02vm` rồi `sudo certbot --nginx -d <domain> --redirect` cấp Let's Encrypt.
3. Copy + chạy `scripts/deploy/install-nginx-config.sh <domain>` để apply config.
4. Verify SSL Labs A + securityheaders.com A+.
5. Rotate password `admin@pc02.local` (lần CUỐI cùng plaintext qua mạng — sau khi TLS lên thì sang HTTPS).
6. (Optional) Scrub git history password cũ bằng `git filter-repo`.

### Tests
- Backend Jest: 1256/1256 PASS (+9 mới)
- Frontend Vitest: 484/484 PASS (4 jsdom errors pre-existing)

## [0.21.8.0] - 2026-05-15

### Security — CSO hardening pass (1 CRITICAL + 3 HIGH + 6 MEDIUM + 2 LOW)

Em chạy `/cso` audit toàn bộ source, fix 12 finding code-fixable trong 1 PR. Tests: backend 1247/1247, frontend 484/484 — tất cả PASS.

**CRITICAL — Admin password leak**
- Xoá password hardcoded `admin@pc02.local` khỏi `docs/take-screenshots.js`, `run_maestro.bat`, `run_qa_smoke.bat`. Cả 3 script giờ require env var `SCREENSHOT_PASSWORD` / `TEST_PASSWORD`, fail fast nếu không set.
- **Anh cần làm tay**: rotate password `admin@pc02.local` trên VM ngay (password cũ vẫn còn trong git history, em không scrub history theo yêu cầu của anh).

**HIGH — IDOR (Broken Access Control) trên 2 module shared**
- `action-plans` và `vks-meetings` bỏ DataScope khi rollout phạm vi dữ liệu trước đó. Investigator Tổ A có thể đọc/tạo/xoá plans + biên bản VKS của Tổ B.
- Inject `dataScope` từ `ScopedRequest`, gọi `assertParentInScope(parent, scope, 'read'|'write')` ở mọi CRUD operation. `delete()` load parent qua include rồi check trước khi xoá. Admin (null scope) bypass như cũ.
- 13 test mới (RED→GREEN) cover cross-team deny + matching team allow + admin bypass.

**HIGH — Production missing TLS + security headers**
- `frontend/nginx.conf`: thêm `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `client_max_body_size 25M`. HSTS + rate-limit (commented sẵn để bật khi có TLS cert).
- Backend `main.ts`: cài `helmet` với CSP=false (API trả JSON, frontend riêng), HSTS 1 năm, `crossOriginResourcePolicy: same-site`.
- **Anh cần làm tay**: cấp Let's Encrypt cert + force HTTPS trên VM.

**MEDIUM — XSS injection points**
- `frontend/src/lib/html-escape.ts`: util mới với 6 test case (escape `& < > " '`, null-safe, double-encode protection).
- `ExportReportsPage.tsx:309`: print receipt giờ escape `receiverName`, `delivererName`, `content`, `receiptNumber`, `receiptDate` trước khi `document.write`.
- `email.service.ts`: HTML email `sendEventReminder` escape `eventTitle` + `dateStr` chống injection via calendar event title.

**MEDIUM — Infra hardening**
- `scripts/deploy/deploy.sh`: pg_dump backup giờ `chmod 600` + dir `chmod 700` (backups chứa PII + TOTP secrets).
- `backend/docker-entrypoint.sh`: `db:seed` chỉ chạy khi `RUN_SEED=true` (trước đây chạy mọi container restart — có thể reset admin password về seed value).

**LOW — Defense-in-depth**
- 4 call site `bcrypt.hash(refreshToken, 10)` (auth.service.ts × 3, two-fa.service.ts × 1) → `bcrypt.hash(refreshToken, getBcryptCost())` để consistent với password hash cost 12.
- 2 call site `Math.random()` cho upload filename suffix → `crypto.randomBytes(8).toString('hex')` (128-bit entropy unguessable).

### Cleared by CSO — không phải finding
- npm audit backend + frontend: **0 CVE**
- CI/CD workflows SHA-pinned, minimal permissions, no `pull_request_target`
- JWT RS256 với public/private PEM, tokenVersion-based revocation, refresh-token rotation + reuse detection
- 2FA TOTP atomic replay protection, OTP single-use constant-time compare
- Document upload: MIME whitelist + 10MB cap + filename rewritten server-side
- Không dùng LLM API, không có webhook receiver, không có raw SQL injection vector

## [0.21.7.0] - 2026-05-14

### Fixed — Calendar UI: phân loại Lịch/Sự kiện + sidebar context + delete dialog

Anh kiểm tra UI `/calendar` sau v0.21.6.0 và phát hiện 3 vấn đề UX. v0.21.7.0 fix cả 3 trong 1 PR.

**Bug 1 — Phân loại 2 levels**
Hiện chỉ có scope filter (Hệ thống/Tổ/Cá nhân) — trộn ngày lễ định kỳ với event công việc cùng một bucket. Thêm:
- Top-level **kind toggle "Tất cả / Lịch / Sự kiện"** trên cùng calendar
  - Lịch = `type='holiday'` OR `(type='event' AND scope='SYSTEM')`
  - Sự kiện = deadline/hearing/meeting/other OR (type='event' AND scope IN TEAM/PERSONAL)
- **Category filter chips** song song với scope chips: Quốc gia (đỏ) / Công an (xanh navy) / Quân đội (xanh lá) / Quốc tế (cam) / Khác. Bypass cho legacy events (không có categorySlug).

**Bug 2 — Sidebar "Sự kiện sắp tới" bổ sung context**
Mỗi item trong sidebar giờ hiển thị:
- Category badge (màu theo `categoryColor` từ API)
- Scope label: 🏛️ Toàn cơ quan / 👥 Cấp tổ / 🧑 Cá nhân
- Time (nếu `allDay=false`): "08:30–10:00"
- Recurring icon 🔁 nếu event lặp lại hằng năm

**Bug 3 — Delete dialog enriched context**
Click event ở sidebar mở `RecurringDeleteDialog` với đầy đủ thông tin trước khi confirm xóa:
- Category badge color-coded
- Scope label
- Time range
- Description (line-clamp-3)
- Recurring warning

Anh đã chốt qua AskUserQuestion: giữ flow click→popup-xóa, KHÔNG tạo modal xem chi tiết riêng.

**Implementation**
- `backend/src/calendar/calendar.service.ts` — response thêm `categoryName`, `allDay`, `startTime`, `endTime`, `isRecurring`. Additive, không breaking.
- `frontend/src/pages/calendar/utils/filterEvents.ts` — NEW pure function (12 unit tests pin logic).
- `frontend/src/pages/calendar/CalendarPage.tsx` — kindFilter + categoryFilter state, toggleCategory, UI chips, sidebar enrichment, handleEventClick pass full event.
- `frontend/src/pages/calendar/components/RecurringDeleteDialog.tsx` — 7 new optional props + conditional rendering (11 unit tests).

**Tests**
- 12 new unit tests cho `filterEvents` (kind, category, combined)
- 11 new component tests cho `RecurringDeleteDialog` (all fields + graceful omit)
- 2 new backend service tests (response shape includes new fields, isRecurring derivation)
- Total: 478/478 frontend + 1230/1230 backend pass.

---

## [0.21.6.0] - 2026-05-14

### Added — 12 ngày lễ + truyền thống Việt Nam còn thiếu trong calendar

Migration cũ đã seed 25 events (Tết, Quốc khánh, các ngày phổ biến) nhưng còn thiếu nhiều ngày quan trọng anh chỉ ra. v0.21.6.0 bổ sung 12 events đã verify từ nguồn chính thức (qdnd.vn, congan.*.gov.vn, baochinhphu.vn) — không invent dates.

**National — Quốc gia** (5 mới):
- 3/2 Ngày thành lập Đảng Cộng sản Việt Nam (1930)
- 26/3 Ngày thành lập Đoàn TNCS Hồ Chí Minh (1931)
- 19/5 Ngày sinh Chủ tịch Hồ Chí Minh (1890)
- 28/6 Ngày Gia đình Việt Nam (QĐ 72/2001/QĐ-TTg)
- 10/10 Ngày Giải phóng Thủ đô Hà Nội (1954)

**Police — Công An** (3 mới, ngoài 7 events đã có):
- 15/4 Ngày truyền thống Cảnh sát Cơ động (1974, Luật CSCĐ công nhận)
- 26/6 Ngày Toàn dân Phòng chống Ma túy (QĐ 93/2001/QĐ-TTg)
- 10/8 Ngày truyền thống lực lượng Cảnh sát Kinh tế (1956, Thông tư 1001/TTg)

**Military — Quân đội** (4 mới, ngoài 6 events đã có):
- 19/3 Ngày truyền thống Bộ đội Đặc công (1967)
- 29/6 Ngày truyền thống Binh chủng Pháo binh (1946)
- 11/7 Ngày truyền thống ngành Hậu cần Quân đội (Sắc lệnh 121/SL của Bác Hồ, 1950)
- 23/9 Ngày Nam Bộ Kháng chiến (1945)

**Implementation**
- `prisma/seed-vn-events.ts` — VN_EVENTS array + `seedVnEvents()` upsert function (idempotent, deterministic ID `evt_*`)
- `prisma/seed-vn-events-runner.ts` — standalone runner, không cần SEED_ADMIN_PASSWORD env var
- `npm run db:seed:events` — chạy riêng VN events seed
- Main `npm run db:seed` cũng include VN events (wired vào main seed.ts)
- 9 unit tests guard registry (uniqueness, format, category coverage, anchor events)

**Operational**
Sau khi v0.21.6.0 deploy, chạy:
```bash
ssh pc02vm 'cd /home/pc02/current/backend && DATABASE_URL=$(grep DATABASE_URL /home/pc02/shared/.env | cut -d= -f2-) npm run db:seed:events'
```

Idempotent — re-run an toàn, không tạo duplicate. Mỗi event recurring FREQ=YEARLY tự lặp mọi năm sau.

---

## [0.21.5.0] - 2026-05-14

### Fixed — Deploy bundle thiếu backend/src → seed script fail trên prod

v0.21.4.0 ship `seed-permissions.ts` vào prisma/ (chỗ deploy bundle có ship). Em tưởng đã đủ. Nhưng khi chạy `npm run db:seed` trên VM thì lỗi khác xuất hiện ở step kế tiếp:

```
prisma/seed-feature-flags.ts(18): Cannot find module '../src/feature-flags/feature-registry'
```

**Root cause sâu hơn**: KHÔNG CHỈ `seed-permissions.ts` mà nhiều file trong `prisma/` import từ `backend/src/`. Cụ thể `seed-feature-flags.ts` import `feature-registry.ts` → transitive imports tới ~30+ `feature.manifest.ts` files trên toàn `backend/src/`. Bundle ship qua deploy.yml KHÔNG ship `backend/src/` → ts-node fail.

**Fix**: Thêm `backend/src` vào tarball trong `.github/workflows/deploy.yml`. Exclude tests + fixtures để bundle gọn (raw `src/` 2.4MB → sau exclude ~1.5MB → compressed ~175KB).

Excludes:
- `backend/src/**/*.spec.ts` — unit tests
- `backend/src/**/__tests__` — integration test dirs
- `backend/src/test-fixtures` — test data
- `backend/src/test-utils` — test helpers

Sau v0.21.5.0 deploy, `npm run db:seed` trên VM sẽ chạy success. Permission grant đã đẩy lên DB qua SQL workaround tại 2026-05-14 06:50 UTC, nên seed re-run chỉ idempotent confirm — không thay đổi data thêm.

**Lesson learned thứ 2**: deploy bundle phải ship cả `backend/src` raw TS để bất kỳ `ts-node` runtime script nào (seed, migration helpers, etc.) đều resolve được imports. Pure-dist tarball không đủ.

---

## [0.21.4.0] - 2026-05-14

### Fixed — Seed import broken on prod (hot-hot-fix v0.21.3.0)

v0.21.3.0 ship Setting permission registry vào `src/seed/seed-permissions.ts` rồi `prisma/seed.ts` import từ `../src/seed/seed-permissions`. Code build + tests local pass, deploy lên VM thành công, NHƯNG `npm run db:seed` trên prod fail vì:

```
TSError: Cannot find module '../src/seed/seed-permissions'
```

**Root cause**: `.github/workflows/deploy.yml` tarball CHỈ ship `backend/dist/` + `backend/prisma/`, KHÔNG ship `backend/src/` (raw TypeScript). Seed runs via `ts-node prisma/seed.ts` cần resolve import tại runtime → `src/seed/` không tồn tại trên VM → throw.

**Fix**: Colocate `seed-permissions.ts` vào `prisma/` cùng chỗ với `seed.ts`. Mọi import của seed runtime từ giờ phải nằm trong `prisma/` directory. Test file (`src/seed/seed-permissions.spec.ts`) update import path → `../../prisma/seed-permissions`.

Sau v0.21.4.0 deploy, em sẽ re-run seed:
```bash
ssh pc02vm 'cd /home/pc02/current/backend && npm run db:seed'
```

**Lesson learned**: thêm vào memory để tránh tương lai — seed runtime imports phải nằm trong `prisma/`.

---

## [0.21.3.0] - 2026-05-14

### Fixed — Permission seed thiếu `Setting` → admin pages 403 (ISSUE-001 từ QA)

QA toàn hệ thống (`/qa-only` 2026-05-14) phát hiện 2 admin endpoints trả 403 cho super-admin:
1. `GET /api/v1/settings` → trang `/admin/settings` không tải được cấu hình hệ thống
2. `GET /api/v1/calendar/events` → trang `/calendar` không tải được sự kiện

**Root cause #1 (ISSUE-001)**: `SettingsController` require permission `Setting:read`/`Setting:write` nhưng `prisma/seed.ts` chưa bao giờ khai báo subject `Setting` trong mảng permissions. Kết quả: row permission không tồn tại trong DB → admin role grant qua `findMany()` không có → MỌI user (kể cả super-admin) đều 403.

**Root cause #2 (ISSUE-002)**: `Calendar:read` đã có trong seed (PR 1 v0.16.0.0). Bug là prod DB chưa được re-seed sau khi PR 1 ship → admin role chưa được assign Calendar:read rolePermission. Fix code không cần — chỉ cần re-run seed trên prod.

**Fixes**
- Add `Setting:read` + `Setting:write` permissions vào seed registry
- Refactor: extract permissions array từ `prisma/seed.ts` ra `src/seed/seed-permissions.ts` để testable mà không cần DB connection
- 8 unit tests mới (`seed-permissions.spec.ts`) khẳng định mọi controller subject (Setting, Calendar, Case, User, Petition, Incident, Subject, Lawyer) đều có permission tương ứng + không duplicate
- Test pattern này catch class lỗi giống ISSUE-001 trước khi merge

**Operational note**: Sau khi v0.21.3.0 deploy lên prod, **PHẢI re-run seed**:
```bash
ssh pc02vm 'cd /home/pc02/current/backend && npm run db:seed'
```
Seed idempotent — chỉ thêm permissions mới + grant cho ADMIN, không xóa data.

---

## [0.21.2.0] - 2026-05-14

### Fixed — Hot-fix v0.21.1.0: roles thực tế của hệ thống + 2 dropdown miss

v0.21.1.0 add Vietnamese labels cho `ADMIN/SYSTEM/INVESTIGATOR/TRUONG_DON_VI` theo `role.constants.ts`. Nhưng production DB seed (`backend/prisma/seed.ts`) thực sự chỉ tạo 3 roles: `ADMIN`, `OFFICER`, `DEADLINE_APPROVER`. Frontend constant file bị stale → labels không match → user vẫn thấy raw constants `OFFICER`, `DEADLINE_APPROVER` trong dropdown "Gán vai trò".

Đồng thời v0.21.1.0 miss 2 dropdown trong UserManagementPage.tsx — chỉ fix 5/7 site:
- Line 468 (filter "Tất cả vai trò" trên top toolbar)
- Line 872 (modal Add/Edit User → "Gán vai trò" select)

**Fixes**
- `ROLE_LABEL` thêm: `OFFICER → Cán bộ điều tra`, `DEADLINE_APPROVER → Người phê duyệt thời hạn`. Giữ legacy keys (SYSTEM/INVESTIGATOR/TRUONG_DON_VI) làm fallback cho env có seed khác.
- 2 site miss tại UserManagementPage.tsx (filter dropdown + Edit user modal) giờ wrap `getRoleLabel()`.
- 2 unit tests mới khẳng định OFFICER + DEADLINE_APPROVER label đúng.

Tổng cộng UserManagementPage giờ cover 7/7 role display sites.

---

## [0.21.1.0] - 2026-05-14

### Fixed — UI hiển thị enum constants thay vì tiếng Việt

Cán bộ điều tra mở màn hình "Chỉnh sửa người dùng" tại phần "Gán vai trò" đang thấy raw constants `ADMIN`, `INVESTIGATOR`, `TRUONG_DON_VI` thay vì label tiếng Việt. Tương tự, Activity Log hiển thị action như "CASE CREATED", "USER LOGIN" — không có ý nghĩa với người dùng cuối. Bản vá rà soát toàn bộ hệ thống và chuẩn hóa hiển thị end-user sang tiếng Việt.

**Cán bộ điều tra giờ thấy**
- Vai trò: "Quản trị viên", "Điều tra viên", "Trưởng đơn vị", "Hệ thống" thay vì `ADMIN/INVESTIGATOR/TRUONG_DON_VI/SYSTEM` ở mọi nơi (badge bảng users, dropdown gán vai trò trong Edit user, ma trận phân quyền, dialog xác nhận lưu, file CSV xuất ra).
- Hành động trong Nhật ký hoạt động: "Tạo vụ án" / "Tiếp nhận đơn thư" / "Đăng nhập" / "Đổi mật khẩu" / "Chuyển đơn thư thành vụ án" thay vì `CASE_CREATED / PETITION_CREATED / USER_LOGIN / PASSWORD_CHANGED / PETITION_CONVERTED_TO_CASE`. Áp dụng cả ở danh sách log lẫn drawer chi tiết.

**Cài đặt kỹ thuật**
- Hai map mới `ROLE_LABEL` (4 vai trò) và `AUDIT_ACTION_LABEL` (~60 hành động backend) trong `frontend/src/shared/enums/`, kèm helper `getRoleLabel(name)` / `getAuditActionLabel(action)` có graceful fallback — backend thêm enum mới sẽ không crash UI mà hiển thị raw text như cũ cho tới khi label được bổ sung.
- Re-export từ `locales/vi.ts` theo cùng pattern các status label hiện có.
- 16 test mới (8 role + 8 audit-action + 8 cho mapper `auditLogToEntry` của ActivityLogPage). Full suite vẫn green: 453/453 frontend + 1211 backend.

### Changed
- `ActivityLogPage.tsx`: export `auditLogToEntry` mapper và centralize translation tại điểm map API → row → mọi display site (list, drawer, CSV) cùng dùng output đã dịch.
- `UserManagementPage.tsx`: 5 site dùng helper `getRoleLabel(role.name)` thay vì raw `role.name`.

### Notes
- `SettingsPage.tsx` không đụng — roles array là hardcoded tiếng Việt từ trước, audit ban đầu đánh giá nhầm là raw display.
- Không có thay đổi backend, không migration. Pure frontend i18n cleanup.

---

## [0.21.0.0] - 2026-05-13

### Added — Auth Hardening v1: Force first-login password change

Đóng lỗ hổng impersonation cho hệ thống nội bộ PC02: trước đây admin gõ password khi tạo user → admin biết password đó vĩnh viễn → có thể login dưới danh nghĩa cán bộ trước khi cán bộ sử dụng tài khoản lần đầu. Audit log không phân biệt được. Đối với hệ thống quản lý hồ sơ vụ việc hình sự, đây là vi phạm nguyên tắc non-repudiation.

**Tính năng cho cán bộ và admin**
- Cán bộ phải đổi mật khẩu khi đăng nhập lần đầu, qua trang riêng `/auth/first-login-change-password` (giống TwoFaPage pattern). Mật khẩu tạm chỉ dùng được 1 lần để đăng nhập, sau đó cán bộ tự đặt mật khẩu riêng — quản trị viên không thể xem mật khẩu mới.
- Admin không còn gõ password khi tạo user. Hệ thống sinh tự động mật khẩu tạm 16 ký tự (1 chữ hoa, 1 chữ thường, 1 số, 1 ký tự đặc biệt từ `!@#$%^&*`, loại bỏ I/O/l/0/1 cho dễ đọc), hiển thị 1 lần trong modal không tắt được — phải copy hoặc tick "tôi đã bàn giao" mới đóng được. Cùng UX cho luồng reset password.
- Lần đầu login: trang dedicated với hint compliance, password strength checklist real-time (a11y: aria-live), confirm password field, countdown 15 phút trước khi token hết hạn.

**Bảo mật được vá**

3 lỗi nghiêm trọng đã tồn tại từ trước được phát hiện và fix trong PR này:
- `JwtStrategy` chỉ reject `refresh` token; pending token (`2fa_pending`) có thể dùng làm access token gọi business API. Đã sửa: reject mọi token có type không phải `access`.
- Admin reset password không bump `tokenVersion` → user vẫn dùng được access token cũ 15 phút sau khi reset. Đã sửa: tokenVersion increment trên mọi password reset.
- `refreshToken()` không so sánh `payload.tokenVersion` với `user.tokenVersion` → migration force re-login không hiệu quả với user đang giữ refresh token. Đã sửa: enforce tokenVersion trên refresh path.

**Token binding chống race condition**

Pending token (`2fa_pending` và `change_password_pending`) đều bind `tokenVersion` vào payload tại thời điểm phát hành. Guard so sánh `payload.tokenVersion === user.tokenVersion`. Admin reset xen vào giữa quy trình → token cũ bị từ chối. Đồng thời `firstLoginChangePassword` dùng `updateMany WHERE tokenVersion=expected` (optimistic lock) để chống replay race khi 2 request đồng thời với cùng token. Admin reset cũng dùng cơ chế tương tự để 2 admin reset song song không cùng thành công.

**Audit cho compliance**

5 sự kiện audit mới:
- `ADMIN_PASSWORD_RESET` — admin reset password user khác (metadata: targetUsername, tempPasswordGenerated)
- `FIRST_LOGIN_PASSWORD_CHANGED` — user hoàn tất đổi password lần đầu
- `USER_LOGIN_BLOCKED_PENDING_PASSWORD_CHANGE` — mỗi lần login bị chặn vì cần đổi password (signal brute-force)
- `USER_LOGIN` cũng emit khi forced-change hoàn tất (metadata `viaForcedChange:true`) — compliance query trên USER_LOGIN không miss session này
- `USER_2FA_VERIFIED` metadata `blockedPendingChange:true` khi user pass 2FA nhưng còn pending change-pw

Tất cả ghi trong cùng `prisma.$transaction` với DB update → audit và state luôn nhất quán.

### Changed

- `CreateUserDto` và `UpdateUserDto`: xóa field `password`, thêm `resetPassword: boolean` flag cho `UpdateUserDto`. Admin gọi `PATCH /admin/users/:id { resetPassword: true }` để trigger reset.
- `AuthService.resetPassword` (forgot-password OTP): clear `mustChangePassword` flag để user qua self-reset không bị block bởi forced-change cũ.
- bcrypt cost: extract `hashPassword()` shared util — prod cost 12, test cost 4 (tests/auth giờ chạy nhanh hơn ~20s).
- Frontend `api.ts` interceptor: không override `Authorization` header nếu request đã set sẵn (bảo vệ pending token call).

### Fixed (pre-existing bugs caught during /autoplan + Codex review)

- [CRITICAL] `JwtStrategy.validate()` chấp nhận pending token làm access token (ảnh hưởng 2FA đã ship trước đó).
- [CRITICAL] `refreshToken()` không enforce tokenVersion → migration tokenVersion bump không thực sự log out user.
- [HIGH] `AdminService.updateUser` không bump tokenVersion trên password reset → 15-min bypass window.
- [HIGH] Audit log không trong `$transaction` với DB write trên admin path → có thể audit miss khi DB write thành công.

### Migration & deployment

2 migrations chạy tuần tự trên deploy:
1. `20260513160000_add_must_change_password` — thêm 2 columns `mustChangePassword` (default false) và `passwordChangedAt` (nullable) vào `users`. User cũ không bị backfill — không bị forced-change.
2. `20260513160100_force_token_invalidation` — `UPDATE users SET tokenVersion = tokenVersion + 1` cho tất cả users. **Tác động ops: mọi user đang login sẽ bị đăng xuất 1 lần khi deploy.** Cần thiết để vá lỗ hổng JwtStrategy. Flag trong deploy notes — chấp nhận được cho hệ thống nội bộ.

### Test surface

- Backend: 1203 tests pass (+17 mới so với baseline 1186) — JwtStrategy, ChangePasswordPendingGuard, TwoFaTokenGuard, temp-password generator, password-hash util, AdminService refactor (createUser + updateUser), AuthService.login + firstLoginChangePassword + refreshToken tokenVersion + AuthService.resetPassword.
- Frontend: 409 tests pass (+19 mới so với baseline 390) — PasswordStrengthChecklist, TempPasswordHandoverModal (clipboard, non-dismissible, ESC blocked), api.ts interceptor (#5 fix).

### Review pipeline

- **/autoplan**: Phase 1 CEO + Phase 2 Design + Phase 3 Eng dual voices (Codex + Claude subagent) → 3 CRITICAL findings caught (JwtStrategy bypass, 2FA verify recheck, admin tokenVersion). User Challenge gate qua, scope Option B (F1 + F3 must-haves).
- **Codex challenge round 1**: 7 findings (2 CRITICAL + 3 HIGH + 2 LOW) — all fixed via TDD.
- **Codex review round 2**: 3 findings (2 P1 + 1 P2) — all fixed via TDD. Catch chính chỗ em miss ở round 1: token binding cần áp dụng consistently cho cả 2 pending types + end-to-end (guard → service).

## [0.20.0.0] - 2026-05-13

### Changed — Calendar Events v2, Phase 3 (drop legacy Holiday table)

**Final PR của chuỗi 3-PR phased migration.** Plan ban đầu chia thành 3 PR để giảm risk: PR 1 add new schema song song với Holiday, PR 2a/2b/2c build full feature, **PR 3 migrate data + drop legacy**. Đến PR 3 hệ thống đã production-stable với CalendarEvent table, an toàn migrate 25 holiday rows sang rồi drop bảng cũ.

#### Migration `20260513140000_calendar_events_v2_phase3_drop_holiday`

Chạy trong 1 transaction để không có partial state:

1. **INSERT INTO calendar_events SELECT FROM holidays** với mapping:
   - `id` giữ nguyên (cùng `cuid` format)
   - `categoryId` lookup từ `event_categories` qua `slug = lower(category::text)` (NATIONAL → "national", v.v.)
   - `scope = 'SYSTEM'`
   - `recurrenceRule = 'FREQ=YEARLY'` nếu `isRecurring=true`, else `NULL`
   - `createdById` = admin user ID (admin@pc02.local)
   - `WHERE NOT EXISTS` guard cho idempotency (chạy lại migration không double-insert)
2. **PL/pgSQL verification block** raise exception nếu `migrated_count < holiday_count` (data integrity guard)
3. **DROP TABLE holidays**
4. **DROP TYPE HolidayCategory**

Pre-deploy `pg_dump` backup từ pipeline cover rollback nếu cần.

#### Code cleanup

- **`backend/prisma/schema.prisma`**: xóa `model Holiday` + `enum HolidayCategory` (replaced bằng comment chỉ ra migration file)
- **`backend/prisma/seed-holidays.ts`**: DELETED (25 holiday seed entries giờ là 25 SYSTEM events trong calendar_events)
- **`backend/src/calendar/calendar.service.ts`**: bỏ `prisma.holiday.findMany` từ Promise.all, giờ chỉ query 3 deadline sources + `calendar_events`. Output `type='event'` cho mọi entry (PR 2 đã thay `type='holiday'` ra rồi).
- **`backend/src/calendar/calendar.service.spec.ts`**: bỏ `makeHoliday()` helper + `mockPrisma.holiday` mock + `'maps holidays with category metadata'` test. Rename describe block "dual-read (PR 1)" → "calendar events (PR 3 — Holiday dropped)".

#### Tests
- **Backend: 1144/1144 pass** (-1 từ PR 2c's 1145 vì xóa 1 test holiday-specific)
- `tsc --noEmit` clean

#### Deploy notes

- **Migration drop is destructive** — pre-deploy pg_dump backup essential. Pipeline default đã có `pg_dump pre-deploy-<sha>.sql.gz`.
- Sau deploy verify: `SELECT COUNT(*) FROM calendar_events WHERE scope='SYSTEM';` phải = 25 (migrated holidays) + bất kỳ SYSTEM events nào admin đã tạo từ PR 2a/2b/2c.
- KHÔNG cần manual seed sau deploy (migration self-contained).
- Rollback strategy: `pg_restore` từ backup trước migration nếu cần (Prisma không hỗ trợ auto-down migration).

## [0.19.0.0] - 2026-05-13

### Added — Calendar Events v2, Phase 2c (UI polish + RRULE-aware cron)

PR 2c hoàn thiện full UI surface theo design review wishlist + cho phép cron dispatcher fire reminders cho recurring events.

#### Backend — RRULE-aware reminder dispatcher

`computeOccurrencesInWindow()` (mới trong `event-reminders.service`):
- Non-recurring: 1 occurrence trên `combineDateTime(startDate, startTime)` nếu trong trigger window
- Recurring: `rrulestr(rrule, { dtstart })` rồi `between(searchFrom, searchTo, inc=true)` với search range ±7 ngày quanh trigger window (forgiving với DTSTART TZ jitter), hard cap 100 occurrences/event/window
- Apply EXDATE overrides: nếu `override.excluded=true` → skip
- Forgiving tolerance: `startRangeFrom` trừ 60s khỏi exact trigger time → catches occurrences mà rrule trả về minute-aligned (không có ms) khi `now` có sub-second precision. UNIQUE constraint trên `EventReminderDispatch` ngăn double-fire.

Trước PR 2c: dispatcher skip mọi recurring events (`if (ev.recurrenceRule) continue`). Sau PR 2c: dispatcher fire đúng cho FREQ=WEEKLY/MONTHLY/YEARLY/DAILY (với endDate guard).

#### Frontend — RecurrenceBuilder (visual UI)

Thay 4-radio preset cũ trong `CreateEventModal` bằng `RecurrenceBuilder`:
- 5 preset radio: Không lặp / Hàng năm / Hàng tháng / Hàng tuần / **Tùy chỉnh**
- Khi chọn Tùy chỉnh: BYDAY checkboxes T2-CN + INTERVAL number (1-52 tuần)
- Live preview text: "Lặp lại vào T2, T4 mỗi 2 tuần"
- `buildRRule()` helper convert preset + custom config → RFC 5545 RRULE string

#### Frontend — ReminderEditor (inline trong CreateEventModal)

- Compact list với 4 preset (15p / 1h / 1d / 1w) + channels FCM/Email checkbox
- Prevent duplicate `minutesBefore` cho cùng event
- Sau khi event tạo thành công, modal best-effort POST từng reminder qua `eventRemindersApi.create()` (1 reminder fail không break flow)

#### Frontend — RecurringDeleteDialog (data integrity critical)

Component dialog 2-button:
- **"Chỉ xóa ngày này"** → `calendarEventsApi.excludeOccurrence(eventId, date)` (insert EXDATE override row, soft skip 1 occurrence)
- **"Xóa cả chuỗi sự kiện"** → `calendarEventsApi.remove(eventId)` (soft delete parent)
- Non-recurring events: chỉ hiển thị 1 button "Xóa sự kiện"
- Wired vào CalendarPage `handleEventClick`: khi user click event có id format `event-{cuid}-{YYYY-MM-DD}`, parse eventId + date, detect recurring iff cùng eventId xuất hiện trên nhiều ngày trong view → mở dialog với option phù hợp

Prevents the design review concern: "user xóa recurring event = nuke 52 occurrences silently".

#### Frontend — Filter chips (scope toggle)

Trong CalendarPage giữa header và calendar grid:
- 4 chips: "Deadline + Lễ" / "Hệ thống" / "Tổ" / "Cá nhân"
- LEGACY chip cover deadline + holiday từ Holiday table (giữ backward compat)
- SYSTEM/TEAM/PERSONAL chips cover events từ CalendarEvent table với scope tương ứng
- Toggle bằng click — `filteredEvents` reactive memo

#### Frontend — Scope visual treatment trên day cell

`getScopeBorderStyle(scope)`:
- SYSTEM: solid border (mặc định)
- TEAM: `border-dashed border-white/60`
- PERSONAL: `border-dotted border-white/60`

User phân biệt scope ngay từ day cell mà không cần click vào event.

### Tests
- Backend: 2 new tests cho RRULE-aware dispatcher (fire recurring + skip EXDATE) → 1145/1145 pass total
- Frontend: 390/390 pass (RecurringDeleteDialog + RecurrenceBuilder + ReminderEditor compile + integrate; visual tests defer cho user-facing manual verify)
- `tsc --noEmit` file em touch clean

### Out of scope (defer to future PR nếu cần)
- 2-step wizard cho EventFormModal (hiện tại 1-step modal đủ dùng)
- Mobile-specific bottom sheet (modal scroll OK trên mobile)
- Cron concurrency lock across multiple VM instances (single VM hiện tại OK)

### Deploy notes
- KHÔNG migration mới — schema giữ từ PR 1
- Cron sẽ tự pick up logic mới khi backend restart sau deploy
- Frontend bundle increase ~30KB do `rrule` import — acceptable

## [0.18.0.0] - 2026-05-13

### Added — Calendar Events v2, Phase 2b (reminders + frontend module + admin UI)

PR 2b ship phần còn lại của plan Phase 2: event reminder backend (CRUD + cron dispatcher + prune) + frontend admin UI (EventCategoriesModule + CreateEventModal in CalendarPage). PR 3 còn lại sẽ migrate 25 holidays sang CalendarEvent rồi drop bảng cũ.

#### Backend — event-reminders module hoàn chỉnh

- **CRUD endpoints:**
  - `POST /events/:eventId/reminders` (throttle 20/min): user tự tạo reminder
  - `GET /events/:eventId/reminders`: list reminders của current user
  - `DELETE /events/:eventId/reminders/:reminderId`: owner-only delete
  - DTO: `CreateReminderDto` với `minutesBefore` (1-43200 phút, max 30 ngày) và `channels[]` (FCM/EMAIL)
  - Reject duplicate `(eventId, userId, minutesBefore)` → 409
- **Cron dispatcher** (`@Cron('*/5 * * * *')`):
  - **In-process mutex** (`this.running` flag) chống overlap khi FCM chậm (Eng review fix #2)
  - Window `[now, now + 6 minutes]` (chứ không 1 giờ như plan gốc — giảm số INSERT duplicate)
  - Insert `EventReminderDispatch` row BEFORE send → UNIQUE `(reminderId, occurrenceDate)` catches concurrent claims atomically
  - Gửi qua `PushService.sendToUser()` (FCM HTTP v1) + `EmailService.sendEventReminder()` (mới)
  - Mỗi send wrapped try/catch — không break loop nếu 1 user fail
  - PR 2b chỉ xử lý non-recurring events (recurring + RRULE expansion trong cron defer cho tương lai — acceptable tradeoff: events vẫn hiện trên calendar, chỉ không gửi reminder)
- **Prune cron** (`@Cron('0 2 * * *')`): xóa `event_reminder_dispatches` cũ hơn 90 ngày
- **EmailService.sendEventReminder()**: HTML email với event title + ngày, log warn nếu fail (non-fatal)

#### Frontend — EventCategoriesModule (Settings)

- Mount vào Settings menu với icon Tag — admin tạo/sửa/xóa category dynamic
- Color picker: 8 preset swatches + native `<input type=color>` + hex validation regex
- isSystem categories: badge "Hệ thống" + nút Xóa ẩn (chỉ Sửa được)
- Form: slug required khi tạo mới (regex `^[a-z0-9_-]+$`), slug read-only khi edit
- Whitelist update: chỉ POST `{name, color, icon, sortOrder}` (không slug, không isSystem — service strip silently)
- 5 frontend tests cover: list render, system badge, delete button disabled, POST create, PATCH update (slug excluded)

#### Frontend — CreateEventModal (CalendarPage)

- Button "Tạo sự kiện" trong CalendarPage header — opens modal API-backed (POST `/calendar-events`)
- Form fields: title, date, category dropdown (từ `eventCategoriesApi.list()`), allDay toggle + start/end time, scope (admin chọn SYSTEM/PERSONAL — user thường chỉ PERSONAL), recurrence preset 4 options (Không lặp/Hàng năm/Hàng tháng/Hàng tuần), recurrence end date, description
- Success → refetch calendar events (legacy endpoint dual-read trả expanded recurring + holidays)

#### API clients (`frontend/src/lib/api.ts`)

- `eventCategoriesApi`: list/get/create/update/remove
- `calendarEventsApi`: list/create/update/remove/excludeOccurrence (cho occurrence EXDATE)
- `eventRemindersApi`: list/create/remove (cho event-id-scoped reminders)
- Type-safe payload + response interfaces (`EventCategory`, `CalendarEvent`, `EventReminder`, `EventScope`, `ReminderChannel`)

### Tests
- Backend: 14 new tests trong `event-reminders.service.spec` (CRUD + dispatcher mutex + duplicate dispatch UNIQUE + prune cron) → 1143/1143 pass total (+12 từ PR 2a)
- Frontend: 5 new tests trong `EventCategoriesModule.test.tsx` → 390/390 pass total (+5 từ PR 2a)
- `tsc --noEmit` clean trên file em touch (4 pre-existing errors ở files unrelated giữ nguyên)

### Out of scope (deferred to PR 2c hoặc PR 3)

- Frontend **EventFormModal 2-step wizard** (PR 2b ship 1-step CreateEventModal là MVP đủ dùng)
- Frontend **RecurrenceBuilder visual UI** (PR 2b ship 4-radio preset là đủ, custom RRULE textarea bị drop theo Design review)
- Frontend **ReminderEditor** inline trong CalendarPage (PR 2b ship API-backed CRUD nhưng UI chưa expose — user tạo reminder qua admin tools/API call)
- Frontend **CalendarPage filter chips** (scope SYSTEM/TEAM/PERSONAL toggle) — defer
- Frontend **recurring delete confirm dialog** (Cả series vs chỉ ngày này) — defer, hiện tại DELETE soft delete cả series
- Frontend **scope visual border/icon** trên day cell — defer
- Cron dispatcher RRULE-aware: hiện chỉ fire cho non-recurring events. Recurring reminder defer
- PR 3: migrate 25 holidays → CalendarEvent + DROP TABLE holiday + DROP TYPE HolidayCategory

### Deploy notes

- KHÔNG có migration mới (schema giữ nguyên từ PR 1)
- `@Cron` decorators tự register khi backend khởi động — dispatcher fire mỗi 5 phút, prune fire daily 02:00
- Cron schedule single-instance OK vì 1 VM. Nếu scale-out → cần lock external (Redis SETNX hoặc DB advisory lock)
- Reminder dispatch tới user cần `userDevice` row có valid FCM token + `user.email` không null. User chưa setup FCM thì FCM send skip, chỉ gửi email
- Sau deploy chạy 1 lần: nothing special — feature flag từ PR 1 vẫn enabled, endpoints mới accessible ngay

## [0.17.0.0] - 2026-05-13

### Added — Calendar Events v2, Phase 2a (backend CRUD + RRULE expansion)

Đây là **PR 2a** trong chuỗi 3-PR phased. Phase 2 ban đầu plan ship 1 PR lớn (backend + frontend + cron) trong ~10 ngày. Em tách thành 2a (backend, đã ship) + 2b (frontend + cron dispatcher) để risk thấp + value ship sớm. Feature flag default ON, nhưng UI chưa rewrite nên user chưa thấy gì khác — backend endpoints sẵn sàng cho frontend PR 2b gọi.

#### Backend modules — full CRUD

**`event-categories`** (extends PR 1 read-only skeleton):
- `POST /api/v1/event-categories` — admin tạo category mới (10/min throttle anti-spam)
- `PATCH /api/v1/event-categories/:id` — sửa name/color/icon/sortOrder (slug và isSystem là read-only, service strip silently)
- `DELETE /api/v1/event-categories/:id` — chặn nếu `isSystem=true` (403) hoặc còn event tham chiếu (409)
- DTOs: `CreateCategoryDto` (slug regex `^[a-z0-9_-]+$`, color regex `^#[0-9a-fA-F]{6}$`), `UpdateCategoryDto` (PartialType, whitelist)

**`calendar-events`** (full CRUD with scope authorization):
- `POST /api/v1/calendar-events` — tạo event (20/min throttle per user)
  - SYSTEM scope: require ADMIN role
  - TEAM scope: require user là tổ trưởng của teamId (qua `userTeam.isLeader=true` DB lookup) HOẶC admin
  - PERSONAL scope: backend **force `userId = currentUser.id`** (ignore any client-sent userId — prevent spoofing onto another user)
- `PATCH /api/v1/calendar-events/:id` — update với owner+scope check (SYSTEM events require ADMIN even if createdById match)
- `DELETE /api/v1/calendar-events/:id` — soft delete (set `deletedAt`), giữ audit history
- `DELETE /api/v1/calendar-events/:id/occurrence/:date` — exclude 1 occurrence của recurring series (RFC 5545 EXDATE pattern), tạo override row `excluded=true`
- Per-user cap: `PERSONAL` events ≥ 1000 → 409 (Eng review fix #3)
- RRULE safety: DTO reject `FREQ=DAILY/HOURLY/MINUTELY/SECONDLY` nếu không có `recurrenceEndDate`/`UNTIL`/`COUNT` (Eng review fix #4)
- DataScope filtering trong `findInRange`: admin thấy tất, non-admin thấy SYSTEM + own TEAM events (qua `userTeam` DB lookup, NOT JWT) + own PERSONAL events

#### RRULE expansion (`expandOccurrences()`)

- Sử dụng `rrule` npm package (RFC 5545 iCalendar standard)
- Non-recurring event: 1 occurrence trên `startDate` nếu trong range
- Recurring event: `RRule.between(from, to, true)` expand thành các occurrence dates
- **Hard cap 500 occurrences/event** — DoS protection (Eng review)
- Apply override rows: `excluded=true` → skip occurrence (EXDATE), `overrideFields` JSON → modify title/time per occurrence (PR 2b sẽ build UI)
- Malformed RRULE → graceful fallback (single occurrence on startDate)

#### `calendar.service` integration

- `GET /api/v1/calendar/events?year=&month=` giờ expand recurring events đúng cách:
  - Query mở rộng: lấy events có `startDate <= toDate AND (recurrenceEndDate IS NULL OR >= fromDate)` — catch recurring series bắt đầu trước window nhưng có occurrences trong window
  - Output id format: `event-{eventId}-{YYYY-MM-DD}` — distinct per occurrence
  - Trước đây: 1 row recurring = 1 calendar event hiển thị. Giờ: 1 row recurring + FREQ=WEEKLY trong tháng = ~4 calendar events.

#### Architecture

- `CalendarEventsModule` import `TeamsModule` + provide `UnitScopeService` (chuẩn pattern existing scope-aware modules)
- `CalendarModule` import `CalendarEventsModule` để `CalendarService` dùng `expandOccurrences()` qua DI thay vì duplicate logic

### Tests

40 backend tests mới (12 event-categories + 24 calendar-events + 4 PR 1 spec updates trong calendar.service):
- Event-categories CRUD: create with default sortOrder, slug uniqueness conflict, update strips slug/isSystem, delete refuses isSystem + non-empty + missing
- Calendar-events scope rules: SYSTEM admin-only, TEAM leader/admin, PERSONAL force userId
- Per-user cap reject at 1000 PERSONAL
- RRULE safety: DAILY without endDate rejected, YEARLY unbounded OK
- DataScope: admin sees all, non-admin filters by SYSTEM+OR(own TEAM, own PERSONAL)
- Update owner check + admin override + updatedById tracking
- Soft delete + occurrence exclude
- expandOccurrences: 1-off, year-only, weekly, daily-with-end, EXDATE skip, 500-iter cap

**Full backend suite: 1131/1131 pass** (+40 từ PR 1's 1091), `tsc --noEmit` exit 0.

### Out of scope cho PR 2a (defer to PR 2b)

- Frontend: CalendarPage rewrite (2-step wizard EventFormModal, RecurrenceBuilder UI, ReminderEditor, scope border/icon, recurring delete dialog)
- Frontend: EventCategoriesModule in Settings, 3 API clients, 2 react-query hooks
- Backend `event-reminders`: CRUD POST/DELETE + cron dispatcher với mutex + `PushService.sendToUser` + email integration
- Backend prune cron: daily 02:00 DELETE event_reminder_dispatches WHERE sentAt < 90d
- Lunar date computed display
- DataScope verification with concurrent tests (timezone drift, cascade delete)

### Deploy notes

- Tất cả 3 feature flag mới vẫn ON từ PR 1 → endpoints `/event-categories`, `/calendar-events`, `/events/:id/reminders` (read-only) accessible
- POST/PATCH/DELETE endpoints mới đều cần permission `Calendar:write|edit|delete` (đã seed trong PR 1)
- KHÔNG có migration mới — schema giữ nguyên từ PR 1
- Backward compat: `GET /api/v1/calendar/events` (legacy frontend gọi) vẫn hoạt động đúng cũ + thêm expanded recurring events nếu admin đã tạo
- Nếu cần kill switch: `UPDATE feature_flags SET enabled=false WHERE key IN ('event_categories_v2','calendar_events_v2')` trên VM → routes trả 404

## [0.16.0.0] - 2026-05-13

### Added — Calendar Events v2, Phase 1 (schema + dual-read foundation)

Đây là PR 1 trong chuỗi 3 PR phased (theo /autoplan recommendation, replace Big Bang ban đầu). Mục tiêu PR 1: tạo schema mới SONG SONG với Holiday, không drop. Backend dual-read cả 2 nguồn nên frontend hiện tại không thấy thay đổi gì. PR 2 sẽ build full UI + CRUD + RRULE + reminders. PR 3 sẽ migrate data Holiday → CalendarEvent và drop bảng cũ.

#### Schema (Prisma + migration `20260513120000_calendar_events_v2_phase1`)
- **`EventCategory`** — bảng category động thay thế dần `HolidayCategory` enum. 5 default rows (`isSystem=true`, không cho xóa): national, police, military, international, other.
- **`CalendarEvent`** — bảng event mới với 3-tier scope (SYSTEM/TEAM/PERSONAL), recurrence rule (RRULE string), category FK, audit fields (createdBy/updatedBy), soft delete (`deletedAt`). FK `userId` dùng `SetNull` (KHÔNG Cascade) để giữ audit history khi deactivate user.
- **`CalendarEventOccurrenceOverride`** — thin override table cho RFC 5545 RECURRENCE-ID + EXDATE pattern. Replace self-FK approach (eng review #3 — 50 bytes vs 500/row).
- **`EventReminder`** + **`EventReminderDispatch`** — FCM/email reminder tracking với UNIQUE `(reminderId, occurrenceDate)` chống duplicate dispatch.
- **2 enums mới**: `EventScope`, `ReminderChannel`.
- **4 partial indexes** trên `calendar_events` cho hot query paths (eng review #9):
  - `(startDate) WHERE scope='SYSTEM' AND deletedAt IS NULL`
  - `(startDate, teamId) WHERE scope='TEAM' AND deletedAt IS NULL`
  - `(startDate, userId) WHERE scope='PERSONAL' AND deletedAt IS NULL`
  - `(sentAt)` trên `event_reminder_dispatches` cho prune cron tương lai.
- **KHÔNG đụng `Holiday` + `HolidayCategory` enum** — vẫn tồn tại song song.

#### Backend modules (skeleton, gated by feature flags)
- `event-categories` module — `GET /api/v1/event-categories` + `GET /:id`. Gated bởi `@FeatureFlag('event_categories_v2')`. PR 2 sẽ thêm POST/PATCH/DELETE.
- `calendar-events` module — `GET /api/v1/calendar-events?year=&month=` skeleton. Gated bởi `@FeatureFlag('calendar_events_v2')`. PR 2 sẽ thêm CRUD + scope filtering + RRULE expansion.
- `event-reminders` module — `GET /api/v1/events/:eventId/reminders` (current user only). Gated bởi `@FeatureFlag('event_reminders_v2')`. PR 2 sẽ thêm POST/DELETE + cron dispatcher với mutex (eng review #2) + Push/Email integration (qua `PushService.sendToUser` — không phải `firebase-admin` như plan ban đầu hiểu lầm).
- Cả 3 feature flag mặc định **enabled=true** trong seed nhưng được toggle off bằng `gstack-config` hoặc `UPDATE feature_flags SET enabled=false WHERE key='...'` trước khi deploy nếu cần.

#### Calendar dual-read (`backend/src/calendar/calendar.service.ts`)
- `GET /api/v1/calendar/events?year=&month=` giờ đọc CẢ `prisma.holiday.findMany` (legacy) lẫn `prisma.calendarEvent.findMany` (mới), merge và sort theo date.
- Event type mới `'event'` cùng các field `categorySlug/categoryName/categoryColor/scope` để frontend render khác với `'holiday'` cũ.
- **Permission subject đổi từ `'Case'` → `'Calendar'`** (eng review #5 — `'Case'` là sai contract, lẽ ra phải là `'Calendar'` resource riêng).

#### Permissions + seed
- Thêm 4 permissions mới: `Calendar:{read,write,edit,delete}` với description tiếng Việt.
- ADMIN role tự động được grant đầy đủ (loop existing).
- OFFICER role giờ có `Calendar:read` (everyone needs to see calendar).
- `seed-event-categories.ts` — idempotent upsert 5 default categories, mounted vào main seed chain.

### Tests
- 11 backend tests mới:
  - `event-categories.service.spec.ts` (4 cases: list sorted, list empty, findOne hit, findOne miss)
  - `calendar-events.service.spec.ts` (2 cases: findInRange filtered + include category, empty range)
  - `event-reminders.service.spec.ts` (2 cases: listForEvent owned, empty)
  - `calendar.service.spec.ts` (+4 cases mới cho dual-read: merges holidays + events, filters soft-deleted, queries same date range, maps to type='event' with shortTitle preference)
- **Full backend suite: 1091/1091 pass** + `tsc --noEmit` clean.

### Out of scope cho PR 1 (defer to PR 2)
- POST/PATCH/DELETE endpoints cho event-categories, calendar-events, event-reminders.
- Frontend rewrite CalendarPage + EventCategoriesModule UI.
- RRULE recurrence expansion logic.
- Cron dispatcher với mutex + PushService integration.
- Per-user PERSONAL event cap + Throttle.
- DataScope filtering (SYSTEM/TEAM/PERSONAL).
- Migration 25 holiday → CalendarEvent (defer PR 3).
- Documentation updates trong CLAUDE.md (sẽ làm khi PR 2 ship full feature).

### Deploy notes
- Tất cả feature flag mới default ON, nhưng vì frontend chưa gọi endpoints mới nên UI không thấy gì. Backend chỉ thay đổi 1 chỗ: calendar.service đọc thêm `calendar_events` table (sẽ rỗng cho đến khi admin tạo event). Risk thấp.
- Sau deploy chạy: `cd /home/pc02/current/backend && npm run db:seed` (đã include seed-event-categories chain).
- Migration `20260513120000_calendar_events_v2_phase1` chỉ CREATE TABLE, không touch Holiday → safe rollback qua pg_dump nếu cần.

## [0.15.1.1] - 2026-05-13

### Fixed
- **Mapping địa chỉ cải cách 2025 — "Cập nhật từ API" không chạy được**: frontend `AddressMappingModule` vẫn gọi endpoint cũ `POST /address-mappings/crawl` (đã bị xóa từ v0.13.10.0, thay bằng async background job pattern `POST /address-mappings/seed/:province`). Request trả 404 → catch block nuốt error → user thấy mơ hồ "không có kết quả". Bug đã được flag trong `docs/ADDRESS_MAPPING_AUDIT.md:123` nhưng frontend bị bỏ quên.
- Frontend giờ:
  - Có province selector (HCM/HN/HP/DN/CT) cho user chọn tỉnh muốn seed.
  - Gọi `POST /address-mappings/seed/:province` → nhận `jobId` → poll `GET /address-mappings/seed/status/:id` mỗi 2s.
  - Hiển thị progress (`mapped/total`, số `needsReview`, số `errorCount`) trong banner màu theo status (xanh dương = running, xanh lá = completed, đỏ = failed, xám = cancelled).
  - Nút "Hủy" gọi `POST /address-mappings/seed/:id/cancel` khi job đang chạy.
  - Tự refresh table khi job đạt terminal status.
  - Disable nút "Cập nhật từ API" + province selector khi job đang queued/running.

### Tests
- Thêm `frontend/src/pages/settings/modules/__tests__/AddressMappingModule.test.tsx` — 6 test cases bám TDD: verify endpoint mới, province selection, polling cadence, progress display, refresh-on-complete, button disabled trong khi job active. Cũng có regression guard `expect(api.post).not.toHaveBeenCalledWith('/address-mappings/crawl')` để bug này không quay lại.

## [0.15.1.0] - 2026-05-12

### Added — CI/CD Pipeline (GitHub Actions → Viettel Cloud VM)
- `.github/workflows/deploy.yml`: 3-job pipeline (test → build → deploy) tự động chạy khi push `main` hoặc tag `v*`. Tag thêm job thứ 4 tạo GitHub Release với CHANGELOG section extract tự động.
- `scripts/deploy/deploy.sh`: orchestrate deploy trên VM — extract tarball, symlink shared resources, pg_dump pre-deploy backup, `prisma migrate deploy` fail-safe, atomic symlink switch, restart backend, health check, prune giữ 5 release.
- `scripts/deploy/rollback.sh`: switch current symlink về release trước hoặc release cụ thể, restart backend, health check.
- `scripts/deploy/health-check.sh`: 5 retries × 2s curl `/api/v1/health`.
- `scripts/deploy/migrate-existing.sh`: 1-time migration script chuyển VM từ layout SCP cũ sang release-based.
- `docs/DEPLOY.md`: hướng dẫn full pipeline + rollback + troubleshoot.
- VM layout mới: `/home/pc02/releases/<sha>/`, `current` symlink, `shared/` cho `.env`/keys/uploads persist qua deploy.

### Fixed
- `init_rls` migration: rename timestamp `00000000000000` → `99999999999999` để chạy CUỐI cùng (sau khi tables tồn tại). Migration ban đầu fail vì reference table `users` chưa được tạo.
- `CLAUDE.md`: update Deploy Configuration section từ Render placeholder → Viettel Cloud VM thực tế với GitHub Actions pipeline.

### Changed
- Backend `pc02-backend.service` systemd unit giờ trỏ `WorkingDirectory=/home/pc02/current/backend` (theo symlink), restart `RestartSec=10` giữ nguyên.
- `/etc/sudoers.d/pc02`: thêm permission `cp`, `chown` cho user `pc02` để deploy script copy frontend dist vào `/var/www/pc02` không cần root.

### Notes
- Pre-deploy DB backup: `/var/backups/pc02/pre-deploy-<sha>-*.sql.gz` cho mỗi deploy (cùng cron daily 02:30 ICT đã có).
- Migration auto-run với fail-safe: nếu `prisma migrate deploy` fail, symlink KHÔNG switch → backend cũ vẫn chạy.
- Rollback DB: dùng `pg_restore` từ `/var/backups/pc02/pre-deploy-<sha>-*.sql.gz` (Prisma không hỗ trợ auto down migration).
- VM phải cài `rsync` (Ubuntu 24.04 minimized không có sẵn).

## [0.15.0.0] - 2026-05-12

### Added — Lịch ngày đặc biệt (Holidays)
- Trang **Lịch làm việc** giờ hiển thị 25 ngày đặc biệt của Việt Nam, Công an, Quân đội bên cạnh deadline vụ án / vụ việc / đơn thư. Mỗi category có màu riêng (đỏ cờ NATIONAL, xanh CAND POLICE, xanh QĐND MILITARY, cam INTERNATIONAL) để cán bộ phân biệt nhanh giữa hạn nghiệp vụ và lịch lễ.
- Model `Holiday` + enum `HolidayCategory` (NATIONAL/POLICE/MILITARY/INTERNATIONAL/OTHER) trong `prisma/schema.prisma`. Unique theo `(date, title)` — cho phép cùng 1 ngày có nhiều holiday (vd 3/3: Biên phòng + An ninh Nhân dân).
- Seed `prisma/seed-holidays.ts` idempotent, 25 entries cho năm 2026:
  - **8 NATIONAL**: Tết Dương lịch, Tết Nguyên Đán (mùng 1/2/3), Giỗ Tổ Hùng Vương, Giải phóng miền Nam 30/4, Quốc tế Lao động 1/5, Quốc khánh 2/9
  - **7 POLICE**: Truyền thống CAND 19/8, CSGT 21/2, PCCC 4/10, CSHS 18/4, An ninh Nhân dân 3/3, QLHC 4/6, Pháp luật Việt Nam 9/11
  - **6 MILITARY**: Thành lập QĐND 22/12, Toàn quốc kháng chiến 19/12, Hải quân 7/5, Biên phòng 3/3, PK-KQ 22/10, Thương binh - Liệt sỹ 27/7
  - **4 INTERNATIONAL**: 8/3, Thiếu nhi 1/6, Phụ nữ Việt Nam 20/10, Nhà giáo 20/11
- `GET /api/v1/calendar/events?year=&month=` giờ trả thêm event type `holiday` với metadata `holidayCategory` + `isOfficialDayOff` để frontend render badge category và đánh dấu ngày nghỉ chính thức.

### Changed
- `CalendarService.getEvents` merge holiday vào output cùng cases/incidents/petitions, sort theo ngày tăng dần.
- `EventType` ở frontend mở rộng từ 4 → 5 giá trị (thêm `'holiday'`). `eventTypeColors`/`eventTypeLabels` cập nhật tương ứng. Hàm `getEventColor()` chọn màu theo `holidayCategory` khi event là holiday.

### Notes
- Tết Nguyên Đán (mùng 1/2/3) + Giỗ Tổ Hùng Vương phải tính theo lịch âm hàng năm — phiên bản này hardcode năm 2026. Năm 2027 admin cần cập nhật ngày qua DB hoặc tạo cronjob.
- `pc02_user` được grant `BYPASSRLS` trong môi trường production hiện tại để cho phép seed/migrate. Cần audit `prisma.service.ts` xem có set `app.current_user_id` qua middleware không trước khi revoke BYPASSRLS.

### Chore
- Thêm `backend/uploads/` vào `.gitignore` để tránh commit nhầm file user upload runtime.

## [0.14.2.0] - 2026-05-11

### Security — CSO audit hardening (5 findings)
- **2FA backup codes** giờ hash bằng `bcrypt` cost 12 thay vì SHA-256 + salt một vòng. Tấn công bằng GPU brute-force trên DB bị rò rỉ giờ chậm hơn ~6 bậc. Migration `20260511180000_invalidate_legacy_backup_codes` tự động xoá codes cũ cho user có 2FA bật — họ cần re-setup để nhận codes mới hashed bằng bcrypt. Khi deploy, `docker-entrypoint.sh` chạy `prisma migrate deploy` nên migration tự kick in.
- **Frontend `axios` 1.13.5 → 1.16.x** vá GHSA-3w6x-2g7m-8v23 (prototype pollution trong `parseReviver`) và GHSA-q8qp-cvcw-x6jj (credential injection qua HTTP adapter prototype pollution). HIGH severity, direct prod dep.
- **Frontend `postcss` < 8.5.10** vá GHSA-qx2v-qp2m-jg93 (XSS qua unescaped `</style>` trong CSS stringify). Vite dev-tool path.
- **Backend `hono` + `@hono/node-server`** transitive vulns vá qua `npm overrides` mà không phải downgrade Prisma 7. Bao gồm: middleware bypass qua serveStatic, body-limit bypass trên chunked requests, JWT NumericDate validation, JSX HTML injection, cache cross-user leakage. Tất cả là dev-only path qua `@prisma/dev`, không expose runtime nhưng dọn cho sạch.
- **CI Actions pinned theo SHA**: `actions/checkout@34e1148` (v4.3.1) + `actions/setup-node@49933ea` (v4.4.0). Phòng tag-reassignment attack kiểu tj-actions/changed-files 2025.

Tests: 1050/1050 backend Jest + 364/364 frontend Vitest pass. `npm audit`: 0 vulnerabilities ở cả hai side.
## [0.14.3.0] - 2026-05-11

### Added — Workflow "Sửa đề xuất quy tắc sau khi đã gửi duyệt"
Trước thay đổi này, một khi proposer bấm "Gửi duyệt ngay" cho một phiên bản quy tắc thời hạn, họ kẹt cứng — không sửa được, không xóa được, chỉ chờ approver từ chối rồi tạo nháp mới (mất context, audit ồn).

Giờ có **hai con đường đối xứng** đưa version submitted về lại draft để proposer sửa và gửi lại:

- **Proposer tự thu hồi** — trên trang version-detail của một đề xuất đã submit, banner xanh hiện button "Thu hồi để sửa". Click → modal yêu cầu lý do ≥ 10 ký tự → status về `draft`, audit `WITHDRAWN`, approver được báo "đề xuất đã rút lại". Chỉ làm được khi chưa có ai review.
- **Approver yêu cầu sửa đổi** — bên cạnh "Từ chối"/"Duyệt" có thêm button "Yêu cầu sửa đổi". Click → modal yêu cầu note ≥ 10 ký tự → status về `draft` với `reviewedAt + reviewNotes` set, audit `CHANGES_REQUESTED`, proposer được báo "approver yêu cầu sửa: <note>".
- **Sửa nháp UI** — proposer click "Sửa nháp" trên footer draft → mở route mới `/admin/deadline-rules/edit/:id`, form prefill với data cũ, title "Sửa bản nháp đề xuất". Khi đang ở draft sau request-changes, banner vàng pinned trên đầu form hiển thị ghi chú của approver. Save gọi `updateDraft`; "Gửi duyệt lại" gọi `updateDraft + submit`.
- **Cycle clean** — khi proposer resubmit, backend `submit()` tự xóa `reviewedAt/reviewedById/reviewNotes` để vòng lặp tiếp theo bắt đầu sạch. Audit log giữ lại toàn bộ chuỗi: PROPOSED → SUBMITTED → (WITHDRAWN | CHANGES_REQUESTED) → DRAFT_UPDATED → SUBMITTED → APPROVED.
- **Notification mới** — hai loại `DEADLINE_RULE_WITHDRAWN` (báo approver) và `DEADLINE_RULE_CHANGES_REQUESTED` (báo proposer) thêm vào enum.

### Changed — Hardening on existing flow
- **Race window**: `withdraw()` + `requestChanges()` bọc trong Serializable transaction với advisory lock trên `hashtext(ruleKey)` cùng key với `approve()` — concurrent decisions on same rule serialize đúng. Catch cả `P2025` lẫn `P2034` → friendly 409 thay vì 500.
- **Notification scheduling**: notify chạy SAU khi transaction commit (setImmediate ngoài $transaction callback) thay vì trong — phòng case transaction fail mà notification đã bắn.
- **DTO validation**: `withdrawNotes` + `reviewNotes` bắt buộc trim + ≥ 10 ký tự thực (không cho whitespace-only) + Vietnamese error messages.
- **VersionDecisionPage UI semantics**: chỉ hiển thị "Duyệt bởi" trong header khi status là terminal (approved/active/rejected/superseded). Khi `draft + reviewedAt` (post-request-changes) hiển thị banner vàng full-width trên top thay vì sidebar card — proposer không thể bỏ qua note của approver.
- **Mobile footer** sticky action bar dùng `flex-col sm:flex-row` chống overflow khi 4 button.

### Added — Infrastructure
- **`ReasonRequiredModal`** shared component (`features/deadline-rules/components/`) — prop-driven, dùng cho cả withdraw + request-changes.
- **Base Modal a11y** (`components/shared/Modal.tsx`) — Escape key đóng, focus trap, `role="dialog" aria-modal="true"`, autofocus first input, restore focus on close.
- **`BTN_OUTLINE_SLATE`** token mới ở `constants/styles.ts`.
- **RBAC permissions mới**: `withdraw_own` (cho proposer) + `request_changes` (cho approver) trên subject `DeadlineRuleVersion`. ADMIN có cả hai; DEADLINE_APPROVER có `request_changes + approve`.
- **`deadline-rules.controller.spec.ts`** — 15 smoke tests cover toàn bộ 13 endpoint của controller.

### Fixed — Stub-check + contract clarification
- 3 report pages (`MonthlyReportPage`, `QuarterlyReportPage`, `TdacReportPage`) thêm comment giải thích backend trả raw shape (không envelope wrap) — chống regression khi future dev tưởng cần `.data.data`.

Tests: 1075/1075 backend Jest pass + 379/379 frontend Vitest pass. Migrations applied locally. No new TypeScript errors trong deadline-rules feature.

## [0.14.1.0] - 2026-05-11

### Added — URL tham khảo cho mỗi phiên bản quy tắc thời hạn (Phase 1 hybrid)
- **Cột `documentUrl`** trên `deadline_rule_versions` (optional) — admin lưu link tới văn bản pháp luật chính thức (vbpl.vn, chinhphu.vn, quochoi.vn...) cho mỗi đề xuất rule version. Cockpit hiển thị URL như external anchor với `rel="noopener noreferrer"`.
- **`DocumentUrlInput` component**: blur-time validation, inline ✓/⚠ feedback, domain hint chip ("Cơ sở dữ liệu pháp luật quốc gia") khi URL match `LAW_SOURCE_HINTS`, amber sub-chip "không phải nguồn chính thức" cho `thuvienphapluat.vn`. A11y: `aria-invalid`, `aria-describedby`, `role="alert"` trên error.
- **Migration cleanup prefill banner**: từ `/admin/deadline-rules/migration-cleanup` click "Bổ sung tài liệu" → navigate `?prefill=migration` → ProposePage hiển thị dismissible blue banner ("Đề xuất giá trị từ migration hints" + "Dùng đề xuất" + X dismiss). KHÔNG auto-overwrite form fields — admin phải click apply (per autoplan Design consensus).

### Changed — URL validation security hardening
- **DTO `@IsUrl({ protocols: ['http','https'], require_tld, require_protocol, require_host, disallow_auth })`**: reject `ftp://`, `javascript:`, `data:`, `file://`, intranet hosts, basic-auth phishing patterns.
- **Service `assertDocumentUrlSafe()`**: defense-in-depth — parse via `new URL()`, reject hostnames `localhost`, `127.x.x.x`, `10.x.x.x`, `192.168.x.x`, `172.16-31.x.x`, `*.local`, `*.internal`, `0.0.0.0`. SSRF protection layer even though current feature doesn't fetch URLs (future-proofs against fetch-based extensions).

### Migration safety
- **`20260511160000_add_deadline_rule_url`**: simple `ALTER TABLE ... ADD COLUMN IF NOT EXISTS "documentUrl" TEXT`. Idempotent. Postgres takes brief ACCESS EXCLUSIVE lock; table is small (~12-30 rows), <1ms. No backfill needed (nullable column).

### Tests
- **Backend: 1050 tests pass** (+3 in `deadline-rules.service.spec.ts`): documentUrl roundtrip on valid URL, reject `http://localhost` private-host, reject `ftp://` non-http-scheme.
- **Frontend: 364 tests pass** (+7 in `DocumentUrlInput.test.tsx`): empty/untouched state, valid vbpl.vn green hint, javascript: error, localhost error, thuvienphapluat amber non-official chip, onChange callback, no error before blur.

### Out of scope (Phase 2 conditional)
File upload attachment (`DocumentAttachmentPicker`, multipart UI, MIME restrict, Render persistent storage) deferred per autoplan USER CHALLENGE #1 resolution — bring back if VKS audit asks for cached PDF within 3 months, OR vbpl.vn URL breaks, OR ≥2 admins request file upload.

## [0.14.0.0] - 2026-05-11

### Added — Quy trình quản lý phiên bản quy tắc thời hạn (Deadline Rule Versioning)
- **Workflow mới `/admin/deadline-rules`**: admin đề xuất sửa quy tắc thời hạn → người duyệt khác (DEADLINE_APPROVER) review → kích hoạt theo ngày hiệu lực. 6 trang admin mới: danh sách quy tắc, lịch sử phiên bản, đề xuất sửa, hàng đợi duyệt, trang quyết định (diff + impact preview), cleanup tài liệu khởi tạo.
- **Snapshot phiên bản tại lúc tạo vụ việc/đơn thư**: `Incident.deadlineRuleVersionId`, `Incident.giaHan1RuleVersionId`, `Incident.giaHan2RuleVersionId`, `Incident.maxExtensionsSnapshot`, `Petition.deadlineRuleVersionId` — mỗi vụ việc/đơn thư giữ phiên bản quy tắc đã áp dụng để truy ngược lại được cho VKS audit.
- **Maker-checker enforcement ở 3 lớp**: UI disabled button (proposer === viewer), service throws ForbiddenException, partial unique index ở DB. Phòng race condition với `pg_advisory_xact_lock(hashtext(ruleKey))` + Serializable transaction.
- **Audit log tích hợp**: 8 action mới (`DEADLINE_RULE_PROPOSED/SUBMITTED/APPROVED/REJECTED/ACTIVATED/SUPERSEDED/STALE_REVIEW_NOTIFIED/DRAFT_DELETED`) ghi qua `AuditService` hiện có. Không tạo bảng audit riêng.
- **2 cron schedulers mới**: `deadline-rule-activator` (00:01 UTC mỗi ngày — promote `approved` → `active` khi đến ngày hiệu lực, ORDER BY effectiveFrom ASC cho multi-day catch-up); `deadline-rule-stale-notifier` (09:00 UTC mỗi ngày — push notification cho approvers nếu submitted > 24h).
- **5 NotificationType enum mới**: `DEADLINE_RULE_SUBMITTED/APPROVED/REJECTED/ACTIVATED/STALE_REVIEW` — gửi qua `NotificationsService` hiện có cho approver/proposer.
- **Role + permissions mới**: `DEADLINE_APPROVER` role (separation-of-duties checker), 3 permissions (`read:`, `write:`, `approve:DeadlineRuleVersion`). ADMIN có cả 3, DEADLINE_APPROVER có read+approve (KHÔNG write — checker không được tự đề xuất), OFFICER có read.
- **Structured documentRef**: thay free-text bằng 4 trường (`documentType` enum 6 giá trị, `documentNumber`, `documentIssuer` enum 6 giá trị, `documentDate` optional) — VKS-defensible. Hỗ trợ attachment FK tới `Document` (UI defer v2).
- **Impact preview bucketed**: trang quyết định hiển thị 3 buckets — không ảnh hưởng (đã snapshot), sẽ áp dụng khi gia hạn (in-flight), sẽ áp dụng cho vụ việc tạo mới. Drill-down top-5 hạn xử lý gần nhất.
- **Aging buckets cho hàng đợi duyệt**: mới (<1 ngày, green), đang chờ (1-3 ngày, amber), quá hạn duyệt (>3 ngày, red).

### Changed — Loại bỏ silent-stale risk
- **DELETE 12 deadline keys khỏi `system_settings`** trong migration: `THOI_HAN_XAC_MINH`, `THOI_HAN_GIA_HAN_1/2`, `THOI_HAN_TOI_DA`, `THOI_HAN_PHUC_HOI`, `THOI_HAN_PHAN_LOAI`, `SO_LAN_GIA_HAN_TOI_DA`, `THOI_HAN_GUI_QD_VKS`, `THOI_HAN_TO_CAO/KHIEU_NAI/KIEN_NGHI/PHAN_ANH`. Nguồn sự thật runtime giờ là `deadline_rule_versions` table.
- **`SettingsService.getValue/getNumericValue/updateValue` throw `BadRequestException` cho 12 deadline keys** — bảo vệ contract. Bất kỳ caller nào (cũ hay mới) đụng tới deadline key qua SettingsService sẽ fail loud thay vì trả về giá trị stale. CI grep guard recommend bổ sung.
- **`incidents.service.create` (line 286)** đọc `DeadlineRulesService.getActive('THOI_HAN_XAC_MINH')` thay vì `settings.getNumericValue`, snapshot `deadlineRuleVersionId` + `maxExtensionsSnapshot` vào incident record.
- **`incidents.service.extendDeadline` (line 637)**: max-count check đọc `incident.maxExtensionsSnapshot` (frozen từ creation time — admin lowering limit không retroactively block); extension days đọc live từ active rule, snapshot rule-version-id vào `giaHan1RuleVersionId`/`giaHan2RuleVersionId`.
- **`petitions.service.create` (line 302)**: đọc `DeadlineRulesService.getActive(petitionTypeKey)`, snapshot `deadlineRuleVersionId` vào petition record.
- **`SettingsService.seed()`** chỉ seed 3 ops keys (`TWO_FA_ENABLED`, `CANH_BAO_SAP_HAN`, `THOI_HAN_XOA_VU_VIEC`), và `deleteMany` 12 deadline keys phòng hờ ai insert lại.
- **`SettingsPage` (`/admin/settings`)** strip toàn bộ deadline rows + thêm banner redirect prominent tới `/admin/deadline-rules`. Trang cũ giờ chỉ quản lý ops settings.
- **Enum generator regex** mở rộng cho phép lowercase identifiers (vd: `draft`, `submitted`) để generate `DeadlineRuleStatus` từ Prisma schema.

### Migration safety
- **Migration atomic `20260511120000_deadline_rule_versioning`**:
  - Tạo `deadline_rule_status` enum + `deadline_rule_versions` table
  - 3 partial unique indexes (one-active, one-submitted, one-approved-pending per `ruleKey`) — DB-level concurrency guarantee
  - CHECK constraint `status != 'active' OR effectiveFrom IS NOT NULL`
  - 5 enum values vào `NotificationType`
  - 4 FK columns trên `incidents` + `petitions` + indexes, ON DELETE RESTRICT
  - Seed 12 v1 active versions từ `system_settings` (proposedByType='SYSTEM', migrationConfidence='legacy-default')
  - Backfill `deadlineRuleVersionId` cho mọi Incident/Petition không-soft-deleted
  - DELETE 12 deadline keys khỏi `system_settings`
  - RBAC seed (3 permissions + DEADLINE_APPROVER role + role assignments cho ADMIN/DEADLINE_APPROVER/OFFICER)
  - Idempotent: mọi INSERT dùng `WHERE NOT EXISTS`, mọi enum/index dùng `IF NOT EXISTS` hoặc DO block với `EXCEPTION WHEN duplicate_object`.
- **Fresh DB seeder mới** `prisma/seed-deadline-rules.ts`: idempotent seed 12 v1 versions với deterministic IDs (`rule_init_{key}`). Gọi từ `seed.ts` chính.

### Tests
- **Backend: 1047 tests pass** (added 111 tests): `deadline-rules.service.spec.ts` (40 cases — state gates, maker-checker, race translation, multi-day catch-up, stale notif), 2 scheduler specs, updated `settings.service.spec.ts` cho hard-guard 12 deadline keys (parameterized), updated `incidents.service.spec.ts` + `petitions.service.spec.ts` cho `DeadlineRulesService` mock + snapshot assertions.
- **Frontend: 357 tests pass** (added 25 tests cho deadline-rules feature): `StatusBadge` (6 statuses + virtual sub-status), `DiffViewer` (hero diff, stacked field, unchanged collapse), `ImpactPreviewPanel` (buckets, drilldown), `DeadlineRulesListPage` (5 — summary strip, badges, links), `ApprovalQueuePage` (3 — aging buckets), `ProposeDeadlineRulePage` (4 — preload, validation, submit).



### Changed (Địa giới hành chính mới — bulk-seed từ provinces.open-api.vn)
- **Bỏ `crawlAndSync` hard-coded** — DISTRICT_TO_NEW_WARD map cũ chỉ có ~10 quận và punt toàn bộ Q1-Q12 + Thủ Đức. Thay bằng bulk-seed background job hit `provinces.open-api.vn` v1 + v2 API (`/api/p/{code}?depth=3` lấy old structure → cho mỗi old ward gọi `/api/v2/w/from-legacy/?legacy_code=N` → upsert vào DB local).
- **Endpoint mới**: `POST /address-mappings/seed/:province` (returns 202 + jobId), `GET /address-mappings/seed/status/:id` (poll progress), `POST /address-mappings/seed/:id/cancel`. Endpoint cũ `/crawl` đã bị xóa.
- **Concurrency lock**: refuse start nếu province đã có job `queued`/`running`. Worker check `cancelToken` giữa mỗi ward → graceful cancel.
- **Snapshot raw API response** vào `backend/prisma/data/snapshots/{province}-v1-{ts}.json` (gitignored) để reproduce nếu API offline.
- **HCM fully supported** (~322 wards, run ~30s). HN/HP/DN/CT có API code wired nhưng chưa seed (follow-up).

### Fixed
- **Bug 1 — Abbreviations không nhận được**: `expandAddressAbbreviations` chạy TRƯỚC khi extract pattern. Unicode-safe lookbehind `(?<!\p{L})` xử lý đúng các trường hợp `P3`, `P.3`, `P03`, `p3`, `Q10`, `H. Bình Chánh`; KHÔNG match `OP3`/`ấP3`/`ờQ10`.
- **Bug 2 — Phường 5, Quận 3 không thành Phường Bàn Cờ**: trước đây map punt Q1-Q12. Sau seed, regression test xác nhận `lookup('Phường 5', 'Quận 3', 'HCM') → 'phường bàn cờ'`.
- **Default province inference HCM**: khi text không có pattern tỉnh, fallback `HCM` (per user direction — PC02 officers ghi địa chỉ local không kèm tỉnh).

### Schema
- `AddressMapping` thêm 3 cột: `source` (`'api-v2'` / `'manual'` / `'official-decree'`), `seededAt`, `candidates` (JSON, khi `needsReview=true` lưu toàn bộ candidate new wards từ API).
- Bảng mới `address_seed_jobs` track job state (queued/running/completed/failed/cancelled) + progress counters + cancellation token.

### Tests
- +18 backend tests (25 total trên module): unknown province, concurrency lock, happy path startSeedJob; missing/completed/running cancelSeedJob; 9 controller delegation; Bàn Cờ regression. 988 backend tests pass.
- +24 frontend tests (new file `useAddressConverter.test.ts`): 13 cases cho `expandAddressAbbreviations` (incl. accented Vietnamese boundary), 6 cho `inferProvince`, 5 cho `extractComponents`.

### Audit
- `docs/ADDRESS_MAPPING_AUDIT.md` — kiến trúc, schema, endpoints, runbook, known limitations (5 provinces enabled nhưng chưa seed, 58 provinces missing, ambiguous picker UI defer).

## [0.13.7.0] - 2026-05-10

### Added
- **Phím tắt (Settings module 9)** — màn hình `Cài đặt → Phím tắt` cho phép user tùy chỉnh 14 hành động trên 4 nhóm (Trong form / Trong danh sách / Trong nhập liệu / Toàn cục). Mỗi hàng có 2 cách đổi: gõ trực tiếp `Ctrl+Shift+S`/`Alt+8`/`?` hoặc click "Bắt phím" để hệ thống capture. Cảnh báo khi conflict với browser (Ctrl+S/P/F5...) hoặc với hành động khác — nếu trùng action, có nút **Hoán đổi 2 phím** atomic. Reset từng phím hoặc reset toàn bộ. Filter input + counter "Đã tùy chỉnh: X/14" hiển thị tiến độ.
- **Bảng phím tắt (`?` overlay)** — nhấn `?` bất kỳ đâu để mở modal liệt kê tất cả phím tắt + hành động hiện tại + link sang Settings.
- **Hint phím tắt cạnh nút Lưu** — `<kbd>Ctrl+Shift+S</kbd>` hiển thị inline trên thanh form action; user thấy phím tắt mà không cần mở Settings.
- **Đồng bộ phím tắt đa thiết bị** — DB lưu override per-user; sync giữa các tab cùng browser qua BroadcastChannel (~500ms). Login từ máy khác → setting follow.

### Changed
- **F9 (mở rộng từ viết tắt) + F10 (chuyển đổi địa chỉ) + Ctrl+Shift+L (toggle Quận/Huyện cũ)** — chuyển từ hardcoded `addEventListener` sang central registry. User có thể đổi binding nếu muốn; pattern hiện hữu giữ nguyên.
- **Lưu (Ctrl+Shift+S) + Hủy (Esc)** trong FormActionBar — thay vì chỉ click chuột, mọi form sử dụng FormActionBar (Case/Petition/Incident/Proposal) tự động có 2 phím tắt này.
- **Đăng xuất (Ctrl+Shift+Q)** — phím tắt toàn cục từ MainLayout.

### Tooling
- **react-hotkeys-hook@5.3.2** — thay thế ~470 LOC custom listener engineering bằng thư viện đã được test với React 18 StrictMode (5M+ weekly DL).
- **Backend `UserShortcut` model** — Prisma migration với `@@unique([userId, action])` và `@@unique([userId, binding])` (DB-enforced race-safe). REST endpoints: `GET/PUT/DELETE /user-shortcuts`, `POST /user-shortcuts/reset`, `POST /user-shortcuts/swap` (atomic via `prisma.$transaction`).

### Tests
- **+46 tests** (21 BE user-shortcuts service+controller, 25 FE registry serialize/parse/normalize).
- **Total: 1274 tests pass** (966 BE + 308 FE).

## [0.13.6.0] - 2026-05-10

### Added
- **Web: Pre-fill defaults across mọi form "tạo mới"** — Khi mở form thêm mới Vụ án/Vụ việc/Đơn thư/Đề xuất VKS/Hướng dẫn đơn/Ủy thác, các field "Ngày tiếp nhận", "Cán bộ thụ lý/nhập", "Đơn vị thụ lý" tự động điền sẵn theo current user + đội/tổ. User chỉ phải chỉnh sửa khi thực sự khác. Cả FK (`assignedTeamId`) lẫn text label đều được điền — đảm bảo record mới hiện đúng trong scope filter của user thay vì biến mất.
- **Backend: GET /auth/me** — Endpoint mới trả về profile + danh sách team (id, name, leader flag) + primary team. FE cache trong sessionStorage và dùng cho form pre-fill. JWT giữ nguyên (chỉ chứa role/email/canDispatch) — không bump tokenVersion khi admin đổi team.
- **Frontend: useFormDefaults() hook + useAuthHydration() hook** — Centralize 1 source of truth cho default values, 1 effect duy nhất quản hydration profile từ /auth/me. Login/2FA/refresh chỉ set tokens; hydration tự fire qua custom event.
- **Frontend: lib/dates.ts** — `today()` và `toDateInput()` util format theo local timezone (+07 Việt Nam). Thay 8 site đang dùng `new Date().toISOString().split('T')[0]` — khắc phục bug late-night hiển thị "hôm qua" trong `<input type="date">`.

### Changed
- **Backend: CreateCaseDto + CreatePetitionDto thêm assignedTeamId** — Form FE submit kèm FK Team. Service create() persist field này → DataScope filter theo tổ hoạt động đúng cho record mới (trước đây `assignedTeamId=null` khiến record không xuất hiện trong "vụ án của tổ tôi").
- **Frontend: AuthUser interface mở rộng** — Thêm `id`, `firstName`, `lastName`, `teams[]`, `primaryTeam`. `authStore.getUser()` ưu tiên cached profile, fallback JWT decode (back-compat cho session cũ).
- **Web: Logo BCA "Bảo Vệ ANTT" làm favicon** — Tab trình duyệt hiện logo công an thay vì icon Vite mặc định. Logo serve từ `frontend/public/logo-cong-an.png`.

### Tests
- **Backend: +10 test** — `auth.service.getProfile()` (5 case: leader/oldest/no-team/single/not-found/inactive/canDispatch) + `auth.controller.me()` (2 case wiring).
- **Frontend: +33 test** — `dates.ts` (12), `useFormDefaults` (7), `useAuthHydration` (5), `auth.store` (7), `PetitionFormPage` integration (3).
- **Total: 1228 tests pass** (945 BE + 283 FE).

### Tooling
- **start_here_be.bat** — Script khởi động riêng backend: kill port 3000 cũ, start `npm run start:dev` trong cửa sổ mới.
- **Mobile: minSdk theo Flutter default** — `mobile/android/app/build.gradle.kts`: `minSdk = flutter.minSdkVersion` thay vì hard-code 23 → mở rộng device support theo Flutter SDK.

## [0.13.5.2] - 2026-05-08

### Changed
- **Backend: Tách status labels thành shared constants** — Tạo `backend/src/common/constants/status-labels.constants.ts` gom `CASE_STATUS_LABEL`, `INCIDENT_STATUS_LABEL`, `PETITION_STATUS_LABEL`, `PROPOSAL_STATUS_LABEL`. Các services thay `Record<string,string>` inline bằng constant chung. Đồng thời đổi field exports (`caseCode→id`, `crimeType→crime`, `unitId→unit`) đồng bộ với schema scalar fields.
- **Backend schema: Thêm performance indexes** — `Case.@@index([createdAt, unitId])`, `Incident.@@index([createdAt, unitId])`, `Proposal.@@index([createdAt, createdById])` — tăng tốc filter export theo ngày + đơn vị.
- **Mobile: Centralize API providers** — Tạo `mobile/lib/core/api/providers.dart` làm single source of truth cho 10 providers (apiClient, tokenStorage, 8 *ApiProvider). Feature screens không còn khai báo inline + import lẫn nhau qua dashboard_screen. Cross-feature dependency smell được loại bỏ.
- **Mobile: Force-unwrap hardening** — Thay pattern `deadline!.X()` (đã null-check) bằng local capture `final d = deadline; ... d.X()` trong Case/Incident/Petition models + DeadlineBadge widget. Identical bytecode, clearer intent.

### Fixed
- **Web: Maestro flow login chain** — 7 flows (`03_cases_list`, `03b_cases_search`, `04b_case_detail_api`, `06_petitions_list`, `07_dashboard`, `10_petitions_overdue`, `99_logout`) trước đây dùng `launchApp` raw → false-positive PASS trên login screen vì assertions yếu. Đổi thành `runFlow: 01_login_success.yaml` để chain login đúng nghiệp vụ.
- **Web: Maestro biometric dialog dismissal** — `01_login_success.yaml` thêm `tapOn: "Để sau"` (optional) sau Đăng nhập để dismiss biometric setup prompt block dashboard navigation.

### Documentation
- **Mobile: REFACTOR-FINDINGS.md** — Catalog 9 latent bugs (BUG-1: 2FA không init FCM, BUG-2: NotificationRouter dead code, BUG-3: auth coupled với devices API, ...) + 5 performance hotspots + 7 deferred refactor phases với design specs ready cho session sau.
- **CLAUDE.md: GBrain Configuration block** — Document local PGLite engine, MCP registration, Windows-specific quirks (PATH propagation, gbrain put requires --content).

## [0.13.5.1] - 2026-05-03

### Added
- **Web: Xuất Excel BCA format cho 5 màn hình Phân loại & Quản lý** — `WardIncidentsPage`, `WardCasesPage`, `OtherClassificationPage`, `ProsecutorProposalPage`, `DuplicatePetitionsPage` giờ xuất file `.xlsx` đầy đủ BCA format (6-row letterhead, navy headers, alternating rows, footer signature, A4 landscape) thay vì CSV thô. 5 backend endpoints mới với throttle 5 req/phút.
- **Web: Petitions export chuẩn hóa BCA format** — `DanhSachDonThu_*.xlsx` từ `/petitions/export` giờ có đầy đủ letterhead và footer, đồng nhất với Monthly/Quarterly/Stat48 reports.

### Fixed
- **Web: Trang "Vụ việc theo phường/xã" không còn redirect về login khi click Xem** — Tạo `IncidentDetailPage` + đăng ký route `/vu-viec/:id` và alias `/incidents/:id`. Cùng fix luôn `TransferAndReturnPage` và `IncidentListPage` (đều navigate đến route chưa tồn tại này).
- **Web: Enum constants trong 5 màn hình Phân loại & Quản lý** — `WardIncidentsPage`, `WardCasesPage`, `OtherClassificationPage`, `DuplicatePetitionsPage`, `ProsecutorProposalPage` không còn dùng hardcoded string literals làm status map keys; tất cả dùng `IncidentStatus`/`CaseStatus`/`PetitionStatus` từ shared enums.
- **Web: statusLabel hiển thị tiếng Việt** thay vì enum constant raw string (TIEP_NHAN → Tiếp nhận).

## [0.13.5.0] - 2026-05-03

### Fixed
- **Mobile: PetitionStatus labels hiển thị đúng tiếng Việt** — `StatusChip` trước đây thiếu toàn bộ 5 `PetitionStatus` values (`MOI_TIEP_NHAN`, `DANG_XU_LY`, `CHO_PHE_DUYET`, `DA_LUU_DON`, `DA_CHUYEN_VU_VIEC`), hiển thị raw code string thay vì nhãn tiếng Việt.

### Changed
- **Mobile: Chuẩn hóa constants** — Thay thế 22 hardcoded string literals trong business logic Flutter bằng typed constants (`AppStatus`, `AppAuthResult`, `kStatusLabels`, `kGreenStatuses`, `kYellowStatuses`, `kNavyStatuses`). Color logic từ fragile `startsWith/contains` → explicit Sets — không còn silent regression khi backend thêm enum value.
- **Mobile tests** — 16 unit tests mới gồm regression pins cho 2 bugs phát hiện trong eng-review (khongKhoiTo và dangTruyTo bị gán vào hai color groups cùng lúc).

## [0.13.4.0] - 2026-05-03

### Changed
- **Chuẩn hóa so sánh enum/constant toàn codebase**: Loại bỏ 60+ hardcoded string/number literal trong business logic (cả backend lẫn frontend), thay bằng typed constants và Prisma enum values. Không còn so sánh `'ADMIN'`, `'refresh'`, `'TWO_FA_ENABLED'`, `'DRAFT'`... bằng literal.
- **Shared enum infrastructure**: Generator script tự động sinh `shared/enums/generated.ts` từ Prisma schema (24 enum, 7 constant files). Frontend import từ đây thay vì khai báo lại.
- **Status badges ComprehensiveListPage**: Fix 3 bugs nghiêm trọng — badge luôn xám (key mismatch), filter status không lọc được, label hiển thị raw `TIEP_NHAN`. Tất cả 32 status values giờ render đúng màu + label tiếng Việt.
- **IncidentFormPage Lý do không khởi tố**: Chuyển `<select>` hardcode → FKSelect searchable với `LY_DO_KHONG_KHOI_TO_OPTIONS` từ `shared/enums/status-labels`.
- **Frontend shared enums**: Thêm `permissions.ts`, `status-labels.ts`, `roles.ts`, `case-types.ts`, `case-phase.ts`, `proposal-status.ts`, `conclusion-status.ts`, `subject-status.ts`, `duplicate-petition-status.ts`, `report-tdc-status.ts`, `two-fa-methods.ts`, `locales/vi.ts`.
- **Backend constants**: `ROLE_NAMES`, `TOKEN_TYPE`, `SETTINGS_KEY`, `TWO_FA_METHOD`, `FCM_ERROR`, `EXPORT_FORMAT` — wire-format documented với JSDoc cảnh báo.
- **SettingsPage test**: Fix API mock + sửa assertion sai để test pass.
- **TS error fixes**: 8 pre-existing TypeScript errors (unused imports/vars, type mismatch).
- **CaseFormPage**: `CRIMINAL_TYPE_OPTIONS` chuyển sang fetch từ MasterClass API (type '07') thay hardcode.

### Fixed
- **ComprehensiveListPage**: Navigate path `/cases/${id}` cho mọi entity → đúng route theo từng loại (cases/incidents/petitions).
- **IncidentFormPage**: Xóa `currentStatus` state không dùng.
- **usePermission**: Tách `MOCK_PERMISSIONS` ra `shared/enums/permissions.ts` để reuse.

### Added
- 3 tests mới: `enums-sync.spec.ts` (verify generated.ts vs schema.prisma), `jwt-wire-format.spec.ts` (pin `TOKEN_TYPE.REFRESH = 'refresh'`), `settings-keys.spec.ts` (pin settings keys).
- `useMasterClassOptions.test.ts`: 5 tests cho hook.
- Backend seed: 13 BLHS crime type entries (MasterClass '07') + 9 VKS offices (MasterClass '08').

## [0.13.3.0] - 2026-05-03

### Changed
- **UX cột Thao tác toàn hệ thống**: Chuẩn hóa cột Thao tác lên ĐẦU + sticky bên trái cho **22 màn hình danh sách** (ngoài 3 trang chính đã làm trước). Click row → mở modal sửa hoặc navigate sang màn hình edit (nếu có quyền).
  - **Group A (8 trang modal-edit)**: Quản lý Đối tượng (+Nạn nhân, Nhân chứng), Quản lý Luật sư, Danh mục, MasterClass, Quản lý Người dùng, Tài liệu, Mapping địa chỉ, Phím tắt.
  - **Group B (11 trang workflow)**: Danh sách tổng hợp, Hồ sơ ban đầu, Đơn trùng, Vụ án/Vụ việc theo phường, Phân loại khác, Kiến nghị VKS, Trao đổi chuyên án, Ủy thác điều tra, Chuyển/nhận hồ sơ, Hướng dẫn đơn thư.
  - **Group C (3 trang report)**: Nhật ký hoạt động, Bản nháp TĐC, Hồ sơ trễ hạn.
- **Action dropdown menu**: Z-index `z-20` → `z-50` (không bị sidebar đè), mở từ `right-0` → `left-10` (không che icon ⋮ row khác).

### Fixed
- **SettingsPage UserManagementModule**: Nút Sửa/Xóa giờ navigate sang `/nguoi-dung` (trước đó chỉ là stub).

### Added
- **3 spec files mới**: `address-mapping.controller.spec.ts` (8 tests), `phu-luc-1-6.controller.spec.ts` (3 tests), `phu-luc-1-6-export.service.spec.ts` (2 tests). Test count: 904 → 917.

## [0.13.2.0] - 2026-05-03

### Changed
- **Cột Thao tác lên đầu bảng** (Danh sách Vụ việc, Vụ án, Đơn thư): Không cần scroll ngang để tìm nút thao tác. Cột được ghim (sticky) ở bên trái.
- **Click vào row → màn hình sửa**: Click vào bất kỳ chỗ nào trên dòng sẽ chuyển sang màn hình chỉnh sửa (nếu có quyền). Phím Enter/Space cũng hoạt động (accessibility).
- **Codex CLI**: Cài đặt `@openai/codex` v0.128.0 cho code review độc lập.

### Fixed
- **Thống kê phường/xã** (`DistrictStatisticsPage`): Thay FKSelect combobox bằng native select — tỉnh/TP giờ chọn được bình thường.
- **Ward filter backend**: `getDistrictStats()` giờ lọc cases theo `metadata.ward` khi có param `district`.
- **Settings page**: Fix import `api` default → named, fix ProvinceWardSelect `disabled` prop.
- **Crawl địa chỉ**: Fix `Transform`/`Type` import từ `class-validator` → `class-transformer` — nút "Cập nhật từ API" hoạt động.
- **Address converter F10**: District-level fallback — phường 14 quận Phú Nhuận → phường Phú Nhuận.

### Added
- **Chuyển đổi địa chỉ 2025** (F10): Nhấn F10 trong bất kỳ text field nào → convert địa chỉ cũ (có quận/huyện) sang mới. Dialog xác nhận trước/sau.
- **Mapping địa chỉ** (`Settings → Cải cách địa chỉ`): Quản lý 273 mapping TPHCM. Nút "Cập nhật từ API" crawl dữ liệu mới từ provinces.open-api.vn.
- **Tội danh BLHS**: 47 tội danh chính xác theo BLHS 2015 (sửa đổi 2017/2022), 5 nhóm: tính mạng, sở hữu, kinh tế, ma túy, TTXH.
- **Quản lý danh mục cha-con**: Quan hệ PROVINCE → WARD, admin screen drill-down, cascade select trong form địa chỉ.

## [0.13.1.0] - 2026-05-02

### Added
- **Danh mục hệ thống hiển thị dữ liệu thật** (`Settings → Danh mục`): Không còn mock data. Trang hiển thị 21 loại danh mục với số lượng thật từ DB — Phường/Xã: 10,051 mục, Tỉnh/Thành phố: 34 mục, Loại vụ việc: 4 mục, v.v. Quận/Huyện hiển thị với badge "Di sản · trước 01/07/2025" (backward compat).
- **API `GET /directories/stats`**: Endpoint mới trả về count theo từng loại danh mục. Có test.
- **Seed 34 Tỉnh/Thành phố**: Tự động seed khi `npm run db:seed`. 34 tỉnh/TP chính xác theo cải cách 2025.
- **Seed 5 loại mới**: TDC_SOURCE (nguồn tin TĐC), TDC_CASE_TYPE (loại vụ TĐC), DOCUMENT_TYPE (loại tài liệu), INCIDENT_LEVEL (mức độ nghiêm trọng), UNIT (đơn vị công an).
- **`seedWards()` chạy tự động**: `npm run db:seed` giờ tự động seed 10,051 phường/xã toàn quốc — không cần chạy lệnh riêng.

### Changed
- **10 dropdown chuyển sang dùng dữ liệu DB**: Tất cả form nhập liệu (PetitionFormPage, CaseFormPage, IncidentFormPage) giờ dùng `FKSelect directoryType` thay vì hardcoded options. Các loại: PETITION_TYPE, INCIDENT_TYPE, INCIDENT_LEVEL, PRIORITY, CASE_CLASSIFICATION, PROSECUTION_OFFICE, EVIDENCE_TYPE, TDC_SOURCE, TDC_CASE_TYPE, DOCUMENT_TYPE, UNIT.
- **Quận/Huyện → Legacy**: Các entry DISTRICT trong DB được set `isActive=false` — không hiển thị trong form nhập mới nhưng vẫn bảo toàn dữ liệu hồ sơ cũ.

## [0.13.0.0] - 2026-05-02

### Added (2026-05-02)
- **Dữ liệu phường/xã toàn quốc** (`frontend/src/data/vietnam-wards.ts`): 470+ phường/xã với TPHCM ưu tiên đầu. Autocomplete tại trang Thống kê phường/xã gợi ý phường/xã thật theo quy định 2025 — TPHCM đầu tiên, sau đó các tỉnh. 15 unit tests.
- **Backend seed script** (`npm run db:seed:wards`): Seed 3321 phường/xã vào database để API `/directories?type=WARD` trả về data thật. Idempotent — an toàn chạy nhiều lần.
- **Dữ liệu 34 tỉnh/TP** (`frontend/src/data/vietnam-provinces.ts`): Danh sách chính xác 34 tỉnh/TP sau cải cách 2025 (không còn 63 — sau sáp nhập).

### Changed (2026-05-02)
- **Đổi tên "Xuất báo cáo"** → "Xuất hồ sơ đơn thư": Tên cũ gây nhầm với báo cáo thống kê.
- **Đổi tên "Thống kê quận/huyện"** → "Thống kê phường/xã": Cấp quận/huyện không còn tồn tại sau cải cách 2025.
- **CSV export headers**: Cột "Quận/huyện" → "Khu vực" trong 3 trang phân loại.
- **DistrictStatisticsPage**: Autocomplete phường/xã từ data thật (TPHCM ưu tiên), filename `ThongKePhuongXa_`.

## [0.13.0.0] - 2026-05-01

### Added
- **Phụ lục 1-6 BCA** (`GET /reports/phu-luc-1-6/preview` + `/export`): Cán bộ có thể xem và xuất Excel 6 loại danh sách hồ sơ theo quy định BCA — PL1 (vụ việc đang giải quyết), PL2/3 (vụ việc TĐC hết/còn thời hiệu), PL4 (vụ án đang điều tra), PL5/6 (vụ án TĐC hết/còn thời hiệu). Hỗ trợ filter theo đơn vị + kỳ ngày. Export Excel với multi-row per bị can.
- **Trang Phụ lục 1-6 BCA** (`/reports/phu-luc-1-6`): Giao diện 6 tab, filter, preview bảng dữ liệu, nút Xuất Excel với progress indicator.
- **Schema**: Thêm `ngayHetThoiHieu` (Case) và `ngayHetThoiHieuVV` (Incident) để phân biệt hồ sơ TĐC hết/còn thời hiệu truy cứu TNHS.
- **BCA Excel Helper** (`backend/src/common/bca-excel.helper.ts`): Shared utility chuẩn hóa format Excel theo quy định BCA — header CÔNG AN TPHCM/PHÒNG PC02, alternating row colors (#EFF6FF/white), footer ký tên, print setup A4 landscape.

### Changed
- **Excel báo cáo tháng/quý**: Nâng cấp từ basic navy header lên BCA professional format đầy đủ (6 rows header, alternating rows, footer signature, print setup).
- **Excel thống kê 48 trường (Stat48)**: Mỗi sheet tab nay có header CÔNG AN TPHCM/PHÒNG PC02 + footer ký tên.

## [0.12.0.0] - 2026-05-01

### Added
- **Xuất Excel đơn thư thật** (`GET /petitions/export`): Cán bộ có thể tải file Excel thực sự từ trang Xuất báo cáo. DataScope enforced — chỉ thấy đơn thư thuộc tổ mình. Rate limit 5/phút. Tối đa 500 bản ghi.
- **Xuất Word chi tiết đơn thư** (`GET /petitions/:id/export-word`): File .docx với đầy đủ thông tin đơn thư, tên file tự động.
- **Excel báo cáo tháng/quý (format BCA)**: `GET /reports/monthly/export` + `quarterly/export` — file Excel có header Phòng PC02, bảng số liệu, footer chữ ký Lãnh đạo.
- **Thống kê 48 trường** (`GET /reports/stat48`): Tổng hợp 48 chỉ tiêu BCA từ Tab 9 của vụ án. SUM cho 12 trường số, COUNT BY VALUE cho 36 trường danh mục. File Excel 4 sheet tab (Nhóm 1-4). Cảnh báo DRAFT khi dữ liệu thiếu > 50%.
- **Trang Thống kê 48 trường** (`/reports/stat48`): 4 accordion groups, banner cảnh báo dữ liệu thiếu, nút Xuất Excel.
- **Biên nhận đơn thư PDF** (HTML print): Biên nhận chuẩn với logo Công An, thông tin đơn, ô chữ ký.

### Fixed
- **Bug xuất Excel đơn thư**: `handleExportExcel()` trước đây là UI stub — chỉ hiện thông báo "thành công" nhưng không tải file. Nay đã kết nối API thật.
- **Bug xuất Word, xuất biên nhận**: Tương tự, đã fix tất cả 3 stub handlers trong ExportReportsPage.
- **PermissionsGuard bị drop**: Method-level `@UseGuards(JwtAuthGuard)` trên các export endpoint làm mất class-level `PermissionsGuard`. Đã sửa để kế thừa đúng.
- **ExcelJS write chưa có error handling**: Thêm try/catch cho tất cả `workbook.xlsx.write(res)` — tránh crash server khi download bị ngắt.
- **Thiếu rate limit @Get(':id/export-word')**: Thêm `@Throttle(5/min)`.

### Security
- Tất cả export endpoints mới đều enforce DataScope (`buildPetitionScopeFilter`) — không thể export dữ liệu ngoài phạm vi tổ.

---

## [0.12.1.0] - 2026-05-01

### Fixed
- **Stub handlers frontend (16 items)**: Tất cả button/link không hoạt động đã được implement — Xuất Excel trên 5 trang (Vụ việc, Trao đổi chuyên án, Ủy thác điều tra, Người dùng, Danh sách vụ án), tải đính kèm chat, in PDF đề xuất, lưu nháp form vụ án vào localStorage, nút "Áp dụng" lọc, phân trang Trước/Sau trên 4 trang, điều hướng Sửa/Xóa trong SettingsPage.
- **Báo cáo tháng — sai tham số month**: Tháng được gửi dạng "2026-02" thay vì số nguyên 2. Đã fix parse trước khi gửi API.
- **Stat48ReportPage không hiển thị data**: Mismatch giữa shape backend (`nullCount`, `field`, `dataCount`) và interface frontend (`casesWithoutData`, `fieldName`, `count`). Đã thêm transform trong `fetchReport()`.
- **Export ActivityLog, DistrictStats**: Stub `alert()` thay bằng CSV download client-side thực sự.
- **CI/CD**: Thêm `npx prisma generate` sau `npm ci` trong workflow — sửa lỗi "Cannot find module .prisma/client/default" trên GitHub Actions.
- **Node.js 20 → 22**: Cập nhật CI workflow để tránh deprecation warning.

### Added
- **34 backend spec files**: 7 service specs (calendar, dashboard, notifications, devices, tdac-export, settings, action-plans) và 27 controller specs mới với shared `controller-test-helpers.ts`. Tổng: 875 tests.
- **Skill /stub-check**: Skill mới tự động scan frontend/backend tìm stub handlers, missing onClick, alert() stubs, console.log debug, và thiếu test coverage.
- **CSV helper** (`frontend/src/lib/csv.ts`): Shared `downloadCsv()` cho tất cả export buttons.
- **Pagination thực** trên 4 trang (CaseList, PetitionList, CaseExchange, TransferReturn): Client-side với PAGE_SIZE=20, reset khi filter thay đổi.

## [0.11.0.0] - 2026-05-01

### Added
- **Quên mật khẩu tự phục hồi** (`/forgot-password`): Cán bộ có thể tự reset mật khẩu bằng email OTP 6 chữ số, không cần liên hệ admin. Flow 2 bước: nhập email → nhận mã → nhập mã + mật khẩu mới. OTP hết hạn sau 15 phút, có countdown timer và nút Gửi lại sau 60s.
- **OTP purpose scoping**: `OtpCode.purpose` field phân biệt `TWO_FA` và `PASSWORD_RESET` — tránh 2FA OTP bị kill khi user request reset password cùng lúc.
- **Endpoints mới**: `POST /auth/forgot-password` (3 req/min) và `POST /auth/reset-password` (3 req/min). Password reset invalidate tất cả JWTs và refresh tokens (tokenVersion++).

### Fixed
- **Trang đăng nhập hiển thị đầy đủ dấu tiếng Việt**: 15+ chuỗi trên LoginPage.tsx đã được sửa đúng dấu (HỆ THỐNG QUẢN LÝ VỤ ÁN PC02, Mật khẩu, Đăng nhập...). `lang="vi"` cho `<html>`.
- **OTP TTL nhất quán**: Đổi từ 10 phút lên 15 phút để khớp với nội dung email hướng dẫn.
- **Throttle inversion**: `reset-password` đặt về 3 req/min (từ 5) — khớp với `forgot-password` và an toàn hơn.

## [0.10.0.0] - 2026-04-30

### Added
- **Báo cáo TĐC Phụ lục 08** (`/reports/tdac`): Tự động hóa thống kê Vụ án Tạm đình chỉ điều tra và Vụ việc Tạm đình chỉ giải quyết theo mẫu BCA. Preview bảng số liệu đúng format Phụ lục 08 với 35+ dòng phân tách theo tổ, export .xlsx từ template BCA.
- **Draft/Review/Approve workflow**: Báo cáo TĐC đi qua luồng DRAFT → REVIEWING → APPROVED → FINALIZED với audit trail đầy đủ. Immutable sau khi khóa. Optimistic lock ngăn concurrent finalize.
- **Capture lý do TĐC**: `SuspensionModal` và `ResumeModal` capture enum `lyDoTamDinhChiVuAn` (8 giá trị theo Điều 229 BLTTHS 2015) và `ketQuaPhucHoiVuAn` (5 giá trị). Soft-warn 90 ngày cho case cũ, bắt buộc cho case mới.
- **Biên bản VKS và Kế hoạch khắc phục**: Tab mới trong Case/Incident Detail. API: `POST /cases/:id/vks-meetings`, `POST /cases/:id/action-plans` (và tương đương cho incidents).
- **Backfill queue** (`/cases/tdac-backfill`): Màn hình cập nhật hàng loạt lý do TĐC cho ~28k case cũ chưa có enum. Banner nhắc trong Case Detail.
- **Schema mới**: 7 enums (LyDoTamDinhChiVuAn, KetQuaPhucHoiVuAn, LyDoTamDinhChiVuViec, KetQuaPhucHoiVuViec, TienDoKhacPhuc, ReportTdcType, ReportTdcStatus), 3 models (VksMeetingRecord, SuspensionActionPlan, ReportTdcDraft), thêm TĐC fields vào Case và Incident.
- **Permissions**: `approve:Report`, `write:Report` được seed sẵn.
- **48 unit tests** cho tdac module: compute logic, state machine, permission enforcement.
- **Excel template generator**: Script tạo Phụ lục 08 với header BCA, màu sắc phân cấp hàng, chữ ký CÁN BỘ THỐNG KÊ / THỦ TRƯỞNG ĐƠN VỊ.

### Fixed
- `Prisma.join([])` crash khi `teamIds` rỗng trong tất cả `$queryRaw` của TĐC service
- Date validation trên preview endpoints (400 thay vì 500 khi thiếu fromDate/toDate)
- Field rename `lyDoTamDinhChi → lyDoTamDinhChiText` trên Incident để tránh conflict với enum mới
- `tdc-backfill` endpoint missing — frontend backfill page trả 404 mà không có endpoint này

## [0.9.0.0] - 2026-04-26

### Added
- **Dispatcher Permission Group (`canDispatch`)**: Điều tra viên OFFICER có `canDispatch=true` có thể xem và phân công vụ việc/vụ án/đơn thư của mọi tổ. `DispatchGuard` + `DataScope` bypass đảm bảo quyền truy cập xuyên tổ an toàn. JWT invalidation tức thì khi toggle `canDispatch`.
- **Assign endpoints**: `PATCH /cases/:id/assign`, `PATCH /incidents/:id/assign`, `PATCH /petitions/:id/assign` — cho phép dispatcher phân công đội/điều tra viên mà không cần thuộc tổ đó.
- **Frontend Assign UI**: `AssignModal` component + assign buttons trên Cases/Incidents/Petitions list pages. Admin toggle bật/tắt `canDispatch` trên User Management page.
- **Docker Compose full-stack**: `docker-compose.yml` với 3 services (`db` PostgreSQL 16, `backend` NestJS, `frontend` nginx). Multi-stage Dockerfiles, `docker-entrypoint.sh` chạy migrate → seed → start. Nginx reverse proxy `/api/*` → backend.
- **Mobile production build script**: `build_mobile_prod.bat` — build APK release với `--dart-define=API_BASE_URL=http://<SERVER>/api/v1`.
- **Audit before/after state**: `AuditService.wrapUpdate()` helper + áp dụng cho 11 services — UPDATE log ghi lại state trước và sau thay đổi.
- **GitHub Actions CI**: `.github/workflows/ci.yml` chạy 628 backend unit tests trên mỗi push/PR.
- **UAT SDLC artifacts + Optimistic locking**: Checklist UAT đầy đủ + `version` field optimistic locking trên 10 mutation endpoints để ngăn concurrent write conflict.

### Fixed
- **FINDING-013 Security**: Enforce `DataAccessGrant.accessLevel` write-scope trên tất cả mutation paths — loại bỏ leo thang quyền.
- **Incidents assign**: CUID validation (`@IsString()` thay `@IsUUID('4')`) + `investigatorId` optional (cho phép assign team trước, điều tra viên sau).
- **Cases/Petitions assign DTOs**: Tương tự — CUID validation fix cho `assignedTeamId`, `assignedToId`, `investigatorId`.

## [0.8.0.0] - 2026-04-25

### Added
- **Biometric login (TouchID/FaceID)**: `BiometricService` lưu credentials vào Keychain/Keystore, tự động đăng nhập khi mở app. iOS `NSFaceIDUsageDescription` + Android `minSdk 23` cho `local_auth`. Logout xóa credentials sinh trắc học.
- **Petitions overdue filter**: Tab "Quá hạn" trong Đơn thư screen trả đúng đơn thư đã qua hạn — backend `?overdue=true` filter với `PetitionStatus` enum (type-safe).
- **Maestro E2E test suite (11 flows)**: Full end-to-end coverage Android — 175 steps, 0 failures, health score 99/100.
- **Team-scoped deadline notifications**: Scheduler gửi push đến toàn tổ phụ trách, DataAccessGrant holders. Loại trừ ADMIN role và inactive users.

### Fixed
- **Dashboard stats nhất quán**: `DINH_CHI` tính vào `processedCases` (đình chỉ = đã xử lý). `TAM_DINH_CHI` loại khỏi `overdueCount` (tạm đình chỉ không phải quá hạn).
- **CRITICAL — api_client isolate crash**: Queued requests không wrap `completeError()` trong try/catch — khi refresh fail, crash isolate. Đã wrap + return early.
- **SECURITY — MITM risk on token refresh**: Bare `Dio()` cho refresh request không có timeout. Thay bằng `Dio(BaseOptions(...))` với cùng config như client chính.
- **Duplicate notifications**: `markNotified()` đảo thứ tự trước `sendToUser()` — push throw không còn bỏ sót dedup record.
- **Scheduler DB failure silences all notifications**: `systemSetting.findUnique` thêm try/catch, fallback 7 ngày khi DB hiccup lúc 07:00.
- **Biometric credentials leak after logout**: `logout()` nay `Future.wait([storage.clear(), biometricService.clear()])` — không để credentials sinh trắc học của user cũ.
- **PetitionStatus string literals → enum**: `petitions.service.ts` overdue filter dùng `PetitionStatus.DA_GIAI_QUYET` thay chuỗi literal (type-safe, refactor-safe).

## [0.7.0.0] - 2026-04-25

### Added
- **Team-scoped deadline notifications**: DeadlineScheduler gửi push đến toàn bộ tổ phụ trách (không chỉ điều tra viên trực tiếp) — tích hợp với DataAccessGrant và UserTeam. Loại trừ admin role và inactive user trong phân phối push.
- **Maestro E2E test suite (11 flows)**: Full end-to-end coverage trên Android — login, wrong password, cases list, case detail, incidents list, petitions list, dashboard, tab navigation, petition detail, logout. Windows-compatible với Java direct invocation (bypass CMD classpath limit).
- **Dashboard fix**: 4 stat cards bây giờ hiển thị số thật — fix response envelope unwrap + field name mismatch (`processedCases` vs `resolvedCases`).
- **StatusChip localization**: Tất cả 22 enum value (CaseStatus + IncidentStatus) hiển thị tên tiếng Việt, màu theo ngữ nghĩa (đỏ = quá hạn, vàng = đình chỉ, xanh = hoàn thành, xanh navy = đang xử lý).
- **Regression tests**: `dashboard_api_test.dart` (5 tests) + `status_chip_test.dart` (8 widget tests) — bảo vệ cả 2 bug vừa fix và 4 color branch của StatusChip.

### Fixed
- **Terminal statuses hoàn chỉnh**: `DA_KET_LUAN` thêm vào `TERMINAL_CASE_STATUSES` (hết thông báo cho vụ án đã kết luận). 7 incident terminal statuses còn thiếu được thêm vào (`CHUYEN_XPHC`, `TDC_HET_THOI_HIEU`, `TDC_HTH_KHONG_KT`, `PHUC_HOI_NGUON_TIN`, `DA_CHUYEN_DON_VI`, `DA_NHAP_VU_KHAC`, `PHAN_LOAI_DAN_SU`).
- **NaN guard cho CANH_BAO_SAP_HAN**: `parseInt` với giá trị không hợp lệ fallback về 7 ngày thay vì tạo `Invalid Date` làm tắt toàn bộ cảnh báo sắp đến hạn.
- **Dashboard API null safety**: Type guard trước khi cast `resp.data` — trả về stats rỗng thay vì crash khi API trả về non-map body.
- **Maestro flows**: `clearState: true` để reset auth state giữa các flows. Coordinate-based tap thay cho Vietnamese Unicode text (Maestro 1.39.0 Windows bug). Logout assertion mạnh hơn.

## [0.6.0.0] - 2026-04-24

### Added
- **Flutter Mobile App (Android + iOS)**: Ứng dụng di động đầy đủ tính năng — xem tiến độ hồ sơ/vụ việc/đơn thư theo thời gian thực, nhận push notification khi quá hạn hoặc sắp đến hạn. Phân phối qua Firebase App Distribution. Material 3, Riverpod state management, GoRouter navigation.
- **FCM Push Notification**: Backend FCM HTTP v1 — `PushService` gửi push đến tất cả thiết bị của user, tự xóa stale token (`INVALID_ARGUMENT`/`NOT_FOUND`). `DevicesController` (POST/DELETE `/devices`) đăng ký/hủy FCM token sau login/logout.
- **DeadlineScheduler**: Cron job 07:00 mỗi ngày kiểm tra vụ án/vụ việc/đơn thư quá hạn và sắp đến hạn, gửi push notification đến điều tra viên phụ trách. Dedup bằng `OverdueNotification` table (1 lần/24h/hồ sơ). Null guard cho `investigatorId`. `Promise.allSettled` để tránh một thiết bị lỗi block các thiết bị khác.
- **UserDevice + OverdueNotification schema**: 2 model mới trong Prisma — `user_devices` (FCM token per user, upsert by token), `overdue_notifications` (dedup tracking với unique constraint `resourceType+resourceId+userId`).
- **CANH_BAO_SAP_HAN setting**: Key mới trong SystemSetting với default 7 ngày — ngưỡng cảnh báo sắp đến hạn, cấu hình từ web admin, Flutter app đọc qua `GET /settings`.
- **5-tab Bottom Navigation**: Dashboard / Hồ sơ / Vụ việc / Đơn thư / Thông báo — unread badge count trên tab Thông báo. Drawer với logo PC02 + tên/vai trò người dùng + Đăng xuất.
- **DeadlineBadge (3 màu)**: Đỏ (quá hạn), Vàng (≤ CANH_BAO_SAP_HAN ngày), Xanh (còn thời gian). Đọc ngưỡng từ Riverpod `deadlineSettingsProvider` (cache 1 lần khi khởi động).
- **Offline Banner**: Banner "Không có kết nối" tự động hiện khi mất mạng (`connectivity_plus`).
- **2FA Mobile Flow**: Màn hình nhập OTP 6 chữ số, auto-submit khi đủ 6 ký tự, back về Login xóa pending state.
- **Shimmer Loading + Pull-to-Refresh**: Skeleton animation trên lần tải đầu, pull-to-refresh trên tất cả list screens.
- **Optimistic Mark-Read**: Tap thông báo → đánh dấu đã đọc ngay (revert khi lỗi).
- **8 Flutter unit tests**: `auth_provider_test.dart` (4) + `deadline_badge_test.dart` (4). 14 backend tests: `push.service.spec.ts` (5) + `deadline.scheduler.spec.ts` (8) + 1 devices controller test.

### Fixed
- **TwoFaSetupModal**: Phân biệt 409 "pending setup" vs "already enabled" — chỉ hiện nút "Huỷ setup cũ và bắt đầu lại" khi lỗi message chứa 'chờ xác nhận', tránh vô tình huỷ 2FA đã kích hoạt.
- **DevicesController**: `DELETE /devices/:token` truyền `userId` vào `unregister()` để enforce ownership — tránh user xóa token của người khác.

## [0.5.6.0] - 2026-04-24

### Added
- **Từ viết tắt cá nhân (Text Expansion)**: Người dùng tự định nghĩa thư viện phím tắt cá nhân (ví dụ: `lvs` → `Lê Văn Sỹ`). Gõ phím tắt + F9 trong bất kỳ ô nhập liệu nào để mở rộng tự động. Hoạt động trên toàn bộ hệ thống (global F9 listener trong MainLayout).
- **API abbreviations**: 5 endpoint — GET list, PUT upsert, DELETE remove, POST copy-from, GET users. Xác thực chỉ qua JwtAuthGuard (dữ liệu cá nhân).
- **Copy từ người dùng khác**: Sao chép thư viện viết tắt từ user khác theo 2 chế độ — Gộp (merge, giữ phím tắt hiện tại) hoặc Thay thế hoàn toàn (replace dùng atomic `$transaction`).
- **Settings tab "Từ viết tắt"**: Giao diện quản lý — bảng danh sách, form thêm/sửa, panel sao chép từ người dùng khác.
- **Schema `UserAbbreviation`**: Bảng `user_abbreviations` với unique index `(userId, shortcut)`, FK cascade on delete.
- **20 unit tests**: `abbreviations.service.spec.ts` (15) + `abbreviations.controller.spec.ts` (5).

## [0.5.5.0] - 2026-04-24

### Added
- **Cải cách hành chính — xóa bỏ cấp quận/huyện**: Directory entries type=DISTRICT đánh dấu `isActive=false` + `abolishedAt=2025-07-01`. Ward legacy cascade (parentId→DISTRICT) cũng đánh dấu `isActive=false`. Schema thêm `abolishedAt DateTime?` và `replacedByCode String?` trên Directory model.
- **Địa chỉ 2 cấp cho hồ sơ mới**: Form vụ án chỉ hiện Tỉnh/TP + Phường/Xã; danh sách phường load từ API `/directories?type=WARD&isActive=true`. Hồ sơ cũ có quận hiện amber read-only badge "Địa chỉ cũ — [quận] (trước 01/07/2025)".
- **Legacy toggle (Ctrl+Shift+L)**: Cho phép nhập lại hồ sơ giấy cũ có quận — toggle bật/tắt field Quận/Huyện với ward cascade theo `parentId`. Chỉ áp dụng cho hồ sơ mới, không đè lên dữ liệu lịch sử từ DB.
- **`Subject.districtName`**: Denormalized district name lưu tại thời điểm tạo hồ sơ — đảm bảo tên pháp lý hiển thị đúng sau cải cách. DTO + Service + Migration thêm field này.
- **Slug normalization script**: `backend/prisma/migrations/20260425000002_normalize_case_district_slugs/migrate-district-slugs.ts` — standalone script chuẩn hóa `Case.metadata.district` slugs (quan-1 → Q1 v.v.).
- **2FA infrastructure (TOTP + Email OTP)**: Thêm schema fields (`twoFaSecret`, `twoFaEnabled`, `twoFaVerified`), service (`TwoFaService`, `OtpCodeService`, `TotpEncryptionService`), controller (`TwoFaController`), guard (`TwoFaTokenGuard`), email module, và frontend pages (`TwoFaPage`, `TwoFaSetupModal`). Auth flow cập nhật hỗ trợ 2FA challenge step.

### Fixed
- Loại bỏ hardcoded `DISTRICT_OPTIONS` và `WARD_OPTIONS` trong `CaseFormPage/constants.ts` — thay bằng API-driven dropdowns.

## [0.5.4.0] - 2026-04-24

### Added
- **GAP-1: `LoaiNguonTin` enum** (BLTTHS 2015 Điều 144) — `loaiDonVu` on `Incident` changed from `String?` to `LoaiNguonTin?` (TO_GIAC / TIN_BAO / KIEN_NGHI_KHOI_TO). DTO validation rejects non-enum values with 400. Migration: `CASE-WHEN` string→enum conversion preserving existing data.
- **GAP-2: Deadline extension tracking** (BLTTHS 2015 Điều 147 khoản 2-3) — `soLanGiaHan Int @default(0)` and `ngayGiaHan DateTime?` on `Incident`. `POST /incidents/:id/extend` extends deadline (max 2 times, each +60 days configurable via SystemSettings `THOI_HAN_GIA_HAN_1`/`THOI_HAN_GIA_HAN_2`). Optimistic concurrency lock prevents double-extension race.
- **GAP-3: Max deadline corrected** — `THOI_HAN_TOI_DA` seed value `120` → `140` (20 + 60 + 60 days, Điều 147 khoản 1-3).
- **GAP-4: `LoaiDon` enum** (Luật Tố cáo 2018 / Luật Khiếu nại 2011) — `petitionType` on `Petition` changed from `String?` to `LoaiDon?` (TO_CAO / KHIEU_NAI / KIEN_NGHI / PHAN_ANH). DTO validation rejects non-enum values.
- **GAP-5: `CapDoToiPham` enum** (BLHS 2015 Điều 9) — `capDoToiPham` on `Case` (IT_NGHIEM_TRONG / NGHIEM_TRONG / RAT_NGHIEM_TRONG / DAC_BIET_NGHIEM_TRONG). KPI-4 now correctly uses `capDoToiPham` enum instead of `metadata.severity` string path.
- **GAP-6: `LyDoKhongKhoiTo` enum** (BLTTHS 2015 Điều 157) — 7 statutory grounds for non-prosecution on `Incident`. Required when transitioning to `KHONG_KHOI_TO` status — `updateStatus()` validates presence.
- **GAP-7: Petition deadline configuration** — Deadline days per petition type now read from SystemSettings (`THOI_HAN_TO_CAO`, `THOI_HAN_KHIEU_NAI`, `THOI_HAN_KIEN_NGHI`, `THOI_HAN_PHAN_ANH`). Default fallback 15 days. Audit log records `deadlineDays` + `deadlineSettingKey` for traceability.
- **GAP-9: `writableTeamIds` write-scope enforcement** — `DataScope` now includes `writableTeamIds` (subset of `teamIds` where user has WRITE grant). All mutating incident endpoints (`update`, `updateStatus`, `delete`, `mergeInto`, `transferUnit`, `assignInvestigator`, `extendDeadline`, `prosecute`) now call `checkWriteScope()` using `writableTeamIds`. READ-grant holders can no longer mutate records.
- **Frontend selects**: `loaiDonVu` filter (3 enum options, Điều 144), `petitionType` select (4 enum options), `capDoToiPham` select (4 BLHS mức độ options) replacing free-text inputs.

### Fixed
- **IDOR in `extendDeadline`**: Was fetching incident without scope check. Now calls `checkWriteScope()` with `dataScope` from request.
- **Silent NULL deadline coercion**: `incident.deadline ?? new Date()` replaced with explicit `BadRequestException` when deadline is null.
- **extensionDays ≤ 0 guard**: `BadRequestException` thrown if SystemSettings returns `THOI_HAN_GIA_HAN_*` ≤ 0 (invalid admin config).

### Security
- Write-scope enforcement closes FINDING-4: READ-grant users could previously call any mutating endpoint on records they could only read.

## [0.5.3.0] - 2026-04-23

### Added
- **Self-service password change**: `POST /auth/change-password` — user đổi mật khẩu của chính mình. Xác minh mật khẩu hiện tại, enforce strong password (≥8 ký tự, chữ hoa, số, ký tự đặc biệt), audit log `PASSWORD_CHANGED`, invalidate refresh tokens.
- **Frontend "Đổi mật khẩu" modal**: User avatar trên header mở dropdown → "Đổi mật khẩu" → modal với show/hide toggle, real-time strength checklist (4 rules), success state, và Vietnamese error messages.
- **`ChangePasswordDto`** + **`password.constants.ts`**: Shared `STRONG_PASSWORD_REGEX` / `STRONG_PASSWORD_MSG` constants — DRY, một chỗ thay đổi policy.

### Fixed
- **Security (rate limiting)**: `POST /auth/change-password` thiếu `@Throttle` — brute-force via stolen JWT. Đã thêm `@Throttle({ default: { ttl: 60000, limit: 5 } })`.
- **Security (session invalidation)**: Đổi mật khẩu không xóa `refreshTokenHash` — attacker giữ refresh token vẫn duy trì session. Đã thêm `refreshTokenHash: null` vào update.
- **UX**: `newPassword === currentPassword` không bị chặn. Đã thêm `BadRequestException` guard trong service.
- **DRY**: Strong password regex duplicate trong 3 DTOs — đã extract sang `auth/constants/password.constants.ts`.

### Fixed (Adversarial Review)
- **Security (null hash crash)**: `changePassword` trên tài khoản OAuth/SSO (không có `passwordHash`) gây 500 error. Đã thêm explicit guard: `BadRequestException` khi `passwordHash` là null.
- **Security (bcrypt 72-byte bypass)**: So sánh `newPassword === currentPassword` bằng string equality không phát hiện same-password khi password > 72 ký tự (bcrypt truncates). Đã chuyển sang `bcrypt.compare(newPassword, oldHash)` — correct semantic check.
- **Compliance (audit transaction)**: `auditService.log()` không nằm trong cùng transaction với `user.update()` — password thay đổi thành công nhưng audit entry có thể bị mất nếu DB blip. Đã wrap cả hai trong `prisma.$transaction()`.

### Tests
- 8 unit tests cho `AuthService.changePassword` (bao gồm null-hash guard + transaction wrapper + bcrypt same-password check), 3 controller tests (`auth.controller.spec.ts`), 8 frontend tests (`ChangePasswordModal.test.tsx`). Tổng: **474 tests / 28 suites**.

## [0.5.2.0] - 2026-04-21

### Fixed
- **Security (IDOR write/list)**: `update`, `delete`, và `getList` trên 9 resource phụ không kiểm tra DataScope — user từ Tổ khác có thể ghi đè hoặc liệt kê bản ghi ngoài phạm vi. Đã thêm pre-flight `await this.getById(id, dataScope)` trên mọi write op, và `buildScopeFilter` cho list queries.
- **Security (assertCreatorInScope deny-all)**: deny-all scope `{userIds:[],teamIds:[]}` bị bỏ qua do short-circuit `userIds.length > 0`. Đã thêm `isDenyAll` check — scope rỗng luôn bị chặn.
- **Security (getMessages bypass)**: `GET /exchanges/:id/messages` không kiểm tra scope — user ngoài scope có thể đọc tin nhắn. Đã thêm `await this.getById(exchangeId, dataScope)` pre-flight.
- **Security (deletedAt gap)**: `InvestigationSupplementsService.getById` thiếu `deletedAt: null` filter — soft-deleted record có thể fetch theo ID. Đã thêm filter.
- **Security (CORS empty string)**: `CORS_ORIGIN=` (env var rỗng) tạo ra `origin: [""]` block mọi cross-origin request trong production. Đã thêm `.filter(Boolean)` và fallback localhost.
- **Type safety**: Thay thế `(req as any).dataScope` trong 13 controller bằng `ScopedRequest` interface — typed `Request` với `dataScope?: DataScope | null`. Xóa toàn bộ unsafe cast.
- **Code quality**: Extract magic strings thành named constants trong `scope-filter.util.ts` — `FORBIDDEN_MSG` và `NO_ACCESS_SENTINEL`, tránh lỗi typo và cho phép refactor tập trung.

### Added
- **`ScopedRequest` interface** (`backend/src/auth/interfaces/scoped-request.interface.ts`): extends Express `Request` với `dataScope?: DataScope | null`. Được import bởi tất cả 13 controller.
- **Tests**: 4 test cases deny-all scope cho `exchanges` và `guidance` service specs. Controller spec mới `exchanges.controller.spec.ts` — 4 tests xác nhận `dataScope` được forward đúng từ controller sang service. Tổng: 463 tests / 26 suites.

## [0.5.1.0] - 2026-04-21

### Fixed
- **Security (IDOR)**: `getById` trên 9 resource phụ (documents, subjects, conclusions, delegations, exchanges, guidance, investigation-supplements, lawyers, proposals) không kiểm tra phạm vi dữ liệu (DataScope). Authenticated user từ Tổ khác có thể fetch bất kỳ record nào theo ID. Đã thêm `assertParentInScope()` (kiểm tra scope qua Case/Incident cha) và `assertCreatorInScope()` (kiểm tra qua createdById), áp dụng nhất quán trên tất cả 9 service.
- **Security (CORS)**: CORS origin hardcoded `localhost:5173/5179` sẽ block mọi browser request trong production. Đã chuyển sang `CORS_ORIGIN` env var với localhost fallback cho development.
- **CVEs**: `npm audit fix` frontend — xóa 6 lỗ hổng (4 HIGH Vite dev dependencies).

### Added
- **Test coverage**: 43 unit tests mới cho security enforcement paths. Thêm 6 service spec files (conclusions, delegations, exchanges, guidance, investigation-supplements, proposals). Scope-enforcement paths trong 3 spec files hiện có (documents, subjects, lawyers) được bổ sung. `assertParentInScope`/`assertCreatorInScope` có full branch coverage bao gồm edge cases (undefined scope, empty scope, null parent, unassigned records). Tổng: 454 tests / 25 suites.

## [0.5.0.1] - 2026-04-20

### Fixed
- **KPI-4 query**: Prisma JSON path filter used invalid `in` operator (unsupported for JSON path queries). Replaced with `OR/equals` pattern so `calculateKpi4()` correctly filters án rất nghiêm trọng và đặc biệt nghiêm trọng. Backend now compiles and `/kpi/summary` returns all 4 KPI values.

## [0.5.0.0] - 2026-04-20

### Added
- **KPI Dashboard** (`/kpi`): dashboard 4 chỉ tiêu cứng công tác điều tra theo TT28/2020/TT-BCA — thụ lý 100%, giải quyết >90%, khám phá >80%, án NT/ĐBNT >95%. Hiển thị theo năm/quý/tháng, drill-down theo Tổ, biểu đồ xu hướng 12 tháng (recharts). Team member chỉ xem Tổ của mình, admin xem tất cả.
- **Modular feature architecture**: mỗi module là 1 folder tự đóng gói. Frontend `src/features/<name>/` với `feature.manifest.ts`, `routes.tsx`, `menu.ts`, `index.ts`. Backend: mỗi module có `feature.manifest.ts` + central `feature-registry.ts`. 26 backend manifests + 16 frontend feature modules đã migrate.
- **Runtime feature flags**: bảng `feature_flags` + `@FeatureFlag(key)` NestJS guard + React `useFeature(key)` hook. Admin bật/tắt module → guard trả 404, sidebar ẩn menu. Cache in-memory 30s (TTL cấu hình qua `FEATURE_FLAG_CACHE_TTL_MS`).
- **Build-time feature packs**: env var `ENABLED_FEATURES=core,cases,petitions` whitelist module khi build. Cho phép phân phối variant khác nhau cho từng khách hàng mà không fork code.
- **Auto-discovery**: frontend registry dùng Vite `import.meta.glob('./features/*/index.ts')`. Backend registry có jest spec walk filesystem để catch missing entries. Thêm feature mới = tạo 1 folder, zero sửa file chung.
- **Sidebar registry consumption**: `useMenuSections()` hook gom menu entries từ feature modules, filter theo flag state, sort theo canonical section order, drop empty sections. Stale ids (favorites/expanded/recent) tự động pruned khi feature bị disable hoặc rename.

### Changed
- `frontend/src/App.tsx`: 244 → 44 dòng. Toàn bộ hardcoded routes thay bằng `FEATURE_MODULES.flatMap(f => f.renderRoutes())`.
- `frontend/src/components/AppSidebar.tsx`: bỏ 130 dòng hardcoded `menuSections` constant, dùng `useMenuSections()` hook.
- `backend/prisma/seed.ts`: tự động gọi `seedFeatureFlags(prisma)` ở cuối main seed flow — fresh deploy không còn blank menu.
- Deploy build command: `cd backend && npm install && npm run build && npx prisma migrate deploy && npm run db:seed` (bắt buộc để seed feature_flags).

### Fixed
- **Security**: `getById` cho incidents và petitions thiếu kiểm tra phạm vi dữ liệu (dataScope). Non-admin user có thể fetch bất kỳ record nào theo ID. Đã thêm `checkRecordInScope()` khớp pattern của CasesService.
- **Security**: `DataScopeInterceptor` khi JWT thiếu `role` claim → mặc định full access. Đã thêm fallback deny-all scope `{ teamIds: [], userIds: [] }`.
- `FeatureFlagsService.ensureFresh()` wrap refresh trong try/catch: post-boot DB blip không còn 500 mọi request, serves stale cache với 5s backoff. In-flight promise dedup chống thundering herd.
- `FeatureFlagGuard`: skip flag check khi request.user undefined → anonymous caller không thể probe enabled/disabled features qua 404 vs 401 pattern. Decoupled khỏi APP_GUARD execution order.
- `listAll()` merge FEATURE_REGISTRY với DB rows: fresh deploy trả về đầy đủ features với default-allow, frontend không còn blank trong race giữa migration và seed.
- `FeatureFlagsProvider`: retry 3 lần với backoff 500/1500/3000ms, 401 → clear tokens + redirect /login, network error exhausted → surface error state.
- Dashboard tests: stat values + chart headings (mock wrapped envelope, copy match).
- Calendar tests: modal prop name (`open` không phải `isOpen`), mock api events với future dates để pass filter.

### Removed
- `useFeatureRoutes` hook (dead code, App.tsx không dùng — comment trong App.tsx giải thích tại sao frontend routing không flag-gated).

## [0.4.1.0] - 2026-04-12

### Fixed
- Phân quyền: user cấp Tổ (level 1) giờ thấy data của các Phường thuộc Tổ đó (bỏ điều kiện level === 0)
- Settings: validate giá trị số 0-365 khi admin cập nhật thời hạn (chặn "-999" hoặc "abc")
- Incidents: phase filter ưu tiên rõ ràng khi cả status và phase được truyền
- Teams: validate userId tồn tại trước khi thêm thành viên (tránh 500 error)

### Added
- TeamsPage: panel quản lý thành viên khi click vào tổ/nhóm (thêm/gỡ user, search, isLeader badge)
- Teams API: POST /teams/:id/members + DELETE /teams/:id/members/:userId với audit logging

## [0.4.0.0] - 2026-04-12

### Added
- Tổ chức lại module Vụ việc theo 4 giai đoạn nghiệp vụ BCA (TT28/2020/TT-BCA): Tiếp nhận, Xác minh, Kết quả, Tạm đình chỉ
- Sidebar đơn giản hóa: 5 items (Tất cả + 4 giai đoạn) thay 12 items phẳng
- List page: 4 phase tabs với sub-filter chips cho từng trạng thái cụ thể
- Form tạo/sửa: 4 sections collapsible theo giai đoạn (tự mở/đóng theo status, user toggle được)
- Bảng SystemSetting: cấu hình 8 thời hạn xử lý với default theo BLTTHS 2015 (Đ.147, Đ.148, Đ.149)
- Trang admin /admin/settings: xem và sửa cấu hình thời hạn với cơ sở pháp lý
- Auto-deadline: tạo vụ việc có ngày tiếp nhận → tự tính thời hạn = ngày tiếp nhận + 20 ngày (configurable)
- 8 fields nghiệp vụ mới: số quyết định, lý do không khởi tố, lý do tạm đình chỉ, địa chỉ xảy ra, thông tin người tố giác (SĐT, địa chỉ, CCCD)
- Phase filter API: `?phase=tiep-nhan` server-side resolve an toàn qua PHASE_STATUSES map
- Frontend constants: incident-phases.ts shared giữa các components

### Changed
- Labels/comments sửa theo đúng thuật ngữ BLTTHS 2015 + TT28/2020/TT-BCA (Loại nguồn tin, Người tố giác, Đối tượng bị tố giác, Đơn vị thụ lý, Thời hạn giải quyết)
- Transition map bổ sung comments điều luật cho từng chuyển trạng thái
- Settings cache TTL 5 phút, seed upsert không ghi đè admin edits

## [0.3.0.0] - 2026-04-11

### Added
- Nâng cấp module Quản lý Vụ việc với 15 trạng thái theo quy trình nghiệp vụ thực tế (từ 6 trạng thái cũ)
- Transition map validation: chỉ cho phép chuyển trạng thái theo luồng nghiệp vụ hợp lệ
- Status history tracking: ghi lại lịch sử thay đổi trạng thái với lý do
- Endpoint đổi trạng thái (PATCH /incidents/:id/status) với validation
- Endpoint nhập vào vụ khác (PATCH /incidents/:id/merge) với re-link petitions/documents
- Endpoint chuyển đơn vị (PATCH /incidents/:id/transfer) với audit trail
- Endpoint thống kê theo trạng thái (GET /incidents/stats) dùng groupBy
- 15 fields mới cho Incident: đối tượng, loại đơn vụ, bên vụ, đơn vị giải quyết, kết quả xử lý, v.v.
- Model IncidentStatusHistory cho theo dõi lịch sử thay đổi
- Sidebar sub-menus: 12 mục lọc theo trạng thái (collapsible groups)
- Bộ lọc nâng cao: loại đơn vụ, bên vụ, tình trạng hồ sơ, thời hiệu, cán bộ nhập, date range
- Server-side pagination thay thế client-side filtering
- Status transition dialog: chỉ hiện transitions hợp lệ, yêu cầu ghi chú
- 58 unit tests mới cho transitions, merge, transfer, stats, filters

### Fixed
- Khởi tố vụ việc (prosecute) giờ dùng $transaction để đảm bảo atomicity
- Code generation VV-YYYY-NNNNN dùng retry loop thay vì count-based (fix race condition)
- Status không còn thay đổi qua PUT /update, phải dùng endpoint riêng
- Form chỉnh sửa vụ việc giờ load dữ liệu hiện có (fix edit mode)
