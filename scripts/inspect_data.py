"""Inspect data patterns in the Smartsheet action tracker."""
import json, urllib.request, sys, os

# Read token from env files
def get_token():
    for env_name in ('.env.local', '.env.development', '.env'):
        env_path = os.path.join(os.path.dirname(__file__), '..', env_name)
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if line.startswith('SMARTSHEET_TOKEN'):
                        parts = line.split('=', 1)
                        if len(parts) == 2:
                            val = parts[1].strip().strip("'").strip('"')
                            if val and val != '[SENSITIVE]':
                                return val
    return os.environ.get('SMARTSHEET_TOKEN', '')

TOKEN = get_token()
if not TOKEN:
    print('ERROR: no SMARTSHEET_TOKEN')
    sys.exit(1)

H = {'Authorization': f'Bearer {TOKEN}', 'Content-Type': 'application/json'}
SID = '4456864287772548'

req = urllib.request.Request(f'https://api.smartsheet.com/2.0/sheets/{SID}', headers=H)
sheet = json.loads(urllib.request.urlopen(req).read())

print("=== COLUMNS ===")
col_ids = {}
for col in sheet.get('columns', []):
    print(f'  {col["id"]}: "{col["title"]}"')
    col_ids[col['title']] = col['id']

rows = sheet.get('rows', [])
print(f'\n=== TOTAL ROWS: {len(rows)} ===')

ACTION_COL = col_ids.get('Action ID', 6748787438817156)
OWNER_COL = col_ids.get('Owner', 0)
SOURCE_COL = col_ids.get('Source', 0)

# Print sample action items with all patterns
count = 0
open_not_started = [r for r in rows if any(c.get('columnId') == col_ids.get('Status', 0) and c.get('value') in ('Not Started', 'In Progress', None) for c in r.get('cells', []))]
print(f'\nOpen/Not Started rows: {len(open_not_started)}')

for r in open_not_started[:20]:
    action = owner = source = status = ''
    for c in r.get('cells', []):
        cid = c.get('columnId')
        val = c.get('displayValue') or c.get('value') or ''
        if cid == ACTION_COL:
            action = val
        elif cid == OWNER_COL:
            owner = val
        elif cid == SOURCE_COL:
            source = val
    if action:
        print(f'\n  [{source}] Owner="{owner}"')
        print(f'  Action: {action[:200]}')