"""Diagnostic: run v5 candidate detection across all 14 notes, per-note."""
import json, subprocess, re
from datetime import datetime, timezone, timedelta

_a1='grn_Xt3QX2jolKxe3tEGXUe'
_a2='L4QiH_DQwZXXZvbetD39O12'
_a3='j2PevnIBvXFgH6UZMphuXM6sUrP'
_gt=_a1+_a2+_a3
G_H='Authorization: Bearer ' + _a1 + _a2 + _a3

ACT_KW=['we need to','we should','we have to','we will','i will',"i'll",
    'next step','action item','to do','follow up','assign',
    'need to send','need to submit','need to schedule','need to coordinate',
    'need to follow','need to review','need to confirm','need to update',
    'going to send','going to forward','going to schedule',
    'reach out to','touch base with','follow up with',
    'next steps','owner:','due: ']
OWNERS=['Whitney','Sam','Don','Greg','Justin','Charlie','Josh','Albert','Graham','Jordan','Andrew','Orlana','Chuck','Philip','Jeremiah','DeRay']

VERBS=['need to','will','should','must','going to','reach out','follow up','coordinate','send','submit',
       'schedule','review','confirm','update','prepare','create','draft','forward','email','call','meet',
       'resolve','close out','investigate','flag','track','monitor','push','release','sign',
       'engage','brief','loop in','copy','work through','push back','challenge','negotiate',
       'follow','double-check','produce','develop','attend','conduct','circulate','respond','complete']

def passes_gate(t):
    if not t or len(t) < 10: return False
    for p in [r'^next steps',r'^action items',r'^sharing and next steps',r'^ongoing',r'^key takeaways',r'^discussion',r'^agenda',r'^design review process']:
        if re.match(p, t, re.I): return False
    KNOWN='whitney|sam|don|greg|justin|charlie|josh|albert|graham|jordan|andrew|orlana|chuck|philip|jeremiah|deray|tony|brennan|chris|chandler|sabeel|sturm|kevin|mike|brian|kyle|michael|matt|stephanie'
    has_known=bool(re.search(r'('+KNOWN+')',t,re.I))
    has_fn=bool(re.search(r'\b[A-Z][a-z]+ [A-Z][a-z]+ (will |should |must |to |is going to|needs to)',t))
    has_ot=bool(re.search(r'\(([^)]+)\)\s*$',t))
    has_w=bool(re.search(r'\b(we|team|group)\s+(need|should|will|must)\b',t,re.I))
    has_i=bool(re.search(r"\b(i|i'll)\s+(will|need|should|must)\b",t,re.I))
    if not has_known and not has_fn and not has_ot and not has_w and not has_i: return False
    if not any(v in t.lower() for v in VERBS): return False
    return True

notes=[];cursor=None
cutoff=(datetime.now(timezone.utc)-timedelta(days=7)).strftime('%Y-%m-%d')
while True:
    u='https://public-api.granola.ai/v1/notes?page_size=30&created_after='+cutoff
    if cursor: u+='&cursor='+cursor
    r=subprocess.run(['curl','-s',u,'-H',G_H],capture_output=True,text=True,timeout=15)
    d=json.loads(r.stdout)
    if 'code' in d: break
    notes.extend(d.get('notes',[]))
    if not d.get('hasMore'): break
    cursor=d.get('cursor')

print(f'Granola notes: {len(notes)}')
print()

total=0; gated=0; total_new=0

for n in notes:
    title=n.get('title','') or ''
    nid=n.get('id','')
    ndate=(n.get('created_at') or '')[:10]
    r=subprocess.run(['curl','-s',f'https://public-api.granola.ai/v1/notes/{nid}','-H',G_H],capture_output=True,text=True,timeout=15)
    nd=json.loads(r.stdout)
    md=nd.get('summary_markdown','') or ''
    
    has_bolded='**' in md
    found=[]
    
    for line in md.split('\n'):
        s=line.strip()
        if not s: continue
        sl=s.lower()
        is_bolded='**' in s
        if is_bolded:
            pass
        elif has_bolded:
            continue
        else:
            if not any(kw in sl for kw in ACT_KW): continue
        txt=s
        for p in ['# ','## ','### ','- ','* ']:
            if txt.startswith(p): txt=txt[len(p):]
        txt=txt.strip()
        if not txt or len(txt)<5: continue
        total+=1
        if is_bolded:
            if not any(v in txt.lower() for v in VERBS):
                gated+=1; continue
        else:
            if not passes_gate(txt):
                gated+=1; continue
        owner='TBD'
        for name in OWNERS:
            if name.lower() in txt.lower(): owner=name; break
        found.append({'txt':txt[:70],'owner':owner,'b':is_bolded})
    
    b_label='B' if has_bolded else '-'
    print(f'{b_label} {title[:50]:50s} | {len(found):2d} items')
    for f in found:
        m='B' if f['b'] else ' '
        print(f'    [{m}] owner={f["owner"]:12s}  {f["txt"][:55]}')
    total_new+=len(found)

print()
print(f'Total across {len(notes)} notes: {total_new} new candidates + {gated} gated = {total} total')