import subprocess, json, os

# Get token from env file via shell
result = subprocess.run(
    'grep SMARTSHEET_TOKEN .env.local | head -1 | sed \'s/.*="//; s/"$//\'',
    shell=True, capture_output=True, text=True, cwd=os.path.dirname(os.path.abspath(__file__))
)
token = result.stdout.strip()

if not token or len(token) < 10:
    print(f"ERROR: Bad token (len={len(token)}): [{token}]")
    exit(1)

print(f"Token ok (len={len(token)})")

import urllib.request

SHEET_ID = '4975609129160580'
url = f'https://api.smartsheet.com/2.0/sheets/{SHEET_ID}?include=attachments,comments'
req = urllib.request.Request(url, headers={
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
})

resp = urllib.request.urlopen(req)
data = json.loads(resp.read())

# Print columns
print('=== COLUMNS ===')
for col in data.get('columns', []):
    print(f"  [{col['index']}] {col['title']} (id={col['id']})")

# Find key column indices
col_index = {}
for col in data.get('columns', []):
    col_index[col['title']] = col['index']

print(f"\n=== {len(data.get('rows', []))} ROWS ===")
print("Column map:", json.dumps(col_index, indent=2))

# Print all rows with action item text
for row in data.get('rows', []):
    cells = row.get('cells', [])
    vals = {}
    for c in cells:
        vals[c.get('columnId')] = str(c.get('displayValue') or c.get('value') or '')

    # Build readable row
    row_num = row.get('rowNumber')
    parts = []
    for col in data.get('columns', []):
        v = vals.get(col['id'], '')
        if v and len(v) > 100:
            v = v[:100] + '...'
        parts.append(f"{col['title']}: {v}")

    print(f"\n--- ROW {row_num} ---")
    for p in parts:
        if ':' in p and p.split(':', 1)[1].strip():
            print(f"  {p}")