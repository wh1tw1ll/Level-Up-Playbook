#!/usr/bin/env python3
import json, urllib.request, re, urllib.parse, random, sys

# Token reads - multi-line to avoid syntax issues
gt_path = r'C:\Users\HermesAdmin\.hermes\granola_token.txt'
ss_path = r'C:\Users\HermesAdmin\ss_api_key.txt'
with open(gt_path) as f: GRANOLA_TOKEN = f.read().strip()
with open(ss_path) as f: SS_TOKEN = f.read().strip()

def clean(text):
    t = text.lower().strip()
    t = re.sub(r'\*\*', '', t)
    t = re.sub(r'\([^)]*\)', '', t)
    t = re.sub(r'[^\w\s]', ' ', t)
    t = re.sub(r'\s+', ' ', t).strip()
    return t

print('=== DEDUP WITH PROPER NORMALIZATION ===')
sys.stdout.flush()

# Get Granola items (cached from this session)
import os
cache_path = r'C:\Users\HermesAdmin\Level-Up-Playbook\scripts\granola_cache.json'
if os.path.exists(cache_path):
    with open(cache_path) as f: note_items = json.load(f)
    print('Loaded cached Granola data')
else:
    # Fresh fetch
    def fetch_notes():
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
            action = am.group(1).strip() if am else re.sub(r'^- ', '', t).strip()
            if am: action = am.group(1).strip()
            else:
                action = re.sub(r'^- ', '', t).strip()
                action = re.sub(r'\s*\([^)]*\)\s*$', '', action).strip()
            if action and len(action) >= 3: items.append(action)
        return items

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
        if its: note_items[title] = {'date': d, 'items': its}
    # Cache for reuse
    with open(cache_path, 'w') as f: json.dump(note_items, f)
    print('Fetched and cached Granola data')

all_gi = []
for title, info in note_items.items():
    for t in info['items']:
        all_gi.append({'text': t, 'note': title, 'date': info['date']})
print(f'Granola items: {len(all_gi)}')
sys.stdout.flush()

# Existing rows
def ss_get(path):
    url = 'https://api.smartsheet.com/2.0' + path
    req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + SS_TOKEN})
    return json.loads(urllib.request.urlopen(req).read())

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

print(f'Existing rows: {len(existing_texts)} clean unique: {len(existing_clean)}')
sys.stdout.flush()

granola_dup = [i for i in all_gi if clean(i['text']) in existing_clean]
granola_new = [i for i in all_gi if clean(i['text']) not in existing_clean]

print(f'Dupes (clean normalize): {len(granola_dup)} ({round(len(granola_dup)/len(all_gi)*100)}%)')
print(f'New (clean normalize):   {len(granola_new)} ({round(len(granola_new)/len(all_gi)*100)}%)')
sys.stdout.flush()

# Word-overlap fuzzy on new
def word_overlap(a, b):
    wa = set(a.split()); wb = set(b.split())
    if not wa or not wb: return 0.0
    return len(wa & wb) / len(wa | wb)

def best_match(text, clean_map):
    c = clean(text)
    best = 0.0; best_orig = ''
    for ec, orig in clean_map.items():
        o = word_overlap(c, ec)
        if o > best: best = o; best_orig = orig
    return best_orig, best

fuzzy_caught = []; truly_new = []
for item in granola_new:
    match, score = best_match(item['text'], existing_clean)
    if score > 0.65:
        fuzzy_caught.append({'item': item, 'match': match, 'score': score})
    else:
        truly_new.append(item)

print(f'Fuzzy-caught (word overlap >0.65): {len(fuzzy_caught)}')
print(f'Truly new (word overlap <=0.65):   {len(truly_new)}')
print()
sys.stdout.flush()

print('=== FORMAT/CLEAN FIXES NOW CAUGHT ===')
for nd in fuzzy_caught[:8]:
    print(f'  {nd["score"]:.2f} NEW:  {nd["item"]["text"][:55]}')
    print(f'     EXIST: {nd["match"][:55]}')
print()

print('=== 10 TRULY NEW SAMPLES ===')
for item in truly_new[:10]:
    print(f'  [{item["date"]}] {item["text"][:55]} | {item["note"][:30]}')
print()

total_dup = len(granola_dup) + len(fuzzy_caught)
print('=== FINAL ===')
print(f'Total:   {len(all_gi)}')
print(f'Dupes:   {total_dup} ({round(total_dup/len(all_gi)*100)}%)')
print(f'New:     {len(truly_new)} ({round(len(truly_new)/len(all_gi)*100)}%)')
print()

sep_new = [i for i in truly_new if i['date'][:7] == '2026-09']
aug_new = [i for i in truly_new if i['date'][:7] == '2026-08']
print(f'Sep truly new: {len(sep_new)}')
print(f'Aug truly new: {len(aug_new)}')
print(f'After removing 24 already staged from Sep: {max(0, len(sep_new) - 24)}')