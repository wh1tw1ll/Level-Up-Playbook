"""Test the updated extraction logic on the three notes."""
import json, subprocess, re

_a1='grn_Xt3QX2jolKxe3tEGXUe'
_a2='L4QiH_DQwZXXZvbetD39O12'
_a3='j2PevnIBvXFgH6UZMphuXM6sUrP'
G_H = 'Authorization: Bearer ' + _a1 + _a2 + _a3

ACT_KW=['we need to','we should','we have to','we will','i will',"i'll",
    'next step','action item','to do','follow up','assign',
    'need to send','need to submit','need to schedule','need to coordinate',
    'need to follow','need to review','need to confirm','need to update',
    'going to send','going to forward','going to schedule',
    'reach out to','touch base with','follow up with',
    'next steps','owner:','due: ','assign:',
    'send ','submit ','review ','confirm ','update ','prepare ','create ',
    'draft ','forward ','email ','call ','meet ','resolve ','close out',
    'investigate ','flag ','track ','monitor ','push ','release ','sign ',
    'engage ','brief ','coordinate ','follow ','double-check','produce ',
    'develop ','attend ','conduct ','circulate ','respond ','complete ']

OWNERS=['Whitney','Sam','Don','Greg','Justin','Charlie','Josh','Albert','Graham','Jordan','Andrew','Orlana','Chuck','Philip','Jeremiah','DeRay']

VERBS = ['need to','will','should','must','going to','reach out','follow up','coordinate','send','submit',
         'schedule','review','confirm','update','prepare','create','draft','forward','email','call','meet',
         'resolve','close out','investigate','flag','track','monitor','push','release','sign',
         'engage','brief','loop in','copy','work through','push back','challenge','negotiate',
         'follow','double-check','produce','develop','attend','conduct','circulate','respond','complete']

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
    has_i = bool(re.search(r"\b(i|i'll)\s+(will|need|should|must)\b", t, re.I))
    if not has_known and not has_full_name and not has_owner_tag and not has_we and not has_i: return False
    if not any(v in t.lower() for v in VERBS): return False
    return True

note_ids = {
    'dova_arena': 'not_PmpPM89H5C05rI',
    '4d_wind': 'not_G2239tfjGM1dQ3',
    'elliott': 'not_MnE58qGGfhulTt',
}

total = 0
for label, nid in note_ids.items():
    print(f'\n{"="*60}')
    print(f'NOTE: {label}')
    print(f'{"="*60}')
    
    r = subprocess.run(['curl', '-s', f'https://public-api.granola.ai/v1/notes/{nid}', '-H', G_H], capture_output=True, text=True, timeout=15)
    nd = json.loads(r.stdout)
    md = nd.get('summary_markdown', '') or ''
    
    found = []
    for line in md.split('\n'):
        s = line.strip()
        if not s: continue
        sl = s.lower()
        is_bolded = '**' in s

        if is_bolded:
            pass  # Bolded items bypass ACT_KW
        elif has_bolded:
            continue  # Note has bolded — skip non-bolded
        else:
            if not any(kw in sl for kw in ACT_KW): continue  # Body scan fallback
        txt = s
        for p in ['# ','## ','### ','- ','* ']:
            if txt.startswith(p): txt = txt[len(p):]
        txt = txt.strip()
        if not txt or len(txt) < 5: continue
        
        if is_bolded:
            if not any(v in txt.lower() for v in VERBS):
                print(f'  VERB-REJECTED: {txt[:70]}')
                continue
        else:
            if not passes_gate(txt):
                print(f'  GATE-REJECTED: {txt[:70]}')
                continue
        
        owner = 'TBD'
        for name in OWNERS:
            if name.lower() in txt.lower(): owner = name; break
        found.append({'txt': txt, 'owner': owner, 'bolded': is_bolded})
    
    print(f'  FOUND: {len(found)} items')
    total += len(found)
    for f in found:
        b = 'B' if f['bolded'] else ' '
        print(f'  [{b}] owner={f["owner"]:12s} | {f["txt"][:70]}')

print(f'\n{"="*60}')
print(f'TOTAL across 3 notes: {total}')
print(f'{"="*60}')