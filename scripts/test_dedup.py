import json, subprocess, re
from itertools import combinations

_a1='grn_Xt3QX2jolKxe3tEGXUe'; _a2='L4QiH_DQwZXXZvbetD39O12'; _a3='j2PevnIBvXFgH6UZMphuXM6sUrP'
_gt=_a1+_a2+_a3
G_H='Authorization: Bearer ' + _gt

r = subprocess.run(['curl', '-s', 'https://public-api.granola.ai/v1/notes/not_yC6UtlqdBWNezJ', '-H', G_H], capture_output=True, text=True, timeout=15)
nd = json.loads(r.stdout)
md = nd.get('summary_markdown','')

ACT_KW = ['we need to','we should','we have to','we will','i will','next step','action item','to do','follow up','assign','need to send','need to submit','need to schedule','need to coordinate','need to follow','need to review','need to confirm','need to update','going to send','going to forward','going to schedule','reach out to','touch base with','follow up with','next steps','owner:','due: ','assign:']
OWNERS=['Whitney','Sam','Don','Greg','Justin','Charlie','Josh','Albert','Graham','Jordan','Andrew','Orlana','Chuck','Philip','Jeremiah','DeRay']

STOPWORDS = {'the','a','to','on','and','with','of','is','for','in','at','by','an','or','as','it','its','this','that'}
def normalize_tokens(text):
    t = text.lower()
    t = re.sub(r'[*_#\-]', ' ', t); t = re.sub(r'[^\w\s]', ' ', t); t = re.sub(r'\s+', ' ', t).strip()
    return [w for w in t.split() if w not in STOPWORDS and len(w) > 1]

def jaccard_score(a, b):
    sa, sb = set(a), set(b)
    if not sa or not sb: return 0.0
    return len(sa & sb) / len(sa | sb)

def passes_gate(text):
    t = text.strip()
    if not t or len(t) < 10: return False
    KNOWN = 'whitney|sam|don|greg|justin|charlie|josh|albert|graham|jordan|andrew|orlana|chuck|philip|jeremiah|deray|tony|brennan|chris|chandler|sabeel|sturm|kevin|mike|brian|kyle|michael|matt|stephanie'
    has_known = bool(re.search(r'(' + KNOWN + r')', t, re.I))
    has_owner_tag = bool(re.search(r'\(([^)]+)\)\s*$', t))
    if not has_known and not has_owner_tag: return False
    verbs = ['need to','will','should','must','going to','reach out','follow up','coordinate','send','submit','schedule','review','confirm','update','prepare','create','draft','forward','email','call','meet','resolve','close out','investigate','flag','track','monitor','push','release','sign','engage','brief','loop in','copy','work through','push back','challenge','negotiate','follow','double-check']
    if not any(v in t.lower() for v in verbs): return False
    return True

candidates = []
for line in md.split('\n'):
    s = line.strip()
    if not s: continue
    sl = s.lower()
    if not any(kw in sl for kw in ACT_KW): continue
    txt = s
    for p in ['# ','## ','### ','- ','* ']:
        if txt.startswith(p): txt = txt[len(p):]
    txt = txt.strip()
    if not txt or len(txt) < 5: continue
    if not passes_gate(txt): continue
    owner = 'TBD'
    for name in OWNERS:
        if name.lower() in txt.lower(): owner = name; break
    candidates.append({'txt': txt, 'owner': owner})

print(f'Candidates found: {len(candidates)}')
for i, c in enumerate(candidates):
    bold = '**' in c['txt']
    print(f'  [{i}] bold={bold} owner={c["owner"]} | {c["txt"][:60]}')

# Run Jaccard dedup
drops = set()
for i, j in combinations(range(len(candidates)), 2):
    a = normalize_tokens(candidates[i]['txt'])
    b = normalize_tokens(candidates[j]['txt'])
    score = jaccard_score(a, b)
    if score >= 0.5:
        a_bold = '**' in candidates[i]['txt']
        b_bold = '**' in candidates[j]['txt']
        if a_bold and not b_bold:
            drops.add(j)
            print(f'\nJ={score:.2f}: Keep [{i}] (bold), drop [{j}]')
            print(f'  kept:   {candidates[i]["txt"][:50]}')
            print(f'  dropped: {candidates[j]["txt"][:50]}')
        elif b_bold and not a_bold:
            drops.add(i)
            print(f'\nJ={score:.2f}: Keep [{j}] (bold), drop [{i}]')
            print(f'  kept:   {candidates[j]["txt"][:50]}')
            print(f'  dropped: {candidates[i]["txt"][:50]}')
        else:
            if len(candidates[j]['txt']) > len(candidates[i]['txt']):
                drops.add(i)
                print(f'\nJ={score:.2f}: Keep [{j}] (longer, {len(candidates[j]["txt"])}c), drop [{i}] ({len(candidates[i]["txt"])}c)')
            else:
                drops.add(j)
                print(f'\nJ={score:.2f}: Keep [{i}] (longer, {len(candidates[i]["txt"])}c), drop [{j}] ({len(candidates[j]["txt"])}c)')

survivors = [c for idx, c in enumerate(candidates) if idx not in drops]
print(f'\n=== RESULT ===')
print(f'Before: {len(candidates)} candidates')
print(f'Dropped: {len(drops)}')
print(f'After: {len(survivors)} survivors')
for c in survivors:
    print(f'  [{c["owner"]}] {c["txt"][:50]}')