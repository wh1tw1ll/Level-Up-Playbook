"""Find and delete duplicates from Smartsheet."""
import json, urllib.request, sys, os, re
from collections import defaultdict

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
ACOL = 6748787438817156
STCOL = 2258381950979972

req = urllib.request.Request(f'https://api.smartsheet.com/2.0/sheets/{SID}', headers=H)
sheet = json.loads(urllib.request.urlopen(req, timeout=30).read())
rows = sheet.get('rows', [])

# Group by normalized action text
groups = defaultdict(list)
for r in rows:
    action = ''
    status = ''
    for c in r.get('cells', []):
        cid = c.get('columnId')
        v = str(c.get('displayValue') or c.get('value') or '')
        if cid == ACOL:
            action = v
        elif cid == STCOL:
            status = v
    key = action.lower().replace('**', '').strip()[:60]
    if key:
        groups[key].append((r['id'], action, status))

to_delete = []
for key, items in groups.items():
    if len(items) > 1:
        scored = []
        for rid, action, status in items:
            blank_count = 0
            for c in rows:
                if c.get('id') == rid:
                    for cell in c.get('cells', []):
                        if not cell.get('displayValue') and not cell.get('value'):
                            blank_count += 1
                    break
            status_val = 0 if status in ('Not Started', 'In Progress') else 1 if not status else 2
            scored.append((status_val, blank_count, rid))
        scored.sort()
        for item in scored[1:]:
            to_delete.append(item[2])

print(f'Duplicates found: {len(to_delete)}')
if to_delete:
    # Smartsheet DELETE endpoint: DELETE /sheets/{sheetId}/rows?ids=id1,id2,id3
    for i in range(0, len(to_delete), 200):
        batch = to_delete[i:i+200]
        ids = ','.join(str(x) for x in batch)
        url = f'https://api.smartsheet.com/2.0/sheets/{SID}/rows?ids={ids}'
        r2 = urllib.request.Request(url, headers=H, method='DELETE')
        try:
            res = json.loads(urllib.request.urlopen(r2, timeout=30).read())
            print(f'  Batch {i//200+1} ({len(batch)} rows): {res.get("message","OK")}')
        except urllib.error.HTTPError as e:
            err = e.read().decode()
            print(f'  Batch {i//200+1} ERROR {e.code}: {err[:200]}')
        except Exception as e:
            print(f'  Batch {i//200+1} ERROR: {e}')

print(f'\nDeleted {len(to_delete)} duplicates.')