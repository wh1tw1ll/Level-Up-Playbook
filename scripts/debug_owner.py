"""Debug owner column update - check error response."""
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
OCOL = 9000587252502404

# Get sheet info - verify column
req = urllib.request.Request(f'https://api.smartsheet.com/2.0/sheets/{SID}', headers=H)
sheet = json.loads(urllib.request.urlopen(req, timeout=30).read())

for c in sheet.get('columns', []):
    if c['id'] == OCOL:
        print(f'Owner column found: id={c["id"]} title="{c["title"]}" type={c["type"]} options={c.get("options", "none")}')
        break

# Try a single row update to see error
# First find a row with blank owner
rows = sheet.get('rows', [])
for r in rows:
    owner_val = ''
    for c in r.get('cells', []):
        if c.get('columnId') == OCOL:
            owner_val = str(c.get('displayValue') or c.get('value') or '')
            break
    if not owner_val:
        row_id = r['id']
        print(f'Testing row {row_id} (blank owner)')
        
        # Try PUT
        body = json.dumps([{
            'id': row_id,
            'cells': [{'columnId': OCOL, 'value': 'TestOwner'}]
        }]).encode()
        
        print(f'PUT body: {body.decode()}')
        
        req2 = urllib.request.Request(f'https://api.smartsheet.com/2.0/sheets/{SID}/rows',
            data=body, headers=H, method='PUT')
        try:
            res = json.loads(urllib.request.urlopen(req2, timeout=30).read())
            print(f'Response: {json.dumps(res, indent=2)[:500]}')
        except urllib.error.HTTPError as e:
            err_body = e.read().decode()
            print(f'Error {e.code}: {err_body[:500]}')
        break