# Same local scan as the backend-sonar job.
# powershell -File scripts/sonar-backend.ps1

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "sonar-local.ps1")

$coverage = Join-Path $SonarRepoRoot "apps/backend/coverage.xml"
if (-not (Test-Path $coverage)) {
    Write-Host "No está apps/backend/coverage.xml. La cobertura saldrá en 0."
}

Invoke-SonarLocalScan `
    -ProjectName "Solventa-Backend" `
    -Sources "apps/backend" `
    -Gate @(
        @{ Metric = "coverage"; Label = "Cobertura"; Minimum = $true; Limit = 85.0; Suffix = "%" },
        @{ Metric = "duplicated_lines_density"; Label = "Duplicación"; Limit = 0; Suffix = "%" },
        @{ Metric = "code_smells"; Label = "Code smells"; Limit = 5; Suffix = "" },
        @{ Metric = "violations"; Label = "Violaciones"; Limit = 5; Suffix = "" },
        @{ Metric = "open_issues"; Label = "Issues abiertos"; Limit = 5; Suffix = "" },
        @{ Metric = "bugs"; Label = "Bugs"; Limit = 0; Suffix = "" },
        @{ Metric = "vulnerabilities"; Label = "Vulnerabilidades"; Limit = 0; Suffix = "" },
        @{ Metric = "security_hotspots"; Label = "Security hotspots"; Limit = 20; Suffix = "" },
        @{ Metric = "security_rating"; Label = "Security rating"; Limit = 1.0; Suffix = "" }
    )
