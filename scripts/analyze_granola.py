#!/usr/bin/env python3
"""Analyze Granola items: date range, dedup against both sheets, report genuinely new."""
import json, urllib.request, re, urllib.parse, sys

GRANOLA_TOKEN='grn_Xt...sUrP'
with open(r'C:\Users\HermesAdmin\ss_api_key.txt') as f:
    SS_TOKEN=f.read...n

def fetch_granola():
    all_notes = []
    cursor = None
    while True:
        url = 'https://public-api.granola.ai/v1/notes?page_size=30'
        if cursor:
            url += '&cursor=' + urllib.parse.quote(cursor)
        req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + GRANOLA_TOKEN})
        try:
            data = json.loads(urllib.request.urlopen(req).read())
        except Exception as e:
            print('  Granola fetch error:', e, file=sys.stderr)
            break
        all_notes.extend(data.get('notes', []))
        if not data.get('hasMore') or not data.get('cursor'):
            break
        cursor = data['cursor']
    return all_notes

def get_detail(nid):
    url = 'https://public-api.granola.ai/v1/notes/' + nid
    req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + GRANOLA_TOKEN})
    try:
        return json.loads(urllib.request.urlopen(req).read())
    except:
        return None

def extract_items(md):
    items = []
    lines = md.split('\n')
    in_ns = False
    for line in lines:
        t = line.strip()
        if not t:
            continue
        if re.match(r'^#+\s+Next Steps', t):
            in_ns = True
            continue
        if in_ns and (t.startswith('---') or (re.match(r'^#+\s', t) and 'Next Steps' not in t)):
            in_ns = False
            continue
        if not in_ns or not t.startswith('- '):
            continue
        am = re.search(r'\*\*(.+?)\*\*', t)
        if am:
            action = am.group(1).strip()
        else:
            action = re.sub(r'^- ', '', t).strip()
            action = re.sub(r'\s*\([^)]*\)\s*$', '', action).strip()
        if action and len(action) >= 3:
            items.append(action)
    return items

def ss_get(path):
    url='https://api.smartsheet.com/2.0' + path
    req=urllib.request.Request(url,headers={'Authorization':'Bearer '+SS_TOKEN})
    try:
        return json.loads(urllib.request.urlopen(req).read())
    except Exception as e:
        print('SS error:', e, file=sys.stderr)
        return None

print('=== Granola Analysis ===')
print()

notes = fetch_granola()
print('Total notes: ' + str(len(notes)))
print()

# Build note_items dict: note_title -> {date, count, items}
note_items = {}
for note in notes:
    title = note.get('title', '?')
    created = note.get('created_at', '')
    d = created[:10] if created else '?'

    detail = get_detail(note['id'])
    if not detail:
        continue
    md = detail.get('summary_markdown', '')
    if not md:
        continue
    items = extract_items(md)
    if items:
        note_items[title] = {'date': d, 'count': len(items), 'items': items, 'note_id': note['id']}

# Date range
all_dates = sorted(set(info['date'] for info in note_items.values() if info['date'] != '?'))
if all_dates:
    print('Date range of notes with action items: ' + all_dates[0] + ' to ' + all_dates[-1])
    print()

# Items per month
nitems_by_month = {}
total_items = 0
for title, info in note_items.items():
    m = info['date'][:7]
    if m:
        nitems_by_month[m] = nitems_by_month.get(m, 0) + info['count']
        total_items += info['count']

print('Items per month:')
for m in sorted(nitems_by_month):
    print('  ' + m + ': ' + str(nitems_by_month[m]) + ' items')
print('Total: ' + str(total_items) + ' items')
print()

# Notes per month
nnotes_by_month = {}
for title, info in note_items.items():
    m = info['date'][:7]
    if m:
        nnotes_by_month[m] = nnotes_by_month.get(m, 0) + 1

print('Notes with action items per month:')
for m in sorted(nnotes_by_month):
    print('  ' + m + ': ' + str(nnotes_by_month[m]) + ' notes')
print()

# === Step 2: Dedup ===
print('=== Dedup Analysis ===')
print('Fetching both sheets...')

project = ss_get('/sheets/4456864287772548?rows=1000')
personal = ss_get('/sheets/2802755367554948?rows=500')

if not project or not personal:
    print('Failed to fetch sheets')
    sys.exit(1)

def build_rev(sheet):
    return {c['id']: c['title'] for c in sheet.get('columns', [])}

proj_rev = build_rev(project)
pers_rev = build_rev(personal)

def get_action(row, rev):
    for c in row.get('cells', []):
        if rev.get(c.get('columnId', '')) == 'Action ID':
            v = c.get('displayValue') or c.get('value', '')
            return str(v).strip().lower()
    return ''

existing = set()
for r in project.get('rows', []):
    a = get_action(r, proj_rev)
    if a and len(a) > 5:
        existing.add(a)
for r in personal.get('rows', []):
    a = get_action(r, pers_rev)
    if a and len(a) > 5:
        existing.add(a)

print('Existing unique action texts: ' + str(len(existing)))
print()

# Dedup
deduped_new = []
deduped_dup = []
for title, info in note_items.items():
    for item_text in info['items']:
        norm = item_text.lower().strip()
        if norm in existing:
            deduped_dup.append({'text': item_text, 'note': title, 'date': info['date']})
        else:
            deduped_new.append({'text': item_text, 'note': title, 'date': info['date']})

print('Results:')
print('  Total from Granola: ' + str(total_items))
print('  Already in sheets:  ' + str(len(deduped_dup)))
print('  Genuinely new:      ' + str(len(deduped_new)))
print()

# New by month
new_by_month = {}
for item in deduped_new:
    m = item['date'][:7]
    if m:
        new_by_month[m] = new_by_month.get(m, 0) + 1
print('New items per month:')
for m in sorted(new_by_month):
    print('  ' + m + ': ' + str(new_by_month[m]) + ' new')
print()

print('Sample of new items:')
for item in deduped_new[:25]:
    s = item['text'][:50].replace('\n', ' ')
    print('  [' + item['date'] + '] ' + s)

# Dup by month
dup_by_month = {}
for item in deduped_dup:
    m = item['date'][:7]
    if m:
        dup_by_month[m] = dup_by_month.get(m, 0) + 1
print()
print('Duplicates per month:')
for m in sorted(dup_by_month):
    print('  ' + m + ': ' + str(dup_by_month[m]) + ' dupes')