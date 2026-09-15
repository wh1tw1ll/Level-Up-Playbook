#!/usr/bin/env python3
"""Search merged data for context on personal candidate items"""
import json

with open('C:/Users/HermesAdmin/Level-Up-Playbook/backups/merged-view_20260914_170547.json') as f:
    merged = json.load(f)
tasks = merged.get('tasks', [])

keywords = {
    'lawrence': 'lawrence',
    'tru romania': 'tru romania',
    'popcorn': 'popcorn',
    'jci': 'jci',
    'cr solutions': 'cr solutions',
    'osip': 'osip',
    'iris': 'iris',
    'graham': 'graham',
    'don': 'don',
    'sd payment': 'sd payment',
    'sds': 'sds',
    'granular': 'granular',
    'schedule': 'schedule',
}

print('=== CONTEXT SEARCH ACROSS PROJECT LOG ===')
for label, kw in keywords.items():
    hits = []
    for t in tasks:
        title = (t.get('actionItem') or '') or ''
        note = (t.get('statusNote') or '') or ''
        owner = (t.get('owner') or '') or ''
        if kw in title.lower() or kw in note.lower():
            hits.append(t)
    
    if hits:
        print(f'\n--- "{label}" ({len(hits)} matches) ---')
        for t in hits[:8]:  # limit to 8 per keyword
            proj = (t.get('project') or '') or '-'
            owner = (t.get('owner') or '') or '-'
            title = ((t.get('actionItem') or '') or '')[:80]
            status = (t.get('status') or '') or '-'
            note = ((t.get('statusNote') or '') or '')[:60]
            cat = (t.get('category') or '') or '-'
            print(f'  #{t["rowNumber"]:>3} [{proj:10}] {owner:22} [{status:15}] {title}')
            if note and note.strip(): print(f'        Note: {note}')
            if cat and cat.strip() and cat != 'None': print(f'        Cat: {cat}')