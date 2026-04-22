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

---

## Completed

- **FINDING-001 (IDOR)**: `getById` on 9 child resources lacked DataScope enforcement. Fixed in v0.5.1.0 — `assertParentInScope`/`assertCreatorInScope` added, 43 new tests. **Completed:** v0.5.1.0 (2026-04-21)
- **FINDING-005 (IDOR write/list)**: `update`, `delete`, and `getList` on 9 child resources lacked DataScope enforcement. Fixed in v0.5.2.0 — scope pre-flight on write ops + `buildScopeFilter` on list queries. **Completed:** v0.5.2.0 (2026-04-21)
- **FINDING-006 (assertCreatorInScope deny-all)**: deny-all scope `{userIds:[],teamIds:[]}` was not enforced by `assertCreatorInScope` (userIds.length > 0 short-circuit). Fixed in v0.5.2.0. **Completed:** v0.5.2.0 (2026-04-21)
- **FINDING-007 (getMessages bypass)**: `GET /exchanges/:id/messages` had no scope check. Fixed in v0.5.2.0. **Completed:** v0.5.2.0 (2026-04-21)
- **FINDING-008 (investigation-supplements deletedAt)**: `getById` missing `deletedAt: null` filter allowed soft-deleted records to be fetched. Fixed in v0.5.2.0. **Completed:** v0.5.2.0 (2026-04-21)
- **FINDING-009 (CORS empty string)**: `CORS_ORIGIN=` (empty env var) produced `origin: [""]` blocking all production requests. Fixed in v0.5.2.0. **Completed:** v0.5.2.0 (2026-04-21)
- **FINDING-003 (Vite CVEs)**: 6 vulnerabilities (4 HIGH) in frontend devDeps. Fixed via `npm audit fix`. **Completed:** v0.5.1.0 (2026-04-21)
- **FINDING-004 (CORS hardcoded)**: CORS origin hardcoded to localhost. Fixed via `CORS_ORIGIN` env var. **Completed:** v0.5.1.0 (2026-04-21)
