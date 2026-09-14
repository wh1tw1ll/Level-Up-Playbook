#!/usr/bin/env python3
"""Add missing action items to Smartsheet Sheet 03."""
import requests, json

TOKEN = 'RF7rXk6qXKuHV9vYpcy0JrvraEyjOyexVBk3f'
SHEET_ID = '4456864287772548'
HEADERS = {'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json'}

# Step 1: Get sheet structure to find column IDs
r = requests.get('https://api.smartsheet.com/2.0/sheets/' + SHEET_ID, headers=HEADERS)
if r.status_code != 200:
    print('Error fetching sheet:', r.status_code, r.text[:200])
    exit(1)

sheet = r.json()
col_map = {}
for c in sheet.get('columns', []):
    col_map[c['title']] = c['id']

print('Columns:', list(col_map.keys()))

# Step 2: Define new action items
NEW_ACTIONS = [
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

# Map column titles to their order
# Sheet 03 columns: Action ID, Action Description, Owner, Due Date, Priority, Status, Depends On
COL_ORDER = ['Action ID', 'Action Description', 'Owner', 'Due Date', 'Priority', 'Status', 'Depends On']

rows = []
for action in NEW_ACTIONS:
    cells = []
    for i, col_title in enumerate(COL_ORDER):
        cid = col_map.get(col_title)
        if cid:
            cells.append({'columnId': cid, 'value': action[i]})
    rows.append({'cells': cells, 'toBottom': True})

payload = {'rows': rows}

print('Adding', len(rows), 'rows to Smartsheet...')

r2 = requests.post(
    'https://api.smartsheet.com/2.0/sheets/' + SHEET_ID + '/rows',
    headers=HEADERS,
    json=payload
)

if r2.status_code == 200:
    result = r2.json()
    print('SUCCESS!', result.get('message', ''))
    print('Rows added:', result.get('resultSheet', {}).get('totalRowCount', 'unknown'))
    # Show the row IDs
    for row in result.get('result', []):
        print('  Row', row.get('id'), '-', row.get('cells', [{}])[0].get('displayValue', ''))
else:
    print('ERROR:', r2.status_code)
    print(r2.text[:500])