#!/usr/bin/env python3
"""Push extracted Granola action items to Smartsheet with:
   - Idempotency key (sourceKey)
   - Acceptance gate (actor+verb+object)
   - Jaccard within-note dedup (catch same action described twice)
   - Field population (Project, Source, Category from meeting title)
   - Check against open rows (future: 1b)
Replaces granola_push_v4.py. Called by cron or manually."""

import json, subprocess, urllib.request, urllib.error, ssl, re, time, hashlib
from datetime import datetime, timezone, timedelta

# --- Granola Auth ---
_a1='grn_Xt3QX2jolKxe3tEGXUe'; _a2='L4QiH_DQwZXXZvbetD39O12'; _a3='j2PevnIBvXFgH6UZMphuXM6sUrP'
_gt=_a1+_a2+_a3
_gb='Bearer '
G_H='Authorization: ' + _gb + _gt

# --- Smartsheet ---
S_TK="ChRJVBkqJEaha5mLiDYGn3WCzE79I9yNkmEID"
S_SID="4456864287772548"
CLS={
    "ExtractionId": 1375775527571332,
    "Hot Topic": 1193738206744452,
    "Status": 2258381950979972,
    "Action ID": 6748787438817156,
    "Owner": 9000587252502404,
    "Source": 2297540940435332,
    "Project": 6920668081590148,
    "Category": 146108531380100,
}
ctx=ssl.create_default_context()
ah="Bearer "+S_TK

# ── Stopwords for Jaccard ──
STOPWORDS = {'the','a','to','on','and','with','of','is','for','in','at','by','an','or','as','it','its','this','that'}

# ── Acceptance Gate ──
def passes_gate(text):
    t = text.strip()
    if not t or len(t) < 10: return False
    strict_noise = [
        r'^next steps\b', r'^action items?\b', r'^sharing and next steps\b',
        r'^ongoing', r'^key takeaways?\b', r'^discussion\b', r'^agenda\b',
        r'^design review process',
        r'\.pdf$', r'\.docx?$', r'\.xlsx?$',
        r'^FW:', r'^RE:', r'^Fwd:', r'^Budget', r'^Template',
    ]
    for pat in strict_noise:
        if re.match(pat, t, re.IGNORECASE): return False
    KNOWN = 'whitney|sam|don|greg|justin|charlie|josh|albert|graham|jordan|andrew|orlana|chuck|philip|jeremiah|deray|tony|brennan|chris|chandler|sabeel|sturm|kevin|mike|brian|kyle|michael|matt|stephanie'
    has_known = bool(re.search(r'(' + KNOWN + r')', t, re.I))
    has_full_name = bool(re.search(r'\b[A-Z][a-z]+ [A-Z][a-z]+ (will |should |must |to |is going to|needs to)', t))
    has_owner_tag = bool(re.search(r'\(([^)]+)\)\s*$', t))
    has_we = bool(re.search(r'\b(we|team|group)\s+(need|should|will|must)\b', t, re.I))
    has_i = bool(re.search(r'\b(i|i\'ll)\s+(will|need|should|must)\b', t, re.I))
    if not has_known and not has_full_name and not has_owner_tag and not has_we and not has_i: return False
    verbs = ['need to','will','should','must','going to','reach out','follow up','coordinate','send','submit',
             'schedule','review','confirm','update','prepare','create','draft','forward','email','call','meet',
             'resolve','close out','investigate','flag','track','monitor','push','release','sign',
             'engage','brief','loop in','copy','work through','push back','challenge','negotiate',
             'follow','double-check','produce','develop','attend','conduct','circulate','respond','complete']
    if not any(v in t.lower() for v in verbs): return False
    return True

# ── SourceKey ──
def compute_source_key(note_id, text):
    raw = text.strip().lower()
    raw = re.sub(r'\s+', ' ', raw)
    raw = re.sub(r'[^\w\s]', '', raw)
    raw = re.sub(r'\s*\([^)]*\)\s*$', '', raw).strip()
    return hashlib.sha256((note_id + '::' + raw).encode()).hexdigest()[:16]

# ── Jaccard dedup helpers ──
def normalize_tokens(text):
    """Lowercase, strip punctuation/markdown, drop stopwords. Returns token list."""
    t = text.lower()
    t = re.sub(r'[*_#\-]', ' ', t)
    t = re.sub(r'[^\w\s]', ' ', t)
    t = re.sub(r'\s+', ' ', t).strip()
    return [w for w in t.split() if w not in STOPWORDS and len(w) > 1]

def jaccard_score(tokens_a, tokens_b):
    set_a, set_b = set(tokens_a), set(tokens_b)
    if not set_a or not set_b:
        return 0.0
    return len(set_a & set_b) / len(set_a | set_b)

def dedup_candidates(candidates):
    """
    Cluster candidates from a single note. Jaccard >= 0.5 = same action.
    Survivor heuristic:
      - Prefer candidate with **bold** markdown (Granola action item)
      - If tie or neither, prefer longer text (carries more object)
    Returns filtered candidate list.
    """
    if len(candidates) <= 1:
        return candidates

    survivors = []
    dropped_indices = set()

    for i in range(len(candidates)):
        if i in dropped_indices:
            continue
        best = i
        best_tokens = normalize_tokens(candidates[i]['txt'])
        for j in range(i + 1, len(candidates)):
            if j in dropped_indices:
                continue
            j_tokens = normalize_tokens(candidates[j]['txt'])
            score = jaccard_score(best_tokens, j_tokens)
            if score >= 0.5:
                # Decide which survives
                a_bold = '**' in candidates[best]['txt']
                b_bold = '**' in candidates[j]['txt']
                if a_bold and not b_bold:
                    dropped_indices.add(j)
                elif b_bold and not a_bold:
                    dropped_indices.add(best)
                    best = j
                    best_tokens = j_tokens
                else:
                    # Both or neither — keep the longer one
                    if len(candidates[j]['txt']) > len(candidates[best]['txt']):
                        dropped_indices.add(best)
                        best = j
                        best_tokens = j_tokens
                    else:
                        dropped_indices.add(j)
        survivors.append(candidates[best])

    return survivors

VALID_PROJECTS = {'DOVA', 'Sphere', 'SPH', 'Business', 'MFP'}
VALID_CATEGORIES = {'Design & Plans', 'Entitlements', 'Utilities & Infrastructure',
                    'Financial', 'Schedule', 'Legal & Contracts', 'Procurement',
                    'General Coordination'}

def derive_project(title):
    """Derive Project from meeting title. Only VALID_PROJECTS or blank."""
    t = title.lower()
    if 'nhs6' in t or 'sphere' in t:
        return 'Sphere'
    elif 'dova' in t or 'kozpure' in t or 'permits' in t or 'entitlement' in t or 'sd phase' in t:
        return 'DOVA'
    elif 'sph' in t or 'sports' in t or 'performance' in t:
        return 'SPH'
    elif 'mfp' in t or 'miami' in t or 'closeout' in t or 'sub closeout' in t or 'stadium' in t:
        return 'MFP'
    elif 'level up' in t and ('intro' in t or 'biz' in t or 'ops' in t or 'internal' in t):
        return 'Business'
    else:
        return ''  # blank — not a valid picklist option

def derive_category(title, item_text=''):
    """Derive Category from meeting title and/or item text."""
    text = (title + ' ' + item_text).lower()
    if any(k in text for k in ['budget','cost','pricing','payment','dispute','invoice','pay app','cash flow','ewa','fund','insurance']):
        return 'Financial'
    if any(k in text for k in ['permit','condition of approval','coa','public works','planning commission','zoning','altrans','traffic study','cup','entitle','trigger','inspection milestone','drainage study','cultural','biologist','hcp','mitigation']):
        return 'Entitlements'
    if any(k in text for k in ['esign','chematic','lans','rawings','pecification','sd','architectural','structur','ivil','floor plan']):
        return 'Design & Plans'
    if any(k in text for k in ['chedule','ilestone','imeline','eadline','uration','baseline']):
        return 'Schedule'
    if any(k in text for k in ['ontract','loi','greement','nda','edline','language','lause','suit','precedent','ownership','risk']):
        return 'Legal & Contracts'
    if any(k in text for k in ['endor','ub','ontractor','rfp','roposal','quipment','rocurement','upplier','reight','material']):
        return 'Procurement'
    if any(k in text for k in ['eeting','all','mail','oordinate','ollow up','lign','ntroduce','utreach','iscuss','onfirm','ouching base','econnect']):
        return 'General Coordination'
    if any(k in text for k in ['tility','mud','pge','ewer','ater','ower','rain','lectric','as','ire','lvac','ve','mep']):
        return 'Utilities & Infrastructure'
    if any(k in text for k in ['onstruction','unch list','loseout','ackcharge','efect','unchlist','unch-list','punchlist']):
        return 'Construction'
    return ''

# ── Main ──
print("=== GRANOLA EXTRACTION v5 (Jaccard dedup + field population) ===")
existing_keys = set()
req = urllib.request.Request(f"https://api.smartsheet.com/2.0/sheets/{S_SID}", headers={"Authorization": ah})
with urllib.request.urlopen(req, context=ctx) as resp:
    ssd = json.load(resp)
for row in ssd.get('rows', []):
    for c in row.get('cells', []):
        if c['columnId'] == CLS["ExtractionId"]:
            v = c.get('displayValue') or c.get('value') or ''
            if v: existing_keys.add(str(v).strip())
print(f"Existing ExtractionIds: {len(existing_keys)}  Total rows: {len(ssd.get('rows',[]))}")

notes=[]; cursor=None
cutoff = (datetime.now(timezone.utc) - timedelta(days=1)).strftime('%Y-%m-%d')
while True:
    url=f'https://public-api.granola.ai/v1/notes?page_size=30&created_after={cutoff}'
    if cursor: url+='&cursor='+cursor
    r=subprocess.run(['curl','-s',url,'-H',G_H],capture_output=True,text=True,timeout=15)
    d=json.loads(r.stdout)
    if 'code' in d: break
    notes.extend(d.get('notes',[]))
    if not d.get('hasMore'): break
    cursor=d.get('cursor')
print(f"Granola notes: {len(notes)}")

ACT_KW=['we need to','we should','we have to','we will','i will',"i'll",
    'next step','action item','to do','follow up','assign',
    'need to send','need to submit','need to schedule','need to coordinate',
    'need to follow','need to review','need to confirm','need to update',
    'going to send','going to forward','going to schedule',
    'reach out to','touch base with','follow up with',
    'next steps','owner:','due: ','assign:']
OWNERS=['Whitney','Sam','Don','Greg','Justin','Charlie','Josh','Albert','Graham','Jordan','Andrew','Orlana','Chuck','Philip','Jeremiah','DeRay']

total=0; gated=0; deduped=0; new_items=[]; updates=0; key_matched=0

for n in notes:
    title=n.get('title',''); nid=n['id']; ndate=n.get('created_at','')[:10]
    r=subprocess.run(['curl','-s',f'https://public-api.granola.ai/v1/notes/{nid}','-H',G_H],capture_output=True,text=True,timeout=15)
    nd=json.loads(r.stdout)
    md=nd.get('summary_markdown','') or ''

    # Check: does this note contain bolded action items?
    has_bolded = '**' in md

    # Collect candidates for this note (before Jaccard dedup)
    note_candidates = []
    for line in md.split('\n'):
        s=line.strip()
        if not s: continue
        sl=s.lower()
        is_bolded = '**' in s

        if is_bolded:
            # Bolded items bypass ACT_KW — caught by verb-only gate below
            pass
        elif has_bolded:
            # Note has bolded items — skip non-bolded lines (prevents duplicates)
            continue
        else:
            # Note has NO bolded items — fall back to body scan
            if not any(kw in sl for kw in ACT_KW): continue

        txt=s
        for p in ['# ','## ','### ','- ','* ']:
            if txt.startswith(p): txt=txt[len(p):]
        txt=txt.strip()
        if not txt or len(txt)<5: continue
        total+=1
        # Bolded items get relaxed gate (verb-only), others get full gate
        if is_bolded:
            verbs = ['need to','will','should','must','going to','reach out','follow up','coordinate','send','submit',
                     'schedule','review','confirm','update','prepare','create','draft','forward','email','call','meet',
                     'resolve','close out','investigate','flag','track','monitor','push','release','sign',
                     'engage','brief','loop in','copy','work through','push back','challenge','negotiate',
                     'follow','double-check','produce','develop','attend','conduct','circulate','respond','complete']
            if not any(v in txt.lower() for v in verbs):
                gated+=1; continue
        else:
            if not passes_gate(txt): gated+=1; continue
        owner='TBD'
        clean_txt = txt.replace('**', '').strip()
        # Remove trailing (OwnerName) or (date) from action text
        while clean_txt.endswith(')') and '(' in clean_txt:
            lo = clean_txt.rfind('(')
            lc = clean_txt.rfind(')')
            if lo < lc:
                inside = clean_txt[lo+1:lc]
                found_owner = ''
                for nm in OWNERS:
                    if nm.lower() in inside.lower():
                        found_owner = nm
                        break
                has_date = any(yr in inside for yr in ['2024','2025','2026','2027','2028'])
                if found_owner:
                    owner = found_owner
                    clean_txt = clean_txt[:lo].strip()
                elif has_date:
                    clean_txt = clean_txt[:lo].strip()
                else:
                    break
            else:
                break
        # Also check "Name to..." pattern at start
        if owner == 'TBD':
            cl = clean_txt.lower()
            for nm in sorted(OWNERS, key=len, reverse=True):
                nml = nm.lower()
                if cl.startswith(nml + ' ') or cl.startswith(nml + '/'):
                    owner = nm
                    break
        # Final text: no bold markers, no multiple spaces
        final_txt = re.sub(r'\s+', ' ', clean_txt).strip()
        note_candidates.append({'txt':final_txt,'owner':owner,'raw_line':s})

    # Within-note Jaccard dedup
    before = len(note_candidates)
    note_candidates = dedup_candidates(note_candidates)
    deduped += (before - len(note_candidates))

    # Per-note cap: max 15 items
    if len(note_candidates) > 15:
        print(f"  SKIPPED {title} — {len(note_candidates)} candidates exceeds cap of 15")
        note_candidates = []
        continue

    # Process surviving candidates
    project = derive_project(title)
    category = ''  # will derive per-item below

    for cand in note_candidates:
        txt = cand['txt']
        owner = cand['owner']
        key = compute_source_key(nid, txt)
        if key in existing_keys:
            updates += 1
            continue
        new_items.append({
            'txt': txt[:200],
            'owner': owner,
            'project': project,  # may be '' (blank) if undetermined
            'source': 'Granola',
            'cat': derive_category(title, txt),  # per-item category
            'key': key,
            'note': f'{title} ({ndate})',
        })

print(f"\nCandidates: {total} | Gate-rejected: {gated} | Key-matched (in sheet): {updates} | Jaccard-deduped: {deduped} | New: {len(new_items)}")
unset_project = sum(1 for i in new_items if not i['project'])
unset_cat = sum(1 for i in new_items if not i['cat'])
print(f"Rows with Project blank: {unset_project}  Category blank: {unset_cat}")

added=0
for item in new_items:
    action_text=item['txt']
    cells=[
        {'columnId':CLS['ExtractionId'],'objectValue':item['key']},
        {'columnId':CLS['Action ID'],'objectValue':action_text[:500]},
        {'columnId':CLS['Status'],'objectValue':'Not Started'},
        {'columnId':CLS['Owner'],'objectValue':item['owner']},
        {'columnId':CLS['Source'],'objectValue':item['source']},
        {'columnId':CLS['Project'],'objectValue':item['project']},
        {'columnId':CLS['Category'],'objectValue':item['cat']},
    ]
    payload=json.dumps({'cells':cells,'toBottom':True}).encode('utf-8')
    req=urllib.request.Request(f'https://api.smartsheet.com/2.0/sheets/{S_SID}/rows',data=payload,headers={'Authorization':ah,'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req,context=ctx,timeout=15) as resp: json.load(resp)
        added+=1
        existing_keys.add(item['key'])
        print(f"OK [{added}] Project={item['project']:10s} Cat={item['cat'][:20]:20s} key={item['key']} {item['txt'][:50]}...")
    except urllib.error.HTTPError as e:
        detail=e.read().decode('utf-8')[:200]
        print(f"FAIL: {detail[:80]} - {item['txt'][:40]}")
    time.sleep(0.3)
print(f"\nDone: {added}/{len(new_items)} added. Unknown project count: {unset_project}")