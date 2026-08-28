#!/usr/bin/env bash
# Cài bộ canh luật cache nginx — chạy MỘT LẦN bằng root trên mỗi máy chủ.
#
# ── Vì sao cần ──
#
# Luật tài nguyên tĩnh của nginx bắt theo đuôi tệp, nên `location ~* \.(js|css|…)$` bắt LUÔN
# `sw.js`. Service worker bị giữ `immutable` 30 ngày thì trình duyệt không bao giờ tải lại nó,
# không bao giờ biết có bản mới, và hộp báo "có cập nhật" ở góc phải vĩnh viễn im lặng — cán
# bộ phải Ctrl+Shift+R mới thấy bản vừa deploy. Anh báo 28/08/2026.
#
# Cấu hình nginx KHÔNG do đường deploy áp, và trên máy chạy nó đã LỆCH khỏi kho mã từ trước.
# Nên chỉ vá một lần là chưa đủ: dựng lại máy, hoặc ai đó sửa tay, là lệch lại.
#
# Script này đặt bộ canh vào `/usr/local/sbin/` và cấp cho user deploy quyền chạy ĐÚNG lệnh ấy
# không cần mật khẩu, để `deploy.sh` tự kiểm mỗi lần deploy.
#
# ── Vì sao CHỈ THÊM, không thay cả tệp ──
#
# Cấu hình đang chạy có phần TLS do certbot quản và các khối riêng (allowlist metrics, giới hạn
# tốc độ đăng nhập). Thay cả tệp bằng bản trong kho là xoá mất chúng và có thể làm sập TLS.
#
# Usage (một lần, bằng root):
#   sudo bash install-nginx-cache-guard.sh
#
# Idempotent: chạy lại chỉ cập nhật bộ canh, không nhân đôi dòng sudoers.

set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
    echo "ERROR: phải chạy bằng root" >&2
    exit 1
fi

DICH=/usr/local/sbin/pc02-ensure-nginx-cache
USER_DEPLOY="${1:-pc02}"

cat > "$DICH" <<'GUARD'
#!/usr/bin/env bash
# Bảo đảm mọi site nginx đang bật có luật cache đúng cho service worker và index.html.
#
# CHỈ THÊM khối còn thiếu, không bao giờ thay cả tệp. Idempotent. Hỏng thì khôi phục và trả về
# mã lỗi để deploy nhìn thấy.
set -euo pipefail

DS=$(ls /etc/nginx/sites-enabled/* 2>/dev/null || true)
if [ -z "$DS" ]; then
    echo "Không có site nào đang bật — bỏ qua"
    exit 0
fi

KHOI='    # pc02-ensure-nginx-cache: service worker + index.html KHÔNG được cache lâu.\n    # Luật tĩnh bắt theo đuôi .js nên nó bắt cả sw.js; giữ 30 ngày là trình duyệt không\n    # bao giờ thấy bản mới, và hộp báo "có cập nhật" không bao giờ hiện.\n    location = /sw.js {\n        add_header Cache-Control "no-cache, must-revalidate" always;\n        add_header X-Content-Type-Options "nosniff" always;\n        add_header X-Frame-Options "DENY" always;\n    }\n\n    location = /index.html {\n        add_header Cache-Control "no-cache, must-revalidate" always;\n        add_header X-Content-Type-Options "nosniff" always;\n        add_header X-Frame-Options "DENY" always;\n    }\n\n    location = /manifest.webmanifest {\n        add_header Cache-Control "no-cache, must-revalidate" always;\n        add_header X-Content-Type-Options "nosniff" always;\n    }\n\n    location ~* ^/(workbox|registerSW)-?.*\\.js$ {\n        add_header Cache-Control "no-cache, must-revalidate" always;\n        add_header X-Content-Type-Options "nosniff" always;\n        add_header X-Frame-Options "DENY" always;\n    }\n\n'

DA_SUA=0
DA_LUU=""
# Duyệt MỌI site đang bật. Máy chạy có hai site cùng lúc: một cho tên miền, một
# `default_server` phục vụ địa chỉ IP. Vá đúng một cái thì đường vào kia vẫn hỏng — đã dính
# đúng thế hai lần liên tiếp ngày 28/08/2026.
for L in $DS; do
    C=$(readlink -f "$L")
    grep -q "location = /sw.js" "$C" && continue
    grep -q "location ~\* .*js|css" "$C" || continue
    B="${C}.bak.$(date +%Y%m%d_%H%M%S)"
    cp -p "$C" "$B"
    DA_LUU="$DA_LUU $C:$B"
    sed -i "/location ~\* .*js|css/i\\${KHOI}" "$C"
    DA_SUA=$((DA_SUA + 1))
done

if [ "$DA_SUA" -eq 0 ]; then
    echo "Luật cache đã đúng — không sửa gì"
    exit 0
fi

if ! nginx -t >/dev/null 2>&1; then
    echo "ERROR: nginx -t hỏng — khôi phục" >&2
    for CB in $DA_LUU; do cp -p "${CB#*:}" "${CB%%:*}"; done
    nginx -t
    exit 1
fi

systemctl reload nginx

# Nạp lại là BẤT ĐỒNG BỘ: tiến trình cũ còn phục vụ nốt yêu cầu đang dở, nên đo ngay lập tức
# vẫn ra đầu HTTP cũ. Chờ rồi mới kiểm — và kiểm THẬT, để deploy hỏng ồn ào thay vì im lặng
# báo thành công trong khi cán bộ vẫn không thấy bản mới.
sleep 2
for U in /sw.js /index.html; do
    CC=$(curl -sI "http://127.0.0.1$U" | grep -i '^cache-control' || true)
    case "$CC" in
        *no-cache*) ;;
        *) echo "ERROR: $U vẫn còn '$CC' sau khi nạp lại" >&2; exit 1 ;;
    esac
done
echo "Đã đặt luật cache cho $DA_SUA site, nạp lại nginx, và kiểm lại đầu HTTP: đạt"
GUARD

chmod 755 "$DICH"
echo "✓ đã đặt $DICH"

SUDOERS=/etc/sudoers.d/pc02-nginx-cache
echo "$USER_DEPLOY ALL=(ALL) NOPASSWD: $DICH" > "$SUDOERS"
chmod 440 "$SUDOERS"
if ! visudo -c -f "$SUDOERS" >/dev/null; then
    echo "ERROR: dòng sudoers không hợp lệ — gỡ bỏ" >&2
    rm -f "$SUDOERS"
    exit 1
fi
echo "✓ đã cấp quyền không-mật-khẩu cho $USER_DEPLOY chạy $DICH"

echo
echo "── Chạy thử ngay ──"
"$DICH"
echo
for u in /sw.js /index.html; do
    echo "== $u"
    curl -sI "http://127.0.0.1$u" | grep -iE '^HTTP|cache-control' || true
done
