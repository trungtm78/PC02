#!/usr/bin/env bash
# run-uat-api.sh — Chạy UAT API smoke SẠCH (giải quyết test-isolation).
#
# Root cause đã chẩn đoán (2026-06-27):
#  - Specs dùng getToken() = process.env.UAT_TOKEN || test-results/.auth-token.txt → thiếu token = 401 cascade.
#  - Throttle: login @Throttle 15/min + global 200/60s → chạy bộ bị 429. Cần THROTTLE_DISABLE=true ở BE.
#  - Cross-spec token poisoning ở workers cao (1 spec bump tokenVersion → token share invalid). Chạy workers=1.
#  - test-results/ bị Playwright xoá mỗi run → KHÔNG cache token file được; mỗi module login FRESH (tránh hết hạn 15').
#
# YÊU CẦU: BE chạy với THROTTLE_DISABLE=true (THROTTLE_DISABLE=true npm run start:dev trong backend).
# DÙNG: bash scripts/run-uat-api.sh
set -u
BASE="${BASE_URL:-http://localhost:3000}"
ADMIN_USER="${ADMIN_USERNAME:-admin@pc02.local}"
ADMIN_PASS="${ADMIN_PASSWORD:-68@Love2love68}"
OUT="test-results/uat-api"; mkdir -p "$OUT"

gettok() {
  curl -s -m8 -X POST "$BASE/api/v1/auth/login" -H "Content-Type: application/json" \
    -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}" \
    | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log((JSON.parse(s).data??JSON.parse(s)).accessToken||'')}catch{console.log('')}})"
}

# Verify throttle off (10 login liên tục, không được có 429)
c429=0; for n in $(seq 1 10); do hc=$(curl -s -m4 -o /dev/null -w "%{http_code}" -X POST "$BASE/api/v1/auth/login" -H "Content-Type: application/json" -d "{\"username\":\"$ADMIN_USER\",\"password\":\"$ADMIN_PASS\"}"); [ "$hc" = "429" ] && c429=$((c429+1)); done
if [ "$c429" -gt 0 ]; then echo "⚠️  Throttle ĐANG BẬT ($c429/10 × 429). Restart BE với: THROTTLE_DISABLE=true npm run start:dev"; exit 1; fi
echo "✅ Throttle off — bắt đầu UAT API (mỗi module token fresh, workers=1)"

TOTAL_P=0; TOTAL_F=0
for spec in tests/api/*-uat.api.spec.ts; do
  [ -f "$spec" ] || continue
  name=$(basename "$spec" .api.spec.ts)
  json="$OUT/$name.json"
  UAT_TOKEN="$(gettok)" PLAYWRIGHT_JSON_OUTPUT_NAME="$json" \
    npx playwright test "$spec" --project=api --reporter=json --workers=1 >/dev/null 2>&1
  read -r P F < <(node -e "try{const r=require('./$json');let p=0,f=0;function w(su){for(const sp of(su.specs||[]))for(const t of(sp.tests||[])){if(t.status==='expected'||t.status==='flaky')p++;else if(t.status!=='skipped')f++;}for(const c of(su.suites||[]))w(c)}for(const su of(r.suites||[]))w(su);console.log(p,f)}catch(e){console.log(0,0)}")
  printf "  %-32s PASS %-4s FAIL %s\n" "$name" "$P" "$F"
  TOTAL_P=$((TOTAL_P+P)); TOTAL_F=$((TOTAL_F+F))
done
echo "════════ TỔNG API: PASS $TOTAL_P | FAIL $TOTAL_F ════════"
echo "JSON từng module: $OUT/*.json"
