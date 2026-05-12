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
sudo -u postgres pg_dump -Fc -Z9 pc02_case_mgmt > "$BACKUP_FILE" 2>/dev/null || {
    log "WARNING: pre-deploy backup failed (non-fatal, continuing)"
}
[ -f "$BACKUP_FILE" ] && log "Pre-deploy backup: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

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

# 6. Atomic symlink switch
ln -sfn "$NEW_DIR" "$CURRENT_SYMLINK"
log "Symlink switched: $CURRENT_SYMLINK → $NEW_DIR"

# 7. Copy frontend dist sang /var/www/pc02 (nginx serve)
sudo cp -rT "$NEW_DIR/frontend/dist" /var/www/pc02
sudo chown -R www-data:www-data /var/www/pc02
log "Frontend deployed to /var/www/pc02"

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
