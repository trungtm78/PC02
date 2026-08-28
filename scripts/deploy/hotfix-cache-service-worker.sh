#!/usr/bin/env bash
# Hotfix: cán bộ phải Ctrl+Shift+R mới thấy bản mới, và hộp báo "có cập nhật" ở góc phải
# không còn hiện.
#
# ── Nguyên nhân (đo trên máy chạy 28/08/2026) ──
#
#   curl -I http://171.244.40.245/sw.js
#     Cache-Control: public, immutable
#     Cache-Control: max-age=2592000          ← 30 NGÀY
#
#   curl -I http://171.244.40.245/index.html
#     (KHÔNG có Cache-Control)                ← trình duyệt tự đoán, giữ bản cũ
#
# Luật tài nguyên tĩnh `location ~* \.(js|css|...)$ { expires 30d; immutable }` bắt luôn
# `sw.js`, vì nó cũng đuôi `.js`. Service worker bị giữ 30 ngày nên trình duyệt KHÔNG BAO GIỜ
# tải lại nó, KHÔNG BAO GIỜ phát hiện bản mới, và `registerType: 'prompt'` của vite-plugin-pwa
# không có gì để báo — hộp "Có bản cập nhật" (PwaUpdatePrompt.tsx) vĩnh viễn im lặng.
#
# `index.html` không có `Cache-Control` nên trình duyệt dùng luật đoán (thường 10% tuổi tệp):
# nó phục vụ lại bản HTML cũ mà không hỏi máy chủ, và bản cũ trỏ vào gói JS cũ. Đó là lý do
# CHỈ Ctrl+Shift+R (bỏ qua toàn bộ bộ nhớ đệm) mới thấy bản mới.
#
# Tệp trong `/assets/` giữ nguyên `immutable` — chúng có mã băm trong tên nên đổi nội dung là
# đổi tên, cache lâu là đúng và cần thiết.
#
# ── Vì sao phải chạy tay ──
#
# Cấu hình nginx KHÔNG do đường deploy áp (xem `install-nginx-config.sh` — cần sudo). Bản đang
# chạy trên máy đã LỆCH khỏi `scripts/deploy/nginx-pc02.conf` trong kho: bản trong kho có khối
# `location = /index.html` no-cache, bản đang chạy không có.
#
# Usage trên VM (user pc02):
#   sudo bash hotfix-cache-service-worker.sh
#
# Idempotent: chạy lại thấy đã có thì bỏ qua. Hỏng thì tự khôi phục bản sao lưu.

set -euo pipefail

# Vá MỌI site đang bật, không chỉ tệp đầu tiên.
#
# Máy chạy có HAI site bật cùng lúc: `new.pc02hcm.com` (tên miền, cổng 443) và `pc02`
# (`listen 80 default_server; server_name _;` — chính là đường phục vụ địa chỉ IP mà cán bộ
# đang dùng). Lấy `head -1` thì vá đúng site tên miền, `nginx -t` xanh, `reload` chạy, mà cán
# bộ vào bằng IP KHÔNG thấy đổi gì. Đúng chuyện đã xảy ra 28/08/2026 — hai lần liên tiếp.
DS=$(ls /etc/nginx/sites-enabled/* 2>/dev/null)
if [ -z "$DS" ]; then
    echo "ERROR: không có site nào đang bật" >&2
    exit 1
fi

DA_SUA=0
for CONFIG in $DS; do
CONFIG=$(readlink -f "$CONFIG")
BACKUP="${CONFIG}.bak.$(date +%Y%m%d_%H%M%S)"
echo "Cấu hình: $CONFIG"

if grep -q "location = /sw.js" "$CONFIG"; then
    echo "  ✓ $CONFIG — đã có sẵn, bỏ qua"
    continue
fi

cp -p "$CONFIG" "$BACKUP"
echo "Sao lưu: $BACKUP"

# Khối `=` (khớp chính xác) luôn thắng khối regex nên đặt ở đâu cũng đúng; chèn trước luật
# tài nguyên tĩnh cho dễ đọc. `workbox-<băm>.js` phải dùng regex và phải đứng TRƯỚC luật tĩnh
# vì regex xét theo thứ tự xuất hiện.
#
# `add_header` KHÔNG kế thừa vào khối con nên phải phát lại tiêu đề an toàn.
KHOI='    # Hotfix 2026-08-28: service worker + index.html KHÔNG được cache lâu.\n    # Luật tĩnh bên dưới bắt cả sw.js (cũng đuôi .js) nên trình duyệt giữ nó 30 ngày,\n    # không bao giờ phát hiện bản mới, và hộp báo "có cập nhật" không bao giờ hiện.\n    location = /sw.js {\n        add_header Cache-Control "no-cache, must-revalidate" always;\n        add_header X-Content-Type-Options "nosniff" always;\n        add_header X-Frame-Options "DENY" always;\n    }\n\n    location = /index.html {\n        add_header Cache-Control "no-cache, must-revalidate" always;\n        add_header X-Content-Type-Options "nosniff" always;\n        add_header X-Frame-Options "DENY" always;\n    }\n\n    location = /manifest.webmanifest {\n        add_header Cache-Control "no-cache, must-revalidate" always;\n        add_header X-Content-Type-Options "nosniff" always;\n    }\n\n    location ~* ^/(workbox|registerSW)-?.*\\.js$ {\n        add_header Cache-Control "no-cache, must-revalidate" always;\n        add_header X-Content-Type-Options "nosniff" always;\n        add_header X-Frame-Options "DENY" always;\n    }\n\n'

# Chèn trước MỌI khối tài nguyên tĩnh — tệp cấu hình có nhiều khối `server` (một cho tên miền,
# một bắt-tất-cả phục vụ theo địa chỉ IP). Vá đúng một khối thì đường vào kia vẫn hỏng.
SO_NEO=$(grep -c "location ~\* .*js|css" "$CONFIG" || true)
if [ "${SO_NEO:-0}" -eq 0 ]; then
    echo "  ! $CONFIG — không có khối tài nguyên tĩnh, bỏ qua"
    rm -f "$BACKUP"
    continue
fi
echo "Số khối tài nguyên tĩnh sẽ vá: $SO_NEO"
sed -i "/location ~\* .*js|css/i\\${KHOI}" "$CONFIG"

DA_SUA=$((DA_SUA + 1))
done

if ! nginx -t 2>&1; then
    echo "ERROR: nginx -t hỏng. Khôi phục mọi bản sao lưu vừa tạo." >&2
    for CONFIG in $DS; do
        C=$(readlink -f "$CONFIG")
        B=$(ls -t "${C}".bak.* 2>/dev/null | head -1)
        [ -n "$B" ] && cp -p "$B" "$C"
    done
    nginx -t
    exit 1
fi

echo "Đã sửa $DA_SUA tệp cấu hình."
systemctl reload nginx
echo "✓ đã nạp lại nginx"

echo
echo "── Kiểm lại ──"
for u in /sw.js /index.html; do
    echo "== $u"
    curl -sI "http://127.0.0.1$u" | grep -iE '^HTTP|cache-control' || true
done
echo
echo "Mong đợi: sw.js và index.html đều 'no-cache, must-revalidate'."
echo "Tệp trong /assets/ vẫn phải giữ 'immutable' — chúng có mã băm trong tên."
