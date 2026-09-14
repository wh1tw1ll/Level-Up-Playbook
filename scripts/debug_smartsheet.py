#!/usr/bin/env python3
"""Debug: print actual payload and send one row."""
import requests, json

token_path = r'C:\Users\HermesAdmin\.hermes\.smartsheet_token'
SHEET_ID = '4456864287772548'

with open(token_path) as f:
    TOKEN = f.read().strip()

HEADERS = {'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json'}

# Get columns
r = requests.get('https://api.smartsheet.com/2.0/sheets/' + SHEET_ID, headers=HEADERS)
sheet = r.json()

col_map = {}
for c in sheet['columns']:
    col_map[c['title']] = c['id']

# Delete any A-039 empty rows first
for row in sheet.get('rows', []):
    cells = row.get('cells', [])
    if cells:
        first = str(cells[0].get('displayValue', cells[0].get('value', '')))
        if first in ['A-039', 'A-040']:
            desc = str(cells[1].get('displayValue', cells[1].get('value', ''))) if len(cells) > 1 else ''
            if not desc:
                rid = row['id']
                print('Deleting empty row {} ({})'.format(rid, first))
                requests.delete(
                    'https://api.smartsheet.com/2.0/sheets/' + SHEET_ID + '/rows?ids=' + str(rid),
                    headers=HEADERS
                )

# Test with single row
cells = [
    {'columnId': col_map['Action ID'], 'value': 'A-039'},
    {'columnId': col_map['Action Description'], 'value': 'TEST - Expedite P&W AIA contract'},
    {'columnId': col_map['Owner'], 'value': 'P&W'},
    {'columnId': col_map['Due Date'], 'value': '2026-06-26'},
    {'columnId': col_map['Priority'], 'value': 'Critical'},
    {'columnId': col_map['Status'], 'value': 'Pending'},
    {'columnId': col_map['Depends On'], 'value': 'A-022'},
]

payload = {'rows': [{'cells': cells, 'toBottom': True}]}

print('Sending one test row...')
r2 = requests.post(
    'https://api.smartsheet.com/2.0/sheets/' + SHEET_ID + '/rows',
    headers=HEADERS,
    json=payload
)

print('Status:', r2.status_code)
result = r2.json()
print(json.dumps(result, indent=2)[:2000])