#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   WRITE_API_TOKEN="your-token" bash scripts/test-publish-houn.sh
# or:
#   export WRITE_API_TOKEN="your-token"
#   bash scripts/test-publish-houn.sh

TOKEN="${WRITE_API_TOKEN:-}"
if [[ -z "$TOKEN" ]]; then
  echo "ERROR: WRITE_API_TOKEN is empty"
  echo 'Example: WRITE_API_TOKEN="your-token" bash scripts/test-publish-houn.sh'
  exit 1
fi

curl -i -X POST "http://127.0.0.1:3210/api/publish-wordpress" \
  -H "Content-Type: application/json" \
  -H "X-Write-Token: ${TOKEN}" \
  --data-raw '{
    "date":"21/05/2026",
    "time":"11:59",
    "barSellOneBaht":"55,200,000",
    "barBuyOneBaht":"54,670,000",
    "printSellOneBaht":"55,300,000",
    "printBuyOneBaht":"53,890,000",
    "printSellOneSalueng":"13,825,000",
    "printBuyOneSalueng":"13,473,000",
    "printSellFiveHoun":"6,912,000",
    "printBuyFiveHoun":"6,737,000"
  }'
