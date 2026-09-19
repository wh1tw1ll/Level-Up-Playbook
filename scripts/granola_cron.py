#!/usr/bin/env python3
"""Granola Cron: Fetch notes with action items, stage to Personal sheet (never Project).
Supports --dry-run flag: show what would be staged without writing."""
import json, urllib.request, sys, os, re, urllib.parse
from datetime import datetime, timezone, timedelta

DRY_RUN = '--dry-run' in sys.argv

TOKEN_PATH = r'C:\Users\HermesAdmin\ss_api_key.txt'
with open(TOKEN_PATH) as f:
    SS_TOKEN = f.read().strip()
GRANOLA_TOKEN = 'grn_Xt3QX2jolKxe3tEGXUeL4QiH_DQwZXXZvbetD39O12j2PevnIBvXFgH6UZMphuXM6sUrP'
STAGE_ENDPOINT = 'https://level-up-playbook.vercel.app/api/stage'

CANONICAL = {
    'whitney': 'Whitney Williams', 'whitney williams': 'Whitney Williams',
    'greg': 'Greg Wieting', 'greg wieting': 'Greg Wieting',
    'charlie': 'Charlie Tiwana', 'charlie tiwana': 'Charlie Tiwana',
    'sam': 'Sam Kalscheur',
    'paul': 'Paul', 'victoria': 'Victoria', 'philip': 'Philip',
    'brandon': 'Brandon', 'buro happold': 'Buro Happold',
    'me engineers': 'ME Engineers', 'tvs': 'TVS',
}

DIRECTED_PATTERNS = [
    r'^(call|email|follow\s+up\s+with|reach\s+out\s+to|contact|send|text)\s+\w+',
    r'^(request|coordinate|schedule|confirm|discuss|arrange|follow\s+up|source|procure)\s+.*\s+(from|with)\s+\w+',
]

def resolve_owner(owner_raw, text):
    if owner_raw:
        if re.search(r'[,;/&]|\s+and\s+', owner_raw, re.I):
            return None
        key = owner_raw.strip().lower()
        return CANONICAL.get(key, owner_raw)
    for pat in DIRECTED_PATTERNS:
        if re.match(pat, text.lower()):
            return 'Whitney Williams'
    return None

def fetch_notes():
    all_notes = []
    cursor = None
    while True:
        url = 'https://public-api.granola.ai/v1/notes?page_size=30'
        if cursor:
            url += '&cursor=' + urllib.parse.quote(cursor)
        req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + GRANOLA_TOKEN})
        try:
            data = json.loads(urllib.request.urlopen(req).read())
        except Exception as e:
            print('  Fetch error:', e)
            break
        all_notes.extend(data.get('notes', []))
        if not data.get('hasMore') or not data.get('cursor'):
            break
        cursor = data['cursor']
    return all_notes

def get_note_detail(note_id):
    url = 'https://public-api.granola.ai/v1/notes/' + note_id
    req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + GRANOLA_TOKEN})
    try:
        return json.loads(urllib.request.urlopen(req).read())
    except:
        return None

def extract_items(md):
    items = []
    lines = md.split('\n')
    in_ns = False
    for line in lines:
        t = line.strip()
        if not t:
            continue
        m = re.match(r'^#+\s+Next Steps', t)
        if m:
            in_ns = True
            continue
        if in_ns and (t.startswith('---') or (re.match(r'^#+\s', t) and 'Next Steps' not in t)):
            in_ns = False
            continue
        if not in_ns or not t.startswith('- '):
            continue
        om = re.search(r'\(([^)]+)\)\s*$', t)
        owner_raw = om.group(1).strip() if om else None
        am = re.search(r'\*\*(.+?)\*\*', t)
        if am:
            action = am.group(1).strip()
        else:
            action = re.sub(r'^- ', '', t).strip()
            action = re.sub(r'\s*\([^)]*\)\s*$', '', action).strip()
        if action and len(action) >= 3:
            items.append({'owner_raw': owner_raw, 'text': action})
    return items

print('=== GRANOLA CRON ' + ('DRY RUN' if DRY_RUN else '') + ' ===')
print()

notes = fetch_notes()
print('Notes fetched: ' + str(len(notes)))
print()

staged = []
flagged = []
seen = set()

for note in notes:
    nid = note['id']
    title = note.get('title', '?')
    detail = get_note_detail(nid)
    if not detail:
        continue
    md = detail.get('summary_markdown', '')
    if not md:
        continue
    items = extract_items(md)
    if not items:
        continue
    for item in items:
        dedup_key = item['text'].lower().strip()
        if dedup_key in seen:
            continue
        seen.add(dedup_key)
        owner = resolve_owner(item['owner_raw'], item['text'])
        entry = {'text': item['text'], 'owner_raw': item['owner_raw'], 'owner': owner, 'series': title}
        if owner:
            staged.append(entry)
        else:
            flagged.append(entry)

print('Clean: ' + str(len(staged)) + ' items ready to stage')
print('Flagged (needs owner): ' + str(len(flagged)) + ' items')
print()

if staged:
    print('Items to stage:')
    for item in sorted(staged, key=lambda x: x['series']):
        print('  [' + item['owner'][:20] + '] ' + item['text'][:55])

if flagged:
    print()
    print('Flagged items:')
    for item in flagged:
        print('  [' + ' ' * 20 + '] ' + item['text'][:55] + ' | ' + item['series'][:30])

print()
total = len(staged) + len(flagged)
print('Total: ' + str(len(staged)) + ' + ' + str(len(flagged)) + ' = ' + str(total))

if DRY_RUN:
    print()
    print('DRY RUN -- no writes performed')
    print('To execute: run without --dry-run')
else:
    print()
    print('WRITE MODE: would stage items via /api/stage endpoint')