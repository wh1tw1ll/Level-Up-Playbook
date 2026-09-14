#!/usr/bin/env python3
import requests, json, os

SHEET_ID = '4456864287772548'
token_path = r'C:\Users\HermesAdmin\.hermes\.smartsheet_token'
with open(token_path) as fh:
    raw = fh.read()
t = ''.join(c for c in raw if c.isprintable()).strip()

headers = {'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json'}

r = requests.get('https://api.smartsheet.com/2.0/sheets/' + SHEET_ID, headers=headers)
sheet = r.json()

col_map = {}
for c in sheet['columns']:
    col_map[c['title']] = c['id']

# Clean stale test rows
for row in sheet.get('rows', []):
    cells = row.get('cells', [])
    if cells:
        first = str(cells[0].get('displayValue') or cells[0].get('value') or '')
        desc = str(cells[1].get('displayValue') or cells[1].get('value') or '') if len(cells) > 1 else ''
        if first in ('A-099',) or 'TEST' in desc:
            rid = row['id']
            print('Deleting test row', rid)
            requests.delete('https://api.smartsheet.com/2.0/sheets/' + SHEET_ID + '/rows?ids=' + str(rid), headers=headers)

# Clean stale A-039 empty rows too
for row in sheet.get('rows', []):
    cells = row.get('cells', [])
    if cells:
        first = str(cells[0].get('displayValue') or cells[0].get('value') or '')
        desc = str(cells[1].get('displayValue') or cells[1].get('value') or '') if len(cells) > 1 else ''
        if first in ('A-039', 'A-040', 'A-041', 'A-042', 'A-043', 'A-044', 'A-045', 'A-046', 'A-047'):
            if not desc or 'null' in desc.lower():
                rid = row['id']
                print('Deleting empty row', rid, first)
                requests.delete('https://api.smartsheet.com/2.0/sheets/' + SHEET_ID + '/rows?ids=' + str(rid), headers=headers)

# Now try adding one row properly
cells = [
    {'columnId': col_map['Action ID'], 'value': 'A-039'},
    {'columnId': col_map['Action Description'], 'value': 'TEST 2 - verify write works'},
    {'columnId': col_map['Owner'], 'value': 'P&W'},
    {'columnId': col_map['Due Date'], 'value': '2026-06-26'},
    {'columnId': col_map['Priority'], 'value': 'Critical'},
    {'columnId': col_map['Status'], 'value': 'Pending'},
    {'columnId': col_map['Depends On'], 'value': 'A-022'},
]

payload = {'rows': [{'cells': cells, 'toBottom': True}]}

print('POST payload:')
print(json.dumps(payload, indent=2)[:1000])
print()

r2 = requests.post(
    'https://api.smartsheet.com/2.0/sheets/' + SHEET_ID + '/rows',
    headers=headers,
    json=payload
)

print('Status:', r2.status_code)
result = r2.json()
if 'result' in result:
    row_result = result['result']
    cells_ret = row_result.get('cells', [])
    print('Returned cells:')
    for c in cells_ret:
        print('  colId={}, value={}, display={}'.format(c.get('columnId'), repr(c.get('value')), repr(c.get('displayValue'))))
else:
    print('Full response:', json.dumps(result, indent=2)[:2000])