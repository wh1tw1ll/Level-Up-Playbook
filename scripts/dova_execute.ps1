# DOVA Cleanup - Phase 4 Execution
# Run: powershell -ExecutionPolicy Bypass -File _cleanup/execute_cleanup.ps1

$root = "C:\Users\HermesAdmin\OneDrive - levelup-pd.com\Documents - Level Up\05 - DOVA"
$logPath = $root + "\_cleanup\05_execution_log.csv"
$seq = 0

# Initialize log
"ID,Action,Status,Error" | Set-Content -Path $logPath -Encoding UTF8

function Log-Result($id, $action, $status, $error) {
    "$id,$action,$status,$error" | Add-Content -Path $logPath -Encoding UTF8
}

Write-Output "=== PHASE 4A: FOLDER RENAMES ==="

# ============================================================
# RENAME 1: 08 - Submittals - underscore format to dash format
# ============================================================

function Rename-Subfolder($parent, $oldName, $newName) {
    $oldPath = Join-Path $parent $oldName
    $newPath = Join-Path $parent $newName
    if (Test-Path $oldPath) {
        if (-not (Test-Path $newPath)) {
            Rename-Item -Path $oldPath -NewName $newName -Force
            Log-Result (++$global:seq) "RENAME" "OK" ""
            Write-Output "  RENAMED: $oldName -> $newName"
        } else {
            Log-Result (++$global:seq) "RENAME" "SKIPPED" "Destination already exists"
            Write-Output "  SKIPPED: $newName already exists"
        }
    } else {
        Log-Result (++$global:seq) "RENAME" "SKIPPED" "Source not found"
        Write-Output "  SKIPPED: $oldName not found"
    }
}

# Rename 08 submittals
$subParent = Join-Path $root "08 - Submittals & Permitting"
Rename-Subfolder $subParent "00_MDR Submittal" "00 - MDR Submittal"
Rename-Subfolder $subParent "01_Improvement Plan Submittal" "01 - Improvement Plan Submittal"
Rename-Subfolder $subParent "02_Traffic Analysis" "02 - Traffic Analysis"
Rename-Subfolder $subParent "03_Grading Plans Submittal" "03 - Grading Plans Submittal"
Rename-Subfolder $subParent "10_Permitting" "10 - Permitting"

# Rename D&E folders (fix double-11)
$deParent = Join-Path $root "05 - Design & Engineering"
# Must rename in reverse order to avoid collisions: 14 first, then 13, then 12-> old-11
Rename-Subfolder $deParent "13 - Design Progression" "14 - Design Progression"
Rename-Subfolder $deParent "12 - Vendor Systems" "13 - Vendor Systems"
Rename-Subfolder $deParent "11 - Utilities & MEP" "12 - Utilities & MEP"
# 11 - Site Investigations stays

Write-Output ""
Write-Output "=== PHASE 4B: FILE MOVES ==="

# Helper to move a file
function Move-File($source, $dest) {
    $srcPath = Join-Path $root $source
    $destPath = Join-Path $root $dest
    if (Test-Path $srcPath) {
        $destDir = Split-Path $destPath -Parent
        if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
        try {
            Move-Item -Path $srcPath -Destination $destPath -Force
            Log-Result (++$global:seq) "MOVE" "OK" ""
            Write-Output "  MOVED: $source"
        } catch {
            Log-Result (++$global:seq) "MOVE" "FAILED" $_.Exception.Message
            Write-Output "  FAILED: $source -> $_"
        }
    } else {
        Log-Result (++$global:seq) "MOVE" "SKIPPED" "Source not found at $source"
        Write-Output "  SKIPPED: $source not found"
    }
}

# Create 00 - Unsorted and subfolders
$unsorted = Join-Path $root "00 - Unsorted"
$dupDir = Join-Path $unsorted "_Duplicates"
if (-not (Test-Path $unsorted)) { New-Item -ItemType Directory -Path $unsorted -Force | Out-Null }
if (-not (Test-Path $dupDir)) { New-Item -ItemType Directory -Path $dupDir -Force | Out-Null }

# Create _Superseded in Level Up Agreements
$luDir = $root + "\02 - Contracts & Legal\01 - Level Up Agreements"
$superseded = Join-Path $luDir "_Superseded"
$dsCertDir = Join-Path $superseded "Complete_with_Docusign_20260909_Level_Up_C"
if (-not (Test-Path $superseded)) { New-Item -ItemType Directory -Path $superseded -Force | Out-Null }
if (-not (Test-Path $dsCertDir)) { New-Item -ItemType Directory -Path $dsCertDir -Force | Out-Null }

# ============================================================
# 4B-1: LOOSE ROOT FILES
# ============================================================

Move-File "REDLINE - Master Project Management Agreement 1v3_(65430215_1)68 (002).docx" "02 - Contracts & Legal\01 - Level Up Agreements\REDLINE - Master Project Management Agreement 1v3_(65430215_1)68 (002).docx"
Move-File "01 - Project Management\Dova-Logo.png" "01 - Project Management\03 - Project Background\Dova-Logo.png"
Move-File "02 - Contracts & Legal\2026.06.12_KozPure_DOVA_PM Letter Agreement_Updated 260826.docx" "00 - Unsorted\_Duplicates\2026.06.12_KozPure_DOVA_PM Letter Agreement_Updated 260826.docx"
Move-File "04 - Project Schedule\260618_DOVA_Preliminary Master Schedule.pdf" "04 - Project Schedule\01 - Master Schedule\260618_DOVA_Preliminary Master Schedule.pdf"
Move-File "04 - Project Schedule\260901_DOVA Overview Schedule.pdf" "04 - Project Schedule\03 - Schedule Deliverables\260901_DOVA Overview Schedule.pdf"
Move-File "04 - Project Schedule\260901_DOVA_Overview_Schedule.xlsx" "04 - Project Schedule\03 - Schedule Deliverables\260901_DOVA_Overview_Schedule.xlsx"
Move-File "04 - Project Schedule\DOVA_Master_Schedule Strategy.pdf" "04 - Project Schedule\03 - Schedule Deliverables\DOVA_Master_Schedule Strategy.pdf"
Move-File "06 - Executive Reporting\260624_DOVA Delivery Method Recommendation.docx" "06 - Executive Reporting\260624_DOVA Delivery Method Recommendation.docx"
Move-File "10 - CMAR Procurement\260730_DOVA_CMAR Interview Agenda.docx" "10 - CMAR Procurement\260730_DOVA_CMAR Interview Agenda.docx"
Move-File "10 - CMAR Procurement\260730_DOVA_CMAR Term Sheet.docx" "10 - CMAR Procurement\260730_DOVA_CMAR Term Sheet.docx"

# ============================================================
# 4B-2: KOZPURE VERSION CLEANUP
# ============================================================

# Superseded versions to _Superseded
Move-File "02 - Contracts & Legal\01 - Level Up Agreements\2026.06.12_KozPure_DOVA_PM Letter Agreement.docx" "02 - Contracts & Legal\01 - Level Up Agreements\_Superseded\2026.06.12_KozPure_DOVA_PM Letter Agreement.docx"
Move-File "02 - Contracts & Legal\01 - Level Up Agreements\2026.06.12_KozPure_DOVA_PM Letter Agreement_Updated 260826.docx" "02 - Contracts & Legal\01 - Level Up Agreements\_Superseded\2026.06.12_KozPure_DOVA_PM Letter Agreement_Updated 260826.docx"
Move-File "02 - Contracts & Legal\01 - Level Up Agreements\2026.06.12_KozPure_DOVA_PM Letter Agreement_Updated 260908 CLEAN.docx" "02 - Contracts & Legal\01 - Level Up Agreements\_Superseded\2026.06.12_KozPure_DOVA_PM Letter Agreement_Updated 260908 CLEAN.docx"
Move-File "02 - Contracts & Legal\01 - Level Up Agreements\2026.06.12_KozPure_DOVA_PM Letter Agreement_Updated 260908 REDLINE TRACKED.docx" "02 - Contracts & Legal\01 - Level Up Agreements\_Superseded\2026.06.12_KozPure_DOVA_PM Letter Agreement_Updated 260908 REDLINE TRACKED.docx"

# Current signed PDF -> root of Level Up Agreements
Move-File "02 - Contracts & Legal\01 - Level Up Agreements\Complete_with_Docusign_20260909_Level_Up_C\2026.09.09_Level_Up_Construction_Management_Letter_Agreement_SIGNED.pdf" "02 - Contracts & Legal\01 - Level Up Agreements\2026.09.09_Level_Up_Construction_Management_Letter_Agreement_SIGNED.pdf"

# Docusign certificate -> _Superseded
Move-File "02 - Contracts & Legal\01 - Level Up Agreements\Complete_with_Docusign_20260909_Level_Up_C\Summary.pdf" "02 - Contracts & Legal\01 - Level Up Agreements\_Superseded\Complete_with_Docusign_20260909_Level_Up_C\Summary.pdf"

# ============================================================
# 4B-3: DATA SHARE FILES -> REAL HOMES
# ============================================================

# Perkins&Will -> Design & Engineering / Drawings / Preliminary Design
Move-File "10 - CMAR Procurement\Data Share\Perkins&Will Docs\20260911_ARCH-Sacramento_Arena-V2.pdf" "05 - Design & Engineering\01 - Drawings\03 - Preliminary Design\20260911_ARCH-Sacramento_Arena-V2.pdf"
Move-File "10 - CMAR Procurement\Data Share\Perkins&Will Docs\Arena Design Package - 26_0610 DOVA Arena Updates2.pdf" "05 - Design & Engineering\01 - Drawings\03 - Preliminary Design\Arena Design Package - 26_0610 DOVA Arena Updates2.pdf"

# Wood Rodgers Civil -> Site / Civil
Move-File "10 - CMAR Procurement\Data Share\Wood Rodgers (Site) Docs\EXH-GRADING AND DRAINAGE-DOVA-30x42.pdf" "05 - Design & Engineering\09 - Site\06 Civil\EXH-GRADING AND DRAINAGE-DOVA-30x42.pdf"
Move-File "10 - CMAR Procurement\Data Share\Wood Rodgers (Site) Docs\EXH-OVERALL-DOVA-30x42.pdf" "05 - Design & Engineering\09 - Site\06 Civil\EXH-OVERALL-DOVA-30x42.pdf"
Move-File "10 - CMAR Procurement\Data Share\Wood Rodgers (Site) Docs\EXH-SITE PLAN-DOVA-30x42.pdf" "05 - Design & Engineering\09 - Site\06 Civil\EXH-SITE PLAN-DOVA-30x42.pdf"

# Wood Rodgers Landscape -> Site / Landscape
Move-File "10 - CMAR Procurement\Data Share\Wood Rodgers (Site) Docs\L1.0.pdf" "05 - Design & Engineering\09 - Site\08 Landscape\L1.0.pdf"
Move-File "10 - CMAR Procurement\Data Share\Wood Rodgers (Site) Docs\L2.0.pdf" "05 - Design & Engineering\09 - Site\08 Landscape\L2.0.pdf"
Move-File "10 - CMAR Procurement\Data Share\Wood Rodgers (Site) Docs\L3.0.pdf" "05 - Design & Engineering\09 - Site\08 Landscape\L3.0.pdf"

# Youngdahl Geotech -> Site / Geotech
Move-File "10 - CMAR Procurement\Data Share\Youngdahl (Geotech) Docs\E24420.001 DOVA Infiltration Testing (4-24-26).pdf" "05 - Design & Engineering\09 - Site\07 Geotech\E24420.001 DOVA Infiltration Testing (4-24-26).pdf"
Move-File "10 - CMAR Procurement\Data Share\Youngdahl (Geotech) Docs\E24420.001 GES 04-30-2026 DRAFT (3).pdf" "05 - Design & Engineering\09 - Site\07 Geotech\E24420.001 GES 04-30-2026 DRAFT (3).pdf"
Move-File "10 - CMAR Procurement\Data Share\Youngdahl (Geotech) Docs\E24420.001 Rough Overlay of Mining with Current Maps - Geotech.pdf" "05 - Design & Engineering\09 - Site\07 Geotech\E24420.001 Rough Overlay of Mining with Current Maps - Geotech.pdf"
Move-File "10 - CMAR Procurement\Data Share\Youngdahl (Geotech) Docs\Extracted pages from Aerials 7809300.8 _Geotech.pdf" "05 - Design & Engineering\09 - Site\07 Geotech\Extracted pages from Aerials 7809300.8 _Geotech.pdf"
Move-File "10 - CMAR Procurement\Data Share\Youngdahl (Geotech) Docs\GEOTECH REPORT ARENA SITE 05-15-2026 DRAFT.pdf" "05 - Design & Engineering\09 - Site\07 Geotech\GEOTECH REPORT ARENA SITE 05-15-2026 DRAFT.pdf"

# Data Share duplicates -> _Duplicates
Move-File "10 - CMAR Procurement\Data Share\Youngdahl (Geotech) Docs\Geotech_03 _ Mark III.pdf" "00 - Unsorted\_Duplicates\Geotech_03 _ Mark III.pdf"
Move-File "10 - CMAR Procurement\Data Share\Youngdahl (Geotech) Docs\Geotech_04 _ Mark III.pdf" "00 - Unsorted\_Duplicates\Geotech_04 _ Mark III.pdf"
Move-File "10 - CMAR Procurement\Data Share\Youngdahl (Geotech) Docs\quarry.png" "00 - Unsorted\_Duplicates\quarry.png"
Move-File "10 - CMAR Procurement\Data Share\Youngdahl (Geotech) Docs\Sac Sewer Interceptor drawings.pdf" "00 - Unsorted\_Duplicates\Sac Sewer Interceptor drawings.pdf"
Move-File "10 - CMAR Procurement\Data Share\Youngdahl (Geotech) Docs\sac sewer interceptor drwaings 2.pdf" "00 - Unsorted\_Duplicates\sac sewer interceptor drwaings 2.pdf"
Move-File "10 - CMAR Procurement\Data Share\Youngdahl (Geotech) Docs\01 Old Geotechs\03 _ Mark III.pdf" "00 - Unsorted\_Duplicates\03 _ Mark III.pdf"
Move-File "10 - CMAR Procurement\Data Share\Youngdahl (Geotech) Docs\01 Old Geotechs\04 _ Mark III.pdf" "00 - Unsorted\_Duplicates\04 _ Mark III.pdf"
Move-File "10 - CMAR Procurement\Data Share\Youngdahl (Geotech) Docs\01 Old Geotechs\Geotech\E24420.001 DOVA Infiltration Testing (4-24-26).pdf" "00 - Unsorted\_Duplicates\E24420.001 DOVA Infiltration Testing (4-24-26).pdf"
Move-File "10 - CMAR Procurement\Data Share\Youngdahl (Geotech) Docs\01 Old Geotechs\Geotech\E24420.001 GES 04-24-2026 DRAFT.pdf" "00 - Unsorted\_Duplicates\E24420.001 GES 04-24-2026 DRAFT.pdf"

# ============================================================
# 4B-4: HASH DUPLICATES -> _Duplicates WITH PATH PRESERVATION
# (These have already been handled in the script above for Data Share)
# For the remaining hash duplicates, we need individual Move-File calls
# Let me read from the CSV directly for bulk processing
# ============================================================

Write-Output "=== Bulk duplicates from manifest ==="

# Read the CSV and execute remaining MOVE entries
$csvPath = $root + "\_cleanup\03_move_manifest.csv"
$reader = Import-Csv -Path $csvPath

# Filter to MOVE actions that weren't already covered above
$moved = @(
    "REDLINE - Master Project Management Agreement 1v3_(65430215_1)68 (002).docx",
    "01 - Project Management\Dova-Logo.png",
    "02 - Contracts & Legal\2026.06.12_KozPure_DOVA_PM Letter Agreement_Updated 260826.docx",
    "04 - Project Schedule\260618_DOVA_Preliminary Master Schedule.pdf",
    "04 - Project Schedule\260901_DOVA Overview Schedule.pdf",
    "04 - Project Schedule\260901_DOVA_Overview_Schedule.xlsx",
    "04 - Project Schedule\DOVA_Master_Schedule Strategy.pdf",
    "06 - Executive Reporting\260624_DOVA Delivery Method Recommendation.docx",
    "10 - CMAR Procurement\260730_DOVA_CMAR Interview Agenda.docx",
    "10 - CMAR Procurement\260730_DOVA_CMAR Term Sheet.docx",
    "01 - Level Up Agreements\2026.06.12_KozPure_DOVA_PM Letter Agreement.docx",
    "01 - Level Up Agreements\2026.06.12_KozPure_DOVA_PM Letter Agreement_Updated 260826.docx",
    "01 - Level Up Agreements\2026.06.12_KozPure_DOVA_PM Letter Agreement_Updated 260908 CLEAN.docx",
    "01 - Level Up Agreements\2026.06.12_KozPure_DOVA_PM Letter Agreement_Updated 260908 REDLINE TRACKED.docx",
    "Complete_with_Docusign_20260909_Level_Up_C\2026.09.09_Level_Up_Construction_Management_Letter_Agreement_SIGNED.pdf",
    "Complete_with_Docusign_20260909_Level_Up_C\Summary.pdf",
    "Perkins&Will Docs\20260911_ARCH-Sacramento_Arena-V2.pdf",
    "Perkins&Will Docs\Arena Design Package - 26_0610 DOVA Arena Updates2.pdf",
    "Wood Rodgers (Site) Docs\EXH-GRADING AND DRAINAGE-DOVA-30x42.pdf",
    "Wood Rodgers (Site) Docs\EXH-OVERALL-DOVA-30x42.pdf",
    "Wood Rodgers (Site) Docs\EXH-SITE PLAN-DOVA-30x42.pdf",
    "Wood Rodgers (Site) Docs\L1.0.pdf",
    "Wood Rodgers (Site) Docs\L2.0.pdf",
    "Wood Rodgers (Site) Docs\L3.0.pdf",
    "Youngdahl (Geotech) Docs\E24420.001 DOVA Infiltration Testing (4-24-26).pdf",
    "Youngdahl (Geotech) Docs\E24420.001 GES 04-30-2026 DRAFT (3).pdf",
    "Youngdahl (Geotech) Docs\E24420.001 Rough Overlay of Mining with Current Maps - Geotech.pdf",
    "Youngdahl (Geotech) Docs\Extracted pages from Aerials 7809300.8 _Geotech.pdf",
    "Youngdahl (Geotech) Docs\GEOTECH REPORT ARENA SITE 05-15-2026 DRAFT.pdf",
    "Youngdahl (Geotech) Docs\Geotech_03 _ Mark III.pdf",
    "Youngdahl (Geotech) Docs\Geotech_04 _ Mark III.pdf",
    "Youngdahl (Geotech) Docs\quarry.png",
    "Youngdahl (Geotech) Docs\Sac Sewer Interceptor drawings.pdf",
    "Youngdahl (Geotech) Docs\sac sewer interceptor drwaings 2.pdf",
    "Youngdahl (Geotech) Docs\01 Old Geotechs\03 _ Mark III.pdf",
    "Youngdahl (Geotech) Docs\01 Old Geotechs\04 _ Mark III.pdf",
    "Youngdahl (Geotech) Docs\01 Old Geotechs\Geotech\E24420.001 DOVA Infiltration Testing (4-24-26).pdf",
    "Youngdahl (Geotech) Docs\01 Old Geotechs\Geotech\E24420.001 GES 04-24-2026 DRAFT.pdf"
)

foreach ($row in $reader) {
    if ($row.Action -ne "MOVE") { continue }
    # Skip if already handled above
    $alreadyDone = $false
    foreach ($done in $moved) {
        if ($row.Source -like "*$done") { $alreadyDone = $true; break }
    }
    if ($alreadyDone) { continue }
    # Also skip Data Share entries
    if ($row.Source -like "*Data Share*") { continue }

    Move-File $row.Source $row.Destination
}

Write-Output ""
Write-Output "=== Execution complete ==="
Write-Output "Log written to: $logPath"