# Create daily Windows scheduled task for MFP mail scanner
# Using Task Scheduler COM object (works from SYSTEM context)

$taskName = "LUNA_MFP_DAILY_SCAN"
$scriptPath = "C:\Users\HermesAdmin\Level-Up-Playbook\scripts\mfp_mail_outlook.py"
$pythonPath = "C:\Users\HermesAdmin\AppData\Local\Programs\Python\Python314\python.exe"

try {
    $scheduler = New-Object -ComObject "Schedule.Service"
    $scheduler.Connect()
    $root = $scheduler.GetFolder("\")
    
    # Delete existing task if any
    try { $root.DeleteTask($taskName, 0) } catch {}
    
    $task = $scheduler.NewTask($null)
    
    # Principal: S4U logon (no password needed), run as HermesAdmin
    $principal = $task.XmlText -as [xml]
    $principal = $task.Principal
    $principal.LogonType = 3  # S4U
    $principal.UserId = "HermesLU\HermesAdmin"
    $principal.RunLevel = 1  # LeastPrivilege
    
    # Settings
    $settings = $task.Settings
    $settings.Enabled = $true
    $settings.AllowDemandStart = $true
    $settings.StartWhenAvailable = $true
    $settings.RunOnlyIfNetworkAvailable = $true
    $settings.DisallowStartIfOnBatteries = $false
    $settings.StopIfGoingOnBatteries = $false
    $settings.MultipleInstances = 2  # IgnoreNew
    $settings.ExecutionTimeLimit = "PT10M"
    $settings.Priority = 7
    
    # Trigger: Daily at 8:30 AM
    $trigger = $task.Triggers.Create(1)  # Daily
    $trigger.StartBoundary = "2026-09-25T08:30:00"
    $trigger.DaysInterval = 1
    $trigger.Enabled = $true
    
    # Action: Run the Python script
    $action = $task.Actions.Create(0)  # Exec
    $action.Path = $pythonPath
    $action.Arguments = $scriptPath
    
    # Register task
    $root.RegisterTaskDefinition($taskName, $task, 6, $null, $null, 3)  # 6=CreateOrUpdate, 3=S4U
    Write-Host "Task '$taskName' created successfully!"
    
    # Verify
    $registered = $root.GetTask($taskName)
    Write-Host "State: $($registered.State)"
    Write-Host "Next run: $($registered.NextRunTime)"
    Write-Host "Schedule: Daily at 8:30 AM as HermesLU\HermesAdmin"
    
    # Also launch it now for a test run
    $registered.Run($null)
    Write-Host "Task launched for test run - check logs shortly."
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
    Write-Host "Trying alternative approach..."
    
    # Fallback: use schtasks with XML
    $xmlPath = Join-Path $env:TEMP "mfp_task.xml"
    @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.3" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Author>SYSTEM</Author>
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
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>true</RunOnlyIfNetworkAvailable>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <ExecutionTimeLimit>PT10M</ExecutionTimeLimit>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>$pythonPath</Command>
      <Arguments>$scriptPath</Arguments>
    </Exec>
  </Actions>
</Task>
"@ | Out-File $xmlPath -Encoding UTF8
    
    # Write a simpler version without variables (they won't expand in the XML)
    $simpleXml = @"
<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.3" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Author>SYSTEM</Author>
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
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>true</RunOnlyIfNetworkAvailable>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <ExecutionTimeLimit>PT10M</ExecutionTimeLimit>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>C:\Users\HermesAdmin\AppData\Local\Programs\Python\Python314\python.exe</Command>
      <Arguments>C:\Users\HermesAdmin\Level-Up-Playbook\scripts\mfp_mail_outlook.py</Arguments>
    </Exec>
  </Actions>
</Task>
"@
    $simpleXml | Out-File $xmlPath -Encoding UTF8
    Write-Host "XML written to $xmlPath"
    
    schtasks /Create /XML $xmlPath /TN $taskName /F 2>&1
    Write-Host "schtasks exit code: $LASTEXITCODE"
    
    if ($LASTEXITCODE -eq 0) {
        schtasks /Run /TN $taskName 2>&1
        Write-Host "Task launched for test run."
    }
}