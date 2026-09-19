# DOVA Cleanup Rollback Script
# Generated: 2026-09-18
# Reverses every MOVE and RENAME in the manifest
# Run: powershell -ExecutionPolicy Bypass -File _cleanup/04_rollback.ps1

$root = "C:\Users\HermesAdmin\OneDrive - levelup-pd.com\Documents - Level Up\05 - DOVA"

# ============================================================
# SECTION 1: Reverse FILE MOVES (destination -> source)
# ============================================================

Write-Output "=== Reversing file moves ==="

# Move files back from destination to source
# Format: Move-Item -Path (Join-Path $root "DESTINATION") -Destination (Join-Path $root "SOURCE") -Force

Move-Item -Path (Join-Path $root "02 - Contracts & Legal\01 - Level Up Agreements\REDLINE - Master Project Management Agreement 1v3_(65430215_1)68 (002).docx") -Destination (Join-Path $root "REDLINE - Master Project Management Agreement 1v3_(65430215_1)68 (002).docx") -Force
Move-Item -Path (Join-Path $root "01 - Project Management\03 - Project Background\Dova-Logo.png") -Destination (Join-Path $root "01 - Project Management\Dova-Logo.png") -Force
Move-Item -Path (Join-Path $root "00 - Unsorted\_Duplicates\02 - Contracts & Legal\2026.06.12_KozPure_DOVA_PM Letter Agreement_Updated 260826.docx") -Destination (Join-Path $root "02 - Contracts & Legal\2026.06.12_KozPure_DOVA_PM Letter Agreement_Updated 260826.docx") -Force
Move-Item -Path (Join-Path $root "04 - Project Schedule\01 - Master Schedule\260618_DOVA_Preliminary Master Schedule.pdf") -Destination (Join-Path $root "04 - Project Schedule\260618_DOVA_Preliminary Master Schedule.pdf") -Force
Move-Item -Path (Join-Path $root "04 - Project Schedule\03 - Schedule Deliverables\260901_DOVA Overview Schedule.pdf") -Destination (Join-Path $root "04 - Project Schedule\260901_DOVA Overview Schedule.pdf") -Force
Move-Item -Path (Join-Path $root "04 - Project Schedule\03 - Schedule Deliverables\260901_DOVA_Overview_Schedule.xlsx") -Destination (Join-Path $root "04 - Project Schedule\260901_DOVA_Overview_Schedule.xlsx") -Force
Move-Item -Path (Join-Path $root "04 - Project Schedule\03 - Schedule Deliverables\DOVA_Master_Schedule Strategy.pdf") -Destination (Join-Path $root "04 - Project Schedule\DOVA_Master_Schedule Strategy.pdf") -Force
Move-Item -Path (Join-Path $root "10 - CMAR Procurement\260730_DOVA_CMAR Interview Agenda.docx") -Destination (Join-Path $root "10 - CMAR Procurement\260730_DOVA_CMAR Interview Agenda.docx") -Force
Move-Item -Path (Join-Path $root "10 - CMAR Procurement\260730_DOVA_CMAR Term Sheet.docx") -Destination (Join-Path $root "10 - CMAR Procurement\260730_DOVA_CMAR Term Sheet.docx") -Force
Move-Item -Path (Join-Path $root "02 - Contracts & Legal\01 - Level Up Agreements\_Superseded\2026.06.12_KozPure_DOVA_PM Letter Agreement.docx") -Destination (Join-Path $root "02 - Contracts & Legal\01 - Level Up Agreements\2026.06.12_KozPure_DOVA_PM Letter Agreement.docx") -Force
Move-Item -Path (Join-Path $root "02 - Contracts & Legal\01 - Level Up Agreements\_Superseded\2026.06.12_KozPure_DOVA_PM Letter Agreement_Updated 260826.docx") -Destination (Join-Path $root "02 - Contracts & Legal\01 - Level Up Agreements\2026.06.12_KozPure_DOVA_PM Letter Agreement_Updated 260826.docx") -Force
Move-Item -Path (Join-Path $root "02 - Contracts & Legal\01 - Level Up Agreements\_Superseded\2026.06.12_KozPure_DOVA_PM Letter Agreement_Updated 260908 CLEAN.docx") -Destination (Join-Path $root "02 - Contracts & Legal\01 - Level Up Agreements\2026.06.12_KozPure_DOVA_PM Letter Agreement_Updated 260908 CLEAN.docx") -Force
Move-Item -Path (Join-Path $root "02 - Contracts & Legal\01 - Level Up Agreements\_Superseded\2026.06.12_KozPure_DOVA_PM Letter Agreement_Updated 260908 REDLINE TRACKED.docx") -Destination (Join-Path $root "02 - Contracts & Legal\01 - Level Up Agreements\2026.06.12_KozPure_DOVA_PM Letter Agreement_Updated 260908 REDLINE TRACKED.docx") -Force
Move-Item -Path (Join-Path $root "02 - Contracts & Legal\01 - Level Up Agreements\2026.09.09_Level_Up_Construction_Management_Letter_Agreement_SIGNED.pdf") -Destination (Join-Path $root "02 - Contracts & Legal\01 - Level Up Agreements\Complete_with_Docusign_20260909_Level_Up_C\2026.09.09_Level_Up_Construction_Management_Letter_Agreement_SIGNED.pdf") -Force
Move-Item -Path (Join-Path $root "02 - Contracts & Legal\01 - Level Up Agreements\_Superseded\Complete_with_Docusign_20260909_Level_Up_C\Summary.pdf") -Destination (Join-Path $root "02 - Contracts & Legal\01 - Level Up Agreements\Complete_with_Docusign_20260909_Level_Up_C\Summary.pdf") -Force

Write-Output "=== Rollback complete ==="