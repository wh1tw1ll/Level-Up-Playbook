#!/usr/bin/env python3
"""Check what's in DOVA Smartsheet vs Greg's agenda. Flat format."""
import requests, json

def fetch_sheet(sheet_num):
    r = requests.get('https://level-up-playbook.vercel.app/api/dova?sheet={:02d}'.format(sheet_num))
    if r.status_code != 200:
        print('  Error: {}'.format(r.status_code))
        return []
    data = r.json()
    rows = data.get('rows', [])
    return rows

def show_items(rows, cols):
    for r in rows:
        vals = []
        for c in cols:
            val = r.get(c, '')
            vals.append(str(val)[:40])
        print('  | '.join(vals))

print('=== SHEET 03 — ACTION TRACKER ===')
actions = fetch_sheet(3)
print('Keys:', list(actions[0].keys()) if actions else 'empty')
for a in actions:
    aid = a.get('Action ID', '')
    desc = a.get('Action Description', '')
    owner = a.get('Owner', '')
    status = a.get('Status', '')
    due = a.get('Due Date', '')
    priority = a.get('Priority', '')
    print('  {} | {} | {} | {} | {} | {}'.format(
        str(aid)[:8], str(desc)[:55], str(owner)[:12], str(status)[:12], str(due)[:12], str(priority)[:8]))

print()
print('=== SHEET 05 — SCHEDULE MILESTONES ===')
sched = fetch_sheet(5)
if sched:
    print('Keys:', list(sched[0].keys()))
    for s in sched:
        print('  {}'.format(json.dumps(s)))
else:
    print('Empty')

print()
print('=== SHEET 04 — BUDGET SUMMARY ===')
budget = fetch_sheet(4)
if budget:
    print('Keys:', list(budget[0].keys()))
    for b in budget:
        print('  {}'.format(json.dumps(b)))
else:
    print('Empty')

print()
print('=== SHEET 08 — PERMITTING ===')
perm = fetch_sheet(8)
if perm:
    print('Keys:', list(perm[0].keys()))
    for p in perm[:5]:
        print('  {}'.format(json.dumps(p)))
else:
    print('Empty')