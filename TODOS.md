# TODOS

## Security

### FINDING-002: Git history contains `.env.test` credentials
**Priority:** P1
**Details:** Commit `92bfbee` added `.env.test` with plaintext `DieuTra@PC02#2026` password. File was removed in a subsequent commit but remains in git history. Requires `git filter-repo` + force-push (destructive, coordinate with team).

**Steps:**
1. Rotate `DieuTra@PC02#2026` password in all environments first
2. Run `git filter-repo --path .env.test --invert-paths`
3. Coordinate force-push with all collaborators (history rewrite)
4. Rotate GitHub deploy tokens/secrets after push

**Discovered:** 2026-04-20 (CSO security audit)

### FINDING-013: DataAccessGrant.accessLevel not enforced in resolveScope
**Priority:** P2
**Details:** `accessLevel` (READ/WRITE) is required in DTO, stored in DB, and shown in UI — but `resolveScope()` selects only `teamId`, treating READ and WRITE grants identically. Both grant the same data visibility. Write-scope enforcement (restricting mutations to WRITE grant holders) requires a `writeScope` concept threaded through all write-path services.
**Fix:** Extend `DataScope` with optional `writeTeamIds`; populate from WRITE grants in `resolveScope`; check `writeTeamIds` in `assertParentInScope` and `assertCreatorInScope` for update/delete operations.
**Discovered:** 2026-04-23 (eng review — outside voice finding)

### PERF-002: GET /kpi/trend makes ~120 DB count queries per call
**Priority:** P3 (acceptable at current scale with <10k rows + createdAt index)
**Details:** `getKpiTrend()` runs 12 months × 4 KPIs × ~2.5 counts = ~120 `prisma.count()` calls. They run in 12 parallel batches (one per month), so it's 12 sequential DB round-trips. With a good index on `createdAt` this is fast. Will degrade as data grows.
**Fix:** Refactor to raw SQL `GROUP BY EXTRACT(MONTH FROM "createdAt")` — reduces to 4 queries total.
**Discovered:** 2026-04-23 (eng review)

### PERF-001: DataScopeInterceptor makes 5-15 DB queries per request (no caching)
**Priority:** P3 (acceptable at current scale, trigger at >30 concurrent users)
**Details:** `UnitScopeService.resolveScope()` is called on every authenticated API request. It does: `userTeam.findMany` + recursive `getDescendantIds` (N × MAX_DEPTH=3) + `dataAccessGrant.findMany` + `getUserIdsForTeams`. No in-memory cache. At 50 concurrent users this is ~750-1500 extra DB queries/second.
**Fix:** Add TTL-based in-memory cache in `UnitScopeService` keyed on `userId`. Invalidate on team membership change or DataAccessGrant upsert. TTL=60s is safe.
**Discovered:** 2026-04-23 (eng review)

---

## Completed

- **FINDING-001 (IDOR)**: `getById` on 9 child resources lacked DataScope enforcement. Fixed in v0.5.1.0 — `assertParentInScope`/`assertCreatorInScope` added, 43 new tests. **Completed:** v0.5.1.0 (2026-04-21)
- **FINDING-005 (IDOR write/list)**: `update`, `delete`, and `getList` on 9 child resources lacked DataScope enforcement. Fixed in v0.5.2.0 — scope pre-flight on write ops + `buildScopeFilter` on list queries. **Completed:** v0.5.2.0 (2026-04-21)
- **FINDING-006 (assertCreatorInScope deny-all)**: deny-all scope `{userIds:[],teamIds:[]}` was not enforced by `assertCreatorInScope` (userIds.length > 0 short-circuit). Fixed in v0.5.2.0. **Completed:** v0.5.2.0 (2026-04-21)
- **FINDING-007 (getMessages bypass)**: `GET /exchanges/:id/messages` had no scope check. Fixed in v0.5.2.0. **Completed:** v0.5.2.0 (2026-04-21)
- **FINDING-008 (investigation-supplements deletedAt)**: `getById` missing `deletedAt: null` filter allowed soft-deleted records to be fetched. Fixed in v0.5.2.0. **Completed:** v0.5.2.0 (2026-04-21)
- **FINDING-009 (CORS empty string)**: `CORS_ORIGIN=` (empty env var) produced `origin: [""]` blocking all production requests. Fixed in v0.5.2.0. **Completed:** v0.5.2.0 (2026-04-21)
- **FINDING-010 (per-IP throttle)**: `POST /auth/change-password` throttle keyed on IP. Fixed in v0.5.3.0 — `UserThrottlerGuard` keys on `user.id` post-JWT. **Completed:** v0.5.3.0 (2026-04-23)
- **FINDING-011 (JWT not invalidated on password change)**: Access tokens stayed valid after password change. Fixed in v0.5.3.0 — `tokenVersion` field added to User + JWT payload; `JwtStrategy` rejects stale tokens. **Completed:** v0.5.3.0 (2026-04-23)
- **FINDING-012 (trust proxy)**: `req.ip` returned proxy IP without trust proxy config. Fixed in v0.5.3.0 — `app.set('trust proxy', 1)` added to `main.ts`. **Completed:** v0.5.3.0 (2026-04-23)
- **FINDING-003 (Vite CVEs)**: 6 vulnerabilities (4 HIGH) in frontend devDeps. Fixed via `npm audit fix`. **Completed:** v0.5.1.0 (2026-04-21)
- **FINDING-004 (CORS hardcoded)**: CORS origin hardcoded to localhost. Fixed via `CORS_ORIGIN` env var. **Completed:** v0.5.1.0 (2026-04-21)
