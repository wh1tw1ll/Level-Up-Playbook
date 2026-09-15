#!/usr/bin/env python3
"""STEP 14C - Deduplication plan: compare field completeness"""
import json
from datetime import date

with open('C:/Users/HermesAdmin/Level-Up-Playbook/backups/merged-view_20260914_170547.json') as f:
    merged = json.load(f)

tasks = merged.get('tasks', [])

def row_by_number(n):
    for t in tasks:
        if t.get('rowNumber') == n:
            return t
    return None

def field_score(t):
    """Higher score = more complete. Checks all meaningful fields."""
    score = 0
    fields = {}
    for key, label in [('project','Project'), ('owner','Owner'), ('status','Status'),
                        ('category','Category'), ('dueDate','DueDate'), 
                        ('responsibleFirm','RespFirm'), ('hotTopic','HotTopic'),
                        ('statusNote','StatusNote'), ('sourceRef','SourceRef')]:
        val = t.get(key, '')
        val_str = str(val).strip() if val is not None else ''
        fields[label] = val_str
        if val_str and val_str not in ['None', '', 'False', '0', '0.0']:
            score += 1
    return score, fields

# Groups: (label, [row_numbers], expected_survivor, note)
groups = [
    ('A: Don SDs path',
     [53, 217, 219, 242, 246],
     53,
     'Row 53 already tagged DOVA/GenCoord/Whitney. All 4 duplicates will archive to it.'),

    ('B: JCI scope/cost',
     [182, 239, 241, 264, 265],
     182,
     'Row 182 already tagged DOVA/Financial. All 4 duplicates will archive to it.'),

    ('C: Lawrence email thread',
     [211, 228],
     None,
     'Whichever is more complete survives. Then classified MFP + moved to personal sheet.'),

    ('D: Lawrence popcorn machine',
     [212, 231],
     None,
     'Whichever is more complete survives. Then classified MFP.'),

    ('E: CR Solutions OSIP',
     [233, 261],
     None,
     'Whichever is more complete survives. Then classified MFP.'),

    ('F: Granular schedule',
     [116, 213, 234],
     116,
     'Row 116 already tagged DOVA/Entitlements. Both duplicates archive to it.'),

    ('G: Graham Iris',
     [250],
     250,
     'Singleton — no dedup needed. Will classify MFP.'),
]

today = str(date.today())

print('=== STEP 14C — DEDUPLICATION PLAN ===')
print()

for label, row_nums, expected, note in groups:
    print(f'--- {label} ---')
    rows = []
    for n in row_nums:
        t = row_by_number(n)
        if t:
            score, fields = field_score(t)
            title = (t.get('actionItem','') or '')[:80]
            set_f = {k: v for k, v in fields.items() if v and v not in ['None','','False','0','0.0']}
            f_str = ', '.join(f'{k}={v}' for k, v in set_f.items())
            rows.append((n, score, t, title, f_str))
            print(f'  #{n:>3}  score={score}  [{f_str}]')
            print(f'        \"{title}\"')

    # Determine survivor
    if expected:
        survivor_num = expected
    else:
        # Not pre-determined — pick highest score
        rows_sorted = sorted(rows, key=lambda x: x[1], reverse=True)
        survivor_num = rows_sorted[0][0]

    to_archive = [n for n in row_nums if n != survivor_num]

    # Get survivor info
    surv_data = row_by_number(survivor_num)
    surv_score, surv_fields = field_score(surv_data) if surv_data else (0, {})
    surv_title = ((surv_data.get('actionItem','') if surv_data else '') or '')[:60]

    print(f'\n  → SURVIVOR: **Row #{survivor_num}** (score={surv_score}) "{surv_title}"')
    print(f'  → ARCHIVE:  rows {to_archive}')
    print(f'  → Status Note on each: "Duplicate of row {survivor_num}, archived {today}"')
    print(f'  Note: {note}')
    print()

# Special: Group C plans to move to personal. Confirm?
print('=== SUMMARY ===')
total_archive = sum(len([n for n in [53,217,219,242,246,182,239,241,264,265,211,228,212,231,233,261,213,234,116] 
                         if n not in [53, 182, 116]]) for _,_,_,_ in groups)
# Actually just count manually
archive_counts = {
    'A: Don SDs': [217, 219, 242, 246],
    'B: JCI': [239, 241, 264, 265],
    'C: Lawrence email': [211 if 211 != '?' else None],
    'D: Lawrence popcorn': [212 if 212 != '?' else None],
    'E: CR Solutions': [233 if 233 != '?' else None],
    'F: Granular schedule': [213, 234],
}
# Simpler: list all rows to archive
survivor_rows = {53, 182, 116}  # Pre-determined
# For C, D, E — choose survivor dynamically
for label, row_nums in [('C', [211,228]), ('D', [212,231]), ('E', [233,261])]:
    scored = [(row_by_number(n), n) for n in row_nums]
    scored = [(score_fields(t), n) for t, n in scored if t]
    if scored:
        scored.sort(key=lambda x: x[0][0], reverse=True)
        survivor_rows.add(scored[0][1])

all_rows = {53, 217, 219, 242, 246, 182, 239, 241, 264, 265, 211, 228, 212, 231, 233, 261, 213, 234, 116}
archive_set = all_rows - survivor_rows
# Row 250 is singleton — not archived
archive_set.discard(250)

print(f'Surviving rows total: {len(survivor_rows)}')
print(f'Rows to archive (set Status Note): {len(archive_set)} — {sorted(archive_set)}')
print(f'Singletons (no action): row 250 (Graham Iris)')
print(f'Groups A, B, F archival: 4 + 4 + 2 = 10 rows to archive')
print(f'Groups C, D, E archival: 1 + 1 + 1 = 3 rows to archive')
print(f'Total to archive: {len(archive_set)}')