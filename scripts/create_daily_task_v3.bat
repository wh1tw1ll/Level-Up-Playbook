@echo off
schtasks /Create /SC DAILY /TN "LUNA_MFP_DAILY_SCAN" /TR "'C:\Users\HermesAdmin\AppData\Local\Programs\Python\Python314\python.exe' 'C:\Users\HermesAdmin\Level-Up-Playbook\scripts\mfp_mail_outlook.py'" /ST 08:30 /SD 09/25/2026 /RU HermesLU\HermesAdmin /F
echo Exit code: %ERRORLEVEL%