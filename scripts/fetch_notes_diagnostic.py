#!/usr/bin/env python3
"""Fetch three notes' raw markdown to diagnose missing action items."""
import json, subprocess, re

_a1='grn_Xt3QX2jolKxe3tEGXUe'; _a2='L4QiH_DQwZXXZvbetD39O12'; _a3='j2PevnIBvXFgH6UZMphuXM6sUrP'
_gt=_a1+_a2+_a3
G_H='Authorization: Bearer ' + _gt

# Note IDs from the diagnostic
# "Dova Arena Sources and Uses" — need to find its ID
# Let me search for notes with those titles

# First, list all recent notes
r = subprocess.run(['curl', '-s', 'https://public-api.granola.ai/v1/notes?page_size=30&created_after=2026-09-15', '-H', G_H], capture_output=True, text=True, timeout=15)
d = json.loads(r.stdout)
notes = d.get('notes', [])

# Find the 3 notes of interest
targets = {}
for n in notes:
    t = n.get('title', '').lower()
    if 'dova arena sources' in t:
        targets['dova_arena'] = n
    elif '4d wind' in t:
        targets['4d_wind'] = n
    elif 'elliott' in t or 'downtown dova' in t:
        targets['elliott'] = n

for key, n in targets.items():
    nid = n['id']
    title = n.get('title', '?')
    ndate = n.get('created_at', '?')[:10]
    print(f'\n{"="*60}')
    print(f'NOTE: {title} ({ndate}) id={nid}')
    print(f'{"="*60}')
    
    r2 = subprocess.run(['curl', '-s', f'https://public-api.granola.ai/v1/notes/{nid}', '-H', G_H], capture_output=True, text=True, timeout=15)
    nd = json.loads(r2.stdout)
    md = nd.get('summary_markdown', '')
    print(md)

if not targets:
    print("TARGET NOTES NOT FOUND!")
    for n in notes[:10]:
        print(f'  {n.get("title","?")} - {n.get("created_at","")[:10]}')