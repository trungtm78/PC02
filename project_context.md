# PC02 Case Management System — Project Context

**Task ID:** TASK-2026-000003 (Step 2 REWORK) / TASK-2026-000002 (Step 2) / TASK-2026-0225-001-STEP1 (Step 1)  
**Ngày khởi tạo:** 2026-02-25  
**Trạng thái hiện tại:** Step 2 hoàn thành — Admin Module (User/Role/Permission/Directory CRUD) + Navy/Gold UI + Coming Soon screens. Cases module đã bị loại bỏ khỏi scope (REWORK ACTION-01).

---

## Mục lục

1. [Tech Stack](#1-tech-stack)
2. [Cấu trúc thư mục](#2-cấu-trúc-thư-mục)
3. [Cách chạy project](#3-cách-chạy-project)
4. [Database Schema](#4-database-schema)
5. [API Endpoints](#5-api-endpoints)
6. [Auth Flow (JWT RS256)](#6-auth-flow-jwt-rs256)
7. [Backend — Chi tiết module](#7-backend--chi-tiết-module)
8. [Frontend — Chi tiết](#8-frontend--chi-tiết)
9. [Bảo mật DB (PostgreSQL RLS)](#9-bảo-mật-db-postgresql-rls)
10. [Biến môi trường](#10-biến-môi-trường)
11. [Testing](#11-testing)
12. [Các việc chưa làm (Next Steps)](#12-các-việc-chưa-làm-next-steps)

---

## 1. Tech Stack

| Layer | Công nghệ | Phiên bản |
|---|---|---|
| Backend framework | NestJS | 11.x |
| Frontend framework | React | 19.x |
| Frontend build tool | Vite | 7.x |
| Ngôn ngữ | TypeScript | 5.9.x |
| Database | PostgreSQL | 16 |
| ORM | Prisma | 7.4.x |
| Auth | JWT RS256 (asymmetric) | `@nestjs/jwt` 11.x |
| Auth strategy | Passport JWT | `passport-jwt` 4.x |
| Password hashing | bcrypt | 6.x |
| CSS | Tailwind CSS | 4.x (Vite plugin) |
| UI components | Custom Shadcn-style | clsx + tailwind-merge + CVA |
| API client | Axios | 1.x |
| Server state | TanStack Query | 5.x |
| Form | react-hook-form + zod | 7.x + 4.x |
| Routing (FE) | React Router DOM | 7.x |
| Icons | Lucide React | 0.575.x |
| E2E Testing | Playwright | 1.58.x |

---

## 2. Cấu trúc thư mục

```
pc02-case-management/                   ← monorepo root
├── start_here.bat                      ← Windows launcher (khởi động FE + BE)
├── playwright.config.ts                ← E2E test config
├── tsconfig.json                       ← TypeScript config cho tests/
├── package.json                        ← root deps: @playwright/test only
├── tests/
│   ├── e2e/
│   │   ├── auth.e2e.spec.ts            ← 11 Playwright test cases (Step 1)
│   │   └── admin.e2e.spec.ts           ← 23 Playwright test cases (Step 2)
│   └── uat/
│       └── admin.uat.spec.ts           ← 5 UAT test cases (Step 2)
│
├── backend/                            ← NestJS API (port 3000)
│   ├── .env                            ← biến môi trường dev (gitignored)
│   ├── prisma.config.ts                ← Prisma 7 datasource config
│   ├── prisma/
│   │   ├── schema.prisma               ← định nghĩa models
│   │   ├── seed.ts                     ← seed admin user + roles + perms
│   │   └── migrations/
│   │       └── 00000000000000_init_rls/
│   │           └── migration.sql       ← PostgreSQL RLS policies
│   ├── keys/
│   │   ├── private.pem                 ← RS256 private key (GITIGNORED)
│   │   └── public.pem                  ← RS256 public key (committed)
│   └── src/
│       ├── main.ts                     ← bootstrap, global pipe, CORS
│       ├── app.module.ts               ← root module (imports: Auth, Audit, Admin, Directory)
│       ├── app.controller.ts           ← GET /, GET /api/v1/health
│       ├── prisma/
│       │   ├── prisma.module.ts        ← @Global() module
│       │   └── prisma.service.ts       ← extends PrismaClient
│       ├── auth/
│       │   ├── auth.module.ts
│       │   ├── auth.service.ts         ← login, refresh, generateTokens
│       │   ├── auth.controller.ts      ← POST login, POST refresh
│       │   ├── dto/
│       │   │   ├── login.dto.ts        ← { username: email, password }
│       │   │   └── refresh-token.dto.ts
│       │   ├── strategies/
│       │   │   └── jwt.strategy.ts     ← Passport RS256 strategy
│       │   ├── guards/
│       │   │   ├── jwt-auth.guard.ts   ← extends AuthGuard('jwt')
│       │   │   └── permissions.guard.ts ← RBAC check từ DB
│       │   └── decorators/
│       │       ├── current-user.decorator.ts  ← @CurrentUser()
│       │       └── permissions.decorator.ts   ← @RequirePermissions()
│       ├── audit/
│       │   ├── audit.module.ts
│       │   ├── audit.service.ts        ← log(), findAll()
│       │   └── audit.controller.ts     ← GET /api/v1/audit-logs
│       ├── admin/                      ← Step 2: User/Role/Permission/Directory CRUD
│       │   ├── admin.module.ts
│       │   ├── admin.service.ts
│       │   ├── admin.controller.ts     ← @Controller('api/v1/admin')
│       │   └── dto/                    ← create-user, update-user, etc.
│       └── common/
│           └── filters/                ← (placeholder, chưa có code)
│
└── frontend/                           ← React + Vite (port 5173)
    ├── vite.config.ts                  ← Tailwind plugin, @ alias, proxy /api→3000
    ├── index.html                      ← title: "PC02 Case Management"
    └── src/
        ├── main.tsx                    ← ReactDOM.createRoot
        ├── App.tsx                     ← QueryClientProvider + BrowserRouter + Routes
        ├── index.css                   ← @import "tailwindcss"
        ├── components/
        │   ├── ProtectedRoute.tsx      ← guard redirect nếu chưa auth
        │   ├── layout/
        │   │   ├── MainLayout.tsx      ← Navy sidebar + Gold accents (Step 2)
        │   │   ├── Sidebar.tsx         ← 8 menu items, collapse, search
        │   │   └── Header.tsx          ← user info, notifications
        │   └── ui/
        │       ├── button.tsx          ← Button (5 variants, 4 sizes)
        │       ├── card.tsx            ← Card + CardHeader/Title/Desc/Content
        │       ├── input.tsx           ← Input forwardRef
        │       └── label.tsx           ← Label forwardRef
        ├── lib/
        │   ├── api.ts                  ← axios instance + interceptors + authApi
        │   └── utils.ts               ← cn() = clsx + tailwind-merge
        ├── stores/
        │   └── auth.store.ts          ← token storage + JWT payload parse
        ├── hooks/                     ← (placeholder, chưa có code)
        └── pages/
            ├── auth/
            │   └── LoginPage.tsx      ← form login đầy đủ
            ├── dashboard/
            │   └── DashboardPage.tsx  ← placeholder cards
            ├── admin/                  ← Step 2
            │   ├── UserManagementPage.tsx  ← CRUD users + table + modal
            │   ├── RolePermissionPage.tsx  ← role list + permission matrix
            │   └── DirectoryPage.tsx       ← hierarchical directory CRUD
            └── common/
                └── ComingSoonPage.tsx  ← placeholder for unbuilt modules
```

---

## 3. Cách chạy project

### Yêu cầu
- Node.js >= 18
- PostgreSQL 16 đang chạy
- openssl (đã có sẵn khi cài Git for Windows)

### Lần đầu setup

```bash
# 1. Cấu hình DATABASE_URL trong backend/.env
#    Mặc định: postgresql://pc02_admin:pc02_password@localhost:5432/pc02_db

# 2. Chạy migration + tạo Prisma client
cd backend
npx prisma migrate dev --name init

# 3. Áp dụng RLS (sau khi migrate)
#    Copy nội dung migration.sql và chạy trong psql hoặc pgAdmin

# 4. Seed dữ liệu mẫu (admin user)
npx ts-node prisma/seed.ts
```

### Chạy hàng ngày

```
Double-click: start_here.bat
```

Hoặc thủ công:

```bash
# Terminal 1 — Backend
cd backend && npm run start:dev

# Terminal 2 — Frontend
cd frontend && npm run dev
```

### URLs

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3000 |
| Health check | http://localhost:3000/api/v1/health |
| Login page | http://localhost:5173/login |
| Dashboard | http://localhost:5173/dashboard |

### Tài khoản mẫu (sau khi seed)

| Field | Giá trị |
|---|---|
| Email | `admin@pc02.local` |
| Password | `Admin@1234!` |
| Role | `ADMIN` |

---

## 4. Database Schema

### Sơ đồ quan hệ

```
Role ──< RolePermission >── Permission
 │
 └──< User ──< AuditLog

Directory (self-referencing: parentId → Directory)
```

### Bảng `roles`

| Column | Type | Ghi chú |
|---|---|---|
| `id` | String | CUID, PK |
| `name` | String | unique (vd: `ADMIN`, `OFFICER`) |
| `description` | String? | |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | auto-update |

### Bảng `permissions`

| Column | Type | Ghi chú |
|---|---|---|
| `id` | String | CUID, PK |
| `action` | String | `read`, `write`, `delete` |
| `subject` | String | `User`, `Case`, `AuditLog` |
| `conditions` | Json? | ABAC conditions (reserved) |
| `description` | String? | |
| `createdAt` | DateTime | |
| — | unique | `(action, subject)` |

### Bảng `role_permissions` (join table)

| Column | Type | Ghi chú |
|---|---|---|
| `roleId` | String | FK → roles, cascade delete |
| `permissionId` | String | FK → permissions, cascade delete |
| `assignedAt` | DateTime | |
| — | PK | composite `(roleId, permissionId)` |

### Bảng `users`

| Column | Type | Ghi chú |
|---|---|---|
| `id` | String | CUID, PK |
| `email` | String | unique |
| `username` | String | unique |
| `passwordHash` | String | bcrypt 12 rounds |
| `firstName` | String? | |
| `lastName` | String? | |
| `isActive` | Boolean | default true |
| `roleId` | String | FK → roles |
| `refreshTokenHash` | String? | bcrypt hash của refresh token hiện tại |
| `lastLoginAt` | DateTime? | cập nhật mỗi lần login thành công |
| `createdAt` | DateTime | |
| `updatedAt` | DateTime | auto-update |

### Bảng `audit_logs`

| Column | Type | Ghi chú |
|---|---|---|
| `id` | String | CUID, PK |
| `userId` | String? | FK → users (nullable, SetNull on delete) |
| `action` | String | vd: `USER_LOGIN`, `USER_LOGIN_FAILED`, `TOKEN_REFRESHED` |
| `subject` | String? | entity bị tác động |
| `subjectId` | String? | ID entity bị tác động |
| `metadata` | Json? | IP, user-agent, email, role, v.v. |
| `ipAddress` | String? | |
| `userAgent` | String? | |
| `createdAt` | DateTime | indexed |
| — | index | `userId`, `action`, `createdAt` |

---

## 5. API Endpoints

| Method | URL | Auth | Permission | Request Body | Response |
|---|---|---|---|---|---|
| `GET` | `/` | ❌ | — | — | `"Hello World!"` |
| `GET` | `/api/v1/health` | ❌ | — | — | `{ status, timestamp }` |
| `POST` | `/api/v1/auth/login` | ❌ | — | `{ username: email, password }` | `{ accessToken, refreshToken, expiresIn }` |
| `POST` | `/api/v1/auth/refresh` | ❌ | — | `{ refreshToken }` | `{ accessToken, refreshToken, expiresIn }` |
| `GET` | `/api/v1/audit-logs` | ✅ JWT | `read:AuditLog` | — | `{ data[], total, limit, offset }` |
| **Admin (Step 2)** | | | | | |
| `GET` | `/api/v1/admin/users` | ✅ JWT | — | — | `{ data[], total }` |
| `POST` | `/api/v1/admin/users` | ✅ JWT | — | CreateUserDto | User |
| `PATCH` | `/api/v1/admin/users/:id` | ✅ JWT | — | UpdateUserDto | User |
| `GET` | `/api/v1/admin/roles` | ✅ JWT | — | — | Role[] |
| `POST` | `/api/v1/admin/roles/:id/permissions` | ✅ JWT | — | `{ permissions }` | Role |
| `DELETE` | `/api/v1/admin/roles/:id` | ✅ JWT | — | — | void |
| `GET` | `/api/v1/admin/permissions` | ✅ JWT | — | — | Permission[] |
| `GET` | `/api/v1/admin/directories` | ✅ JWT | — | — | Directory[] |
| `POST` | `/api/v1/admin/directories` | ✅ JWT | — | CreateDirectoryDto | Directory |
| `DELETE` | `/api/v1/admin/directories/:id` | ✅ JWT | — | — | void |
**Query params cho `/api/v1/audit-logs`:** `action`, `userId`, `limit` (default 20), `offset` (default 0)

---

## 6. Auth Flow (JWT RS256)

### Thuật toán
- **RS256** — RSA asymmetric signature
- Private key (`backend/keys/private.pem`) ký token — chỉ tồn tại trên server, **gitignored**
- Public key (`backend/keys/public.pem`) verify token — có thể chia sẻ

### JWT Payload structure

```typescript
{
  sub: string;    // userId (CUID)
  email: string;
  role: string;   // e.g. "ADMIN"
  iat: number;    // issued at
  exp: number;    // expiry
  // Refresh token thêm: type: 'refresh'
}
```

### Token lifecycle

| Token | Expiry | Lưu ở FE | Lưu ở BE |
|---|---|---|---|
| Access token | 15 phút | `sessionStorage` | Không lưu |
| Refresh token | 7 ngày | `localStorage` | bcrypt hash trong `users.refreshTokenHash` |

### Login flow

```
Client                          Backend
  │                               │
  ├─ POST /api/v1/auth/login ────►│
  │  { username: email, password }│
  │                               ├─ Tìm user bằng email
  │                               ├─ Kiểm tra isActive
  │                               ├─ bcrypt.compare(password, hash)
  │                               │
  │                    FAIL ◄─────┤ Audit: USER_LOGIN_FAILED → 401
  │                               │
  │                               ├─ generateTokens(userId, email, role)
  │                               ├─ bcrypt.hash(refreshToken) → lưu vào user
  │                               ├─ Cập nhật lastLoginAt
  │                               ├─ Audit: USER_LOGIN
  │                               │
  │◄─ { accessToken,              │
  │     refreshToken,             │
  │     expiresIn: '15m' } ───────┤
```

### Refresh flow (token rotation)

```
Client                          Backend
  │                               │
  ├─ POST /api/v1/auth/refresh ──►│
  │  { refreshToken }             │
  │                               ├─ JWT.verify(token, publicKey, RS256)
  │                               ├─ Tìm user bằng payload.sub
  │                               ├─ bcrypt.compare(token, refreshTokenHash)
  │                               │
  │         MISMATCH (reuse) ◄────┤ Xóa refreshTokenHash → 401
  │                               │
  │                               ├─ generateTokens() mới
  │                               ├─ Lưu hash mới (rotation)
  │                               ├─ Audit: TOKEN_REFRESHED
  │                               │
  │◄─ { accessToken, ... } ───────┤
```

### Axios auto-refresh (frontend)

Khi API trả về 401, `api.ts` response interceptor tự động:
1. Lấy refresh token từ `localStorage`
2. Gọi `POST /api/v1/auth/refresh`
3. Lưu access token mới vào `sessionStorage`
4. Retry request gốc
5. Nếu refresh cũng thất bại → xóa tokens → redirect `/login`

### RBAC / PermissionsGuard

Decorator `@RequirePermissions({ action, subject })` trên route → `PermissionsGuard` query DB lấy permissions của role user → so khớp → cho qua hoặc `403 Forbidden`.

Cấu trúc permission: `{ action: 'read' | 'write' | 'delete', subject: 'User' | 'AuditLog' | 'Directory' | ... }`

---

## 7. Backend — Chi tiết module

### `PrismaModule` (`src/prisma/`)
- `@Global()` — available toàn app không cần import lại
- `PrismaService` extends `PrismaClient`, connect khi module init, disconnect khi destroy

### `AuthModule` (`src/auth/`)

| File | Mô tả |
|---|---|
| `auth.service.ts` | Core: `login()`, `refreshToken()`, `generateTokens()` (private). Đọc private key 1 lần trong constructor. |
| `auth.controller.ts` | Nhận request, truyền `req.ip` và `user-agent` vào service để audit log. |
| `jwt.strategy.ts` | Passport strategy `'jwt'`. Re-fetch user từ DB mỗi request để đảm bảo `isActive`. Trả về `request.user = { id, email, username, role, roleId }`. |
| `jwt-auth.guard.ts` | Thin wrapper `extends AuthGuard('jwt')`. |
| `permissions.guard.ts` | Query `role_permissions` join `permissions` theo `user.roleId`. |
| `login.dto.ts` | Field `username` nhận email (validated `@IsEmail()`). |

### `AuditModule` (`src/audit/`)

| File | Mô tả |
|---|---|
| `audit.service.ts` | `log()` dùng `$executeRaw` (bypass Prisma strict typing cho nullable FK). `findAll()` pagination. |
| `audit.controller.ts` | `GET /api/v1/audit-logs` — yêu cầu `read:AuditLog` permission. |

**Actions đang được log:**

| Action | Khi nào |
|---|---|
| `USER_LOGIN` | Đăng nhập thành công |
| `USER_LOGIN_FAILED` | Sai password |
| `TOKEN_REFRESHED` | Refresh token thành công |

### `AppController`

| Route | Mô tả |
|---|---|
| `GET /` | Hello World (mặc định NestJS) |
| `GET /api/v1/health` | Health probe — dùng bởi Playwright `webServer` config |

### Global ValidationPipe (`main.ts`)

```typescript
new ValidationPipe({
  whitelist: true,           // strip unknown fields
  forbidNonWhitelisted: true, // error on unknown fields
  transform: true,           // auto-transform types
})
```

### CORS

```typescript
app.enableCors({
  origin: ['http://localhost:5173'],
  credentials: true,
})
```

---

## 8. Frontend — Chi tiết

### Routing (`App.tsx`)

| Path | Component | Auth required |
|---|---|---|
| `/` | Redirect → `/dashboard` | — |
| `/login` | `LoginPage` | ❌ |
| `/dashboard` | `DashboardPage` (qua `ProtectedRoute`) | ✅ |
| `/nguoi-dung` | `UserManagementPage` (Step 2) | ✅ |
| `/vai-tro` | `RolePermissionPage` (Step 2) | ✅ |
| `/danh-muc` | `DirectoryPage` (Step 2) | ✅ |
| `/vu-an` | `ComingSoonPage` | ✅ |
| `/don-thu` | `ComingSoonPage` | ✅ |
| `/vu-viec` | `ComingSoonPage` | ✅ |
| `/cau-hinh` | `ComingSoonPage` | ✅ |
| `/nhat-ky` | `ComingSoonPage` | ✅ |
| `*` | Redirect → `/login` | — |

### `LoginPage.tsx`

- Validation: `zod` schema → email + password min 6 ký tự
- Form: `react-hook-form` + `zodResolver`
- API call: `useMutation` (TanStack Query) → `authApi.login()`
- Success: `authStore.setTokens()` → `navigate('/dashboard')`
- Error: hiển thị message từ API response hoặc fallback text
- UX: spinner + "Signing in..." khi đang submit, toggle hiện/ẩn password

### `DashboardPage.tsx`

- Header: tên user + role badge + nút "Sign out"
- Sign out: `authStore.clearTokens()` → `navigate('/login')`
- 3 placeholder cards: Cases, Users, Audit Logs (chưa có data thật)

### `auth.store.ts` — Token storage

| Token | Storage | Lý do |
|---|---|---|
| `accessToken` | `sessionStorage` | Xóa khi đóng tab (an toàn hơn) |
| `refreshToken` | `localStorage` | Persist qua sessions |

> **Production note:** Nên dùng HttpOnly cookie cho refresh token thay vì localStorage.

### `api.ts` — Axios instance

- `baseURL: '/api/v1'` (Vite proxy forward `/api` → `localhost:3000`)
- Request interceptor: tự động thêm `Authorization: Bearer <token>`
- Response interceptor: auto-refresh 401 + retry

### Vite proxy

```typescript
proxy: {
  '/api': {
    target: 'http://localhost:3000',
    changeOrigin: true,
  }
}
```

Frontend luôn gọi đường dẫn tương đối `/api/v1/...` — không hardcode host backend.

### UI Components (`src/components/ui/`)

Viết tay theo phong cách Shadcn/UI (không install package shadcn, tự implement):

| Component | Variants/Props |
|---|---|
| `Button` | variants: `default`, `destructive`, `outline`, `ghost`, `link` / sizes: `default`, `sm`, `lg`, `icon` |
| `Card` | Compound: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent` |
| `Input` | forwardRef, full-width, focus ring slate-900 |
| `Label` | forwardRef, peer-disabled handling |

---

## 9. Bảo mật DB (PostgreSQL RLS)

File: `backend/prisma/migrations/00000000000000_init_rls/migration.sql`

Cần chạy thủ công sau khi `prisma migrate dev` tạo xong bảng.

### Policies đã định nghĩa

| Bảng | Policy | Điều kiện |
|---|---|---|
| `users` | `users_self_read` (SELECT) | `id = app.current_user_id` OR role IN `('ADMIN', 'SYSTEM')` |
| `users` | `users_admin_all` (ALL) | role IN `('ADMIN', 'SYSTEM')` |
| `audit_logs` | `audit_logs_self_read` (SELECT) | `userId = app.current_user_id` OR role IN `('ADMIN', 'SYSTEM')` |
| `audit_logs` | `audit_logs_insert` (INSERT) | `WITH CHECK (true)` — mọi connection có thể insert |

Cả 2 bảng đều có `FORCE ROW LEVEL SECURITY` (áp dụng cả với table owner).

### Session variables cần set trước mỗi query

```sql
SET LOCAL app.current_user_id = '<userId>';
SET LOCAL app.current_user_role = '<roleName>';
```

> **Lưu ý:** Application code chưa set các biến này (chưa implement). Đây là skeleton infrastructure cho Step tiếp theo.

---

## 10. Biến môi trường

### `backend/.env` (dev defaults)

```env
DATABASE_URL="postgresql://pc02_admin:pc02_password@localhost:5432/pc02_db?schema=public"
PORT=3000
NODE_ENV=development
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem
JWT_ACCESS_TOKEN_EXPIRES_IN=15m
JWT_REFRESH_TOKEN_EXPIRES_IN=7d
```

### Tái tạo RS256 key pair (nếu cần)

```bash
cd backend/keys
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out private.pem
openssl rsa -pubout -in private.pem -out public.pem
```

---

## 11. Testing

### Unit tests (Jest — backend)

```bash
cd backend
npm test
```

| File | Số tests | Mô tả |
|---|---|---|
| `app.controller.spec.ts` | 1 | `getHello()` |
| `admin.service.spec.ts` | 36 | User CRUD, Role CRUD, Permission Matrix (Step 2) |
| `directory.service.spec.ts` | 16 | Directory hierarchical CRUD + filters (Step 2) |

**Tổng unit tests: 53**

### Integration tests (Jest + Supertest — backend)

```bash
cd backend
npm run test:e2e
```

| File | Số tests | Mô tả |
|---|---|---|
| `admin-api.e2e-spec.ts` | 17 | Full API tests cho admin endpoints (Step 2) |

**Tổng integration tests: 17**

### E2E tests (Playwright)

```bash
# Từ thư mục gốc
npx playwright test

# Xem báo cáo HTML
npx playwright show-report
```

Playwright tự động start backend + frontend trước khi chạy test (qua `webServer` config).

**`tests/e2e/auth.e2e.spec.ts` (Step 1):**

| Suite | Số tests | Mô tả |
|---|---|---|
| Infrastructure Health | 2 | Backend health + Frontend title |
| Auth API - Login | 3 | 200 + JWT; 401 wrong pass; 400 missing field |
| Auth API - Refresh | 2 | Token rotation; 401 invalid token |
| Audit Log | 1 | `USER_LOGIN` ghi vào DB |
| Frontend Login UI | 3 | Form render; redirect; error message |

**`tests/e2e/admin.e2e.spec.ts` (Step 2):**

| Suite | Số tests | Mô tả |
|---|---|---|
| Sidebar Navigation | 4 | 8 menus, Navy color, collapse, search |
| Coming Soon Pages | 5 | Vụ án, Đơn thư, Vụ việc, Cấu hình, Nhật ký |
| User Management | 4 | CRUD, duplicate error, deactivate login |
| Role Permission Matrix | 3 | List, matrix, delete guard |
| Directory Management | 5 | List, filter, add, duplicate error, delete confirm |
| UI Theme Compliance | 2 | Header + Sidebar colors |

**`tests/uat/admin.uat.spec.ts` (Step 2):**

| Suite | Số tests | Mô tả |
|---|---|---|
| UAT-01: User Management | 1 | CREATE→LIST→EDIT→DEACTIVATE flow |
| UAT-02: Role Permission | 1 | Change permissions + save |
| UAT-03: Coming Soon | 1 | Vụ án, Đơn thư, Vụ việc |
| UAT-04: Directory Hierarchy | 1 | Parent→child directory |
| UAT-05: Navy/Gold Theme | 1 | Layout theme compliance |

**Tổng Playwright E2E: 38 tests (33 E2E + 5 UAT) — 33 passed, 1 skipped**

### Grand total all tests: 53 unit + 17 integration + 38 Playwright = 108 tests

---

## 12. Các việc chưa làm (Next Steps)

### Đã hoàn thành
| Step | Module | Trạng thái |
|---|---|---|
| Step 1 | Auth (JWT RS256) + Infrastructure | ✅ Hoàn thành |
| Step 2 | Admin (Users, Roles, Permissions, Directories) + Layout (Navy/Gold) + Coming Soon | ✅ Hoàn thành (REWORK passed) |

### Chưa implement (priority order)

| Item | Priority | Ghi chú |
|---|---|---|
| Vụ án module (Step 3) | P1 | CRUD vụ án + 10-tab form + status transition (sẽ implement ở Step 3) |
| Đơn thư module (Module 04) | P1 | CRUD đơn thư |
| Vụ việc module (Module 05) | P1 | CRUD vụ việc |
| Dashboard real data (FR-0201) | P1 | Wire stats from modules to DashboardPage |
| Cấu hình module | P2 | System configuration page |
| Nhật ký module | P2 | Audit log viewer UI |
| Wire PostgreSQL RLS session variables | P3 | Set `app.current_user_id` / `app.current_user_role` trước mỗi query |
| `common/filters/` — Global exception filter | P3 | Custom HTTP exception filter |
| Rate limiting | P3 | Rate limit `/auth/login` (brute-force risk) |
| Logout endpoint | P3 | `POST /api/v1/auth/logout` (xóa refreshTokenHash) |
| HTTPS / Cookie | P4 | HttpOnly cookie cho refresh token |
| File upload (MinIO) | P4 | Tab 8 (HS nghiệp vụ) + Tab 10 (Ghi âm/ghi hình) |

### Known issues / Tech debt

| Issue | Ghi chú |
|---|---|
| `@IsIn()` Vietnamese strings broken | class-validator `@IsIn` fails UTF-8 comparison in compiled JS. Use `@IsString() @MaxLength()` instead. |
| Controller prefix pattern | No `app.setGlobalPrefix()` — all controllers hardcode `api/v1/` prefix |
| `App.css` | File còn styles Vite template thừa, chưa dọn |
