@echo off
schtasks /Create /SC ONCE /TN "LUNA_MFP_SCAN_NOW" /TR "C:\Users\HermesAdmin\AppData\Local\Programs\Python\Python314\python.exe C:\Users\HermesAdmin\Level-Up-Playbook\scripts\mfp_mail_outlook.py" /ST 08:48 /SD 09/24/2026 /IT /RU HermesLU\HermesAdmin /F
echo schtasks exit code: %ERRORLEVEL%
