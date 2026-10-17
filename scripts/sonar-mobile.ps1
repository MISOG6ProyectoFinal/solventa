# Same local scan as the mobile-sonar job.
# powershell -File scripts/sonar-mobile.ps1

$ErrorActionPreference = "Stop"
. (Join-Path $PSScriptRoot "sonar-local.ps1")

$properties = @{
    "sonar.tests"              = "apps/mobile/src"
    "sonar.test.inclusions"    = "apps/mobile/src/**/*.spec.tsx,apps/mobile/src/test-setup.ts,apps/mobile/src/test-file-stub.js"
    "sonar.exclusions"         = "apps/mobile/src/**/*.spec.tsx,apps/mobile/src/test-setup.ts,apps/mobile/src/test-file-stub.js"
    "sonar.coverage.exclusions" = "apps/mobile/src/**/*.spec.tsx,apps/mobile/src/test-setup.ts,apps/mobile/src/test-file-stub.js"
}

$lcov = Join-Path $SonarRepoRoot "apps/mobile/coverage/lcov.info"
if (Test-Path $lcov) {
    $properties["sonar.javascript.lcov.reportPaths"] = "apps/mobile/coverage/lcov.info"
} else {
    Write-Host "No está apps/mobile/coverage/lcov.info. La cobertura saldrá en 0."
}

Invoke-SonarLocalScan `
    -ProjectName "Solventa-Mobile" `
    -Sources "apps/mobile/src" `
    -Properties $properties `
    -Gate @(
        @{ Metric = "coverage"; Label = "Cobertura"; Minimum = $true; Limit = 81.4; Suffix = "%" },
        @{ Metric = "duplicated_lines_density"; Label = "Duplicación"; Limit = 0; Suffix = "%" },
        @{ Metric = "code_smells"; Label = "Code smells"; Limit = 35; Suffix = "" },
        @{ Metric = "violations"; Label = "Violaciones"; Limit = 35; Suffix = "" },
        @{ Metric = "open_issues"; Label = "Issues abiertos"; Limit = 35; Suffix = "" },
        @{ Metric = "bugs"; Label = "Bugs"; Limit = 0; Suffix = "" },
        @{ Metric = "vulnerabilities"; Label = "Vulnerabilidades"; Limit = 0; Suffix = "" },
        @{ Metric = "security_hotspots"; Label = "Security hotspots"; Limit = 2; Suffix = "" },
        @{ Metric = "security_rating"; Label = "Security rating"; Limit = 1.0; Suffix = "" }
    )
