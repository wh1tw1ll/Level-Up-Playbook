"""Stage 2 continued + Stage 4-6: Fill blanks and finish cleanup."""
import json, urllib.request, sys, os, re

def get_token():
    for env_name in ('.env.local', '.env.development', '.env'):
        env_path = os.path.join(os.path.dirname(__file__), '..', env_name)
        if os.path.exists(env_path):
            with open(env_path) as f:
                for line in f:
                    line = line.strip()
                    if line.startswith('SMARTSHEET_TOKEN'):
                        parts = line.split('=', 1)
                        if len(parts) == 2:
                            val = parts[1].strip().strip("'").strip('"')
                            if val and val != '[SENSITIVE]':
                                return val
    return ''

TOKEN = get_token()
if not TOKEN:
    print('ERROR: no SMARTSHEET_TOKEN')
    sys.exit(1)

H = {'Authorization': f'Bearer {TOKEN}', 'Content-Type': 'application/json'}
SID = '4456864287772548'

# Column IDs
ACOL=6748787438817156
OCOL=9000587252502404
CCOL=146108531380100
DCOL=5143077301555076
FCOL=4134793731936132
PCOL=6920668081590148
SCOL=8456023679209348

OWNERS_LIST = ['Whitney','Sam','Don','Greg','Justin','Charlie','Josh','Albert','Graham','Jordan','Andrew','Orlana','Chuck','Philip','Jeremiah','DeRay','Matt','Brian','Mike','Todd','Joseph','Chris','David','Phil']

FIRMS = {'Level Up': ['Level Up','Level Up PD','Level Up Project Development'],'KozPure':['KozPure','Koz'],'Perkins & Will':['Perkins','P&W','Perkins and Will'],'Wood Rogers':['Wood Rogers','Wood Rogers'],'McCarthy':['McCarthy'],'Hunt':['Hunt','Hunt Construction'],'Suffolk':['Suffolk'],'JCI':['JCI','JCI2'],'Martin/Martin':['Martin'],'ME Engineers':['ME Engineer','ME Eng'],'WJHW':['WJHW'],'i5LED':['i5LED','i5'],'Kroll':['Kroll'],'Ankura':['Ankura'],'AmpThink':['AmpThink'],'Santana':['Santana']}

OWNER_TO_FIRM = {
    'Whitney':'Level Up','Whitney Williams':'Level Up','Greg':'Level Up','Sam':'Level Up','Sam Kalscheur':'Level Up',
    'Jordan':'Level Up','Orlana':'Level Up','Justin':'Level Up','DeRay':'Level Up',
    'Charlie':'KozPure','Charlie Tiwana':'KozPure','Josh':'KozPure','Philip':'KozPure','Chuck':'KozPure',
    'Albert':'Wood Rogers','Matt':'Wood Rogers',
    'Graham':'Ankura','Joseph':'Ankura','Andrew':'Ankura',
    'Brian':'JCI','Mike':'JCI',
    'Todd':'Undefined','David':'Undefined','Chris':'Undefined','Jeremiah':'City of Rancho Cordova'
}

print('Fetching sheet...')
req = urllib.request.Request(f'https://api.smartsheet.com/2.0/sheets/{SID}', headers=H)
sheet = json.loads(urllib.request.urlopen(req, timeout=30).read())
rows = sheet.get('rows', [])

all_cells = {}
for r in rows:
    cells = {}
    for c in r.get('cells', []):
        cells[c.get('columnId')] = str(c.get('displayValue') or c.get('value') or '')
    all_cells[r['id']] = cells

print(f'Total rows: {len(rows)}')

# ─── CATEGORY DERIVATION ───
print('\n=== STAGE 4: Category Derivation ===')
cat_rules = [
    ('Financial', ['budget','cost','pricing','payment','dispute','invoice','pay app','cash flow','ewa','fund','insurance','premium','coverage','bond']),
    ('Entitlements', ['permit','condition of approval','coa','public works','planning commission','zoning','altrans','traffic study','cup','entitle','conditional use','trigger point','inspection milestone','drainage study','cultural','biologist','hcp','mitigation']),
    ('Design & Plans', ['esign','chematic','lans','rawings','pecification','sd','design','architectural','structural','ivil','floor plan','elevation','rendering']),
    ('Schedule', ['chedule','ilestone','imeline','eadline','uration','coordination drawing','baseline schedule']),
    ('Legal & Contracts', ['ontract','loi','greement','nda','edline','term','language','ause','suit','precedent','ownership','risk']),
    ('Procurement', ['endor','ub','ontractor','rfp','roposal','quipment','rocurement','oods','upplier','reight','material']),
    ('General Coordination', ['eeting','all','mail','oordinate','ollow up','lign','ntroduce','utreach','iscuss','onfirm','ouching base','econnect']),
    ('Utilities & Infrastructure', ['tility','mud','pge','ewer','ater','ower','rain','lectric','as','ire','lvac','ve','mep']),
    ('Construction', ['onstruction','unch list','loseout','ackcharge','efect','unchlist','unch-list'])
]

cat_updates = []
for row_id, cells in all_cells.items():
    action = cells.get(ACOL, '')
    project = cells.get(PCOL, '')
    current_cat = cells.get(CCOL, '')
    if current_cat:
        continue  # Already has category
    
    al = action.lower()
    assigned = ''
    for cat, kws in cat_rules:
        for kw in kws:
            if kw in al:
                assigned = cat
                break
        if assigned:
            break
    
    if assigned:
        cat_updates.append({'row_id': row_id, 'cat': assigned})

print(f'Category assignments: {len(cat_updates)}')
cat_counts = {}
for u in cat_updates:
    cat_counts[u['cat']] = cat_counts.get(u['cat'], 0) + 1
for cat, n in sorted(cat_counts.items(), key=lambda x: -x[1]):
    print(f'  {cat}: {n}')

# ─── DISCIPLINE DERIVATION ───
print('\n=== STAGE 5: Discipline Derivation ===')
disc_rules = [
    ('Structural', ['tructural','teel','oncrete','oundation','frame','column','oad bearing']),
    ('Civil', ['ivil','rading','ite work','rainage','torm','avement','road','curb','walk']),
    ('MEP', ['mep','lectrical','vac','lumbing','ire','ecurity','as','ower','enerator','witchgear','hvac','echanical']),
    ('Architecture', ['rchitecture','rchitectural','loor plan','oom','nterior','inish','hell','esign development']),
    ('Geotechnical', ['eotech','oil','eotechnical']),
    ('AV/Technology', ['v','udio','isual','i5','ed','coreboard','as','isplay','ound','peaker','coustic','tech'])
]

disc_updates = []
for row_id, cells in all_cells.items():
    action = cells.get(ACOL, '')
    current_disc = cells.get(DCOL, '')
    if current_disc:
        continue
    
    al = action.lower()
    assigned = ''
    for disc, kws in disc_rules:
        for kw in kws:
            if kw in al:
                assigned = disc
                break
        if assigned:
            break
    
    if assigned:
        disc_updates.append({'row_id': row_id, 'disc': assigned})

print(f'Discipline assignments: {len(disc_updates)}')

# ─── RESPONSIBLE FIRM ───
print('\n=== STAGE 6: Responsible Firm ===')
firm_updates = []
for row_id, cells in all_cells.items():
    action = cells.get(ACOL, '')
    current_firm = cells.get(FCOL, '')
    if current_firm:
        continue
    
    owner = cells.get(OCOL, '')
    source = cells.get(SCOL, '')
    
    # First: check if owner maps to a firm
    firm_assigned = ''
    if owner in OWNER_TO_FIRM:
        firm_assigned = OWNER_TO_FIRM[owner]
    
    # Second: scan action text for known firm names
    if not firm_assigned:
        al = action.lower()
        for firm_name, patterns in FIRMS.items():
            for p in patterns:
                if p.lower() in al:
                    firm_assigned = firm_name
                    break
            if firm_assigned:
                break
    
    if firm_assigned and firm_assigned not in ('Undefined', ''):
        firm_updates.append({'row_id': row_id, 'firm': firm_assigned})

print(f'Firm assignments: {len(firm_updates)}')

# ─── APPLY ───
print('\n=== APPLYING ===')

def apply_batch(col_id, updates, label):
    batch_size = 200
    total = len(updates)
    for i in range(0, total, batch_size):
        batch = updates[i:i+batch_size]
        body = json.dumps([{
            'id': u['row_id'],
            'cells': [{'columnId': col_id, 'value': u[list(u.keys())[1]]}]
        } for u in batch]).encode()
        try:
            req2 = urllib.request.Request(f'https://api.smartsheet.com/2.0/sheets/{SID}/rows',
                data=body, headers=H, method='PUT')
            res = json.loads(urllib.request.urlopen(req2, timeout=30).read())
            print(f'  {label} batch {i//batch_size+1}: {len(batch)} - {res.get("message","OK")}')
        except Exception as e:
            print(f'  {label} batch {i//batch_size+1} ERROR: {e}')

apply_batch(CCOL, cat_updates, 'Category')
apply_batch(DCOL, disc_updates, 'Discipline')
apply_batch(FCOL, firm_updates, 'Firm')

print('\n=== DONE ===')
print(f'Category: {len(cat_updates)}')
print(f'Discipline: {len(disc_updates)}')
print(f'Firm: {len(firm_updates)}')

# Refresh and show final count
req3 = urllib.request.Request(f'https://api.smartsheet.com/2.0/sheets/{SID}', headers=H)
sheet3 = json.loads(urllib.request.urlopen(req3, timeout=30).read())
rows3 = sheet3.get('rows', [])
blanks = {'owner':0,'cat':0,'disc':0,'firm':0}
for r in rows3:
    for c in r.get('cells',[]):
        cid=c.get('columnId')
        v=str(c.get('displayValue') or c.get('value') or '')
        if cid==OCOL and not v: blanks['owner']+=1
        elif cid==CCOL and not v: blanks['cat']+=1
        elif cid==DCOL and not v: blanks['disc']+=1
        elif cid==FCOL and not v: blanks['firm']+=1
print(f'Final blanks: Owner={blanks["owner"]} Cat={blanks["cat"]} Disc={blanks["disc"]} Firm={blanks["firm"]}')