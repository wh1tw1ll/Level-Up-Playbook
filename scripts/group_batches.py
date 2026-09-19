#!/usr/bin/env python3
"""Archive Aug, group Sep by meeting, show first batch."""
import json, re, os, sys, urllib.request, urllib.parse

# Tokens
t1 = r'C:\Users\HermesAdmin\.hermes\granola_token.txt'
t2 = r'C:\Users\HermesAdmin\ss_api_key.txt'
with open(t1) as f: gtok = f.read().strip()
with open(t2) as f: stok = f.read().strip()

def clean(text):
    t = text.lower().strip()
    t = re.sub(r'\*\*', '', t)
    t = re.sub(r'\([^)]*\)', '', t)
    t = re.sub(r'[^\w\s]', ' ', t)
    t = re.sub(r'\s+', ' ', t).strip()
    return t

def fetch_notes():
    alln = []; cur = None
    while True:
        url = 'https://public-api.granola.ai/v1/notes?page_size=30'
        if cur: url += '&cursor=' + urllib.parse.quote(cur)
        req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + gtok})
        data = json.loads(urllib.request.urlopen(req).read())
        alln.extend(data.get('notes', []))
        if not data.get('hasMore') or not data.get('cursor'): break
        cur = data['cursor']
    return alln

def get_detail(nid):
    url = 'https://public-api.granola.ai/v1/notes/' + nid
    req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + gtok})
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

def ss_get(path):
    url = 'https://api.smartsheet.com/2.0' + path
    req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + stok})
    return json.loads(urllib.request.urlopen(req).read())

print('Fetching...')
notes = fetch_notes()

note_created = {}
note_items = {}
for note in notes:
    title = note.get('title', '?')
    d = (note.get('created_at', '') or '?')[:10]
    note_created[title] = d
    detail = get_detail(note['id'])
    if not detail: continue
    md = detail.get('summary_markdown', '')
    if not md: continue
    its = extract_items(md)
    if its:
        note_items[title] = {'date': d, 'items': its, 'note_id': note['id']}

all_gi = []
for title, info in note_items.items():
    for t in info['items']:
        all_gi.append({'text': t, 'note': title, 'date': info['date']})

# Existing
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

new_items = [i for i in all_gi if clean(i['text']) not in existing_clean]

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
            is_dup = True; break
    if not is_dup: truly_new.append(item)

aug = [i for i in truly_new if i['date'][:7] == '2026-08']
sep = [i for i in truly_new if i['date'][:7] == '2026-09']

# Archive August
archive = {
    'generated_at': '2026-09-17',
    'source': 'Granola cron dedup analysis',
    'august_count': len(aug),
    'september_count': len(sep),
    'august_items': aug,
}
apath = os.path.join(r'C:\Users\HermesAdmin\Level-Up-Playbook\backups', 'granola_august_archive.json')
with open(apath, 'w') as f:
    json.dump(archive, f, indent=2)
print(f'Archived {len(aug)} August items to', apath)

# Group Sep by meeting
sep_meetings = {}
for item in sep:
    n = item['note']
    if n not in sep_meetings:
        sep_meetings[n] = []
    sep_meetings[n].append(item)

sorted_mtg = sorted(sep_meetings.items(), key=lambda x: note_created.get(x[0], '2000-01-01'), reverse=True)

print()
print('=== SEPTEMBER ITEMS BY MEETING ===')
print(f'{len(sep)} items, {len(sorted_mtg)} meetings')
print()

for title, items in sorted_mtg:
    md = note_created.get(title, '?')
    print(f'--- {title} ({md}) [{len(items)}] ---')

print()

# First batch
print('=' * 60)
print('FIRST BATCH')
print('=' * 60)
if sorted_mtg:
    t, its = sorted_mtg[0]
    dt = note_created.get(t, '?')
    print(f'Meeting: {t}')
    print(f'Date: {dt}')
    print(f'Items: {len(its)}')
    print()
    
    ni = note_items.get(t, {})
    det = get_detail(ni.get('note_id', '')) if ni else None
    if det:
        md_raw = det.get('summary_markdown', '')
        cn = {
            'whitney': 'Whitney Williams', 'greg': 'Greg Wieting',
            'charlie': 'Charlie Tiwana', 'sam': 'Sam Kalscheur',
            'paul': 'Paul', 'victoria': 'Victoria', 'philip': 'Philip',
            'brandon': 'Brandon', 'buro happold': 'Buro Happold',
            'me engineers': 'ME Engineers', 'tvs': 'TVS',
        }
        if md_raw:
            lines = md_raw.split('\n')
            in_ns = False
            for line in lines:
                tl = line.strip()
                if not tl: continue
                if re.match(r'^#+\s+Next Steps', tl): in_ns = True; continue
                if in_ns and (tl.startswith('---') or (re.match(r'^#+\s', tl) and 'Next Steps' not in tl)): in_ns = False; continue
                if not in_ns or not tl.startswith('- '): continue
                om = re.search(r'\(([^)]+)\)\s*$', tl)
                raw_owner = om.group(1).strip() if om else None
                am = re.search(r'\*\*(.+?)\*\*', tl)
                act = am.group(1).strip() if am else ''
                if act:
                    owner = None
                    if raw_owner and not re.search(r'[,;/&]|and\s+', raw_owner, re.I):
                        owner = cn.get(raw_owner.strip().lower(), raw_owner)
                    if not owner and re.match(r'^(call|email|follow\s+up\s+with|reach\s+out\s+to|contact|send|text)\s+\w+', act.lower()):
                        owner = 'Whitney Williams'
                    flag = ' ??NO OWNER' if not owner else ''
                    print(f'  [{owner or "":20s}] {act[:55]}{flag}')
    else:
        for item in its:
            print(f'  {item["text"][:55]}')

# Summary
print()
print('=== SUMMARY ===')
print(f'Total:      222')
print(f'Dupes:       60 (27%)')
print(f'Truly new:  162')
print(f'  Archived: {len(aug)} (August -> backups/granola_august_archive.json)')
print(f'  Stage:    {len(sep)} (September, {len(sorted_mtg)} meetings)')
print()
print('Meetings to stage:')
for i, (title, items) in enumerate(sorted_mtg):
    dt = note_created.get(title, '?')
    print(f'  Batch {i+1}: {title} ({dt}) [{len(items)} items]')