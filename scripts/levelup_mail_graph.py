#!/usr/bin/env python3
"""LUNA Level Up Mail Scanner via Graph API.
Scans last N days across ALL mail folders recursively.
Extracts commitments from email BODY, not subjects.
If no commitment found in body, produces NO row.
Dry-run flag: --dry-run."""
import sys, json, re, os, urllib.request, urllib.parse, time, hashlib
from datetime import datetime, timezone, timedelta

DRY_RUN = '--dry-run' in sys.argv
DAYS = 1  # Fallback — see last_run.json below for actual cutoff

# --- Paths ---
HOME = r'C:\Users\HermesAdmin'
LOG_FILE = HOME + r'\.hermes\levelup_mail_scan_log.json'
LAST_RUN_FILE = HOME + r'\.hermes\last_run.json'
GRAPH_CACHE_FILE = HOME + r'\.hermes\graph_levelup_cache.json'
MSAL_TOKEN_FILE = HOME + r'\.hermes\msal_tokens.json'
SS_API_KEY = HOME + r'\ss_api_key.txt'
TELEGRAM_TOKEN_PATH = HOME + r'\.hermes\telegram_token.txt'

PERSONAL_SHEET_ID = '2802755367554948'

# OAuth constants (match generate_agendas.py)
TENANT_ID = '8222d14d-0869-42d3-8b7f-858c65b89c0e'
CLIENT_ID = 'd43fa6d5-ac58-4c6a-a0a1-083a1573ab03'
# Read the actual scope from the cached token for refresh
with open(GRAPH_CACHE_FILE) as f:
    _GRAPH_SCOPE = f.read()
import re
_scope_match = re.search(r'"scope":\s*"([^"]+)"', _GRAPH_SCOPE)
GRAPH_SCOPES = _scope_match.group(1) if _scope_match else (
    'openid profile email offline_access Calendars.Read Mail.Read Mail.ReadWrite '
    'Files.Read Files.ReadWrite Sites.Read Sites.ReadWrite User.Read'
)

# Smartsheet token
SST = open(SS_API_KEY).read().strip()
SST_HDR = {'Authorization': 'Bearer ' + SST, 'Content-Type': 'application/json'}

# --- Telegram alert ---
def send_telegram(message):
    try:
        tok = open(TELEGRAM_TOKEN_PATH).read().strip()
        if not tok: return
        payload = json.dumps({'chat_id': '8947918104', 'text': message}).encode()
        req = urllib.request.Request(
            f'https://api.telegram.org/bot{tok}/sendMessage',
            data=payload, headers={'Content-Type': 'application/json'})
        urllib.request.urlopen(req, timeout=10)
    except Exception as e:
        print(f'Telegram alert failed: {e}')

# --- Token Refresh ---
def refresh_graph_token():
    """Refresh Microsoft Graph token from msal_tokens.json. Returns access_token or None."""
    try:
        with open(MSAL_TOKEN_FILE) as f: msal = json.load(f)
    except:
        return None
    rt = msal.get('refresh_token')
    if not rt: return None
    body = urllib.parse.urlencode({
        'client_id': CLIENT_ID,
        'refresh_token': rt,
        'grant_type': 'refresh_token',
        'scope': GRAPH_SCOPES,
    }).encode()
    url = f'https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token'
    try:
        req = urllib.request.Request(url, data=body,
            headers={'Content-Type': 'application/x-www-form-urlencoded'})
        resp = json.loads(urllib.request.urlopen(req, timeout=15).read())
        if 'access_token' in resp:
            with open(GRAPH_CACHE_FILE) as f: cache = json.load(f)
            cache['access_token'] = resp['access_token']
            if 'refresh_token' in resp:
                cache['refresh_token'] = resp['refresh_token']
            with open(GRAPH_CACHE_FILE, 'w') as f: json.dump(cache, f, indent=2)
            return resp['access_token']
        return None
    except Exception as e:
        print(f'Token refresh error: {e}')
        return None

# --- Load token (refresh on startup) ---
token = refresh_graph_token()
if not token:
    try:
        with open(GRAPH_CACHE_FILE) as f:
            tok = json.load(f)
            token = tok.get('access_token', '')
    except:
        token = ''
if not token:
    msg = 'FATAL: No Graph access token available. Cannot scan.'
    print(msg)
    send_telegram(msg)
    sys.exit(1)

HDR = {'Authorization': 'Bearer ' + token, 'Accept': 'application/json'}

# Cache column map once (with type info for objectValue writes)
_COL_MAP = None
def get_col_map():
    global _COL_MAP
    if _COL_MAP is None:
        sst = open(SS_API_KEY).read().strip()
        req = urllib.request.Request(
            'https://api.smartsheet.com/2.0/sheets/' + PERSONAL_SHEET_ID + '?include=columnType',
            headers={'Authorization': 'Bearer ' + sst})
        sheet = json.loads(urllib.request.urlopen(req, timeout=15).read())
        _COL_MAP = {c['title']: {'id': c['id'], 'type': c.get('type','')} for c in sheet.get('columns', [])}
    return _COL_MAP

EXCLUDE_FOLDERS = ['junk email', 'deleted items', 'drafts', 'rss feeds', 'conversation history', 'outbox']

def graph_get(path, params=None, retried=False):
    url = 'https://graph.microsoft.com/v1.0' + path
    if params:
        url += '?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers=dict(HDR))
    try:
        return json.loads(urllib.request.urlopen(req, timeout=15).read())
    except urllib.error.HTTPError as e:
        if e.code == 401 and not retried:
            print('  Token expired (401), refreshing...', flush=True)
            new_token = refresh_graph_token()
            if new_token:
                HDR['Authorization'] = 'Bearer ' + new_token
                return graph_get(path, params, retried=True)
        raise
    except (urllib.error.URLError, OSError) as e:
        print(f'  NETWORK ERROR on {path[:30]}...: {e}', flush=True)
        raise

def get_all_folder_ids():
    ids = []
    errors = 0
    def walk(parent_id):
        nonlocal errors
        try:
            res = graph_get('/me/mailFolders/' + parent_id + '/childFolders') if parent_id else graph_get('/me/mailFolders')
            folders = res if isinstance(res, dict) else {'value': []}
        except Exception as e:
            errors += 1
            print(f'  FOLDER enumeratn error: {e}', flush=True)
            return
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
                    except:
                        pass
            except:
                pass
    walk(None)
    return ids, errors

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

# Owner normalization map (for new rows only)
OWNER_MAP = {
    'whitney williams': 'Whitney Williams',
    'whitney': 'Whitney Williams',
    'whitney w': 'Whitney Williams',
    'w. williams': 'Whitney Williams',
    'greg': 'Greg Wieting',
    'greg wieting': 'Greg Wieting',
    'charlie': 'Charlie Tiwana',
    'charlie tiwana': 'Charlie Tiwana',
    'josh': 'Joshua Wood',
    'joshua wood': 'Joshua Wood',
    'sam': 'Sam Kalscheur',
    'sam kalscheur': 'Sam Kalscheur',
}

def normalize_owner(name):
    if not name: return 'TBD'
    m = name.strip()
    key = m.lower()
    # Multi-owner check FIRST
    for sep in [',', ';', '/', '&']:
        if sep in m: return 'TBD'
    if ' and ' in key: return 'TBD'
    if key in OWNER_MAP: return OWNER_MAP[key]
    first = key.split()[0] if ' ' in key else key
    if first in OWNER_MAP: return OWNER_MAP[first]
    return m[:40]

# Commitment detection patterns
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

def get_existing_rows():
    """Get existing rows as (texts_set, ext_ids_set, status_map_by_text)."""
    sst = open(SS_API_KEY).read().strip()
    url = 'https://api.smartsheet.com/2.0/sheets/' + PERSONAL_SHEET_ID + '?rows=1000'
    req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + sst})
    sheet = json.loads(urllib.request.urlopen(req, timeout=15).read())
    rev = {c['id']: c['title'] for c in sheet.get('columns', [])}
    texts = set()
    ext_ids = set()
    status_map = {}
    for r in sheet.get('rows', []):
        row_text = ''
        row_status = ''
        for c in r.get('cells', []):
            col_title = rev.get(c.get('columnId', ''), '')
            v = str(c.get('displayValue') or c.get('value', '')).lower().strip()
            if col_title == 'Action ID' and v:
                row_text = v
                texts.add(v)
            elif col_title == 'ExtractionId' and v:
                ext_ids.add(v)
            elif col_title == 'Status' and v:
                row_status = v
        if row_text:
            status_map[row_text] = row_status
    return texts, ext_ids, status_map

def normalize(t):
    t = t.lower().strip()
    t = re.sub(r'[^\w\s]', ' ', t)
    t = re.sub(r'\s+', ' ', t).strip()
    return t

def jaccard(a, b):
    """Word overlap for 70% threshold match."""
    wa = set(a.split())
    wb = set(b.split())
    if not wa or not wb: return 0
    wa = {w for w in wa if len(w) > 2}
    wb = {w for w in wb if len(w) > 2}
    if not wa or not wb: return 0
    inter = wa & wb
    union = wa | wb
    return len(inter) / len(union)

def stage_item(text, owner, source_ref):
    """POST to Vercel /api/stage endpoint (routes through guarded-write.js)."""
    if DRY_RUN:
        return 'DRY_RUN', 'N/A'
    
    payload = json.dumps({
        'text': text,
        'owner': owner,
        'sourceRef': source_ref,
        'source': 'Email',
        'status': 'Open',
        'category': 'General Coordination',
        'confidence': 'High',
    }).encode()
    
    for _ in range(3):
        try:
            req = urllib.request.Request('https://level-up-playbook.vercel.app/api/stage',
                data=payload, headers={'Content-Type': 'application/json'}, method='POST')
            resp = json.loads(urllib.request.urlopen(req, timeout=30).read())
            if resp.get('status') == 'staged' or resp.get('rowId'):
                return 'OK', str(resp.get('rowId', '?'))
            return 'FAIL', '?'
        except urllib.error.HTTPError as e:
            body = e.read().decode()[:300]
            if 'Duplicate' in body or 'Guard rejected' in body:
                print(f'    [GUARD] {body[:120]}', flush=True)
                return 'DUP', '?'
            if e.code in (400, 422):
                print(f'    [STAGE HTTP {e.code}] {body[:120]}', flush=True)
                return 'FAIL', '?'
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

# ============================================================================
# Main
# ============================================================================
print('=== Level Up Mail Scanner (Graph API) ===')
print('Mode: ' + ('DRY RUN' if DRY_RUN else 'LIVE'))
print(flush=True)

# 1. Load existing rows for dedup
existing_texts, existing_ext_ids, existing_statuses = get_existing_rows()
existing_norm = {normalize(t) for t in existing_texts}
print(f'Existing rows: {len(existing_texts)}', flush=True)

# 2. Enumerate folders
print('Enumerating folders...', flush=True)
folder_ids, folder_errors = get_all_folder_ids()
print(f'Folders: {len(folder_ids)} (errors: {folder_errors})', flush=True)

# 3. Compute scan window
now = datetime.now(timezone.utc)
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
print(f'Window: max(last_run.json) -> {since}', flush=True)

# 4. Scan folders
staged_count = 0
skipped_no_commitment = 0
skipped_dup = 0
skipped_noise = 0
skipped_closed = 0
scanned_count = 0
folder_scan_errors = 0

for fid, fname, parent in folder_ids:
    try:
        msgs = scan_folder_body(fid, since, fname)
    except Exception as e:
        print(f'  ERROR scanning {fname}: {e}', flush=True)
        folder_scan_errors += 1
        continue
    if not msgs: continue
    scanned_count += 1
    print(f'  {fname}: {len(msgs)} msgs', flush=True)
    for mid, subj, body, sender, rdate, has_atts in msgs:
        if should_skip(subj):
            skipped_noise += 1
            continue

        commitments = extract_commitments(subj, body)
        if not commitments:
            skipped_no_commitment += 1
            continue

        for comm, ptype in commitments:
            # Dedup 1: ExtractionId
            ext_hash = hashlib.md5((subj + '|' + comm).encode()).hexdigest()[:16]
            if ext_hash in existing_ext_ids:
                skipped_dup += 1
                continue

            # Dedup 2: Normalized text + closed check
            tag = normalize(comm)
            if tag in existing_norm:
                existing_status = existing_statuses.get(tag, '')
                if existing_status in ('closed', 'complete', 'archived'):
                    skipped_closed += 1
                    continue
                skipped_dup += 1
                continue

            # Dedup 3: Jaccard 70% with closed check
            is_dup = False
            for et in existing_texts:
                if jaccard(tag, normalize(et)) >= 0.70:
                    matched_status = existing_statuses.get(et, '')
                    if matched_status in ('closed', 'complete', 'archived'):
                        skipped_closed += 1
                    else:
                        skipped_dup += 1
                    is_dup = True
                    break
            if is_dup:
                continue

            owner = normalize_owner('Whitney Williams')
            status, rid = stage_item(comm, owner, 'LevelUpMail:' + fname + ':' + rdate)
            staged_count += 1
            if status == 'OK':
                existing_texts.add(tag)
                existing_norm.add(tag)
                existing_ext_ids.add(ext_hash)
            elif status == 'DUP':
                pass
            src = sender.split('@')[0] if '@' in sender else sender
            print(f'    [{status}][{ptype}] {comm[:65]} ({src})', flush=True)

# 5. Summary
print()
summary = (f'Folders:{scanned_count} Staged:{staged_count} '
           f'NoCommitment:{skipped_no_commitment} Dup:{skipped_dup} '
           f'Closed:{skipped_closed} Noise:{skipped_noise} '
           f'FolderErrs:{folder_scan_errors}')
mode = 'DRY RUN' if DRY_RUN else 'LIVE'
print(f'=== {mode} COMPLETE - {summary} ===', flush=True)

# 6. Determine run status
run_failed = False
fail_reason = None

if len(folder_ids) == 0 and folder_errors > 0:
    run_failed = True
    fail_reason = f'Zero folders found ({folder_errors} enumeration errors)'
elif folder_scan_errors > 0:
    run_failed = True
    fail_reason = f'{folder_scan_errors} folder scan errors (auth or network)'

if DRY_RUN:
    log_run('dry_run', staged_count,
            skipped_no_commitment + skipped_dup + skipped_closed + skipped_noise,
            scanned_count, fail_reason)
else:
    if run_failed:
        log_run('failed', staged_count,
                skipped_no_commitment + skipped_dup + skipped_closed + skipped_noise,
                scanned_count, fail_reason)
        alert_msg = f'Mail scan FAILED: {fail_reason}'
        print(f'\n{alert_msg}', flush=True)
        send_telegram(alert_msg)
    else:
        log_run('live', staged_count,
                skipped_no_commitment + skipped_dup + skipped_closed + skipped_noise,
                scanned_count, None)
        try:
            with open(LAST_RUN_FILE) as f: lr = json.load(f)
            lr['email_level_up'] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
            with open(LAST_RUN_FILE, 'w') as f: json.dump(lr, f, indent=2)
        except Exception as e:
            print(f'WARNING: could not update last_run.json: {e}', flush=True)

print('=== DONE ===', flush=True)