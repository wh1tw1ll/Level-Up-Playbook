@echo off
REM Register-MFP-Sync-Task.bat
REM Creates a one-time interactive scheduled task to run the MFP flagged email sync
REM in the user's console session where Outlook COM is available.
SETLOCAL EnableDelayedExpansion
SET TASKNAME=LunaMfpFlaggedSync

REM Clean up any existing task
schtasks /Delete /TN "%TASKNAME%" /F 2>nul

REM Create interactive logon task
schtasks /Create /TN "%TASKNAME%" /SC ONLOGON /DELAY 0001:00 /TR "C:\Users\HermesAdmin\Level-Up-Playbook\scripts\sync_mfp_startup.bat" /IT /F
echo === Task created ===

REM Run it now since user is already logged on
schtasks /Run /TN "%TASKNAME%"
echo === Task run triggered ===