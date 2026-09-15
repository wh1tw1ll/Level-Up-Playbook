#!/usr/bin/env python3
"""STEP 14A — Full backup report"""
import json
from collections import defaultdict

ts = "20260914_170547"
backup_dir = "C:/Users/HermesAdmin/Level-Up-Playbook/backups"

with open(f"{backup_dir}/project-log_{ts}.json") as f:
    sheet = json.load(f)
with open(f"{backup_dir}/merged-view_{ts}.json") as f:
    merged = json.load(f)

cols = {c['id']: c['title'] for c in sheet.get('columns', [])}
rows = sheet.get('rows', [])

# Map action ID column
action_id_col = None  # 6748787438817156
hierarchy_col = None  # 3096079605993348
for cid, title in cols.items():
    if title == 'Action ID':
        action_id_col = cid
    elif title == 'Heirarchy':
        hierarchy_col = cid

print("=== BACKUP REPORT ===")
print(f"Timestamp: {ts}")
print(f"Project log: project-log_{ts}.json ({len(rows)} rows)")
print(f"Personal sheet: personal_{ts}.json (empty sheet)")
print(f"Merged view: merged-view_{ts}.json")
print()

# === HIERARCHY CHECK ===
print("=" * 60)
print("HIERARCHY CHECK (Smartsheet parent-child)")
print("=" * 60)

section_row_nums = [137, 209, 222, 223, 224, 229, 237, 243, 247, 253, 254, 255, 258, 263, 266, 268, 272]
section_rows = [r for r in rows if r.get('rowNumber') in section_row_nums]

parent_rows = [r for r in section_rows if r.get('hasChildren', False)]
children = [r for r in section_rows if r.get('parentId')]

print(f"Section header rows found: {len(section_rows)}")
print(f"Parent rows (hasChildren=True): {len(parent_rows)}")
print(f"Child rows (parentId set): {len(children)}")
print()

for r in section_rows:
    rn = r['rowNumber']
    cells = {c['columnId']: c.get('displayValue', c.get('value', '')) for c in r.get('cells', [])}
    title = cells.get(action_id_col, '') or '(empty)'
    kid = "HAS CHILDREN" if r.get('hasChildren') else "leaf"
    par = f"child of {r['parentId']}" if r.get('parentId') else "root"
    hier = cells.get(hierarchy_col, '')
    print(f"  Row {rn:>3} id={r['id']} | \"{title}\" | {kid:13} | {par} | Heirarchy={hier}")

print()
if parent_rows:
    print("WARNING: Section headers with children exist — do NOT archive/delete")
else:
    print("✓ All section headers are leaf rows. Safe to archive.")
print()

# === 17TH SINGLETON ===
print("=" * 60)
print("SEVENTEENTH SINGLETON")
print("=" * 60)

# Personal candidates from merged data
whitney_names = ['whitney', 'whitney williams', 'whitney w']
section_header_titles = [
    'next steps', 'action items', 'proposal and next steps',
    'new items added and next steps', 'general action item log review',
    'granola setup and next steps', 'advice for whitney and next steps',
    'outreach to trade contractors and next steps',
    '1.', '2.', '3.',
]
personal = []
for t in merged.get('tasks', []):
    title = (t.get('actionItem') or '').strip().lower()
    owner = (t.get('owner') or '').strip().lower()
    proj = (t.get('project') or '').strip()
    status = (t.get('status') or '').strip()
    if any(n in owner for n in whitney_names) and proj in ['None', ''] and status != 'Complete':
        if title not in section_header_titles:
            personal.append(t)

# Group them
def find_group(title):
    t = title.lower()
    if 'don' in t and 'sd' in t:
        return 'A: Don SDs payment path'
    if 'jci' in t:
        return 'B: JCI scope/cost'
    if 'lawrence' in t and 'email' in t:
        return 'C: Lawrence email thread'
    if 'lawrence' in t and ('tru' in t or 'popcorn' in t):
        return 'D: Lawrence popcorn machine'
    if 'cr solutions' in t or 'osip' in t:
        return 'E: CR Solutions OSIP'
    if 'granular' in t or 'more granular' in t:
        return 'F: Granular schedule'
    if 'iris' in t or 'graham' in t:
        return 'G: Graham Iris'
    return '??: UNMATCHED'

groups = defaultdict(list)
for t in personal:
    g = find_group(t.get('actionItem',''))
    groups[g].append(t)

for g, items in sorted(groups.items()):
    count = len(items)
    rows_str = ', '.join([f"#{t['rowNumber']}" for t in items])
    title = items[0].get('actionItem','')[:80]
    more = f" ({count-1} duplicates)" if count > 1 else ""
    label = "GROUP" if count > 1 else "SINGLETON"
    print(f"  {g} [{label}]")
    print(f"    Rows: {rows_str}")
    print(f"    Text: {title}{more}")
    print()

# Verify 17 total
total_in_groups = sum(len(v) for v in groups.values())
print(f"Total candidates: {total_in_groups}")
assert total_in_groups == 17, f"Expected 17, got {total_in_groups}"
print("✓ All 17 accounted for.")