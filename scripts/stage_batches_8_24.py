#!/usr/bin/env python3
"""Stage Granola batches 8-24 (Sep 1-9 items)."""
import json, urllib.request, re, urllib.parse, subprocess, sys, time

gtok = open(r'C:\Users\HermesAdmin\.hermes\granola_token.txt').read().strip()
ss_token = open(r'C:\Users\HermesAdmin\ss_api_key.txt').read().strip()

CANONICAL = {
    'whitney': 'Whitney Williams', 'whitney williams': 'Whitney Williams',
    'greg': 'Greg Wieting', 'greg wieting': 'Greg Wieting',
    'charlie': 'Charlie Tiwana', 'charlie tiwana': 'Charlie Tiwana',
    'sam': 'Sam Kalscheur', 'sam kalscheur': 'Sam Kalscheur',
    'brandon': 'Brandon', 'buro happold': 'Buro Happold',
    'me engineers': 'ME Engineers', 'tvs': 'TVS',
    'paul': 'Paul', 'victoria': 'Victoria', 'philip': 'Philip',
    'don': 'Don', 'tom': 'Tom', 'brennan': 'Brennan',
    'olly': 'Olly', 'david': 'David', 'graham': 'Graham',
    'joseph': 'Joseph', 'mike': 'Mike', 'brian': 'Brian',
    'kyle': 'Kyle', 'arlene': 'Arlene', 'albert': 'Albert',
    'sturm': 'Sturm', 'chuck': 'Chuck', 'tony': 'Tony',
    'josh': 'Josh', 'michael': 'Michael', 'kevin': 'Kevin',
    'orlana': 'Orlana', 'jeremiah': 'Jeremiah', 'thomas': 'Thomas',
    'matt': 'Matt', 'william': 'William', 'jennifer': 'Jennifer',
    'stephanie': 'Stephanie', 'chandler': 'Chandler',
    'sabeel': 'Sabeel', 'anthony': 'Anthony', 'giordano': 'Giordano',
    'derrick': 'Derrick', 'derek': 'Derek', 'chris': 'Chris',
    'george': 'George', 'devin': 'Devin',
}

def clean(text):
    t = text.lower().strip()
    t = re.sub(r'\*\*', '', t)
    t = re.sub(r'\([^)]*\)', '', t)
    t = re.sub(r'[^\w\s]', ' ', t)
    t = re.sub(r'\s+', ' ', t).strip()
    return t

def resolve_owner(item):
    owner_raw = item.get('owner_raw')
    text = item['action']
    if owner_raw:
        if re.search(r'[,;/&]|\s+and\s+', owner_raw, re.I):
            return None, f'Multi-owner: {owner_raw}'
        key = owner_raw.strip().lower()
        return CANONICAL.get(key, owner_raw.strip()), None
    pats = [
        r'^(call|email|follow\s+up\s+with|reach\s+out\s+to|contact|send|text)\s+\w+',
        r'^(request|coordinate|schedule|confirm|discuss|arrange|follow\s+up|source|procure|start|meet|share|circulate|issue|forward|add|update|connect|finalize|complete)\s+.*\s+(from|with|to)\s+\w+',
    ]
    for p in pats:
        m = re.match(p, text.lower())
        if m:
            after_prep = re.search(r'(from|with|to)\s+(\w+)', text.lower())
            if after_prep and after_prep.group(2) in ('whitney',):
                return None, f'Whitney is recipient: "{text[:50]}"'
            return 'Whitney Williams', None
    return 'Whitney Williams', None

def ss_get(path):
    url = 'https://api.smartsheet.com/2.0' + path
    req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + ss_token})
    return json.loads(urllib.request.urlopen(req).read())

# Get existing sheet rows for dedup
project = ss_get('/sheets/4456864287772548?rows=1000')
personal = ss_get('/sheets/2802755367554948?rows=500')
proj_rev = {c['id']: c['title'] for c in project.get('columns', [])}
pers_rev = {c['id']: c['title'] for c in personal.get('columns', [])}

existing_clean = set()
for sd, rev in [(project, proj_rev), (personal, pers_rev)]:
    for r in sd.get('rows', []):
        for c in r.get('cells', []):
            if rev.get(c.get('columnId', '')) == 'Action ID':
                v = c.get('displayValue') or c.get('value', '')
                t = str(v).strip()
                if t and len(t) > 5:
                    existing_clean.add(clean(t))

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
    return json.loads(urllib.request.urlopen(req).read())

def extract_items(md):
    items = []
    lines = md.split('\n')
    for i, line in enumerate(lines):
        t = line.strip()
        if not t: continue
        if re.match(r'^#+\s+Next Steps', t):
            for j in range(i+1, len(lines)):
                ln = lines[j].strip()
                if not ln: continue
                if ln.startswith('---') or (re.match(r'^#+\s', ln) and 'Next Steps' not in ln): break
                if ln.startswith('- '):
                    om = re.search(r'\(([^)]+)\)\s*$', ln)
                    owner_raw = om.group(1).strip() if om else None
                    am = re.search(r'\*\*(.+?)\*\*', ln)
                    if am:
                        action = am.group(1).strip()
                    else:
                        action = re.sub(r'^- ', '', ln).strip()
                        action = re.sub(r'\s*\([^)]*\)\s*$', '', action).strip()
                    if action and len(action) >= 3:
                        items.append({'action': action, 'owner_raw': owner_raw})
            break
    return items

def stage_item(action, owner, source_ref):
    payload = json.dumps({'text': action, 'owner': owner, 'sourceRef': source_ref})
    for attempt in range(3):
        try:
            result = subprocess.run(['curl', '-s', '-X', 'POST',
                'https://level-up-playbook.vercel.app/api/stage',
                '-H', 'Content-Type: application/json', '-d', payload],
                capture_output=True, text=True, timeout=15)
            if result.stdout and result.stdout.strip():
                resp = json.loads(result.stdout)
                return resp.get('status', 'ERR'), resp.get('rowId', '?')
        except Exception:
            pass
        time.sleep(1)
    return 'FAIL', '?'

print('Fetching notes...', flush=True)
notes = fetch_notes()
sep_data = {}
for note in notes:
    title = note.get('title', '?')
    d = (note.get('created_at', '') or '?')[:10]
    if not d.startswith('2026-09'): continue
    if title in sep_data: continue
    detail = get_detail(note['id'])
    if not detail: continue
    md = detail.get('summary_markdown', '')
    if not md: continue
    its = extract_items(md)
    if its:
        sep_data[title] = {'date': d, 'items': its}

sorted_mtgs = sorted(sep_data.items(), key=lambda x: x[1]['date'], reverse=True)
total = len(sorted_mtgs)
print(f'Total Sep meetings with items: {total}', flush=True)

staged = 0; flagged = 0; duped = 0

for batch_idx in range(7, min(24, total)):
    title, info = sorted_mtgs[batch_idx]
    dt = info['date']
    items = info['items']
    print(f'\n=== Batch {batch_idx+1}: {title} ({dt}) [{len(items)} items] ===', flush=True)
    for item in items:
        c = clean(item['action'])
        if c in existing_clean:
            duped += 1
            continue
        owner, flag = resolve_owner(item)
        if flag:
            flagged += 1
            print(f'  [FLAG] {flag}', flush=True)
            print(f'         "{item["action"][:70]}"', flush=True)
            continue
        status, rid = stage_item(item['action'], owner, f'Granola: {title} ({dt})')
        staged += 1
        print(f'  [STAGE] {owner:20s} "{item["action"][:60]}" -> {status} (row={rid})', flush=True)

print(f'\n=== FINAL ===', flush=True)
print(f'Staged: {staged}   Flagged: {flagged}   Dupes skipped: {duped}', flush=True)