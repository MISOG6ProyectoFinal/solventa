# Allows the phone to reach Canales (8000) and LocalStack (4566) on a private network.
# Siniestros is published on 8001 for the computer only. Canales calls it inside Compose.

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
  if ($existing) {
    Write-Host "El puerto $($rule.Port) ya está permitido."
    continue
  }

  New-NetFirewallRule `
    -DisplayName $rule.Name `
    -Direction Inbound `
    -Protocol TCP `
    -LocalPort $rule.Port `
    -Action Allow `
    -Profile Private | Out-Null
  Write-Host "Puerto $($rule.Port) permitido en redes privadas."
}
