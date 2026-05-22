# Đơn vị hành chính — signed dataset (v0.34.0.0+)

Reference geography cho PC02 case management. **KHÔNG gọi live API từ production** (per /autoplan UC1 — governance + an ninh mạng nội ngành).

## Current active version

- **`v2025-1300.json`** — 34 tỉnh/TP + 3,321 phường/xã (CHÍNH DANH sau cải cách 2025)
- **Effective from:** 2025-07-01
- **Legal basis:** Nghị quyết 60/NQ-CP ngày 25/04/2025 sắp xếp ĐVHC cấp xã + NQ 1279/QH15
- **Source:** [provinces.open-api.vn](https://provinces.open-api.vn/api/v2) API v2 (đã refresh post NQ 60/2025) cross-check [dvhcvn.gov.vn](https://dvhcvn.gov.vn)
- **Downloaded:** 2026-05-22 by `scripts/generate-admin-units-dataset.ts` (live API v2 pull)
- **Checksum:** `v2025-1300.sha256` (SHA256 hex, 1 line)

### Khác biệt so v2024-1279 (legacy, đã abolish):

- v2024-1279 dùng nguồn `frontend/src/data/wards-full.json` (snapshot trước cải cách) → 10,051 entries gồm 241 phường tên kiểu cũ ("Phường 1, 2, 3..." mỗi quận TPHCM cũ).
- v2025-1300 pull trực tiếp từ provinces.open-api.vn v2 (sau cải cách 2025) → 3,321 entries TÊN ĐỊA DANH thật ("Phường Bến Nghé, Phường Tân Định, Phường Sài Gòn..."). Số phường giảm vì sáp nhập.
- Snapshot import detect version mới → UPDATE rows match code, INSERT phường mới, **isActive=false + abolishedAt** cho 9,700+ legacy entries không có trong v2025-1300 (preserves FK integrity với records cũ).

## How dataset is loaded

1. Backend `seedAdminUnits()` reads `v2024-1279.json` + `.sha256`
2. Verifies checksum (fail-loud nếu mismatch)
3. Checks `admin_unit_dataset_imports` ledger; nếu version=ACTIVE → skip
4. Atomic transaction: upsert provinces + wards; abolish DB rows không có trong dataset
5. Ledger row marked ACTIVE; previous ACTIVE → SUPERSEDED
6. AuditLog: `ADMIN_UNIT_DATASET_IMPORTED` per version change

Existing query sites (`teams.service`, `cases.service`, `IsWardDirectory`, `ProvinceWardSelect`...) **không cần đổi** — snapshot pattern preserves `@@unique([type, code])` và `isActive` semantics.

## How to update dataset (when Bộ Nội vụ ra văn bản mới)

```bash
# 1. Pull new dvhcvn release
git clone https://github.com/daohoangson/dvhcvn /tmp/dvhcvn

# 2. Convert sang format pc02
cd backend
node scripts/convert-dvhcvn.ts /tmp/dvhcvn/release-vX → data/admin-units/vX-YYYY.json
# (script này sẽ build trong v0.35 — v0.34 dùng generate-admin-units-dataset.ts từ wards-full.json)

# 3. Compute checksum
sha256sum data/admin-units/vX-YYYY.json | awk '{print $1}' > data/admin-units/vX-YYYY.sha256

# 4. Update README.md (this file) — bump "Current active version" section

# 5. Update seedAdminUnits() default version OR rename file để Prisma picks up
#    (snapshot import detects new version vs ACTIVE ledger row → triggers re-import)

# 6. Commit + PR
git add backend/data/admin-units/
git commit -m "chore(admin-units): bump dataset vX-YYYY (NQ YYYY)"
gh pr create --title "chore: dataset vX-YYYY" --body "Source: dvhcvn release vX, NQ YYYY/...,
verified by [tên người duyệt PC02 leadership]"
```

## Version history

| Version | Effective | Legal basis | Imported by | Notes |
|---------|-----------|-------------|-------------|-------|
| v2024-1279 | 2025-07-01 | NQ 1279/NQ-UBTVQH15 + NQ 60/2025 | seed v0.34.0.0 | Initial — 34 tỉnh, 10,051 phường (sau cải cách 2025 bỏ DISTRICT) |

## Why offline dataset (UC1 decision)

`/autoplan` Phase 1 cả Codex + Claude subagent ĐỘC LẬP recommend bỏ live community API:
- **An ninh mạng nội ngành:** không nên call external endpoint từ production police tool
- **Governance:** community API không có SLA + legal accountability cho ngành công an
- **Provenance audit:** signed dataset với checksum + ngày tải + ai duyệt → đáp ứng legal-grade reconstruction
- **Avoid data poisoning:** external scrape có thể trả sai → ghi sai địa giới trong hồ sơ vụ án

Update cadence: 1-2 lần / 5-10 năm khi có reform chính thức. Phù hợp với PR review flow, không cần live sync.
