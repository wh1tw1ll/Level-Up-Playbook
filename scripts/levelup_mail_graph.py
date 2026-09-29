#!/usr/bin/env python3
"""LUNA Level Up Mail Scanner via Graph API.
Scans last N days across ALL mail folders recursively.
Extracts commitments from email BODY, not subjects.
If no commitment found in body, produces NO row.
Dry-run flag: --dry-run."""
import sys, json, re, os, urllib.request, urllib.parse, subprocess, time
from datetime import datetime, timezone, timedelta

DRY_RUN = '--dry-run' in sys.argv
DAYS = 1  # Fallback — see last_run.json below for actual cutoff

LOG_FILE = r'C:\Users\HermesAdmin\.hermes\levelup_mail_scan_log.json'

# Smartsheet Personal action log
PERSONAL_SHEET_ID = '2802755367554948'
SST = open(r'C:\Users\HermesAdmin\ss_api_key.txt').read().strip()
SST_HDR = {'Authorization': 'Bearer ' + SST, 'Content-Type': 'application/json'}

# Cache column map once
_COL_MAP = None
def get_col_map():
    global _COL_MAP
    if _COL_MAP is None:
        req = urllib.request.Request(
            'https://api.smartsheet.com/2.0/sheets/' + PERSONAL_SHEET_ID,
            headers={'Authorization': 'Bearer ' + SST})
        sheet = json.loads(urllib.request.urlopen(req).read())
        _COL_MAP = {c['title']: c['id'] for c in sheet.get('columns', [])}
    return _COL_MAP

with open(r'C:\Users\HermesAdmin\.hermes\graph_levelup_cache.json') as f:
    tok = json.load(f)
HDR = {'Authorization': 'Bearer ' + tok['access_token'], 'Accept': 'application/json'}

EXCLUDE_FOLDERS = ['junk email', 'deleted items', 'drafts', 'rss feeds', 'conversation history', 'outbox', 'sent items']

def graph_get(path, params=None):
    url = 'https://graph.microsoft.com/v1.0' + path
    if params:
        url += '?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=HDR)
    return json.loads(urllib.request.urlopen(req).read())

def get_all_folder_ids():
    ids = []
    def walk(parent_id):
        folders = graph_get('/me/mailFolders/' + parent_id + '/childFolders') if parent_id else graph_get('/me/mailFolders')
        for f in folders.get('value', []):
            name = f['displayName']
            if any(e == name.lower() for e in EXCLUDE_FOLDERS): continue
            ids.append((f['id'], name, ''))
            try:
                kids = graph_get('/me/mailFolders/' + f['id'] + '/childFolders')
                for k in kids.get('value', []):
                    kn = k['displayName']
                    if any(e == kn.lower() for e in EXCLUDE_FOLDERS): continue
                    ids.append((k['id'], kn, name))
                    try:
                        gkids = graph_get('/me/mailFolders/' + k['id'] + '/childFolders')
                        for gk in gkids.get('value', []):
                            gn = gk['displayName']
                            if any(e == gn.lower() for e in EXCLUDE_FOLDERS): continue
                            ids.append((gk['id'], gn, kn))
                    except: pass
            except: pass
    walk(None)
    return ids

def scan_folder_body(folder_id, since, fname):
    """Get messages with body from a folder. Returns (message_id, subject, body, sender, date, hasAttachments)."""
    results = []
    params = {
        '$filter': 'receivedDateTime ge ' + since,
        '$select': 'id,subject,receivedDateTime,from,bodyPreview,body,hasAttachments',
        '$top': 20,
        '$orderby': 'receivedDateTime desc'
    }
    try:
        data = graph_get('/me/mailFolders/' + folder_id + '/messages', params)
        for m in data.get('value', []):
            mid = m.get('id', '')
            subj = str(m.get('subject', '') or '')
            body_preview = str(m.get('bodyPreview', '') or '')
            body_full = str(m.get('body', {}).get('content', '') or '')
            body_type = m.get('body', {}).get('contentType', '') or ''
            sender = m.get('from', {}).get('emailAddress', {}).get('address', '')
            rdate = (m.get('receivedDateTime', '') or '')[:10]
            has_atts = m.get('hasAttachments', False)
            if len(body_preview) < 100 and body_full and body_type == 'html':
                body_text = re.sub(r'<[^>]+>', ' ', body_full)
                body_text = re.sub(r'\s+', ' ', body_text).strip()
                if len(body_text) > len(body_preview):
                    body_preview = body_text[:500]
            results.append((mid, subj, body_preview, sender, rdate, has_atts))
    except:
        pass
    return results

# Commitment detection patterns (same approach as Granola)
COMMITMENT_PATTERNS = [
    # Explicit next-steps / action items
    (r'(?:^|\n)\s*[-*]\s*\*\*(.+?)\*\*', 'Granola-style **action**'),
    (r'(?:^|\n)\s*Next\s+Step[s]?\s*:?\s*\n((?:\s*[-*]\s*.+\n?)+)', 'Next Steps section'),
    (r'(?:^|\n)\s*Action\s+Items?\s*:?\s*\n((?:\s*[-*]\s*.+\n?)+)', 'Action Items section'),
    (r'(?:^|\n)\s*(?:TODO|TO\s*DO)\s*:?\s*\n((?:\s*[-*]\s*.+\n?)+)', 'TODO section'),
    # Directed action phrases
    (r'(?:Please|Can\s+you|Could\s+you|I\s+need\s+you\s+to)\s+(review|approve|sign|send|update|confirm|follow\s+up|revise|submit|draft|schedule|provide|share|call|email|coordinate|check|verify|complete|finalize|prepare|forward|circulate|add|remove|resolve|address)\s+(.+?)(?:\.|$|\n)', 'directed_action'),
    # "I will" commitments
    (r'\b(I\s+will|I\'ll|I\s+can)\s+(review|approve|sign|send|update|confirm|follow\s+up|send|provide|share|call|check|draft|prepare|get|reach\s+out)\s+(.+?)(?:\.|$|\n)', 'self_commitment'),
    # "[Name] to [verb]" pattern (like Granola)
    (r'\*\*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+to\s+(review|approve|sign|send|update|confirm|follow\s+up|revise|submit|draft|schedule|provide|share|call|email|coordinate|check|verify|complete|finalize)\s+(.+?)\*\*', 'granola_name_to_verb'),
    # Direct question requiring action
    (r'(Can\s+you|Did\s+you|Have\s+you)\s+(review|approve|sign|send|update|confirm|follow\s+up)\s+(.+?)\?', 'direct_question'),
]

def extract_commitments(subj, body):
    """Scan body for commitment patterns. Returns list of (commitment_text, pattern_type) or empty list."""
    text = subj + '\n' + body
    commitments = []
    
    # Check for Next Steps / Action Items sections
    for pattern, ptype in COMMITMENT_PATTERNS:
        matches = re.findall(pattern, text, re.IGNORECASE | re.MULTILINE)
        for m in matches:
            if isinstance(m, tuple):
                # Multi-group pattern
                groups = [g for g in m if g and len(g) > 3]
                if groups:
                    commitment = ' '.join(groups).strip()
                    if len(commitment) > 5:
                        commitments.append((commitment, ptype))
            elif isinstance(m, str) and len(m) > 5:
                commitments.append((m.strip(), ptype))
    
    # Deduplicate
    seen = set()
    unique = []
    for c, pt in commitments:
        key = c.lower()[:40]
        if key not in seen:
            seen.add(key)
            unique.append((c, pt))
    
    return unique

def should_skip(subj):
    if not subj: return True
    skip = ['unsubscribe', 'newsletter', 'Breaking:', 'tax liability', 'maximizing',
            'Behave at Work', 'A token limit', 'Cover Face', '10 Most Inspiring',
            'United in Service', 'Creating A World of Difference']
    for s in skip:
        if s.lower() in subj.lower(): return True
    if subj.startswith('Accepted:'): return True
    if 'LUCI' in subj: return True
    return False

def get_existing_texts():
    with open(r'C:\Users\HermesAdmin\ss_api_key.txt') as f:
        sst = f.read().strip()
    url = 'https://api.smartsheet.com/2.0/sheets/2802755367554948?rows=1000'
    req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + sst})
    sheet = json.loads(urllib.request.urlopen(req).read())
    rev = {c['id']: c['title'] for c in sheet.get('columns', [])}
    texts = set()
    for r in sheet.get('rows', []):
        for c in r.get('cells', []):
            if rev.get(c.get('columnId', '')) == 'Action ID':
                v = str(c.get('displayValue') or c.get('value', '')).lower().strip()
                if v: texts.add(v)
    return texts

def normalize(t):
    t = t.lower().strip()
    t = re.sub(r'[^\w\s]', ' ', t)
    t = re.sub(r'\s+', ' ', t).strip()
    return t

def stage_item(text, owner, source_ref):
    """Write directly to Smartsheet Personal Action Log instead of Vercel API (which needs OAuth)."""
    if DRY_RUN:
        return 'DRY_RUN', 'N/A'
    col_map = get_col_map()
    row = {
        "toBottom": True,
        "cells": [
            {"columnId": col_map['Action ID'], "value": text},
            {"columnId": col_map['Owner'], "value": owner},
            {"columnId": col_map['Status'], "value": "Open"},
            {"columnId": col_map['Category'], "value": "Staged"},
            {"columnId": col_map['Source'], "value": "Email"},
            {"columnId": col_map['SourceRef'], "value": source_ref},
            {"columnId": col_map['Confidence'], "value": "High"},
        ]
    }
    payload = json.dumps([row]).encode()
    url = 'https://api.smartsheet.com/2.0/sheets/' + PERSONAL_SHEET_ID + '/rows'
    for _ in range(3):
        try:
            req = urllib.request.Request(url, data=payload, headers=SST_HDR, method='POST')
            resp = json.loads(urllib.request.urlopen(req).read())
            # resp.result is a list (one entry per row added)
            results = resp.get('result', [])
            row_id = results[0].get('id', '?') if results else '?'
            return 'OK', str(row_id)
        except urllib.error.HTTPError as e:
            body = e.read().decode()[:300]
            print(f'    [STAGE HTTP {e.code}] {body}', flush=True)
            if e.code in (400, 422):
                return 'FAIL', '?'  # Don't retry validation errors
        except Exception as e:
            print(f'    [STAGE ERR] {e}', flush=True)
        time.sleep(1)
    return 'FAIL', '?'

def log_run(status, staged, skipped, folders_scanned, error=None):
    entry = {'timestamp': datetime.now(timezone.utc).isoformat(),
             'status': status, 'staged': staged, 'skipped': skipped,
             'folders_scanned': folders_scanned, 'error': error}
    try:
        with open(LOG_FILE) as f: log = json.load(f)
    except: log = []
    log.append(entry)
    log = log[-100:]
    with open(LOG_FILE, 'w') as f: json.dump(log, f, indent=2)

print('=== LUNA Level Up Mail Scanner - BODY COMMITMENT EXTRACTION + DOVA FILES ===')
print('Mode: ' + ('DRY RUN' if DRY_RUN else 'LIVE'))
print('Window: last ' + str(DAYS) + ' days')
print('DOVA folder: N/A (no DOVA_FOLDER defined)')
print(flush=True)

existing = get_existing_texts()
existing_norm = {normalize(t) for t in existing}
print('Existing rows: ' + str(len(existing)), flush=True)

print('Enumerating folders...', flush=True)
folder_ids = get_all_folder_ids()
print('Folders: ' + str(len(folder_ids)), flush=True)

now = datetime.now(timezone.utc)
LAST_RUN_FILE = r'C:\Users\HermesAdmin\.hermes\last_run.json'
try:
    with open(LAST_RUN_FILE) as f:
        lr = json.load(f)
    lr_ts = lr.get('email_level_up', '')
    if lr_ts:
        lr_dt = datetime.fromisoformat(lr_ts.replace('Z', '+00:00'))
        cutoff = max(lr_dt, now - timedelta(days=DAYS))
    else:
        cutoff = now - timedelta(days=DAYS)
except:
    cutoff = now - timedelta(days=DAYS)
since = cutoff.isoformat()
print(f'Window: max(last_run.json(email_level_up) or {DAYS}d ago) -> {since}', flush=True)

staged_count = 0
skipped_no_commitment = 0
skipped_dup = 0
skipped_noise = 0
scanned_count = 0

for fid, fname, parent in folder_ids:
    msgs = scan_folder_body(fid, since, fname)
    if not msgs: continue
    scanned_count += 1
    print('  ' + fname + ': ' + str(len(msgs)) + ' msgs', flush=True)
    for mid, subj, body, sender, rdate, has_atts in msgs:
        if should_skip(subj):
            skipped_noise += 1; continue

        # Extract commitments from body
        commitments = extract_commitments(subj, body)
        
        if not commitments:
            skipped_no_commitment += 1
            continue
        
        for comm, ptype in commitments:
            tag = normalize(comm)
            if tag in existing_norm:
                skipped_dup += 1; continue
            
            status, rid = stage_item(comm, 'Whitney Williams', 'LevelUpMail:' + fname + ':' + rdate)
            staged_count += 1
            src = sender.split('@')[0] if '@' in sender else sender
            print('    [' + status + '][' + ptype + '] ' + comm[:65] + ' (' + src + ')', flush=True)

print()
mode = 'DRY RUN' if DRY_RUN else 'LIVE'
summary = ('Folders:' + str(scanned_count) + ' Staged:' + str(staged_count)
           + ' NoCommitment:' + str(skipped_no_commitment)
           + ' Dup:' + str(skipped_dup) + ' Noise:' + str(skipped_noise))
print('=== ' + mode + ' COMPLETE - ' + summary + ' ===', flush=True)
log_run('dry_run' if DRY_RUN else 'live', staged_count, 0, scanned_count)

# Update last_run.json
if not DRY_RUN:
    LR_FILE = r'C:\Users\HermesAdmin\.hermes\last_run.json'
    try:
        with open(LR_FILE) as f:
            lr = json.load(f)
        lr['email_level_up'] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        with open(LR_FILE, 'w') as f:
            json.dump(lr, f, indent=2)
    except Exception as e:
        print(f'WARNING: could not update last_run.json: {e}', flush=True)