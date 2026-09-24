@echo off
schtasks /Create /SC ONCE /TN "LUNA_MFP_TEST2" /TR "C:\Users\HermesAdmin\AppData\Local\Programs\Python\Python314\python.exe C:\Users\HermesAdmin\Level-Up-Playbook\scripts\test_schtask_run.py" /ST 08:55 /SD 09/24/2026 /F
echo Task created exit code: %ERRORLEVEL%
schtasks /Run /TN "LUNA_MFP_TEST2"
echo Task run exit code: %ERRORLEVEL%