import requests, json, os

# Read token from .env.local
with open(r'C:\Users\HermesAdmin\Level-Up-Playbook\.env.local') as f:
    for line in f:
        if '=' in line:
            k, v = line.strip().split('=', 1)
            v = v.strip().strip('"').strip("'")
            if k == 'SMARTSHEET_TOKEN':
                token = v
                break

headers = {'Authorization': 'Bearer ' + token}

# Get sheet with rows and columns
r = requests.get(
    'https://api.smartsheet.com/2.0/sheets/4456864287772548',
    headers=headers,
    params={'include': 'columns', 'level': 1},
    timeout=15
)
data = r.json()
print('Sheet:', data.get('name'))

cols = data.get('columns', [])
for col in cols:
    print(f'  {col["title"]} ({col["type"]})')

dd_col = next((c for c in cols if c['title'] == 'Due Date'), None)
a_col = next((c for c in cols if c['title'] == 'Action ID'), None)

if dd_col:
    rows = data.get('rows', [])
    with_dd = 0
    for row in rows[:100]:
        dd_cell = next((c for c in row.get('cells', []) if c.get('columnId') == dd_col['id']), None)
        a_cell = next((c for c in row.get('cells', []) if c.get('columnId') == a_col['id']), None)
        if dd_cell and dd_cell.get('value'):
            with_dd += 1
            if with_dd <= 3:
                act = a_cell.get('value', '?') if a_cell else '?'
                print(f'  Row {row["id"]}: due={dd_cell["value"]} action={act}')
    print(f'Total with Due Date in first 100: {with_dd}')
else:
    print('No Due Date column found!')