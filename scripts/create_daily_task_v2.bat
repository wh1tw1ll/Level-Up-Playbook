@echo off
REM Create MFP daily scan task with LaunchOutlook pre-action
REM This task runs the MFP mail scanner, first launching Outlook to ensure it's running

schtasks /Create /SC DAILY /TN "LUNA_MFP_DAILY_SCAN" /TR "C:\Users\HermesAdmin\AppData\Local\Programs\Python\Python314\python.exe C:\Users\HermesAdmin\Level-Up-Playbook\scripts\mfp_mail_outlook.py" /ST 08:30 /SD 09/25/2026 /RU HermesLU\HermesAdmin /F /RL LIMITED /DELAY 0000:01:00
IF %ERRORLEVEL% NEQ 0 (
  echo ERROR: Task creation failed with code %ERRORLEVEL%
  goto :done
)
echo SUCCESS: Task LUNA_MFP_DAILY_SCAN created (daily at 8:30 AM)

REM Also run it NOW for a test
schtasks /Run /TN "LUNA_MFP_DAILY_SCAN"
echo Test run launched (exit code: %ERRORLEVEL%)

:done
echo Done.