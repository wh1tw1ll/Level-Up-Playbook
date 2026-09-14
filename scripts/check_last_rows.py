#!/usr/bin/env python3
"""Check last rows in Smartsheet Sheet 03."""
import requests, json

with open(r'C:\Users\HermesAdmin\.hermes\.smartsheet_token') as f:
    TOKEN = f.read().strip()

HEADERS = {'Authorization': 'Bearer ' + TOKEN}

r = requests.get('https://api.smartsheet.com/2.0/sheets/4456864287772548', headers=HEADERS)
sheet = r.json()
rows = sheet.get('rows', [])

print('Total rows:', len(rows))
print()

# Check last 10 rows in detail
for row in rows[-10:]:
    rid = row.get('id')
    cells = row.get('cells', [])
    vals = {c.get('columnId'): {'v': c.get('value'), 'd': c.get('displayValue')} for c in cells}
    print('Row {}: {}'.format(rid, json.dumps(vals)[:300]))