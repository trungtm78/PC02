#!/usr/bin/env bash
# PC02 rollback script — manual rollback về release trước (hoặc release cụ thể)
# Usage:
#   bash /home/pc02/bin/rollback.sh             # rollback về release trước đó
#   bash /home/pc02/bin/rollback.sh <SHA>       # rollback về release SHA cụ thể
#   bash /home/pc02/bin/rollback.sh --list      # list các release available

set -euo pipefail

RELEASES_DIR="/home/pc02/releases"
CURRENT_SYMLINK="/home/pc02/current"

log() { echo "[rollback.sh $(date -Iseconds)] $*"; }

# List mode
if [ "${1:-}" = "--list" ] || [ "${1:-}" = "-l" ]; then
    echo "Available releases (newest first):"
    ls -1dt "$RELEASES_DIR"/*/ 2>/dev/null | while read -r dir; do
        sha=$(basename "$dir")
        mtime=$(stat -c %y "$dir" | cut -d'.' -f1)
        is_current=""
        if [ "$(readlink "$CURRENT_SYMLINK" 2>/dev/null)" = "$dir" ] || \
           [ "$(readlink "$CURRENT_SYMLINK" 2>/dev/null)" = "${dir%/}" ]; then
            is_current=" ← CURRENT"
        fi
        echo "  $sha ($mtime)$is_current"
    done
    exit 0
fi

# Determine target
if [ -n "${1:-}" ]; then
    TARGET_SHA="$1"
    TARGET="$RELEASES_DIR/$TARGET_SHA"
    [ -d "$TARGET" ] || { log "ERROR: release $TARGET_SHA not found"; exit 1; }
else
    # Rollback to previous (2nd most recent)
    TARGET=$(ls -1dt "$RELEASES_DIR"/*/ 2>/dev/null | sed -n '2p' | sed 's:/$::')
    [ -n "$TARGET" ] || { log "ERROR: no previous release available"; exit 1; }
    TARGET_SHA=$(basename "$TARGET")
fi

CURRENT_TARGET=$(readlink "$CURRENT_SYMLINK" 2>/dev/null || echo "")
if [ "$CURRENT_TARGET" = "$TARGET" ]; then
    log "WARNING: $TARGET_SHA is already current — no rollback needed"
    exit 0
fi

log "Rolling back: $CURRENT_TARGET → $TARGET"

# Switch symlink
ln -sfn "$TARGET" "$CURRENT_SYMLINK"
log "Symlink switched to $TARGET"

# Copy frontend
sudo cp -rT "$TARGET/frontend/dist" /var/www/pc02
sudo chown -R www-data:www-data /var/www/pc02
log "Frontend reverted"

# Restart backend
sudo systemctl restart pc02-backend
log "pc02-backend restarted"

# Health check
sleep 2
if bash /home/pc02/bin/health-check.sh; then
    log "Rollback OK — running $TARGET_SHA"
else
    log "ERROR: health check failed after rollback. Manual intervention required."
    sudo journalctl -u pc02-backend --no-pager -n 30 || true
    exit 1
fi

log "=========================================="
log "Rollback complete"
log "Note: DB migration NOT rolled back automatically."
log "If schema changed, restore from /var/backups/pc02/ via pg_restore."
log "=========================================="
