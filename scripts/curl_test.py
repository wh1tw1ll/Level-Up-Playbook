#!/usr/bin/env python3
"""Use curl to add row - bypass any requests library issues."""
import subprocess, json

SHEET_ID = '4456864287772548'
token_path = r'C:\Users\HermesAdmin\.hermes\.smartsheet_token'
with open(token_path) as f:
    raw = f.read()
t = ''.join(c for c in raw if c.isprintable()).strip()

# Build the payload manually as a JSON string
payload = r'{"rows":[{"cells":[{"columnId":6748787438817156,"value":"A-039"},{"columnId":4496987625131908,"value":"CURL TEST - Expedite P&W AIA contract"},{"columnId":9000587252502404,"value":"P&W"},{"columnId":6582137294724,"value":"2026-06-26"},{"columnId":4510181764665220,"value":"Critical"},{"columnId":2258381950979972,"value":"Pending"},{"columnId":6761981578350468,"value":"A-022"}],"toBottom":true}]}'

# Use curl via subprocess
cmd = [
    'curl', '-s', '-X', 'POST',
    'https://api.smartsheet.com/2.0/sheets/' + SHEET_ID + '/rows',
    '-H', 'Authorization: Bearer ' + t,
    '-H', 'Content-Type: application/json',
    '-d', payload
]

result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
print('curl stdout:', result.stdout[:500])
print('curl stderr:', result.stderr[:200] if result.stderr else '(none)')
print('Return code:', result.returncode)

if result.stdout:
    data = json.loads(result.stdout)
    if 'result' in data:
        cells = data['result'].get('cells', [])
        print('Response cells:')
        for c in cells:
            print('  colId={}, value={}'.format(c.get('columnId'), c.get('value', 'MISSING')))