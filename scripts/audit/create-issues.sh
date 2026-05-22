#!/usr/bin/env bash
# scripts/audit/create-issues.sh
# Bulk-create GitHub issues from findings.json
# Usage: bash scripts/audit/create-issues.sh [--dry-run]
#
# Requirements: gh CLI authenticated, jq installed
# Labels: 'audit-2026-05' + P0/P1/P2/P3
set -euo pipefail

FINDINGS="${1:-scripts/audit/findings.json}"
DRY_RUN="${DRY_RUN:-0}"
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: gh CLI required. Install from https://cli.github.com/" >&2
  exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "ERROR: jq required. Install from https://stedolan.github.io/jq/" >&2
  exit 1
fi
if [ ! -f "$FINDINGS" ]; then
  echo "ERROR: findings file not found: $FINDINGS" >&2
  exit 1
fi

# Ensure labels exist (idempotent)
ensure_label() {
  local name="$1" color="$2" desc="$3"
  gh label create "$name" --color "$color" --description "$desc" 2>/dev/null || true
}
ensure_label "audit-2026-05" "5319e7" "PC02 Tier-1 Ship-Block Audit 2026-05-22"
ensure_label "P0" "b60205" "Blocker — ship-block"
ensure_label "P1" "d93f0b" "Critical — ship-block or sprint-1"
ensure_label "P2" "fbca04" "Important — Tier-2 post-launch"
ensure_label "P3" "0e8a16" "Polish — backlog"
ensure_label "ship-block" "b60205" "Must fix before launch"

count=0
jq -c '.findings[]' "$FINDINGS" | while read -r f; do
  id=$(echo "$f" | jq -r '.id')
  severity=$(echo "$f" | jq -r '.severity')
  title=$(echo "$f" | jq -r '.title')
  ship_block=$(echo "$f" | jq -r '.ship_block')
  domain=$(echo "$f" | jq -r '.domain')
  affected=$(echo "$f" | jq -r '.affected[] | "- `" + . + "`"' | tr '\n' '\v' | sed 's/\v/\\n/g')
  evidence=$(echo "$f" | jq -r '.evidence')
  impact=$(echo "$f" | jq -r '.impact')
  recommended=$(echo "$f" | jq -r '.recommended_action')
  effort=$(echo "$f" | jq -r '.effort')
  phase=$(echo "$f" | jq -r '.phase')
  exploit=$(echo "$f" | jq -r '.exploit_steps // empty')
  verify=$(echo "$f" | jq -r '.fix_verification // empty')

  full_title="[$id] $title"

  body="## Severity: $severity ($([ "$ship_block" = "true" ] && echo "SHIP-BLOCK" || echo "post-launch"))

**Domain:** $domain
**Effort:** $effort
**Phase:** $phase

## Affected files
$(echo -e "$affected")

## Evidence
$evidence

## Impact
$impact

$([ -n "$exploit" ] && echo "## Exploit steps
$exploit
")

## Recommended action
$recommended

$([ -n "$verify" ] && echo "## Fix verification
$verify
")

---
*Generated from [findings.json](../scripts/audit/findings.json) — Tier-1 Audit 2026-05-22*"

  labels="audit-2026-05,$severity"
  [ "$ship_block" = "true" ] && labels="$labels,ship-block"

  if [ "$DRY_RUN" = "1" ]; then
    echo "=== [$id] would create issue ==="
    echo "Title: $full_title"
    echo "Labels: $labels"
    echo "Body length: ${#body} chars"
    echo ""
  else
    echo "Creating issue: $full_title"
    gh issue create --title "$full_title" --body "$body" --label "$labels" || {
      echo "FAILED: $id" >&2
      continue
    }
  fi
  count=$((count + 1))
done

echo ""
if [ "$DRY_RUN" = "1" ]; then
  echo "Dry-run complete. $count issues would be created."
else
  echo "Done. $count issues created with label 'audit-2026-05'."
  echo "View: gh issue list --label audit-2026-05"
fi
