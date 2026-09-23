#!/bin/bash
cd "$(dirname "$0")"
# Source env to get token
source <(grep SMARTSHEET_TOKEN .env.local)
# Write a dummy file first to verify the token works
echo "TOKEN_LEN=${#SMARTSH...}" > /tmp/debug_token.txt
# Fetch the action tracker sheet
curl -s -H "Authorization: Bearer *** "https://api.smartsheet.com/2.0/sheets/4456864287772548" -o /tmp/action_tracker.json
echo "FETCHED: $(wc -c < /tmp/action_tracker.json) bytes"
head -c 200 /tmp/action_tracker.json