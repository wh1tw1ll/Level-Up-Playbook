@echo off
schtasks /Delete /TN "LUNA_MFP_SCAN_NOW" /F >nul 2>&1
schtasks /Create /SC ONCE /TN "LUNA_MFP_TEST" /TR "C:\Users\HermesAdmin\AppData\Local\Programs\Python\Python314\python.exe C:\Users\HermesAdmin\Level-Up-Playbook\scripts\test_schtask_run.py" /ST 08:54 /SD 09/24/2026 /RU HermesLU\HermesAdmin /F
schtasks /Run /TN "LUNA_MFP_TEST"