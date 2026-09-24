# Create a daily scheduled task to run MFP mail scanner as HermesAdmin
# Uses S4U logon (no password needed) - runs in the background

$action = New-ScheduledTaskAction -Execute "C:\Users\HermesAdmin\AppData\Local\Programs\Python\Python314\python.exe" -Argument "C:\Users\HermesAdmin\Level-Up-Playbook\scripts\mfp_mail_outlook.py"
$trigger = New-ScheduledTaskTrigger -Daily -At 08:30AM
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -RunOnlyIfNetworkAvailable -Hidden -Compatibility Win8
$principal = New-ScheduledTaskPrincipal -UserId "HermesLU\HermesAdmin" -LogonType S4U -RunLevel Limited

try {
    Register-ScheduledTask -TaskName "LUNA_MFP_DAILY_SCAN" -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force
    Write-Host "Task created successfully: LUNA_MFP_DAILY_SCAN"
    Write-Host "Schedule: Daily at 8:30 AM"
} catch {
    Write-Host "Failed to create task: $($_.Exception.Message)"
    
    # Fall back to schtasks approach
    Write-Host "Trying schtasks fallback..."
    
    # Create task without specifying run level - let it use defaults
    $taskPath = Join-Path $env:TEMP "mfp_daily_task.xml"
    @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Date>2026-09-24T08:00:00</Date>
    <Author>HermesLU\HermesAdmin</Author>
  </RegistrationInfo>
  <Triggers>
    <CalendarTrigger>
      <StartBoundary>2026-09-25T08:30:00</StartBoundary>
      <Repetition>
        <Interval>P1D</Interval>
        <Duration>P1D</Duration>
        <StopAtDurationEnd>false</StopAtDurationEnd>
      </Repetition>
      <Enabled>true</Enabled>
      <ScheduleByDay>
        <DaysInterval>1</DaysInterval>
      </ScheduleByDay>
    </CalendarTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>HermesLU\HermesAdmin</UserId>
      <LogonType>S4U</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <Enabled>true</Enabled>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>true</RunOnlyIfNetworkAvailable>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <ExecutionTimeLimit>PT10M</ExecutionTimeLimit>
    <Priority>7</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>C:\Users\HermesAdmin\AppData\Local\Programs\Python\Python314\python.exe</Command>
      <Arguments>C:\Users\HermesAdmin\Level-Up-Playbook\scripts\mfp_mail_outlook.py</Arguments>
    </Exec>
  </Actions>
</Task>
"@ | Out-File -FilePath $taskPath -Encoding UTF8 -Force
    
    schtasks /Create /XML $taskPath /TN "LUNA_MFP_DAILY_SCAN" /F 2>&1
    Write-Host "schtasks exit code: $LASTEXITCODE"
    Remove-Item $taskPath -Force
}