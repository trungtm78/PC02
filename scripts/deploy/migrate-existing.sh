#!/usr/bin/env bash
# Migration script — chuyển layout VM từ /home/pc02/app/ (SCP-based)
# sang /home/pc02/releases/<sha>/ + symlink current (CI/CD-based).
#
# Chạy 1 LẦN trên VM khi setup CI/CD lần đầu.
# Idempotent: rerun không hỏng gì.

set -euo pipefail

APP_OLD="/home/pc02/app"
RELEASES_DIR="/home/pc02/releases"
SHARED_DIR="/home/pc02/shared"
INITIAL_SHA="initial-$(date +%Y%m%d-%H%M%S)"
INITIAL_DIR="$RELEASES_DIR/$INITIAL_SHA"
CURRENT_SYMLINK="/home/pc02/current"
SYSTEMD_UNIT="/etc/systemd/system/pc02-backend.service"

log() { echo "[migrate-existing $(date -Iseconds)] $*"; }

# 1. Sanity check — đã migrate rồi chưa?
if [ -L "$CURRENT_SYMLINK" ] && [ -d "$SHARED_DIR" ]; then
    log "Already migrated: $CURRENT_SYMLINK → $(readlink "$CURRENT_SYMLINK")"
    log "Re-running is safe but unnecessary. Exit."
    exit 0
fi

[ -d "$APP_OLD" ] || { log "ERROR: $APP_OLD not found — nothing to migrate"; exit 1; }
[ -d "$APP_OLD/backend" ] || { log "ERROR: $APP_OLD/backend missing"; exit 1; }

log "Migrating $APP_OLD to release-based layout"

# 2. Pre-migrate backup
BACKUP_TARBALL="/var/backups/pc02/pre-cicd-migration-$(date +%Y%m%d_%H%M%S).tar.gz"
sudo mkdir -p /var/backups/pc02
log "Creating snapshot: $BACKUP_TARBALL"
sudo tar -czf "$BACKUP_TARBALL" -C /home/pc02 app/
sudo chmod 600 "$BACKUP_TARBALL"
log "Backup: $(du -h "$BACKUP_TARBALL" | cut -f1)"

# 3. Tạo shared dir + di chuyển .env, keys/, uploads/
mkdir -p "$SHARED_DIR"

# .env
if [ -f "$APP_OLD/backend/.env" ] && [ ! -L "$APP_OLD/backend/.env" ]; then
    mv "$APP_OLD/backend/.env" "$SHARED_DIR/.env"
    chmod 600 "$SHARED_DIR/.env"
    log "Moved .env to shared/"
fi

# keys/
if [ -d "$APP_OLD/backend/keys" ] && [ ! -L "$APP_OLD/backend/keys" ]; then
    mv "$APP_OLD/backend/keys" "$SHARED_DIR/keys"
    log "Moved keys/ to shared/"
fi

# uploads/
if [ -d "$APP_OLD/backend/uploads" ] && [ ! -L "$APP_OLD/backend/uploads" ]; then
    mv "$APP_OLD/backend/uploads" "$SHARED_DIR/uploads"
    log "Moved uploads/ to shared/"
fi

# 4. Tạo release initial
mkdir -p "$RELEASES_DIR"
log "Creating initial release at $INITIAL_DIR"
# Move whole app/ → releases/<sha>/ (giữ atime/mtime)
mv "$APP_OLD" "$INITIAL_DIR"

# 5. Symlink shared resources vào release
ln -sfn "$SHARED_DIR/.env"     "$INITIAL_DIR/backend/.env"
ln -sfn "$SHARED_DIR/keys"     "$INITIAL_DIR/backend/keys"
ln -sfn "$SHARED_DIR/uploads"  "$INITIAL_DIR/backend/uploads"
log "Symlinks created in release"

# 6. Ownership
chown -R pc02:pc02 "$RELEASES_DIR" "$SHARED_DIR"

# 7. Tạo current symlink
ln -sfn "$INITIAL_DIR" "$CURRENT_SYMLINK"
chown -h pc02:pc02 "$CURRENT_SYMLINK"
log "current → $INITIAL_DIR"

# 8. Update systemd unit
log "Updating systemd unit"
sudo sed -i.bak \
    -e 's|^WorkingDirectory=.*|WorkingDirectory=/home/pc02/current/backend|' \
    -e 's|^EnvironmentFile=.*|EnvironmentFile=/home/pc02/current/backend/.env|' \
    -e 's|^ExecStart=.*|ExecStart=/usr/bin/node /home/pc02/current/backend/dist/src/main.js|' \
    "$SYSTEMD_UNIT"

# ReadWritePaths cần update để cho phép ghi vào shared dir
if grep -q "^ReadWritePaths=" "$SYSTEMD_UNIT"; then
    sudo sed -i \
        -e 's|^ReadWritePaths=.*|ReadWritePaths=/home/pc02/shared/uploads /home/pc02/shared/keys /var/log/pc02|' \
        "$SYSTEMD_UNIT"
fi

# 9. Reload systemd + restart
sudo systemctl daemon-reload
sudo systemctl restart pc02-backend
sleep 3

# 10. Health check
if bash "$INITIAL_DIR/scripts/deploy/health-check.sh" 2>/dev/null || \
   curl -sf -m 5 http://localhost:3000/api/v1/health > /dev/null; then
    log "Health check OK — migration complete"
else
    log "ERROR: backend not healthy. Rollback manually:"
    log "  sudo mv $SYSTEMD_UNIT.bak $SYSTEMD_UNIT"
    log "  mv $INITIAL_DIR $APP_OLD"
    log "  Restore env/keys/uploads from $SHARED_DIR back into $APP_OLD/backend/"
    log "  sudo systemctl daemon-reload && sudo systemctl restart pc02-backend"
    exit 1
fi

# 11. Install deploy scripts vào /home/pc02/bin/
mkdir -p /home/pc02/bin
cp "$INITIAL_DIR/scripts/deploy/deploy.sh"       /home/pc02/bin/deploy.sh
cp "$INITIAL_DIR/scripts/deploy/health-check.sh" /home/pc02/bin/health-check.sh
cp "$INITIAL_DIR/scripts/deploy/rollback.sh"     /home/pc02/bin/rollback.sh
chmod +x /home/pc02/bin/*.sh
chown -R pc02:pc02 /home/pc02/bin
log "Deploy scripts installed to /home/pc02/bin/"

log "=========================================="
log "Migration OK"
log "Current: $CURRENT_SYMLINK → $(readlink "$CURRENT_SYMLINK")"
log "Shared:  $SHARED_DIR ($(ls "$SHARED_DIR"))"
log "Backup:  $BACKUP_TARBALL"
log "=========================================="
log "Next steps:"
log "  1. Add CI/CD SSH public key to /home/pc02/.ssh/authorized_keys"
log "  2. Update /etc/sudoers.d/pc02 to allow cp to /var/www/pc02"
log "  3. Trigger workflow_dispatch on GitHub to test first deploy"
