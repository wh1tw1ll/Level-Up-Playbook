"""
Phase 2 sweep: classify every file at every depth in 05 - DOVA
Outputs CSV with proposed actions for each file.
"""
import csv, os, re, sys
from collections import defaultdict

ROOT = r"C:\Users\HermesAdmin\OneDrive - levelup-pd.com\Documents - Level Up\05 - DOVA"

# Read inventory
inventory = []  # list of dicts
with open(os.path.join(ROOT, "_cleanup", "01_inventory.csv")) as f:
    for line in f:
        parts = line.strip().split('","')
        if len(parts) < 6:
            continue
        path = parts[0].lstrip('"')
        try:
            depth = int(parts[1])
        except:
            depth = 0
        try:
            size = int(parts[2])
        except:
            size = 0
        mtime = parts[3]
        hashval = parts[4].strip()
        try:
            plen = int(parts[5].rstrip('"'))
        except:
            plen = len(path)
        inventory.append({
            'path': path, 'depth': depth, 'size': size,
            'mtime': mtime, 'hash': hashval, 'plen': plen
        })

print(f"Inventory: {len(inventory)} files")

# Build folder tree: folder -> {subfolders, files}
folder_tree = {}  # folder_path -> {'subs': set(), 'files': [], 'depth': int}
for e in inventory:
    p = e['path']
    # Get containing folder
    folder = os.path.dirname(p)
    if folder not in folder_tree:
        folder_tree[folder] = {'subs': set(), 'files': [], 'depth': 0}
    folder_tree[folder]['files'].append(e)
    
    # Register subfolder relationship
    parent = os.path.dirname(folder)
    if parent:
        if parent not in folder_tree:
            folder_tree[parent] = {'subs': set(), 'files': [], 'depth': 0}
        folder_tree[parent]['subs'].add(folder)

# Set depths
for fpath, info in folder_tree.items():
    if fpath == '':
        info['depth'] = 0
    else:
        info['depth'] = fpath.count('/')

print(f"Folders: {len(folder_tree)}")
print(f"Folders with subfolders and loose files:")
for fpath, info in sorted(folder_tree.items()):
    if info['subs'] and info['files']:
        loose_count = len(info['files'])
        sub_count = len(info['subs'])
        if loose_count > 0:
            print(f"  {fpath} ({loose_count} loose files, {sub_count} subdirs)")

# Now classify each file
manifest = []

def get_parent_folder(path):
    return os.path.dirname(path)

def is_leaf_folder(folder):
    """True if this folder has no subfolders"""
    return folder not in folder_tree or len(folder_tree[folder]['subs']) == 0

def is_root_parent(folder):
    """True if folder is a direct child of DOVA root"""
    return folder and '/' not in folder and folder != '00 - Unsorted' and folder != ''

def skip_reason(path):
    """Check if file should be skipped"""
    # Attachments - never touch
    if path.startswith('Attachments/') or '/Attachments/' in path:
        return "SKIP: Attachments auto-filed"
    # Already in _cleanup
    if path.startswith('_cleanup/') or '/_cleanup/' in path:
        return "SKIP: cleanup internal"
    # Already in 00 - Unsorted
    if path.startswith('00 - Unsorted/') or '/00 - Unsorted/' in path:
        return "SKIP: unsorted holding area"
    # README.md at root
    if path == 'README.md':
        return "SKIP: root README"
    return None

def classify_root_parent(text):
    """Given text content of a file, identify which parent folder it belongs to"""
    t = text.lower() if text else ''
    
    # Master PM Agreement / Contracts
    if any(w in t for w in ['project management agreement', 'master project management', 'pm agreement',
                             'owner representative', 'level up construction management']):
        return '02 - Contracts & Legal'
    
    # Schedule
    if any(w in t for w in ['master schedule', 'project schedule', 'look ahead', 'schedule strategy',
                             'permitting schedule', 'phased schedule']):
        return '04 - Project Schedule'
    
    # Design / Engineering
    if any(w in t for w in ['schematic design', 'design development', 'construction documents',
                             'architectural', 'structural', 'civil', 'mep', 'mechanical',
                             'specification', 'drawing', 'title block', 'perkins & will',
                             'wood rodgers', 'buehler', 'martin & martin', 'jci']):
        return '05 - Design & Engineering'
    
    # Financial
    if any(w in t for w in ['budget', 'opinion of cost', 'cost estimate', 'invoice',
                             'payment', 'financial', 'pricing', 'quote']):
        return '03 - Financial'
    
    # Contracts
    if any(w in t for w in ['agreement', 'contract', 'nda', 'confidentiality', 'docusign',
                             'signed', 'executed', 'aia', 'dbia', 'term sheet', 'letter agreement']):
        return '02 - Contracts & Legal'
    
    # Submittals / Permitting
    if any(w in t for w in ['major design review', 'mdr', 'submittal', 'permit', 'permitting',
                             'entitlement', 'zoning', 'condition of approval']):
        return '08 - Submittals & Permitting'
    
    # Insurance
    if any(w in t for w in ['ocip', 'insurance', 'wrap up', 'alliant']):
        return '09 - Insurance'
    
    # CMAR / Procurement
    if any(w in t for w in ['cmar', 'procurement', 'hunt', 'turner', 'suffolk', 'crossland',
                             'level 10', 'mccarthy', 'precon', 'qualification',
                             'interview agenda']):
        return '10 - CMAR Procurement'
    
    # Executive reporting
    if any(w in t for w in ['delivery method', 'weekly report', 'monthly report',
                             'executive', 'status report']):
        return '06 - Executive Reporting'
    
    # Project management
    if any(w in t for w in ['project background', 'meeting minutes', 'action item',
                             'org chart', 'responsibility matrix', 'kickoff',
                             'preconstruction', 'site logistics']):
        return '01 - Project Management'
    
    return None

def get_content_identifier(path, text):
    """Identify what document this is based on text"""
    t = text.lower() if text else ''
    
    # Check for AIA forms
    if re.search(r'a133|a134|a201|b133|b201', t):
        return 'aia_form'
    
    if re.search(r'dbia|544|535', t):
        return 'dbia_form'
    
    # Check for specific firms
    if re.search(r'perkins.?will', t):
        return 'perkins_will'
    if re.search(r'wood rodgers', t):
        return 'wood_rodgers'
    if re.search(r'youngdahl', t):
        return 'youngdahl_geotech'
    if re.search(r'smith.?s consulting|smith.?s', t):
        return 'smith_consulting'
    if re.search(r'alliant', t):
        return 'alliant_insurance'
    if re.search(r'bloom energy', t):
        return 'bloom_energy'
    if re.search(r'envac', t):
        return 'envac'
    if re.search(r'e24420', t):
        return 'youngdahl_project'
    
    # Drawing sheets
    if re.search(r'sheet|plan|section|elevation|detail|floor plan|site plan', t) and any(w in t for w in ['civil', 'architect', 'landscape', 'structural', 'mep']):
        return 'drawing'
    
    # Shields against misclassification
    if re.search(r'render|visual|image|picture|jpeg|jpg|png', t):
        return 'rendering'
    
    return None

# ============================================================
# Read PDF text with PyMuPDF
# ============================================================
def read_pdf_text(path):
    try:
        import fitz
        doc = fitz.open(path)
        text = ''
        for page in doc:
            text += page.get_text()
        doc.close()
        return text[:5000]
    except:
        return ''

def read_docx_text(path):
    try:
        import docx
        d = docx.Document(path)
        text = '\n'.join(p.text for p in d.paragraphs)
        return text[:5000]
    except:
        return ''

def read_xlsx_text(path):
    try:
        import openpyxl
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        text = ''
        for sheet in wb.sheetnames:
            ws = wb[sheet]
            for row in ws.iter_rows(min_row=1, max_row=5, values_only=True):
                text += ' '.join(str(c) for c in row if c is not None) + '\n'
            if text:
                break
        wb.close()
        return text[:2000]
    except:
        return ''

def read_msg_text(path):
    try:
        with open(path, 'rb') as f:
            raw = f.read(5000)
        text = raw.decode('utf-8', errors='replace')
        # Extract subject, from, to
        subj = re.search(r'Subject:\s*(.+?)[\r\n]', text, re.I)
        frm = re.search(r'From:\s*(.+?)[\r\n]', text, re.I)
        subj_text = subj.group(1) if subj else ''
        frm_text = frm.group(1) if frm else ''
        return f"From: {frm_text} Subject: {subj_text}"
    except:
        return ''

def read_eml_text(path):
    try:
        with open(path, 'r', encoding='utf-8', errors='replace') as f:
            text = f.read(5000)
        subj = re.search(r'Subject:\s*(.+?)[\r\n]', text, re.I)
        subj_text = subj.group(1) if subj else ''
        return f"Subject: {subj_text}"
    except:
        return ''

# ============================================================
# Build the manifest
# ============================================================

ext_readers = {
    '.pdf': read_pdf_text,
    '.docx': read_docx_text,
    '.xlsx': read_xlsx_text,
    '.xls': read_xlsx_text,
    '.msg': read_msg_text,
    '.eml': read_eml_text,
}

# For the full sweep, classify each file
seq = 0
rows = []

for e in inventory:
    path = e['path']
    skip = skip_reason(path)
    if skip:
        rows.append([seq, 'SKIPPED', path, path, skip, 'H', e['hash']])
        seq += 1
        continue
    
    folder = os.path.dirname(path)
    is_loose = folder in folder_tree and folder_tree[folder]['subs']
    
    ext = os.path.splitext(path)[1].lower()
    text = ''
    
    # Read file content if possible
    full_path = os.path.join(ROOT, path)
    if ext in ext_readers and os.path.exists(full_path):
        try:
            text = ext_readers[ext](full_path)
        except:
            text = ''
    
    # For files we can't read, use filename
    basename = os.path.basename(path)
    name_lower = basename.lower()
    
    # Default: NO CHANGE (stays where it is)
    action = 'NO CHANGE'
    dest = path
    reason = 'Already in correct location'
    confidence = 'H'
    
    # ============================================================
    # LOGIC: If loose (folder has subfolders), push down
    # ============================================================
    if is_loose:
        # Determine which subfolder this file belongs in
        subfolder = classify_to_subfolder(folder, path, text)
        if subfolder and subfolder != folder:
            dest = os.path.join(subfolder, basename)
            action = 'MOVE'
            reason = f'Loose file, filed into {os.path.basename(subfolder)}'
            confidence = 'M' if not text else 'H'
    
    # ============================================================
    # LOGIC: Check if file belongs in a DIFFERENT parent altogether
    # ============================================================
    current_parent = folder.split('/')[0] if '/' in folder else folder
    if current_parent:
        classified_parent = classify_root_parent(text or name_lower)
        if classified_parent and classified_parent != current_parent and current_parent != '00 - Unsorted':
            # File is in wrong parent
            new_folder = folder.replace(current_parent, classified_parent, 1)
            dest = os.path.join(new_folder, basename)
            action = 'MOVE'
            reason = f'Belongs in {classified_parent}, not {current_parent}'
            confidence = 'M'
    
    rows.append([seq, action, path, dest, reason, confidence, e['hash']])
    seq += 1

# Write plan
plan_path = os.path.join(ROOT, "_cleanup", "03_full_sweep_plan.csv")
with open(plan_path, 'w', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['ID', 'Action', 'Source', 'Destination', 'Reason', 'Confidence', 'SHA256'])
    for r in rows:
        writer.writerow(r)

print(f"\nPlan written: {plan_path}")
print(f"Total rows: {seq}")
actions = defaultdict(int)
for r in rows:
    actions[r[1]] += 1
for a, c in sorted(actions.items()):
    print(f"  {a}: {c}")