#!/usr/bin/env python3
"""Poll for token and fetch Greg's recent emails."""
import msal, json, requests

CLIENT_ID = 'd43fa6d5-ac58-4c6a-a0a1-083a1573ab03'
TENANT = '8222d14d-0869-42d3-8b7f-858c65b89c0e'
AUTHORITY = f'https://login.microsoftonline.com/{TENANT}'

flow = json.load(open(r'C:\Users\HermesAdmin\.hermes\luna_device_code.json'))
app = msal.PublicClientApplication(CLIENT_ID, authority=AUTHORITY)
result = app.acquire_token_by_device_flow(flow)

if 'access_token' not in result:
    print('ERROR:', json.dumps(result, indent=2))
    exit(1)

# Save token
with open(r'C:\Users\HermesAdmin\.hermes\_token_cache.json', 'w') as f:
    json.dump({'access_token': result['access_token']}, f)

print('TOKEN ACQUIRED')
headers = {'Authorization': 'Bearer ' + result['access_token'], 'Content-Type': 'application/json'}

# Fetch recent inbox messages
r = requests.get(
    'https://graph.microsoft.com/v1.0/me/mailFolders/inbox/messages'
    '?$top=20&$orderby=receivedDateTime desc&$select=subject,from,receivedDateTime,bodyPreview,isRead,webLink,sender',
    headers=headers
)

if r.status_code != 200:
    print(f'API error: {r.status_code}')
    print(r.text[:500])
    exit(1)

msgs = r.json().get('value', [])
print(f'INBOX: {len(msgs)} messages')

for m in msgs:
    sender = m.get('from', {}).get('emailAddress', {})
    name = sender.get('name', '')
    email = sender.get('address', '')
    subj = m.get('subject', '')
    ts = m.get('receivedDateTime', '')[:19]
    body = (m.get('bodyPreview') or '')[:200]
    
    # Highlight Greg's emails
    if 'greg' in name.lower() or 'gwieting' in email.lower() or 'greg' in email.lower():
        marker = '<<< FROM GREG'
    elif 'wieting' in name.lower():
        marker = '<<< FROM GREG'
    else:
        marker = ''
    
    print(f'[{ts}] {name} ({email})')
    print(f'  {subj} {marker}')
    if marker:
        print(f'  PREVIEW: {body}')
    print()