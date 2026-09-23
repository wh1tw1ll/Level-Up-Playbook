#!/bin/bash
cd "$(dirname "$0")"
TOK=$(grep SMARTSHEET_TOKEN .env.local | head -1 | sed 's/SMARTSHEET_TOKEN=*** | tr -d '"'"'")
echo "Using token: len=${#TOK}"
curl -s -H "Authorization: Bearer $TOK" "https://api.smartsheet.com/2.0/sheets/4975609129160580" -o /tmp/smartsheet_actions.json
echo "Saved. Size: $(wc -c < /tmp/smartsheet_actions.json)"