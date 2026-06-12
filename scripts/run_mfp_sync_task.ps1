# Run MFP flagged email sync as a scheduled task
Write-Output "=== Checking for active console sessions ==="
$sessions = quser 2>$null
if (-not $sessions) {
    Write-Output "USER_NOT_LOGGED_IN - no active console session"
    exit 1
}
Write-Output $sessions

$user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
Write-Output "Current identity: $user"

Write-Output "=== Killing stale session-0 Outlook processes ==="
Get-CimInstance Win32_Process -Filter "Name='OUTLOOK.EXE'" | Where-Object { $_.SessionId -eq 0 } | ForEach-Object {
    Write-Output "Killing Outlook PID $($_.ProcessId) in Session 0"
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}

Write-Output "=== Creating scheduled task ==="
$action = New-ScheduledTaskAction -Execute 'C:\Users\HermesAdmin\AppData\Local\hermes\hermes-agent\venv\Scripts\python.exe' -Argument 'C:\Users\HermesAdmin\Level-Up-Playbook\scripts\sync_mfp_flagged_direct.py' -WorkingDirectory 'C:\Users\HermesAdmin\Level-Up-Playbook'
$trigger = New-ScheduledTaskTrigger -Once -At ((Get-Date).AddMinutes(1))
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -RunLevel Highest -LogonType Interactive

Unregister-ScheduledTask -TaskName 'MFP_Flagged_Sync' -Confirm:$false -ErrorAction SilentlyContinue
Register-ScheduledTask -TaskName 'MFP_Flagged_Sync' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force

Write-Output "Task registered. Waiting 90 seconds for execution..."
Start-Sleep -Seconds 90

Write-Output "=== Checking sync log ==="
Get-Content 'C:\Users\HermesAdmin\Level-Up-Playbook\scripts\flagged-sync.log' -Tail 1

Write-Output "=== Cleanup ==="
Unregister-ScheduledTask -TaskName 'MFP_Flagged_Sync' -Confirm:$false -ErrorAction SilentlyContinue
Write-Output "Done."
