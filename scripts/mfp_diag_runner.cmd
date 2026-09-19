@echo off
REM Run MFP store diagnostic - output goes to file so Hermes can read it
"C:\Users\HermesAdmin\AppData\Local\Programs\Python\Python314\python.exe" "C:\Users\HermesAdmin\Level-Up-Playbook\scripts\mfp_diag_store.py" > "C:\Users\HermesAdmin\.hermes\mfp_diag_output.txt" 2>&1
echo Diagnostic complete. Exit code: %ERRORLEVEL%