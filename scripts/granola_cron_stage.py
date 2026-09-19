#!/usr/bin/env python3
"""Granola Cron: Fetch notes with action items, stage to Personal sheet via /api/stage.
Run from cron to process new action items daily."""
import json, urllib.request, re, urllib.parse, subprocess, time, sys
from datetime import datetime, timezone

STAGE_URL = 'https://level-up-playbook.vercel.app/api/stage'
LOG_FILE = r'C:\Users\HermesAdmin\.hermes\granola_scan_log.json'

gtok = open(r'C:\Users\HermesAdmin\.hermes\granola_token.txt').read().strip()
ss_token = open(r'C:\Users\HermesAdmin\ss_api_key.txt').read().strip()

CANONICAL = {
    'whitney': 'Whitney Williams', 'whitney williams': 'Whitney Williams',
    'greg': 'Greg Wieting', 'greg wieting': 'Greg Wieting',
    'charlie': 'Charlie Tiwana', 'sam': 'Sam Kalscheur',
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
    'matt': 'Matt', 'stephanie': 'Stephanie', 'chandler': 'Chandler',
    'sabeel': 'Sabeel', 'anthony': 'Anthony', 'giordano': 'Giordano',
    'derrick': 'Derrick', 'derek': 'Derek', 'chris': 'Chris',
    'george': 'George', 'devin': 'Devin',
}

def clean(text):
    t = text.lower().strip()
    t = re.sub(r'\*\*', '', t); t = re.sub(r'\([^)]*\)', '', t)
    t = re.sub(r'[^\w\s]', ' ', t); t = re.sub(r'\s+', ' ', t).strip()
    return t

def log_run(status, staged, flagged, error=None):
    entry = {'timestamp': datetime.now(timezone.utc).isoformat(), 'status': status,
             'staged': staged, 'flagged': flagged, 'error': error}
    try:
        with open(LOG_FILE) as f: log = json.load(f)
    except: log = []
    log.append(entry)
    log = log[-100:]
    with open(LOG_FILE, 'w') as f: json.dump(log, f, indent=2)

def resolve_owner(item):
    o = item.get('owner_raw'); t = item['action']
    if o:
        if re.search(r'[,;/&]|\s+and\s+', o, re.I): return None, f'Multi-owner: {o}'
        return CANONICAL.get(o.strip().lower(), o.strip()), None
    pats = [
        r'^(call|email|follow\s+up\s+with|reach\s+out\s+to|contact|send|text)\s+\w+',
        r'^(request|coordinate|schedule|confirm|discuss|arrange|follow\s+up|source|procure|start|meet|share|circulate|issue|forward|add|update|connect|finalize|complete)\s+.*\s+(from|with|to)\s+\w+',
    ]
    for p in pats:
        m = re.match(p, t.lower())
        if m:
            ap = re.search(r'(from|with|to)\s+(\w+)', t.lower())
            if ap and ap.group(2) in ('whitney',): return None, f'Whitney is recipient'
            return 'Whitney Williams', None
    return 'Whitney Williams', None

def get_existing():
    url = 'https://api.smartsheet.com/2.0/sheets/2802755367554948?rows=1000'
    req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + ss_token})
    sheet = json.loads(urllib.request.urlopen(req).read())
    rev = {c['id']: c['title'] for c in sheet.get('columns', [])}
    texts = set()
    for r in sheet.get('rows', []):
        for c in r.get('cells', []):
            if rev.get(c.get('columnId', '')) == 'Action ID':
                v = str(c.get('displayValue') or c.get('value', '')).lower().strip()
                if v: texts.add(v)
    return texts

def stage(text, owner, ref):
    p = json.dumps({'text': text, 'owner': owner, 'sourceRef': ref})
    for _ in range(3):
        try:
            r = subprocess.run(['curl', '-s', '-X', 'POST', STAGE_URL,
                '-H', 'Content-Type: application/json', '-d', p],
                capture_output=True, text=True, timeout=15)
            if r.stdout:
                resp = json.loads(r.stdout)
                return resp.get('status', 'ERR'), resp.get('rowId', '?')
        except: pass
        time.sleep(1)
    return 'FAIL', '?'

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
    for i, ln in enumerate(md.split('\n')):
        t = ln.strip()
        if not t or not re.match(r'^#+\s+Next Steps', t): continue
        for j in range(i+1, len(md.split('\n'))):
            l = md.split('\n')[j].strip()
            if not l: continue
            if l.startswith('---') or (re.match(r'^#+\s', l) and 'Next Steps' not in l): break
            if l.startswith('- '):
                om = re.search(r'\(([^)]+)\)\s*$', l)
                ow = om.group(1).strip() if om else None
                am = re.search(r'\*\*(.+?)\*\*', l)
                act = am.group(1).strip() if am else re.sub(r'^- ', '', l).strip()
                act = re.sub(r'\s*\([^)]*\)\s*$', '', act).strip()
                if act and len(act) >= 3: items.append({'action': act, 'owner_raw': ow})
        break
    return items

print('=== GRANOLA CRON (staging to Personal sheet) ===', flush=True)
existing = get_existing()
existing_norm = {clean(t) for t in existing}
print('Existing rows: ' + str(len(existing)), flush=True)

notes = fetch_notes()
staged_count = 0; flagged_count = 0; dup_count = 0

for note in notes:
    title = note.get('title', '?')
    detail = get_detail(note['id'])
    if not detail: continue
    md = detail.get('summary_markdown', '')
    if not md: continue
    items = extract_items(md)
    if not items: continue
    for item in items:
        c = clean(item['action'])
        if c in existing_norm:
            dup_count += 1; continue
        owner, flag = resolve_owner(item)
        if flag:
            flagged_count += 1; print(f'  FLAG: {flag} "{item["action"][:50]}"', flush=True)
            continue
        status, rid = stage(item['action'], owner, f'Granola:{title}')
        staged_count += 1
        print(f'  {status}: {owner} "{item["action"][:50]}" -> {rid}', flush=True)

print(f'Staged: {staged_count}  Flagged: {flagged_count}  Dupes: {dup_count}', flush=True)
log_run('success', staged_count, flagged_count)