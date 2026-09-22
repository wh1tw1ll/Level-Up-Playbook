"""Fix old rows with [Granola: ...] prefix in action items."""
import json, urllib.request, sys, os

TOKEN = ''
for env_name in ('.env.local', '.env.development', '.env'):
    env_path = os.path.join(os.path.dirname(__file__), '..', env_name)
    if os.path.exists(env_path):
        try:
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if line.startswith('SMARTSHEET_TOKEN'):
                        parts = line.split('=', 1)
                        if len(parts) == 2:
                            TOKEN = parts[1].strip().strip('\'"').strip('"\'')
                            if TOKEN:
                                break
        except:
            pass
    if TOKEN:
        break

if not TOKEN:
    TOKEN = os.environ.get('SMARTSHEET_TOKEN', '')

if not TOKEN:
    print('ERROR: no SMARTSHEET_TOKEN')
    sys.exit(1)

SID = '4456864287772548'
ACOL = 6748787438817156
H = {'Authorization': f'Bearer {TOKEN}', 'Content-Type': 'application/json'}
url = f'https://api.smartsheet.com/2.0/sheets/{SID}'

sheet = json.loads(urllib.request.urlopen(urllib.request.Request(url, headers=H)).read())
rows = sheet.get('rows', [])
print(f'Total rows: {len(rows)}')

fix = []
for r in rows:
    for c in r.get('cells', []):
        if c.get('columnId') == ACOL:
            v = str(c.get('displayValue') or c.get('value') or '')
            if v.startswith('[Granola:'):
                e = v.find(']')
                if 0 < e < len(v) - 1:
                    fix.append((r['id'], v, v[e+1:].strip()))
            break

print(f'Rows with prefix: {len(fix)}')
if not fix:
    print('Done. Nothing to fix.')
    sys.exit(0)

for i in range(0, len(fix), 200):
    b = fix[i:i+200]
    data = json.dumps([{'id': rid, 'cells': [{'columnId': ACOL, 'value': n}]} for rid, _, n in b]).encode()
    r2 = urllib.request.Request(f'https://api.smartsheet.com/2.0/sheets/{SID}/rows', data=data, headers=H, method='PUT')
    res = json.loads(urllib.request.urlopen(r2).read())
    print(f'  Batch {i//200+1}: {len(b)} rows - {res.get("message", "OK")}')

print(f'\nFixed {len(fix)} rows.')