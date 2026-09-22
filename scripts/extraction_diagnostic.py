#!/usr/bin/env python3
"""Diagnostic: full extraction trace for v5 run.
Pastes every candidate with its rejection reason."""

import json, subprocess, urllib.request, ssl, re, hashlib
from datetime import datetime, timezone, timedelta

# --- Granola ---
_a1='grn_Xt3QX2jolKxe3tEGXUe'; _a2='L4QiH_DQwZXXZvbetD39O12'; _a3='j2PevnIBvXFgH6UZMphuXM6sUrP'
_gt=_a1+_a2+_a3
G_H='Authorization: Bearer ' + _gt

# --- Smartsheet ---
S_TK="ChRJVBkqJEaha5mLiDYGn3WCzE79I9yNkmEID"
S_SID="4456864287772548"
ah="Bearer "+S_TK
ctx=ssl.create_default_context()
CLS={
    "ExtractionId": 1375775527571332,
    "Status": 2258381950979972,
    "Action ID": 6748787438817156,
    "Owner": 9000587252502404,
    "Source": 2297540940435332,
    "Project": 6920668081590148,
    "Category": 146108531380100,
}

# ── Acceptance Gate with specific reason ──
def passes_gate_detailed(text):
    t = text.strip()
    if not t or len(t) < 10:
        return (False, 'too short (< 10 chars)')
    strict_noise = [
        (r'^next steps\b', 'header: Next Steps'),
        (r'^action items?\b', 'header: Action Items'),
        (r'^sharing and next steps\b', 'header: Sharing and Next Steps'),
        (r'^ongoing', 'header: Ongoing'),
        (r'^key takeaways?\b', 'header: Key Takeaways'),
        (r'^discussion\b', 'header: Discussion'),
        (r'^agenda\b', 'header: Agenda'),
        (r'^design review process', 'header: Design Review Process'),
        (r'\.pdf$', 'filename: .pdf'),
        (r'\.docx?$', 'filename: .docx'),
        (r'\.xlsx?$', 'filename: .xlsx'),
        (r'^FW:', 'forwarded email header'),
        (r'^RE:', 'reply email header'),
        (r'^Fwd:', 'forwarded email header'),
        (r'^Budget', 'header: Budget'),
        (r'^Template', 'header: Template'),
    ]
    for pat, reason in strict_noise:
        if re.match(pat, t, re.IGNORECASE):
            return (False, reason)
    
    KNOWN = 'whitney|sam|don|greg|justin|charlie|josh|albert|graham|jordan|andrew|orlana|chuck|philip|jeremiah|deray|tony|brennan|chris|chandler|sabeel|sturm|kevin|mike|brian|kyle|michael|matt|stephanie'
    has_known = bool(re.search(r'(' + KNOWN + r')', t, re.I))
    has_full_name = bool(re.search(r'\b[A-Z][a-z]+ [A-Z][a-z]+ (will |should |must |to |is going to|needs to)', t))
    has_owner_tag = bool(re.search(r'\(([^)]+)\)\s*$', t))
    has_we = bool(re.search(r'\b(we|team|group)\s+(need|should|will|must)\b', t, re.I))
    has_i = bool(re.search(r'\b(i|i\'ll)\s+(will|need|should|must)\b', t, re.I))
    
    if not (has_known or has_full_name or has_owner_tag or has_we or has_i):
        reasons = []
        if not has_known and not has_full_name:
            reasons.append('no known actor name/full-name pattern')
        if not has_owner_tag:
            reasons.append('no owner tag (Name)')
        if not has_we and not has_i:
            reasons.append('no we/team/group/i commitment language')
        return (False, 'actor missing: ' + '; '.join(reasons))
    
    verbs = ['need to','will','should','must','going to','reach out','follow up','coordinate','send','submit',
             'schedule','review','confirm','update','prepare','create','draft','forward','email','call','meet',
             'resolve','close out','investigate','flag','track','monitor','push','release','sign',
             'engage','brief','loop in','copy','work through','push back','challenge','negotiate','follow','double-check']
    if not any(v in t.lower() for v in verbs):
        return (False, 'no action verb found in list')
    
    return (True, 'passed')

# ── SourceKey ──
def compute_source_key(note_id, text):
    raw = text.strip().lower()
    raw = re.sub(r'\s+', ' ', raw)
    raw = re.sub(r'[^\w\s]', '', raw)
    raw = re.sub(r'\s*\([^)]*\)\s*$', '', raw).strip()
    return hashlib.sha256((note_id + '::' + raw).encode()).hexdigest()[:16]

# ── Get existing keys + their row IDs ──
req = urllib.request.Request(f"https://api.smartsheet.com/2.0/sheets/{S_SID}", headers={"Authorization": ah})
with urllib.request.urlopen(req, context=ctx) as resp:
    ssd = json.load(resp)

existing = {}  # key -> rowId
for row in ssd.get('rows', []):
    for c in row.get('cells', []):
        if c['columnId'] == CLS["ExtractionId"]:
            v = c.get('displayValue') or c.get('value') or ''
            if v:
                existing[str(v).strip()] = row['id']

print("=" * 60)
print(f"Existing ExtractionIds in sheet: {len(existing)}")
for k, rid in sorted(existing.items()):
    print(f"  key={k}  rowId={rid}")
print()

# ── Fetch Granola notes ──
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
print()

ACT_KW=['we need to','we should','we have to','we will','i will',"i'll",
    'next step','action item','to do','follow up','assign',
    'need to send','need to submit','need to schedule','need to coordinate',
    'need to follow','need to review','need to confirm','need to update',
    'going to send','going to forward','going to schedule',
    'reach out to','touch base with','follow up with',
    'next steps','owner:','due: ','assign:']
OWNERS=['Whitney','Sam','Don','Greg','Justin','Charlie','Josh','Albert','Graham','Jordan','Andrew','Orlana','Chuck','Philip','Jeremiah','DeRay']

total=0; gate_rejected=0; key_matched=0; new_items=0

for n in notes:
    title=n.get('title',''); nid=n['id']; ndate=n.get('created_at','')[:10]
    r=subprocess.run(['curl','-s',f'https://public-api.granola.ai/v1/notes/{nid}','-H',G_H],capture_output=True,text=True,timeout=15)
    nd=json.loads(r.stdout)
    md=nd.get('summary_markdown','') or ''

    print(f"\n--- Note: {title} ({ndate}) ---")
    for line in md.split('\n'):
        s = line.strip()
        if not s: continue
        sl = s.lower()
        if not any(kw in sl for kw in ACT_KW):
            continue
        txt = s
        for p in ['# ','## ','### ','- ','* ']:
            if txt.startswith(p): txt = txt[len(p):]
        txt = txt.strip()
        if not txt or len(txt) < 5: continue
        total += 1

        result, reason = passes_gate_detailed(txt)
        if result:
            key = compute_source_key(nid, txt)
            if key in existing:
                key_matched += 1
                print(f"  KEY-MATCHED [{key}] rowId={existing[key]}  → skipped")
                print(f"    text: {txt[:90]}")
            else:
                new_items += 1
                print(f"  NEW key={key}  → would write")
                print(f"    text: {txt[:90]}")
        else:
            gate_rejected += 1
            print(f"  REJECTED [{reason}]")
            print(f"    text: {txt[:90]}")

print()
print("=" * 60)
print(f"TOTAL candidates (passed ACT_KW):   {total}")
print(f"GATE-REJECTED:                      {gate_rejected}")
print(f"KEY-MATCHED (already in sheet):     {key_matched}")
print(f"NEW (would write):                  {new_items}")
print(f"Sum check: gate+key+new = {gate_rejected + key_matched + new_items}  total = {total}")