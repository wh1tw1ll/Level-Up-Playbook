#!/usr/bin/env python3
import json, urllib.request, re

# Read the token from the handler file
with open(r'lib/handlers/prep.js', 'r') as f:
    content = f.read()
m = re.search(r"GRANOLA_TOKEN\s*=\s*'([^']+)'", content)
token = m.group(1)

print(f"Token: {token[:20]}...{token[-5:]}")

# Test Granola API
req = urllib.request.Request(
    "https://public-api.granola.ai/v1/notes?page_size=30",
    headers={"Authorization": f"Bearer {token}"}
)
resp = urllib.request.urlopen(req, timeout=15)
data = json.loads(resp.read())
notes = data.get('notes', [])
print(f"\nGranola total: {len(notes)}")
for n in notes[:8]:
    print(f"  [{n.get('created_at','?')[:10]}] {n.get('title','?')}")
print(f"Has more: {data.get('hasMore',False)}")

# Check Smartsheet - read a few action IDs
ss_token = None
m2 = re.search(r"process\.env\.SMARTSHEET_TOKEN \|\| '([^']+)'", content)
if m2:
    ss_token = m2.group(1)
    
if ss_token:
    print(f"\nSS Token: {ss_token[:10]}...")
    ssreq = urllib.request.Request(
        "https://api.smartsheet.com/2.0/sheets/4456864287772548?include=columns",
        headers={"Authorization": f"Bearer {ss_token}"}
    )
    ssresp = urllib.request.urlopen(ssreq, timeout=15)
    ssdata = json.loads(ssresp.read())
    rows = ssdata.get('rows', [])
    print(f"SS rows: {len(rows)}")
    
    # Find Action ID column
    action_col = None
    for c in ssdata.get('columns', []):
        if c['title'] == 'Action ID':
            action_col = c['id']
            break
    
    count = 0
    for row in rows[:20]:
        for cell in row.get('cells', []):
            if cell.get('columnId') == action_col:
                val = cell.get('displayValue', cell.get('value', ''))
                if val:
                    # Check if it matches the parseActionId regex
                    m3 = re.match(r'^\[Granola:\s*(.+?)\s*\((\d{4}-\d{2}-\d{2})\)\]\s*(.*)$', str(val))
                    if m3:
                        count += 1
                        print(f"  MATCH: {m3.group(1)[:50]} | {m3.group(2)}")
    print(f"\nMatching rows (out of 20 checked): {count}")