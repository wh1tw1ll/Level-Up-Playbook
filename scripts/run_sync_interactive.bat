@echo off
REM This batch runs Outlook COM sync from the user's interactive session.
REM Created as a workaround for session 0 COM dispatch limitation.
echo [%DATE% %TIME%] Starting interactive sync...
cd /d "C:\Users\HermesAdmin\Level-Up-Playbook"
python scripts\sync_mfp_flagged.py
echo [%DATE% %TIME%] Interactive sync complete.