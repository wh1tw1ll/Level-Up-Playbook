"""Check all column types for correct API usage."""
import json, urllib.request, os

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

TOKEN=*** not TOKEN:
    print('NO TOKEN'); exit()

H = {'Authorization': f'Bearer {TOKEN}'}
req = urllib.request.Request(f'https://api.smartsheet.com/2.0/sheets/4456864287772548', headers=H)
sheet = json.loads(urllib.request.urlopen(req, timeout=30).read())
for c in sheet.get('columns', []):
    print(f'{c["id"]}: "{c["title"]}" type={c["type"]}')