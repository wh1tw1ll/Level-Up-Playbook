@echo off
cd /d C:\Users\HermesAdmin\Level-Up-Playbook
echo Running MFP flagged sync from temp batch...
python scripts\sync_mfp_flagged.py
echo DONE - EXIT_CODE=%ERRORLEVEL%