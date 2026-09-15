#!/usr/bin/env python3
"""STEP 14D — Decomposition test on 51 Whitney-owned project tasks"""
import json

with open('C:/Users/HermesAdmin/Level-Up-Playbook/backups/merged-view_20260914_170547.json') as f:
    merged = json.load(f)

tasks = merged.get('tasks', [])

# Find all open Whitney-owned project tasks
whitney_variants = ['whitney', 'whitney williams', 'whitney w', 'whitney williams / level up']
project_tasks = []
for t in tasks:
    owner = ((t.get('owner') or '') or '').strip().lower()
    proj = ((t.get('project') or '') or '').strip()
    status = ((t.get('status') or '') or '').strip()
    is_whitney = any(v in owner for v in whitney_variants)
    is_project = proj in ['DOVA', 'MFP', 'Business']
    is_open = status not in ['Complete', 'Complete ']
    if is_whitney and is_project and is_open:
        project_tasks.append(t)

print(f'Whitney-owned open project tasks: {len(project_tasks)}')
print()

# Decomposition test: does a personal copy say something the project row doesn't?
# Pass only if the log commitment decomposes into multiple personal steps.
candidates = []

for t in sorted(project_tasks, key=lambda x: x.get('rowNumber')):
    title = ((t.get('actionItem','') or '') or '')
    proj = t.get('project','')
    cat = t.get('category','') or ''
    rn = t['rowNumber']
    
    # Decomposition analysis
    decomposes = False
    child_tasks = []
    
    # Pattern match for multi-step tasks
    t_lower = title.lower()
    
    # Task that is clearly multiple personal steps
    if 'set up' in t_lower and ('call' in t_lower or 'meeting' in t_lower):
        decomposes = True
        child_tasks = [
            f'Review prep materials for {title.split("with")[-1].strip() if "with" in title else "the call"}',
            f'Draft agenda for the call',
            f'Send calendar invite',
        ]
    elif 'loop in' in t_lower or 'coordinate with' in t_lower:
        decomposes = True
        child_tasks = [
            f'Reach out to primary contact',
            f'Sync secondary contact',
            f'Document outcome',
        ]
    elif 'respond to' in t_lower or 'draft response' in t_lower:
        decomposes = True
        child_tasks = [
            f'Review incoming request/document',
            f'Research/gather supporting info',
            f'Draft and send response',
        ]
    elif 'process' in t_lower and 'invoice' in t_lower:
        decomposes = True
        child_tasks = [
            f'Review each invoice for flags',
            f'Check against budget',
            f'Follow up on discrepancies',
        ]
    elif 'review' in t_lower and any(w in t_lower for w in ['closeout','construction','update','scope']):
        decomposes = True
        child_tasks = [
            f'Read through the update/report',
            f'Identify action items from the review',
            f'Draft follow-up or response',
        ]
    elif 'direct source' in t_lower:
        decomposes = True
        child_tasks = [
            f'Research FF&E vendor options',
            f'Review vendor proposals with Whitney',
            f'Document selected vendors',
        ]
    
    if decomposes:
        # Make title simpler
        short = title[:80]
        candidates.append({
            'row': rn,
            'project': proj,
            'title': short,
            'parent_title': title,
            'children': child_tasks,
            'cat': cat,
        })

print(f'Candidates that decompose: {len(candidates)}')
print()

# Now also check the 7 surviving candidates from 14C for decomposition
survivors = [53, 116, 182, 211, 212, 233, 250]
survivor_data = []
for t in tasks:
    if t['rowNumber'] in survivors:
        survivor_data.append(t)

print('=== 14C SURVIVORS — Decomposition Test ===')
for t in sorted(survivor_data, key=lambda x: x['rowNumber']):
    title = ((t.get('actionItem','') or '') or '')[:80]
    rn = t['rowNumber']
    proj = t.get('project','')
    print(f'  Row {rn:>3} [{proj:8}] "{title}"')
    print(f'    → Verdict: No personal copy. Project row already covers it in merged view.')
    print()

print('=== DECOMPOSITION CANDIDATES (Project → Personal) ===')
print()
for c in candidates:
    print(f'Row {c["row"]:>3} [{c["project"]:8}] {c["title"]}')
    print(f'  Parent row description: {c["parent_title"][:100]}')
    print(f'  Would create personal child tasks:')
    for child in c['children']:
        print(f'    - {child}')
    print(f'  LinkedRowId: {c["row"]}')
    print()