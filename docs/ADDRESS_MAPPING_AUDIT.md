# Audit cải cách địa chỉ (F10 / Address mapping)

**Phiên bản:** v0.13.10.0 (2026-05-10)
**Driver:** /office-hours → /codex API research → /autoplan dual-voice review → implement.

## Architecture (one-line)

Admin clicks "Re-seed địa chỉ" → background job hits `provinces.open-api.vn` v1+v2 → upserts local DB → user typing F10 hits LOCAL DB only. Zero per-request external API calls at runtime.

```
[Admin click]
     │
     ▼
POST /address-mappings/seed/HCM (HTTP 202 + jobId)
     │
     ▼
[Background worker — setImmediate, non-blocking]
     │
     ├─→ GET /api/p/79?depth=3   (v1: old structure with old codes)
     │   └─→ Snapshot to backend/prisma/data/snapshots/HCM-v1-{ts}.json
     │
     ├─→ For each old ward: GET /api/v2/w/from-legacy/?legacy_code={N}
     │   └─→ Returns 1+ new wards. Multi-result → needsReview + candidates JSON.
     │
     └─→ Upsert AddressMapping rows (source='api-v2', seededAt=now)
              ▲
              │
              │  (runtime read)
              │
[User types "P3 Q3" in form]
     │
     ▼ F10
expandAddressAbbreviations('P3 Q3') → 'Phường 3 Quận 3'
inferProvince(text) → 'HCM' (default fallback)
     │
     ▼
GET /api/v1/address-mappings/lookup?ward=phường 3&district=quận 3&province=HCM
     │
     ▼
[backend: pure DB query]
     ├─ Tier 1: exact match → returns 'phường bàn cờ'
     ├─ Tier 2: district fallback (all wards in district map to one new) → '...'
     └─ Tier 3: null → FE drops district, keeps ward
```

## Bugs fixed in this PR

### Bug 1 — Abbreviations not recognized

Before: `useAddressConverter.ts:18` regex required full word `phường|xã|thị trấn`. `P3`/`Q10` ignored.

After: `expandAddressAbbreviations` preprocessing layer runs FIRST. Uses Unicode-safe `\p{L}` lookbehind so accented Vietnamese (ấ, ờ, đ, ẵ) doesn't trigger false positives.

| Input | Output |
|---|---|
| `P3` | `Phường 3` |
| `P.3` / `P. 3` / `p3` / `P03` | `Phường 3` |
| `Q10` / `Q.10` | `Quận 10` |
| `H. Bình Chánh` | `Huyện Bình Chánh` |
| `OP3` (mid-word) | `OP3` (no expansion) |
| `ấP3` (after Vietnamese diacritic) | `ấP3` (no expansion) |

### Bug 2 — Old wards not converting to new wards

Before: `crawlAndSync` had hard-coded `DISTRICT_TO_NEW_WARD` map that explicitly punted on Q1-Q12 + Thủ Đức with comment `// Quận số — chưa có văn bản chính thức → chỉ xóa cấp quận`. So `Phường 5, Quận 3` just dropped Quận 3 — never became `Phường Bàn Cờ`.

After: bulk-seed-from-API uses `provinces.open-api.vn` v1 → v2 pipeline:
1. v1 returns OLD structure with old ward codes (e.g. Phường 5 Q3 = code 27151).
2. v2 `/from-legacy/?legacy_code=27151` returns new ward(s) — for HCM Q3 P5 it's `[{ward: {name: "Phường Bàn Cờ", code: 27154}}]`.
3. Upsert into local DB.

Result verified end-to-end via `curl` before plan finalization. Regression test added: `lookup({ward: 'Phường 5', district: 'Quận 3', province: 'HCM'})` → `'phường bàn cờ'`.

## Province support (v0.13.10.0 ships HCM only)

| Code | Province | API code | Status |
|---|---|---|---|
| HCM | TP. Hồ Chí Minh | 79 | ✅ supported |
| HN | Hà Nội | 1 | 🟡 endpoint enabled, not seeded |
| HP | Hải Phòng | 31 | 🟡 endpoint enabled, not seeded |
| DN | Đà Nẵng | 48 | 🟡 endpoint enabled, not seeded |
| CT | Cần Thơ | 92 | 🟡 endpoint enabled, not seeded |

Other 58 provinces: deferred to follow-up PRs. Default province inference → `HCM` when input lacks province pattern (per user direction).

## Schema

### `AddressMapping` (extended)

| Field | Type | Note |
|---|---|---|
| `oldWard`, `oldDistrict`, `newWard`, `province` | String | existing |
| `note` | String? | existing |
| `isActive`, `needsReview` | Boolean | existing |
| **`source`** | String (new) | `'api-v2'` / `'manual'` / `'official-decree'`. Default `'manual'`. |
| **`seededAt`** | DateTime? (new) | Set when `bulkSeedFromApi` writes. |
| **`candidates`** | Json? (new) | When `needsReview=true`, stores all candidate new wards (split case). |

### `AddressSeedJob` (new)

| Field | Type | Note |
|---|---|---|
| `id` | String | cuid |
| `province` | String | HCM/HN/... |
| `status` | String | `queued`/`running`/`completed`/`failed`/`cancelled` |
| `startedAt`, `completedAt` | DateTime | timestamps |
| `totalWards`, `mappedCount`, `errorCount`, `needsReview` | Int | progress counters |
| `cancelToken` | String? | Set to `'requested'` to abort. |
| `errorLog` | String? | JSON array, ≤5KB. |
| `triggeredBy` | String | userId of admin who clicked. |

## Endpoints

| Method | Path | Purpose | Permission |
|---|---|---|---|
| `GET` | `/address-mappings` | List mappings (existing) | `read:Directory` |
| `GET` | `/address-mappings/lookup` | F10 runtime lookup (existing) | `read:Directory` |
| `GET` | `/address-mappings/stats` | Counts (existing) | `read:Directory` |
| `POST` | `/address-mappings/seed/:province` | Start seed job (returns 202 + jobId) | `write:Directory` |
| `GET` | `/address-mappings/seed/status/:id` | Poll job progress | `read:Directory` |
| `POST` | `/address-mappings/seed/:id/cancel` | Request cancellation | `write:Directory` |

The old `/address-mappings/crawl` endpoint is **removed**. Admin UI must update to use the new `/seed/:province` flow.

## Operational runbook

### Re-seeding HCM

1. Admin clicks "Re-seed địa chỉ HCM" in admin UI.
2. UI POSTs `/address-mappings/seed/HCM` → gets `{jobId, statusUrl}`.
3. UI polls `/address-mappings/seed/status/{jobId}` every 2s.
4. Job runs ~30s for HCM (~322 wards × ~100ms each, with concurrent throttle).
5. Status transitions: `queued` → `running` → `completed`. UI shows progress bar from `mappedCount/totalWards`.
6. On completion: `mappedCount` ~322, `errorCount` near 0, `needsReview` 0-30 (split wards).

### Cancelling a stuck job

1. UI POSTs `/address-mappings/seed/{jobId}/cancel`.
2. Worker checks `cancelToken` between every ward → stops at next iteration.
3. Status flips to `cancelled`.

### API down

If `provinces.open-api.vn` is unreachable mid-job:
- Job marked `failed` with `errorLog: { fatalError: 'fetch failed' }`.
- Admin can re-run; upsert is idempotent.
- Existing local DB rows untouched — runtime lookup keeps working with old data.

### Ambiguous splits (needsReview)

If a single old ward maps to MULTIPLE new wards (data ambiguity from sáp nhập):
- Worker writes `needsReview: true`.
- `candidates` JSON column stores all candidate new wards: `["Phường Bàn Cờ", "Phường X"]`.
- `newWard` defaults to first candidate (so DB has SOMETHING).
- Admin UI shows these rows in a separate "Cần review" tab for manual disambiguation.
- Future: FE preview can surface picker UI when lookup returns ambiguous result. Currently picks first.

## Snapshot fixtures

Raw API responses saved to `backend/prisma/data/snapshots/{province}-v1-{timestamp}.json` on each successful seed run. Purpose:
- Reproducibility if API goes offline.
- Audit trail of what data the seed used.
- Test fixtures (copy snapshot to `backend/test/fixtures/`).

Disk usage: ~50KB per province per snapshot. Old snapshots can be deleted manually or via cron.

## Known limitations

1. **5 provinces enabled, not seeded** — HN/HP/DN/CT have API codes wired but no admin has clicked Re-seed. Tier 2 follow-up PR.
2. **58 other provinces missing** — API codes need to be enumerated. Tier 3 follow-up.
3. **Ambiguous picker UI deferred** — FE silently picks first candidate. Acceptable for HCM where most splits are 1:1.
4. **No cron auto-reseed** — admin must click manually when reform updates publish.
5. **provinces.open-api.vn is hobbyist** — single maintainer on GitHub. If shut down, snapshots in DB still serve runtime lookup until manual JSON seed loaded.

## Tests

- 25 backend tests in `address-mapping.{controller,service}.spec.ts` (was 7, +18):
  - All existing CRUD + lookup tests retained.
  - +3 startSeedJob: unknown province, concurrency lock, happy path.
  - +3 cancelSeedJob: missing job, already-completed, running.
  - +3 controller delegation: startSeed (uppercase + userId), seedStatus, cancelSeed.
  - +1 **Bàn Cờ regression** (Bug 2): asserts `lookup('Phường 5','Quận 3','HCM') → 'phường bàn cờ'`.
- 24 frontend tests in `useAddressConverter.test.ts` (new file):
  - 13 `expandAddressAbbreviations` cases (incl. accented Vietnamese boundaries).
  - 6 `inferProvince` cases.
  - 5 `extractComponents` cases.
- Total: 988 backend + 339 frontend tests pass.

## Files changed

**Backend** (4):
- `backend/prisma/schema.prisma` — extend `AddressMapping`, add `AddressSeedJob`.
- `backend/src/address-mapping/address-mapping.service.ts` — replace `crawlAndSync` with `bulkSeedFromApi` + worker + status/cancel methods.
- `backend/src/address-mapping/address-mapping.controller.ts` — replace `/crawl` with `/seed/:province` + `/seed/status/:id` + `/seed/:id/cancel`.
- `backend/src/address-mapping/address-mapping.{controller,service}.spec.ts` — updated tests.

**Frontend** (2):
- `frontend/src/hooks/useAddressConverter.ts` — `expandAddressAbbreviations` + `inferProvince` + handler integration.
- `frontend/src/hooks/__tests__/useAddressConverter.test.ts` (new) — 24 tests.

**Docs/migration**:
- `docs/ADDRESS_MAPPING_AUDIT.md` (this file).
- `backend/prisma/data/snapshots/.gitkeep` (keep dir tracked).

## Lịch sử

| Ngày | Phiên bản | Hành động |
|---|---|---|
| 2026-05-10 | v0.13.10.0 | Hybrid bulk-seed (API + local), Unicode-safe abbrev parser, default province HCM. Bàn Cờ regression test added. Driven by /codex research + /autoplan dual-voice review (12 cross-model issues addressed). |
| (earlier) | v0.5.x | Initial `crawlAndSync` with hard-coded DISTRICT_TO_NEW_WARD map. Punted on Q1-Q12 + Thủ Đức. |
