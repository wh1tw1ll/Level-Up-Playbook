"""Audit existing Smartsheet data for cleanup needs."""
import json, urllib.request, sys, os, re

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
rows = sheet.get('rows', [])

# Map columns
col_ids = {}
for c in sheet.get('columns', []):
    col_ids[c['title']] = c['id']

AC = col_ids.get('Action ID')
OC = col_ids.get('Owner')
CC = col_ids.get('Category')
DC = col_ids.get('Discipline')
RC = col_ids.get('Responsible Firm(s)')
SC = col_ids.get('Source')
PC = col_ids.get('Project')
STC = col_ids.get('Status')
SNC = col_ids.get('Status Note')

star = 0
paren_name = 0
date = 0
blank_owner = 0
blank_cat = 0
blank_disc = 0
blank_firm = 0
total = len(rows)

# Also check duplicates by extraction key
from collections import Counter
keys = []

print(f'Total rows: {total}')
print()

for r in rows:
    action = owner = cat = disc = firm = source = project = status = ''
    row_id = r['id']
    
    for c in r.get('cells', []):
        cid = c.get('columnId')
        v = str(c.get('displayValue') or c.get('value') or '')
        if cid == AC:
            action = v
        elif cid == OC:
            owner = v
        elif cid == CC:
            cat = v
        elif cid == DC:
            disc = v
        elif cid == RC:
            firm = v
        elif cid == SC:
            source = v
        elif cid == PC:
            project = v
        elif cid == STC:
            status = v
        elif cid == SNC:
            sn = v
    
    if '**' in action:
        star += 1
    
    # Check for trailing (name) patterns
    action_trimmed = action.strip()
    if action_trimmed.endswith(')') and '(' in action_trimmed:
        # Check if last parenthetical is a person name or date
        last_open = action_trimmed.rfind('(')
        last_close = action_trimmed.rfind(')')
        if last_open < last_close:
            inside = action_trimmed[last_open+1:last_close]
            # Check if it's a name or date
            if any(name.lower() in inside.lower() for name in ['Whitney', 'Sam', 'Don', 'Greg', 'Justin', 'Charlie', 'Josh', 'Albert', 'Graham', 'Jordan', 'Andrew', 'Orlana', 'Chuck', 'Philip', 'Jeremiah', 'DeRay', 'Matt', 'Brian', 'Mike', 'TBD', 'Todd', 'Joseph', 'Chris', 'David', 'Phil', 'Tiwana', 'Kalscheur', 'Wieting', 'Giordano', 'Oxley', 'Gibson', 'Caravello', 'LaBrie', 'Osantowski', 'Stricker', 'Lawdensky', 'Pike', 'LaMartic', 'Delgado', 'Steiner', 'Atlantic', 'Cuneo', 'KozPure', 'Level Up']):
                paren_name += 1
    
    # Check for dates
    dates_found = re.findall(r'\b(202[4-9]|20[3-9]\d|\d{4}-\d{2}-\d{2})\b', action)
    if dates_found:
        date += 1
    
    if not owner:
        blank_owner += 1
    if not cat:
        blank_cat += 1
    if not disc:
        blank_disc += 1
    if not firm:
        blank_firm += 1

print(f'Rows with **stars**:          {star}')
print(f'Rows with trailing (name):    {paren_name}')
print(f'Rows with dates in text:      {date}')
print(f'Blank Owner:                  {blank_owner}')
print(f'Blank Category:               {blank_cat}')
print(f'Blank Discipline:             {blank_disc}')
print(f'Blank Responsible Firm:       {blank_firm}')
open_count = len([r for r in rows if any(c.get('columnId')==STC and c.get('value') in ('Not Started','In Progress',None) for c in r.get('cells',[]))])
print(f'Open (Not Started) rows:      {open_count}')

# Show sample of problematic rows
print('\n--- SAMPLE ROWS WITH ** ---')
count = 0
for r in rows:
    action = ''
    for c in r.get('cells', []):
        if c.get('columnId') == AC:
            action = str(c.get('displayValue') or c.get('value') or '')
            break
    if '**' in action and count < 10:
        print(f'  {action[:150]}')
        count += 1

print('\n--- SAMPLE ROWS WITH TRAILING (OWNER) ---')
count = 0
for r in rows:
    action = ''
    for c in r.get('cells', []):
        if c.get('columnId') == AC:
            action = str(c.get('displayValue') or c.get('value') or '')
            break
    action = action.strip()
    if action.endswith(')') and '(' in action and count < 10:
        print(f'  {action[:150]}')
        count += 1

print('\n--- SAMPLE DUPLICATES (same action text) ---')
from collections import Counter
action_counts = Counter()
for r in rows:
    action = ''
    for c in r.get('cells', []):
        if c.get('columnId') == AC:
            action = str(c.get('displayValue') or c.get('value') or '')
            break
    if action:
        action_counts[action[:80]] += 1
dupes = [(t, c) for t, c in action_counts.items() if c > 1]
for text, count in dupes[:10]:
    print(f'  ({count}x) {text[:100]}')