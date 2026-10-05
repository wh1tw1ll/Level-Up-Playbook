#!/bin/bash
# deploy-gate.sh — Pre-deploy gate: rejects direct Smartsheet API calls outside guarded-write.js
# Run before every deploy. Exits 0 (clean) or 1 (gate triggered).

cd "$(dirname "$0")/.."

echo "=== DEPLOY GATE: Checking for direct Smartsheet API calls ==="

# Allowlist files that have legacy direct API calls (known, grandfathered)
ALLOWED="lib/guarded-write.js|lib/smartsheet.js"
ALLOWLIST="lib/handlers/dova-seed.js|lib/handlers/dova-setup.js|lib/handlers/dova-update-schedule.js|lib/handlers/dova-workspace.js|lib/handlers/dova.js"

VIOLATIONS=$(grep -rn 'https://api\.smartsheet\.com/2\.0/' lib/ api/ --include='*.js' | grep -vE "$ALLOWED" | grep -vE "$ALLOWLIST" | grep -v '.bak' || true)

if [ -n "$VIOLATIONS" ]; then
  echo "GATE BLOCKED - Direct Smartsheet API calls found outside allowed files:"
  echo "$VIOLATIONS"
  echo ""
  echo "Allowed files: $ALLOWED"
  echo "Fix: route through guarded-write.js instead."
  exit 1
fi

echo "Gate passed - no unauthorized Smartsheet API calls."
exit 0