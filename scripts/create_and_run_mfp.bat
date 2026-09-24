@echo off
schtasks /Create /SC ONCE /TN "LUNA_MFP_SCAN_NOW" /TR "C:\Users\HermesAdmin\AppData\Local\Programs\Python\Python314\python.exe C:\Users\HermesAdmin\Level-Up-Playbook\scripts\mfp_mail_outlook.py" /ST 08:52 /SD 09/24/2026 /RU HermesLU\HermesAdmin /F
echo Created task, exit code: %ERRORLEVEL%
schtasks /Run /TN "LUNA_MFP_SCAN_NOW"
echo Ran task, exit code: %ERRORLEVEL%