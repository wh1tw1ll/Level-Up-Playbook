$outlook = New-Object -ComObject Outlook.Application
$ns = $outlook.GetNamespace('MAPI')
Write-Host "Outlook COM OK - folders: $($ns.Folders.Count)"
foreach ($f in $ns.Folders) {
    Write-Host "  Store: $($f.Name)"
}
