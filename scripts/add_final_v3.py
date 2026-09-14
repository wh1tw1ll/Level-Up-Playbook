#!/usr/bin/env python3
import requests, json, time, os
T_TOKEN = os.path.join(os.path.expanduser('~'), '.hermes', '.smartsheet_token')
with open(T_TOKEN) as f:
    TOKEN = f.read().strip()
SID = '4456864287772548'
HDR = {'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json'}

# Clean empties
r = requests.get('https://api.smartsheet.com/2.0/sheets/' + SID, headers=HDR)
empty = [str(rr['id']) for rr in r.json()['rows'] if not any(c.get('value') for c in rr.get('cells',[]))]
if empty:
    requests.delete('https://api.smartsheet.com/2.0/sheets/' + SID + '/rows?ids=' + ','.join(empty), headers=HDR)
    print('Cleaned', len(empty), 'rows')

ACTIONS = [
    ('A-039','Expedite P&W AIA contract - provide draft for review; Level Up review; KozPure legal','P&W','2026-06-26','Critical','Pending','A-022'),
    ('A-040','Resolve P&W fee/budget basis - which budget number the 6.5% fee is based on','KozPure','2026-07-06','Critical','Pending','A-022'),
    ('A-041','Award CM preconstruction services by Jul 13 to support Sep groundbreaking','KozPure','2026-07-13','Critical','Pending','A-035'),
    ('A-042','Decide CM path forward after McCarthy feedback','Level Up','2026-07-07','High','Pending','A-035'),
    ('A-043','Schedule Turner Construction follow-up - Clint Williams + Drake + Gromos','Greg','2026-07-03','High','Pending',''),
    ('A-044','Follow up with Swinerton and SB James for CM outreach','Greg','2026-07-03','Medium','Pending',''),
    ('A-045','Obtain executed P&W contract before signing engineers/consultants','KozPure','2026-07-06','Critical','Pending','A-039'),
    ('A-046','Complete Level Up Dashboard launch for KozPure review','Level Up','2026-06-30','High','In Progress',''),
    ('A-047','Complete DOVA master schedule for City submittal','Level Up','2026-06-30','High','In Progress','A-033'),
]

C = {'Action ID': 6748787438817156, 'Description': 4496987625131908, 'Owner': 9000587252502404,
     'Due': 6582137294724, 'Priority': 4510181764665220, 'Status': 2258381950979972, 'Depends On': 6761981578350468}

ok = 0
for a in ACTIONS:
    cells = [
        {'columnId': C['Action ID'], 'value': a[0]},
        {'columnId': C['Description'], 'value': a[1]},
        {'columnId': C['Owner'], 'value': a[2]},
        {'columnId': C['Due'], 'value': a[3]},
        {'columnId': C['Priority'], 'value': a[4]},
        {'columnId': C['Status'], 'value': a[5]},
        {'columnId': C['Depends On'], 'value': a[6]},
    ]
    r2 = requests.post('https://api.smartsheet.com/2.0/sheets/' + SID + '/rows',
                       headers=HDR, json={'rows': [{'cells': cells, 'toBottom': True}]})
    res = r2.json()
    if r2.status_code == 200:
        print('{}: OK'.format(a[0]))
        ok += 1
    else:
        print('{}: ERROR {}'.format(a[0], r2.status_code))
        print('  ', json.dumps(res, indent=2)[:400])
    time.sleep(0.3)

print('\n{}/{} added'.format(ok, len(ACTIONS)))
if ok == len(ACTIONS):
    time.sleep(2)
    r3 = requests.get('https://api.smartsheet.com/2.0/sheets/' + SID, headers=HDR)
    s3 = r3.json()
    cmap = {c['title']: c['index'] for c in s3['columns']}
    for row in s3['rows'][-15:]:
        cells = row.get('cells', [])
        vals = {}
        for t, i in cmap.items():
            if i < len(cells):
                v = cells[i].get('displayValue') or cells[i].get('value') or ''
                if v:
                    vals[t] = str(v)[:35]
        if vals and str(vals.get('Action ID','')).startswith('A-04'):
            print('  OK:', vals)