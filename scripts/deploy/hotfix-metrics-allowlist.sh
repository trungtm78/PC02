#!/usr/bin/env bash
# Hotfix: thêm location block IP allowlist cho /api/v1/metrics vào nginx config
# hiện tại trên VM. KHÔNG replace toàn bộ config (giữ HTTP-only behavior cho đến
# khi anh setup TLS).
#
# Usage trên VM (pc02 user):
#   sudo bash hotfix-metrics-allowlist.sh
#
# Idempotent: detect block đã tồn tại thì skip.

set -euo pipefail

CONFIG="/etc/nginx/sites-available/pc02"
BACKUP="${CONFIG}.bak.$(date +%Y%m%d_%H%M%S)"

if [ ! -f "$CONFIG" ]; then
    echo "ERROR: $CONFIG không tồn tại" >&2
    exit 1
fi

# Idempotency: skip nếu đã có metrics block
if grep -q "location = /api/v1/metrics" "$CONFIG"; then
    echo "✓ Metrics IP allowlist đã có sẵn — skip"
    exit 0
fi

# Backup
cp -p "$CONFIG" "$BACKUP"
echo "Backup: $BACKUP"

# Insert block trước "location /api/" — dùng sed
# Dòng cần insert (giữ tab/space giống style file)
INSERT_BLOCK='    # Hotfix 2026-05-16: IP allowlist cho metrics endpoint.\n    # Sprint 3 ship MetricsModule expose Prometheus internals (login counters,\n    # CPU, 2FA stats). Block external access — chỉ Prometheus container\n    # localhost được scrape. Backend cũng có MetricsIpAllowlistGuard\n    # (defense-in-depth, ship trong v0.23.1.0).\n    location = /api/v1/metrics {\n        allow 127.0.0.1;\n        allow ::1;\n        deny all;\n        proxy_pass http://127.0.0.1:3000;\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n    }\n\n'

# Sed: insert trước line bắt đầu bằng "    # Backend API" hoặc "    location /api/"
sed -i "/    # Backend API/i\\${INSERT_BLOCK}" "$CONFIG"

# Validate
if ! nginx -t 2>&1; then
    echo "ERROR: nginx -t failed. Restoring backup."
    cp -p "$BACKUP" "$CONFIG"
    nginx -t
    exit 1
fi

# Reload
systemctl reload nginx
echo "✓ nginx reloaded"

# Verify từ external IP
sleep 1
EXTERNAL_TEST=$(curl -s -o /dev/null -w "%{http_code}" -H "Host: 171.244.40.245" http://127.0.0.1/api/v1/metrics 2>&1)
LOCAL_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1/api/v1/metrics 2>&1)
echo ""
echo "Verification:"
echo "  Local (127.0.0.1):  HTTP $LOCAL_TEST  (expect 200)"
echo "  External simulated: HTTP $EXTERNAL_TEST (expect 200 vì cùng host header — test thực tế từ máy ngoài để verify deny)"
echo ""
echo "Test thực từ máy ngoài VM:"
echo "  curl -i http://171.244.40.245/api/v1/metrics  # expect 403"
