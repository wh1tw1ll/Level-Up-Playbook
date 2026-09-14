@echo off
schtasks /create /tn "MFP_Flagged_Sync_cron" /sc once /st 00:00 /tr "\"C:\Program Files\Python311\python.exe\" \"C:\Users\HermesAdmin\Level-Up-Playbook\scripts\sync_mfp_flagged.py\"" /ru HermesAdmin /IT /f
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: schtasks create returned %ERRORLEVEL%
    exit /b %ERRORLEVEL%
)
schtasks /run /tn "MFP_Flagged_Sync_cron"
schtasks /delete /tn "MFP_Flagged_Sync_cron" /f