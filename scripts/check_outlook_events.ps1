Get-WinEvent -LogName Application -MaxEvents 20 | Where-Object { $_.ProviderName -like '*Outlook*' } | ForEach-Object {
    $msg = $_.Message -replace "`n"," " -replace "`r",""
    if ($msg.Length -gt 200) { $msg = $msg.Substring(0,200) }
    Write-Output ("[" + $_.TimeCreated.ToString() + "] " + $_.LevelDisplayName + ": " + $msg)
}