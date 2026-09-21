#!/bin/bash
# run_prep_map_populate.sh — daily cron to populate Prep Map
# Sets SMARTSHEET_TOKEN from local token file for lib/smartsheet.js

cd /c/Users/HermesAdmin/Level-Up-Playbook || exit 1
TOKEN_FILE="C:/Users/HermesAdmin/.hermes/.smartsheet_token"
if [ -f "$TOKEN_FILE" ]; then
  export SMARTSHEET_TOKEN=$(cat "$TOKEN_FILE")
fi
node scripts/populate_prep_map.mjs 2>&1