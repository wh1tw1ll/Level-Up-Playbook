#!/usr/bin/env python3
"""Verify after write by fetching the sheet."""
import requests, json

token_path = r'C:\Users\HermesAdmin\.hermes\.smartsheet_token'
SHEET_ID = '4456864287772548'

with open(token_path) as f:
    raw = f.read()
t = ''.join(c for c in raw if c.isprintable()).strip()

headers = {'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json'}

# Fetch the sheet and look at last 5 rows
r = requests.get('https://api.smartsheet.com/2.0/sheets/' + SHEET_ID, headers=headers)
sheet = r.json()

# Get column indices
col_idx = {}
for c in sheet.get('columns', []):
    col_idx[c['title']] = c['index']

rows = sheet.get('rows', [])
print('Total rows:', len(rows))
print('Last 5 rows:')
for row in rows[-5:]:
    cells = row.get('cells', [])
    vals = {}
    for title, idx in col_idx.items():
        if idx < len(cells):
            v = cells[idx].get('displayValue') or cells[idx].get('value') or ''
            if v:
                vals[title] = str(v)[:40]
    print('  Row {}: {}'.format(row['id'], json.dumps(vals)))