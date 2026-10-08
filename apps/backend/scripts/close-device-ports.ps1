# Removes the private-network rules created by open-device-ports.ps1.

$rules = @(
  @{ Port = 8000; Name = "Solventa Canales 8000" },
  @{ Port = 4566; Name = "Solventa LocalStack 4566" }
)

$current = [Security.Principal.WindowsPrincipal]::new([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $current.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  Write-Error "Ejecute este script en PowerShell como administrador."
  exit 1
}

foreach ($rule in $rules) {
  $existing = Get-NetFirewallRule -DisplayName $rule.Name -ErrorAction SilentlyContinue
  if (-not $existing) {
    Write-Host "El puerto $($rule.Port) ya estaba cerrado."
    continue
  }

  Remove-NetFirewallRule -DisplayName $rule.Name
  Write-Host "Puerto $($rule.Port) cerrado."
}
