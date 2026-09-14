#!/usr/bin/env python3
"""Get full content of Greg's recent emails."""
import json, requests, re

token = json.load(open(r'C:\Users\HermesAdmin\.hermes\_token_cache.json'))['access_token']
headers = {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'}

r = requests.get(
    'https://graph.microsoft.com/v1.0/me/messages'
    '?$top=50&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,body,bodyPreview,webLink,isRead',
    headers=headers
)
msgs = r.json().get('value', [])

greg_msgs = [m for m in msgs if 'greg' in m.get('from',{}).get('emailAddress',{}).get('name','').lower() or 'gwieting' in m.get('from',{}).get('emailAddress',{}).get('address','').lower()]

print('Found {} emails from Greg Wieting:\n'.format(len(greg_msgs)))

for m in greg_msgs:
    subj = m.get('subject', '')
    ts = m.get('receivedDateTime', '')[:19]
    body_html = m.get('body', {}).get('content', '')
    body_len = len(body_html)
    is_read = m.get('isRead', False)
    web_link = m.get('webLink', '')
    
    print('=' * 80)
    print('[{}] {}'.format(ts, subj))
    print('Read: {} | Body: {} chars'.format(is_read, body_len))
    print('Link: {}'.format(web_link))
    print()
    
    body_text = re.sub(r'<[^>]+>', '\n', body_html)
    body_text = re.sub(r'\n{3,}', '\n\n', body_text)
    body_text = body_text.strip()
    
    preview = body_text[:2000]
    if len(body_text) > 2000:
        preview += '\n... [truncated]'
    print(preview)
    print()