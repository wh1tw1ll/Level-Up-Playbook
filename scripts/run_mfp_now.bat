@echo off
schtasks /Create /SC ONCE /TN "LUNA_MFP_CRON_SCAN" /TR "C:\Users\HermesAdmin\AppData\Local\Programs\Python\Python314\python.exe C:\Users\HermesAdmin\Level-Up-Playbook\scripts\mfp_mail_outlook.py" /ST 07:25 /SD 09/30/2026 /RU HermesLU\HermesAdmin /F
echo Create exit code: %ERRORLEVEL%
if %ERRORLEVEL% neq 0 (
    echo Attempting without /RU...
    schtasks /Create /SC ONCE /TN "LUNA_MFP_CRON_SCAN2" /TR "C:\Users\HermesAdmin\AppData\Local\Programs\Python\Python314\python.exe C:\Users\HermesAdmin\Level-Up-Playbook\scripts\mfp_mail_outlook.py" /ST 07:28 /SD 09/30/2026 /F
    echo Create (no RU) exit code: %ERRORLEVEL%
    if %ERRORLEVEL% equ 0 (
        schtasks /Run /TN "LUNA_MFP_CRON_SCAN2"
        echo Run exit code: %ERRORLEVEL%
    ) else (
        echo Tried without RU, same issue. Checking user accounts...
        wmic useraccount get name,sid
    )
) else (
    schtasks /Run /TN "LUNA_MFP_CRON_SCAN"
    echo Run exit code: %ERRORLEVEL%
)
echo === BATCH COMPLETE ===
