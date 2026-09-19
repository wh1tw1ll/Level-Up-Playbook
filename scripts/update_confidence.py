#!/usr/bin/env python3
"""Batch update Personal sheet confidence from medium to high."""
import json, urllib.request, urllib.error, sys, time

with open(r'C:\Users\HermesAdmin\ss_api_key.txt') as f:
    api_key = f.read().strip()

HDR = {
    'Authorization': 'Bearer ' + api_key,
    'Content-Type': 'application/json'
}

def api(path, method='GET', data=None):
    url = 'https://api.smartsheet.com/2.0' + path
    req = urllib.request.Request(url, headers=HDR, method=method)
    if data:
        req.data = json.dumps(data).encode()
    try:
        resp = json.loads(urllib.request.urlopen(req).read())
    except urllib.error.HTTPError as e:
        resp = json.loads(e.read())
    return resp

# Get sheet
sheet = api('/sheets/2802755367554948?rows=2000')
cols = {c['title']: c for c in sheet.get('columns', [])}
conf_col_id = cols['Confidence']['id']
medium_rows = [r['id'] for r in sheet.get('rows', []) 
               if any(c.get('columnId') == conf_col_id and 
                      str(c.get('value', '') or c.get('displayValue', '')).lower() == 'medium' 
                      for c in r.get('cells', []))]

print(f'Found {len(medium_rows)} medium-confidence rows')

# Update in batches of 50
batch_size = 50
success = 0
for i in range(0, len(medium_rows), batch_size):
    batch = medium_rows[i:i+batch_size]
    payload = [{'id': rid, 'cells': [{'columnId': conf_col_id, 'value': 'high'}]} for rid in batch]
    result = api('/sheets/2802755367554948/rows', 'PUT', payload)
    if 'message' in result and 'SUCCESS' in result['message']:
        success += len(batch)
        print(f'  Batch {i//batch_size + 1}: {len(batch)} rows OK')
    else:
        print(f'  Batch {i//batch_size + 1} ERROR: {result.get("message", "?")}')
        print(f'    {json.dumps(result)[:200]}')
    time.sleep(0.5)

print(f'\nTotal: {success}/{len(medium_rows)} updated')