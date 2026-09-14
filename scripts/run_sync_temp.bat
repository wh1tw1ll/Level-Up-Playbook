@echo off
cd /d C:\Users\HermesAdmin\Level-Up-Playbook
python scripts\sync_mfp_flagged.py
echo EXIT_CODE=%ERRORLEVEL%