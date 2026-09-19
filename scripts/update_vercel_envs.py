"""Update Vercel env targets to include preview scope."""
import json, urllib.request, os

# Try to find the auth file
auth_path = os.path.join(os.path.expanduser('~'), '.vercel', 'auth.json')
if not os.path.exists(auth_path):
    # Try the Windows profile path
    auth_path = os.environ.get('USERPROFILE', '') + '/.vercel/auth.json'
    if not os.path.exists(auth_path):
        auth_path = 'C:/Users/HermesAdmin/.vercel/auth.json'

print(f'Reading auth from: {auth_path}')
with open(auth_path) as f:
    auth = json.load(f)
VERCEL_TOKEN = auth['token']
print(f'Token found: {VERCEL_TOKEN[:5]}...{VERCEL_TOKEN[-5:]}')

headers = {
    'Authorization': f'Bearer {VERCEL_TOKEN}',
    'Content-Type': 'application/json'
}

entries = [
    ('twNadQz7ahOI8kX3', 'SMARTSHEET_TOKEN'),
    ('vHK2dOHCYpkg3ejF', 'GRANOLA_TOKEN'),
    ('9p5cnuJzuc8ydVMJ', 'SMARTSHEET_WORKSPACE_ID'),
    ('rOGgGr0XFQPbl9fN', 'LUCI_DISPATCH_CHAT_ID'),
    ('rSMYAj6i5nOspWDJ', 'TELEGRAM_BOT_TOKEN'),
]

data = json.dumps({"target": ["production", "preview", "development"]}).encode()

for eid, name in entries:
    url = f"https://api.vercel.com/v9/projects/prj_ZKr4S56J2xJr41cpyRAKdaULnxsX/env/{eid}?teamId=team_kOveNb85LcKfom6pKWzqXysj"
    req = urllib.request.Request(url, data=data, headers=headers, method='PATCH')
    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read())
            print(f"OK {result.get('key')}: targets={result.get('target')}")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"FAIL {name}: {e.code} {body[:200]}")

print("Done")