#!/usr/bin/env python3
"""Check exact cell format for Owner column."""
import requests, json

token_path = r'C:\Users\HermesAdmin\.hermes\.smartsheet_token'
SHEET_ID = '4456864287772548'
with open(token_path) as f:
    raw = f.read()
t = ''.join(c for c in raw if c.isprintable()).strip()
headers = {'Authorization': 'Bearer ' + t}

r = requests.get('https://api.smartsheet.com/2.0/sheets/' + SHEET_ID, headers=headers)
sheet = r.json()

col_idx = {}
for c in sheet['columns']:
    col_idx[c['title']] = c['index']

# Look at first few rows' exact cell structure
for row in sheet.get('rows', [])[:3]:
    print('Row', row['id'])
    for c in row.get('cells', []):
        print('  colId={}, value={!r}, display={!r}, objectValue={}'.format(
            c.get('columnId'),
            c.get('value'),
            c.get('displayValue'),
            c.get('objectValue', 'N/A')
        ))