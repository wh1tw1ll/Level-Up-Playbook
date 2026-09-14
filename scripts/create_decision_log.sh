#!/bin/bash
# Read token from file
TOKEN=$(cat "/c/Users/HermesAdmin/.hermes/.smartsheet_token" | tr -d '\n\r')

# Create sheet
RESULT=$(curl -s -X POST "https://api.smartsheet.com/2.0/sheets" \
  -H "Authorization: Bearer *** \
  -H "Content-Type: application/json" \
  -d '{
    "name": "06 - Owner Decision Log",
    "columns": [
      {"title": "ID", "type": "TEXT_NUMBER", "primary": true},
      {"title": "Decision Required", "type": "TEXT_NUMBER"},
      {"title": "Stakeholders", "type": "TEXT_NUMBER"},
      {"title": "Status", "type": "DROPDOWN", "options": ["Open", "Pending", "In Review", "Decided", "Closed"]},
      {"title": "Due Date", "type": "DATE"},
      {"title": "Decision Made", "type": "TEXT_NUMBER"},
      {"title": "Completed Date", "type": "DATE"}
    ]
  }')

echo "$RESULT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
ec = d.get('errorCode')
if ec:
    print(f'ERROR {ec}: {d.get(\"message\")}')
    exit(1)
r = d.get('result', {})
print(f'OK Sheet created: ID={r.get(\"id\")}')
for c in r.get('columns', []):
    print(f'  Col: {c[\"id\"]} = {c[\"title\"]} ({c[\"type\"]})')
with open('/c/Users/HermesAdmin/.hermes/.dova_decision_log_id', 'w') as f:
    f.write(str(r['id']))
print('Saved sheet ID')
"

ID=$(cat /c/Users/HermesAdmin/.hermes/.dova_decision_log_id 2>/dev/null)
if [ -n "$ID" ]; then
  echo "Moving $ID to DOVA workspace..."
  curl -s -X PUT "https://api.smartsheet.com/2.0/sheets/$ID/move" \
    -H "Authorization: Bearer *** \
    -H "Content-Type: application/json" \
    -d '{"destinationId": 4322039046662020, "destinationType": "workspace"}' | python3 -c "
import sys, json
d = json.load(sys.stdin)
print(f'MOVE: {d.get(\"message\", \"OK\")}')
"
fi