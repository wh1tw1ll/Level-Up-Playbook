#!/usr/bin/env python3
import requests, json, time

SHEET_ID = '4456864287772548'
TOKEN = open(r'C:\Users\HermesAdmin\.hermes\.smartsheet_token', encoding='utf-8').read().strip()
HEADERS = {'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json'}

# Clean empty rows
r = requests.get('https://api.smartsheet.com/2.0/sheets/' + SHEET_ID, headers=HEADERS)
sheet = r.json()
empty = [str(row['id']) for row in sheet['rows'] if not any(c.get('value') for c in row.get('cells',[]))]
if empty:
    dl = requests.delete('https://api.smartsheet.com/2.0/sheets/' + SHEET_ID + '/rows?ids=' + ','.join(empty), headers=HEADERS)
    print('Cleaned', len(empty), 'rows:', dl.json().get('message'))

# NEW ACTIONS
ACTIONS = [
    ['A-039', 'Expedite P&W AIA contract - provide draft for review; Level Up review business terms; KozPure legal review concurrently', 'P&W', '2026-06-26', 'Critical', 'Pending', 'A-022'],
    ['A-040', 'Resolve P&W fee/budget basis open question - agree which budget number the 6.5% fee is based on', 'KozPure', '2026-07-06', 'Critical', 'Pending', 'A-022'],
    ['A-041', 'Award CM preconstruction services by Jul 13 to support Sep groundbreaking - critical path deadline', 'KozPure', '2026-07-13', 'Critical', 'Pending', 'A-035'],
    ['A-042', 'Decide CM path forward after McCarthy feedback - proceed, pivot to Turner/Level 10/Swinerton, or other', 'Level Up', '2026-07-07', 'High', 'Pending', 'A-035'],
    ['A-043', 'Schedule Turner Construction follow-up - Clint Williams + Drake Costa + John Gromos', 'Greg', '2026-07-03', 'High', 'Pending', ''],
    ['A-044', 'Follow up with Swinerton (Jeff) and SB James (Heman) for CM outreach', 'Greg', '2026-07-03', 'Medium', 'Pending', ''],
    ['A-045', 'Obtain executed P&W contract before signing engineers/consultants - Don needs contract to proceed', 'KozPure', '2026-07-06', 'Critical', 'Pending', 'A-039'],
    ['A-046', 'Complete Level Up Dashboard launch for KozPure review', 'Level Up', '2026-06-30', 'High', 'In Progress', ''],
    ['A-047', 'Complete DOVA master schedule for City submittal - Josh requested City-ready schedule', 'Level Up', '2026-06-30', 'High', 'In Progress', 'A-033'],
]

COLS = {'Action ID': 6748787438817156, 'Action Description': 4496987625131908, 'Owner': 9000587252502404,
        'Due Date': 6582137294724, 'Priority': 4510181764665220, 'Status': 2258381950979972, 'Depends On': 6761981578350468}
COL_ORDER = ['Action ID', 'Action Description', 'Owner', 'Due Date', 'Priority', 'Status', 'Depends On']

for action in ACTIONS:
    # Step 1: Create empty row
    pts = {'rows': [{'cells': [], 'toBottom': True}]}
    r1 = requests.post('https://api.smartsheet.com/2.0/sheets/' + SHEET_ID + '/rows', headers=HEADERS, json=pts)
    new_id = r1.json()['result']['id']
    
    # Step 2: Update cells - Owner column (CONTACT_LIST) needs object format
    cells = []
    for t, v in zip(COL_ORDER, action):
        entry = {'columnId': COLS[t]}
        if t == 'Owner':
            # CONTACT_LIST column requires object value
            entry['objectValue'] = {'name': v}
        else:
            entry['value'] = v
        cells.append(entry)
    r2 = requests.put('https://api.smartsheet.com/2.0/sheets/' + SHEET_ID + '/rows/' + str(new_id),
                       headers=HEADERS, json={'cells': cells})
    
    aid = action[0]
    status = r2.status_code
    msg = r2.json().get('message', '')
    print(f'{aid}: created={new_id}, put={status} {msg}')
    time.sleep(0.5)  # Rate limit

print('\nVerifying...')
time.sleep(2)
r3 = requests.get('https://api.smartsheet.com/2.0/sheets/' + SHEET_ID, headers=HEADERS)
sheet3 = r3.json()
for row in sheet3['rows'][-10:]:
    cells = row.get('cells', [])
    vals = {list(COLS.keys())[list(COLS.values()).index(c.get('columnId'))] if c.get('columnId') in COLS.values() else str(c.get('columnId')): str(c.get('displayValue') or c.get('value') or '')[:30] for c in cells}
    if any(v for v in vals.values()):
        print('  Row', row['id'], ':', vals)