$ErrorActionPreference = 'Stop'
$taskName = "LUNA_MFP_DAILY_SCAN"

# Connect to Task Scheduler
$scheduler = New-Object -ComObject "Schedule.Service"
$scheduler.Connect()
$rootFolder = $scheduler.GetFolder("\")

# Delete if exists
try { $rootFolder.DeleteTask($taskName, 0) } catch { }

# Create new task
$task = $scheduler.NewTask(0)  # 0 = no XML initially

# --- Principal ---
$principal = $task.Principal
$principal.LogonType = 3       # TASK_LOGON_S4U = 3 (no password)
$principal.UserId = "HermesLU\HermesAdmin"
$principal.RunLevel = 1        # TASK_RUNLEVEL_LUA = 1 (LeastPrivilege)

# --- Settings ---
$settings = $task.Settings
$settings.Enabled = $true
$settings.AllowDemandStart = $true
$settings.DisallowStartIfOnBatteries = $false
$settings.StopIfGoingOnBatteries = $false
$settings.StartWhenAvailable = $true
$settings.RunOnlyIfNetworkAvailable = $true
$settings.MultipleInstances = 2          # TASK_INSTANCES_IGNORE_NEW = 2
$settings.ExecutionTimeLimit = "PT10M"  # 10 minutes timeout
$settings.Priority = 7

# --- Trigger: Daily at 8:30 AM ---
$trigger = $task.Triggers.Create(1)      # TASK_TRIGGER_DAILY = 1
$trigger.StartBoundary = "2026-09-25T08:30:00"
$trigger.Enabled = $true

# --- Action ---
$action = $task.Actions.Create(0)        # TASK_ACTION_EXEC = 0
$action.Path = "C:\Users\HermesAdmin\AppData\Local\Programs\Python\Python314\python.exe"
$action.Arguments = "C:\Users\HermesAdmin\Level-Up-Playbook\scripts\mfp_mail_outlook.py"

# --- Register ---
$rootFolder.RegisterTaskDefinition(
    $taskName,
    $task,
    6,              # TASK_CREATE_OR_UPDATE = 6
    $null,          # sddl (null = default)
    $null,          # group
    3               # TASK_LOGON_S4U = 3
)

Write-Host "Task '$taskName' registered successfully."

# Verify
$registeredTask = $rootFolder.GetTask($taskName)
Write-Host "  State: $($registeredTask.State)"
Write-Host "  Next Run: $($registeredTask.NextRunTime)"
Write-Host "  Enabled: $($registeredTask.Enabled)"

# Launch a test run NOW
try {
    $registeredTask.Run($null)
    Write-Host "  Test run launched. Check log file in ~60 seconds."
} catch {
    Write-Host "  Test run launch failed: $($_.Exception.Message)"
}

Write-Host ""
Write-Host "Done."