#!/usr/bin/env python3
"""Try different value formats for Smartsheet API."""
import requests, json

token_path = r'C:\Users\HermesAdmin\.hermes\.smartsheet_token'
SHEET_ID = '4456864287772548'
with open(token_path) as f:
    raw = f.read()
t = ''.join(c for c in raw if c.isprintable()).strip()
headers = {'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json'}

# Get sheet info including column types
r = requests.get('https://api.smartsheet.com/2.0/sheets/' + SHEET_ID, headers=headers)
sheet = r.json()

# Print column details
for c in sheet['columns']:
    print('Col: {} | id={} | type={} | options={}'.format(
        c['title'], c['id'], c.get('type'), c.get('options', '')))

# The issue might be with the cell format. Let me try adding 'strict': False or using displayValue
# Also try passing as a list of rows (array) not a single object

# Try using 'rows' as array directly
payload = {
    "rows": [
        {
            "cells": [
                {"columnId": 6748787438817156, "value": "A-088"},
                {"columnId": 4496987625131908, "value": "VALUE FORMAT TEST"},
                {"columnId": 9000587252502404, "value": "Test"},
                {"columnId": 6582137294724, "value": "2026-06-26"},
                {"columnId": 4510181764665220, "value": "High"},
                {"columnId": 2258381950979972, "value": "Active"},
            ],
            "toBottom": True
        }
    ]
}

print('\nSending with rows array...')
r2 = requests.post(
    'https://api.smartsheet.com/2.0/sheets/' + SHEET_ID + '/rows',
    headers=headers,
    json=payload
)
print('Status:', r2.status_code)

# Now fetch and check
r3 = requests.get('https://api.smartsheet.com/2.0/sheets/' + SHEET_ID, headers=headers)
sheet2 = r3.json()

col_idx = {}
for c in sheet2['columns']:
    col_idx[c['title']] = c['index']

rows = sheet2.get('rows', [])
print('Total rows:', len(rows))
for row in rows[-3:]:
    cells = row.get('cells', [])
    vals = {}
    for title, idx in col_idx.items():
        if idx < len(cells):
            v = cells[idx].get('displayValue', cells[idx].get('value', ''))
            if v:
                vals[title] = str(v)
    print('  Row {}: {}'.format(row['id'], vals))