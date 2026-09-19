#!/bin/bash
TOKEN=*** /c/Users/HermesAdmin/vercel_token.txt)
cd /c/Users/HermesAdmin/Level-Up-Playbook

# Smartsheet Grep Gate: reject deploys with direct Smartsheet API calls
echo "=== Running Smartsheet Grep Gate ==="
node scripts/smartsheet-grep-gate.js
GATE_EXIT=$?
if [ $GATE_EXIT -ne 0 ]; then
  echo "=== DEPLOY REJECTED: Smartsheet Grep Gate failed ==="
  exit 1
fi
echo "=== Gate passed, deploying ==="

/c/Windows/system32/config/systemprofile/AppData/Roaming/npm/vercel deploy --prod --token="$TOKEN" 2>&1