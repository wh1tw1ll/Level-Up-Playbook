#!/usr/bin/env python3
import json, urllib.request, re

with open(r'lib/handlers/prep.js', 'r') as f:
    content = f.read()

m2 = re.search(r"\.env\.SMARTSHEET_TOKEN\s*\|\|\s*'([^']+)'", content)
ss_token = m2.group(1)

req = urllib.request.Request(
    "https://api.smartsheet.com/2.0/sheets/4456864287772548?include=columns",
    headers={"Authorization": f"Bearer {ss_token}"}
)
resp = urllib.request.urlopen(req, timeout=15)
data = json.loads(resp.read())
rows = data.get('rows', [])

action_col = None
for c in data.get('columns', []):
    if c['title'] == 'Action ID':
        action_col = c['id']
        break

print(f"Checking {len(rows)} rows...")
matching = 0
nonmatching = 0

for row in rows:
    val = None
    for cell in row.get('cells', []):
        if cell.get('columnId') == action_col:
            val = cell.get('displayValue', cell.get('value', ''))
            break
    if val:
        m = re.match(r'^\[Granola:\s*(.+?)\s*\((\d{4}-\d{2}-\d{2})\)\]\s*(.*)$', str(val))
        if m:
            matching += 1
        else:
            nonmatching += 1
            if nonmatching <= 5:
                print(f"  NON-MATCHING [{row.get('rowNumber')}]: {str(val)[:100]}")

print(f"\nMatching: {matching}")
print(f"Non-matching (has value): {nonmatching}")