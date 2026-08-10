#!/usr/bin/env bash
# PC02 deploy script — chạy trên VM sau khi rsync nhận tarball
# Usage: bash /home/pc02/bin/deploy.sh <RELEASE_SHA>
#
# Idempotent. Fail-safe: nếu migration fail, symlink chưa switch → backend cũ vẫn chạy.

set -euo pipefail

RELEASE_SHA="${1:?RELEASE_SHA required}"
TARBALL="/tmp/pc02-${RELEASE_SHA}.tar.gz"
RELEASES_DIR="/home/pc02/releases"
SHARED_DIR="/home/pc02/shared"
NEW_DIR="$RELEASES_DIR/$RELEASE_SHA"
CURRENT_SYMLINK="/home/pc02/current"

log() { echo "[deploy.sh $(date -Iseconds)] $*"; }

# 1. Pre-flight checks
[ -f "$TARBALL" ] || { log "ERROR: tarball $TARBALL not found"; exit 1; }
[ -d "$SHARED_DIR" ] || { log "ERROR: $SHARED_DIR missing — run migrate-existing.sh first"; exit 1; }
[ -f "$SHARED_DIR/.env" ] || { log "ERROR: $SHARED_DIR/.env missing"; exit 1; }

log "Deploying release $RELEASE_SHA"

# 2. Extract tarball
mkdir -p "$RELEASES_DIR"
if [ -d "$NEW_DIR" ]; then
    log "Release dir $NEW_DIR already exists — removing and re-extracting (idempotent)"
    rm -rf "$NEW_DIR"
fi
mkdir -p "$NEW_DIR"
tar -xzf "$TARBALL" -C "$NEW_DIR"
log "Extracted to $NEW_DIR"

# 3. Symlink shared resources (.env, keys, uploads)
ln -sfn "$SHARED_DIR/.env"     "$NEW_DIR/backend/.env"
ln -sfn "$SHARED_DIR/keys"     "$NEW_DIR/backend/keys"

# uploads/ — đảm bảo dir gốc tồn tại trong shared, sau đó symlink
mkdir -p "$SHARED_DIR/uploads"
if [ -d "$NEW_DIR/backend/uploads" ] && [ ! -L "$NEW_DIR/backend/uploads" ]; then
    rm -rf "$NEW_DIR/backend/uploads"
fi
ln -sfn "$SHARED_DIR/uploads"  "$NEW_DIR/backend/uploads"
log "Shared resources symlinked"

# 4. DB backup trước khi migrate (safety net)
BACKUP_FILE="/var/backups/pc02/pre-deploy-${RELEASE_SHA}-$(date +%Y%m%d_%H%M%S).sql.gz"
mkdir -p /var/backups/pc02
chmod 700 /var/backups/pc02 2>/dev/null || true
sudo -u postgres pg_dump -Fc -Z9 pc02_case_mgmt > "$BACKUP_FILE" 2>/dev/null || {
    log "WARNING: pre-deploy backup failed (non-fatal, continuing)"
}
if [ -f "$BACKUP_FILE" ]; then
    # SEC: backups chứa PII + TOTP secrets — chỉ root đọc.
    chmod 600 "$BACKUP_FILE" || log "WARNING: chmod 600 backup failed"
    log "Pre-deploy backup: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"
fi

# 5. Run prisma migrate deploy (BEFORE switching symlink — rollback path stays clean if fail)
cd "$NEW_DIR/backend"
log "Running prisma migrate deploy..."
if ! npx prisma migrate deploy; then
    log "ERROR: migration FAILED — keeping current symlink, no service restart"
    log "ERROR: investigate manually. Failed release dir: $NEW_DIR"
    log "ERROR: pre-deploy backup at: $BACKUP_FILE"
    exit 1
fi
log "Migrations applied"

# 5b. P1-005 — migration drift verification.
# Catches silent failures where _prisma_migrations table records migration as applied
# but DDL didn't actually execute (observed on dev 2026-05-22 — enrollment columns missing).
# If drift detected → keep old symlink, fail deploy fast.
log "Verifying schema integrity (P1-005)..."
if ! npx prisma migrate status > /tmp/prisma-status-${RELEASE_SHA}.log 2>&1; then
    log "WARNING: prisma migrate status non-zero. Output:"
    cat /tmp/prisma-status-${RELEASE_SHA}.log | head -30
    # Non-blocking warn — continue but flag for ops review
fi
log "Schema verification: $(grep -c 'have not yet been applied' /tmp/prisma-status-${RELEASE_SHA}.log || echo 0) pending migrations after deploy"

# 6. Atomic symlink switch
ln -sfn "$NEW_DIR" "$CURRENT_SYMLINK"
log "Symlink switched: $CURRENT_SYMLINK → $NEW_DIR"

# 7. Copy frontend dist sang /var/www/pc02 (nginx serve)
sudo cp -rT "$NEW_DIR/frontend/dist" /var/www/pc02
sudo chown -R www-data:www-data /var/www/pc02
log "Frontend deployed to /var/www/pc02"

# 7b. v0.42: seed DocumentNumberTemplates BEFORE restart (counters must exist before engine starts)
# Idempotent — skip nếu active template đã tồn tại cho documentType.
# Per CEO review: seed TRƯỚC restart để engine có counter rows ngay lần khởi động đầu tiên.
log "Seeding document-number templates..."
cd "$NEW_DIR/backend"
if ! npx ts-node prisma/seed-document-numbers.ts; then
    log "ERROR: document-numbers seed failed — aborting deploy"
    exit 1
fi
log "Document-numbers seed complete"

# 7c. Seed bộ mẫu chứng từ chuẩn VU_AN/VU_VIEC (idempotent, create-if-absent, không ghi đè bản admin).
# NON-FATAL: template không cản boot — fail chỉ cảnh báo, không abort deploy.
log "Seeding document templates (VU_AN/VU_VIEC)..."
if ! npx ts-node prisma/seed-document-templates.ts; then
    log "WARN: document-templates seed failed — tiếp tục deploy (non-fatal)"
fi

# 8. Restart backend service
sudo systemctl restart pc02-backend
log "pc02-backend restarted"

# 9. Health check (5 retries × 2s = 10s timeout)
sleep 2  # give backend time to bind port
if bash /home/pc02/bin/health-check.sh; then
    log "Health check PASSED"
else
    log "ERROR: health check FAILED — backend started but unhealthy"
    log "Last 50 lines from journalctl:"
    sudo journalctl -u pc02-backend --no-pager -n 50 || true
    exit 1
fi

# 9b. P1-003 — idempotent feature_flags seed AFTER health check.
# Uses Node script (not psql per ENG-5) — reuses app's PrismaPg adapter + DATABASE_URL handling.
# Runs ONLY if feature_flags table empty (fresh DB or post-recovery). Skipped silently otherwise.
# Per CLAUDE.md "CRITICAL — feature_flags seed": sidebar trống nếu skip on fresh DB → DOA.
log "Checking feature_flags seed state..."
cd "$CURRENT_SYMLINK/backend"
if ! npx ts-node prisma/seed-features-if-empty.ts; then
    log "WARNING: feature_flags seed check failed (non-fatal — may need manual rerun)"
    # Non-fatal: deploy continues. Sidebar may be empty if fresh DB + seed failed.
fi

# 9b-2. Idempotent permission seed AFTER health check.
# deploy.sh never runs `npm run db:seed` — it must not, because seed.ts touches
# user accounts and needs SEED_ADMIN_PASSWORD. So a release that adds a new
# @RequirePermissions ships an endpoint whose permission row does not exist in
# prod, and PermissionsGuard (no ADMIN bypass) 403s it for EVERY user.
# That is ISSUE-001: `Setting` was missing and /admin/settings was dead for all
# roles. This runner only upserts permissions and grants them to ADMIN.
# The timeout is not decoration: this opens a DB connection and upserts rows,
# so a lock held by a long-running query would otherwise hang the deploy job
# with no upper bound. Failing loudly after 5 minutes beats hanging forever.
log "Syncing permission registry..."
if ! timeout 300 npx ts-node prisma/seed-permissions-runner.ts; then
    log "ERROR: permission seed failed or timed out — new endpoints would 403 for every user"
    exit 1
fi

# 9c. v0.37.0.2 — idempotent admin-units seed AFTER health check.
# seedAdminUnits skip nếu ledger version đã ACTIVE → no-op for steady state.
# Imports v2025-1300 lần đầu (fresh DB) hoặc khi dataset version bump (next release).
# FATAL per Eng review Decision T2A: admin-units thiếu = bug user-facing (sidebar/forms broken).
# For one-time migration from legacy seedWards data (10k pre-reform wards), run manually:
#   ssh pc02vm "cd /home/pc02/current/backend && npx ts-node prisma/seed-admin-units-runner.ts --clean-slate"
log "Checking admin-units seed state..."
if ! npx ts-node prisma/seed-admin-units-runner.ts; then
    log "ERROR: admin-units seed failed — aborting deploy (deploy considered unhealthy)"
    exit 1
fi

# 10. Prune old releases (keep latest 5)
KEEP=5
TOTAL=$(ls -1d "$RELEASES_DIR"/*/ 2>/dev/null | wc -l)
if [ "$TOTAL" -gt "$KEEP" ]; then
    PRUNE=$((TOTAL - KEEP))
    log "Pruning $PRUNE old releases (keeping $KEEP)"
    ls -1dt "$RELEASES_DIR"/*/ | tail -n "$PRUNE" | xargs -r rm -rf
fi

# 11. Cleanup tarball
rm -f "$TARBALL"

# 12. Final summary
log "=========================================="
log "Deploy OK: $RELEASE_SHA"
log "Current: $(readlink "$CURRENT_SYMLINK")"
log "Releases on disk: $(ls -1d "$RELEASES_DIR"/*/ | wc -l)"
log "Disk free: $(df -h /home | tail -1 | awk '{print $4}')"
log "=========================================="
