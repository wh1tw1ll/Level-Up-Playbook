import csv, os
from collections import defaultdict

ROOT = "C:\\Users\\HermesAdmin\\OneDrive - levelup-pd.com\\Documents - Level Up\\05 - DOVA"

# Read inventory
inventory = []
with open(os.path.join(ROOT, "_cleanup", "01_inventory.csv")) as f:
    for line in f:
        parts = line.strip().split('","')
        if len(parts) >= 4:
            path = parts[0].lstrip('"')
            size = parts[1]
            mtime = parts[2]
            hashval = parts[3].rstrip('"')
            inventory.append((path, size, mtime, hashval))
print(f"Inventory: {len(inventory)} files")

# Build hash groups for dedup
hash_groups = defaultdict(list)
for path, size, mtime, h in inventory:
    if h and h != "HASH_FAILED":
        hash_groups[h].append(path)
dups = {h: paths for h, paths in hash_groups.items() if len(paths) > 1}
print(f"Duplicate groups: {len(dups)}")

def get_hash(path):
    norm_path = os.path.normpath(path.replace("/", "\\"))
    for p,_,_,h in inventory:
        if os.path.normpath(p.replace("/", "\\")) == norm_path:
            return h
    return "N/A"

seq = 0
manifest_rows = []

def add_row(action, source, dest, reason, confidence, hashval):
    global seq
    seq += 1
    manifest_rows.append([seq, action, source, dest, reason, confidence, hashval])

# === 1. LOOSE FILES AT PARENT ROOTS ===
loose_moves = {
    "REDLINE - Master Project Management Agreement 1v3_(65430215_1)68 (002).docx":
        ("02 - Contracts & Legal/01 - Level Up Agreements/", "Master PM Agreement redline, belongs with Level Up agreements", "H"),
    "01 - Project Management/Dova-Logo.png":
        ("01 - Project Management/03 - Project Background/", "Project logo, belongs in Project Background", "M"),
    "02 - Contracts & Legal/2026.06.12_KozPure_DOVA_PM Letter Agreement_Updated 260826.docx":
        ("00 - Unsorted/_Duplicates/", "Duplicate of file already in 01 - Level Up Agreements", "H"),
    "04 - Project Schedule/260618_DOVA_Preliminary Master Schedule.pdf":
        ("04 - Project Schedule/01 - Master Schedule/", "Preliminary master schedule June 2026", "H"),
    "04 - Project Schedule/260901_DOVA Overview Schedule.pdf":
        ("04 - Project Schedule/03 - Schedule Deliverables/", "Overview schedule Sept 2026", "H"),
    "04 - Project Schedule/260901_DOVA_Overview_Schedule.xlsx":
        ("04 - Project Schedule/03 - Schedule Deliverables/", "Overview schedule companion xlsx", "H"),
    "04 - Project Schedule/DOVA_Master_Schedule Strategy.pdf":
        ("04 - Project Schedule/03 - Schedule Deliverables/", "Schedule strategy narrative document", "H"),
    "06 - Executive Reporting/260624_DOVA Delivery Method Recommendation.docx":
        ("06 - Executive Reporting/", "One-off delivery method recommendation report, stays at 06 root", "M"),
    "10 - CMAR Procurement/260730_DOVA_CMAR Interview Agenda.docx":
        ("10 - CMAR Procurement/", "CMAR interview agenda, applies to all bidders", "H"),
    "10 - CMAR Procurement/260730_DOVA_CMAR Term Sheet.docx":
        ("10 - CMAR Procurement/", "CMAR term sheet template, applies to all bidders", "H"),
}
for path, (dest, reason, conf) in loose_moves.items():
    add_row("MOVE", path, dest, reason, conf, get_hash(path))

# === 2. KOZPURE VERSION CLEANUP ===
# Move superseded versions to _Superseded subfolder
agreement_dir = "02 - Contracts & Legal/01 - Level Up Agreements/"
superseded_dir = agreement_dir + "_Superseded/"
add_row("MOVE", agreement_dir + "2026.06.12_KozPure_DOVA_PM Letter Agreement.docx",
        superseded_dir + "2026.06.12_KozPure_DOVA_PM Letter Agreement.docx",
        "Original PM/OR draft June 2026 - SUPERSEDED by signed CM agreement", "H",
        get_hash(agreement_dir + "2026.06.12_KozPure_DOVA_PM Letter Agreement.docx"))
add_row("MOVE", agreement_dir + "2026.06.12_KozPure_DOVA_PM Letter Agreement_Updated 260826.docx",
        superseded_dir + "2026.06.12_KozPure_DOVA_PM Letter Agreement_Updated 260826.docx",
        "PM/OR draft updated Aug 26 - SUPERSEDED by signed CM agreement", "H",
        get_hash(agreement_dir + "2026.06.12_KozPure_DOVA_PM Letter Agreement_Updated 260826.docx"))
add_row("MOVE", agreement_dir + "2026.06.12_KozPure_DOVA_PM Letter Agreement_Updated 260908 CLEAN.docx",
        superseded_dir + "2026.06.12_KozPure_DOVA_PM Letter Agreement_Updated 260908 CLEAN.docx",
        "CM scope draft clean Sep 9 - SUPERSEDED by signed PDF", "H",
        get_hash(agreement_dir + "2026.06.12_KozPure_DOVA_PM Letter Agreement_Updated 260908 CLEAN.docx"))
add_row("MOVE", agreement_dir + "2026.06.12_KozPure_DOVA_PM Letter Agreement_Updated 260908 REDLINE TRACKED.docx",
        superseded_dir + "2026.06.12_KozPure_DOVA_PM Letter Agreement_Updated 260908 REDLINE TRACKED.docx",
        "CM scope redline Sep 9 - SUPERSEDED working draft", "H",
        get_hash(agreement_dir + "2026.06.12_KozPure_DOVA_PM Letter Agreement_Updated 260908 REDLINE TRACKED.docx"))

# Move signed PDF to main folder (it's currently in a sub-subfolder)
add_row("MOVE", agreement_dir + "Complete_with_Docusign_20260909_Level_Up_C/2026.09.09_Level_Up_Construction_Management_Letter_Agreement_SIGNED.pdf",
        agreement_dir + "2026.09.09_Level_Up_Construction_Management_Letter_Agreement_SIGNED.pdf",
        "EXECUTED CM Letter Agreement - Docusign signed Sep 10. Current version.", "H",
        get_hash(agreement_dir + "Complete_with_Docusign_20260909_Level_Up_C/2026.09.09_Level_Up_Construction_Management_Letter_Agreement_SIGNED.pdf"))
add_row("MOVE", agreement_dir + "Complete_with_Docusign_20260909_Level_Up_C/Summary.pdf",
        superseded_dir + "Complete_with_Docusign_20260909_Level_Up_C/Summary.pdf",
        "Docusign certificate, supporting doc with signed PDF", "H",
        get_hash(agreement_dir + "Complete_with_Docusign_20260909_Level_Up_C/Summary.pdf"))

# === 3. DATA SHARE MOVES ===
data_share_moves = {
    "10 - CMAR Procurement/Data Share/Perkins&Will Docs/20260911_ARCH-Sacramento_Arena-V2.pdf":
        ("05 - Design & Engineering/01 - Drawings/03 - Preliminary Design/", "P&W arch drawings Sept 2026", "H"),
    "10 - CMAR Procurement/Data Share/Perkins&Will Docs/Arena Design Package - 26_0610 DOVA Arena Updates2.pdf":
        ("05 - Design & Engineering/01 - Drawings/03 - Preliminary Design/", "P&W design update package June 2026", "H"),
    "10 - CMAR Procurement/Data Share/Wood Rodgers (Site) Docs/EXH-GRADING AND DRAINAGE-DOVA-30x42.pdf":
        ("05 - Design & Engineering/09 - Site/06 Civil/", "Wood Rodgers civil grading & drainage plan", "H"),
    "10 - CMAR Procurement/Data Share/Wood Rodgers (Site) Docs/EXH-OVERALL-DOVA-30x42.pdf":
        ("05 - Design & Engineering/09 - Site/06 Civil/", "Wood Rodgers overall site plan", "H"),
    "10 - CMAR Procurement/Data Share/Wood Rodgers (Site) Docs/EXH-SITE PLAN-DOVA-30x42.pdf":
        ("05 - Design & Engineering/09 - Site/06 Civil/", "Wood Rodgers site plan", "H"),
    "10 - CMAR Procurement/Data Share/Wood Rodgers (Site) Docs/L1.0.pdf":
        ("05 - Design & Engineering/09 - Site/08 Landscape/", "WR landscape plan L1.0 streetscape entry", "M"),
    "10 - CMAR Procurement/Data Share/Wood Rodgers (Site) Docs/L2.0.pdf":
        ("05 - Design & Engineering/09 - Site/08 Landscape/", "WR landscape plan L2.0 plant species", "M"),
    "10 - CMAR Procurement/Data Share/Wood Rodgers (Site) Docs/L3.0.pdf":
        ("05 - Design & Engineering/09 - Site/08 Landscape/", "WR landscape plan L3.0 pedestrian", "M"),
    "10 - CMAR Procurement/Data Share/Youngdahl (Geotech) Docs/E24420.001 DOVA Infiltration Testing (4-24-26).pdf":
        ("05 - Design & Engineering/09 - Site/07 Geotech/", "Youngdahl infiltration testing report Apr 2026", "H"),
    "10 - CMAR Procurement/Data Share/Youngdahl (Geotech) Docs/E24420.001 GES 04-30-2026 DRAFT (3).pdf":
        ("05 - Design & Engineering/09 - Site/07 Geotech/", "Youngdahl geotech study draft Apr 2026", "H"),
    "10 - CMAR Procurement/Data Share/Youngdahl (Geotech) Docs/E24420.001 Rough Overlay of Mining with Current Maps - Geotech.pdf":
        ("05 - Design & Engineering/09 - Site/07 Geotech/", "Youngdahl mining overlay reference", "H"),
    "10 - CMAR Procurement/Data Share/Youngdahl (Geotech) Docs/Extracted pages from Aerials 7809300.8 _Geotech.pdf":
        ("05 - Design & Engineering/09 - Site/07 Geotech/", "Aerial extract for geotech reference", "H"),
    "10 - CMAR Procurement/Data Share/Youngdahl (Geotech) Docs/GEOTECH REPORT ARENA SITE 05-15-2026 DRAFT.pdf":
        ("05 - Design & Engineering/09 - Site/07 Geotech/", "Youngdahl geotech report May 2026 draft", "H"),
}
for path, (dest, reason, conf) in data_share_moves.items():
    add_row("MOVE", path, dest, reason, conf, get_hash(path))

# Data Share duplicates (already exist in Design & Engineering)
ds_dups = [
    ("10 - CMAR Procurement/Data Share/Youngdahl (Geotech) Docs/Geotech_03 _ Mark III.pdf", "Duplicate of file in 05/09/07 Geotech/"),
    ("10 - CMAR Procurement/Data Share/Youngdahl (Geotech) Docs/Geotech_04 _ Mark III.pdf", "Duplicate of file in 05/09/07 Geotech/"),
    ("10 - CMAR Procurement/Data Share/Youngdahl (Geotech) Docs/quarry.png", "Duplicate within geotech folder"),
    ("10 - CMAR Procurement/Data Share/Youngdahl (Geotech) Docs/Sac Sewer Interceptor drawings.pdf", "Duplicate of sewer drawing in geotech folder"),
    ("10 - CMAR Procurement/Data Share/Youngdahl (Geotech) Docs/sac sewer interceptor drwaings 2.pdf", "Duplicate of sewer drawing in geotech folder"),
    ("10 - CMAR Procurement/Data Share/Youngdahl (Geotech) Docs/01 Old Geotechs/03 _ Mark III.pdf", "Duplicate of file in 05/09/07 Geotech/01 Old Geotechs/"),
    ("10 - CMAR Procurement/Data Share/Youngdahl (Geotech) Docs/01 Old Geotechs/04 _ Mark III.pdf", "Duplicate of file in 05/09/07 Geotech/01 Old Geotechs/"),
    ("10 - CMAR Procurement/Data Share/Youngdahl (Geotech) Docs/01 Old Geotechs/Geotech/E24420.001 DOVA Infiltration Testing (4-24-26).pdf", "Duplicate of file in 05/09/07 Geotech/"),
    ("10 - CMAR Procurement/Data Share/Youngdahl (Geotech) Docs/01 Old Geotechs/Geotech/E24420.001 GES 04-24-2026 DRAFT.pdf", "Duplicate of file in 05/09/07 Geotech/"),
]
for path, reason in ds_dups:
    add_row("MOVE", path, "00 - Unsorted/_Duplicates/", reason + " (sent to duplicates)", "H", get_hash(path))

# === 4. HASH DUPLICATES (remaining) ===
dup_count = 0
for h, paths in dups.items():
    # Score paths to pick best keeper
    def score(p):
        s = 0
        if "Data Share" in p: s -= 10
        if "00 - Unsorted" in p: s -= 100
        if "Attachments" in p: s += 0  # neutral
        if "01 - Logs and Action" in p: s += 5
        if "01 - Master Schedule" in p: s += 3
        if "03 - Schedule Deliverables" in p: s += 2
        if "07 - JCI Deliverables" in p: s += 4
        if "01 - Drawings" in p: s += 3
        if "07 Geotech" in p: s += 3
        if "01 - Hunt" in p: s += 2
        if "01 - Level Up" in p: s += 3
        if "03 - NDAs" in p: s += 2
        if "04 - Third Party" in p: s += 2
        if "02 - Reporting" in p: s += 2
        if "01 - Weekly Reports" in p: s += 2
        if "02 - Invoicing" in p: s += 2
        if "01 - Budget" in p: s += 2
        if "01 - Alliant" in p: s += 2
        if "08 - Renderings" in p: s += 2
        if "06 - Executive Reporting" in p: s += 1
        if "10 - Programming" in p: s += 1
        return s
    best = max(paths, key=score)
    for p in paths:
        if p == best:
            continue
        # Skip if from Data Share (already handled above)
        if "Data Share" in p:
            continue
        rel_path = os.path.dirname(p)
        dest = "00 - Unsorted/_Duplicates/" + rel_path + "/" + os.path.basename(p)
        dest = dest.replace("\\\\", "/").replace("//", "/")
        add_row("MOVE", p, dest, f"Exact duplicate of {os.path.basename(best)} (same SHA256)", "H", h)
        dup_count += 1

print(f"Duplicate extras sent to _Duplicates: {dup_count}")

# === 5. RENAME SUBFOLDER NUMBERING ===
# 08 - Submittals uses underscores; rename to dashes for consistency
add_row("RENAME", "08 - Submittals & Permitting/00_MDR Submittal/",
        "08 - Submittals & Permitting/00 - MDR Submittal/",
        "Standardizing to two-digit dash format for consistency across all parents", "H", "N/A")
add_row("RENAME", "08 - Submittals & Permitting/01_Improvement Plan Submittal/",
        "08 - Submittals & Permitting/01 - Improvement Plan Submittal/",
        "Standardizing to two-digit dash format", "H", "N/A")
add_row("RENAME", "08 - Submittals & Permitting/02_Traffic Analysis/",
        "08 - Submittals & Permitting/02 - Traffic Analysis/",
        "Standardizing to two-digit dash format", "H", "N/A")
add_row("RENAME", "08 - Submittals & Permitting/03_Grading Plans Submittal/",
        "08 - Submittals & Permitting/03 - Grading Plans Submittal/",
        "Standardizing to two-digit dash format", "H", "N/A")
add_row("RENAME", "08 - Submittals & Permitting/10_Permitting/",
        "08 - Submittals & Permitting/10 - Permitting/",
        "Standardizing to two-digit dash format", "H", "N/A")

# Design & Engineering: fix two 11- folders and renumber
add_row("RENAME", "05 - Design & Engineering/11 - Utilities & MEP/",
        "05 - Design & Engineering/12 - Utilities & MEP/",
        "Fix duplicate 11- numbering. Renaming to 12 and bumping 12->13, 13->14", "H", "N/A")
add_row("RENAME", "05 - Design & Engineering/12 - Vendor Systems/",
        "05 - Design & Engineering/13 - Vendor Systems/",
        "Renumber to accommodate new 12 - Utilities & MEP", "H", "N/A")
add_row("RENAME", "05 - Design & Engineering/13 - Design Progression/",
        "05 - Design & Engineering/14 - Design Progression/",
        "Renumber to accommodate new 12 - Utilities & MEP", "H", "N/A")

# === 6. WRITE CSV ===
csv_path = os.path.join(ROOT, "_cleanup", "03_move_manifest.csv")
with open(csv_path, "w", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(["ID", "Action", "Source", "Destination", "Reason", "Confidence", "SHA256"])
    for row in manifest_rows:
        writer.writerow(row)

print(f"Manifest written: {csv_path}")
print(f"Total rows: {seq}")
actions = {}
for r in manifest_rows:
    actions[r[1]] = actions.get(r[1], 0) + 1
for act, cnt in sorted(actions.items()):
    print(f"  {act}: {cnt}")

# === 7. WRITE SUMMARY MD ===
md = []
md.append("# DOVA Cleanup - Move Manifest Summary")
md.append("")
md.append(f"Generated from inventory of 698 files across 254 directories.")
md.append("")
md.append("## Actions by Type")
for act, cnt in sorted(actions.items()):
    md.append(f"- **{act}**: {cnt}")
md.append("")
md.append("## Items Going to 00 - Unsorted")
md.append("Files that could not be classified to a specific subfolder, or duplicate copies.")
md.append("")
unsorted_count = 0
for r in manifest_rows:
    if r[1] == "MOVE" and "00 - Unsorted" in r[3]:
        unsorted_count += 1
        md.append(f"- {r[2]}")
        md.append(f"  -> {r[3]}")
        md.append(f"  Reason: {r[4]}")
md.append("")
md.append(f"Total unsorted: {unsorted_count}")
md.append("")
md.append("## Low Confidence Items")
low_count = 0
for r in manifest_rows:
    if r[5] == "L":
        low_count += 1
        md.append(f"- [{r[1]}] {r[2]}")
        md.append(f"  -> {r[3]}")
        md.append(f"  Reason: {r[4]}")
if low_count == 0:
    md.append("(None)")
md.append("")
md.append("## Medium Confidence Items")
med_count = 0
for r in manifest_rows:
    if r[5] == "M":
        med_count += 1
        md.append(f"- [{r[1]}] {r[2]}")
        md.append(f"  -> {r[3]}")
        md.append(f"  Reason: {r[4]}")
if med_count == 0:
    md.append("(None)")
md.append("")
md.append("## KozPure Agreement - Version Chain")
md.append("- v1: Original PM/OR draft (June 12, 2026) -> _Superseded")
md.append("- v2: Updated draft (Aug 26, 2026) -> _Superseded")
md.append("- v3: CM scope draft clean (Sep 9, 2026) -> _Superseded")
md.append("- v3-redline: CM scope redline (Sep 9, 2026) -> _Superseded")
md.append("- **CURRENT/EXECUTED: Signed CM Letter Agreement** (Docusign Sep 10, 2026)")
md.append("")
md.append("## Design & Engineering Renumbering")
md.append("- 11 - Site Investigations -> stays (correct name)")
md.append("- 11 - Utilities & MEP -> renamed to 12 - Utilities & MEP")
md.append("- 12 - Vendor Systems -> renamed to 13 - Vendor Systems")
md.append("- 13 - Design Progression -> renamed to 14 - Design Progression")
md.append("")
md.append("## Submittals & Permitting Renumbering")
md.append("- Underscore format renamed to dash format (e.g. 00_MDR -> 00 - MDR)")
md.append("")
md.append("## Empty Folders (flagged for review)")
md.append("- 02 - Contracts & Legal/02 - Client Agreements/")
md.append("- 10 - CMAR Procurement/02 - Turner/")
md.append("- 10 - CMAR Procurement/03 - Level 10/")
md.append("- 10 - CMAR Procurement/04 - McCarthy/")
md.append("- 10 - CMAR Procurement/05 - Crossland/")
md.append("- 10 - CMAR Procurement/Data Share/ (after files are moved)")
md.append("")
md.append("## Attachments Folder")
md.append("NOT TOUCHED. Auto-filed by date from email scanning. Files remain in place.")
md.append("")

md_path = os.path.join(ROOT, "_cleanup", "03_move_manifest.md")
with open(md_path, "w") as f:
    f.write("\n".join(md))
print(f"Summary written: {md_path}")