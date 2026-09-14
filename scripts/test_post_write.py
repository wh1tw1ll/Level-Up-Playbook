#!/usr/bin/env python3
"""Test: POST to add row, then verify by GET."""
import requests, json, time

def read_token():
    path = r'C:\Users\HermesAdmin\.hermes\.smartsheet_token'
    with open(path) as f:
        return f.read().strip()

TOKEN=read...ET_ID = '4456864287772548'
HEADERS = {'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json'}

# First clean up empty rows
r = requests.get('https://api.smartsheet.com/2.0/sheets/' + SHEET_ID, headers=HEADERS)
sheet = r.json()
empty_rows = []
for row in sheet.get('rows', []):
    cells = row.get('cells', [])
    has_val = any(c.get('value') for c in cells)
    if not has_val:
        empty_rows.append(str(row['id']))

if empty_rows:
    print('Cleaning {} empty rows...'.format(len(empty_rows)))
    r_del = requests.delete(
        'https://api.smartsheet.com/2.0/sheets/' + SHEET_ID + '/rows?ids=' + ','.join(empty_rows),
        headers=HEADERS
    )
    print('Delete response:', r_del.json().get('message', ''))

# Now POST a row with ACTUAL values
print('\nPosting new row...')
payload = {
    'rows': [{
        'cells': [
            {'columnId': 6748787438817156, 'value': 'A-099'},
            {'columnId': 4496987625131908, 'value': 'POST TEST - delete me'},
            {'columnId': 9000587252502404, 'value': 'Test'},
            {'columnId': 6582137294724, 'value': '2026-06-26'},
            {'columnId': 4510181764665220, 'value': 'High'},
            {'columnId': 2258381950979972, 'value': 'Active'},
        ],
        'toBottom': True
    }]
}

r2 = requests.post(
    'https://api.smartsheet.com/2.0/sheets/' + SHEET_ID + '/rows',
    headers=HEADERS,
    json=payload
)
print('POST status:', r2.status_code)
result = r2.json()
new_id = result['result']['id']
print('New row ID:', new_id)

# Wait and fetch the specific row
time.sleep(2)
print('\nFetching new row by ID...')
r3 = requests.get(
    'https://api.smartsheet.com/2.0/sheets/' + SHEET_ID + '?rows=' + str(new_id),
    headers=HEADERS
)
sheet3 = r3.json()
for row in sheet3.get('rows', []):
    if row['id'] == new_id:
        print('Row found!')
        for c in row.get('cells', []):
            cid = c.get('columnId')
            val = c.get('displayValue') or c.get('value') or '(empty)'
            # Map column ID to name
            for col in sheet3.get('columns', []):
                if col['id'] == cid:
                    print('  {} = {}'.format(col['title'], val))
                    break
        break
else:
    print('Row not found in response')
    print(json.dumps(sheet3, indent=2)[:500])