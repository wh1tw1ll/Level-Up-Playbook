#!/usr/bin/env python3
"""Test Smartsheet write by reading token from file directly."""
import requests, json, sys

def read_token():
    path = r'C:\Users\HermesAdmin\.hermes\.smartsheet_token'
    with open(path) as f:
        raw = f.read()
    return raw.strip()

TOKEN = read_token()
SHEET_ID = '4456864287772548'
HEADERS = {'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json'}

print('Sheet ID:', SHEET_ID)
print('Token starts with:', TOKEN[:5] + '...')
print()

# 1. Get sheet
r = requests.get('https://api.smartsheet.com/2.0/sheets/' + SHEET_ID, headers=HEADERS)
print('GET status:', r.status_code)
sheet = r.json()
print('Access level:', sheet.get('accessLevel', 'unknown'))
print()

# 2. Get first real row's ID
rows = sheet.get('rows', [])
if rows:
    first_id = rows[0]['id']
    print('First row ID:', first_id)
    first_cells = rows[0].get('cells', [])
    for c in first_cells:
        if c.get('columnId') == 2258381950979972:  # Status column
            print('Current Status:', c.get('displayValue', c.get('value', 'N/A')))
    
    # 3. Try to update it
    print()
    print('Attempting PUT update...')
    payload = {'cells': [{'columnId': 2258381950979972, 'value': 'TEST-UPDATE-3'}]}
    r2 = requests.put(
        'https://api.smartsheet.com/2.0/sheets/' + SHEET_ID + '/rows/' + str(first_id),
        headers=HEADERS,
        json=payload
    )
    print('PUT status:', r2.status_code)
    try:
        print('PUT response:', json.dumps(r2.json(), indent=2)[:500])
    except:
        print('PUT raw:', r2.text[:200])
    
    # 4. Verify
    import time
    time.sleep(2)
    r3 = requests.get('https://api.smartsheet.com/2.0/sheets/' + SHEET_ID, headers=HEADERS)
    sheet3 = r3.json()
    for row in sheet3.get('rows', []):
        if row['id'] == first_id:
            for c in row.get('cells', []):
                if c.get('columnId') == 2258381950979972:
                    print()
                    print('Status AFTER update:', c.get('displayValue', c.get('value', 'N/A')))
            break
else:
    print('No rows found in sheet')
    print(json.dumps(sheet, indent=2)[:500])