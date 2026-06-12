Write-Output ("Session ID: " + [System.Diagnostics.Process]::GetCurrentProcess().SessionId)
Write-Output ("User: " + [System.Security.Principal.WindowsIdentity]::GetCurrent().Name)
Write-Output ("IsService: " + (New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())).IsInRole([Security.Principal.WindowsBuiltInRole]::ServiceAccount))