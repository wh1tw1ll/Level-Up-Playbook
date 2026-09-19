#!/usr/bin/env python3
"""Validate dedup: fuzzy-match 'new' items against existing rows."""
import json, urllib.request, re, urllib.parse, random, sys
from difflib import SequenceMatcher

GRANOLA_TOKEN = ''
SS_TOKEN = ''

# Read tokens from files
import os
gtpath = os.path.join(os.environ.get('HOME', 'C:\\Users\\HermesAdmin'), os.path.join('.hermes', 'granola_token.txt'))
sspath = os.path.join(os.environ.get('HOME', 'C:\\Users\\HermesAdmin'), 'ss_api_key.txt')

with open(os.path.expanduser('C:\\Users\\HermesAdmin\\.hermes\\granola_token.txt')) as f:
    GRANOLA_TOKEN = f.read().strip()
with open(os.path.expanduser('C:\\Users\\HermesAdmin\\ss_api_key.txt')) as f:
    SS_TOKEN = f.read().strip()

def normalize(text):
    t = text.lower().strip()
    t = re.sub(r'[^\w\s]', ' ', t)
    t = re.sub(r'\s+', ' ', t).strip()
    # Remove common leading action verbs
    t = re.sub(r'^(call|email|send|follow\s+up\s+(with|on)|reach\s+out\s+to|contact|text|coordinat|schedule|review|confirm|verify|updat|finaliz|draft|prepar|circulat|forward|distribut|share|flag|identify|resolv|clarif|get|ask|check|look|meet|connect|align|arrang|build|creat|set|establish|develop|implement|complet|finish|handl|manag|work|notify|inform|discuss|present|submit|order|place|sign|approv|authoriz|release|deploy|launch|start|continu|maintain|keep|hold|obtain|procure|sourc|collect|gather|document|research|investigat|clos|mov|push|test|validat)\s+', '', t)
    return t.strip()

def word_overlap(a, b):
    wa = set(a.split())
    wb = set(b.split())
    if not wa or not wb: return 0.0
    return len(wa & wb) / len(wa | wb)

def best_match(text, existing_list):
    norm = normalize(text)
    best_score = 0.0
    best_match = ''
    for ex in existing_list:
        ex_norm = normalize(ex)
        overlap = word_overlap(norm, ex_norm)
        seq = SequenceMatcher(None, norm, ex_norm).ratio()
        score = max(overlap, seq)
        if score > best_score:
            best_score = score
            best_match = ex
    return best_match, best_score

def fetch_notes():
    all_notes = []
    cursor = None
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
    url='https://public-api.granola.ai/v1/notes/'+nid
    req=urllib.request.Request(url,headers={'Authorization':'Bearer '+GRANOLA_TOKEN})
    try: return json.loads(urllib.request.urlopen(req).read())
    except: return None

def extract_items(md):
    items=[]
    lines=md.split('\n')
    in_ns=False
    for line in lines:
        t=line.strip()
        if not t: continue
        if re.match(r'^#+\s+Next Steps',t): in_ns=True; continue
        if in_ns and (t.startswith('---') or (re.match(r'^#+\s',t) and 'Next Steps' not in t)): in_ns=False; continue
        if not in_ns or not t.startswith('- '): continue
        am=re.search(r'\*\*(.+?)\*\*',t)
        if am: action=am.group(1).strip()
        else:
            action=re.sub(r'^- ','',t).strip()
            action=re.sub(r'\s*\([^)]*\)\s*$','',action).strip()
        if action and len(action)>=3: items.append(action)
    return items

def ss_get(path):
    url='https://api.smartsheet.com/2.0'+path
    req=urllib.request.Request(url,headers={'Authorization':'Bearer '+SS_TOKEN})
    return json.loads(urllib.request.urlopen(req).read())

print('=== DEDUP VALIDATION ===\n')

notes=fetch_notes()
note_items={}
for note in notes:
    title=note.get('title','?')
    d=(note.get('created_at','') or '?')[:10]
    detail=get_detail(note['id'])
    if not detail: continue
    md=detail.get('summary_markdown','')
    if not md: continue
    its=extract_items(md)
    if its: note_items[title]={'date':d,'items':its}

all_gi=[]
for title,info in note_items.items():
    for t in info['items']:
        all_gi.append({'text':t,'note':title,'date':info['date']})

print(f'Granola items: {len(all_gi)}')

# Existing
project=ss_get('/sheets/4456864287772548?rows=1000')
personal=ss_get('/sheets/2802755367554948?rows=500')
proj_rev={c['id']:c['title'] for c in project.get('columns',[])}
pers_rev={c['id']:c['title'] for c in personal.get('columns',[])}

existing_texts=[]
for sd,rev in [(project,proj_rev),(personal,pers_rev)]:
    for r in sd.get('rows',[]):
        for c in r.get('cells',[]):
            if rev.get(c.get('columnId',''))=='Action ID':
                v=c.get('displayValue') or c.get('value','')
                t=str(v).strip()
                if t and len(t)>5: existing_texts.append(t)

print(f'Existing rows: {len(existing_texts)}')

# Exact match
exact_set=set(t.lower().strip() for t in existing_texts)
granola_new=[i for i in all_gi if i['text'].lower().strip() not in exact_set]
granola_dup=[i for i in all_gi if i['text'].lower().strip() in exact_set]
print(f'Exact-match new: {len(granola_new)}')
print(f'Exact-match dup: {len(granola_dup)}')

# Fuzzy: find near-dups among "new" items
print('\nFuzzy-matching', len(granola_new), 'items against', len(existing_texts), 'existing...')
near_dups=[]
true_new=[]
for item in granola_new:
    match,score=best_match(item['text'],existing_texts)
    if score>0.45:
        near_dups.append({'item':item,'match':match,'score':score})
    else:
        true_new.append(item)

print(f'\nGenuinely new (score <= 0.45): {len(true_new)}')
print(f'Near-duplicates (score > 0.45): {len(near_dups)}')

# 20 random samples
print('\n' + '='*60)
print('20 RANDOM SAMPLES WITH BEST MATCH')
print('='*60)

random.seed(42)
samples=random.sample(granola_new,min(20,len(granola_new)))
for item in samples:
    match,score=best_match(item['text'],existing_texts)
    flag=''
    if score>0.45: flag=' <<< NEAR-DUP'
    print(f'\nSCORE: {score:.2f}{flag}')
    print(f'  NEW:  [{item["date"]}] {item["text"][:60]}')
    print(f'        from: {item["note"][:35]}')
    print(f'  BEST: {match[:60]}')

# Worst near-dups
near_dups.sort(key=lambda x:-x['score'])
print('\n' + '='*60)
print('TOP 10 NEAR-DUPLICATES')
print('='*60)
for nd in near_dups[:10]:
    print(f'\nSCORE: {nd["score"]:.2f}')
    print(f'  NEW:  {nd["item"]["text"][:60]}')
    print(f'        from: {nd["item"]["note"][:35]}')
    print(f'  EXIST: {nd["match"][:60]}')

# Summary
print('\n' + '='*60)
print('SUMMARY')
print('='*60)
print(f'Total Granola items:     {len(all_gi)}')
print(f'Exact-match dupes:      {len(granola_dup)} ({round(len(granola_dup)/len(all_gi)*100)}%)')
print(f'Near-dupes (fuzzy):      {len(near_dups)} ({round(len(near_dups)/len(all_gi)*100)}%)')
print(f'Genuinely new:           {len(true_new)} ({round(len(true_new)/len(all_gi)*100)}%)')
combined = len(granola_dup) + len(near_dups)
print(f'Combined capture rate:   {round(combined/len(all_gi)*100)}%')