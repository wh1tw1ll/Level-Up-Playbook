@echo off
schtasks /Create /TN "StartOutlookJob" /SC "ONCE" /ST "23:49" /TR "C:\Program Files\Microsoft Office\root\Office16\OUTLOOK.EXE" /IT /F
schtasks /Run /TN "StartOutlookJob"
schtasks /Delete /TN "StartOutlookJob" /F