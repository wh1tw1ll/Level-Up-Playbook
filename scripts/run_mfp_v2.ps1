$now = Get-Date
$future = $now.AddMinutes(2)
$timeStr = $future.ToString('HH:mm')
$dateStr = $future.ToString('MM/dd/yyyy')

Write-Host "Creating task for $dateStr at $timeStr"

schtasks /Create /SC ONCE /TN "LUNA_MFP_SCAN_NOW" /TR "C:\Users\HermesAdmin\AppData\Local\Programs\Python\Python314\python.exe C:\Users\HermesAdmin\Level-Up-Playbook\scripts\mfp_mail_outlook.py" /ST $timeStr /SD $dateStr /IT /RU HermesLU\HermesAdmin /F 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "Task created successfully. Waiting for execution..."
    
    # Wait for the task to run
    Start-Sleep -Seconds 150
    
    Write-Host "=== RESULTS ==="
    # Check the log file
    $logPath = 'C:\Users\HermesAdmin\.hermes\mfp_mail_scan_log.json'
    $log = Get-Content $logPath -Raw | ConvertFrom-Json
    $last = $log[-1]
    Write-Host "Last log entry:"
    Write-Host "  Time: $($last.timestamp)"
    Write-Host "  Status: $($last.status)"
    Write-Host "  Staged: $($last.staged)"
    Write-Host "  Skipped: $($last.skipped)"
    Write-Host "  Folders: $($last.folders_scanned)"
    if ($last.error) {
        Write-Host "  Error: $($last.error)"
    }
    
    # Also check state file
    $statePath = 'C:\Users\HermesAdmin\.hermes\mfp_mail_state.json'
    $state = Get-Content $statePath -Raw | ConvertFrom-Json
    Write-Host "Last successful scan: $($state.last_successful_scan)"
} else {
    Write-Host "Task creation failed with exit code $LASTEXITCODE"
}

# Clean up
schtasks /Delete /TN "LUNA_MFP_SCAN_NOW" /F 2>&1 | Out-Null
