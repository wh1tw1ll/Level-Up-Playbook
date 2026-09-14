#!/usr/bin/env python3
"""Verify and fix Smartsheet row insertion"""
import json, urllib.request, urllib.error, sys, os

# Read token from file
token_path = os.path.expanduser('~/.hermes/.smartsheet_token')
with open(token_path) as f:
    token = f.read().strip()

def api_call(method, path, data=None):
    url = f'https://api.smartsheet.com/2.0{path}'
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    body = json.dumps(data).encode('utf-8') if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return {'error': e.code, 'body': e.read().decode()}

# Test: add a single row to Action Tracker using the correct API
sheet_id = '4456864287772548'
col_id = 6748787438817156
col_desc = 4496987625131908

print(f'Testing row add to Action Tracker...')
result = api_call('POST', f'/sheets/{sheet_id}/rows', {
    'rows': [{
        'toBottom': True,
        'cells': [
            {'columnId': col_id, 'value': 'PY-API-TEST'},
            {'columnId': col_desc, 'value': 'Python API direct test'}
        ]
    }]
})
print(f'Result: {json.dumps(result, indent=2)[:500]}')

# Verify
print(f'\nVerifying...')
verify = api_call('GET', f'/sheets/{sheet_id}')
if 'error' in verify:
    print(f'Verify error: {verify}')
else:
    for r in verify.get('rows', [])[-1:]:
        print(f'Row {r.get("rowNumber")}:')
        for c in r.get('cells', []):
            col_name = ''
            for col in verify.get('columns', []):
                if col['id'] == c['columnId']:
                    col_name = col['title']
                    break
            print(f'  {col_name}: {c.get("value", "EMPTY")}')