#!/usr/bin/env python3
"""
Comprehensive Smartsheet Cleanup Script for Level-Up Playbook (Sheet 4456864287772548)

STAGE 1 - Text Cleanup (bold stars, trailing owners, dates, Granola suffixes)
STAGE 2 - Owner Extraction (from cleaned text)
STAGE 3 - Deduplication (identical/near-identical action text → close dupe rows)
STAGE 4 - Category Derivation (keyword-based)
STAGE 5 - Discipline Derivation (keyword + firm-based)
STAGE 6 - Responsible Firm (owner map + text scan)

Uses batch PUT /sheets/{SID}/rows with chunks of 200.
"""
import json, sys, os, re, urllib.request, urllib.error
from collections import Counter

# ── Config ──────────────────────────────────────────────────────────────────
SID = '4456864287772548'

COL_ACTION      = 6748787438817156
COL_OWNER       = 9000587252502404
COL_CATEGORY    = 146108531380100
COL_DISCIPLINE  = 5143077301555076
COL_FIRM        = 4134793731936132
COL_SOURCE      = 8456023679209348
COL_PROJECT     = 6920668081590148
COL_STATUS      = 2258381950979972
COL_EXTRACTION  = 1375775527571332
COL_STATUS_NOTE = 384970075705220

TOKEN_PATH = r'C:\Users\HermesAdmin\ss_api_key.txt'
TOKEN = open(TOKEN_PATH).read().strip()
HDR = {'Authorization': f'Bearer {TOKEN}', 'Content-Type': 'application/json'}

KNOWN_OWNERS = [
    'Whitney','Sam','Don','Greg','Justin','Charlie','Josh','Albert','Graham',
    'Jordan','Andrew','Orlana','Chuck','Philip','Jeremiah','DeRay','Matt',
    'Brian','Mike','Todd','Joseph','Chris','David','Phil'
]
OWNER_SET = set(o.lower() for o in KNOWN_OWNERS)

KNOWN_FIRMS = [
    'Level Up', 'KozPure', 'Perkins & Will', 'Wood Rogers', 'McCarthy',
    'Hunt', 'Suffolk', 'JCI', 'Martin/Martin', 'ME Engineers', 'WJHW',
    'i5LED', 'Kroll', 'Ankura', 'Lamartic', 'Venur', 'Dream Seats',
    'Delgado', 'DCL', 'Promethean', 'Steiner Atlantic', 'AmpThink', 'Santana'
]

OWNER_TO_FIRM = {
    'Whitney': 'Level Up', 'Greg': 'Level Up', 'Sam': 'Level Up',
    'Charlie': 'KozPure', 'Josh': 'KozPure', 'Joseph': 'Level Up/Alhambra',
    'Orlana': 'Level Up', 'Graham': 'Ankura', 'Jordan': 'Level Up',
    'Albert': 'Wood Rogers', 'Philip': 'KozPure'
}

CATEGORY_KEYWORDS = {
    'Financial': ['budget','cost','pricing','payment','dispute','invoice',
                  'pay app','cash flow','ewa'],
    'Entitlements': ['permit','condition of approval','coa','public works',
                     'planning commission','zoning','caltrans','traffic study','cup'],
    'Design & Plans': ['design','schematic','plans','drawings','specification','sd'],
    'Schedule': ['schedule','milestone','timeline','date','deadline'],
    'Legal & Contracts': ['contract','loi','agreement','nda','redline','terms'],
    'Procurement': ['vendor','sub','contractor','rfp','proposal','equipment','procurement'],
    'General Coordination': ['meeting','call','email','coordinate','follow up','align'],
    'Utilities & Infrastructure': ['utility','smud','pge','sewer','water','power','drain'],
    'Construction': ['construction','punch list','closeout','backcharge','defect']
}

DISCIPLINE_KEYWORDS = {
    'Structural': ['structural'],
    'Civil': ['civil'],
    'MEP': ['electrical','mep','hvac','mechanical','plumbing'],
    'Architecture': ['architecture'],
    'Geotechnical': ['geotechnical'],
    'IT/AV/Security/Technology': ['it','av','security','technology']
}

DISCIPLINE_FIRM_MAP = {
    'Wood Rogers': 'Civil',
    'Martin/Martin': 'Structural',
    'ME Engineers': 'MEP',
    'WJHW': 'Acoustics/AV',
    'JCI': 'MEP'
}

# ── Helpers ─────────────────────────────────────────────────────────────────
def log(msg):
    print(msg)
    sys.stdout.flush()

def get_sheet():
    url = f'https://api.smartsheet.com/2.0/sheets/{SID}?rows=2000'
    req = urllib.request.Request(url, headers=HDR)
    return json.loads(urllib.request.urlopen(req).read())

def cell_val(cells, col_id):
    for c in cells:
        if c.get('columnId') == col_id:
            v = c.get('displayValue') or c.get('value') or ''
            return str(v).strip()
    return ''

def batch_update(updates, stage_label):
    """Send PUT /sheets/{SID}/rows in batches of 200."""
    if not updates:
        log(f'  {stage_label}: 0 rows to update')
        return
    total = len(updates)
    log(f'  {stage_label}: updating {total} rows...')
    for i in range(0, total, 200):
        batch = updates[i:i+200]
        body = json.dumps(batch).encode()
        url = f'https://api.smartsheet.com/2.0/sheets/{SID}/rows'
        req = urllib.request.Request(url, data=body, headers=HDR, method='PUT')
        try:
            resp = json.loads(urllib.request.urlopen(req).read())
            code = resp.get('resultCode', -1)
            msg = resp.get('message', '?')[:60]
            log(f'    batch {i//200+1}/{(total-1)//200+1}: {len(batch)} rows → {code} {msg}')
        except urllib.error.HTTPError as e:
            err_body = e.read().decode()
            log(f'    ⚠ batch {i//200+1} HTTP {e.code}: {err_body[:200]}')
        except Exception as e:
            log(f'    ⚠ batch {i//200+1} FAILED: {e}')

def parse_rows(sheet):
    rows = []
    for r in sheet.get('rows', []):
        cells = r.get('cells', [])
        rows.append({
            'id': r['id'],
            'action': cell_val(cells, COL_ACTION),
            'owner': cell_val(cells, COL_OWNER),
            'category': cell_val(cells, COL_CATEGORY),
            'discipline': cell_val(cells, COL_DISCIPLINE),
            'firm': cell_val(cells, COL_FIRM),
            'source': cell_val(cells, COL_SOURCE),
            'project': cell_val(cells, COL_PROJECT),
            'status': cell_val(cells, COL_STATUS),
            'extraction': cell_val(cells, COL_EXTRACTION),
            'status_note': cell_val(cells, COL_STATUS_NOTE),
        })
    return rows


# ══════════════════════════════════════════════════════════════════════════════
# STAGE 1 - Text Cleanup
# ══════════════════════════════════════════════════════════════════════════════
def stage1_clean_text(rows):
    """
    Per row:
    1. Remove **bold** markdown stars (keep inner text)
    2. Strip trailing " | From Granola/..." suffix
    3. Strip trailing (date) like (2026-09-16)
    4. Strip trailing (OwnerName) - last parenthetical containing known owner(s)
    """
    stars_count = 0   # count of rows that HAD **
    owners_count = 0
    dates_count = 0
    suffixes_count = 0
    changes = 0
    updates = []

    for rd in rows:
        action = rd['action']
        if not action:
            continue

        original = action
        had_stars = '**' in action

        # 1. Remove **bold** markers — keep inner text
        action = re.sub(r'\*\*(.+?)\*\*', r'\1', action)

        # 2. Strip trailing " | From ..." suffix (any "| From ..." to end)
        action = re.sub(r'\s*\|\s*From\s+.*$', '', action).strip()

        # 3. Strip standalone date stamps anywhere (YYYY-MM-DD)
        action = re.sub(r'\s*\(\d{4}-\d{2}-\d{2}\)', '', action).strip()

        # 4. Strip trailing (OwnerName) patterns at end of text
        while True:
            m = re.search(r'\(([^)]*)\)\s*$', action)
            if not m:
                break
            inside = m.group(1).strip()
            parts = [p.strip() for p in re.split(r'[,/]\s*', inside) if p.strip()]
            if parts and all(p.lower() in OWNER_SET for p in parts):
                action = action[:m.start()].strip()
            else:
                break  # not an owner paren, keep it

        if action == original:
            continue

        changes += 1
        if had_stars:
            stars_count += 1
        if action != re.sub(r'\*\*(.+?)\*\*', r'\1', original):
            pass  # stars counted above
        if '| From' in original:
            suffixes_count += 1
        if re.search(r'\(\d{4}-\d{2}-\d{2}\)', original):
            dates_count += 1
        if re.search(r'\(([^)]*)\)\s*$', original):
            inside_check = re.search(r'\(([^)]*)\)\s*$', original)
            if inside_check:
                pts = [p.strip() for p in re.split(r'[,/]\s*', inside_check.group(1)) if p.strip()]
                if pts and all(p.lower() in OWNER_SET for p in pts):
                    owners_count += 1

        updates.append({
            'id': rd['id'],
            'cells': [{'columnId': COL_ACTION, 'value': action}]
        })
        rd['action'] = action  # update for downstream

    log(f'  Rows with **stars** cleaned:    {stars_count}')
    log(f'  Trailing owners stripped:       {owners_count}')
    log(f'  Date stamps stripped:            {dates_count}')
    log(f'  Granola suffixes stripped:       {suffixes_count}')
    log(f'  Total rows with text changes:    {changes}')
    return updates, {
        'stars': stars_count, 'owners_stripped': owners_count,
        'dates': dates_count, 'suffixes': suffixes_count, 'total': changes
    }


# ══════════════════════════════════════════════════════════════════════════════
# STAGE 2 - Owner Extraction
# ══════════════════════════════════════════════════════════════════════════════
def stage2_extract_owner(rows):
    """For rows with blank Owner: check cleaned action text for known owners."""
    found = 0
    updates = []

    for rd in rows:
        if rd['owner']:
            continue
        action = rd['action']
        if not action:
            continue

        owner = None

        # 1. Trailing (OwnerName) still present
        m = re.search(r'\(([^)]*)\)\s*$', action)
        if m:
            pts = [p.strip() for p in re.split(r'[,/]\s*', m.group(1)) if p.strip()]
            if len(pts) == 1 and pts[0].lower() in OWNER_SET:
                owner = pts[0]

        # 2. Beginning of text: "Whitney to ..." "Whitney:" "Whitney -"
        if not owner:
            for o in KNOWN_OWNERS:
                if re.match(re.escape(o) + r'[\s\:\-]', action, re.IGNORECASE):
                    owner = o
                    break

        # 3. "OwnerName said/mentioned/asked/confirmed/..."
        if not owner:
            verbs = 'said|mentioned|asked|confirmed|shared|noted|requested|proposed|suggested|emailed|texted|called|notified|indicated|reported|advised|recommended'
            for o in KNOWN_OWNERS:
                if re.search(r'\b' + re.escape(o) + r'\s+(' + verbs + r')', action, re.IGNORECASE):
                    owner = o
                    break

        # 4. Source-specific: STAGED/personal status_note check
        if not owner:
            src = rd.get('source', '').lower()
            if 'staged' in src or 'personal' in src:
                sn = rd.get('status_note', '')
                for o in KNOWN_OWNERS:
                    if o.lower() in sn.lower():
                        owner = o
                        break

        if owner:
            found += 1
            rd['owner'] = owner
            updates.append({
                'id': rd['id'],
                'cells': [{'columnId': COL_OWNER, 'value': owner}]
            })

    log(f'  Owners extracted: {found}')
    return updates, {'found': found}


# ══════════════════════════════════════════════════════════════════════════════
# STAGE 3 - Deduplication
# ══════════════════════════════════════════════════════════════════════════════
def stage3_dedup(rows):
    """Group rows by first 60 chars of action text; keep richer one, close the other."""
    groups = {}
    for rd in rows:
        if not rd['action']:
            continue
        key = rd['action'][:60].lower().strip()
        groups.setdefault(key, []).append(rd)

    removed = 0
    updates = []

    for key, group in groups.items():
        if len(group) < 2:
            continue

        # Sort by completeness (more filled fields = better)
        def completeness(rd):
            return sum(1 for f in ['action','owner','category','discipline','firm','project','source'] if rd.get(f, ''))

        group.sort(key=completeness, reverse=True)
        keeper = group[0]
        dupes = group[1:]

        for dupe in dupes:
            removed += 1
            link = f'{keeper["id"]}/{dupe["id"]}'

            # Link extraction IDs on both
            updates.append({
                'id': keeper['id'],
                'cells': [{'columnId': COL_EXTRACTION, 'value': link}]
            })
            updates.append({
                'id': dupe['id'],
                'cells': [{'columnId': COL_EXTRACTION, 'value': link}]
            })
            # Mark dupe as duplicate
            updates.append({
                'id': dupe['id'],
                'cells': [{'columnId': COL_STATUS, 'value': 'Duplicate'}]
            })

    groups_with_dupes = len([g for g in groups.values() if len(g) > 1])
    log(f'  Duplicate groups found:          {groups_with_dupes}')
    log(f'  Rows marked as duplicates:       {removed}')
    log(f'  Total cell updates needed:       {len(updates)}')
    return updates, {'removed': removed, 'groups': groups_with_dupes}


# ══════════════════════════════════════════════════════════════════════════════
# STAGE 4 - Category Derivation
# ══════════════════════════════════════════════════════════════════════════════
def stage4_derive_category(rows):
    """For rows with blank Category: keyword-scan action text + project."""
    assigned = 0
    updates = []

    for rd in rows:
        if rd['category']:
            continue
        combined = (rd['action'] + ' ' + rd['project']).lower()

        best_cat = None
        best_score = 0
        for cat, keywords in CATEGORY_KEYWORDS.items():
            score = sum(1 for kw in keywords if kw.lower() in combined)
            if score > best_score:
                best_score = score
                best_cat = cat

        if best_cat:
            assigned += 1
            rd['category'] = best_cat
            updates.append({
                'id': rd['id'],
                'cells': [{'columnId': COL_CATEGORY, 'value': best_cat}]
            })

    log(f'  Categories assigned: {assigned}')
    return updates, {'assigned': assigned}


# ══════════════════════════════════════════════════════════════════════════════
# STAGE 5 - Discipline Derivation
# ══════════════════════════════════════════════════════════════════════════════
def stage5_derive_discipline(rows):
    """For rows with blank Discipline: firm-map + keyword-scan."""
    assigned = 0
    updates = []

    for rd in rows:
        if rd['discipline']:
            continue
        combined = (rd['action'] + ' ' + rd['project']).lower()

        discipline = None

        # 1. Firm-based mapping
        for firm, disc in DISCIPLINE_FIRM_MAP.items():
            if firm.lower() in combined:
                discipline = disc
                break

        # 2. Keyword-based
        if not discipline:
            best_disc = None
            best_score = 0
            for disc, keywords in DISCIPLINE_KEYWORDS.items():
                score = sum(1 for kw in keywords if kw.lower() in combined)
                if score > best_score:
                    best_score = score
                    best_disc = disc
            discipline = best_disc

        if discipline:
            assigned += 1
            rd['discipline'] = discipline
            updates.append({
                'id': rd['id'],
                'cells': [{'columnId': COL_DISCIPLINE, 'value': discipline}]
            })

    log(f'  Disciplines assigned: {assigned}')
    return updates, {'assigned': assigned}


# ══════════════════════════════════════════════════════════════════════════════
# STAGE 6 - Responsible Firm
# ══════════════════════════════════════════════════════════════════════════════
def stage6_derive_firm(rows):
    """For ALL blank-firm rows: owner→firm map, text scan, source_ref."""
    assigned = 0
    owner_mapped = 0
    text_mapped = 0
    updates = []

    for rd in rows:
        if rd['firm']:
            continue

        firm = None

        # 1. Owner→Firm map
        owner = rd.get('owner', '')
        if owner and owner in OWNER_TO_FIRM:
            firm = OWNER_TO_FIRM[owner]
            owner_mapped += 1

        # 2. Text scan for known firm names
        if not firm:
            action = rd.get('action', '')
            if action:
                for fn in KNOWN_FIRMS:
                    if fn.lower() in action.lower():
                        firm = fn
                        text_mapped += 1
                        break

        # 3. Granola source → status_note scan
        if not firm:
            src = rd.get('source', '').lower()
            if 'granola' in src:
                sn = rd.get('status_note', '')
                for fn in KNOWN_FIRMS:
                    if fn.lower() in sn.lower():
                        firm = fn
                        text_mapped += 1
                        break

        if firm:
            assigned += 1
            rd['firm'] = firm
            updates.append({
                'id': rd['id'],
                'cells': [{'columnId': COL_FIRM, 'value': firm}]
            })

    log(f'  From owner map:  {owner_mapped}')
    log(f'  From text scan:  {text_mapped}')
    log(f'  Total firms assigned: {assigned}')
    return updates, {'assigned': assigned, 'owner_mapped': owner_mapped, 'text_mapped': text_mapped}


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════
def main():
    log('=' * 60)
    log('LEVEL-UP PLAYBOOK — SMARTSHEET CLEANUP')
    log('=' * 60)

    # Fetch
    log('\n📡 Fetching sheet data...')
    sheet = get_sheet()
    rows = parse_rows(sheet)
    log(f'Loaded {len(rows)} rows')

    # Count blanks before
    b_owner = sum(1 for r in rows if not r['owner'])
    b_cat   = sum(1 for r in rows if not r['category'])
    b_disc  = sum(1 for r in rows if not r['discipline'])
    b_firm  = sum(1 for r in rows if not r['firm'])
    log(f'Blanks before: Owner={b_owner}  Cat={b_cat}  Disc={b_disc}  Firm={b_firm}')

    # ── Stage 1 ──
    log('\n📋 STAGE 1: Text Cleanup')
    s1_updates, s1_r = stage1_clean_text(rows)
    batch_update(s1_updates, 'Stage 1')

    # ── Stage 2 ──
    log('\n📋 STAGE 2: Owner Extraction')
    s2_updates, s2_r = stage2_extract_owner(rows)
    batch_update(s2_updates, 'Stage 2')

    # ── Stage 3 ──
    log('\n📋 STAGE 3: Deduplication')
    s3_updates, s3_r = stage3_dedup(rows)
    batch_update(s3_updates, 'Stage 3')

    # ── Stage 4 ──
    log('\n📋 STAGE 4: Category Derivation')
    s4_updates, s4_r = stage4_derive_category(rows)
    batch_update(s4_updates, 'Stage 4')

    # ── Stage 5 ──
    log('\n📋 STAGE 5: Discipline Derivation')
    s5_updates, s5_r = stage5_derive_discipline(rows)
    batch_update(s5_updates, 'Stage 5')

    # ── Stage 6 ──
    log('\n📋 STAGE 6: Responsible Firm')
    s6_updates, s6_r = stage6_derive_firm(rows)
    batch_update(s6_updates, 'Stage 6')

    # ── Report ──
    log('\n' + '=' * 60)
    log('📊 CLEANUP REPORT')
    log('=' * 60)

    log('\nSTAGE 1 — Text Cleanup:')
    log(f'  Rows with **stars** removed:      {s1_r["stars"]}')
    log(f'  Trailing owners stripped:         {s1_r["owners_stripped"]}')
    log(f'  Date stamps stripped:             {s1_r["dates"]}')
    log(f'  Granola suffixes stripped:        {s1_r["suffixes"]}')

    log(f'\nSTAGE 2 — Owner Extraction:')
    log(f'  Owners extracted from text:       {s2_r["found"]}')

    log(f'\nSTAGE 3 — Deduplication:')
    log(f'  Duplicate groups found:           {s3_r["groups"]}')
    log(f'  Rows marked as duplicates:        {s3_r["removed"]}')

    log(f'\nSTAGE 4 — Category Derivation:')
    log(f'  Categories assigned:              {s4_r["assigned"]}')
    cat_counts = Counter(r['category'] for r in rows if r['category'])
    if cat_counts:
        log(f'  Breakdown:')
        for cat, cnt in sorted(cat_counts.items(), key=lambda x: -x[1]):
            log(f'    {cat}: {cnt}')

    log(f'\nSTAGE 5 — Discipline Derivation:')
    log(f'  Disciplines assigned:             {s5_r["assigned"]}')
    disc_counts = Counter(r['discipline'] for r in rows if r['discipline'])
    if disc_counts:
        log(f'  Breakdown:')
        for d, cnt in sorted(disc_counts.items(), key=lambda x: -x[1]):
            log(f'    {d}: {cnt}')

    log(f'\nSTAGE 6 — Responsible Firm:')
    log(f'  From owner map:                   {s6_r["owner_mapped"]}')
    log(f'  From text scan:                   {s6_r["text_mapped"]}')
    log(f'  Total firms assigned:             {s6_r["assigned"]}')
    firm_counts = Counter(r['firm'] for r in rows if r['firm'])
    if firm_counts:
        log(f'  Breakdown:')
        for f, cnt in sorted(firm_counts.items(), key=lambda x: -x[1]):
            log(f'    {f}: {cnt}')

    # Final blanks
    a_owner = sum(1 for r in rows if not r['owner'])
    a_cat   = sum(1 for r in rows if not r['category'])
    a_disc  = sum(1 for r in rows if not r['discipline'])
    a_firm  = sum(1 for r in rows if not r['firm'])
    log(f'\n📉 BLANK FIELDS SUMMARY:')
    log(f'  Owner:       {b_owner} → {a_owner}  (filled {b_owner - a_owner})')
    log(f'  Category:    {b_cat} → {a_cat}  (filled {b_cat - a_cat})')
    log(f'  Discipline:  {b_disc} → {a_disc}  (filled {b_disc - a_disc})')
    log(f'  Firm:        {b_firm} → {a_firm}  (filled {b_firm - a_firm})')

    log('\n✅ Done!')

if __name__ == '__main__':
    main()