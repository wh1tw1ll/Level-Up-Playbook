$action = New-ScheduledTaskAction -Execute 'C:\Users\HermesAdmin\AppData\Local\Programs\Python\Python314\python.exe' -Argument 'C:\Users\HermesAdmin\Level-Up-Playbook\scripts\mfp_mail_outlook.py'
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddSeconds(15)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable -Hidden
$principal = New-ScheduledTaskPrincipal -UserId 'HermesLU\HermesAdmin' -LogonType S4U -RunLevel Limited
Register-ScheduledTask -TaskName 'LUNA_MFP_SCAN_NOW' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Write-Host "Task created, waiting 20s for execution..."
Start-Sleep -Seconds 25
Write-Host "Checking results..."
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
# Clean up
schtasks /Delete /TN 'LUNA_MFP_SCAN_NOW' /F 2>&1 | Out-Null
