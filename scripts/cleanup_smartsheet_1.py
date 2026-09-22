"""Stage 1-3: Clean action text, extract owners, deduplicate."""
import json, urllib.request, sys, os, re
from collections import Counter

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
ACOL = 6748787438817156
OCOL = 9000587252502404
CCOL = 146108531380100
DCOL = 5143077301555076
FCOL = 4134793731936132
KCOL = 1375775527571332  # ExtractionId

OWNERS = ['Whitney','Sam','Don','Greg','Justin','Charlie','Josh','Albert','Graham','Jordan','Andrew','Orlana','Chuck','Philip','Jeremiah','DeRay','Matt','Brian','Mike','Todd','Joseph','Chris','David','Phil','Arlene','Mina','Jeremiah','Tony']

print('Fetching sheet...')
req = urllib.request.Request(f'https://api.smartsheet.com/2.0/sheets/{SID}', headers=H)
sheet = json.loads(urllib.request.urlopen(req, timeout=30).read())
rows = sheet.get('rows', [])
print(f'Total rows: {len(rows)}')

# ─── COLLECT ALL ROW DATA ───
all_cells = {}  # row_id -> {col_id: value}
for r in rows:
    cells = {}
    for c in r.get('cells', []):
        cid = c.get('columnId')
        val = str(c.get('displayValue') or c.get('value') or '')
        cells[cid] = val
    all_cells[r['id']] = cells

# ─── STAGE 1: TEXT CLEANUP ───
print('\n=== STAGE 1: Text Cleanup ===')
clean_updates = []
for row_id, cells in all_cells.items():
    action = cells.get(ACOL, '')
    if not action:
        continue
    
    original = action
    
    # Strip ** bold markers
    action = action.replace('**', '')
    
    # Strip trailing "| From ..." pattern
    action = re.sub(r'\s*\|\s*(From|Email:).*', '', action).strip()
    
    # Strip "Granola re-extract: ..." suffix from status notes (not action text)
    # These are in Status Note, not action - but check action anyway
    action = re.sub(r'\s*Granola re-extract:.*', '', action).strip()
    
    # Strip trailing (OwnerName) - last parenthetical
    while True:
        trimmed = action.strip()
        if trimmed.endswith(')') and '(' in trimmed:
            last_open = trimmed.rfind('(')
            last_close = trimmed.rfind(')')
            if last_open < last_close:
                inside = trimmed[last_open+1:last_close]
                # Check if it contains a known owner or date
                has_owner = any(name.lower() in inside.lower() for name in OWNERS)
                has_date = bool(re.search(r'\b(202[4-9]|20[3-9]\d|\d{4}-\d{2}-\d{2})\b', inside))
                if has_owner or has_date:
                    action = trimmed[:last_open].strip()
                    continue
        break
    
    # Strip standalone date patterns (not in parentheses)
    action = re.sub(r'\s*\b202[4-9]-\d{2}-\d{2}\b\s*', ' ', action).strip()
    
    # Strip inline owner patterns like " (Whitney)" or " (Greg)" at end
    # Already handled above, but also check patterns like "- Whitney" at end
    action = re.sub(r'\s*[-–]\s*(Whitney|Sam|Don|Greg|Charlie|Josh|Albert|Graham|Jordan|Andrew|Orlana|Chuck|Philip)\s*$', '', action).strip()
    
    # Clean up multiple spaces
    action = re.sub(r'\s+', ' ', action).strip()
    
    if action != original:
        clean_updates.append({'row_id': row_id, 'old': original, 'new': action, 'col': 'action'})

print(f'Action text changes: {len(clean_updates)}')

# ─── STAGE 2: OWNER EXTRACTION ───
print('\n=== STAGE 2: Owner Extraction ===')
owner_updates = []
for row_id, cells in all_cells.items():
    action = cells.get(ACOL, '')
    current_owner = cells.get(OCOL, '')
    
    if current_owner:
        continue  # Already has owner
    
    # Check cleaned action for owner name
    # Method: scan for known owner names at end of text
    action_clean = action.replace('**', '')
    action_clean = re.sub(r'\|\s*From.*', '', action_clean).strip()
    action_clean = re.sub(r'\s*\(.*?\)\s*', ' ', action_clean).strip()
    
    owner_found = ''
    for name in sorted(OWNERS, key=len, reverse=True):  # longer names first
        name_lower = name.lower()
        action_lower = action_clean.lower()
        
        # Check if name appears at end in parentheses (already stripped in stage 1 but check original)
        # Or if action starts with the name
        if name_lower in action_lower:
            # Common patterns: "Name to do X" or "X (Name)"
            owner_found = name
            break
    
    if owner_found and current_owner != owner_found:
        owner_updates.append({'row_id': row_id, 'old_owner': current_owner, 'new_owner': owner_found})

print(f'Owner assignments: {len(owner_updates)}')

# ─── STAGE 3: DEDUPLICATION ───
print('\n=== STAGE 3: Deduplication ===')
# Group by normalized action text (first 60 chars, no stars)
action_groups = {}
for row_id, cells in all_cells.items():
    action = cells.get(ACOL, '')
    key = action.replace('**', '').strip()[:60].lower()
    status = cells.get(2258381950979972, '')  # Status column
    if key:
        if key not in action_groups:
            action_groups[key] = []
        action_groups[key].append((row_id, action, status))

# Find duplicates (same key, different row)
to_delete = []
for key, items in action_groups.items():
    if len(items) > 1:
        # Sort: prefer non-Complete, then less blank fields
        scored = []
        for row_id, action, status in items:
            cells = all_cells.get(row_id, {})
            blanks = sum(1 for v in [cells.get(OCOL,''), cells.get(CCOL,''), cells.get(DCOL,''), cells.get(FCOL,'')] if not v)
            # Prefer Not Started/In Progress over Complete
            status_score = 0 if status in ('Not Started', 'In Progress') else 1 if not status else 2
            scored.append((status_score, blanks, row_id, action))
        scored.sort()
        keeper = scored[0][2]
        for item in scored[1:]:
            to_delete.append(item[2])
        if len(to_delete) % 10 == 0:
            print(f'  Processed {len(to_delete)} dupes...')

print(f'Duplicates to delete: {len(to_delete)}')

# ─── APPLY UPDATES ───
print('\n=== APPLYING UPDATES ===')

# Batch action text updates
if clean_updates:
    batch_size = 200
    for i in range(0, len(clean_updates), batch_size):
        batch = clean_updates[i:i+batch_size]
        body = json.dumps([{
            'id': item['row_id'],
            'cells': [{'columnId': ACOL, 'value': item['new']}]
        } for item in batch]).encode()
        req2 = urllib.request.Request(f'https://api.smartsheet.com/2.0/sheets/{SID}/rows',
            data=body, headers=H, method='PUT')
        res = json.loads(urllib.request.urlopen(req2, timeout=30).read())
        print(f'  Batch text {i//batch_size+1}: {len(batch)} rows - {res.get("message","OK")}')

# Batch owner updates
if owner_updates:
    batch_size = 200
    for i in range(0, len(owner_updates), batch_size):
        batch = owner_updates[i:i+batch_size]
        body = json.dumps([{
            'id': item['row_id'],
            'cells': [{'columnId': OCOL, 'value': item['new_owner']}]
        } for item in batch]).encode()
        req2 = urllib.request.Request(f'https://api.smartsheet.com/2.0/sheets/{SID}/rows',
            data=body, headers=H, method='PUT')
        res = json.loads(urllib.request.urlopen(req2, timeout=30).read())
        print(f'  Batch owner {i//batch_size+1}: {len(batch)} rows - {res.get("message","OK")}')

# Batch delete duplicates
if to_delete:
    batch_size = 200
    for i in range(0, len(to_delete), batch_size):
        batch = to_delete[i:i+batch_size]
        ids = ','.join(str(x) for x in batch)
        req2 = urllib.request.Request(f'https://api.smartsheet.com/2.0/sheets/{SID}/rows?ids={ids}',
            headers=H, method='DELETE')
        try:
            res = json.loads(urllib.request.urlopen(req2, timeout=30).read())
            print(f'  Batch delete {i//batch_size+1}: {len(batch)} rows - {res.get("message","OK")}')
        except Exception as e:
            print(f'  Batch delete {i//batch_size+1} FAILED: {e}')

print('\n=== DONE ===')
print(f'Text cleaned: {len(clean_updates)}')
print(f'Owners assigned: {len(owner_updates)}')
print(f'Duplicates deleted: {len(to_delete)}')