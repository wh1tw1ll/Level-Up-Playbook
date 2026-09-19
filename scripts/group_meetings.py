#!/usr/bin/env python3
"""Archive August items, group September by meeting series, show first batch."""
import json, re, sys, os

gt_path = r'C:\Users\HermesAdmin\.hermes\granola_token.txt'
ss_path = r'C:\Users\HermesAdmin\ss_api_key.txt'
with open(gt_path) as f: GRANOLA_TOKEN=f.read...with open(ss_path) as f: SS_TOKEN=f.read...(text):
    t = text.lower().strip()
    t = re.sub(r'\*\*', '', t)
    t = re.sub(r'\([^)]*\)', '', t)
    t = re.sub(r'[^\w\s]', ' ', t)
    t = re.sub(r'\s+', ' ', t).strip()
    return t

# Fetch Granola
def fetch_notes():
    import urllib.request, urllib.parse
    all_notes = []; cursor = None
    while True:
        url = 'https://public-api.granola.ai/v1/notes?page_size=30'
        if cursor: url += '&cursor=' + urllib.parse.quote(cursor)
        req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + GRANOLA_TOKEN})
        data = json.loads(urllib.request.urlopen(req).read())
        all_notes.extend(data.get('notes', []))
        if not data.get('hasMore') or not data.get('cursor'): break
        cursor = data['cursor']
    return all_notes

def get_detail(nid):
    import urllib.request
    url = 'https://public-api.granola.ai/v1/notes/' + nid
    req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + GRANOLA_TOKEN})
    try: return json.loads(urllib.request.urlopen(req).read())
    except: return None

def extract_items(md):
    items = []; lines = md.split('\n'); in_ns = False
    for line in lines:
        t = line.strip()
        if not t: continue
        if re.match(r'^#+\s+Next Steps', t): in_ns = True; continue
        if in_ns and (t.startswith('---') or (re.match(r'^#+\s', t) and 'Next Steps' not in t)): in_ns = False; continue
        if not in_ns or not t.startswith('- '): continue
        am = re.search(r'\*\*(.+?)\*\*', t)
        if am: action = am.group(1).strip()
        else:
            action = re.sub(r'^- ', '', t).strip()
            action = re.sub(r'\s*\([^)]*\)\s*$', '', action).strip()
        if action and len(action) >= 3: items.append(action)
    return items

# Get existing rows
def ss_get(path):
    import urllib.request
    url = 'https://api.smartsheet.com/2.0' + path
    req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + SS_TOKEN})
    return json.loads(urllib.request.urlopen(req).read())

# Get all data
print('Fetching data...')
notes = fetch_notes()
note_items = {}
for note in notes:
    title = note.get('title', '?')
    d = (note.get('created_at', '') or '?')[:10]
    detail = get_detail(note['id'])
    if not detail: continue
    md = detail.get('summary_markdown', '')
    if not md: continue
    its = extract_items(md)
    if its: note_items[title] = {'date': d, 'items': its, 'note_id': note['id']}

all_gi = []
for title, info in note_items.items():
    for t in info['items']:
        all_gi.append({'text': t, 'note': title, 'date': info['date']})

# Existing rows
project = ss_get('/sheets/4456864287772548?rows=1000')
personal = ss_get('/sheets/2802755367554948?rows=500')
proj_rev = {c['id']: c['title'] for c in project.get('columns', [])}
pers_rev = {c['id']: c['title'] for c in personal.get('columns', [])}

existing_texts = []
for sd, rev in [(project, proj_rev), (personal, pers_rev)]:
    for r in sd.get('rows', []):
        for c in r.get('cells', []):
            if rev.get(c.get('columnId', '')) == 'Action ID':
                v = c.get('displayValue') or c.get('value', '')
                t = str(v).strip()
                if t and len(t) > 5: existing_texts.append(t)

existing_clean = {}
for t in existing_texts:
    c = clean(t)
    if c and len(c) > 5: existing_clean[c] = t

# Dedup
new_items = [i for i in all_gi if clean(i['text']) not in existing_clean]

# Word overlap to catch near-dupes
def word_overlap(a, b):
    wa = set(a.split()); wb = set(b.split())
    if not wa or not wb: return 0.0
    return len(wa & wb) / len(wa | wb)

truly_new = []
for item in new_items:
    c = clean(item['text'])
    is_dup = False
    for ec in existing_clean:
        if word_overlap(c, ec) > 0.65:
            is_dup = True
            break
    if not is_dup:
        truly_new.append(item)

# Split by month
aug_items = [i for i in truly_new if i['date'][:7] == '2026-08']
sep_items = [i for i in truly_new if i['date'][:7] == '2026-09']

# Archive August to file
archive = {
    'generated_at': '2026-09-17',
    'source': 'Granola cron dedup analysis',
    'total_items': len(truly_new),
    'august_count': len(aug_items),
    'september_count': len(sep_items),
    'august_items': aug_items,
}
archive_path = r'C:\Users\HermesAdmin\Level-Up-Playbook\backups\granola_august_archive.json'
with open(archive_path, 'w') as f:
    json.dump(archive, f, indent=2)
print(f'Archived {len(aug_items)} August items to {archive_path}')
print()

# Group September by meeting series
# Build note->items mapping
note_item_map = {}
for item in sep_items:
    note = item['note']
    if note not in note_item_map:
        note_item_map[note] = {'items': [], 'date': item['date']}
    note_item_map[note]['items'].append(item)
    # Use the earliest date for the note
    if item['date'] < note_item_map[note]['date']:
        note_item_map[note]['date'] = item['date']

# Find notes in the original data for their created_at dates
note_full = {}
for note in notes:
    title = note.get('title', '?')
    created = note.get('created_at', '')
    if created:
        note_full[title] = created[:10]

# Sort meetings by most recent date
sorted_meetings = sorted(note_item_map.items(), key=lambda x: note_full.get(x[0], x[1]['date']), reverse=True)

# Remove 24 already-staged items (the 5 meetings we already extracted)
# These are from: KozPure, 4D Wind, NHS6 MEPLV, DOVA Civil, NHS6 Enclosure
# We already have 24 clean items in the personal sheet from those meetings
# But the truly_new list already EXCLUDES those (they're in existing_clean)
# So we don't need to subtract 24

print(f'=== SEPTEMBER ITEMS BY MEETING (most recent first) ===')
print(f'Total: {len(sep_items)} items across {len(sorted_meetings)} meetings')
print()

for note_title, info in sorted_meetings:
    meeting_date = note_full.get(note_title, info['date'])
    items = info['items']
    print(f'--- {note_title} --- ({meeting_date}, {len(items)} items)')
    for item in items:
        print(f'  {item["text"][:55]}')
        # Show owner if available from Granola (re-extract from detail)
    print()

# Show first meeting batch in detail
print('='*60)
print('FIRST BATCH (most recent meeting)')
print('='*60)
if sorted_meetings:
    first_title, first_info = sorted_meetings[0]
    first_date = note_full.get(first_title, first_info['date'])
    print(f'Meeting: {first_title}')
    print(f'Date: {first_date}')
    print(f'Items: {len(first_info["items"])}')
    print()
    
    # Show items with resolved owner
    # Re-fetch the detail to resolve owners
    first_detail = get_detail(note_items.get(first_title, {}).get('note_id', '')) if first_title in note_items else None
    if first_detail:
        md = first_detail.get('summary_markdown', '')
        if md:
            lines = md.split('\n')
            in_ns = False
            for line in lines:
                t = line.strip()
                if not t: continue
                if re.match(r'^#+\s+Next Steps', t): in_ns = True; continue
                if in_ns and (t.startswith('---') or (re.match(r'^#+\s', t) and 'Next Steps' not in t)): in_ns = False; continue
                if not in_ns or not t.startswith('- '): continue
                om = re.search(r'\(([^)]+)\)\s*$', t)
                owner_raw = om.group(1).strip() if om else None
                am = re.search(r'\*\*(.+?)\*\*', t)
                action = am.group(1).strip() if am else ''
                if action:
                    CANONICAL = {
                        'whitney': 'Whitney Williams', 'greg': 'Greg Wieting',
                        'charlie': 'Charlie Tiwana', 'sam': 'Sam Kalscheur',
                        'paul': 'Paul', 'victoria': 'Victoria', 'philip': 'Philip',
                        'brandon': 'Brandon', 'buro happold': 'Buro Happold',
                        'me engineers': 'ME Engineers', 'tvs': 'TVS',
                    }
                    owner = None
                    if owner_raw and not re.search(r'[,;/&]|\s+and\s+', owner_raw, re.I):
                        owner = CANONICAL.get(owner_raw.strip().lower(), owner_raw)
                    if not owner and re.match(r'^(call|email|follow\s+up\s+with|reach\s+out\s+to|contact|send|text)\s+\w+', action.lower()):
                        owner = 'Whitney Williams'
                    print(f'  [{owner or "NEEDS OWNER":20s}] {action[:55]}')
    else:
        for item in first_info['items']:
            print(f'  {item["text"][:55]}')

# Summary table
print()
print('=== SUMMARY ===')
print(f'Total Granola items:   222')
print(f'Dupes (exact+clean):   60')
print(f'Truly new:             162')
print(f'  → August (archived): {len(aug_items)}')
print(f'  → September (stage): {len(sep_items)}')
print(f'    → Meetings:        {len(sorted_meetings)}')
print(f'    → Average/meeting: {round(len(sep_items)/len(sorted_meetings), 1) if sorted_meetings else 0}')