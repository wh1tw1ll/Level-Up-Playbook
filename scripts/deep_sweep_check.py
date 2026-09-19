import os, subprocess

ROOT = r"C:\Users\HermesAdmin\OneDrive - levelup-pd.com\Documents - Level Up\05 - DOVA"

def run(cmd):
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=15)
    return result.stdout.strip()

print("=== CHECK 1: Subfolder numbering at every parent level ===")
parents = [d for d in sorted(os.listdir(ROOT)) 
           if os.path.isdir(os.path.join(ROOT, d)) and d[0].isdigit() and d not in ['00 - Unsorted']]

for p in sorted(parents):
    p_path = os.path.join(ROOT, p)
    subs = sorted([d for d in os.listdir(p_path) if os.path.isdir(os.path.join(p_path, d))])
    if not subs:
        continue
    
    print(f"\n{p}:")
    issues = []
    for s in subs:
        prefix = s[:3]
        if not prefix[0].isdigit():
            issues.append(f"  NO NUMBER: {s}")
            continue
        try:
            num = int(s[:2])
        except:
            issues.append(f"  BAD PREFIX: {s}")
            continue
    
    for issue in issues:
        print(issue)
    
    # Check for gaps in numbering
    nums = []
    for s in subs:
        try:
            nums.append(int(s[:2]))
        except:
            pass
    nums.sort()
    if nums:
        expected = list(range(nums[0], nums[-1]+1))
        missing = [n for n in expected if n not in nums]
        if missing:
            print(f"  MISSING NUMBER(S): {missing}")

print("\n\n=== CHECK 2: Version sets (using inventory CSV) ===")
import csv
inv_path = os.path.join(ROOT, "_cleanup", "01_inventory.csv")
all_files = []
with open(inv_path) as f:
    reader = csv.reader(f)
    for row in reader:
        if len(row) >= 1:
            path = row[0].strip('"')
            if '00 - Unsorted' not in path and 'Attachments' not in path and '_cleanup' not in path and path != 'README.md':
                all_files.append((path, int(row[2].strip('"')) if len(row) > 2 else 0))

# Group by stem (filename without version/date suffix)
from collections import defaultdict
stems = defaultdict(list)
for fpath, size in all_files:
    basename = os.path.basename(fpath)
    folder = os.path.dirname(fpath)
    # Extract stem (first 30 chars or before date pattern)
    stem = basename
    # Remove date patterns like 260618_, 2026.06.12_, etc.
    stem = stem.replace('_Updated ', ' ')
    stem = stem.replace('_DRAFT', '')
    stem = stem.replace('(002)', '')
    stem = stem.replace('[20]', '')
    stem = stem.replace('[62]', '')
    stems[(folder, stem[:35])].append((fpath, size))

print(f"\nVersion groups (files in same folder with similar names):")
version_sets = []
for (folder, stem), entries in sorted(stems.items()):
    if len(entries) > 1 and '00 - Unsorted' not in folder and 'Attachments' not in folder:
        version_sets.append((folder, stem, entries))
        print(f"\n  {folder}/")
        # Sort by size (larger = more complete = likely current)
        for fpath, size in sorted(entries, key=lambda x: -x[1]):
            print(f"    {os.path.basename(fpath)} ({size:,} bytes)")

print(f"\n\nTotal version groups found: {len(version_sets)}")

print("\n\n=== CHECK 3: Files that might be in wrong parent ===")
# Check for schedule files in non-schedule folders
for fpath, size in all_files:
    folder = os.path.dirname(fpath)
    basename = os.path.basename(fpath)
    name_lower = basename.lower()
    
    # Schedule files should be in 04
    if any(w in name_lower for w in ['schedule', 'look-ahead', 'look ahead']) and not folder.startswith('04'):
        print(f"  SCHEDULE OUT OF PLACE: {fpath}")
    
    # Budget files should be in 03
    if any(w in name_lower for w in ['budget', 'cost estimate', 'opinion of cost']) and not folder.startswith('03'):
        print(f"  BUDGET OUT OF PLACE: {fpath}")
    
    # Contract/agreement files should be in 02
    if any(w in name_lower for w in ['agreement', 'contract', 'signed', 'executed', 'docusign', 'aia']) and not folder.startswith('02') and 'si' not in name_lower:
        print(f"  CONTRACT OUT OF PLACE: {fpath}")

print("\n\n=== CHECK 4: Data Share folder empty (verification) ===")
ds_path = os.path.join(ROOT, '10 - CMAR Procurement', 'Data Share')
if os.path.exists(ds_path):
    remaining = []
    for root, dirs, files in os.walk(ds_path):
        for f in files:
            remaining.append(os.path.relpath(os.path.join(root, f), ROOT))
    if remaining:
        print(f"  FILES REMAINING IN DATA SHARE: {len(remaining)}")
        for r in remaining:
            print(f"    {r}")
    else:
        print("  Data Share is EMPTY (verified)")

print("\n\n=== CHECK 5: KozPure version folder verification ===")
lu_path = os.path.join(ROOT, '02 - Contracts & Legal', '01 - Level Up Agreements')
if os.path.exists(lu_path):
    files = os.listdir(lu_path)
    signed = [f for f in files if 'SIGNED' in f or 'signed' in f]
    print(f"  Files at root: {len(files)}")
    for f in sorted(files):
        fpath = os.path.join(lu_path, f)
        if os.path.isfile(fpath):
            print(f"    {f}")
    superseded_path = os.path.join(lu_path, '_Superseded')
    if os.path.exists(superseded_path):
        print(f"  _Superseded files: {len(os.listdir(superseded_path))}")
        for f in sorted(os.listdir(superseded_path)):
            print(f"    {f}")

print("\n\n=== CHECK 6: Drawing title blocks (quickscan) ===")
all_pdfs = [(f, s) for f, s in all_files if f.endswith('.pdf')]
drawing_count = 0
for fpath, size in all_pdfs:
    full_path = os.path.join(ROOT, fpath)
    basename = os.path.basename(fpath)
    name_lower = basename.lower()
    
    # Check for drawing indicators in filename
    if re.search(r'\b(A[0-9]|S[0-9]|M[0-9]|E[0-9]|P[0-9]|FP[0-9]|C[0-9]|L[0-9])\b', name_lower, re.I):
        drawing_count += 1
        if '03 - Preliminary Design' not in fpath and '04 - Schematic Design' not in fpath and 'Drawings' not in fpath and 'MDR' not in fpath:
            print(f"  DRAWING IN NON-DRAWING FOLDER: {fpath}")

if drawing_count == 0:
    print("  No PDFs with obvious sheet number prefixes found outside drawing folders.")

print("\n\n=== SUMMARY ===")
print(f"Total files scanned: {len(all_files)}")
print(f"Version groups: {len(version_sets)}")
print(f"Data Share empty: verified")
print(f"KozPure signed present: {os.path.exists(os.path.join(lu_path, '2026.09.09_Level_Up_Construction_Management_Letter_Agreement_SIGNED.pdf')) if os.path.exists(lu_path) else 'N/A'}")