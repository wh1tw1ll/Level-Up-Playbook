#!/usr/bin/env python3
"""Re-classify and clean up the Personal sheet."""
import json, urllib.request

ss = open(r'C:\Users\HermesAdmin\ss_api_key.txt').read().strip()
hdr = {'Authorization': 'Bearer ' + ss, 'Content-Type': 'application/json'}

url = 'https://api.smartsheet.com/2.0/sheets/2802755367554948?rows=2000'
req = urllib.request.Request(url, headers=hdr)
sheet = json.loads(urllib.request.urlopen(req).read())

cm = {c['id']: c['title'] for c in sheet.get('columns', [])}
proj_col_id = next((c['id'] for c in sheet.get('columns', []) if c['title'] == 'Project'), None)

rows = []
for r in sheet.get('rows', []):
    cells = {}
    for c in r.get('cells', []):
        title = cm.get(c['columnId'], '')
        cells[title] = str(c.get('displayValue') or c.get('value', ''))
    rows.append({'id': r['id'], 'action': cells.get('Action ID', ''),
                 'project': cells.get('Project', ''), 'source_ref': cells.get('SourceRef', '')})

def classify(row):
    t = (row['action'] + ' ' + row['source_ref']).lower()
    if any(x in t for x in ['debug', 'test promote', 'verify promote', 'promote final',
                             'promote test', 'deploy check', 'force deploy', 'array obj',
                             'skip pick', 'objectvalue final', 'build fix test',
                             'promote obj test']):
        return 'DELETE'
    sphere = ['nhs6', '4d wind', 'holoplot', 'buro happold', 'sphere', 'enclosure',
              'preprogramming', 'conduit routing', 'sub-slab', 'slab edge',
              'utility switch', 'steel coating', 'fx array', 'severud',
              'nozzle connection', 'upright attachment', 'no-fly zone',
              'integrated schedule', 'fat plan', 'duct attachment',
              'thread with structural lead', 'appoint geotech',
              'structural loads held', 'contingent worker badge', 'generator quote']
    for kw in sphere:
        if kw in t: return 'SPHERE_DISCARD'
    dova = ['dova', 'arena', 'kozpure', 'cwta', 'mccarthy', 'jci', 'grading', 'cash flow',
            'perkins', 'cospire', 'caltrans', 'suffolk', 'condition of approval',
            'coa ', 'planning commission', 'public works', 'hunt concrete', 'sofi da',
            'sd kickoff', 'denver kickoff', 'santana', 'kyle', 'arlene', 'albert',
            'chuck', 'brian', 'jeremiah', 'dezay', 'perkins & will', 'scenario b',
            'lnlp', 'a133', 'purpose & will', 'terry', 'wells cook',
            'schematic completion', 'mccarthy dispute', 'orlana', 'work contractors',
            'site work scope', 'agreement from charlie', 'sshcp', 'existing biologist',
            'wet signature', 'interim agreement', 'design review', 'consultant kickoff',
            'whitney on santana', 'is milestone', 'glenwell', 'mary ritala',
            'don on sds', 'sam kalscheur', 'charlie tiwana', 'philip',
            'kozpure team', 'sturm', 'lincoln', 'brackett', 'glen well',
            'response to charlie']
    for kw in dova:
        if kw in t and not any(k in t for k in ['mfp', 'miami', 'freedom park', 'stadium', 'closeout']):
            return 'DOVA'
    mfp = ['mfp', 'miami', 'freedom park', 'stadium', 'lamartec', 'lemartec',
           'closeout', 'lien', 'backcharge', 'punch', 'change order',
           'promethean', 'procore', 'dream seat', 'spectra', 'ankura',
           'venore', 'venor', 'sub recovery', 'sub closeout',
           'us customs', 'infract', 'baker concrete', 'mr glass',
           'burke welding', 'custom doors', 'anchor steel', 'sovitech',
           'hill york', 'lmartech', 'lmt', 'wolverine',
           'payment recommendation', 'sub narrative', 'jordan crawl',
           'granola browser extension', 'per-sub slide draft',
           'kroll', 'sub negotiation', 'timetable',
           'devin outreach', 'jason', 'crawford', 'mary grandy',
           'andrew gibson', 'pca request', 'geotech report', 'approved invoice',
           'invoice discrepanc', 'construction items', 'escalation',
           'response to graham', 'amthink', 'scope gap', 'alpha one sports',
           'ocip', 'dawn payment', 'ap team']
    for kw in mfp:
        if kw in t: return 'MFP'
    biz = ['proposal', 'pursuit', 'insurance', 'hiring', 'accounting',
           'smar', 'tooling', 'internal', 'hr', 'travel', 'expense',
           'docusign', 'separation', 'eticket', 'itinerary',
           'brock', 'coffee', 'boilerplate', 'press release',
           'deck', 'job site photos', 'software',
           'connector park', 'foundation', 'wdi',
           'working session with phil', 'guest user',
           'agenda doc', 'external meeting', 'hcp', 'sply',
           'engagement plan', 'gabby proposal']
    for kw in biz:
        if kw in t: return 'Business'
    return 'UNRESOLVED'

to_del, to_upd, unres = [], [], []
for r in rows:
    cls = classify(r)
    if cls in ('DELETE', 'SPHERE_DISCARD'):
        to_del.append(r['id'])
    elif cls in ('DOVA', 'MFP', 'Business') and r['project'] != cls:
        to_upd.append({'id': r['id'], 'new_proj': cls})
    elif cls == 'UNRESOLVED':
        unres.append(r)

# Delete
if to_del:
    for i in range(0, len(to_del), 100):
        ids = ','.join(str(x) for x in to_del[i:i+100])
        u = 'https://api.smartsheet.com/2.0/sheets/2802755367554948/rows?ids=' + ids + '&ignoreRowsNotFound=true'
        rq = urllib.request.Request(u, headers=hdr, method='DELETE')
        resp = json.loads(urllib.request.urlopen(rq).read())
        print('DEL batch ' + str(i//100+1) + ': ' + str(len(to_del[i:i+100])) + ' rows - ' + resp.get('message','?'))
else:
    print('No rows to delete')

# Update Project column
if to_upd:
    for i in range(0, len(to_upd), 50):
        batch = to_upd[i:i+50]
        body = [{'id': x['id'], 'cells': [{'columnId': proj_col_id, 'value': x['new_proj']}]} for x in batch]
        u = 'https://api.smartsheet.com/2.0/sheets/2802755367554948/rows'
        rq = urllib.request.Request(u, headers=hdr, data=json.dumps(body).encode(), method='PUT')
        resp = json.loads(urllib.request.urlopen(rq).read())
        code = resp.get('resultCode', -1)
        msg = resp.get('message', '')[:40]
        print('UPD batch ' + str(i//50+1) + ': ' + str(len(batch)) + ' rows - ' + str(code) + ' ' + msg)
else:
    print('No rows to update')

print()
print('Deleted (Sphere+Tests): ' + str(len(to_del)))
print('Updated Project column: ' + str(len(to_upd)))
print('Unresolved: ' + str(len(unres)))
for r in unres:
    act = r['action'][:55]
    ref = r['source_ref'][:20]
    print('  "' + act + '" [' + ref + ']')