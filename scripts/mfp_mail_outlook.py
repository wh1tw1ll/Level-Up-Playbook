#!/usr/bin/env python3
"""LUNA MFP Mail Scanner via Outlook COM.
Scans last N days across ALL mail folders recursively.
Stages to Personal sheet via /api/stage. Dry-run flag: --dry-run.
Logs every run. Tracks last successful scan with staleness warning."""
import sys, json, re, subprocess, time, os
from datetime import datetime, timezone, timedelta

DRY_RUN = '--dry-run' in sys.argv
DAYS = 7

STAGE_URL = 'https://level-up-playbook.vercel.app/api/stage'
LOG_FILE = r'C:\Users\HermesAdmin\.hermes\mfp_mail_scan_log.json'
STATE_FILE = r'C:\Users\HermesAdmin\.hermes\mfp_mail_state.json'

EXCLUDE_FOLDERS = ['junk', 'deleted items', 'drafts', 'rss', 'conversation history', 'outbox', 'sync issues', 'conflicts', 'local failures']

def log_run(status, staged, skipped, folders_scanned, error=None):
    entry = {'timestamp': datetime.now(timezone.utc).isoformat(), 'status': status,
             'staged': staged, 'skipped': skipped, 'folders_scanned': folders_scanned, 'error': error}
    try:
        with open(LOG_FILE) as f: log = json.load(f)
    except: log = []
    log.append(entry)
    log = log[-100:]
    with open(LOG_FILE, 'w') as f: json.dump(log, f, indent=2)
    if status == 'success':
        state = {'last_successful_scan': datetime.now(timezone.utc).isoformat(),
                 'last_staged_count': staged, 'source': 'MFP Outlook COM'}
        with open(STATE_FILE, 'w') as f: json.dump(state, f, indent=2)

def check_staleness():
    try:
        with open(STATE_FILE) as f: state = json.load(f)
        last = datetime.fromisoformat(state['last_successful_scan'])
        age_hours = (datetime.now(timezone.utc) - last).total_seconds() / 3600
        if age_hours > 72:
            return True, f'WARNING: Last successful MFP scan was {age_hours:.0f}h ago'
        return False, f'Last MFP scan: {age_hours:.0f}h ago (OK)'
    except:
        return True, 'WARNING: No successful MFP scan recorded yet'

print('=== LUNA MFP Mail Scanner (Outlook COM) - ALL FOLDERS ===', flush=True)
print('Mode: ' + ('DRY RUN' if DRY_RUN else 'LIVE'), flush=True)
print('Window: last ' + str(DAYS) + ' days', flush=True)

is_stale, staleness_msg = check_staleness()
print(staleness_msg, flush=True)
print(flush=True)

# Connect to Outlook
try:
    import pythoncom
    pythoncom.CoInitialize()
    import win32com.client
    # Use Dispatch (starts Outlook if needed) instead of GetActiveObject
    ol = win32com.client.Dispatch("Outlook.Application")
    ns = ol.GetNamespace("MAPI")
except Exception as e:
    msg = 'Outlook COM connection failed: ' + str(e)
    print(msg, flush=True)
    log_run('error', 0, 0, 0, msg)
    print('=== FAILED - Outlook not running ===', flush=True)
    sys.exit(1)

# Find MFP store - try multiple name patterns
ms = None
store_names = []
for i in range(1, ns.Folders.Count + 1):
    s = ns.Folders.Item(i)
    store_names.append(s.Name)
    name = s.Name.lower()
    if any(kw in name for kw in ["miamifreedompark", "miamifreedom", "freedom park", "mfp", "whitney.williams"]):
        ms = s
        print(f'Found MFP store via name match: "{s.Name}"', flush=True)
        break

if not ms:
    # Fallback: if no MFP-specific name found, use the first Exchange store (usually store 2)
    print(f'No keyword match. Stores found: {store_names}', flush=True)
    for i in range(1, ns.Folders.Count + 1):
        s = ns.Folders.Item(i)
        if 'outlook data file' not in s.Name.lower():
            ms = s
            print(f'Fallback: using store "{s.Name}" (index {i})', flush=True)
            break

if not ms:
    msg = f'MFP mailbox store not found in any store. Stores: {store_names}'
    print(msg, flush=True)
    log_run('error', 0, 0, 0, msg)
    pythoncom.CoUninitialize()
    sys.exit(1)

print('MFP store: ' + ms.Name, flush=True)

def get_scanable_folders(store):
    """Recursively get all folder names to scan."""
    folders = []
    for i in range(1, store.Folders.Count + 1):
        f = store.Folders.Item(i)
        fname = f.Name.lower()
        if any(e in fname for e in EXCLUDE_FOLDERS):
            continue
        folders.append((f.Name, f))
        try:
            for j in range(1, f.Folders.Count + 1):
                sf = f.Folders.Item(j)
                sfname = sf.Name.lower()
                if any(e in sfname for e in EXCLUDE_FOLDERS):
                    continue
                folders.append((f.Name + '/' + sf.Name, sf))
                try:
                    for k in range(1, sf.Folders.Count + 1):
                        tsf = sf.Folders.Item(k)
                        tsfname = tsf.Name.lower()
                        if any(e in tsfname for e in EXCLUDE_FOLDERS):
                            continue
                        folders.append((f.Name + '/' + sf.Name + '/' + tsf.Name, tsf))
                except: pass
        except: pass
    return folders

def should_skip(subj):
    skip = ['unsubscribe', 'newsletter', 'Breaking:', 'tax liability', 'maximizing']
    for s in skip:
        if s.lower() in subj.lower(): return True
    if subj.startswith('Accepted:'): return True
    if 'LUCI' in subj: return True
    return False

def is_action_worthy(subj):
    aw = ['review', 'approve', 'sign', 'send', 'update', 'confirm',
          'follow up', 'revise', 'submitted', 'revised', 'for review',
          'for approval', 'action required', 'response needed',
          'deadline', 'contract', 'change order', 'proposal',
          'agreement', 'quote', 'pricing', 'draft', 'closeout']
    sl = subj.lower()
    for w in aw:
        if w in sl: return True
    return False

def normalize(t):
    t = t.lower().strip()
    t = re.sub(r'[^\w\s]', ' ', t)
    t = re.sub(r'\s+', ' ', t).strip()
    return t

def get_existing_texts():
    with open(r'C:\Users\HermesAdmin\ss_api_key.txt') as f:
        ss = f.read().strip()
    import urllib.request
    url = 'https://api.smartsheet.com/2.0/sheets/2802755367554948?rows=1000'
    req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + ss})
    sheet = json.loads(urllib.request.urlopen(req).read())
    rev = {c['id']: c['title'] for c in sheet.get('columns', [])}
    texts = set()
    for r in sheet.get('rows', []):
        for c in r.get('cells', []):
            if rev.get(c.get('columnId', '')) == 'Action ID':
                v = str(c.get('displayValue') or c.get('value', '')).lower().strip()
                if v: texts.add(v)
    return texts

import urllib.request
existing = get_existing_texts()
existing_norm = {normalize(t) for t in existing}
print('Existing Personal sheet rows: ' + str(len(existing)), flush=True)

# Get all folders
print('Enumerating MFP folders...', flush=True)
folders = get_scanable_folders(ms)
print('Folders to scan: ' + str(len(folders)), flush=True)

seen_subjects = set()
staged_count = 0
skipped_count = 0
scanned_count = 0
cutoff = datetime.now(timezone.utc) - timedelta(days=DAYS)

for fname, folder in folders:
    try:
        items = folder.Items
        items.Sort('[ReceivedTime]', True)
        count = 0
        msg_list = []
        for k in range(min(50, items.Count)):
            try:
                msg = items.Item(k + 1)
                received = msg.ReceivedTime
                if received:
                    rt = datetime(received.year, received.month, received.day,
                                received.hour, received.minute, received.second, tzinfo=timezone.utc)
                    if rt < cutoff: continue
                subj = str(msg.Subject or '')
                if subj:
                    sender = str(msg.SenderName or '')
                    to = str(msg.To or '')
                    msg_list.append((subj, sender, to))
                    count += 1
            except:
                continue
        if count > 0:
            scanned_count += 1
            print('  ' + fname + ': ' + str(count) + ' msgs', flush=True)
            for subj, sender, to in msg_list:
                if should_skip(subj): continue
                clean = re.sub(r'^(Re|Fw|FW|RE|RE:|Fw:)\s*:\s*', '', subj, flags=re.IGNORECASE).strip()
                tag = normalize(clean)
                if tag in seen_subjects or tag in existing_norm:
                    skipped_count += 1; continue
                seen_subjects.add(tag)
                if not is_action_worthy(clean):
                    skipped_count += 1; continue
                if DRY_RUN:
                    status, rid = 'DRY_RUN', 'N/A'
                else:
                    payload = json.dumps({'text': clean, 'owner': 'Whitney Williams', 'sourceRef': 'MFPmail:' + fname})
                    for _ in range(3):
                        try:
                            r = subprocess.run(['curl', '-s', '-X', 'POST', STAGE_URL,
                                '-H', 'Content-Type: application/json', '-d', payload],
                                capture_output=True, text=True, timeout=15)
                            if r.stdout:
                                resp = json.loads(r.stdout)
                                status, rid = resp.get('status', 'ERR'), resp.get('rowId', '?')
                                break
                        except: pass
                        time.sleep(1)
                    else:
                        status, rid = 'FAIL', '?'
                staged_count += 1
                src = sender[:18] if sender else ''
                print('    [' + status + '] ' + clean[:60] + ' (' + src + ')', flush=True)
    except Exception as e:
        print('  ' + fname + ': error - ' + str(e)[:50], flush=True)

pythoncom.CoUninitialize()

print()
mode = 'DRY RUN' if DRY_RUN else 'LIVE'
summary = 'Folders:' + str(scanned_count) + ' Staged:' + str(staged_count) + ' Skipped:' + str(skipped_count)
print('=== ' + mode + ' COMPLETE - ' + summary + ' ===', flush=True)
log_run('success' if not DRY_RUN else 'dry_run', staged_count, skipped_count, scanned_count)