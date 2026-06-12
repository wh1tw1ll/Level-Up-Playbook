' sync_mfp_flagged.vbs — Launches MFP flagged email sync silently at user logon
' Runs the Python sync script in the user's interactive session where Outlook COM works.
' Installed in: C:\Users\HermesAdmin\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\

Dim shell, fso, logPath, logFso, logLine
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

logPath = "C:\Users\HermesAdmin\Level-Up-Playbook\scripts\flagged-startup.log"

' Log startup
Set logFso = fso.OpenTextFile(logPath, 8, True)
logFso.WriteLine Now & " MFP Startup Sync starting..."
logFso.Close

' Run the sync script (hidden window, wait for completion)
shell.CurrentDirectory = "C:\Users\HermesAdmin\Level-Up-Playbook"
shell.Run "python scripts\sync_mfp_flagged.py >> """ & logPath & """ 2>&1", 0, True

' Log completion
Set logFso = fso.OpenTextFile(logPath, 8, True)
logFso.WriteLine Now & " MFP Startup Sync complete"
logFso.Close