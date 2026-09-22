#!/usr/bin/env python3
import json, urllib.request, re

with open(r'lib/handlers/prep.js', 'r') as f:
    content = f.read()
m = re.search(r"GRANOLA_TOKEN\s*=\s*'([^']+)'", content)
token = m.group(1)

# Check what fields the list endpoint returns
req = urllib.request.Request(
    "https://public-api.granola.ai/v1/notes?page_size=5",
    headers={"Authorization": f"Bearer {token}"}
)
resp = urllib.request.urlopen(req, timeout=15)
data = json.loads(resp.read())

print("=== Fields on first note from LIST endpoint ===")
note = data['notes'][0]
for k, v in note.items():
    print(f"  {k}: {str(v)[:200]}")

# Check if summary_markdown or summary_text exists
print(f"\nsummary_markdown: {'summary_markdown' in note}")
print(f"summary_text: {'summary_text' in note}")
print(f"web_url: {'web_url' in note}")
print(f"body: {'body' in note}")

# Now check individual note endpoint
note_id = note['id']
print(f"\n=== Fetching individual note: {note_id} ===")
req2 = urllib.request.Request(
    f"https://public-api.granola.ai/v1/notes/{note_id}",
    headers={"Authorization": f"Bearer {token}"}
)
resp2 = urllib.request.urlopen(req2, timeout=15)
note_detail = json.loads(resp2.read())

print("Fields from individual note endpoint:")
for k, v in note_detail.items():
    val = str(v)
    print(f"  {k}: {val[:300]}")
    if k == 'summary_markdown':
        print(f"    LENGTH: {len(val)} chars")