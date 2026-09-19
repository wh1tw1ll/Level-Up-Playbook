import os, subprocess

ROOT = r"C:\Users\HermesAdmin\OneDrive - levelup-pd.com\Documents - Level Up\05 - DOVA"

def run(cmd):
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=15)
    return result.stdout.strip()

# Get all directories
dirs_raw = run(f'find "{ROOT}" -type d -not -path "*/_cleanup/*"')
dirs = [d for d in dirs_raw.split('\n') if d.strip()]

print(f"Total directories: {len(dirs)}")

problems = []
for d in sorted(dirs):
    quoted = d.replace('"', '\\"')
    fc = run(f'find "{quoted}" -maxdepth 1 -type f 2>/dev/null | wc -l')
    sc = run(f'find "{quoted}" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l')
    filecnt = int(fc) if fc.isdigit() else 0
    subcnt = int(sc) if sc.isdigit() else 0
    if filecnt > 0 and subcnt > 0:
        rel = d.replace(ROOT, '').lstrip('\\').lstrip('/')
        depth = rel.count('\\')
        problems.append((depth, rel, filecnt, subcnt))

print(f"\n=== LOOSE FILES IN FOLDERS WITH SUBDIRS ({len(problems)}) ===")
for depth, rel, files, subs in sorted(problems):
    print(f"  d={depth} | {files} files | {subs} subdirs | {rel}")

print("\n\n=== ALL NON-LEAF FOLDERS SORTED ===")
for depth, rel, files, subs in sorted(problems):
    folder_path = os.path.join(ROOT, rel)
    subdirs = [d for d in sorted(dirs) if d.startswith(folder_path) and d != folder_path and '\\' not in d[len(folder_path)+1:]]
    print(f"\n--- {rel} ---")
    print(f"  Subdirs: {len(subdirs)}")
    for sd in subdirs:
        sd_basename = os.path.basename(sd)
        sdfc = run(f'find "{sd}" -maxdepth 1 -type f 2>/dev/null | wc -l')
        print(f"    {sd_basename} ({sdfc} files)")
    
    # List loose files
    files_raw = run(f'find "{folder_path}" -maxdepth 1 -type f 2>/dev/null')
    for f in files_raw.split('\n'):
        if f.strip():
            basename = os.path.basename(f)
            size = run(f'stat -c%s "{f}" 2>/dev/null || echo 0')
            print(f"    LOOSE: {basename} ({size} bytes)")