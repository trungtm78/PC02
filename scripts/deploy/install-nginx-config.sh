#!/usr/bin/env bash
# Sprint 1 / S1.5 — Install nginx golden config lên system nginx.
#
# Usage: sudo ./install-nginx-config.sh <domain>
# Example: sudo ./install-nginx-config.sh pc02.example.gov.vn
#
# Idempotent: chạy lại nhiều lần OK, backup config cũ trước khi ghi đè.

set -euo pipefail

if [ "$#" -ne 1 ]; then
    echo "Usage: sudo $0 <domain>" >&2
    echo "Example: sudo $0 pc02.example.gov.vn" >&2
    exit 1
fi

DOMAIN="$1"
SOURCE_CONF="$(dirname "$0")/nginx-pc02.conf"
TARGET_CONF="/etc/nginx/sites-available/pc02"
SYMLINK="/etc/nginx/sites-enabled/pc02"
BACKUP_DIR="/var/backups/pc02-nginx"

if [ "$EUID" -ne 0 ]; then
    echo "Phải chạy với sudo (cần ghi /etc/nginx/)" >&2
    exit 1
fi

if [ ! -f "$SOURCE_CONF" ]; then
    echo "ERROR: không tìm thấy $SOURCE_CONF" >&2
    exit 1
fi

# Validate domain format (simple check — không phải bullet-proof)
if ! echo "$DOMAIN" | grep -qE '^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$'; then
    echo "ERROR: domain '$DOMAIN' không hợp lệ" >&2
    exit 1
fi

# Backup config hiện tại
if [ -f "$TARGET_CONF" ]; then
    mkdir -p "$BACKUP_DIR"
    BACKUP_FILE="$BACKUP_DIR/pc02-$(date +%Y%m%d_%H%M%S).conf.bak"
    cp -p "$TARGET_CONF" "$BACKUP_FILE"
    echo "Backup config cũ → $BACKUP_FILE"
fi

# Render template — thay __DOMAIN__ bằng domain thực
sed "s|__DOMAIN__|${DOMAIN}|g" "$SOURCE_CONF" > "$TARGET_CONF"
chmod 644 "$TARGET_CONF"
echo "Wrote $TARGET_CONF (domain=$DOMAIN)"

# Bật site nếu chưa có symlink
if [ ! -L "$SYMLINK" ]; then
    ln -s "$TARGET_CONF" "$SYMLINK"
    echo "Created symlink $SYMLINK"
fi

# Vô hiệu hoá default site nếu còn
if [ -L /etc/nginx/sites-enabled/default ]; then
    rm /etc/nginx/sites-enabled/default
    echo "Disabled /etc/nginx/sites-enabled/default"
fi

# Validate config
if ! nginx -t; then
    echo "ERROR: nginx -t failed. Config không reload." >&2
    echo "Backup vẫn ở $BACKUP_FILE — anh có thể rollback thủ công." >&2
    exit 1
fi

# Reload nginx
systemctl reload nginx
echo "✓ nginx reloaded"

# Health check
sleep 1
if curl -sf -o /dev/null -w "%{http_code}" "https://${DOMAIN}/api/v1/health" 2>&1 | grep -q "^200$"; then
    echo "✓ Health check PASS — https://${DOMAIN}/api/v1/health → 200"
else
    echo "⚠ Health check chưa pass — có thể TLS cert chưa cấp hoặc backend chưa run."
    echo "  Kiểm tra: sudo systemctl status pc02-backend"
    echo "  Kiểm tra: sudo certbot certificates"
fi
