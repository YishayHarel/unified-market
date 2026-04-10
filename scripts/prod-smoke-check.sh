#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 3 ]]; then
  echo "Usage: $0 <SUPABASE_URL> <SUPABASE_ANON_KEY> <SYMBOL>"
  echo "Example: $0 https://xxx.supabase.co eyJhbGciOi... AAPL"
  exit 1
fi

SUPABASE_URL="$1"
SUPABASE_ANON_KEY="$2"
SYMBOL="$3"

post_fn() {
  local fn="$1"
  local body="$2"
  curl -sS -X POST \
    "${SUPABASE_URL}/functions/v1/${fn}" \
    -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d "${body}"
}

echo "== get-stock-prices =="
post_fn "get-stock-prices" "{\"symbols\":[\"${SYMBOL}\"]}" | python3 -m json.tool | sed -n '1,40p'
echo

echo "== get-stock-candles =="
post_fn "get-stock-candles" "{\"symbol\":\"${SYMBOL}\",\"period\":\"1M\"}" | python3 -m json.tool | sed -n '1,40p'
echo

echo "== get-treasury-vix batch =="
post_fn "get-treasury-vix" '{"type":"batch"}' | python3 -m json.tool | sed -n '1,80p'
echo

echo "Smoke check complete."
