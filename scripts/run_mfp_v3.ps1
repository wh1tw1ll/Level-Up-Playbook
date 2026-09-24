# Try to run the MFP mail scanner via the interactive user's session
# First, find the interactive session ID
$session = (quser | Select-String "HermesAdmin").ToString()
Write-Host "User session: $session"

# Try Start-Process in the console session
try {
    $proc = Start-Process -FilePath "C:\Users\HermesAdmin\AppData\Local\Programs\Python\Python314\python.exe" `
        -ArgumentList "C:\Users\HermesAdmin\Level-Up-Playbook\scripts\mfp_mail_outlook.py" `
        -Wait -PassThru -NoNewWindow
    Write-Host "Process exit code: $($proc.ExitCode)"
} catch {
    Write-Host "Start-Process failed: $($_.Exception.Message)"
}

# Check results
$logPath = 'C:\Users\HermesAdmin\.hermes\mfp_mail_scan_log.json'
$log = Get-Content $logPath -Raw | ConvertFrom-Json
$last = $log[-1]
Write-Host "=== LAST LOG ENTRY ==="
Write-Host "Time: $($last.timestamp)"
Write-Host "Status: $($last.status)"
Write-Host "Staged: $($last.staged)"
Write-Host "Skipped: $($last.skipped)"
Write-Host "Folders: $($last.folders_scanned)"
if ($last.error) {
    Write-Host "Error: $($last.error)"
}