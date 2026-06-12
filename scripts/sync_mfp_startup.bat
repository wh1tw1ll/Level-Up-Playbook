@echo off
REM sync_mfp_startup.bat — Runs MFP flagged email sync at user logon
REM Must run in the interactive Windows session where Outlook COM can connect.
REM Installed via: C:\Users\HermesAdmin\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\

set LOGFILE=C:\Users\HermesAdmin\Level-Up-Playbook\scripts\flagged-startup.log
echo [%DATE% %TIME%] MFP Startup Sync Starting >> "%LOGFILE%"

cd /d "C:\Users\HermesAdmin\Level-Up-Playbook"
python scripts\sync_mfp_flagged.py >> "%LOGFILE%" 2>&1

echo [%DATE% %TIME%] MFP Startup Sync Complete >> "%LOGFILE%"