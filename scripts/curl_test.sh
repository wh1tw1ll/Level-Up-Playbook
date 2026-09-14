#!/bin/bash
TOKEN=$(cat "/c/Users/HermesAdmin/.hermes/.smartsheet_token" | tr -d '\n\r')
echo "Token length: ${#TOKEN}"

# Try the absolute simplest write
echo ""
echo "Adding single cell..."
RESULT=$(curl -s -X POST "https://api.smartsheet.com/2.0/sheets/4456864287772548/rows" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"rows":[{"cells":[{"columnId":6748787438817156,"value":"A-099"}],"toBottom":true}]}')
echo "$RESULT" | /c/Users/HermesAdmin/Level-Up-Playbook/.venv/Scripts/python.exe -c "import sys,json; d=json.load(sys.stdin); print('Message:', d.get('message')); r=d.get('result',{}); print('Cells:', r.get('cells',[]))"

echo ""
echo "---VERIFY---"
sleep 2
curl -s "https://api.smartsheet.com/2.0/sheets/4456864287772548" \
  -H "Authorization: Bearer ${TOKEN}" \
  | /c/Users/HermesAdmin/Level-Up-Playbook/.venv/Scripts/python.exe -c "
import sys, json
d=json.load(sys.stdin)
for row in d['rows'][-5:]:
    cells=row.get('cells',[])
    first=str(cells[0].get('displayValue') or cells[0].get('value','')) if cells else 'nocells'
    print(f'Row {row[\"id\"]}: first={first}')
"