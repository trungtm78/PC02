#!/usr/bin/env bash
# Health check cho PC02 backend
# Returns 0 nếu /api/v1/health trả 200 trong vòng 10s, ngược lại 1
# Usage: bash /home/pc02/bin/health-check.sh

set -euo pipefail

URL="${HEALTH_URL:-http://localhost:3000/api/v1/health}"
MAX_ATTEMPTS=5
SLEEP_BETWEEN=2

for i in $(seq 1 "$MAX_ATTEMPTS"); do
    if RESP=$(curl -sf -m 5 "$URL" 2>/dev/null); then
        echo "Health OK on attempt $i: $RESP"
        exit 0
    fi
    echo "Attempt $i/$MAX_ATTEMPTS: not ready, sleeping ${SLEEP_BETWEEN}s..."
    sleep "$SLEEP_BETWEEN"
done

echo "Health check FAILED after $MAX_ATTEMPTS attempts ($URL)"
exit 1
