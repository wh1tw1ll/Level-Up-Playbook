#!/usr/bin/env python3
"""Get full body of Greg's draft agenda - fetch by sender filter."""
import json, requests, re, html as html_mod

token = json.load(open(r'C:\Users\HermesAdmin\.hermes\_token_cache.json'))['access_token']
headers = {'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'}

# Get recent messages from Greg Wieting
r = requests.get(
    'https://graph.microsoft.com/v1.0/me/messages'
    '?$top=50&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,webLink',
    headers=headers
)
msgs = r.json().get('value', [])

greg_msgs = [m for m in msgs if 'gwieting' in m.get('from',{}).get('emailAddress',{}).get('address','').lower()]

print('Greg\'s emails:')
for m in greg_msgs:
    print('  [{}] {} - {}'.format(m.get('receivedDateTime','')[:16], m.get('subject',''), m.get('id','')[:10]))

# Find the draft agenda one
target = None
for m in greg_msgs:
    subj = m.get('subject', '')
    if 'draft' in subj.lower() or 'agenda' in subj.lower():
        target = m
        break

if target:
    # Fetch full body
    msg_id = target['id']
    r2 = requests.get(
        'https://graph.microsoft.com/v1.0/me/messages/{}'.format(msg_id),
        headers=headers
    )
    full = r2.json()
    body_html = full.get('body', {}).get('content', '')
    
    print('\n=== FULL AGENDA ===')
    print('Subject: {}'.format(target.get('subject','')))
    print('Time: {}'.format(target.get('receivedDateTime','')[:19]))
    print()
    
    # Better HTML to text
    text = re.sub(r'<style[^>]*>.*?</style>', '', body_html, flags=re.DOTALL)
    text = re.sub(r'<br\s*/?>', '\n', text)
    text = re.sub(r'<p[^>]*>', '\n', text)
    text = re.sub(r'</p>', '\n', text)
    text = re.sub(r'<li[^>]*>', '\n  • ', text)
    text = re.sub(r'</li>', '', text)
    text = re.sub(r'<[^>]+>', '', text)
    text = re.sub(r'&nbsp;', ' ', text)
    text = re.sub(r'&amp;', '&', text)
    text = re.sub(r'&lt;', '<', text)
    text = re.sub(r'&gt;', '>', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    
    # Strip leading/trailing whitespace per line
    lines = [l.strip() for l in text.split('\n')]
    text = '\n'.join(lines)
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = text.strip()
    
    print(text)
else:
    print('Draft agenda email not found in recent 50')

# Also get the reply from Greg ("Good adds.")
for m in greg_msgs:
    subj = m.get('subject', '')
    if 're:' in subj.lower() and 'agenda' in subj.lower():
        msg_id = m['id']
        r3 = requests.get(
            'https://graph.microsoft.com/v1.0/me/messages/{}'.format(msg_id),
            headers=headers
        )
        full = r3.json()
        body_html = full.get('body', {}).get('content', '')
        
        text = re.sub(r'<style[^>]*>.*?</style>', '', body_html, flags=re.DOTALL)
        text = re.sub(r'<br\s*/?>', '\n', text)
        text = re.sub(r'<p[^>]*>', '\n', text)
        text = re.sub(r'</p>', '\n', text)
        text = re.sub(r'<[^>]+>', '', text)
        text = re.sub(r'&nbsp;', ' ', text)
        text = re.sub(r'&amp;', '&', text)
        text = re.sub(r'\n{3,}', '\n\n', text)
        lines = [l.strip() for l in text.split('\n')]
        text = '\n'.join(lines)
        text = re.sub(r'\n{3,}', '\n\n', text)
        text = text.strip()
        
        print('\n\n=== GREG\'S REPLY ===')
        print('Subject: {}'.format(m.get('subject','')))
        print(text[:500])
        break