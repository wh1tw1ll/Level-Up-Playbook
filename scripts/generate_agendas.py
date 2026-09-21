#!/usr/bin/env python3
"""Agenda Generator — Creates meeting agendas 48 hours in advance.
1. Fetches calendar events ~48h from now
2. Gets Granola notes + open tasks for each meeting
3. Builds formatted agenda
4. Delivers via Telegram"""

import json, urllib.request, urllib.parse, sys, os, re
from datetime import datetime, timezone, timedelta

# ── CONFIG ──────────────────────────────────────────────────────
HOME = r'C:\Users\HermesAdmin'
GRANOLA_TOKEN_PATH = HOME + r'\.hermes\granola_token.txt'
SM_TOKEN_PATH = HOME + r'\.hermes\.smartsheet_token'
MSAL_PATH = HOME + r'\.hermes\msal_tokens.json'
TELEGRAM_TOKEN_PATH = HOME + r'\.hermes\telegram_token.txt'
TELEGRAM_CHAT_ID = '8947918104'  # Whitney's Telegram DM

GRAPH_SCOPES = 'openid profile email offline_access Calendars.Read User.Read'
TENANT_ID = '8222d14d-0869-42d3-8b7f-858c65b89c0e'
CLIENT_ID = 'd43fa6d5-ac58-4c6a-a0a1-083a1573ab03'

CANONICAL = {
    'whitney': 'Whitney Williams', 'whitney williams': 'Whitney Williams',
    'greg': 'Greg Wieting', 'greg wieting': 'Greg Wieting',
    'charlie': 'Charlie Tiwana', 'sam': 'Sam Kalscheur',
    'brandon': 'Brandon', 'victoria': 'Victoria', 'philip': 'Philip',
    'paul': 'Paul', 'orlana': 'Orlana', 'jeremiah': 'Jeremiah',
    'matt': 'Matt', 'thomas': 'Thomas', 'jos': 'Jos',
}

PROJECT_RULES = {
    'dova': 'DOVA', 'cordova': 'DOVA', 'kozpure': 'DOVA',
    'mfp': 'MFP', 'miami freedom': 'MFP', 'boldyn': 'MFP',
    'nhs6': 'Sphere', 'sphere': 'Sphere',
    'level up': 'Business', 'business': 'Business',
}

# ── HELPERS ─────────────────────────────────────────────────────

def read_file(path):
    try:
        with open(path) as f: return f.read().strip()
    except: return None

def get_granola_token():
    return read_file(GRANOLA_TOKEN_PATH)

def resolve_project(subject):
    s = subject.lower()
    for key, proj in PROJECT_RULES.items():
        if key in s: return proj
    return 'Unassigned'

def normalize_owner(name):
    if not name: return None
    key = name.strip().lower()
    return CANONICAL.get(key, name.strip())

def is_whitney(owner):
    if not owner: return False
    return 'whitney' in owner.lower()

def format_time_et(dt_str):
    try:
        d = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
        return d.astimezone().strftime('%I:%M %p ET').lstrip('0')
    except: return dt_str

def format_date(dt_str):
    try:
        d = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
        return d.strftime('%a, %b %d')
    except: return dt_str

def escape_html(s):
    if not s: return ''
    return s.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;')

# ── TELEGRAM ────────────────────────────────────────────────────

def send_telegram(message):
    token = read_file(TELEGRAM_TOKEN_PATH)
    if not token: return False
    data = json.dumps({
        'chat_id': TELEGRAM_CHAT_ID,
        'text': message,
        'parse_mode': 'HTML',
        'disable_notification': False,
    }).encode()
    url = f'https://api.telegram.org/bot{token}/sendMessage'
    try:
        req = urllib.request.Request(url, data=data,
            headers={'Content-Type': 'application/json'})
        resp = json.loads(urllib.request.urlopen(req).read())
        return resp.get('ok', False)
    except Exception as e:
        print(f'Telegram error: {e}')
        return False

# ── GRAPH API ───────────────────────────────────────────────────

def refresh_graph_token():
    msal = json.loads(read_file(MSAL_PATH) or '{}')
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
        resp = json.loads(urllib.request.urlopen(req).read())
        return resp.get('access_token') if not resp.get('error') else None
    except Exception as e:
        print(f'Graph token error: {e}')
        return None

def graph_get(path, token):
    url = f'https://graph.microsoft.com/v1.0{path}'
    try:
        req = urllib.request.Request(url, headers={'Authorization': f'Bearer {token}'})
        return json.loads(urllib.request.urlopen(req).read())
    except Exception as e:
        print(f'Graph error: {e}')
        return None

# ── GRANOLA API ────────────────────────────────────────────────

def granola_list(cursor=None):
    token = get_granola_token()
    if not token: return None
    url = 'https://public-api.granola.ai/v1/notes?page_size=30'
    if cursor: url += '&cursor=' + urllib.parse.quote(cursor)
    try:
        req = urllib.request.Request(url, headers={'Authorization': 'Bearer ' + token})
        return json.loads(urllib.request.urlopen(req).read())
    except Exception as e:
        print(f'Granola list error: {e}')
        return None

def granola_detail(note_id):
    token = get_granola_token()
    if not token: return None
    try:
        req = urllib.request.Request(
            f'https://public-api.granola.ai/v1/notes/{note_id}',
            headers={'Authorization': 'Bearer ' + token})
        return json.loads(urllib.request.urlopen(req).read())
    except: return None

# ── SMARTSHEET ─────────────────────────────────────────────────

def smartsheet_get(path):
    token = read_file(SM_TOKEN_PATH)
    if not token: return None
    url = f'https://api.smartsheet.com/2.0{path}'
    try:
        req = urllib.request.Request(url, headers={'Authorization': f'Bearer {token}'})
        return json.loads(urllib.request.urlopen(req).read())
    except Exception as e:
        print(f'Smartsheet error: {e}')
        return None

def fetch_open_tasks():
    SHEETS = [('4456864287772548', 'project'), ('2802755367554948', 'personal')]
    tasks = []
    for sid, src in SHEETS:
        data = smartsheet_get(f'/sheets/{sid}')
        if not data or not data.get('rows'): continue
        cols = {c['title']: c['id'] for c in data.get('columns', [])}
        for row in data['rows']:
            cells = {}
            for c in row.get('cells', []):
                for title, cid in cols.items():
                    if c['columnId'] == cid:
                        cells[title] = c.get('displayValue') or c.get('value') or ''
            status = str(cells.get('Status', ''))
            if status in ('Complete', 'Archived', 'Closed'): continue
            action = str(cells.get('Action ID', '')).strip()
            if len(action) < 5: continue
            tasks.append({
                'actionItem': action[:150], 'status': status,
                'owner': str(cells.get('Owner', '')),
                'project': str(cells.get('Project', '')),
                'dueDate': str(cells.get('Due Date', '')),
                'category': str(cells.get('Category', '')),
                'statusNote': str(cells.get('Status Note', '')),
                'source': src,
            })
    return tasks

# ── AGENDA ASSEMBLY ────────────────────────────────────────────

def extract_action_items(markdown):
    if not markdown: return []
    items = []; in_ns = False
    for line in markdown.split('\n'):
        t = line.strip()
        if re.match(r'^#+\s+Next Steps', t): in_ns = True; continue
        if in_ns and (t.startswith('---') or (re.match(r'^#+\s', t) and 'Next Steps' not in t)):
            in_ns = False; continue
        if not in_ns or not t.startswith('- '): continue
        om = re.search(r'\(([^)]+)\)\s*$', t)
        owner_raw = om.group(1).strip() if om else None
        am = re.search(r'\*\*(.+?)\*\*', t)
        action = am.group(1).strip() if am else re.sub(r'^- ', '', t).strip()
        action = re.sub(r'\s*\([^)]*\)\s*$', '', action).strip()
        if action and len(action) >= 3:
            items.append({'owner_raw': owner_raw, 'text': action})
    return items

def build_agenda(event, note_detail, tasks):
    subject = event.get('subject', 'Meeting')
    start_str = event.get('start', {}).get('dateTime', '')
    end_str = event.get('end', {}).get('dateTime', '')
    location = event.get('location', {}).get('displayName', '')
    attendees = event.get('attendees', [])
    time_et = format_time_et(start_str)
    date_label = format_date(start_str)
    duration = ''
    if start_str and end_str:
        try:
            s = datetime.fromisoformat(start_str.replace('Z', '+00:00'))
            e = datetime.fromisoformat(end_str.replace('Z', '+00:00'))
            mins = int((e - s).total_seconds() / 60)
            duration = f'{mins//60}h {mins%60}m' if mins >= 60 else f'{mins}m'
        except: pass

    html = f'<b>📋 MEETING AGENDA</b>\n\n'
    html += f'<b>{escape_html(subject)}</b>\n'
    html += f'📅 {date_label} · {time_et}'
    if duration: html += f' · {duration}'
    html += '\n'
    if location: html += f'📍 {escape_html(location)}\n'
    if attendees:
        names = []
        for a in attendees:
            addr = a.get('emailAddress', {})
            name = addr.get('name', '') or addr.get('address', '')
            if a.get('type') == 'organizer': name += ' (organizer)'
            names.append(name)
        html += f'👥 {escape_html(", ".join(names[:10]))}\n'
    html += '\n' + '─' * 25 + '\n\n'

    owned_tasks = [t for t in tasks if t.get('owner') and is_whitney(t.get('owner'))]
    owed_tasks = [t for t in tasks if t.get('owner') and not is_whitney(t.get('owner'))]

    if owned_tasks:
        html += f'<b>WHAT I OWE ({len(owned_tasks)})</b>\n'
        for t in owned_tasks[:8]:
            due = f' | due {t["dueDate"]}' if t.get('dueDate') else ''
            html += f'  ☐ {escape_html(t["actionItem"])}{due}\n'
        if len(owned_tasks) > 8: html += f'  ... +{len(owned_tasks) - 8} more\n'
        html += '\n'

    if owed_tasks:
        html += f'<b>OWED TO ME ({len(owed_tasks)})</b>\n'
        groups = {}
        for t in owed_tasks:
            o = t.get('owner') or 'Unassigned'
            if o not in groups: groups[o] = []
            groups[o].append(t)
        for owner, items in sorted(groups.items()):
            html += f'  👤 {escape_html(owner)}\n'
            for t in items[:3]:
                due = f' | due {t["dueDate"]}' if t.get('dueDate') else ''
                html += f'    ☐ {escape_html(t["actionItem"])}{due}\n'
            if len(items) > 3: html += f'    ... +{len(items) - 3} more\n'
        html += '\n'

    if note_detail:
        summary = note_detail.get('summary_text', '') or ''
        if summary:
            html += f'<b>PREVIOUS MEETING NOTES</b>\n'
            html += f'{escape_html(summary[:500])}\n'
            if len(summary) > 500: html += '...\n'
            html += '\n'
        items = extract_action_items(note_detail.get('summary_markdown', ''))
        if items:
            html += f'<b>PREVIOUS ACTION ITEMS ({len(items)})</b>\n'
            for item in items[:5]:
                owner = normalize_owner(item.get('owner_raw'))
                os = f' [{owner}]' if owner else ''
                html += f'  ☐ {escape_html(item["text"])}{os}\n'
            if len(items) > 5: html += f'  ... +{len(items) - 5} more\n'
            html += '\n'

    due_soon = [t for t in tasks if t.get('dueDate') and t['dueDate'] <= (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')]
    if due_soon:
        html += f'<b>DISCUSSION TOPICS (due this week)</b>\n'
        for t in due_soon[:5]:
            html += f'  🔵 {escape_html(t["actionItem"])} — {escape_html(t["owner"])}\n'
        if len(due_soon) > 5: html += f'  ... +{len(due_soon) - 5} more\n'
        html += '\n'

    html += '─' * 25 + '\n'
    html += f'<i>Generated {datetime.now().strftime("%b %d, %I:%M %p")}</i>'
    return html

# ── MAIN ────────────────────────────────────────────────────────

def match_note_to_event(event, all_notes):
    subject = (event.get('subject') or '').lower().strip()
    for note in all_notes:
        title = (note.get('title') or '').lower().strip()
        sw = set(re.sub(r'[^a-z0-9\s]', '', subject).split())
        tw = set(re.sub(r'[^a-z0-9\s]', '', title).split())
        common = sw & tw
        if len(common) >= 3 and len(common) / max(len(sw), len(tw), 1) >= 0.4:
            return note
    return None

def main():
    print('=== AGENDA GENERATOR ===')
    token = refresh_graph_token()
    if not token: print('FAILED: No Graph token'); sys.exit(1)

    now = datetime.now(timezone.utc)
    target_start = now + timedelta(hours=42)
    target_end = now + timedelta(hours=54)

    data = graph_get(
        f'/me/calendarview?startDateTime={target_start.isoformat()}'
        f'&endDateTime={target_end.isoformat()}'
        f'&$select=subject,start,end,location,id,isAllDay,attendees&$top=20', token)

    if not data or not data.get('value'):
        # Wider window
        target_start = now + timedelta(hours=36)
        target_end = now + timedelta(hours=60)
        data = graph_get(
            f'/me/calendarview?startDateTime={target_start.isoformat()}'
            f'&endDateTime={target_end.isoformat()}'
            f'&$select=subject,start,end,location,id,isAllDay,attendees&$top=20', token)

    events = [e for e in (data.get('value', []) if data else []) if not e.get('isAllDay', False)]
    if not events:
        print('No meetings in window')
        send_telegram('📋 No meetings scheduled in the next 48 hours.')
        sys.exit(0)
    print(f'Meetings: {len(events)}')

    print('Fetching Granola notes...')
    all_notes = []; cursor = None
    while True:
        page = granola_list(cursor)
        if not page: break
        all_notes.extend(page.get('notes', []))
        if not page.get('hasMore') or not page.get('cursor'): break
        cursor = page.get('cursor')
    print(f'Granola notes: {len(all_notes)}')

    print('Fetching tasks...')
    all_tasks = fetch_open_tasks()
    print(f'Tasks: {len(all_tasks)}')

    sent = 0
    for event in events:
        subject = event.get('subject', '')
        if not subject or subject == 'Untitled' or subject.startswith('['): continue

        note = match_note_to_event(event, all_notes)
        note_detail = granola_detail(note['id']) if note else None

        project = resolve_project(subject)
        meeting_tasks = [t for t in all_tasks if t['project'] == project or project == 'Unassigned']

        agenda = build_agenda(event, note_detail, meeting_tasks)
        if send_telegram(agenda):
            print(f'  ✅ {subject}')
            sent += 1
        else:
            print(f'  ❌ {subject}')

    if sent == 0 and events:
        send_telegram(f'📋 Found {len(events)} upcoming meetings but none met agenda criteria.')

    print(f'\nDone. {sent} agendas sent.')
    return 0

if __name__ == '__main__':
    sys.exit(main())