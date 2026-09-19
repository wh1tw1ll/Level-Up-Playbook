import csv, os

root = r"C:\Users\HermesAdmin\OneDrive - levelup-pd.com\Documents - Level Up\05 - DOVA"
manifest = []
with open(os.path.join(root, "_cleanup", "03_move_manifest.csv")) as f:
    reader = csv.DictReader(f)
    for row in reader:
        manifest.append(row)

lines = []
lines.append("# DOVA Cleanup Rollback Script")
lines.append("# Run: powershell -ExecutionPolicy Bypass -File _cleanup/04_rollback.ps1")
lines.append("")
lines.append("$root = '" + root + "'")
lines.append("")

# RENAMES (reverse in reverse order)
renames = [r for r in manifest if r["Action"] == "RENAME"]
if renames:
    lines.append('Write-Output "=== Reversing folder renames ==="')
    lines.append("")
    for r in reversed(renames):
        src = r["Destination"].replace("/", "\\")
        dst = r["Source"].replace("/", "\\")
        new_name = os.path.basename(dst)
        lines.append('if (Test-Path (Join-Path $root "' + src + '")) {')
        lines.append('    Rename-Item -Path (Join-Path $root "' + src + '") -NewName "' + new_name + '" -Force')
        lines.append('    Write-Output "Renamed: ' + src + ' -> ' + dst + '"')
        lines.append('} else { Write-Output "SKIP (not found): ' + src + '" }')
    lines.append("")

# MOVES (reverse: move back from destination to source)
moves = [r for r in manifest if r["Action"] == "MOVE"]
if moves:
    lines.append('Write-Output "=== Reversing file moves ==="')
    lines.append("")
    for m in reversed(moves):
        src = m["Destination"].replace("/", "\\")
        dst = m["Source"].replace("/", "\\")
        lines.append('if (Test-Path (Join-Path $root "' + src + '")) {')
        lines.append('    $destDir = Split-Path (Join-Path $root "' + dst + '") -Parent')
        lines.append('    if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }')
        lines.append('    Move-Item -Path (Join-Path $root "' + src + '") -Destination (Join-Path $root "' + dst + '") -Force')
        lines.append('    Write-Output "Moved back: ' + src + ' -> ' + dst + '"')
        lines.append('} else { Write-Output "SKIP (not found): ' + src + '" }')
    lines.append("")

lines.append('Write-Output "=== Rollback complete ==="')

rollback_path = os.path.join(root, "_cleanup", "04_rollback.ps1")
with open(rollback_path, "w") as f:
    f.write("\n".join(lines))

print(f"Rollback script: {len(lines)} lines")
print(f"Renames reversed: {len(renames)}")
print(f"Moves reversed: {len(moves)}")