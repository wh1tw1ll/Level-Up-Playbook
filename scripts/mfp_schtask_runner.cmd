@echo off
REM MFP Mail Scan - LIVE mode (COM confirmed working)
REM Runs in user's interactive session via Task Scheduler

"C:\Users\HermesAdmin\AppData\Local\Programs\Python\Python314\python.exe" "C:\Users\HermesAdmin\Level-Up-Playbook\scripts\mfp_mail_outlook.py" 2>"C:\Users\HermesAdmin\.hermes\mfp_scan_error.txt"

echo Script finished. Exit code: %ERRORLEVEL%