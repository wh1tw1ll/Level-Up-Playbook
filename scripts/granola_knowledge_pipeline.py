#!/usr/bin/env python3
"""
granola_knowledge_pipeline.py — Full Granola transcript ingestion + Smartsheet enrichment.
Three phases:
  1. Fetch ALL Granola notes (paginated), get full detail (summary_markdown, attendees, calendar_event)
  2. Save to local JSON knowledge base
  3. Fill remaining Smartsheet blanks (Owner, Category, Discipline) using transcript context
"""
import json, os, time, re, sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError

# ── CONFIG ──────────────────────────────────────────────────────────
HOME = 'C:/Users/HermesAdmin'
TOKEN_PATH = f'{HOME}/.hermes/granola_token.txt'
SM_TOKEN_PATH = f'{HOME}/.hermes/.smartsheet_token'
KNOWLEDGE_PATH = f'{HOME}/Level-Up-Playbook/data/granola_knowledge.json'
SHEET_ID = '4456864287772548'

GRANOLA_API = 'https://public-api.granola.ai/v1'
SMARTSHEET_API = 'https://api.smartsheet.com/2.0'

# Column names in Smartsheet Action Tracker
COL_NAMES = {
    'ACTION_ID': 'Action ID',
    'STATUS': 'Status',
    'OWNER': 'Owner',
    'CATEGORY': 'Category',
    'DISCIPLINE': 'Discipline',
    'TITLE': 'Action ID',  # No Meeting Title column; use Action ID for context
    'FIRM': 'Responsible Firm(s)',
}

# ── TOKENS ──────────────────────────────────────────────────────────
def read_token(path):
    with open(path) as f:
        return f.read().strip()

# ── HTTP HELPERS ────────────────────────────────────────────────────
def json_get(url, token):
    req = Request(url, headers={'Authorization': f'Bearer {token}'})
    try:
        resp = urlopen(req)
        return json.loads(resp.read())
    except HTTPError as e:
        body = e.read().decode() if e.fp else ''
        print(f'HTTP {e.code} on GET {url[:80]}')
        if body:
            print(f'  Response: {body[:300]}')
        raise

def json_get_detail(note_id, token):
    url = f'{GRANOLA_API}/notes/{note_id}'
    return json_get(url, token)

def smartsheet_get(path, token):
    url = f'{SMARTSHEET_API}{path}'
    return json_get(url, token)

def smartsheet_put(url, body, token):
    data = json.dumps(body).encode()
    req = Request(url, data=data, method='PUT',
                  headers={'Authorization': f'Bearer {token}',
                           'Content-Type': 'application/json'})
    resp = urlopen(req)
    return json.loads(resp.read())

# ── PHASE 1: FETCH ALL GRANOLA NOTES ───────────────────────────────
def fetch_all_notes(token):
    """Fetch ALL Granola notes with full detail."""
    all_ids = []
    cursor = None

    # First pass: list all note IDs
    print('Fetching note list...')
    while True:
        url = f'{GRANOLA_API}/notes?page_size=30'
        if cursor:
            url += f'&cursor={cursor}'
        data = json_get(url, token)
        notes = data.get('notes', [])
        for n in notes:
            all_ids.append(n['id'])
        if not data.get('hasMore') or not data.get('cursor'):
            break
        cursor = data['cursor']
        time.sleep(0.3)

    print(f'Found {len(all_ids)} notes total')

    # Second pass: fetch full detail for each
    details = {}
    for i, nid in enumerate(all_ids):
        try:
            detail = json_get_detail(nid, token)
            details[nid] = detail
            if (i + 1) % 10 == 0:
                print(f'  Fetched {i+1}/{len(all_ids)}...')
        except HTTPError as e:
            print(f'  Error {nid}: HTTP {e.code}')
        time.sleep(0.2)

    print(f'Fetched details for {len(details)} notes')
    return details

# ── PHASE 2: SAVE KNOWLEDGE BASE ──────────────────────────────────
def save_knowledge_base(details):
    """Save full transcript knowledge base."""
    records = []
    for nid, d in details.items():
        cal = d.get('calendar_event') or {}
        rec = {
            'id': nid,
            'title': d.get('title', ''),
            'web_url': d.get('web_url', ''),
            'created_at': d.get('created_at', ''),
            'updated_at': d.get('updated_at', ''),
            'summary_markdown': d.get('summary_markdown') or '',
            'summary_text': d.get('summary_text') or '',
            'attendees': d.get('attendees', []),
            'calendar_event': {
                'event_title': cal.get('event_title', ''),
                'organiser': cal.get('organiser', ''),
                'scheduled_start': cal.get('scheduled_start_time', ''),
                'scheduled_end': cal.get('scheduled_end_time', ''),
                'invitees': cal.get('invitees', []),
                'calendar_event_id': cal.get('calendar_event_id', ''),
            },
        }
        records.append(rec)

    os.makedirs(os.path.dirname(KNOWLEDGE_PATH), exist_ok=True)
    with open(KNOWLEDGE_PATH, 'w', encoding='utf-8') as f:
        json.dump({'notes': records, 'count': len(records), 'fetched_at': time.strftime('%Y-%m-%dT%H:%M:%SZ')}, f,
                  indent=2, ensure_ascii=False)
    print(f'Saved {len(records)} notes to {KNOWLEDGE_PATH}')
    return records

# ── PHASE 3: FILL SMARTSHEET BLANKS ────────────────────────────────
def build_meeting_context(records):
    """Build a lookup: meeting title -> best available context (attendees, summary)."""
    ctx = {}
    for r in records:
        title = r.get('title', '').strip()
        if not title:
            continue
        # Normalize title: strip prefixes like "FW:", "Re:"
        clean = re.sub(r'^(FW|Re|RE|FWD):\s*', '', title).strip()
        ctx[clean] = {
            'summary': r.get('summary_text', '')[:2000],
            'attendees': [a.get('name', '') for a in r.get('attendees', []) if a.get('name')],
            'organiser': r.get('calendar_event', {}).get('organiser', ''),
        }
        # Also index by normalized lowercase
        ctx[clean.lower()] = ctx[clean]
    return ctx

def smart_match_owner(meeting_title, meeting_context, text):
    """Determine Owner from meeting context + action text."""
    ctx = meeting_context or {}
    attendees = ctx.get('attendees', [])
    # 1. Check if action text mentions someone: (Name) or @Name
    m = re.search(r'[\(@]([A-Z][a-zA-Z\s.]+?)[\)]', text)
    if m:
        name = m.group(1).strip()
        return name
    # 2. Check if meeting title contains a name
    name_match = re.search(r'(Greg|Whitney|Charlie|Sam|Jordan|Chris|Mike|Jeff|Jason|David)\s+(\w+)', meeting_title)
    if name_match:
        return name_match.group(0)
    # 3. If no clear owner, check attendees
    if attendees:
        # If only 1-2 attendees, it's probably them
        non_whitney = [a for a in attendees if 'whitney' not in a.lower() and 'williams' not in a.lower()]
        if len(non_whitney) == 1:
            return non_whitney[0]
    return ''

def smart_match_category(meeting_title, text, summary):
    """Derive Category from meeting title + summary content."""
    combined = f'{meeting_title} {text} {summary}'.lower()

    keywords = {
        'Design': ['design', 'schematic', 'dd', 'cd', 'drawing', 'bim', 'model', 'enclosure', 'architecture',
                   'structural', 'mep', 'civil', 'landscape', 'review set', 'specification'],
        'Pre-Construction': ['precon', 'estimate', 'bid', 'trade', 'subcontractor', 'procurement', 'buyout',
                             'pricing', 'quote', 'rfq', 'scope of work', 'rfi'],
        'Construction': ['construction', 'installation', 'erection', 'field', 'site', 'pour', 'foundation',
                         'steel', 'concrete', 'framing', 'rough-in', 'finish', 'punch list'],
        'Coordination': ['coordination', 'coordination meeting', 'touch base', 'touchbase', 'weekly',
                         'standing', 'logistics', 'phasing', 'sequence', 'clash'],
        'Funding': ['funding', 'budget', 'grant', 'bond', 'financing', 'appropriation', 'allocation', 'appropriated'],
        'Closeout': ['closeout', 'close-out', 'commissioning', 'turnover', 'handover', 'punch'],
        'Planning': ['planning', 'entitlement', 'zoning', 'permitting', 'approval', 'public hearing',
                     'commission', 'municipal', 'city council', 'development agreement'],
        'Legal': ['legal', 'contract', 'agreement', 'amendment', 'change order', 'claim', 'lien',
                  'negotiation', 'term sheet', 'mou'],
        'Owner': ['owner meeting', 'board', 'stakeholder', 'client update', 'executive'],
    }

    scores = {}
    for cat, kws in keywords.items():
        score = sum(1 for kw in kws if kw in combined)
        if score > 0:
            scores[cat] = score

    if scores:
        return max(scores, key=scores.get)
    return ''

def smart_match_discipline(meeting_title, text, summary):
    """Derive Discipline from meeting title + summary content."""
    combined = f'{meeting_title} {text} {summary}'.lower()

    keywords = {
        'Architecture': ['architecture', 'architect', 'design architect', 'aor', 'enclosure', 'facade',
                         'interior', 'finish', 'material'],
        'Structure': ['structure', 'structural', 'steel', 'concrete', 'foundation', 'seismic', 'superstructure'],
        'MEP': ['mechanical', 'electrical', 'plumbing', 'mep', 'hvac', 'fire protection', 'sprinkler',
                'lighting', 'power', 'low voltage', 'fp'],
        'Civil': ['civil', 'site', 'grading', 'drainage', 'utility', 'road', 'paving', 'stormwater'],
        'Enclosure': ['enclosure', 'facade', 'curtain wall', 'glazing', 'roofing', 'waterproofing', 'storefront'],
        'Technology': ['technology', 'av', 'audio', 'video', 'scoreboard', 'it', 'network', 'broadcast', 'data'],
        'Food Service': ['food', 'kitchen', 'concession', 'fnb', 'f&b', 'restaurant', 'hospitality'],
        'Landscape': ['landscape', 'hardscape', 'planting', 'irrigation', 'site amenity'],
        'General': ['general', 'gc', 'construction manager', 'precon', 'estimate'],
        'Commissioning': ['commissioning', 'cx', 'testing', 'balancing', 'tab'],
    }

    scores = {}
    for disc, kws in keywords.items():
        score = sum(1 for kw in kws if kw in combined)
        if score > 0:
            scores[disc] = score

    if scores:
        return max(scores, key=scores.get)
    return ''

def fill_smartsheet_blanks(records, sm_token):
    """Fill blank Owner, Category, Discipline cells using Granola context."""
    ctx = build_meeting_context(records)

    print('\n=== Filling Smartsheet Blanks ===')
    sheet = smartsheet_get(f'/sheets/{SHEET_ID}', sm_token)

    # Build column lookup with types
    col_map = {c['title']: c for c in sheet.get('columns', [])}
    action_id_col = col_map.get('Action ID', {}).get('id')
    owner_col = col_map.get('Owner', {}).get('id')
    cat_col = col_map.get('Category', {}).get('id')
    disc_col = col_map.get('Discipline', {}).get('id')
    title_col = col_map.get('Action ID', {}).get('id')  # No Meeting Title column; use Action ID

    # Store column types for objectValue format
    col_types = {c['title']: c.get('type') for c in sheet.get('columns', [])}

    def make_cell(col_id, col_name, val):
        """Create a cell object using objectValue format if needed."""
        col_type = col_types.get(col_name, 'TEXT_NUMBER')
        if col_type == 'TEXT_NUMBER':
            return {'columnId': col_id, 'objectValue': str(val)}
        elif col_type == 'PICKLIST':
            return {'columnId': col_id, 'objectValue': str(val)}
        else:
            return {'columnId': col_id, 'value': val}

    if not all([action_id_col, owner_col, cat_col, disc_col]):
        print('ERROR: Missing columns in sheet')
        return

    # Find rows with blanks
    rows_to_fix = []
    for row in sheet.get('rows', []):
        cells = {str(c['columnId']): c for c in row.get('cells', [])}

        def get_val(cid):
            c = cells.get(str(cid))
            if not c:
                return ''
            return c.get('displayValue') or c.get('value', '') or ''

        action_text = get_val(action_id_col)
        owner_val = get_val(owner_col)
        cat_val = get_val(cat_col)
        disc_val = get_val(disc_col)
        meeting_title = get_val(title_col)

        if not action_text:
            continue

        needs_owner = not owner_val
        needs_cat = not cat_val
        needs_disc = not disc_val

        if not (needs_owner or needs_cat or needs_disc):
            continue

        # Get earliest meeting context from action_id (format: "[Granola: Meeting Title (date)] action text")
        m = re.match(r'\[Granola:\s*(.+?)\s*\((\d{4}-\d{2}-\d{2})\)\]', action_text)
        note_title = ''
        if m:
            note_title = m.group(1).strip()

        # Look up meeting context
        mc = ctx.get(note_title) or ctx.get(note_title.lower(), {})
        if not mc and note_title:
            # Fuzzy match: find closest title
            for key, val in ctx.items():
                if isinstance(key, str) and note_title.lower() in key.lower():
                    mc = val
                    break

        summary = mc.get('summary', '')

        updates = {}
        if needs_owner:
            o = smart_match_owner(note_title or meeting_title, mc, action_text)
            if o:
                updates['Owner'] = o
        if needs_cat:
            c = smart_match_category(note_title or meeting_title, action_text, summary)
            if c:
                updates['Category'] = c
        if needs_disc:
            d = smart_match_discipline(note_title or meeting_title, action_text, summary)
            if d:
                updates['Discipline'] = d

        if updates:
            rows_to_fix.append((row['id'], updates))

    print(f'Rows to update: {len(rows_to_fix)}')

    # Update in batches (Smartsheet max 10 rows per PUT)
    updated = {k: 0 for k in ['Owner', 'Category', 'Discipline']}

    # Build all update rows using make_cell for proper format
    batch_rows = []
    for row_id, updates in rows_to_fix:
        cells = []
        for col_name, val in updates.items():
            col_id = col_map.get(col_name, {}).get('id')
            if col_id:
                cells.append(make_cell(col_id, col_name, val))
        if cells:
            batch_rows.append({'id': row_id, 'cells': cells})

    # Send in chunks of 10
    for i in range(0, len(batch_rows), 10):
        chunk = batch_rows[i:i+10]
        try:
            smartsheet_put(
                f'{SMARTSHEET_API}/sheets/{SHEET_ID}/rows',
                chunk,
                sm_token
            )
            for row in chunk:
                for cell in row['cells']:
                    cid = cell['columnId']
                    if cid == owner_col: updated['Owner'] += 1
                    elif cid == cat_col: updated['Category'] += 1
                    elif cid == disc_col: updated['Discipline'] += 1
            print(f'  Batch {i//10+1}: {len(chunk)} rows updated')
        except HTTPError as e:
            body = e.read().decode() if e.fp else ''
            print(f'  Batch {i//10+1} error: HTTP {e.code} {body[:150]}')

    print(f'\nUpdated: Owner={updated["Owner"]}, Category={updated["Category"]}, Discipline={updated["Discipline"]}')

# ── MAIN ────────────────────────────────────────────────────────────
def main():
    granola_token = read_token(TOKEN_PATH)
    sm_token = read_token(SM_TOKEN_PATH)

    print('═' * 50)
    print('GRANOLA KNOWLEDGE PIPELINE')
    print('═' * 50)

    # Phase 1: Fetch all notes
    details = fetch_all_notes(granola_token)

    # Phase 2: Save knowledge base
    records = save_knowledge_base(details)

    # Phase 3: Fill Smartsheet blanks
    fill_smartsheet_blanks(records, sm_token)

    print(f'\nDone. Knowledge base: {len(records)} notes with full transcripts.')

if __name__ == '__main__':
    main()