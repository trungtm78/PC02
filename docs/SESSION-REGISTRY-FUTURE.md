# PC02 — Session Registry (deferred to future PR)

**Sprint 3 / S3.1 (deferred).** Plan ban đầu là build UserSession table + per-device session management trong Sprint 3, nhưng em decided defer vì:

1. Sprint 3 đã có nhiều việc (metrics + backup + CSP + docs).
2. UserSession refactor đụng vào CORE auth flow (refresh-token rotation, reuse detection, password-change revoke-all). Risk regression cao, cần dedicated PR + thorough manual testing.
3. Mitigation tạm thời đã có ở Sprint 2: backend logout endpoint clear `refreshTokenHash`, server-side revocation hoạt động.

## Plan cho future PR (`feat/session-registry`)

### Schema

```prisma
model UserSession {
  id              String   @id @default(cuid())
  userId          String
  deviceLabel     String?  // user-set ("iPhone của em")
  userAgent       String?  // raw from request
  ipAddress       String?
  lastSeenAt      DateTime @updatedAt
  createdAt       DateTime @default(now())
  revokedAt       DateTime?
  revokedReason   String?  // 'user_logout' | 'admin_revoke' | 'password_change' | 'reuse_detected'
  refreshTokenHash String  // 1-to-many thay cho User.refreshTokenHash
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, revokedAt])
}
```

### Migration

1. Tạo table.
2. Backfill: với mỗi user có `refreshTokenHash != null`, tạo 1 UserSession.
3. Drop column `User.refreshTokenHash` sau khi code refactor xong.

### Backend changes

- `auth.service.ts`:
  - Login → tạo UserSession thay vì update `user.refreshTokenHash`.
  - Refresh → tìm session bằng hash match, rotate trong session đó (không revoke session khác).
  - Reuse detection → revoke ALL sessions của user (mọi device logout).
  - Password change → revoke all sessions (set `revokedAt` + bump tokenVersion).
  - Logout → revoke single session (current).

- New endpoints:
  - `GET /auth/me/sessions` → user xem device list của mình
  - `DELETE /auth/me/sessions/:id` → revoke 1 device
  - `POST /auth/me/sessions/:id/label` → đổi tên device
  - `GET /admin/users/:id/sessions` → admin xem
  - `DELETE /admin/users/:id/sessions/:sessionId` → admin force-logout

- Frontend:
  - Page `/settings/sessions` — list active sessions với UA parse + revoke button.

### Tests

~15 test mới: session CRUD, reuse detection per session, logout-all behavior, admin force-logout, idle-timeout (nếu thêm).

### Effort estimate

3-5 ngày engineering: schema + migration + service refactor + 5 endpoints + frontend UI + tests.

## Tại sao defer không phải bug

Hiện tại Sprint 2 logout endpoint + tokenVersion rotation đã cover các critical scenario:
- User logout trên 1 device → backend clear refreshTokenHash → mọi device khác cũng bị force re-login (vì chỉ có 1 hash). UX không lý tưởng nhưng SECURE.
- Password change → tokenVersion bump → all access tokens reject.
- Admin reset 2FA → tokenVersion bump → same.

Session registry nâng lên thành "per-device logout" + "admin force-logout 1 device không động device khác" — đây là UX improvement, không phải security gap critical.
