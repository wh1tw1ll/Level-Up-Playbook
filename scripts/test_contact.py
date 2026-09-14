#!/usr/bin/env python3
"""Try different approaches for CONTACT_LIST column."""
import requests, json, time

TOKEN=open(r...en', encoding='utf-8').read().strip()
SHEET_ID = '4456864287772548'
HDR = {'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json'}

# Clean empty rows first
r = requests.get('https://api.smartsheet.com/2.0/sheets/' + SHEET_ID, headers=HDR)
sheet = r.json()
empty = [str(row['id']) for row in sheet['rows'] if not any(c.get('value') for c in row.get('cells',[]))]
if empty:
    requests.delete('https://api.smartsheet.com/2.0/sheets/' + SHEET_ID + '/rows?ids=' + ','.join(empty), headers=HDR)

COLS = {'Action ID': 6748787438817156, 'Action Description': 4496987625131908, 'Owner': 9000587252502404,
        'Due Date': 6582137294724, 'Priority': 4510181764665220, 'Status': 2258381950979972, 'Depends On': 6761981578350468}

# Try 1: Use value with strict=false
print('Try 1: Owner as plain string with all columns...')
cells = [
    {'columnId': 6748787438817156, 'value': 'A-099'},
    {'columnId': 4496987625131908, 'value': 'CONTACT TEST 1'},
    {'columnId': 9000587252502404, 'value': 'Test'},
    {'columnId': 6582137294724, 'value': '2026-06-26'},
    {'columnId': 4510181764665220, 'value': 'High'},
    {'columnId': 2258381950979972, 'value': 'Active'},
]
payload = {'rows': [{'cells': cells, 'toBottom': True}]}
r1 = requests.post('https://api.smartsheet.com/2.0/sheets/' + SHEET_ID + '/rows', headers=HDR, json=payload)
print('POST status:', r1.status_code)
res = r1.json()
if r1.status_code == 200:
    new_id = res['result']['id']
    print('Row created:', new_id)
    time.sleep(1)
    r2 = requests.get('https://api.smartsheet.com/2.0/sheets/' + SHEET_ID, headers=HDR)
    for row in r2.json()['rows']:
        if row['id'] == new_id:
            for c in row.get('cells', []):
                if c.get('columnId') == 9000587252502404:
                    print('  Owner cell: value={}, display={}'.format(c.get('value'), c.get('displayValue')))
            break
else:
    print('POST error:', json.dumps(res, indent=2)[:500])
    # Try 2: Create empty first then PUT
    print('\nTry 2: Create empty, then PUT with all non-Owner, then PUT just Owner...')
    r1b = requests.post('https://api.smartsheet.com/2.0/sheets/' + SHEET_ID + '/rows',
                       headers=HDR, json={'rows': [{'cells': [], 'toBottom': True}]})
    new_id2 = r1b.json()['result']['id']
    print('Empty row:', new_id2)
    
    # PUT all cells except Owner
    cells2 = [{'columnId': COLS[t], 'value': v} for t, v in [
        ('Action ID', 'A-088'),
        ('Action Description', 'CONTACT TEST 2'),
        ('Due Date', '2026-06-26'),
        ('Priority', 'Low'),
        ('Status', 'Active'),
    ]]
    r2a = requests.put('https://api.smartsheet.com/2.0/sheets/' + SHEET_ID + '/rows/' + str(new_id2),
                       headers=HDR, json={'cells': cells2})
    print('PUT without Owner:', r2a.status_code, r2a.json().get('message',''))
    
    # PUT just Owner
    r2b = requests.put('https://api.smartsheet.com/2.0/sheets/' + SHEET_ID + '/rows/' + str(new_id2),
                       headers=HDR, json={'cells': [{'columnId': 9000587252502404, 'value': 'Test'}]})
    print('PUT just Owner:', r2b.status_code, r2b.json().get('message',''))
    if r2b.status_code != 200:
        print('Error detail:', json.dumps(r2b.json(), indent=2)[:500])