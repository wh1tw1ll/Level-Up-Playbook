#!/usr/bin/env python3
"""Push extracted Granola action items to Smartsheet with idempotency key + acceptance gate.
Replaces granola_push_v3.py. Called by cron or manually."""
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
}
ctx=ssl.create_default_context()
ah="Bearer "+S_TK

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
             'engage','brief','loop in','copy','work through','push back','challenge','negotiate','follow','double-check']
    if not any(v in t.lower() for v in verbs): return False
    return True

# ── SourceKey ──
def compute_source_key(note_id, text):
    raw = text.strip().lower()
    raw = re.sub(r'\s+', ' ', raw)
    raw = re.sub(r'[^\w\s]', '', raw)
    raw = re.sub(r'\s*\([^)]*\)\s*$', '', raw).strip()
    return hashlib.sha256((note_id + '::' + raw).encode()).hexdigest()[:16]

# ── Main ──
print("=== GRANOLA EXTRACTION v4 (idempotent) ===")
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
cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).strftime('%Y-%m-%d')
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

total=0; gated=0; new_items=[]; updates=[]
for n in notes:
    title=n.get('title',''); nid=n['id']; ndate=n.get('created_at','')[:10]
    r=subprocess.run(['curl','-s',f'https://public-api.granola.ai/v1/notes/{nid}','-H',G_H],capture_output=True,text=True,timeout=15)
    nd=json.loads(r.stdout)
    md=nd.get('summary_markdown','') or ''
    t=title.lower()
    if 'dova' in t or 'kozpure' in t or 'permits' in t or 'entitlement' in t or 'sd phase' in t: cat='Entitlements'
    elif 'sph' in t or 'sports' in t or 'performance' in t: cat='General Coordination'
    elif 'mfp' in t or 'miami' in t or 'closeout' in t or 'sub closeout' in t or 'stadium' in t: cat='MFP - Closeout & Invoicing'
    else: cat='General Coordination'
    for line in md.split('\n'):
        s=line.strip()
        if not s: continue
        sl=s.lower()
        if not any(kw in sl for kw in ACT_KW): continue
        txt=s
        for p in ['# ','## ','### ','- ','* ']:
            if txt.startswith(p): txt=txt[len(p):]
        txt=txt.strip()
        if not txt or len(txt)<5: continue
        total+=1
        if not passes_gate(txt): gated+=1; continue
        owner='TBD'
        for name in OWNERS:
            if name.lower() in txt.lower(): owner=name; break
        key=compute_source_key(nid, txt)
        if key in existing_keys: updates.append((key,txt[:60])); continue
        new_items.append({'txt':txt[:200],'owner':owner,'note':f'{title} ({ndate})','cat':cat,'key':key})

print(f"\nCandidates: {total} | Gated: {gated} | New: {len(new_items)} | Updates: {len(updates)}")
added=0
for item in new_items:
    action_text=f'[Granola: {item["note"]}] {item["txt"]}'
    cells=[
        {'columnId':CLS['ExtractionId'],'objectValue':item['key']},
        {'columnId':CLS['Action ID'],'objectValue':action_text[:500]},
        {'columnId':CLS['Status'],'objectValue':'Not Started'},
        {'columnId':CLS['Owner'],'objectValue':item['owner']},
    ]
    payload=json.dumps({'cells':cells,'toBottom':True}).encode('utf-8')
    req=urllib.request.Request(f'https://api.smartsheet.com/2.0/sheets/{S_SID}/rows',data=payload,headers={'Authorization':ah,'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req,context=ctx,timeout=15) as resp: json.load(resp)
        added+=1
        print(f"OK [{added}] [{item['cat']}] key={item['key']} {item['txt'][:60]}...")
    except urllib.error.HTTPError as e:
        detail=e.read().decode('utf-8')[:200]
        print(f"FAIL: {detail[:80]} - {item['txt'][:40]}")
    time.sleep(0.3)
print(f"\nDone: {added}/{len(new_items)} added")