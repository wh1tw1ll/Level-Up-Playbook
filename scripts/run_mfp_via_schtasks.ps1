$time = (Get-Date).AddMinutes(2).ToString('HH:mm')
schtasks /Create /SC ONCE /TN "MFP_Mail_Scan_Temp" /TR "C:\Users\HermesAdmin\AppData\Local\Programs\Python\Python314\python.exe C:\Users\HermesAdmin\Level-Up-Playbook\scripts\mfp_mail_outlook.py" /ST $time /IT /RU HermesAdmin /F
if ($LASTEXITCODE -eq 0) {
    Write-Host "Task created for $time, waiting..."
    Start-Sleep -Seconds 150
    Write-Host "Done waiting. Checking results..."
    schtasks /Query /TN "MFP_Mail_Scan_Temp" /V /FO LIST | Select-String "Last Result|Status|Last Run Time"
} else {
    Write-Host "Task creation failed with exit code $LASTEXITCODE"
}