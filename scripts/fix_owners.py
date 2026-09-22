"""Fix blank owner rows using text analysis."""
import json, urllib.request, sys, os, re

def get_token():
    for fname in ('.env.local', '.env.development', '.env'):
        p = os.path.join(os.path.dirname(__file__), '..', fname)
        if os.path.exists(p):
            with open(p) as f:
                for ln in f:
                    ln = ln.strip()
                    if ln.startswith('SMARTSHEET_TOKEN'):
                        v = ln.split('=', 1)[1].strip().strip("'").strip('"')
                        if v and v != '[SENSITIVE]':
                            return v
    return os.environ.get('SMARTSHEET_TOKEN', '')

TOKEN = get_token()
if not TOKEN:
    print('NO TOKEN'); sys.exit(1)

H = {'Authorization': f'Bearer {TOKEN}', 'Content-Type': 'application/json'}
SID = '4456864287772548'
ACOL=6748787438817156
OCOL=9000587252502404

OWNER_NAMES = ['Whitney','Sam','Don','Greg','Justin','Charlie','Josh','Albert','Graham','Jordan','Andrew','Orlana','Chuck','Philip','Jeremiah','DeRay','Matt','Brian','Mike','Todd','Joseph','Chris','David','Phil']

req = urllib.request.Request(f'https://api.smartsheet.com/2.0/sheets/{SID}', headers=H)
sheet = json.loads(urllib.request.urlopen(req, timeout=30).read())
rows = sheet.get('rows', [])

cells_map = {}
for r in rows:
    d = {}
    for c in r.get('cells', []):
        d[c.get('columnId')] = str(c.get('displayValue') or c.get('value') or '')
    cells_map[r['id']] = d

to_set = []
for rid, cells in cells_map.items():
    if cells.get(OCOL, ''):
        continue
    txt = cells.get(ACOL, '').replace('**', '').strip()
    if not txt:
        continue
    found = ''
    # Check trailing (Name or Name, Name2)
    m = re.search(r'\(([^)]+)\)\s*$', txt)
    if m:
        inside = m.group(1)
        for nm in sorted(OWNER_NAMES, key=len, reverse=True):
            if nm.lower() in inside.lower():
                found = nm
                break
    # Check start of text "Name to ..." or "Name/..."
    if not found:
        tl = txt.lower()
        for nm in sorted(OWNER_NAMES, key=len, reverse=True):
            nml = nm.lower()
            if tl.startswith(nml + ' ') or tl.startswith(nml + '/'):
                found = nm
                break
    if found:
        to_set.append({'id': rid, 'owner': found})

print(f'Found {len(to_set)} blank owners to fill')

for i in range(0, len(to_set), 200):
    batch = to_set[i:i+200]
    body = json.dumps([{'id': x['id'], 'cells': [{'columnId': OCOL, 'objectValue': x['owner']}]} for x in batch]).encode()
    r2 = urllib.request.Request(f'https://api.smartsheet.com/2.0/sheets/{SID}/rows', data=body, headers=H, method='PUT')
    res = json.loads(urllib.request.urlopen(r2, timeout=30).read())
    print(f'  Batch {i//200+1}: {len(batch)} - {res.get("message","OK")}')

# Verify
req3 = urllib.request.Request(f'https://api.smartsheet.com/2.0/sheets/{SID}', headers=H)
sheet3 = json.loads(urllib.request.urlopen(req3, timeout=30).read())
blanks = sum(1 for r in sheet3.get('rows', []) for c in r.get('cells', []) if c.get('columnId') == OCOL and not c.get('displayValue') and not c.get('value'))
print(f'\nBlanks remaining: {blanks}')