#!/usr/bin/env python3
"""Retry adding action items to Smartsheet Sheet 03 with correct column IDs."""
import requests, json

with open(r'C:\Users\HermesAdmin\.hermes\.smartsheet_token') as f:
    TOKEN = f.read().strip()

SHEET_ID = '4456864287772548'
HEADERS = {'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json'}

# Get sheet columns
r = requests.get('https://api.smartsheet.com/2.0/sheets/' + SHEET_ID, headers=HEADERS)
sheet = r.json()

col_map = {}
for c in sheet['columns']:
    col_map[c['title']] = c['id']
    print('Col: {} -> id={}'.format(c['title'], c['id']))

# First, delete that blank row at the bottom
rows = sheet.get('rows', [])
last_row = rows[-1] if rows else None
if last_row:
    last_cells = last_row.get('cells', [])
    has_data = any(c.get('value') for c in last_cells)
    if not has_data:
        last_id = last_row['id']
        print('\nDeleting blank row {}...'.format(last_id))
        r_del = requests.delete(
            'https://api.smartsheet.com/2.0/sheets/' + SHEET_ID + '/rows?ids=' + str(last_id),
            headers=HEADERS
        )
        print('Delete status:', r_del.status_code, r_del.json().get('message', ''))

# Also delete any A-039 rows that are blank
for row in rows:
    cells = row.get('cells', [])
    first_val = str(cells[0].get('displayValue', cells[0].get('value', ''))) if cells else ''
    # Check if row starts with A-039 but has no description
    if first_val == 'A-039':
        desc_val = cells[1].get('displayValue', cells[1].get('value', '')) if len(cells) > 1 else ''
        if not desc_val:
            print('Deleting blank A-039 row {}...'.format(row['id']))
            r_del = requests.delete(
                'https://api.smartsheet.com/2.0/sheets/' + SHEET_ID + '/rows?ids=' + str(row['id']),
                headers=HEADERS
            )
            print('Delete status:', r_del.status_code)

# Define new items
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

COL_ORDER = ['Action ID', 'Action Description', 'Owner', 'Due Date', 'Priority', 'Status', 'Depends On']

rows_payload = []
for action in NEW_ACTIONS:
    cells = []
    for i, title in enumerate(COL_ORDER):
        cid = col_map.get(title)
        if cid and i < len(action):
            cells.append({'columnId': cid, 'value': action[i]})
    rows_payload.append({'cells': cells, 'toBottom': True})

payload = {'rows': rows_payload}
print('\nAdding {} rows...'.format(len(rows_payload)))

r2 = requests.post(
    'https://api.smartsheet.com/2.0/sheets/' + SHEET_ID + '/rows',
    headers=HEADERS,
    json=payload
)

result = r2.json()
print('Status:', r2.status_code)
print('Response:', json.dumps(result, indent=2)[:1000])

if r2.status_code == 200:
    print('\nSUCCESS!')
    # Verify
    r3 = requests.get('https://api.smartsheet.com/2.0/sheets/' + SHEET_ID, headers=HEADERS)
    sheet2 = r3.json()
    rows2 = sheet2.get('rows', [])
    print('Total rows now:', len(rows2))
    for row in rows2[-5:]:
        cells = row.get('cells', [])
        vals = [str(c.get('displayValue', c.get('value', '')))[:30] for c in cells[:3]]
        print('  {}'.format(' | '.join(vals)))