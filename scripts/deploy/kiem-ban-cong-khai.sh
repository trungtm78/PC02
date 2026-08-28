#!/usr/bin/env bash
# Kiểm bản CÔNG KHAI có đúng bản vừa deploy không.
#
# ── Vì sao cần ──
#
# Ngày 28/08/2026: deploy xanh, health ok, máy chủ gốc phục vụ đúng bản mới — mà cán bộ vẫn
# thấy app cũ suốt 5 ngày, phải Ctrl+Shift+R mới thấy bản mới.
#
# Nguyên nhân: `sw.js` từng được phục vụ với `Cache-Control: immutable, max-age=30d`, nên CDN
# (Cloudflare) giữ nó ở biên 30 ngày. Trình duyệt hỏi bản mới, biên trả lại đúng bản cũ →
# không phát hiện có cập nhật → hộp báo không bao giờ hiện → service worker cũ tiếp tục phục
# vụ gói cũ từ kho nội bộ của nó.
#
# Không ai thấy gì bất thường: mọi tệp cũ vẫn nằm trong /var/www/pc02 (deploy chép đè, không
# xoá), nên app cũ chạy trơn tru. Hỏng HOÀN TOÀN IM LẶNG.
#
# Kiểm ở đây so BẢN CÔNG KHAI với BẢN GỐC. Lệch là báo động — deploy vẫn thành công nhưng
# người dùng không nhận được.
#
# Usage:
#   bash kiem-ban-cong-khai.sh https://new.pc02hcm.com http://127.0.0.1
#
# Trả 0 nếu khớp, 1 nếu lệch.

set -uo pipefail

CONG_KHAI="${1:-}"
GOC="${2:-http://127.0.0.1}"

if [ -z "$CONG_KHAI" ]; then
    echo "Bỏ qua: chưa khai địa chỉ công khai"
    exit 0
fi

bam() {
    curl -s -m 30 "$1" 2>/dev/null | md5sum | cut -d' ' -f1
}

LECH=0
for TEP in /sw.js /index.html; do
    A=$(bam "${GOC}${TEP}")
    B=$(bam "${CONG_KHAI}${TEP}")
    if [ -z "$B" ] || [ "$B" = "d41d8cd98f00b204e9800998ecf8427e" ]; then
        echo "  ? $TEP — không lấy được bản công khai, bỏ qua"
        continue
    fi
    if [ "$A" = "$B" ]; then
        echo "  ✓ $TEP khớp"
    else
        echo "  ✗ $TEP LỆCH — gốc $A, công khai $B" >&2
        LECH=1
    fi
done

if [ "$LECH" -ne 0 ]; then
    cat >&2 <<'HD'

  ══════════════════════════════════════════════════════════════════
  BẢN CÔNG KHAI KHÁC BẢN VỪA DEPLOY — cán bộ sẽ KHÔNG thấy bản mới.

  Gần như chắc chắn là CDN còn giữ bản cũ ở biên. Cách xử lý:
    1. Xoá cache CDN cho /sw.js (Cloudflare: Caching → Purge, nhập URL đầy đủ)
    2. Thêm luật ở CDN: URI Path = /sw.js → Bypass cache, để không tái diễn

  `sw.js` KHÔNG được cache ở bất kỳ tầng nào: trình duyệt dò bản mới bằng
  chính tệp ấy. Giữ nó lại là ghim mọi người vào bản cũ, và hỏng im lặng —
  app cũ vẫn chạy trơn tru vì tệp cũ còn nguyên trên máy chủ.
  ══════════════════════════════════════════════════════════════════
HD
    exit 1
fi

echo "  Bản công khai khớp bản vừa deploy."
