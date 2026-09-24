@echo off
powershell -ExecutionPolicy Bypass -Command "$xml = Get-Content 'C:\Users\HermesAdmin\Level-Up-Playbook\scripts\mfp_daily_task_simple.xml' -Raw; $xml | Out-File 'C:\WINDOWS\TEMP\mfp_task_utf16.xml' -Encoding Unicode; Write-Host 'XML written as UTF-16'"
schtasks /Create /XML "C:\WINDOWS\TEMP\mfp_task_utf16.xml" /TN "LUNA_MFP_DAILY_SCAN" /F
echo Exit code: %ERRORLEVEL%
schtasks /Query /TN "LUNA_MFP_DAILY_SCAN" /FO LIST /V